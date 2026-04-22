import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normPhone(p: string): string {
  let c = p.replace(/\D/g, '');
  if (c.startsWith('0')) c = '55' + c.substring(1);
  if (!c.startsWith('55')) c = '55' + c;
  return c;
}

async function sendWpp(baseUrl: string, clientToken: string | null, phone: string, message: string) {
  const resp = await fetch(`${baseUrl}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientToken ? { 'Client-Token': clientToken } : {}),
    },
    body: JSON.stringify({ phone: normPhone(phone), message }),
  });
  return resp.ok;
}

function buildChecklistMessage(checklistName: string, items: any[]): string {
  let msg = `📋 *${checklistName}*\n\nResponda cada item com o número:\n\n`;
  items.forEach((it, i) => {
    const n = i + 1;
    if (it.tipo === 'sim_nao') {
      msg += `${n}. ${it.descricao} _(responda: ${n} sim / ${n} não)_\n`;
    } else {
      msg += `${n}. ${it.descricao} 📷 _(envie foto com legenda: ${n})_\n`;
    }
  });
  msg += `\n_Para parar, responda "cancelar"._`;
  return msg;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Brazil time (UTC-3)
    const now = new Date();
    const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = brNow.toISOString().slice(0, 10);
    const dayKey = DAY_KEYS[brNow.getUTCDay()];
    const hh = brNow.getUTCHours().toString().padStart(2, '0');
    const mm = brNow.getUTCMinutes().toString().padStart(2, '0');
    const nowMinutes = brNow.getUTCHours() * 60 + brNow.getUTCMinutes();

    // Load active schedules
    const { data: agendamentos } = await supabase
      .from('checklist_agendamentos')
      .select('id, company_id, checklist_id, hora, weekly_days, ativo, checklists!inner(nome, ativo)')
      .eq('ativo', true);

    if (!agendamentos?.length) {
      return new Response(JSON.stringify({ ok: true, dispatched: 0, reason: 'no schedules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let dispatched = 0;
    const results: any[] = [];

    for (const ag of agendamentos as any[]) {
      if (!ag.checklists?.ativo) continue;
      const days = (ag.weekly_days || {}) as Record<string, boolean>;
      if (!days[dayKey]) continue;

      // Match hour:minute (window of 5 min — cron runs every 5min)
      const [agH, agM] = String(ag.hora).split(':').map(Number);
      const agMinutes = agH * 60 + agM;
      if (Math.abs(nowMinutes - agMinutes) > 4) continue;

      // Get linked employees
      const { data: links } = await supabase
        .from('checklist_agendamento_employees')
        .select('employee_id, employees!inner(id, nome, telefone, ativo)')
        .eq('agendamento_id', ag.id);

      if (!links?.length) continue;

      // Get items for the message
      const { data: items } = await supabase
        .from('checklist_items')
        .select('id, descricao, tipo, ordem')
        .eq('checklist_id', ag.checklist_id)
        .order('ordem', { ascending: true });

      if (!items?.length) continue;

      // Get Z-API
      const { data: integration } = await supabase
        .from('company_integrations')
        .select('*')
        .eq('company_id', ag.company_id)
        .eq('integration_type', 'zapi')
          .eq('is_active', true)
        .maybeSingle();

      if (!integration?.instance_id || !integration?.instance_token) {
        results.push({ agendamento: ag.id, skipped: 'no zapi' });
        continue;
      }
      const baseUrl = `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.instance_token}`;

      for (const link of links as any[]) {
        const emp = link.employees;
        if (!emp?.ativo || !emp?.telefone) continue;

        // Skip if already exists today
        const { data: existing } = await supabase
          .from('checklist_execucoes')
          .select('id')
          .eq('agendamento_id', ag.id)
          .eq('employee_id', emp.id)
          .eq('data', today)
          .maybeSingle();

        if (existing) continue;

        // Create execution
        const { data: exec, error: execErr } = await supabase
          .from('checklist_execucoes')
          .insert({
            company_id: ag.company_id,
            checklist_id: ag.checklist_id,
            agendamento_id: ag.id,
            employee_id: emp.id,
            data: today,
            status: 'em_andamento',
            iniciado_em: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (execErr || !exec) {
          results.push({ employee: emp.id, error: execErr?.message });
          continue;
        }

        // Send WhatsApp message
        const msg = buildChecklistMessage(ag.checklists.nome, items);
        const sent = await sendWpp(baseUrl, integration.client_token, emp.telefone, msg);

        // Create/refresh session
        await supabase.from('checklist_whatsapp_sessions').upsert(
          {
            company_id: ag.company_id,
            employee_id: emp.id,
            phone: normPhone(emp.telefone),
            execucao_id: exec.id,
            state: 'awaiting_responses',
            context: { items: items.map((i: any) => ({ id: i.id, tipo: i.tipo })) },
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: 'phone,company_id' as any }
        );

        dispatched++;
        results.push({ employee: emp.id, exec_id: exec.id, sent });
      }
    }

    return new Response(JSON.stringify({ ok: true, dispatched, time: `${hh}:${mm}`, dayKey, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('dispatch-checklists error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
