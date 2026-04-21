import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ChecklistDashboard() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ pendente: 0, em_andamento: 0, concluido: 0, reprovado: 0, revisar: 0 });

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase.from('checklist_execucoes')
      .select('status').eq('company_id', selectedCompanyId).eq('data', today);
    const c = { pendente: 0, em_andamento: 0, concluido: 0, reprovado: 0, revisar: 0 } as any;
    (data || []).forEach((r: any) => { c[r.status] = (c[r.status] || 0) + 1; });
    setCounts(c);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedCompanyId]);

  const cards = [
    { key: 'pendente', label: 'Pendentes', icon: Clock, value: counts.pendente },
    { key: 'em_andamento', label: 'Em andamento', icon: Clock, value: counts.em_andamento },
    { key: 'concluido', label: 'Concluídos', icon: CheckCircle2, value: counts.concluido },
    { key: 'reprovado', label: 'Reprovados', icon: XCircle, value: counts.reprovado },
    { key: 'revisar', label: 'A revisar', icon: AlertCircle, value: counts.revisar },
  ];

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <h2 className="text-xl font-semibold">Visão do dia</h2>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {cards.map(c => {
              const Icon = c.icon;
              return (
                <Card key={c.key} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`/admin/checklists/execucoes`)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Icon className="w-4 h-4" /> {c.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent><div className="text-3xl font-bold">{c.value}</div></CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
