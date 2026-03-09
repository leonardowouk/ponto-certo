import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "2026-03-09.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256HexString(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  return sha256Hex(data);
}

async function verifyPin(pinHash: string, pin: string): Promise<boolean> {
  const [salt] = pinHash.split(':');
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}` === pinHash;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[sign-document ${VERSION}] request`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get auth user from token
    const authHeader = req.headers.get('authorization');
    let authUserId: string | null = null;
    if (authHeader) {
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      authUserId = user?.id || null;
    }

    const body = await req.json();
    const { signature_id, pin, acceptance_text, signed_via, selfie_url, otp_code } = body;

    if (!signature_id || !pin || !acceptance_text) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: signature_id, pin, acceptance_text' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get signature + document + employee data
    const { data: sig, error: sigErr } = await supabase
      .from('document_signatures')
      .select('id, document_id, employee_id, status')
      .eq('id', signature_id)
      .single();

    if (sigErr || !sig) {
      return new Response(
        JSON.stringify({ error: 'Assinatura não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (sig.status === 'assinado') {
      return new Response(
        JSON.stringify({ error: 'Documento já foi assinado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get employee PIN hash
    const { data: emp } = await supabase
      .from('employees')
      .select('pin_hash, nome')
      .eq('id', sig.employee_id)
      .single();

    if (!emp) {
      return new Response(
        JSON.stringify({ error: 'Colaborador não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify PIN
    const pinValid = await verifyPin(emp.pin_hash, pin);
    if (!pinValid) {
      return new Response(
        JSON.stringify({ error: 'PIN incorreto' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Validate OTP if provided
    if (otp_code) {
      const otpHash = await sha256HexString(otp_code);
      const { data: otp } = await supabase
        .from('signature_otp')
        .select('id, expires_at, used')
        .eq('signature_id', signature_id)
        .eq('employee_id', sig.employee_id)
        .eq('code_hash', otpHash)
        .eq('used', false)
        .single();

      if (!otp) {
        return new Response(
          JSON.stringify({ error: 'Código de verificação inválido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      if (new Date(otp.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Código de verificação expirado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }

      // Mark OTP as used
      await supabase.from('signature_otp').update({ used: true }).eq('id', otp.id);
    }

    // Get document file for hash
    const { data: doc } = await supabase
      .from('employee_documents')
      .select('file_url, title')
      .eq('id', sig.document_id)
      .single();

    let documentHash = '';
    if (doc?.file_url) {
      const { data: fileData } = await supabase.storage
        .from('documentos')
        .download(doc.file_url);
      if (fileData) {
        const bytes = new Uint8Array(await fileData.arrayBuffer());
        documentHash = await sha256Hex(bytes);
      }
    }

    // Capture server-side metadata
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const signedAt = new Date().toISOString();
    const via = signed_via || 'portal';

    // Update signature record
    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status: 'assinado',
        signed_at: signedAt,
        signed_via: via,
        pin_verified: true,
        ip_address: ipAddress,
        user_agent: userAgent,
        document_hash: documentHash,
        acceptance_text: acceptance_text,
        selfie_url: selfie_url || null,
      })
      .eq('id', signature_id);

    if (updateErr) {
      console.error('[sign-document] Update error:', updateErr);
      return new Response(
        JSON.stringify({ error: 'Erro ao registrar assinatura' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Insert immutable audit log
    const { error: auditErr } = await supabase
      .from('signature_audit_log')
      .insert({
        signature_id: sig.id,
        document_id: sig.document_id,
        employee_id: sig.employee_id,
        action: 'signed',
        ip_address: ipAddress,
        user_agent: userAgent,
        document_hash: documentHash,
        acceptance_text: acceptance_text,
        pin_verified: true,
        signed_via: via,
        auth_user_id: authUserId,
        selfie_url: selfie_url || null,
      });

    if (auditErr) {
      console.error('[sign-document] Audit log error:', auditErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        signed_at: signedAt,
        document_hash: documentHash,
        ip_address: ipAddress,
        _version: VERSION,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sign-document] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', _version: VERSION }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
