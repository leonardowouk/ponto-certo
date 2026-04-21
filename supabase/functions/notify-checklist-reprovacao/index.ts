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

/**
 * Body: { resposta_id: string }
 * Called by evaluate-checklist-photo whenever an item is reproved by AI.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { resposta_id } = await req.json();
    if (!resposta_id) {
      return new Response(JSON.stringify({ ok: false, error: 'resposta_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load context
    const { data: r } = await supabase
      .from('checklist_respostas')
      .select(`
        id, motivo_ia, foto_url,
        checklist_items(descricao),
        checklist_execucoes(company_id, checklists(nome), employees(nome))
      `)
      .eq('id', resposta_id)
      .maybeSingle();

    if (!r) {
      return new Response(JSON.stringify({ ok: false, error: 'resposta not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const exec: any = r.checklist_execucoes;
    const companyId = exec?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ ok: false, error: 'no company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if notification is enabled for this company
    const { data: setting } = await supabase
      .from('notification_settings')
      .select('is_enabled')
      .eq('company_id', companyId)
      .eq('notification_type', 'checklist_reprovacao')
      .maybeSingle();

    if (setting && !setting.is_enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: 'disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find Admin/RH with phones
    const { data: access } = await supabase
      .from('user_company_access')
      .select('user_id')
      .eq('company_id', companyId);
    const userIds = (access || []).map((a: any) => a.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds)
      .in('role', ['admin', 'rh']);
    const adminRhIds = Array.from(new Set((roles || []).map((x: any) => x.user_id)));

    const { data: emps } = await supabase
      .from('employees')
      .select('telefone, nome, auth_user_id')
      .in('auth_user_id', adminRhIds)
      .not('telefone', 'is', null);

    if (!emps?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: 'no recipients' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: integration } = await supabase
      .from('company_integrations')
      .select('*')
      .eq('company_id', companyId)
      .eq('integration_type', 'zapi')
      .maybeSingle();

    if (!integration?.instance_id || !integration?.instance_token) {
      return new Response(JSON.stringify({ ok: false, error: 'no zapi configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const baseUrl = `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.instance_token}`;

    const checklistName = exec?.checklists?.nome || 'Checklist';
    const empName = exec?.employees?.nome || 'Colaborador';
    const itemDesc = (r.checklist_items as any)?.descricao || 'Item';
    const motivo = r.motivo_ia || 'Sem detalhes';

    const msg =
      `⚠️ *Item reprovado pela IA*\n\n` +
      `Checklist: ${checklistName}\n` +
      `Colaborador: ${empName}\n` +
      `Item: ${itemDesc}\n\n` +
      `Parecer: ${motivo}\n\n` +
      `Acesse o painel para revisar.`;

    let sent = 0;
    for (const e of emps) {
      const ok = await sendWpp(baseUrl, integration.client_token, e.telefone!, msg);
      if (ok) sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('notify-checklist-reprovacao error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
