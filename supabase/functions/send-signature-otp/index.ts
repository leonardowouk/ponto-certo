import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { employee_id, signature_id } = body;

    if (!employee_id || !signature_id) {
      return new Response(
        JSON.stringify({ error: 'employee_id e signature_id são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get employee email
    const { data: emp } = await supabase
      .from('employees')
      .select('email, nome')
      .eq('id', employee_id)
      .single();

    if (!emp?.email) {
      return new Response(
        JSON.stringify({ error: 'Colaborador não possui e-mail cadastrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Invalidate previous OTPs for this signature
    await supabase
      .from('signature_otp')
      .update({ used: true })
      .eq('signature_id', signature_id)
      .eq('employee_id', employee_id)
      .eq('used', false);

    // Insert new OTP
    const { error: insertErr } = await supabase
      .from('signature_otp')
      .insert({
        employee_id,
        signature_id,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error('[send-signature-otp] Insert error:', insertErr);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar código' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Send email via Lovable AI gateway
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (lovableApiKey) {
      try {
        const emailResponse = await fetch('https://api.lovable.dev/v1/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            to: emp.email,
            subject: 'Código de Verificação - Assinatura Digital',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
                <h2 style="color: #1a1a2e;">Código de Verificação</h2>
                <p>Olá <strong>${emp.nome}</strong>,</p>
                <p>Use o código abaixo para confirmar sua assinatura digital:</p>
                <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a1a2e;">${code}</span>
                </div>
                <p style="color: #666; font-size: 14px;">Este código expira em <strong>10 minutos</strong>.</p>
                <p style="color: #666; font-size: 14px;">Se você não solicitou este código, ignore este e-mail.</p>
              </div>
            `,
          }),
        });
        console.log('[send-signature-otp] Email sent, status:', emailResponse.status);
      } catch (emailErr) {
        console.error('[send-signature-otp] Email send error:', emailErr);
        // Don't fail the OTP generation if email fails
      }
    }

    // Mask email for response
    const parts = emp.email.split('@');
    const masked = parts[0].substring(0, 2) + '***@' + parts[1];

    return new Response(
      JSON.stringify({ success: true, email_masked: masked }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[send-signature-otp] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
