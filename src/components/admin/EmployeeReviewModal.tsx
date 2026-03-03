import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Loader2, Pencil, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Punch {
  id: string;
  punch_type: string;
  punched_at: string;
  status: string;
}

interface DayWithPunches {
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
  punches: Punch[];
  isMissing?: boolean; // day expected but no timesheet record
}

interface EmployeeReviewModalProps {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  refMonth: Date;
  companyId: string;
  currentStatus: string;
  onStatusChanged: () => void;
}

const formatMinutes = (m: number | null) => {
  if (m === null || m === undefined) return '00:00';
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const formatTime = (iso: string | null) => {
  if (!iso) return '--:--';
  return format(new Date(iso), 'HH:mm');
};

const statusBadge = (s: string | null) => {
  const map: Record<string, string> = {
    ok: 'bg-green-100 text-green-800',
    pendente: 'bg-yellow-100 text-yellow-800',
    revisao: 'bg-orange-100 text-orange-800',
    ajustado: 'bg-blue-100 text-blue-800',
    falta: 'bg-red-100 text-red-800',
    abono: 'bg-purple-100 text-purple-800',
  };
  return map[s || ''] || 'bg-muted text-muted-foreground';
};

const dayOfWeekKey = (jsDay: number): string => {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][jsDay];
};

