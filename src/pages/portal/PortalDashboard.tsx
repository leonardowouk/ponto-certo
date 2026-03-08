import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PortalDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ pendingDocs: 0, totalDocs: 0, todayPunches: 0, monthBalance: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return;

    // Pending signatures
    const { count: pendingDocs } = await supabase
      .from('document_signatures')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', emp.id)
      .eq('status', 'pendente');

    // Total documents
    const { count: totalDocs } = await supabase
      .from('employee_documents')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', emp.id);

    // Today's punches
    const today = new Date().toISOString().split('T')[0];
    const { count: todayPunches } = await supabase
      .from('time_punches')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', emp.id)
      .gte('punched_at', `${today}T00:00:00`)
      .lte('punched_at', `${today}T23:59:59`);

    // Month balance
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const { data: timesheets } = await supabase
      .from('timesheets_daily')
      .select('balance_minutes')
      .eq('employee_id', emp.id)
      .gte('work_date', firstOfMonth.toISOString().split('T')[0]);

    const monthBalance = (timesheets || []).reduce((sum, t) => sum + (t.balance_minutes || 0), 0);

    setStats({
      pendingDocs: pendingDocs || 0,
      totalDocs: totalDocs || 0,
      todayPunches: todayPunches || 0,
      monthBalance,
    });
    setLoading(false);
  };

  const fmtMinutes = (min: number) => {
    const sign = min < 0 ? '-' : '+';
    const abs = Math.abs(min);
    return `${sign}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
  };

  return (
    <PortalLayout currentPage="dashboard">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Meu Painel</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/portal/documents')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Docs pendentes</p>
                  <p className="text-3xl font-bold">{stats.pendingDocs}</p>
                </div>
                {stats.pendingDocs > 0 ? (
                  <AlertCircle className="w-8 h-8 text-yellow-500" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total documentos</p>
                  <p className="text-3xl font-bold">{stats.totalDocs}</p>
                </div>
                <FileText className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Batidas hoje</p>
                  <p className="text-3xl font-bold">{stats.todayPunches}</p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo do mês</p>
                  <p className={`text-3xl font-bold ${stats.monthBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmtMinutes(stats.monthBalance)}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
