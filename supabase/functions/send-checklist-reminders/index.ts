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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date();
    const brNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const today = brNow.toISOString().slice(0, 10);
    const dayKey = DAY_KEYS[brNow.getUTCDay()];
    const nowMinutes = brNow.getUTCHours() * 60 + brNow.getUTCMinutes();

    // Schedules that have a configured reminder
    const { data: agendamentos } = await supabase
      .from('checklist_agendamentos')
      .select('id, company_id, checklist_id, hora, weekly_days, lembrete_apos_minutos, checklists!inner(nome, ativo)')
      .eq('ativo', true)
      .not('lembrete_apos_minutos', 'is', null);

    if (!agendamentos?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no schedules with reminder' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    const results: any[] = [];

    for (const ag of agendamentos as any[]) {
      if (!ag.checklists?.ativo) continue;
      const days = (ag.weekly_days || {}) as Record<string, boolean>;
      if (!days[dayKey]) continue;

      const [agH, agM] = String(ag.hora).split(':').map(Number);
      const reminderAt = agH * 60 + agM + Number(ag.lembrete_apos_minutos);
      // Trigger window: 5 minutes (matches cron)
      if (nowMinutes < reminderAt || nowMinutes > reminderAt + 4) continue;

      // Find executions still pending/in_progress (no concluido)
      const { data: execs } = await supabase
        .from('checklist_execucoes')
        .select('id, employee_id, status, lembrete_enviado_em, employees!inner(nome, telefone, ativo)')
        .eq('agendamento_id', ag.id)
        .eq('data', today)
        .in('status', ['pendente', 'em_andamento'])
        .is('lembrete_enviado_em', null);

      if (!execs?.length) continue;

      // Z-API integration
      const { data: integration } = await supabase
        .from('company_integrations')
        .select('*')
        .eq('company_id', ag.company_id)
        .eq('integration_type', 'zapi')
        .eq('is_active', true)
        .maybeSingle();

      if (!integration?.instance_id || !integration?.instance_token) continue;
      const baseUrl = `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.instance_token}`;

      for (const e of execs as any[]) {
        const emp = e.employees;
        if (!emp?.ativo || !emp?.telefone) continue;

        const msg =
          `⏰ *Lembrete: ${ag.checklists.nome}*\n\n` +
          `Olá ${emp.nome.split(' ')[0]}, você ainda não concluiu o checklist de hoje.\n` +
          `Responda os itens pendentes ou envie *checklist* para reabrir o menu.`;

        const ok = await sendWpp(baseUrl, integration.client_token, emp.telefone, msg);

        await supabase
          .from('checklist_execucoes')
          .update({ lembrete_enviado_em: new Date().toISOString() })
          .eq('id', e.id);

        sent++;
        results.push({ exec: e.id, employee: emp.id, ok });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('send-checklist-reminders error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
