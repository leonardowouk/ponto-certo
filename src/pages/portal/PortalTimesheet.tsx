import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Eye, PenLine, X } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = subMonths(now, i);
    const first = startOfMonth(d);
    options.push({ value: format(first, 'yyyy-MM-dd'), label: format(first, 'MMMM/yyyy', { locale: ptBR }) });
  }
  return options;
};

const statusLabels: Record<string, { label: string; color: string }> = {
  ok: { label: 'OK', color: 'bg-green-100 text-green-800' },
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  revisao: { label: 'Revisão', color: 'bg-orange-100 text-orange-800' },
  falta: { label: 'Falta', color: 'bg-red-100 text-red-800' },
  abono: { label: 'Abono', color: 'bg-blue-100 text-blue-800' },
  ajustado: { label: 'Ajustado', color: 'bg-purple-100 text-purple-800' },
};

const punchTypeLabels: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  intervalo_inicio: 'Início Intervalo',
  intervalo_fim: 'Fim Intervalo',
};

const fmtMinutes = (min: number | null) => {
  if (min == null) return '-';
  const sign = min < 0 ? '-' : '';
  const abs = Math.abs(min);
  return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
};

const fmtTime = (dt: string | null) => {
  if (!dt) return '-';
  return format(new Date(dt), 'HH:mm');
};

