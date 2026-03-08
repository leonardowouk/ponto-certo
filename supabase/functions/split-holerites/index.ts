import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function extractNameFromPage(pageBytes: Uint8Array, lovableApiKey: string): Promise<string | null> {
  try {
    const base64 = btoa(String.fromCharCode(...pageBytes));
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                text: 'Extraia APENAS o nome completo do funcionário/colaborador deste holerite/contracheque. Retorne SOMENTE o nome completo em letras maiúsculas, sem nenhum outro texto, explicação ou formatação. Se não encontrar, retorne "NAO_ENCONTRADO".'
              },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${base64}` }
              }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      console.error('AI response error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const name = data.choices?.[0]?.message?.content?.trim();
    if (!name || name === 'NAO_ENCONTRADO') return null;
    return name.toUpperCase();
  } catch (e) {
    console.error('AI extraction error:', e);
    return null;
  }
}

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
  
  // Exact match
  for (const emp of employees) {
    if (normalizeForMatch(emp.nome) === normalExtracted) return emp;
  }
  
  // Contains match (extracted name contains employee name or vice versa)
  for (const emp of employees) {
    const normalEmp = normalizeForMatch(emp.nome);
    if (normalExtracted.includes(normalEmp) || normalEmp.includes(normalExtracted)) return emp;
  }
  
  // Word-based fuzzy: at least first + last name match
  const extractedWords = normalExtracted.split(' ').filter(w => w.length > 2);
  let bestMatch: { emp: { id: string; nome: string }; score: number } | null = null;
  
  for (const emp of employees) {
    const empWords = normalizeForMatch(emp.nome).split(' ').filter(w => w.length > 2);
    const matchCount = empWords.filter(w => extractedWords.includes(w)).length;
    const score = matchCount / Math.max(empWords.length, 1);
    
    if (score >= 0.6 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { emp, score };
    }
  }
  
  return bestMatch?.emp || null;
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

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    console.log(`[split-holerites] Processing PDF: ${file.name}, company: ${companyId}, refMonth: ${refMonth}`);

    // Load PDF
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();
    console.log(`[split-holerites] PDF has ${totalPages} pages`);

    // Load employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, nome')
      .eq('company_id', companyId)
      .eq('ativo', true);

    if (empError || !employees?.length) {
      return new Response(
        JSON.stringify({ error: 'Nenhum colaborador ativo encontrado para esta empresa.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[split-holerites] Found ${employees.length} employees`);

    const results: Array<{
      page: number;
      extracted_name: string | null;
      matched_employee: { id: string; nome: string } | null;
      status: 'matched' | 'unmatched' | 'error';
      document_id?: string;
    }> = [];

    // Process each page
    for (let i = 0; i < totalPages; i++) {
      console.log(`[split-holerites] Processing page ${i + 1}/${totalPages}`);
      
      try {
        // Create single-page PDF
        const singlePageDoc = await PDFDocument.create();
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
        singlePageDoc.addPage(copiedPage);
        const singlePageBytes = await singlePageDoc.save();

        // Extract name using AI
        const extractedName = await extractNameFromPage(singlePageBytes, lovableApiKey);
        console.log(`[split-holerites] Page ${i + 1} extracted name: ${extractedName}`);

        if (!extractedName) {
          results.push({ page: i + 1, extracted_name: null, matched_employee: null, status: 'unmatched' });
          continue;
        }

        // Match to employee
        const matched = matchEmployee(extractedName, employees);
        
        if (!matched) {
          results.push({ page: i + 1, extracted_name: extractedName, matched_employee: null, status: 'unmatched' });
          continue;
        }

        console.log(`[split-holerites] Page ${i + 1} matched to: ${matched.nome}`);

        // Upload individual PDF to storage
        const storagePath = `${companyId}/${matched.id}/holerite_${refMonth}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(storagePath, singlePageBytes, { 
            contentType: 'application/pdf',
            upsert: true 
          });

        if (uploadError) {
          console.error(`[split-holerites] Upload error page ${i + 1}:`, uploadError);
          results.push({ page: i + 1, extracted_name: extractedName, matched_employee: matched, status: 'error' });
          continue;
        }

        // Create document record
        const { data: docData, error: docError } = await supabase
          .from('employee_documents')
          .insert({
            company_id: companyId,
            employee_id: matched.id,
            document_type: 'holerite',
            title: `${title} - ${matched.nome}`,
            file_url: storagePath,
            ref_month: refMonth,
            requires_signature: requiresSignature,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (docError) {
          console.error(`[split-holerites] Doc insert error page ${i + 1}:`, docError);
          results.push({ page: i + 1, extracted_name: extractedName, matched_employee: matched, status: 'error' });
          continue;
        }

        // Create pending signature
        if (requiresSignature && docData) {
          await supabase.from('document_signatures').insert({
            document_id: docData.id,
            employee_id: matched.id,
            status: 'pendente',
          });
        }

        results.push({
          page: i + 1,
          extracted_name: extractedName,
          matched_employee: matched,
          status: 'matched',
          document_id: docData?.id,
        });

      } catch (pageError) {
        console.error(`[split-holerites] Error on page ${i + 1}:`, pageError);
        results.push({ page: i + 1, extracted_name: null, matched_employee: null, status: 'error' });
      }
    }

    const summary = {
      total_pages: totalPages,
      matched: results.filter(r => r.status === 'matched').length,
      unmatched: results.filter(r => r.status === 'unmatched').length,
      errors: results.filter(r => r.status === 'error').length,
      results,
    };

    console.log(`[split-holerites] Done. Matched: ${summary.matched}, Unmatched: ${summary.unmatched}, Errors: ${summary.errors}`);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[split-holerites] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar PDF.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
