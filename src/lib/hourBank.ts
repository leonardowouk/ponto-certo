import { supabase } from '@/integrations/supabase/client';

/**
 * Recalcula o saldo total do banco de horas de um colaborador
 * somando todos os lançamentos aprovados.
 */
export async function recalculateHourBankBalance(employeeId: string): Promise<void> {
  const { data: ledgerData } = await supabase
    .from('hour_bank_ledger')
    .select('minutes')
    .eq('employee_id', employeeId)
    .eq('approval_status', 'aprovado');

  const total = (ledgerData || []).reduce((sum, l) => sum + (l.minutes || 0), 0);

  await supabase
    .from('hour_bank_balance')
    .upsert(
      { employee_id: employeeId, balance_minutes: total },
      { onConflict: 'employee_id' }
    );
}

/**
 * Retorna a quantidade de minutos esperados para um colaborador em uma data específica.
 * Hierarquia: jornada individual > jornada do setor > padrão (8h - 1h = 420min).
 */
export async function getExpectedMinutesForDate(
  employeeId: string,
  _dateISO: string
): Promise<number> {
  // 1. Jornada individual
  const { data: individual } = await supabase
    .from('work_schedules')
    .select('expected_start, expected_end, break_minutes')
    .eq('employee_id', employeeId)
    .maybeSingle();

  let schedule = individual;

  // 2. Setor
  if (!schedule) {
    const { data: emp } = await supabase
      .from('employees')
      .select('sector_id')
      .eq('id', employeeId)
      .maybeSingle();

    if (emp?.sector_id) {
      const { data: sectorSchedule } = await supabase
        .from('sector_schedules')
        .select('expected_start, expected_end, break_minutes')
        .eq('sector_id', emp.sector_id)
        .maybeSingle();
      if (sectorSchedule) schedule = sectorSchedule;
    }
  }

  if (schedule?.expected_start && schedule?.expected_end) {
    const [sH, sM] = schedule.expected_start.split(':').map(Number);
    const [eH, eM] = schedule.expected_end.split(':').map(Number);
    return Math.max(0, eH * 60 + eM - (sH * 60 + sM) - (schedule.break_minutes ?? 60));
  }

  return 420;
}