export default function PortalTimesheet() {
  const { toast } = useToast();
  const monthOptions = getMonthOptions();
  const [month, setMonth] = useState(monthOptions[0].value);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ worked: 0, expected: 0, balance: 0 });
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  // Detail modal
  const [detailEntry, setDetailEntry] = useState<any | null>(null);
  const [punches, setPunches] = useState<any[]>([]);
  const [loadingPunches, setLoadingPunches] = useState(false);

  // Correction modal
  const [correctionEntry, setCorrectionEntry] = useState<any | null>(null);
  const [corrPunchType, setCorrPunchType] = useState('entrada');
  const [corrTime, setCorrTime] = useState('');
  const [corrReason, setCorrReason] = useState('');
  const [submittingCorr, setSubmittingCorr] = useState(false);

  useEffect(() => {
    loadTimesheet();
  }, [month]);

  const loadTimesheet = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return;
    setEmployeeId(emp.id);

    const monthDate = new Date(month + 'T12:00:00');
    const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('timesheets_daily')
      .select('*')
      .eq('employee_id', emp.id)
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date');

    const rows = data || [];
    setEntries(rows);

    const worked = rows.reduce((s, r) => s + (r.worked_minutes || 0), 0);
    const expected = rows.reduce((s, r) => s + (r.expected_minutes || 0), 0);
    const balance = rows.reduce((s, r) => s + (r.balance_minutes || 0), 0);
    setTotals({ worked, expected, balance });

    setLoading(false);
  };

  const openDetail = async (entry: any) => {
    setDetailEntry(entry);
    setLoadingPunches(true);

    if (!employeeId) return;

    const workDate = entry.work_date;
    const dayStart = `${workDate}T00:00:00`;
    const dayEnd = `${workDate}T23:59:59`;

    const { data } = await supabase
      .from('time_punches')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('punched_at', dayStart)
      .lte('punched_at', dayEnd)
      .order('punched_at');

    setPunches(data || []);
    setLoadingPunches(false);
  };

  const openCorrection = (entry: any) => {
    setCorrectionEntry(entry);
    setCorrPunchType('entrada');
    setCorrTime('');
    setCorrReason('');
  };

  const submitCorrection = async () => {
    if (!correctionEntry || !employeeId || !corrTime || !corrReason.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setSubmittingCorr(true);

    const { error } = await supabase
      .from('punch_corrections')
      .insert({
        employee_id: employeeId,
        work_date: correctionEntry.work_date,
        requested_time: corrTime,
        punch_type: corrPunchType as any,
        reason: corrReason.trim(),
      });

    if (error) {
      toast({ title: 'Erro ao enviar solicitação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Solicitação enviada!', description: 'Aguarde a análise do RH.' });
      setCorrectionEntry(null);
    }
    setSubmittingCorr(false);
  };

  return (
    <PortalLayout currentPage="timesheet">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Meus Pontos</h1>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Mês:</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">Trabalhado</p>
              <p className="text-xl font-bold">{fmtMinutes(totals.worked)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">Esperado</p>
              <p className="text-xl font-bold">{fmtMinutes(totals.expected)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtMinutes(totals.balance)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" /> Espelho de Ponto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : entries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum registro neste mês.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Trabalhado</TableHead>
                      <TableHead>Esperado</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map(e => {
                      const st = statusLabels[e.status] || { label: e.status, color: '' };
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(e.work_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>{fmtTime(e.first_punch_at)}</TableCell>
                          <TableCell>{fmtTime(e.last_punch_at)}</TableCell>
                          <TableCell>{fmtMinutes(e.worked_minutes)}</TableCell>
                          <TableCell>{fmtMinutes(e.expected_minutes)}</TableCell>
                          <TableCell className={e.balance_minutes < 0 ? 'text-red-600' : 'text-green-600'}>
                            {fmtMinutes(e.balance_minutes)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={st.color}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Ver detalhes"
                                onClick={() => openDetail(e)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                title="Solicitar correção"
                                onClick={() => openCorrection(e)}
                              >
                                <PenLine className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailEntry} onOpenChange={() => setDetailEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Detalhes do dia {detailEntry && format(new Date(detailEntry.work_date + 'T12:00:00'), 'dd/MM/yyyy')}
            </DialogTitle>
          </DialogHeader>

          {detailEntry && (
            <div className="space-y-4">
              {/* Day summary */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Trabalhado:</div>
                <div className="font-medium">{fmtMinutes(detailEntry.worked_minutes)}</div>
                <div className="text-muted-foreground">Esperado:</div>
                <div className="font-medium">{fmtMinutes(detailEntry.expected_minutes)}</div>
                <div className="text-muted-foreground">Intervalo:</div>
                <div className="font-medium">{fmtMinutes(detailEntry.break_minutes)}</div>
                <div className="text-muted-foreground">Saldo:</div>
                <div className={`font-medium ${detailEntry.balance_minutes < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {fmtMinutes(detailEntry.balance_minutes)}
                </div>
                <div className="text-muted-foreground">Status:</div>
                <div>
                  <Badge className={statusLabels[detailEntry.status]?.color || ''}>
                    {statusLabels[detailEntry.status]?.label || detailEntry.status}
                  </Badge>
                </div>
                {detailEntry.notes && (
                  <>
                    <div className="text-muted-foreground">Observações:</div>
                    <div className="text-sm">{detailEntry.notes}</div>
                  </>
                )}
              </div>

              {/* Punches list */}
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Batidas registradas:</p>
                {loadingPunches ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : punches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma batida encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {punches.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium">{punchTypeLabels[p.punch_type] || p.punch_type}</span>
                          <span className="text-xs text-muted-foreground ml-2">({p.unidade})</span>
                        </div>
                        <div className="text-sm font-mono">
                          {format(new Date(p.punched_at), 'HH:mm:ss')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Correction Dialog */}
      <Dialog open={!!correctionEntry} onOpenChange={() => setCorrectionEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5" />
              Solicitar Correção — {correctionEntry && format(new Date(correctionEntry.work_date + 'T12:00:00'), 'dd/MM/yyyy')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de batida</Label>
              <Select value={corrPunchType} onValueChange={setCorrPunchType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                  <SelectItem value="intervalo_inicio">Início Intervalo</SelectItem>
                  <SelectItem value="intervalo_fim">Fim Intervalo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Horário correto</Label>
              <Input
                type="time"
                value={corrTime}
                onChange={e => setCorrTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo da correção *</Label>
              <Textarea
                value={corrReason}
                onChange={e => setCorrReason(e.target.value)}
                placeholder="Descreva o motivo da correção..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionEntry(null)}>Cancelar</Button>
            <Button
              onClick={submitCorrection}
              disabled={submittingCorr || !corrTime || !corrReason.trim()}
            >
              {submittingCorr && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
