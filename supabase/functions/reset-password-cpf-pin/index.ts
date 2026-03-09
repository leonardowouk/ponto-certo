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

    const { cpf_hash, pin, new_password } = await req.json();

    if (!cpf_hash || !pin || !new_password) {
      return new Response(JSON.stringify({ error: 'Dados incompletos.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find employee by cpf_hash
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, nome, pin_hash, auth_user_id')
      .eq('cpf_hash', cpf_hash)
      .eq('ativo', true)
      .single();

    if (empError || !employee) {
      return new Response(JSON.stringify({ error: 'Colaborador não encontrado.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!employee.auth_user_id) {
      return new Response(JSON.stringify({ error: 'Esta conta ainda não foi registrada. Use "Primeiro Acesso".' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify PIN
    const [storedSalt, storedHash] = employee.pin_hash.split(':');
    const encoder = new TextEncoder();
    const pinData = encoder.encode(storedSalt + pin);
    const pinBuffer = await crypto.subtle.digest('SHA-256', pinData);
    const pinHashCalc = Array.from(new Uint8Array(pinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (pinHashCalc !== storedHash) {
      return new Response(JSON.stringify({ error: 'PIN incorreto.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update password via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      employee.auth_user_id,
      { password: new_password }
    );

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, employee_name: employee.nome }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(JSON.stringify({ error: 'Erro interno.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
