import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isValidStoragePath(value: unknown, employeeId: string): value is string {
  return typeof value === 'string'
    && value.length <= 500
    && /^atestados\/[0-9a-f-]+\/[0-9]{10,}\.(pdf|png|jpg|jpeg|webp)$/i.test(value)
    && value.startsWith(`atestados/${employeeId}/`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Verify the calling user
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401);

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: 'Não autenticado' }, 401);

    const { employee_id, company_id, ref_date, description, file_url } = await req.json();

    if (!isUuid(employee_id) || !isUuid(company_id) || typeof ref_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ref_date)) {
      return json({ error: 'Dados inválidos' }, 400);
    }

    if (!isValidStoragePath(file_url, employee_id)) {
      return json({ error: 'Arquivo inválido para este colaborador' }, 400);
    }

    if (description && (typeof description !== 'string' || description.length > 1000)) {
      return json({ error: 'Descrição inválida' }, 400);
    }

    // Verify the employee belongs to the user
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('id', employee_id)
      .eq('company_id', company_id)
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return json({ error: 'Colaborador não encontrado' }, 404);

    const { data: fileExists } = await supabaseAdmin.storage
      .from('documentos')
      .download(file_url);

    if (!fileExists) return json({ error: 'Arquivo enviado não encontrado' }, 400);

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

    return json({ success: true });
  } catch (err: any) {
    return json({ error: 'Erro ao registrar atestado' }, 400);
  }
});
