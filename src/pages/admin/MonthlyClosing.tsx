import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { useCompany } from '@/contexts/CompanyContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { EmployeeReviewModal } from '@/components/admin/EmployeeReviewModal';
import { TimesheetPrintView } from '@/components/admin/TimesheetPrintView';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FileCheck, Lock, Eye, Printer, Unlock, Pencil } from 'lucide-react';

interface ClosingSummary {
  employeeId: string;
  employeeName: string;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  breakMinutes: number;
  daysWorked: number;
  daysAbsent: number;
  daysPending: number;
  status: string;
}

const formatMinutes = (m: number) => {
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800' },
  conferido: { label: 'Conferido', className: 'bg-blue-100 text-blue-800' },
  fechado: { label: 'Fechado', className: 'bg-green-100 text-green-800' },
};

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    options.push({ value: format(first, 'yyyy-MM-dd'), label: format(first, 'MMMM/yyyy', { locale: ptBR }) });
  }
  return options;
};

export default function MonthlyClosing() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { toast } = useToast();
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[1]?.value || monthOptions[0]?.value);
  const [summaries, setSummaries] = useState<ClosingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [closingAll, setClosingAll] = useState(false);

  // Review modal
  const [reviewEmployee, setReviewEmployee] = useState<{ id: string; name: string; status: string } | null>(null);

  // Print view
  const [printEmployee, setPrintEmployee] = useState<{ id: string; name: string } | null>(null);
  const [printDays, setPrintDays] = useState<any[]>([]);
  const [printTotals, setPrintTotals] = useState({ worked: 0, expected: 0, balance: 0, breaks: 0 });

  const refMonth = new Date(selectedMonth + 'T12:00:00');

  useEffect(() => {
    if (selectedCompanyId) loadData();
  }, [selectedCompanyId, selectedMonth]);

  const loadData = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    // 1. Get employees for company
    const { data: employees } = await supabase
      .from('employees')
      .select('id, nome')
      .eq('company_id', selectedCompanyId)
      .eq('ativo', true)
      .order('nome');

    if (!employees || employees.length === 0) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    const empIds = employees.map(e => e.id);
    const startDate = selectedMonth;
    const endMonth = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0);
    const endDate = format(endMonth, 'yyyy-MM-dd');

    // 2. Get timesheets for the month
    const { data: timesheets } = await supabase
      .from('timesheets_daily')
      .select('*')
      .in('employee_id', empIds)
      .gte('work_date', startDate)
      .lte('work_date', endDate);

    // 3. Get existing closings
    const { data: closings } = await supabase
      .from('monthly_closings' as any)
      .select('*')
      .eq('company_id', selectedCompanyId)
      .eq('ref_month', startDate);

    const closingMap = new Map((closings || []).map((c: any) => [c.employee_id, c]));
    const tsMap = new Map<string, any[]>();
    (timesheets || []).forEach(t => {
      if (!tsMap.has(t.employee_id)) tsMap.set(t.employee_id, []);
      tsMap.get(t.employee_id)!.push(t);
    });

    // 4. Build summaries and upsert
    const newSummaries: ClosingSummary[] = [];
    const upserts: any[] = [];

    for (const emp of employees) {
      const days = tsMap.get(emp.id) || [];
      const worked = days.reduce((s, d) => s + (d.worked_minutes || 0), 0);
      const expected = days.reduce((s, d) => s + (d.expected_minutes || 0), 0);
      const balance = days.reduce((s, d) => s + (d.balance_minutes || 0), 0);
      const breaks = days.reduce((s, d) => s + (d.break_minutes || 0), 0);
      const daysWorked = days.filter(d => (d.worked_minutes || 0) > 0).length;
      const daysAbsent = days.filter(d => d.status === 'falta').length;
      const daysPending = days.filter(d => d.status === 'pendente' || d.status === 'revisao').length;

      const existing = closingMap.get(emp.id) as any;
      const status = existing?.status || 'pendente';

      // Only upsert if not already fechado
      if (status !== 'fechado') {
        upserts.push({
          company_id: selectedCompanyId,
          employee_id: emp.id,
          ref_month: startDate,
          total_worked_minutes: worked,
          total_expected_minutes: expected,
          total_balance_minutes: balance,
          total_break_minutes: breaks,
          days_worked: daysWorked,
          days_absent: daysAbsent,
          days_pending: daysPending,
          status: status,
        });
      }

      newSummaries.push({
        employeeId: emp.id,
        employeeName: emp.nome,
        workedMinutes: worked,
        expectedMinutes: expected,
        balanceMinutes: balance,
        breakMinutes: breaks,
        daysWorked,
        daysAbsent,
        daysPending,
        status,
      });
    }

    // Upsert closings
    if (upserts.length > 0) {
      await supabase.from('monthly_closings' as any).upsert(upserts, { onConflict: 'employee_id,ref_month' });
    }

    setSummaries(newSummaries);
    setLoading(false);
  };

  const allReviewed = summaries.length > 0 && summaries.every(s => s.status === 'conferido' || s.status === 'fechado');
  const allClosed = summaries.length > 0 && summaries.every(s => s.status === 'fechado');

  const handleCloseMonth = async () => {
    setClosingAll(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const { error } = await supabase
      .from('monthly_closings' as any)
      .update({
        status: 'fechado',
        closed_by: userId,
        closed_at: new Date().toISOString(),
      })
      .eq('company_id', selectedCompanyId)
      .eq('ref_month', selectedMonth)
      .eq('status', 'conferido');

    if (error) {
      toast({ title: 'Erro ao fechar mês', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mês fechado!', description: 'Todos os colaboradores foram fechados com sucesso.' });
      
      // Send WhatsApp notifications to all employees
      if (selectedCompanyId) {
        const monthLabel = format(refMonth, 'MMMM/yyyy', { locale: ptBR });
        for (const s of summaries.filter(s => s.status === 'conferido')) {
          sendWhatsAppNotification({
            companyId: selectedCompanyId,
            action: 'notify_closing',
            employeeId: s.employeeId,
            variables: { ref_month_label: monthLabel },
          }).catch(console.error);
        }
      }
      
      loadData();
    }
    setClosingAll(false);
  };

  const handleReopenMonth = async () => {
    const { error } = await supabase
      .from('monthly_closings' as any)
      .update({
        status: 'conferido',
        closed_by: null,
        closed_at: null,
      })
      .eq('company_id', selectedCompanyId)
      .eq('ref_month', selectedMonth)
      .eq('status', 'fechado');

    if (error) {
      toast({ title: 'Erro ao reabrir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Mês reaberto!', description: 'Os fechamentos voltaram para status conferido.' });
      loadData();
    }
  };

  const handleReopenEmployee = async (employeeId: string) => {
    const { error } = await supabase
      .from('monthly_closings' as any)
      .update({ status: 'pendente', reviewed_by: null, reviewed_at: null })
      .eq('employee_id', employeeId)
      .eq('ref_month', selectedMonth)
      .eq('company_id', selectedCompanyId);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Reaberto para revisão' });
      loadData();
    }
  };

  const handleOpenPrint = async (empId: string, empName: string) => {
    const startDate = selectedMonth;
    const endDate = format(new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0), 'yyyy-MM-dd');

    // Load timesheets
    const { data } = await supabase
      .from('timesheets_daily')
      .select('*')
      .eq('employee_id', empId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    // Load punches
    const { data: punchData } = await supabase
      .from('time_punches')
      .select('id, punch_type, punched_at, status')
      .eq('employee_id', empId)
      .gte('punched_at', startDate + 'T00:00:00')
      .lte('punched_at', endDate + 'T23:59:59')
      .order('punched_at', { ascending: true });

    const punchMap = new Map<string, any[]>();
    (punchData || []).forEach(p => {
      const date = format(new Date(p.punched_at), 'yyyy-MM-dd');
      if (!punchMap.has(date)) punchMap.set(date, []);
      punchMap.get(date)!.push(p);
    });

    const days = (data || []).map(d => ({ ...d, punches: punchMap.get(d.work_date) || [] }));
    const totals = days.reduce(
      (acc, d) => ({
        worked: acc.worked + (d.worked_minutes || 0),
        expected: acc.expected + (d.expected_minutes || 0),
        balance: acc.balance + (d.balance_minutes || 0),
        breaks: acc.breaks + (d.break_minutes || 0),
      }),
      { worked: 0, expected: 0, balance: 0, breaks: 0 }
    );

    setPrintDays(days);
    setPrintTotals(totals);
    setPrintEmployee({ id: empId, name: empName });
  };

  return (
    <AdminLayout currentPage="closing">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5" />
              Fechamento Mensal
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label>Mês:</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!allClosed && (
                <Button onClick={handleCloseMonth} disabled={!allReviewed || closingAll}>
                  {closingAll ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
                  Fechar Mês
                </Button>
              )}
              {allClosed && (
                <Button variant="outline" onClick={handleReopenMonth}>
                  <Unlock className="w-4 h-4 mr-1" />
                  Reabrir Mês
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : summaries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum colaborador encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-center">Dias Trab.</TableHead>
                    <TableHead className="text-center">Horas Trab.</TableHead>
                    <TableHead className="text-center">Horas Esper.</TableHead>
                    <TableHead className="text-center">Saldo</TableHead>
                    <TableHead className="text-center">Pend./Revisão</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map(s => {
                    const cfg = statusConfig[s.status] || statusConfig.pendente;
                    return (
                      <TableRow key={s.employeeId}>
                        <TableCell className="font-medium">{s.employeeName}</TableCell>
                        <TableCell className="text-center">{s.daysWorked}</TableCell>
                        <TableCell className="text-center">{formatMinutes(s.workedMinutes)}</TableCell>
                        <TableCell className="text-center">{formatMinutes(s.expectedMinutes)}</TableCell>
                        <TableCell className={`text-center ${s.balanceMinutes < 0 ? 'text-destructive' : ''}`}>
                          {formatMinutes(s.balanceMinutes)}
                        </TableCell>
                        <TableCell className="text-center">
                          {s.daysPending > 0 ? (
                            <Badge className="bg-orange-100 text-orange-800">{s.daysPending}</Badge>
                          ) : '0'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={cfg.className}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1 flex-wrap">
                            <Button
                              size="sm" variant="outline"
                              onClick={() => setReviewEmployee({ id: s.employeeId, name: s.employeeName, status: s.status })}
                            >
                              {s.status === 'fechado' ? <Eye className="w-3 h-3 mr-1" /> : <Pencil className="w-3 h-3 mr-1" />}
                              {s.status === 'fechado' ? 'Ver' : 'Conferir'}
                            </Button>
                            {(s.status === 'fechado' || s.status === 'conferido') && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => handleOpenPrint(s.employeeId, s.employeeName)}
                              >
                                <Printer className="w-3 h-3 mr-1" />Espelho
                              </Button>
                            )}
                            {s.status === 'conferido' && (
                              <Button
                                size="sm" variant="ghost"
                                onClick={() => handleReopenEmployee(s.employeeId)}
                              >
                                <Unlock className="w-3 h-3 mr-1" />Reabrir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Modal */}
      {reviewEmployee && selectedCompanyId && (
        <EmployeeReviewModal
          open={!!reviewEmployee}
          onClose={() => setReviewEmployee(null)}
          employeeId={reviewEmployee.id}
          employeeName={reviewEmployee.name}
          refMonth={refMonth}
          companyId={selectedCompanyId}
          currentStatus={reviewEmployee.status}
          onStatusChanged={loadData}
        />
      )}

      {/* Print View */}
      {printEmployee && selectedCompany && (
        <TimesheetPrintView
          employeeName={printEmployee.name}
          companyName={selectedCompany.nome}
          refMonth={refMonth}
          days={printDays}
          totals={printTotals}
          onClose={() => setPrintEmployee(null)}
        />
      )}
    </AdminLayout>
  );
}
