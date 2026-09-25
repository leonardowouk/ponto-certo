import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { getExpectedMinutesForDate } from '@/lib/hourBank';

export interface ReviewPunch {
  id: string;
  punch_type: string;
  punched_at: string;
  status: string;
}

export interface ReviewDay {
  id: string;
  work_date: string;
  first_punch_at: string | null;
  last_punch_at: string | null;
  worked_minutes: number | null;
  expected_minutes: number | null;
  balance_minutes: number | null;
  break_minutes: number | null;
  status: string | null;
  notes: string | null;
  punches: ReviewPunch[];
  isMissing?: boolean;
}

export interface ReviewTotals { worked: number; expected: number; balance: number; breaks: number }

const dayKey = (d: number) => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d];

async function getExpectedWorkDays(employeeId: string, refMonth: Date): Promise<Set<string>> {
  const allDays = eachDayOfInterval({
    start: new Date(refMonth.getFullYear(), refMonth.getMonth(), 1),
    end: new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0),
  });
  const { data: ws } = await supabase.from('work_schedules').select('weekly_days').eq('employee_id', employeeId).maybeSingle();
  let weeklyDays: Record<string, boolean> | null = (ws?.weekly_days as Record<string, boolean>) || null;
  if (!weeklyDays) {
    const { data: emp } = await supabase.from('employees').select('sector_id').eq('id', employeeId).maybeSingle();
    if (emp?.sector_id) {
      const { data: ss } = await supabase.from('sector_schedules').select('weekly_days').eq('sector_id', emp.sector_id).maybeSingle();
      if (ss?.weekly_days) weeklyDays = ss.weekly_days as Record<string, boolean>;
    }
  }
  if (!weeklyDays) weeklyDays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
  const set = new Set<string>();
  for (const d of allDays) if (weeklyDays[dayKey(getDay(d))]) set.add(format(d, 'yyyy-MM-dd'));
  return set;
}

export function sumReviewTotals(days: ReviewDay[]): ReviewTotals {
  return days.reduce(
    (acc, d) => ({
      worked: acc.worked + (d.worked_minutes || 0),
      expected: acc.expected + (d.expected_minutes || 0),
      balance: acc.balance + (d.balance_minutes || 0),
      breaks: acc.breaks + (d.break_minutes || 0),
    }),
    { worked: 0, expected: 0, balance: 0, breaks: 0 }
  );
}

/** Builds the month's days exactly as the closing review (Conferência) computes them. */
export async function buildReviewDays(employeeId: string, refMonth: Date): Promise<{ days: ReviewDay[]; totals: ReviewTotals }> {
  const startDate = format(new Date(refMonth.getFullYear(), refMonth.getMonth(), 1), 'yyyy-MM-dd');
  const endDate = format(new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

  const [tsResult, punchResult, expectedDays, canonicalExpected] = await Promise.all([
    supabase.from('timesheets_daily').select('*').eq('employee_id', employeeId)
      .gte('work_date', startDate).lte('work_date', endDate).order('work_date', { ascending: true }),
    supabase.from('time_punches').select('id, punch_type, punched_at, status').eq('employee_id', employeeId)
      .gte('punched_at', startDate + 'T00:00:00').lte('punched_at', endDate + 'T23:59:59')
      .order('punched_at', { ascending: true }),
    getExpectedWorkDays(employeeId, refMonth),
    getExpectedMinutesForDate(employeeId, startDate),
  ]);

  const tsData = tsResult.data || [];
  const punchMap = new Map<string, ReviewPunch[]>();
  (punchResult.data || []).forEach(p => {
    const date = format(new Date(p.punched_at as string), 'yyyy-MM-dd');
    if (!punchMap.has(date)) punchMap.set(date, []);
    punchMap.get(date)!.push(p as ReviewPunch);
  });
  const tsMap = new Map<string, any>();
  tsData.forEach(d => tsMap.set(d.work_date, d));

  const days: ReviewDay[] = [];
  for (const dateStr of Array.from(expectedDays).sort()) {
    const existing = tsMap.get(dateStr);
    if (existing) {
      const worked = existing.worked_minutes || 0;
      const isAbono = existing.status === 'abono';
      days.push({
        ...existing,
        expected_minutes: canonicalExpected,
        balance_minutes: isAbono ? 0 : worked - canonicalExpected,
        punches: punchMap.get(dateStr) || [],
        isMissing: false,
      });
    } else {
      days.push({
        id: `missing-${dateStr}`, work_date: dateStr, first_punch_at: null, last_punch_at: null,
        worked_minutes: 0, expected_minutes: canonicalExpected, balance_minutes: -canonicalExpected,
        break_minutes: 0, status: null, notes: null, punches: [], isMissing: true,
      });
    }
  }
  for (const ts of tsData) {
    if (!expectedDays.has(ts.work_date)) {
      days.push({
        ...(ts as any),
        expected_minutes: 0,
        balance_minutes: ts.worked_minutes || 0,
        punches: punchMap.get(ts.work_date) || [],
        isMissing: false,
      });
    }
  }
  days.sort((a, b) => a.work_date.localeCompare(b.work_date));
  return { days, totals: sumReviewTotals(days) };
}
