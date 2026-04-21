import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      .select('id, foto_url, item_id, checklist_items!inner(descricao, criterios_ia, tipo)')
      .eq('id', resposta_id)
      .single();
    if (respErr || !resp) throw new Error('Resposta não encontrada');
    if (!resp.foto_url) throw new Error('Resposta sem foto');

    const item: any = resp.checklist_items;

    // Get signed URL for image
    const { data: signed } = await supabase.storage
      .from('checklist_fotos')
      .createSignedUrl(resp.foto_url, 600);
    if (!signed?.signedUrl) throw new Error('Não foi possível assinar URL da foto');

    // Fetch image and base64-encode
    const imgResp = await fetch(signed.signedUrl);
    if (!imgResp.ok) throw new Error('Falha ao baixar foto');
    const imgBuf = await imgResp.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(imgBuf)));
    const mime = imgResp.headers.get('content-type') || 'image/jpeg';

    const systemPrompt = `Você é um avaliador de checklists operacionais. Analise a foto enviada pelo colaborador comparando com a descrição do item e os critérios de aprovação. Seja rigoroso mas justo. Retorne sempre via tool call.`;

    const userPrompt = `Item: ${item.descricao}\n\nCritérios de aprovação:\n${item.criterios_ia || '(nenhum critério específico — avalie pelo bom senso operacional)'}\n\nAnalise a foto e diga se está aprovada.`;

    const aiBody = {
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
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