export function EmployeeReviewModal({
  open, onClose, employeeId, employeeName, refMonth, companyId, currentStatus, onStatusChanged
}: EmployeeReviewModalProps) {
  const [days, setDays] = useState<DayWithPunches[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ entrada: string; saidaInt: string; retornoInt: string; saida: string; justificativa: string }>({ entrada: '', saidaInt: '', retornoInt: '', saida: '', justificativa: '' });
  const [savingMissing, setSavingMissing] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadDays();
  }, [open, employeeId, refMonth]);

  const getExpectedWorkDays = async (): Promise<Set<string>> => {
    const startDate = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
    const endDate = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0);
    const allDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Try employee work_schedule first
    const { data: ws } = await supabase
      .from('work_schedules')
      .select('weekly_days')
      .eq('employee_id', employeeId)
      .maybeSingle();

    let weeklyDays: Record<string, boolean> | null = null;

    if (ws?.weekly_days) {
      weeklyDays = ws.weekly_days as Record<string, boolean>;
    } else {
      // Try sector schedule
      const { data: emp } = await supabase
        .from('employees')
        .select('sector_id')
        .eq('id', employeeId)
        .maybeSingle();

      if (emp?.sector_id) {
        const { data: ss } = await supabase
          .from('sector_schedules')
          .select('weekly_days')
          .eq('sector_id', emp.sector_id)
          .maybeSingle();

        if (ss?.weekly_days) {
          weeklyDays = ss.weekly_days as Record<string, boolean>;
        }
      }
    }

    // Default: mon-fri
    if (!weeklyDays) {
      weeklyDays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
    }

    const workDates = new Set<string>();
    for (const day of allDays) {
      const key = dayOfWeekKey(getDay(day));
      if (weeklyDays[key]) {
        workDates.add(format(day, 'yyyy-MM-dd'));
      }
    }
    return workDates;
  };

  const loadDays = async () => {
    setLoading(true);
    const startDate = format(refMonth, 'yyyy-MM-dd');
    const endDate = format(new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

    const [tsResult, punchResult, expectedDays] = await Promise.all([
      supabase
        .from('timesheets_daily')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', startDate)
        .lte('work_date', endDate)
        .order('work_date', { ascending: true }),
      supabase
        .from('time_punches')
        .select('id, punch_type, punched_at, status')
        .eq('employee_id', employeeId)
        .gte('punched_at', startDate + 'T00:00:00')
        .lte('punched_at', endDate + 'T23:59:59')
        .order('punched_at', { ascending: true }),
      getExpectedWorkDays(),
    ]);

    const tsData = tsResult.data || [];
    const punchData = punchResult.data || [];

    // Group punches by date
    const punchMap = new Map<string, Punch[]>();
    punchData.forEach(p => {
      const date = format(new Date(p.punched_at), 'yyyy-MM-dd');
      if (!punchMap.has(date)) punchMap.set(date, []);
      punchMap.get(date)!.push(p as Punch);
    });

    // Map existing timesheets
    const tsMap = new Map<string, any>();
    tsData.forEach(d => tsMap.set(d.work_date, d));

    // Build full list: all expected days
    const allDaysList: DayWithPunches[] = [];
    const sortedDates = Array.from(expectedDays).sort();

    for (const dateStr of sortedDates) {
      const existing = tsMap.get(dateStr);
      if (existing) {
        allDaysList.push({
          ...existing,
          punches: punchMap.get(dateStr) || [],
          isMissing: false,
        });
      } else {
        // Missing day - expected to work but no timesheet
        allDaysList.push({
          id: `missing-${dateStr}`,
          work_date: dateStr,
          first_punch_at: null,
          last_punch_at: null,
          worked_minutes: 0,
          expected_minutes: 0,
          balance_minutes: 0,
          break_minutes: 0,
          status: null,
          notes: null,
          punches: [],
          isMissing: true,
        });
      }
    }

    // Also include any timesheet days that are NOT in expected (e.g. extra days worked)
    for (const ts of tsData) {
      if (!expectedDays.has(ts.work_date)) {
        allDaysList.push({
          ...ts,
          punches: punchMap.get(ts.work_date) || [],
          isMissing: false,
        });
      }
    }

    allDaysList.sort((a, b) => a.work_date.localeCompare(b.work_date));
    setDays(allDaysList);
    setLoading(false);
  };

  const totals = days.reduce(
    (acc, d) => ({
      worked: acc.worked + (d.worked_minutes || 0),
      expected: acc.expected + (d.expected_minutes || 0),
      balance: acc.balance + (d.balance_minutes || 0),
      breaks: acc.breaks + (d.break_minutes || 0),
    }),
    { worked: 0, expected: 0, balance: 0, breaks: 0 }
  );

  const hasUnresolvedDays = days.some(d =>
    d.isMissing || d.status === 'pendente' || d.status === 'revisao' || d.status === null
  );

  const handleMarkMissingDay = async (day: DayWithPunches, newStatus: 'falta' | 'abono') => {
    setSavingMissing(day.work_date);

    if (day.isMissing) {
      // Create a new timesheet_daily record
      const { error } = await supabase
        .from('timesheets_daily')
        .insert({
          employee_id: employeeId,
          work_date: day.work_date,
          worked_minutes: 0,
          expected_minutes: 0,
          balance_minutes: 0,
          break_minutes: 0,
          status: newStatus as any,
          notes: newStatus === 'abono' ? 'Abono de falta' : 'Falta registrada no fechamento',
        });

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: newStatus === 'abono' ? 'Abono registrado' : 'Falta registrada' });
        loadDays();
      }
    } else {
      // Update existing timesheet
      const { error } = await supabase
        .from('timesheets_daily')
        .update({
          status: newStatus as any,
          notes: newStatus === 'abono' ? 'Abono de falta' : 'Falta registrada no fechamento',
        })
        .eq('id', day.id);

      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: newStatus === 'abono' ? 'Abono registrado' : 'Falta registrada' });
        loadDays();
      }
    }
    setSavingMissing(null);
  };

  const startEdit = (day: DayWithPunches) => {
    const entrada = day.punches.find(p => p.punch_type === 'entrada');
    const intInicio = day.punches.find(p => p.punch_type === 'intervalo_inicio');
    const intFim = day.punches.find(p => p.punch_type === 'intervalo_fim');
    const saida = day.punches.find(p => p.punch_type === 'saida');
    setEditingDay(day.id);
    setEditValues({
      entrada: entrada?.punched_at ? format(new Date(entrada.punched_at), 'HH:mm') : (day.first_punch_at ? format(new Date(day.first_punch_at), 'HH:mm') : ''),
      saidaInt: intInicio?.punched_at ? format(new Date(intInicio.punched_at), 'HH:mm') : '',
      retornoInt: intFim?.punched_at ? format(new Date(intFim.punched_at), 'HH:mm') : '',
      saida: saida?.punched_at ? format(new Date(saida.punched_at), 'HH:mm') : (day.last_punch_at ? format(new Date(day.last_punch_at), 'HH:mm') : ''),
      justificativa: '',
    });
  };

  const startEditMissing = (day: DayWithPunches) => {
    setEditingDay(day.id);
    setEditValues({
      entrada: '',
      saidaInt: '',
      retornoInt: '',
      saida: '',
      justificativa: '',
    });
  };

  const cancelEdit = () => {
    setEditingDay(null);
  };

  const calculateMinutesFromTimes = (entrada: string, saida: string, saidaInt: string, retornoInt: string): { worked: number; breaks: number } => {
    if (!entrada || !saida) return { worked: 0, breaks: 0 };
    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = saida.split(':').map(Number);
    const totalMinutes = (sh * 60 + sm) - (eh * 60 + em);
    
    let breakMinutes = 0;
    if (saidaInt && retornoInt) {
      const [ih, im] = saidaInt.split(':').map(Number);
      const [rh, rm] = retornoInt.split(':').map(Number);
      breakMinutes = (rh * 60 + rm) - (ih * 60 + im);
    }
    
    return { worked: Math.max(0, totalMinutes - breakMinutes), breaks: Math.max(0, breakMinutes) };
  };

  const saveEdit = async (day: DayWithPunches) => {
    if (!editValues.justificativa.trim()) {
      toast({ title: 'Justificativa obrigatória', description: 'Informe o motivo do ajuste.', variant: 'destructive' });
      return;
    }

    if (!editValues.entrada && !editValues.saida) {
      toast({ title: 'Informe ao menos entrada e saída', variant: 'destructive' });
      return;
    }

    const toIso = (time: string) => {
      if (!time) return null;
      return `${day.work_date}T${time}:00`;
    };

    const newNote = `[Ajuste] ${editValues.justificativa.trim()}`;

    if (day.isMissing) {
      // Create new timesheet record for missing day with manual times
      const { worked, breaks } = calculateMinutesFromTimes(editValues.entrada, editValues.saida, editValues.saidaInt, editValues.retornoInt);
      
      // Get expected minutes from schedule
      const { data: ws } = await supabase
        .from('work_schedules')
        .select('expected_start, expected_end, break_minutes')
        .eq('employee_id', employeeId)
        .maybeSingle();
      
      let expectedMinutes = 0;
      if (ws?.expected_start && ws?.expected_end) {
        const [sh, sm] = ws.expected_start.split(':').map(Number);
        const [eh, em] = ws.expected_end.split(':').map(Number);
        expectedMinutes = (eh * 60 + em) - (sh * 60 + sm) - (ws.break_minutes || 0);
      }

      const { error } = await supabase
        .from('timesheets_daily')
        .insert({
          employee_id: employeeId,
          work_date: day.work_date,
          first_punch_at: toIso(editValues.entrada),
          last_punch_at: toIso(editValues.saida),
          worked_minutes: worked,
          break_minutes: breaks,
          expected_minutes: expectedMinutes,
          balance_minutes: worked - expectedMinutes,
          status: 'ajustado' as any,
          notes: newNote,
        });

      if (error) {
        toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Horário registrado!' });
        setEditingDay(null);
        loadDays();
      }
      return;
    }

    // Existing day: update punches
    const punchUpdates = [
      { type: 'entrada', time: toIso(editValues.entrada), existingId: day.punches.find(p => p.punch_type === 'entrada')?.id },
      { type: 'intervalo_inicio', time: toIso(editValues.saidaInt), existingId: day.punches.find(p => p.punch_type === 'intervalo_inicio')?.id },
      { type: 'intervalo_fim', time: toIso(editValues.retornoInt), existingId: day.punches.find(p => p.punch_type === 'intervalo_fim')?.id },
      { type: 'saida', time: toIso(editValues.saida), existingId: day.punches.find(p => p.punch_type === 'saida')?.id },
    ];

    let hasError = false;
    for (const pu of punchUpdates) {
      if (pu.existingId && pu.time) {
        const { error } = await supabase
          .from('time_punches')
          .update({ punched_at: pu.time, status: 'ajustado' as any })
          .eq('id', pu.existingId);
        if (error) { hasError = true; console.error(error); }
      }
    }

    // Recalculate worked minutes if entry/exit provided
    const { worked, breaks } = calculateMinutesFromTimes(editValues.entrada, editValues.saida, editValues.saidaInt, editValues.retornoInt);

    const existingNotes = day.notes || '';
    const updateData: Record<string, any> = {
      notes: existingNotes ? `${existingNotes} | ${newNote}` : newNote,
      status: 'ajustado' as any,
    };

    if (editValues.entrada) updateData.first_punch_at = toIso(editValues.entrada);
    if (editValues.saida) updateData.last_punch_at = toIso(editValues.saida);
    if (editValues.entrada && editValues.saida) {
      updateData.worked_minutes = worked;
      updateData.break_minutes = breaks;
      updateData.balance_minutes = worked - (day.expected_minutes || 0);
    }

    const { error } = await supabase
      .from('timesheets_daily')
      .update(updateData)
      .eq('id', day.id);

    if (error || hasError) {
      toast({ title: 'Erro ao salvar ajuste', description: error?.message || 'Erro ao atualizar batidas', variant: 'destructive' });
    } else {
      toast({ title: 'Ajuste salvo!' });
      setEditingDay(null);
      loadDays();
    }
  };

  const handleMarkReviewed = async () => {
    if (hasUnresolvedDays) {
      toast({
        title: 'Dias pendentes',
        description: 'Todos os dias devem estar resolvidos (com ponto, abono ou falta) antes de conferir.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const { error } = await supabase
      .from('monthly_closings' as any)
      .update({
        status: 'conferido',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('employee_id', employeeId)
      .eq('ref_month', format(refMonth, 'yyyy-MM-dd'))
      .eq('company_id', companyId);

    if (error) {
      toast({ title: 'Erro ao conferir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Conferido!', description: `${employeeName} marcado como conferido.` });
      onStatusChanged();
      onClose();
    }
    setSaving(false);
  };

  const isReadOnly = currentStatus === 'fechado';
  const needsResolution = (d: DayWithPunches) =>
    d.isMissing || d.status === null || d.status === 'pendente' || d.status === 'revisao';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Conferência — {employeeName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(refMonth, 'MMMM/yyyy', { locale: ptBR })}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            {hasUnresolvedDays && !isReadOnly && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                ⚠️ Existem dias sem ponto que precisam ser resolvidos como <strong>Falta</strong> ou <strong>Abono</strong> antes de conferir.
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-center">Entrada</TableHead>
                  <TableHead className="text-center">Saída Int.</TableHead>
                  <TableHead className="text-center">Retorno Int.</TableHead>
                  <TableHead className="text-center">Saída</TableHead>
                  <TableHead className="text-center">Trab.</TableHead>
                  <TableHead className="text-center">Esper.</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d) => {
                  const isEditing = editingDay === d.id;
                  const entrada = d.punches.find(p => p.punch_type === 'entrada');
                  const intInicio = d.punches.find(p => p.punch_type === 'intervalo_inicio');
                  const intFim = d.punches.find(p => p.punch_type === 'intervalo_fim');
                  const saida = d.punches.find(p => p.punch_type === 'saida');
                  const showResolution = needsResolution(d) && !isReadOnly;

                  return (
                    <TableRow key={d.id} className={d.isMissing ? 'bg-red-50' : ''}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(d.work_date + 'T12:00:00'), "EEE dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input type="time" className="w-24 h-7 text-xs text-center mx-auto" value={editValues.entrada}
                            onChange={e => setEditValues(v => ({ ...v, entrada: e.target.value }))} />
                        ) : formatTime(entrada?.punched_at || d.first_punch_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input type="time" className="w-24 h-7 text-xs text-center mx-auto" value={editValues.saidaInt}
                            onChange={e => setEditValues(v => ({ ...v, saidaInt: e.target.value }))} />
                        ) : formatTime(intInicio?.punched_at || null)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input type="time" className="w-24 h-7 text-xs text-center mx-auto" value={editValues.retornoInt}
                            onChange={e => setEditValues(v => ({ ...v, retornoInt: e.target.value }))} />
                        ) : formatTime(intFim?.punched_at || null)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input type="time" className="w-24 h-7 text-xs text-center mx-auto" value={editValues.saida}
                            onChange={e => setEditValues(v => ({ ...v, saida: e.target.value }))} />
                        ) : formatTime(saida?.punched_at || d.last_punch_at)}
                      </TableCell>
                      <TableCell className="text-center">{formatMinutes(d.worked_minutes)}</TableCell>
                      <TableCell className="text-center">{formatMinutes(d.expected_minutes)}</TableCell>
                      <TableCell className={`text-center ${(d.balance_minutes ?? 0) < 0 ? 'text-destructive' : ''}`}>
                        {formatMinutes(d.balance_minutes)}
                      </TableCell>
                      <TableCell className="text-center">
                        {d.isMissing && !d.status ? (
                          <Badge className="bg-red-100 text-red-800">Sem ponto</Badge>
                        ) : (
                          <Badge className={statusBadge(d.status)}>{d.status || '-'}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="space-y-1">
                            <Input
                              placeholder="Justificativa *"
                              className="h-7 text-xs w-32 mx-auto"
                              value={editValues.justificativa}
                              onChange={e => setEditValues(v => ({ ...v, justificativa: e.target.value }))}
                            />
                            <div className="flex gap-1 justify-center">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(d)}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ) : showResolution ? (
                          savingMissing === d.work_date ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            <div className="flex gap-1 justify-center flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 text-red-700 border-red-300 hover:bg-red-50"
                                onClick={() => handleMarkMissingDay(d, 'falta')}
                              >
                                Falta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2 text-purple-700 border-purple-300 hover:bg-purple-50"
                                onClick={() => handleMarkMissingDay(d, 'abono')}
                              >
                                Abono
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2"
                                onClick={() => d.isMissing ? startEditMissing(d) : startEdit(d)}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                Editar
                              </Button>
                            </div>
                          )
                        ) : !isReadOnly && !d.isMissing ? (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(d)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-bold">TOTAIS:</TableCell>
                  <TableCell className="text-center font-bold">{formatMinutes(totals.worked)}</TableCell>
                  <TableCell className="text-center font-bold">{formatMinutes(totals.expected)}</TableCell>
                  <TableCell className={`text-center font-bold ${totals.balance < 0 ? 'text-destructive' : ''}`}>
                    {formatMinutes(totals.balance)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>

            {!isReadOnly && currentStatus !== 'conferido' && (
              <div className="flex justify-end mt-4 gap-2 items-center">
                {hasUnresolvedDays && (
                  <span className="text-sm text-muted-foreground">Resolva todos os dias pendentes para conferir</span>
                )}
                <Button onClick={handleMarkReviewed} disabled={saving || hasUnresolvedDays}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                  Marcar como Conferido
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
