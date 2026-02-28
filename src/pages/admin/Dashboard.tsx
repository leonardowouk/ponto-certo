import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { formatMinutesToHours, getPunchTypeLabel } from '@/lib/hash';

interface DashboardStats {
  totalEmployees: number;
  todayPunches: number;
  pendingReviews: number;
  absences: number;
}

interface RecentPunch {
  id: string;
  employee_name: string;
  punch_type: string;
  punched_at: string;
  status: string;
}

interface TimesheetSummary {
  id: string;
  employee_name: string;
  status: string;
  balance_minutes: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    todayPunches: 0,
    pendingReviews: 0,
    absences: 0,
  });
  const [recentPunches, setRecentPunches] = useState<RecentPunch[]>([]);
  const [todaySummary, setTodaySummary] = useState<TimesheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { selectedCompanyId } = useCompany();

  useEffect(() => {
    loadDashboardData();
  }, [selectedCompanyId]);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Total de colaboradores ativos
      let empQuery = supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      if (selectedCompanyId) empQuery = empQuery.eq('company_id', selectedCompanyId);
      const { count: employeeCount } = await empQuery;

      // Batidas de hoje
      let punchQuery = supabase
        .from('time_punches')
        .select('*, employees!inner(company_id)', { count: 'exact', head: true })
        .gte('punched_at', today.toISOString())
        .lt('punched_at', tomorrow.toISOString());
      if (selectedCompanyId) punchQuery = punchQuery.eq('employees.company_id', selectedCompanyId);
      const { count: punchCount } = await punchQuery;

      // Timesheets pendentes
      let pendingQuery = supabase
        .from('timesheets_daily')
        .select('*, employees!inner(company_id)', { count: 'exact', head: true })
        .eq('work_date', today.toISOString().split('T')[0])
        .in('status', ['pendente', 'revisao']);
      if (selectedCompanyId) pendingQuery = pendingQuery.eq('employees.company_id', selectedCompanyId);
      const { count: pendingCount } = await pendingQuery;

      setStats({
        totalEmployees: employeeCount || 0,
        todayPunches: punchCount || 0,
        pendingReviews: pendingCount || 0,
        absences: 0,
      });

      // Últimas batidas
      let punchesQuery = supabase
        .from('time_punches')
        .select(`
          id,
          punch_type,
          punched_at,
          status,
          employees!inner(nome, company_id)
        `)
        .order('punched_at', { ascending: false })
        .limit(10);
      if (selectedCompanyId) punchesQuery = punchesQuery.eq('employees.company_id', selectedCompanyId);
      const { data: punches } = await punchesQuery;

      if (punches) {
        setRecentPunches(punches.map((p: { id: string; punch_type: string; punched_at: string; status: string; employees: { nome: string } }) => ({
          id: p.id,
          employee_name: p.employees.nome,
          punch_type: p.punch_type,
          punched_at: p.punched_at,
          status: p.status,
        })));
      }

      // Resumo de hoje
      let tsQuery = supabase
        .from('timesheets_daily')
        .select(`
          id,
          status,
          balance_minutes,
          employees!inner(nome, company_id)
        `)
        .eq('work_date', today.toISOString().split('T')[0])
        .order('status', { ascending: true })
        .limit(20);
      if (selectedCompanyId) tsQuery = tsQuery.eq('employees.company_id', selectedCompanyId);
      const { data: timesheets } = await tsQuery;

      if (timesheets) {
        setTodaySummary(timesheets.map((t: { id: string; status: string; balance_minutes: number; employees: { nome: string } }) => ({
          id: t.id,
          employee_name: t.employees.nome,
          status: t.status,
          balance_minutes: t.balance_minutes,
        })));
      }

    } catch (error) {
      console.error('Error loading dashboard:', error);
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

  if (loading) {
    return (
      <AdminLayout currentPage="dashboard">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="dashboard">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">Ativos no sistema</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Batidas Hoje</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayPunches}</div>
              <p className="text-xs text-muted-foreground">Registradas hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingReviews}</div>
              <p className="text-xs text-muted-foreground">Aguardando revisão</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todaySummary.filter(t => t.status === 'ok').length}
              </div>
              <p className="text-xs text-muted-foreground">Jornada completa</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Punches */}
          <Card>
            <CardHeader>
              <CardTitle>Últimas Batidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentPunches.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma batida registrada
                  </p>
                ) : (
                  recentPunches.map((punch) => (
                    <div 
                      key={punch.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{punch.employee_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {getPunchTypeLabel(punch.punch_type)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">
                          {new Date(punch.punched_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(punch.punched_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Today's Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todaySummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum registro para hoje
                  </p>
                ) : (
                  todaySummary.map((ts) => (
                    <div 
                      key={ts.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium">{ts.employee_name}</p>
                          {getStatusBadge(ts.status)}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono text-sm ${
                          ts.balance_minutes >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {formatMinutesToHours(ts.balance_minutes)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
