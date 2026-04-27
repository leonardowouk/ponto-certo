import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeCpf(cpf: unknown) {
  return String(cpf || '').replace(/\D/g, '').slice(0, 11);
}

function decodeImage(image: string) {
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
  return Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const nomeCompleto = String(body.nome_completo || '').trim().replace(/\s+/g, ' ');
    const cpf = normalizeCpf(body.cpf);
    const selfieImage = String(body.selfie_image || '');
    const deviceSecret = String(body.device_secret || '');

    if (nomeCompleto.length < 5 || nomeCompleto.length > 160 || !nomeCompleto.includes(' ')) {
      return json({ success: false, message: 'Informe o nome completo.' }, 400);
    }
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
      return json({ success: false, message: 'CPF inválido.' }, 400);
    }
    if (!selfieImage.startsWith('data:image/')) {
      return json({ success: false, message: 'Foto inválida.' }, 400);
    }
    if (!deviceSecret) {
      return json({ success: false, message: 'Dispositivo inválido.' }, 400);
    }

    const deviceSecretHash = await sha256Hex(deviceSecret);
    const { data: device, error: deviceError } = await supabase
      .from('time_devices')
      .select('id, unidade, company_id, ativo')
      .eq('ativo', true)
      .eq('device_secret_hash', deviceSecretHash)
      .maybeSingle();

    if (deviceError) {
      console.error('[extra-time-record] Device error:', deviceError);
      return json({ success: false, message: 'Erro ao validar dispositivo.' }, 500);
    }

    let companyId = device?.company_id || null;
    if (!companyId) {
      const { data: companies } = await supabase.from('companies').select('id').eq('ativo', true).limit(2);
      if (companies?.length === 1) companyId = companies[0].id;
    }

    if (!companyId) {
      return json({ success: false, message: 'Configure a empresa deste dispositivo antes de registrar extras.' }, 400);
    }

    const cpfHash = await sha256Hex(cpf);
    const cpfLast4 = cpf.slice(-4);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const { data: existingPerson } = await supabase
      .from('extra_people')
      .select('id, nome_completo')
      .eq('company_id', companyId)
      .eq('cpf_hash', cpfHash)
      .maybeSingle();

    let personId = existingPerson?.id;
    if (!personId) {
      const { data: createdPerson, error: createPersonError } = await supabase
        .from('extra_people')
        .insert({ company_id: companyId, nome_completo: nomeCompleto, cpf_hash: cpfHash, cpf_last4: cpfLast4 })
        .select('id')
        .maybeSingle();
      if (createPersonError || !createdPerson?.id) {
        console.error('[extra-time-record] Person create error:', createPersonError);
        return json({ success: false, message: 'Erro ao cadastrar extra.' }, 500);
      }
      personId = createdPerson.id;
    } else if (existingPerson.nome_completo !== nomeCompleto) {
      await supabase.from('extra_people').update({ nome_completo: nomeCompleto, cpf_last4: cpfLast4 }).eq('id', personId);
    }

    const imagePath = `${companyId}/${personId}/${dateStr}/${now.getTime()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('extra_fotos')
      .upload(imagePath, decodeImage(selfieImage), { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      console.error('[extra-time-record] Upload error:', uploadError);
      return json({ success: false, message: 'Erro ao salvar foto.' }, 500);
    }

    const photoUrl = `extra_fotos/${imagePath}`;
    await supabase.from('extra_people').update({ foto_url: photoUrl }).eq('id', personId);

    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: recentRecord } = await supabase
      .from('extra_time_records')
      .select('id, entrada_at, saida_at')
      .eq('extra_person_id', personId)
      .gte('updated_at', threeMinutesAgo)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentRecord) {
      return json({ success: false, message: 'Aguarde pelo menos 3 minutos entre registros.' });
    }

    const { data: openRecord } = await supabase
      .from('extra_time_records')
      .select('id, entrada_at')
      .eq('company_id', companyId)
      .eq('extra_person_id', personId)
      .is('saida_at', null)
      .order('entrada_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openRecord) {
      const { data: updated, error: updateError } = await supabase
        .from('extra_time_records')
        .update({ saida_at: now.toISOString(), saida_foto_url: photoUrl })
        .eq('id', openRecord.id)
        .select('id, entrada_at, saida_at, total_minutes')
        .maybeSingle();
      if (updateError) {
        console.error('[extra-time-record] Exit update error:', updateError);
        return json({ success: false, message: 'Erro ao registrar saída.' }, 500);
      }
      return json({ success: true, action: 'saida', registered_at: now.toISOString(), person_name: nomeCompleto, record: updated });
    }

    const { data: createdRecord, error: createRecordError } = await supabase
      .from('extra_time_records')
      .insert({
        company_id: companyId,
        extra_person_id: personId,
        record_date: dateStr,
        entrada_at: now.toISOString(),
        entrada_foto_url: photoUrl,
      })
      .select('id, entrada_at, saida_at, total_minutes')
      .maybeSingle();

    if (createRecordError) {
      console.error('[extra-time-record] Entry create error:', createRecordError);
      return json({ success: false, message: 'Erro ao registrar entrada.' }, 500);
    }

    return json({ success: true, action: 'entrada', registered_at: now.toISOString(), person_name: nomeCompleto, record: createdRecord });
  } catch (error) {
    console.error('[extra-time-record] Error:', error);
    return json({ success: false, message: 'Erro interno do servidor.' }, 500);
  }
});
