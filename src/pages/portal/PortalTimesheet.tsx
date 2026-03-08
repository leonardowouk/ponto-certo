import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, Clock } from 'lucide-react';
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
  const monthOptions = getMonthOptions();
  const [month, setMonth] = useState(monthOptions[0].value);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ worked: 0, expected: 0, balance: 0 });

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
    </PortalLayout>
  );
}
