import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { company_id, action, phone, message, employee_id } = body;

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
        headers: integration.client_token
          ? { 'Client-Token': integration.client_token }
          : {},
      });

      const data = await resp.json();
      const connected = data?.connected || data?.status === 'connected' || resp.ok;

      return new Response(JSON.stringify({ success: connected, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send message
    if (action === 'send') {
      if (!phone || !message) throw new Error('phone e message são obrigatórios');

      // Clean phone number (remove non-digits, ensure country code)
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '55' + cleanPhone.substring(1);
      if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

      const resp = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(integration.client_token ? { 'Client-Token': integration.client_token } : {}),
        },
        body: JSON.stringify({
          phone: cleanPhone,
          message,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Z-API error [${resp.status}]: ${JSON.stringify(data)}`);

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
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Colaborador sem telefone cadastrado' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const docTitle = body.document_title || 'Novo documento';
      const msg = `📄 Olá ${emp.nome}! Você tem um novo documento disponível: *${docTitle}*. Acesse o Portal do Colaborador para visualizar e assinar.`;

      let cleanPhone = emp.telefone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '55' + cleanPhone.substring(1);
      if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

      const resp = await fetch(`${baseUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(integration.client_token ? { 'Client-Token': integration.client_token } : {}),
        },
        body: JSON.stringify({ phone: cleanPhone, message: msg }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(`Z-API error [${resp.status}]: ${JSON.stringify(data)}`);

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
