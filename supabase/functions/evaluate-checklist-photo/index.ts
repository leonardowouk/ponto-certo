import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { resposta_id } = await req.json();
    if (!resposta_id) throw new Error('resposta_id é obrigatório');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurado');

    // Load resposta + item
    const { data: resp, error: respErr } = await supabase
      .from('checklist_respostas')
      .select('id, foto_url, item_id, checklist_items!inner(descricao, criterios_ia, tipo, foto_modelo_url)')
      .eq('id', resposta_id)
      .single();
    if (respErr || !resp) throw new Error('Resposta não encontrada');
    if (!resp.foto_url) throw new Error('Resposta sem foto');

    const item: any = resp.checklist_items;

    // Helper to fetch + b64-encode an image from a storage path
    const fetchAsB64 = async (path: string) => {
      const { data: signed } = await supabase.storage
        .from('checklist_fotos')
        .createSignedUrl(path, 600);
      if (!signed?.signedUrl) throw new Error('Não foi possível assinar URL: ' + path);
      const r = await fetch(signed.signedUrl);
      if (!r.ok) throw new Error('Falha ao baixar imagem: ' + path);
      const buf = await r.arrayBuffer();
      const b64 = encodeBase64(new Uint8Array(buf));
      const mime = r.headers.get('content-type') || 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    };

    const fotoEnviadaDataUrl = await fetchAsB64(resp.foto_url);
    let fotoModeloDataUrl: string | null = null;
    if (item.foto_modelo_url) {
      try {
        fotoModeloDataUrl = await fetchAsB64(item.foto_modelo_url);
      } catch (e) {
        console.error('Falha ao carregar foto modelo, seguindo sem ela:', e);
      }
    }

    const systemPrompt = `Você é um avaliador de checklists operacionais. Analise a foto enviada pelo colaborador comparando com a descrição do item${fotoModeloDataUrl ? ', com a foto de referência (modelo do que se espera)' : ''} e os critérios de aprovação. Seja rigoroso mas justo. Retorne sempre via tool call.`;

    const userPrompt = `Item: ${item.descricao}\n\nCritérios de aprovação:\n${item.criterios_ia || '(nenhum critério específico — avalie pelo bom senso operacional)'}\n\n${fotoModeloDataUrl ? 'A primeira imagem é a FOTO DE REFERÊNCIA (modelo aprovado). A segunda imagem é a FOTO ENVIADA PELO COLABORADOR. Compare as duas e avalie se a foto enviada atende ao padrão da referência.' : 'Analise a foto enviada e diga se está aprovada.'}`;

    const userContent: any[] = [{ type: 'text', text: userPrompt }];
    if (fotoModeloDataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: fotoModeloDataUrl } });
    }
    userContent.push({ type: 'image_url', image_url: { url: fotoEnviadaDataUrl } });

    const aiBody = {
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'avaliar_foto',
            description: 'Retorna a avaliação da foto do checklist',
            parameters: {
              type: 'object',
              properties: {
                aprovado: { type: 'boolean', description: 'true se a foto atende aos critérios' },
                confianca: { type: 'number', description: '0 a 1, quão confiante está na avaliação' },
                motivo: { type: 'string', description: 'Explicação curta da decisão (1-2 frases)' },
              },
              required: ['aprovado', 'confianca', 'motivo'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'avaliar_foto' } },
    };

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error('AI gateway error:', aiResp.status, t);
      throw new Error(`AI gateway error ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('IA não retornou tool call');
    const args = JSON.parse(toolCall.function.arguments);

    const status_ia = args.aprovado ? 'aprovado' : 'reprovado';

    // Always 'revisar' for status_final (per user choice)
    await supabase
      .from('checklist_respostas')
      .update({
        status_ia,
        confianca_ia: args.confianca,
        motivo_ia: args.motivo,
        status_final: 'revisar',
      })
      .eq('id', resposta_id);

    // Notify Admin/RH via WhatsApp when AI reproves (fire-and-forget)
    if (status_ia === 'reprovado') {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-checklist-reprovacao`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({ resposta_id }),
        });
      } catch (e) {
        console.error('failed to trigger notify-checklist-reprovacao', e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, status_ia, confianca: args.confianca, motivo: args.motivo }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('evaluate-checklist-photo error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
