import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const currentHour = brNow.getUTCHours();

    // Companies with daily summary enabled and matching hour
    const { data: settings } = await supabase
      .from('notification_settings')
      .select('company_id, schedule_time, message_template')
      .eq('notification_type', 'checklist_daily_summary')
      .eq('is_enabled', true);

    if (!settings?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no companies configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    const results: any[] = [];

    for (const s of settings as any[]) {
      const scheduleHour = s.schedule_time ? parseInt(String(s.schedule_time).split(':')[0]) : 18;
      if (scheduleHour !== currentHour) continue;

      // Aggregate today's stats
      const { data: execs } = await supabase
        .from('checklist_execucoes')
        .select('id, status')
        .eq('company_id', s.company_id)
        .eq('data', today);

      const stats = { total: 0, concluido: 0, em_andamento: 0, pendente: 0, reprovado: 0, revisar: 0 } as any;
      const ids: string[] = [];
      (execs || []).forEach((e: any) => {
        stats.total++;
        stats[e.status] = (stats[e.status] || 0) + 1;
        ids.push(e.id);
      });

      let revisarCount = 0;
      let reprovadosCount = 0;
      if (ids.length > 0) {
        const { count: rc } = await supabase
          .from('checklist_respostas')
          .select('*', { count: 'exact', head: true })
          .in('execucao_id', ids)
          .eq('status_final', 'revisar');
        revisarCount = rc || 0;
        const { count: rep } = await supabase
          .from('checklist_respostas')
          .select('*', { count: 'exact', head: true })
          .in('execucao_id', ids)
          .eq('status_final', 'reprovado');
        reprovadosCount = rep || 0;
      }

      // Find Admin/RH recipients with phone for this company
      const { data: access } = await supabase
        .from('user_company_access')
        .select('user_id')
        .eq('company_id', s.company_id);
      const userIds = (access || []).map((a: any) => a.user_id);
      if (userIds.length === 0) continue;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds)
        .in('role', ['admin', 'rh']);
      const adminRhIds = Array.from(new Set((roles || []).map((r: any) => r.user_id)));
      if (adminRhIds.length === 0) continue;

      // Phones come from employees table linked via auth_user_id
      const { data: emps } = await supabase
        .from('employees')
        .select('telefone, nome, auth_user_id')
        .in('auth_user_id', adminRhIds)
        .not('telefone', 'is', null);

      if (!emps?.length) continue;

      const { data: integration } = await supabase
        .from('company_integrations')
        .select('*')
        .eq('company_id', s.company_id)
        .eq('integration_type', 'zapi')
        .maybeSingle();

      if (!integration?.instance_id || !integration?.instance_token) continue;
      const baseUrl = `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.instance_token}`;

      const dateLabel = new Date(today).toLocaleDateString('pt-BR');
      const msg =
        `📊 *Resumo de checklists — ${dateLabel}*\n\n` +
        `Total: ${stats.total}\n` +
        `✅ Concluídos: ${stats.concluido}\n` +
        `⏳ Em andamento: ${stats.em_andamento}\n` +
        `🕓 Pendentes: ${stats.pendente}\n` +
        `❌ Reprovados: ${stats.reprovado}\n` +
        `⚠️ A revisar: ${revisarCount}\n` +
        `🚫 Itens reprovados: ${reprovadosCount}`;

      for (const e of emps) {
        const ok = await sendWpp(baseUrl, integration.client_token, e.telefone!, msg);
        if (ok) sent++;
        results.push({ company: s.company_id, to: e.nome, ok });
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, hour: currentHour, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('send-checklist-daily-summary error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
