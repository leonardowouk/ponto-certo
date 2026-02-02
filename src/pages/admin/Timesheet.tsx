import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Calendar, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { formatMinutesToHours, getPunchTypeLabel } from '@/lib/hash';
import { PunchDetailsModal } from '@/components/admin/PunchDetailsModal';

interface Employee {
  id: string;
  nome: string;
}

interface Punch {
  id: string;
  punch_type: string;
  punched_at: string;
  status: string;
}

interface TimesheetEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  work_date: string;
  first_punch_at: string | null;
  last_punch_at: string | null;
  worked_minutes: number;
  break_minutes: number;
  expected_minutes: number;
  balance_minutes: number;
  status: string;
  punches: Punch[];
}

export default function TimesheetPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    employeeId: string;
    employeeName: string;
    workDate: string;
  }>({ open: false, employeeId: '', employeeName: '', workDate: '' });
  const { toast } = useToast();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    loadTimesheets();
  }, [selectedEmployee, selectedMonth]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadTimesheets = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      let query = supabase
        .from('timesheets_daily')
        .select(`
          id,
          employee_id,
          work_date,
          first_punch_at,
          last_punch_at,
          worked_minutes,
          break_minutes,
          expected_minutes,
          balance_minutes,
          status,
          employees!inner(nome)
        `)
        .gte('work_date', startDate.toISOString().split('T')[0])
        .lte('work_date', endDate.toISOString().split('T')[0])
        .order('work_date', { ascending: false });

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar batidas para cada timesheet
      const enrichedData = await Promise.all(
        (data || []).map(async (ts: { id: string; employee_id: string; work_date: string; first_punch_at: string | null; last_punch_at: string | null; worked_minutes: number; break_minutes: number; expected_minutes: number; balance_minutes: number; status: string; employees: { nome: string } }) => {
          const startOfDay = new Date(ts.work_date);
          const endOfDay = new Date(ts.work_date);
          endOfDay.setDate(endOfDay.getDate() + 1);

          const { data: punches } = await supabase
            .from('time_punches')
            .select('id, punch_type, punched_at, status')
            .eq('employee_id', ts.employee_id)
            .gte('punched_at', startOfDay.toISOString())
            .lt('punched_at', endOfDay.toISOString())
            .order('punched_at', { ascending: true });

          return {
            ...ts,
            employee_name: ts.employees.nome,
            punches: punches || [],
          };
        })
      );

      setTimesheets(enrichedData);
    } catch (error) {
      console.error('Error loading timesheets:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar espelho', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ok: 'status-ok',
      pendente: 'status-pendente',
      revisao: 'status-revisao',
      falta: 'status-falta',
      ajustado: 'status-revisao',
    };
    return <Badge className={styles[status] || ''}>{status}</Badge>;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const navigateMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const exportCSV = () => {
    const headers = ['Data', 'Colaborador', 'Primeira Batida', 'Última Batida', 'Trabalhado', 'Intervalo', 'Esperado', 'Saldo', 'Status'];
    const rows = timesheets.map(ts => [
      new Date(ts.work_date).toLocaleDateString('pt-BR'),
      ts.employee_name,
      formatTime(ts.first_punch_at),
      formatTime(ts.last_punch_at),
      formatMinutesToHours(ts.worked_minutes),
      formatMinutesToHours(ts.break_minutes),
      formatMinutesToHours(ts.expected_minutes),
      formatMinutesToHours(ts.balance_minutes),
      ts.status,
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `espelho-ponto-${selectedMonth}.csv`;
    link.click();
  };

  return (
    <AdminLayout currentPage="timesheet">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-md min-w-40 justify-center">
                <Calendar className="w-4 h-4" />
                <span className="font-medium capitalize">{monthLabel()}</span>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button onClick={exportCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Espelho de Ponto ({timesheets.length} registros)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Batidas</TableHead>
                      <TableHead>Trabalhado</TableHead>
                      <TableHead>Esperado</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum registro encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      timesheets.map((ts) => (
                        <TableRow key={ts.id}>
                          <TableCell className="font-medium">
                            {new Date(ts.work_date).toLocaleDateString('pt-BR', {
                              weekday: 'short',
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>{ts.employee_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {ts.punches.map((punch) => (
                                <span
                                  key={punch.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted"
                                  title={getPunchTypeLabel(punch.punch_type)}
                                >
                                  {new Date(punch.punched_at).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">
                            {Math.floor(ts.worked_minutes / 60)}h{ts.worked_minutes % 60}m
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {Math.floor(ts.expected_minutes / 60)}h{ts.expected_minutes % 60}m
                          </TableCell>
                          <TableCell>
                            <span className={`font-mono ${
                              ts.balance_minutes >= 0 ? 'text-success' : 'text-destructive'
                            }`}>
                              {formatMinutesToHours(ts.balance_minutes)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(ts.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetailsModal({
                                open: true,
                                employeeId: ts.employee_id,
                                employeeName: ts.employee_name,
                                workDate: ts.work_date,
                              })}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de detalhes */}
        <PunchDetailsModal
          open={detailsModal.open}
          onOpenChange={(open) => setDetailsModal(prev => ({ ...prev, open }))}
          employeeId={detailsModal.employeeId}
          employeeName={detailsModal.employeeName}
          workDate={detailsModal.workDate}
        />
      </div>
    </AdminLayout>
  );
}
