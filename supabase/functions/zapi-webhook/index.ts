import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normPhone(p: string): string {
  let c = String(p || '').replace(/\D/g, '');
  if (c.startsWith('0')) c = '55' + c.substring(1);
  if (!c.startsWith('55')) c = '55' + c;
  return c;
}

function phoneVariants(p: string): string[] {
  const normalized = normPhone(p);
  const local = normalized.startsWith('55') ? normalized.slice(2) : normalized;
  const variants = new Set([normalized, local, String(p || '').replace(/\D/g, '')]);

  if (local.length === 11 && local[2] === '9') {
    const withoutNinth = `${local.slice(0, 2)}${local.slice(3)}`;
    variants.add(withoutNinth);
    variants.add(`55${withoutNinth}`);
  }

  if (local.length === 10) {
    const withNinth = `${local.slice(0, 2)}9${local.slice(2)}`;
    variants.add(withNinth);
    variants.add(`55${withNinth}`);
  }

  return Array.from(variants).filter(Boolean);
}

async function sendWpp(baseUrl: string, clientToken: string | null, phone: string, message: string) {
  await fetch(`${baseUrl}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientToken ? { 'Client-Token': clientToken } : {}),
    },
    body: JSON.stringify({ phone: normPhone(phone), message }),
  });
}

function isRecentDuplicate(updatedAt: string | null | undefined, windowMs = 60_000) {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() < windowMs;
}

function buildChecklistMessage(name: string, items: any[]): string {
  let msg = `📋 *${name}*\n\nResponda cada item com o número:\n\n`;
  items.forEach((it: any, i: number) => {
    const n = i + 1;
    if (it.tipo === 'sim_nao') msg += `${n}. ${it.descricao} _(${n} sim / ${n} não)_\n`;
    else msg += `${n}. ${it.descricao} 📷 _(foto com legenda: ${n})_\n`;
  });
  msg += `\n_Para parar, responda "cancelar"._`;
  return msg;
}

function parseTextResponse(text: string): { itemNum: number; value: string } | null {
  const m = text.trim().match(/^(\d+)[\s:.\-]+(.+)$/);
  if (!m) return null;
  return { itemNum: parseInt(m[1], 10), value: m[2].trim().toLowerCase() };
}

function parseSimNao(v: string): boolean | null {
  const s = v.toLowerCase().trim();
  if (['sim', 's', 'ok', 'yes', 'y', '1', 'true'].includes(s)) return true;
  if (['nao', 'não', 'n', 'no', '0', 'false'].includes(s)) return false;
  return null;
}

async function evaluatePhotoAsync(supabaseUrl: string, serviceKey: string, respostaId: string) {
  // Fire-and-forget call to evaluate-checklist-photo
  fetch(`${supabaseUrl}/functions/v1/evaluate-checklist-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ resposta_id: respostaId }),
  }).catch((e) => console.error('evaluate trigger error:', e));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    console.log('zapi-webhook received:', JSON.stringify(body).slice(0, 500));

    // Z-API webhook payload (received message)
    const fromMe = body.fromMe === true;
    if (fromMe) return new Response('ok', { headers: corsHeaders });

    const phone = normPhone(body.phone || body.from || '');
    const phones = phoneVariants(body.phone || body.from || '');
    const instanceId = body.instanceId || body.instance_id || '';
    const messageText: string = (body.text?.message || body.message || body.body || '').toString().trim();
    const imageUrl: string | null = body.image?.imageUrl || body.image?.url || null;
    const imageCaption: string = (body.image?.caption || '').toString().trim();
    const hasIncomingContent = Boolean(messageText || imageUrl || imageCaption);

    if (!phone || !hasIncomingContent) {
      return new Response(JSON.stringify({ ok: false, reason: 'no phone' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify company by instanceId
    let integration: any = null;
    if (instanceId) {
      const { data } = await supabase
        .from('company_integrations')
        .select('*')
        .eq('integration_type', 'zapi')
        .eq('instance_id', instanceId)
        .eq('is_active', true)
        .maybeSingle();
      integration = data;
    }
    if (!integration) {
      // Fallback: try to find employee by phone across companies (single match)
      const { data: emps } = await supabase
        .from('employees')
        .select('id, company_id')
        .eq('telefone', phone)
        .eq('ativo', true);
      if (emps?.length === 1) {
        const { data } = await supabase
          .from('company_integrations')
          .select('*')
          .eq('company_id', emps[0].company_id)
          .eq('integration_type', 'zapi')
          .eq('is_active', true)
          .maybeSingle();
        integration = data;
      }
    }
    if (!integration) {
      console.warn('No integration found for instance', instanceId, 'phone', phone);
      return new Response('ok', { headers: corsHeaders });
    }

    const baseUrl = `https://api.z-api.io/instances/${integration.instance_id}/token/${integration.instance_token}`;
    const clientToken = integration.client_token;

    // Find employee in this company by phone
    const { data: employee } = await supabase
      .from('employees')
      .select('id, nome, company_id')
      .in('telefone', phones)
      .eq('company_id', integration.company_id)
      .eq('ativo', true)
      .maybeSingle();

    if (!employee) {
      console.warn('employee not found for incoming message', { phone, company_id: integration.company_id });
      return new Response('ok', { headers: corsHeaders });
    }

    // Load active session
    const { data: session } = await supabase
      .from('checklist_whatsapp_sessions')
      .select('*')
      .in('phone', phones)
      .eq('company_id', integration.company_id)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const lower = messageText.toLowerCase();

    // Cancel command
    if (lower === 'cancelar' || lower === 'sair' || lower === 'parar') {
      if (session) {
        await supabase.from('checklist_whatsapp_sessions').delete().eq('id', session.id);
      }
      await sendWpp(baseUrl, clientToken, phone, '❌ Sessão encerrada. Mande "checklist" para recomeçar.');
      return new Response('ok', { headers: corsHeaders });
    }

    // No active session — handle menu / on-demand
    if (!session || !session.execucao_id) {
      if (['checklist', 'menu', 'oi', 'olá', 'ola', 'inicio', 'início'].includes(lower)) {
        // List today's scheduled checklists for this employee
        const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][
          new Date(Date.now() - 3 * 60 * 60 * 1000).getUTCDay()
        ];

        const { data: links } = await supabase
          .from('checklist_agendamento_employees')
          .select('agendamento_id, checklist_agendamentos!inner(id, ativo, weekly_days, hora, checklist_id, checklists!inner(id, nome, ativo))')
          .eq('employee_id', employee.id);

        const available = (links || [])
          .map((l: any) => l.checklist_agendamentos)
          .filter((a: any) => a.ativo && a.checklists.ativo && a.weekly_days?.[dayKey]);

        if (!available.length) {
          await sendWpp(baseUrl, clientToken, phone, `Olá ${employee.nome}! Você não tem checklists agendados para hoje.`);
          return new Response('ok', { headers: corsHeaders });
        }

        let menu = `Olá ${employee.nome}! 👋\n\nChecklists disponíveis hoje:\n\n`;
        available.forEach((a: any, i: number) => {
          menu += `${i + 1}. ${a.checklists.nome} _(às ${String(a.hora).slice(0, 5)})_\n`;
        });
        menu += `\nResponda com o número do checklist que quer iniciar.`;

        await supabase.from('checklist_whatsapp_sessions').upsert(
          {
            company_id: integration.company_id,
            employee_id: employee.id,
            phone,
            execucao_id: null,
            state: 'choosing_checklist',
            context: { available: available.map((a: any) => ({ ag_id: a.id, checklist_id: a.checklist_id, today })) },
            expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: 'phone,company_id' as any }
        );
        await sendWpp(baseUrl, clientToken, phone, menu);
        return new Response('ok', { headers: corsHeaders });
      }

      // Not a known command
      await sendWpp(baseUrl, clientToken, phone, 'Mande "checklist" para ver as tarefas de hoje.');
      return new Response('ok', { headers: corsHeaders });
    }

    // Session in 'choosing_checklist'
    if (session.state === 'choosing_checklist') {
      const choice = parseInt(messageText.trim(), 10);
      const ctx = session.context as any;
      const list = ctx?.available || [];
      if (!choice || choice < 1 || choice > list.length) {
        await sendWpp(baseUrl, clientToken, phone, `Responda com um número entre 1 e ${list.length}.`);
        return new Response('ok', { headers: corsHeaders });
      }
      const chosen = list[choice - 1];

      // Check existing exec today
      const { data: existing } = await supabase
        .from('checklist_execucoes')
        .select('id, status')
        .eq('agendamento_id', chosen.ag_id)
        .eq('employee_id', employee.id)
        .eq('data', chosen.today)
        .maybeSingle();

      let execId = existing?.id;
      if (!execId) {
        const { data: exec } = await supabase
          .from('checklist_execucoes')
          .insert({
            company_id: integration.company_id,
            checklist_id: chosen.checklist_id,
            agendamento_id: chosen.ag_id,
            employee_id: employee.id,
            data: chosen.today,
            status: 'em_andamento',
            iniciado_em: new Date().toISOString(),
          })
          .select('id')
          .single();
        execId = exec?.id;
      }

      const { data: items } = await supabase
        .from('checklist_items')
        .select('id, descricao, tipo, ordem')
        .eq('checklist_id', chosen.checklist_id)
        .order('ordem', { ascending: true });

      const { data: checklist } = await supabase
        .from('checklists')
        .select('nome')
        .eq('id', chosen.checklist_id)
        .single();

      await supabase.from('checklist_whatsapp_sessions').update({
        execucao_id: execId,
        state: 'awaiting_responses',
        context: { items: (items || []).map((i: any) => ({ id: i.id, tipo: i.tipo })) },
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }).eq('id', session.id);

      await sendWpp(baseUrl, clientToken, phone, buildChecklistMessage(checklist!.nome, items || []));
      return new Response('ok', { headers: corsHeaders });
    }

    // Session in 'awaiting_responses' — process answer
    const ctx = session.context as any;
    const sessionItems: { id: string; tipo: string }[] = ctx?.items || [];
    if (!sessionItems.length) {
      await sendWpp(baseUrl, clientToken, phone, 'Sessão sem itens. Mande "checklist" para reiniciar.');
      return new Response('ok', { headers: corsHeaders });
    }

    // Determine item number from text or image caption
    let itemNum: number | null = null;
    let textValue: string = '';

    if (imageUrl) {
      const cap = parseTextResponse(imageCaption) || (imageCaption.match(/^(\d+)$/) ? { itemNum: parseInt(imageCaption, 10), value: '' } : null);
      if (cap) itemNum = cap.itemNum;
    } else {
      const parsed = parseTextResponse(messageText);
      if (parsed) {
        itemNum = parsed.itemNum;
        textValue = parsed.value;
      }
    }

    if (!itemNum || itemNum < 1 || itemNum > sessionItems.length) {
      await sendWpp(baseUrl, clientToken, phone, `Não entendi. Responda no formato: *N: resposta* (ex: 1 sim) ou envie a foto com legenda *N* para itens de foto. Itens: 1 a ${sessionItems.length}.`);
      return new Response('ok', { headers: corsHeaders });
    }

    const item = sessionItems[itemNum - 1];

    const { data: existingResponse } = await supabase
      .from('checklist_respostas')
      .select('id, texto_resposta, foto_url, updated_at')
      .eq('execucao_id', session.execucao_id)
      .eq('item_id', item.id)
      .maybeSingle();

    if (item.tipo === 'sim_nao') {
      const v = parseSimNao(textValue);
      if (v === null) {
        await sendWpp(baseUrl, clientToken, phone, `Item ${itemNum} espera *sim* ou *não*. Ex: ${itemNum} sim`);
        return new Response('ok', { headers: corsHeaders });
      }

      const normalizedAnswer = v ? 'sim' : 'não';
      if (existingResponse?.texto_resposta === normalizedAnswer && isRecentDuplicate(existingResponse.updated_at)) {
        return new Response('ok', { headers: corsHeaders });
      }

      await supabase.from('checklist_respostas').upsert(
        {
          execucao_id: session.execucao_id,
          item_id: item.id,
          texto_resposta: normalizedAnswer,
          status_final: v ? 'aprovado' : 'reprovado',
        },
        { onConflict: 'execucao_id,item_id' as any }
      );
      await sendWpp(baseUrl, clientToken, phone, `✅ Item ${itemNum} registrado: ${v ? 'sim' : 'não'}`);
    } else if (item.tipo === 'foto_ia') {
      if (!imageUrl) {
        await sendWpp(baseUrl, clientToken, phone, `Item ${itemNum} precisa de uma *foto*. Envie a imagem com legenda: ${itemNum}`);
        return new Response('ok', { headers: corsHeaders });
      }

      if (existingResponse?.foto_url && isRecentDuplicate(existingResponse.updated_at)) {
        return new Response('ok', { headers: corsHeaders });
      }

      // Download image and upload to storage
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) {
        await sendWpp(baseUrl, clientToken, phone, `Erro ao baixar a foto. Tente novamente.`);
        return new Response('ok', { headers: corsHeaders });
      }
      const buf = new Uint8Array(await imgResp.arrayBuffer());
      const ext = (imgResp.headers.get('content-type') || 'image/jpeg').includes('png') ? 'png' : 'jpg';
      const path = `${integration.company_id}/${session.execucao_id}/${item.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('checklist_fotos').upload(path, buf, {
        contentType: imgResp.headers.get('content-type') || 'image/jpeg',
        upsert: true,
      });
      if (upErr) {
        console.error('upload error', upErr);
        await sendWpp(baseUrl, clientToken, phone, `Erro ao salvar foto. Tente de novo.`);
        return new Response('ok', { headers: corsHeaders });
      }

      const { data: resp } = await supabase
        .from('checklist_respostas')
        .upsert(
          {
            execucao_id: session.execucao_id,
            item_id: item.id,
            foto_url: path,
            status_final: 'revisar',
          },
          { onConflict: 'execucao_id,item_id' as any }
        )
        .select('id')
        .single();

      if (resp?.id) evaluatePhotoAsync(supabaseUrl, serviceKey, resp.id);
      await sendWpp(baseUrl, clientToken, phone, `📷 Foto do item ${itemNum} recebida. A IA está analisando — gestor confirma a aprovação no painel.`);
    }

    // Check completion
    const { data: respostas } = await supabase
      .from('checklist_respostas')
      .select('item_id')
      .eq('execucao_id', session.execucao_id);

    const answered = new Set((respostas || []).map((r: any) => r.item_id));
    const allDone = sessionItems.every((it) => answered.has(it.id));

    if (allDone) {
      await supabase.from('checklist_execucoes').update({
        status: 'concluido',
        concluido_em: new Date().toISOString(),
      }).eq('id', session.execucao_id);

      await supabase.from('checklist_whatsapp_sessions').delete().eq('id', session.id);
      await sendWpp(baseUrl, clientToken, phone, `🎉 Checklist concluído! Obrigado, ${employee.nome}.`);
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err: any) {
    console.error('zapi-webhook error:', err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 200, // Always 200 to ack to Z-API
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
