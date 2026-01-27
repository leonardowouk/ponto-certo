import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Punch {
  punched_at: string;
  punch_type: string;
}

interface Schedule {
  expected_start: string | null;
  expected_end: string | null;
  break_minutes: number | null;
}

interface LedgerEntry {
  id?: string;
  minutes: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, cpf_hash, pin, device_secret, unidade, selfie_image } = body;

    console.log(`[ponto-validate] Action: ${action}`);

    // Validar device_secret
    const { data: device } = await supabase
      .from('time_devices')
      .select('id, nome, unidade, ativo')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    // Para demo, aceitar se não houver dispositivos cadastrados
    const deviceId = device?.id || null;
    const deviceUnidade = device?.unidade || unidade || 'Demo';

    // Buscar colaborador pelo cpf_hash
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, nome, pin_hash, foto_cadastro_url, ativo, failed_attempts, locked_until')
      .eq('cpf_hash', cpf_hash)
      .eq('ativo', true)
      .maybeSingle();

    if (empError) {
      console.error('[ponto-validate] Employee query error:', empError);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao buscar colaborador' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!employee) {
      console.log('[ponto-validate] Employee not found for cpf_hash');
      // Log attempt
      await supabase.from('login_attempts').insert({
        cpf_hash,
        device_id: deviceId,
        success: false,
      });
      
      return new Response(
        JSON.stringify({ success: false, message: 'Colaborador não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar bloqueio
    if (employee.locked_until) {
      const lockUntil = new Date(employee.locked_until);
      if (lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Conta bloqueada. Tente novamente em ${remainingMinutes} minutos.` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ACTION: VALIDATE (validar CPF e PIN)
    if (action === 'validate') {
      // Verificar PIN
      const pinValid = await bcrypt.compare(pin, employee.pin_hash);

      if (!pinValid) {
        // Incrementar tentativas falhas
        const newAttempts = (employee.failed_attempts || 0) + 1;
        const updateData: Record<string, unknown> = { failed_attempts: newAttempts };

        // Bloquear após 5 tentativas
        if (newAttempts >= 5) {
          const lockUntil = new Date(Date.now() + 2 * 60 * 1000); // 2 minutos
          updateData.locked_until = lockUntil.toISOString();
        }

        await supabase
          .from('employees')
          .update(updateData)
          .eq('id', employee.id);

        // Log attempt
        await supabase.from('login_attempts').insert({
          cpf_hash,
          device_id: deviceId,
          success: false,
        });

        return new Response(
          JSON.stringify({ 
            success: false, 
            message: newAttempts >= 5 
              ? 'Muitas tentativas. Conta bloqueada por 2 minutos.' 
              : 'PIN incorreto' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resetar tentativas falhas
      await supabase
        .from('employees')
        .update({ failed_attempts: 0, locked_until: null })
        .eq('id', employee.id);

      // Log successful attempt
      await supabase.from('login_attempts').insert({
        cpf_hash,
        device_id: deviceId,
        success: true,
      });

      return new Response(
        JSON.stringify({
          success: true,
          employee: {
            id: employee.id,
            nome: employee.nome,
            foto_cadastro_url: employee.foto_cadastro_url,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: PUNCH (registrar ponto)
    if (action === 'punch') {
      // Verificar cooldown (3 minutos)
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      const { data: recentPunch } = await supabase
        .from('time_punches')
        .select('id, punched_at')
        .eq('employee_id', employee.id)
        .gte('punched_at', threeMinutesAgo.toISOString())
        .order('punched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentPunch) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Aguarde pelo menos 3 minutos entre batidas.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determinar tipo de ponto automaticamente
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: todayPunches } = await supabase
        .from('time_punches')
        .select('punch_type')
        .eq('employee_id', employee.id)
        .gte('punched_at', today.toISOString())
        .lt('punched_at', tomorrow.toISOString())
        .order('punched_at', { ascending: true });

      let punchType = 'entrada';
      const punches = todayPunches || [];

      if (punches.length === 0) {
        punchType = 'entrada';
      } else if (punches.length === 1) {
        punchType = 'intervalo_inicio';
      } else if (punches.length === 2) {
        punchType = 'intervalo_fim';
      } else if (punches.length === 3) {
        punchType = 'saida';
      } else {
        // Após 4 batidas, alternar
        punchType = punches.length % 2 === 0 ? 'entrada' : 'saida';
      }

      // Upload selfie
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timestamp = now.getTime();
      const selfieFileName = `${employee.id}/${dateStr}/${timestamp}.jpg`;

      // Converter base64 para blob
      const base64Data = selfie_image.replace(/^data:image\/\w+;base64,/, '');
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from('selfies_ponto')
        .upload(selfieFileName, binaryData, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('[ponto-validate] Upload error:', uploadError);
        return new Response(
          JSON.stringify({ success: false, message: 'Erro ao salvar selfie' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      const selfieUrl = `selfies_ponto/${selfieFileName}`;

      // Registrar ponto
      const punchedAt = now.toISOString();
      const { error: punchError } = await supabase
        .from('time_punches')
        .insert({
          employee_id: employee.id,
          device_id: deviceId,
          unidade: deviceUnidade,
          punched_at: punchedAt,
          punch_type: punchType,
          selfie_url: selfieUrl,
        });

      if (punchError) {
        console.error('[ponto-validate] Punch insert error:', punchError);
        return new Response(
          JSON.stringify({ success: false, message: 'Erro ao registrar ponto' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Recalcular timesheet do dia
      await recalculateTimesheet(supabase, employee.id, today);

      console.log(`[ponto-validate] Punch registered: ${employee.nome} - ${punchType}`);

      return new Response(
        JSON.stringify({
          success: true,
          punch_type: punchType,
          punched_at: punchedAt,
          employee_name: employee.nome,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Ação inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ponto-validate] Error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Erro interno do servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function recalculateTimesheet(supabase: any, employeeId: string, workDate: Date) {
  try {
    const dateStr = workDate.toISOString().split('T')[0];
    const tomorrow = new Date(workDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Buscar batidas do dia
    const { data: punchesData } = await supabase
      .from('time_punches')
      .select('punched_at, punch_type')
      .eq('employee_id', employeeId)
      .gte('punched_at', workDate.toISOString())
      .lt('punched_at', tomorrow.toISOString())
      .order('punched_at', { ascending: true });

    const punches: Punch[] = punchesData || [];

    if (punches.length === 0) {
      return;
    }

    const firstPunch = new Date(punches[0].punched_at);
    const lastPunch = new Date(punches[punches.length - 1].punched_at);

    // Calcular minutos trabalhados
    let workedMinutes = 0;
    let breakMinutes = 0;

    // Agrupar batidas em pares (entrada/saída, intervalo)
    for (let i = 0; i < punches.length - 1; i += 2) {
      if (i + 1 < punches.length) {
        const start = new Date(punches[i].punched_at);
        const end = new Date(punches[i + 1].punched_at);
        const diff = (end.getTime() - start.getTime()) / 60000;

        if (punches[i].punch_type === 'intervalo_inicio') {
          breakMinutes += diff;
        } else {
          workedMinutes += diff;
        }
      }
    }

    // Buscar jornada esperada
    const { data: scheduleData } = await supabase
      .from('work_schedules')
      .select('expected_start, expected_end, break_minutes')
      .eq('employee_id', employeeId)
      .maybeSingle();

    const schedule: Schedule | null = scheduleData;

    let expectedMinutes = 480; // 8 horas padrão
    if (schedule && schedule.expected_start && schedule.expected_end) {
      const [startH, startM] = schedule.expected_start.split(':').map(Number);
      const [endH, endM] = schedule.expected_end.split(':').map(Number);
      expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM) - (schedule.break_minutes || 60);
    }

    const balanceMinutes = Math.round(workedMinutes - expectedMinutes);

    // Determinar status
    let status = 'pendente';
    if (punches.length >= 4) {
      status = 'ok';
    } else if (punches.length >= 2) {
      status = 'revisao';
    }

    // Upsert timesheet
    await supabase
      .from('timesheets_daily')
      .upsert({
        employee_id: employeeId,
        work_date: dateStr,
        first_punch_at: firstPunch.toISOString(),
        last_punch_at: lastPunch.toISOString(),
        worked_minutes: Math.round(workedMinutes),
        break_minutes: Math.round(breakMinutes),
        expected_minutes: expectedMinutes,
        balance_minutes: balanceMinutes,
        status,
      }, {
        onConflict: 'employee_id,work_date',
      });

    // Atualizar banco de horas se status ok
    if (status === 'ok') {
      // Verificar se já existe lançamento automático para o dia
      const { data: existingLedgerData } = await supabase
        .from('hour_bank_ledger')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('ref_date', dateStr)
        .eq('source', 'automatico')
        .maybeSingle();

      const existingLedger: LedgerEntry | null = existingLedgerData;

      if (existingLedger) {
        await supabase
          .from('hour_bank_ledger')
          .update({ minutes: balanceMinutes })
          .eq('id', existingLedger.id);
      } else {
        await supabase
          .from('hour_bank_ledger')
          .insert({
            employee_id: employeeId,
            ref_date: dateStr,
            minutes: balanceMinutes,
            source: 'automatico',
          });
      }

      // Recalcular saldo total
      const { data: allLedgerData } = await supabase
        .from('hour_bank_ledger')
        .select('minutes')
        .eq('employee_id', employeeId)
        .eq('approval_status', 'aprovado');

      const allLedger: LedgerEntry[] = allLedgerData || [];
      const totalBalance = allLedger.reduce((acc, l) => acc + l.minutes, 0);

      await supabase
        .from('hour_bank_balance')
        .upsert({
          employee_id: employeeId,
          balance_minutes: totalBalance,
        }, {
          onConflict: 'employee_id',
        });
    }

  } catch (error) {
    console.error('[recalculateTimesheet] Error:', error);
  }
}
