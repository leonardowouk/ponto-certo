import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify the calling user
    const authHeader = req.headers.get('Authorization')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error('Não autenticado');

    const { employee_id, company_id, ref_date, description, file_url } = await req.json();

    // Verify the employee belongs to the user
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) throw new Error('Colaborador não encontrado');

    // Insert document as atestado
    const { error: insertError } = await supabaseAdmin
      .from('employee_documents')
      .insert({
        employee_id,
        company_id,
        title: `Atestado - ${ref_date}`,
        document_type: 'outro',
        description: description || null,
        ref_month: ref_date,
        file_url,
        requires_signature: false,
        created_by: user.id,
      });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
