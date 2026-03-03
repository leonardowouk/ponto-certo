import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  };
  return map[s || ''] || 'bg-muted text-muted-foreground';
};

export function EmployeeReviewModal({
  open, onClose, employeeId, employeeName, refMonth, companyId, currentStatus, onStatusChanged
}: EmployeeReviewModalProps) {
  const [days, setDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) loadDays();
  }, [open, employeeId, refMonth]);

  const loadDays = async () => {
    setLoading(true);
    const startDate = format(refMonth, 'yyyy-MM-dd');
    const endDate = format(new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

    const { data, error } = await supabase
      .from('timesheets_daily')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    if (error) console.error(error);
    setDays(data || []);
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
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
                  <TableHead className="text-center">Saída</TableHead>
                  <TableHead className="text-center">Trab.</TableHead>
                  <TableHead className="text-center">Esper.</TableHead>
                  <TableHead className="text-center">Saldo</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      {format(new Date(d.work_date + 'T12:00:00'), 'dd/MM (EEE)', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-center">{formatTime(d.first_punch_at)}</TableCell>
                    <TableCell className="text-center">{formatTime(d.last_punch_at)}</TableCell>
                    <TableCell className="text-center">{formatMinutes(d.worked_minutes)}</TableCell>
                    <TableCell className="text-center">{formatMinutes(d.expected_minutes)}</TableCell>
                    <TableCell className={`text-center ${(d.balance_minutes ?? 0) < 0 ? 'text-destructive' : ''}`}>
                      {formatMinutes(d.balance_minutes)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusBadge(d.status)}>{d.status || '-'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">TOTAIS:</TableCell>
                  <TableCell className="text-center font-bold">{formatMinutes(totals.worked)}</TableCell>
                  <TableCell className="text-center font-bold">{formatMinutes(totals.expected)}</TableCell>
                  <TableCell className={`text-center font-bold ${totals.balance < 0 ? 'text-destructive' : ''}`}>
                    {formatMinutes(totals.balance)}
                  </TableCell>
                  <TableCell />
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
