import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

const punchTypeLabel: Record<string, string> = {
  entrada: 'Ent.',
  saida: 'Saí.',
  intervalo_inicio: 'Int.↓',
  intervalo_fim: 'Int.↑',
};

const statusBadge = (s: string | null) => {
  const map: Record<string, string> = {
    ok: 'bg-green-100 text-green-800',
    pendente: 'bg-yellow-100 text-yellow-800',
    revisao: 'bg-orange-100 text-orange-800',
    ajustado: 'bg-blue-100 text-blue-800',
    falta: 'bg-red-100 text-red-800',
  };
  return map[s || ''] || 'bg-muted text-muted-foreground';
};

export function EmployeeReviewModal({
  open, onClose, employeeId, employeeName, refMonth, companyId, currentStatus, onStatusChanged
}: EmployeeReviewModalProps) {
  const [days, setDays] = useState<DayWithPunches[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ worked: string; expected: string; notes: string }>({ worked: '', expected: '', notes: '' });
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadDays();
  }, [open, employeeId, refMonth]);

  const loadDays = async () => {
    setLoading(true);
    const startDate = format(refMonth, 'yyyy-MM-dd');
    const endDate = format(new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

    // Load timesheets
    const { data: tsData } = await supabase
      .from('timesheets_daily')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    // Load all punches for the month
    const { data: punchData } = await supabase
      .from('time_punches')
      .select('id, punch_type, punched_at, status')
      .eq('employee_id', employeeId)
      .gte('punched_at', startDate + 'T00:00:00')
      .lte('punched_at', endDate + 'T23:59:59')
      .order('punched_at', { ascending: true });

    // Group punches by date
    const punchMap = new Map<string, Punch[]>();
    (punchData || []).forEach(p => {
      const date = format(new Date(p.punched_at), 'yyyy-MM-dd');
      if (!punchMap.has(date)) punchMap.set(date, []);
      punchMap.get(date)!.push(p as Punch);
    });

    const daysWithPunches: DayWithPunches[] = (tsData || []).map(d => ({
      ...d,
      punches: punchMap.get(d.work_date) || [],
    }));

    setDays(daysWithPunches);
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

  const startEdit = (day: DayWithPunches) => {
    setEditingDay(day.id);
    setEditValues({
      worked: String(day.worked_minutes || 0),
      expected: String(day.expected_minutes || 0),
      notes: day.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingDay(null);
  };

  const saveEdit = async (dayId: string) => {
    const worked = parseInt(editValues.worked) || 0;
    const expected = parseInt(editValues.expected) || 0;
    const balance = worked - expected;

    const { error } = await supabase
      .from('timesheets_daily')
      .update({
        worked_minutes: worked,
        expected_minutes: expected,
        balance_minutes: balance,
        notes: editValues.notes || null,
        status: 'ajustado' as any,
      })
      .eq('id', dayId);

    if (error) {
      toast({ title: 'Erro ao salvar ajuste', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ajuste salvo!' });
      setEditingDay(null);
      loadDays();
    }
  };

  const handleMarkReviewed = async () => {
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
                  <TableHead className="text-center">Obs.</TableHead>
                  {currentStatus !== 'fechado' && <TableHead className="text-center w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d) => {
                  const isEditing = editingDay === d.id;
                  const entrada = d.punches.find(p => p.punch_type === 'entrada');
                  const intInicio = d.punches.find(p => p.punch_type === 'intervalo_inicio');
                  const intFim = d.punches.find(p => p.punch_type === 'intervalo_fim');
                  const saida = d.punches.find(p => p.punch_type === 'saida');

                  return (
                    <TableRow key={d.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(d.work_date + 'T12:00:00'), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-center">{formatTime(entrada?.punched_at || d.first_punch_at)}</TableCell>
                      <TableCell className="text-center">{formatTime(intInicio?.punched_at || null)}</TableCell>
                      <TableCell className="text-center">{formatTime(intFim?.punched_at || null)}</TableCell>
                      <TableCell className="text-center">{formatTime(saida?.punched_at || d.last_punch_at)}</TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number" className="w-16 h-7 text-xs text-center mx-auto"
                            value={editValues.worked}
                            onChange={e => setEditValues(v => ({ ...v, worked: e.target.value }))}
                          />
                        ) : formatMinutes(d.worked_minutes)}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number" className="w-16 h-7 text-xs text-center mx-auto"
                            value={editValues.expected}
                            onChange={e => setEditValues(v => ({ ...v, expected: e.target.value }))}
                          />
                        ) : formatMinutes(d.expected_minutes)}
                      </TableCell>
                      <TableCell className={`text-center ${(d.balance_minutes ?? 0) < 0 ? 'text-destructive' : ''}`}>
                        {formatMinutes(d.balance_minutes)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={statusBadge(d.status)}>{d.status || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs max-w-[120px] truncate">
                        {isEditing ? (
                          <Input
                            className="w-full h-7 text-xs"
                            value={editValues.notes}
                            onChange={e => setEditValues(v => ({ ...v, notes: e.target.value }))}
                            placeholder="Observação..."
                          />
                        ) : (
                          d.notes || '—'
                        )}
                      </TableCell>
                      {currentStatus !== 'fechado' && (
                        <TableCell className="text-center">
                          {isEditing ? (
                            <div className="flex gap-1 justify-center">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit(d.id)}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(d)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      )}
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
                  <TableCell colSpan={currentStatus !== 'fechado' ? 3 : 2} />
                </TableRow>
              </TableFooter>
            </Table>

            {currentStatus !== 'fechado' && currentStatus !== 'conferido' && (
              <div className="flex justify-end mt-4">
                <Button onClick={handleMarkReviewed} disabled={saving}>
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
