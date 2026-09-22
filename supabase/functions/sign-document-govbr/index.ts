import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const VERSION = "2026-09-22.1";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    console.log(`[sign-document-govbr ${VERSION}] request`);
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return json({ error: 'Não autenticado' }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Não autenticado' }, 401);

    const body = await req.json();
    const { signature_id, file_base64, file_name, acceptance_text } = body;

    if (!isUuid(signature_id) || typeof file_base64 !== 'string' || file_base64.length < 100) {
      return json({ error: 'Dados inválidos' }, 400);
    }
    if (typeof file_name !== 'string' || !/\.pdf$/i.test(file_name)) {
      return json({ error: 'O arquivo assinado precisa ser um PDF' }, 400);
    }

    const raw = file_base64.includes(',') ? file_base64.split(',')[1] : file_base64;
    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(raw);
    } catch (_e) {
      return json({ error: 'Arquivo inválido' }, 400);
    }
    if (bytes.byteLength > MAX_BYTES) return json({ error: 'Arquivo muito grande (máx. 20MB)' }, 400);

    // Must look like a PDF
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    if (header !== '%PDF-') return json({ error: 'O arquivo enviado não é um PDF válido' }, 400);

    // Basic evidence that the PDF carries a digital signature dictionary
    const scan = new TextDecoder('latin1').decode(bytes);
    const hasSignature = scan.includes('/Sig') || scan.includes('adbe.pkcs7') || scan.includes('ETSI.CAdES');

    const { data: sig } = await supabase
      .from('document_signatures')
      .select('id, document_id, employee_id, status')
      .eq('id', signature_id)
      .single();

    if (!sig) return json({ error: 'Assinatura não encontrada' }, 404);
    if (sig.status === 'assinado') return json({ error: 'Documento já foi assinado' }, 400);

    const { data: emp } = await supabase
      .from('employees')
      .select('id, nome, company_id, auth_user_id')
      .eq('id', sig.employee_id)
      .single();

    if (!emp || emp.auth_user_id !== user.id) {
      return json({ error: 'Você não tem permissão para assinar este documento' }, 403);
    }

    const { data: doc } = await supabase
      .from('employee_documents')
      .select('file_url, title')
      .eq('id', sig.document_id)
      .single();

    let originalHash = '';
    if (doc?.file_url) {
      const { data: fileData } = await supabase.storage.from('documentos').download(doc.file_url);
      if (fileData) originalHash = await sha256Hex(new Uint8Array(await fileData.arrayBuffer()));
    }

    const signedHash = await sha256Hex(bytes);
    const path = `${emp.company_id}/${emp.id}/assinado_govbr_${sig.document_id}_${Date.now()}.pdf`;

    const { error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: false });

    if (upErr) {
      console.error('[sign-document-govbr] upload error', upErr);
      return json({ error: 'Erro ao salvar o arquivo assinado' }, 500);
    }

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const signedAt = new Date().toISOString();
    const texto = typeof acceptance_text === 'string' && acceptance_text.length > 10
      ? acceptance_text.slice(0, 2000)
      : `Documento "${doc?.title || ''}" assinado digitalmente pelo assinador oficial do Governo Federal (gov.br / ITI), conforme Lei 14.063/2020 e MP 2.200-2/2001.`;

    const { error: updErr } = await supabase
      .from('document_signatures')
      .update({
        status: 'assinado',
        signed_at: signedAt,
        signed_via: 'portal',
        metodo: 'govbr',
        pin_verified: false,
        ip_address: ipAddress,
        user_agent: userAgent,
        document_hash: originalHash,
        acceptance_text: texto,
        arquivo_assinado_url: path,
        arquivo_assinado_hash: signedHash,
        arquivo_assinado_nome: file_name.slice(0, 200),
      })
      .eq('id', signature_id);

    if (updErr) {
      console.error('[sign-document-govbr] update error', updErr);
      return json({ error: 'Erro ao registrar a assinatura' }, 500);
    }

    await supabase.from('signature_audit_log').insert({
      signature_id: sig.id,
      document_id: sig.document_id,
      employee_id: sig.employee_id,
      action: 'signed',
      ip_address: ipAddress,
      user_agent: userAgent,
      document_hash: originalHash,
      arquivo_assinado_hash: signedHash,
      metodo: 'govbr',
      acceptance_text: texto,
      pin_verified: false,
      signed_via: 'portal',
      auth_user_id: user.id,
    });

    await supabase
      .from('admission_documents')
      .update({ status: 'assinado', assinado_em: signedAt })
      .eq('document_id', sig.document_id);

    return json({
      success: true,
      signed_file_hash: signedHash,
      document_hash: originalHash,
      has_signature_dictionary: hasSignature,
    });
  } catch (err) {
    console.error('[sign-document-govbr] error', err);
    return json({ error: 'Erro interno' }, 500);
  }
});
