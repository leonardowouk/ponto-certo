import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function normalizeForMatch(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchEmployee(extractedName: string, employees: { id: string; nome: string }[]): { id: string; nome: string } | null {
  const normalExtracted = normalizeForMatch(extractedName);

  for (const emp of employees) {
    if (normalizeForMatch(emp.nome) === normalExtracted) return emp;
  }

  for (const emp of employees) {
    const normalEmp = normalizeForMatch(emp.nome);
    if (normalExtracted.includes(normalEmp) || normalEmp.includes(normalExtracted)) return emp;
  }

  const extractedWords = normalExtracted.split(' ').filter(w => w.length > 2);
  let bestMatch: { emp: { id: string; nome: string }; score: number } | null = null;

  for (const emp of employees) {
    const empWords = normalizeForMatch(emp.nome).split(' ').filter(w => w.length > 2);
    const matchCount = empWords.filter(w => extractedWords.includes(w)).length;
    const score = matchCount / Math.max(empWords.length, 1);
    if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { emp, score };
    }
  }

  return bestMatch?.emp || null;
}

async function saveSinglePage(
  supabase: any,
  originalPdfBytes: Uint8Array,
  pageIndex: number,
  employee: { id: string; nome: string },
  companyId: string,
  refMonth: string,
  title: string,
  requiresSignature: boolean,
  userId: string,
) {
  // Load a fresh copy from raw bytes and remove unwanted pages
  // This preserves encrypted content instead of copying to a new doc (which results in blank pages)
  const freshDoc = await PDFDocument.load(originalPdfBytes, { ignoreEncryption: true });
  const totalPages = freshDoc.getPageCount();
  for (let i = totalPages - 1; i >= 0; i--) {
    if (i !== pageIndex) freshDoc.removePage(i);
  }
  const singlePageBytes = await freshDoc.save();

  const storagePath = `${companyId}/${employee.id}/holerite_${refMonth}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(storagePath, singlePageBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadError) throw uploadError;

  const { data: docData, error: docError } = await supabase
    .from('employee_documents')
    .insert({
      company_id: companyId,
      employee_id: employee.id,
      document_type: 'holerite',
      title: `${title} - ${employee.nome}`,
      file_url: storagePath,
      ref_month: refMonth,
      requires_signature: requiresSignature,
      created_by: userId,
    })
    .select('id')
    .single();

  if (docError) throw docError;

  if (requiresSignature && docData) {
    await supabase.from('document_signatures').insert({
      document_id: docData.id,
      employee_id: employee.id,
      status: 'pendente',
    });
  }

  return docData?.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const contentType = req.headers.get('content-type') || '';

    // --- Manual assignment (JSON body) ---
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const { storage_path, page, employee_id, employee_name, company_id, ref_month, title: docTitle, requires_signature } = body;

      if (!storage_path || page == null || !employee_id || !company_id || !ref_month) {
        return new Response(JSON.stringify({ error: 'Dados incompletos.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Download the temp PDF from storage
      const { data: fileData, error: downloadError } = await supabase.storage.from('documentos').download(storage_path);
      if (downloadError || !fileData) {
        return new Response(JSON.stringify({ error: 'Arquivo temporário não encontrado.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

      const docId = await saveSinglePage(
        supabase, pdfDoc, page - 1,
        { id: employee_id, nome: employee_name || '' },
        company_id, ref_month, docTitle || 'Holerite',
        requires_signature !== false, user.id,
      );

      return new Response(JSON.stringify({ success: true, document_id: docId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- Bulk processing (FormData) ---
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const companyId = formData.get('company_id') as string;
    const refMonth = formData.get('ref_month') as string;
    const title = formData.get('title') as string || 'Holerite';
    const requiresSignature = formData.get('requires_signature') !== 'false';

    if (!file || !companyId || !refMonth) {
      return new Response(
        JSON.stringify({ error: 'Arquivo, empresa e mês de referência são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[split-holerites] Processing PDF: ${file.name}, size: ${file.size}`);

    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    console.log(`[split-holerites] PDF has ${totalPages} pages`);

    // Upload original PDF to temp storage for manual assignment later
    const tempPath = `${companyId}/temp/bulk_${Date.now()}.pdf`;
    await supabase.storage.from('documentos').upload(tempPath, pdfBytes, { contentType: 'application/pdf', upsert: true });

    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, nome')
      .eq('company_id', companyId)
      .eq('ativo', true);

    if (empError || !employees?.length) {
      return new Response(
        JSON.stringify({ error: 'Nenhum colaborador ativo encontrado.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[split-holerites] Found ${employees.length} employees`);

    const pdfBase64 = base64Encode(pdfBytes);

    const employeeNames = employees.map(e => e.nome).join(', ');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Este PDF contém ${totalPages} holerites/contracheques, um por página. Para cada página, extraia o nome completo do funcionário.

Retorne APENAS um JSON array no formato: [{"page": 1, "name": "NOME COMPLETO"}, {"page": 2, "name": "NOME COMPLETO"}, ...]

Lista de funcionários cadastrados para referência: ${employeeNames}

IMPORTANTE: Retorne SOMENTE o JSON, sem markdown, sem explicação, sem \`\`\`.`
              },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    let pageNameMap: Array<{ page: number; name: string }> = [];

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content?.trim() || '';
      console.log(`[split-holerites] AI response: ${content.substring(0, 500)}`);

      try {
        const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        pageNameMap = JSON.parse(cleaned);
      } catch (e) {
        console.error('[split-holerites] Failed to parse AI response:', e);
      }
    } else {
      const errText = await aiResponse.text();
      console.error(`[split-holerites] AI error ${aiResponse.status}: ${errText.substring(0, 500)}`);
    }

    const results: Array<{
      page: number;
      extracted_name: string | null;
      matched_employee: { id: string; nome: string } | null;
      status: 'matched' | 'unmatched' | 'error';
      document_id?: string;
    }> = [];

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const aiEntry = pageNameMap.find(p => p.page === pageNum);
      const extractedName = aiEntry?.name || null;

      if (!extractedName) {
        results.push({ page: pageNum, extracted_name: null, matched_employee: null, status: 'unmatched' });
        continue;
      }

      const matched = matchEmployee(extractedName, employees);
      if (!matched) {
        results.push({ page: pageNum, extracted_name: extractedName, matched_employee: null, status: 'unmatched' });
        continue;
      }

      try {
        const docId = await saveSinglePage(supabase, pdfDoc, i, matched, companyId, refMonth, title, requiresSignature, user.id);
        results.push({ page: pageNum, extracted_name: extractedName, matched_employee: matched, status: 'matched', document_id: docId });
      } catch (pageError) {
        console.error(`[split-holerites] Error page ${pageNum}:`, pageError);
        results.push({ page: pageNum, extracted_name: extractedName, matched_employee: matched, status: 'error' });
      }
    }

    const summary = {
      total_pages: totalPages,
      matched: results.filter(r => r.status === 'matched').length,
      unmatched: results.filter(r => r.status === 'unmatched').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
      temp_storage_path: tempPath,
    };

    console.log(`[split-holerites] Done. Matched: ${summary.matched}, Unmatched: ${summary.unmatched}`);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[split-holerites] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar PDF.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
