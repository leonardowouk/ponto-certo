import { supabase } from '@/integrations/supabase/client';

const buildLocalIso = (workDate: string, time: string): string => {
  const [y, mo, d] = workDate.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).toISOString();
};

const timeToMin = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Recalculates timesheets_daily for a given employee/day from scratch using
 * the current punches. Creates or updates the row.
 */
export async function recalculateDailyTimesheet(employeeId: string, workDate: string) {
  const { data: punches } = await supabase
    .from('time_punches')
    .select('punch_type, punched_at')
    .eq('employee_id', employeeId)
    .gte('punched_at', `${workDate}T00:00:00`)
    .lte('punched_at', `${workDate}T23:59:59`)
    .order('punched_at', { ascending: true });

  const byType = new Map<string, string>();
  (punches || []).forEach(p => {
    if (p.punched_at && !byType.has(p.punch_type)) byType.set(p.punch_type, p.punched_at);
  });

  const entrada = byType.get('entrada');
  const saida = byType.get('saida');
  const intIni = byType.get('intervalo_inicio');
  const intFim = byType.get('intervalo_fim');

  let worked = 0;
  let breaks = 0;
  if (entrada && saida) {
    worked = timeToMin(saida) - timeToMin(entrada);
    if (intIni && intFim) {
      breaks = Math.max(0, timeToMin(intFim) - timeToMin(intIni));
      worked -= breaks;
    }
    worked = Math.max(0, worked);
  }

  // Get expected minutes (work_schedule first, then sector_schedule)
  let expectedMinutes = 0;
  const { data: ws } = await supabase
    .from('work_schedules')
    .select('expected_start, expected_end, break_minutes')
    .eq('employee_id', employeeId)
    .maybeSingle();

  let exp = ws;
  if (!exp?.expected_start) {
    const { data: emp } = await supabase
      .from('employees').select('sector_id').eq('id', employeeId).maybeSingle();
    if (emp?.sector_id) {
      const { data: ss } = await supabase
        .from('sector_schedules')
        .select('expected_start, expected_end, break_minutes')
        .eq('sector_id', emp.sector_id).maybeSingle();
      if (ss) exp = ss as any;
    }
  }
  if (exp?.expected_start && exp?.expected_end) {
    const [sh, sm] = exp.expected_start.split(':').map(Number);
    const [eh, em] = exp.expected_end.split(':').map(Number);
    expectedMinutes = (eh * 60 + em) - (sh * 60 + sm) - (exp.break_minutes || 0);
  }

  const { data: existing } = await supabase
    .from('timesheets_daily')
    .select('id, notes')
    .eq('employee_id', employeeId)
    .eq('work_date', workDate)
    .maybeSingle();

  const payload = {
    employee_id: employeeId,
    work_date: workDate,
    first_punch_at: entrada || null,
    last_punch_at: saida || null,
    worked_minutes: worked,
    break_minutes: breaks,
    expected_minutes: expectedMinutes,
    balance_minutes: worked - expectedMinutes,
    status: 'ajustado' as const,
  };

  if (existing) {
    await supabase.from('timesheets_daily').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('timesheets_daily').insert(payload as any);
  }
}

export async function approveCorrection(correctionId: string, reviewNotes?: string) {
  const { data: c, error: fetchErr } = await supabase
    .from('punch_corrections')
    .select('*')
    .eq('id', correctionId)
    .single();
  if (fetchErr || !c) throw fetchErr || new Error('Solicitação não encontrada');

  const punchedAt = buildLocalIso(c.work_date, c.requested_time as unknown as string);

  // If there's already a punch of the same type that day, update it; else insert
  const { data: existingPunch } = await supabase
    .from('time_punches')
    .select('id')
    .eq('employee_id', c.employee_id)
    .eq('punch_type', c.punch_type)
    .gte('punched_at', `${c.work_date}T00:00:00`)
    .lte('punched_at', `${c.work_date}T23:59:59`)
    .maybeSingle();

  if (existingPunch) {
    const { error } = await supabase.from('time_punches')
      .update({ punched_at: punchedAt, status: 'ajustado' as any })
      .eq('id', existingPunch.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('time_punches').insert({
      employee_id: c.employee_id,
      punch_type: c.punch_type as any,
      punched_at: punchedAt,
      status: 'ajustado' as any,
      unidade: 'correcao-aprovada',
      device_id: null as any,
      selfie_url: null as any,
    } as any);
    if (error) throw error;
  }

  await recalculateDailyTimesheet(c.employee_id, c.work_date);

  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;

  const { error: updErr } = await supabase
    .from('punch_corrections')
    .update({
      status: 'aprovado' as any,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
    })
    .eq('id', correctionId);
  if (updErr) throw updErr;
}

export async function rejectCorrection(correctionId: string, reviewNotes: string) {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  const { error } = await supabase
    .from('punch_corrections')
    .update({
      status: 'rejeitado' as any,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq('id', correctionId);
  if (error) throw error;
}
