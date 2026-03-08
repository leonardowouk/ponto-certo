import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('_')) continue;
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

async function sendMessage(baseUrl: string, clientToken: string | null, phone: string, message: string) {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) cleanPhone = '55' + cleanPhone.substring(1);
  if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

  const resp = await fetch(`${baseUrl}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientToken ? { 'Client-Token': clientToken } : {}),
    },
    body: JSON.stringify({ phone: cleanPhone, message }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(`Z-API error [${resp.status}]: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { company_id, action, phone, message, employee_id, _template } = body;

    if (!company_id) throw new Error('company_id é obrigatório');

    // Get Z-API credentials for this company
    const { data: integration, error: intError } = await supabaseAdmin
      .from('company_integrations')
      .select('*')
      .eq('company_id', company_id)
      .eq('integration_type', 'zapi')
      .single();

    if (intError || !integration) throw new Error('Integração Z-API não configurada para esta empresa');
    if (!integration.instance_id || !integration.instance_token) throw new Error('Credenciais Z-API incompletas');

    const baseUrl = `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.instance_token}`;

    // Test connection
    if (action === 'test') {
      const resp = await fetch(`${baseUrl}/status`, {
        method: 'GET',
        headers: integration.client_token ? { 'Client-Token': integration.client_token } : {},
      });
      const data = await resp.json();
      const connected = data?.connected || data?.status === 'connected' || resp.ok;
      return new Response(JSON.stringify({ success: connected, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send raw message
    if (action === 'send') {
      if (!phone || !message) throw new Error('phone e message são obrigatórios');
      const data = await sendMessage(baseUrl, integration.client_token, phone, message);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notify employee about new document
    if (action === 'notify_document') {
      if (!employee_id) throw new Error('employee_id é obrigatório');

      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('nome, telefone')
        .eq('id', employee_id)
        .single();

      if (!emp) throw new Error('Colaborador não encontrado');
      if (!emp.telefone) {
        return new Response(JSON.stringify({ success: false, error: 'Colaborador sem telefone cadastrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const docTitle = body.document_title || 'Novo documento';
      const defaultMsg = `📄 Olá {nome}! Você tem um novo documento disponível: *{documento}*. Acesse o Portal do Colaborador para visualizar e assinar.`;
      const template = _template || defaultMsg;
      const msg = applyTemplate(template, { nome: emp.nome, documento: docTitle });

      const data = await sendMessage(baseUrl, integration.client_token, emp.telefone, msg);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notify correction approved/rejected
    if (action === 'notify_correction_approved' || action === 'notify_correction_rejected') {
      if (!employee_id) throw new Error('employee_id é obrigatório');

      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('nome, telefone')
        .eq('id', employee_id)
        .single();

      if (!emp) throw new Error('Colaborador não encontrado');
      if (!emp.telefone) {
        return new Response(JSON.stringify({ success: false, error: 'Colaborador sem telefone cadastrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const workDate = body.work_date || '';
      const motivo = body.review_notes || 'Sem motivo informado';
      
      const defaultApproved = `✅ Olá {nome}! Sua solicitação de correção de ponto do dia {data} foi *aprovada*.`;
      const defaultRejected = `❌ Olá {nome}! Sua solicitação de correção de ponto do dia {data} foi *rejeitada*. Motivo: {motivo}`;
      
      const defaultMsg = action === 'notify_correction_approved' ? defaultApproved : defaultRejected;
      const template = _template || defaultMsg;
      const msg = applyTemplate(template, { nome: emp.nome, data: workDate, motivo });

      const data = await sendMessage(baseUrl, integration.client_token, emp.telefone, msg);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notify monthly closing
    if (action === 'notify_closing') {
      if (!employee_id) throw new Error('employee_id é obrigatório');

      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('nome, telefone')
        .eq('id', employee_id)
        .single();

      if (!emp) throw new Error('Colaborador não encontrado');
      if (!emp.telefone) {
        return new Response(JSON.stringify({ success: false, error: 'Colaborador sem telefone cadastrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const mes = body.ref_month_label || '';
      const defaultMsg = `📊 Olá {nome}! Seu espelho de ponto de *{mes}* está disponível para conferência no Portal do Colaborador.`;
      const template = _template || defaultMsg;
      const msg = applyTemplate(template, { nome: emp.nome, mes });

      const data = await sendMessage(baseUrl, integration.client_token, emp.telefone, msg);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Notify certificate received (to RH)
    if (action === 'notify_certificate') {
      const employeeName = body.employee_name || 'Colaborador';
      const refDate = body.ref_date || '';
      const rhPhone = body.rh_phone;

      if (!rhPhone) {
        return new Response(JSON.stringify({ success: false, error: 'Telefone do RH não informado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const defaultMsg = `🏥 Novo atestado recebido de *{nome}* para o dia {data}. Acesse o painel para verificar.`;
      const template = _template || defaultMsg;
      const msg = applyTemplate(template, { nome: employeeName, data: refDate });

      const data = await sendMessage(baseUrl, integration.client_token, rhPhone, msg);
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Ação desconhecida: ${action}`);
  } catch (err: any) {
    console.error('send-whatsapp error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
