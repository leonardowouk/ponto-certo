import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { email, password, cpf_hash, pin_hash } = await req.json();

    if (!email || !password || !cpf_hash || !pin_hash) {
      return new Response(JSON.stringify({ error: 'Dados incompletos.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find employee by cpf_hash
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, nome, email, pin_hash, auth_user_id')
      .eq('cpf_hash', cpf_hash)
      .eq('ativo', true)
      .single();

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: 'Colaborador não encontrado. Verifique seu CPF.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify PIN
    if (employee.pin_hash !== pin_hash) {
      return new Response(JSON.stringify({ error: 'PIN incorreto.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if already registered
    if (employee.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Conta já registrada. Faça login.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { employee_id: employee.id, nome: employee.nome },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        return new Response(JSON.stringify({ error: 'Este email já está em uso.' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw authError;
    }

    const userId = authData.user.id;

    // Link auth user to employee
    await supabase.from('employees').update({
      auth_user_id: userId,
      email: email,
    }).eq('id', employee.id);

    // Add colaborador role
    await supabase.from('user_roles').insert({
      user_id: userId,
      role: 'colaborador',
    });

    return new Response(JSON.stringify({ success: true, employee_name: employee.nome }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
