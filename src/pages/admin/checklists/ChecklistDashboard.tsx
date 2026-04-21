import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeft, ListChecks, TrendingUp,
} from 'lucide-react';

interface DashboardData {
  hoje: { pendente: number; em_andamento: number; concluido: number; reprovado: number; revisar: number };
  totalRevisar: number;
  semana: { concluidos: number; reprovados: number };
  topReprovados: { descricao: string; count: number }[];
}

const empty: DashboardData = {
  hoje: { pendente: 0, em_andamento: 0, concluido: 0, reprovado: 0, revisar: 0 },
  totalRevisar: 0,
  semana: { concluidos: 0, reprovados: 0 },
  topReprovados: [],
};

export default function ChecklistDashboard() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>(empty);

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Execuções de hoje (status agregado)
    const { data: hojeRows } = await supabase
      .from('checklist_execucoes')
      .select('status')
      .eq('company_id', selectedCompanyId)
      .eq('data', today);

    const hoje = { pendente: 0, em_andamento: 0, concluido: 0, reprovado: 0, revisar: 0 } as any;
    (hojeRows || []).forEach((r: any) => {
      hoje[r.status] = (hoje[r.status] || 0) + 1;
    });

    // Execuções da semana para métricas e ids para respostas
    const { data: semanaRows } = await supabase
      .from('checklist_execucoes')
      .select('id, status')
      .eq('company_id', selectedCompanyId)
      .gte('data', weekAgo);

    const semana = { concluidos: 0, reprovados: 0 };
    const execIds: string[] = [];
    (semanaRows || []).forEach((r: any) => {
      execIds.push(r.id);
      if (r.status === 'concluido') semana.concluidos++;
      if (r.status === 'reprovado') semana.reprovados++;
    });

    // Total de respostas em revisão (toda a empresa)
    let totalRevisar = 0;
    let topReprovados: { descricao: string; count: number }[] = [];
    if (execIds.length > 0) {
      const { count } = await supabase
        .from('checklist_respostas')
        .select('*', { count: 'exact', head: true })
        .in('execucao_id', execIds)
        .eq('status_final', 'revisar');
      totalRevisar = count || 0;

      // Top itens reprovados na semana
      const { data: reprovadas } = await supabase
        .from('checklist_respostas')
        .select('item_id, checklist_items(descricao)')
        .in('execucao_id', execIds)
        .eq('status_final', 'reprovado');

      const counts: Record<string, { descricao: string; count: number }> = {};
      (reprovadas || []).forEach((r: any) => {
        const desc = r.checklist_items?.descricao || 'Item';
        const key = r.item_id;
        if (!counts[key]) counts[key] = { descricao: desc, count: 0 };
        counts[key].count++;
      });
      topReprovados = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
    }

    setData({ hoje, totalRevisar, semana, topReprovados });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedCompanyId]);

  const totalHoje =
    data.hoje.pendente + data.hoje.em_andamento + data.hoje.concluido + data.hoje.reprovado + data.hoje.revisar;
  const taxaConclusao = totalHoje > 0 ? Math.round((data.hoje.concluido / totalHoje) * 100) : 0;

  const cards = [
    { key: 'pendente', label: 'Pendentes', icon: Clock, value: data.hoje.pendente, color: 'text-muted-foreground' },
    { key: 'em_andamento', label: 'Em andamento', icon: Clock, value: data.hoje.em_andamento, color: 'text-foreground' },
    { key: 'concluido', label: 'Concluídos', icon: CheckCircle2, value: data.hoje.concluido, color: 'text-primary' },
    { key: 'reprovado', label: 'Reprovados', icon: XCircle, value: data.hoje.reprovado, color: 'text-destructive' },
    { key: 'revisar', label: 'A revisar', icon: AlertCircle, value: data.hoje.revisar, color: 'text-foreground' },
  ];

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* CTA — fila de revisão */}
            <Card className="border-primary/50 bg-primary/5">
              <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-semibold">Fila de revisão</p>
                    <p className="text-sm text-muted-foreground">
                      {data.totalRevisar === 0
                        ? 'Nenhum item aguardando revisão.'
                        : `${data.totalRevisar} ${data.totalRevisar === 1 ? 'item aguarda' : 'itens aguardam'} sua análise.`}
                    </p>
                  </div>
                </div>
                <Button onClick={() => navigate('/admin/checklists/revisao')} disabled={data.totalRevisar === 0}>
                  Revisar agora
                  {data.totalRevisar > 0 && (
                    <Badge variant="secondary" className="ml-2">{data.totalRevisar}</Badge>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Visão do dia */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-semibold">Visão do dia</h2>
                <Badge variant="outline">Taxa de conclusão: {taxaConclusao}%</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {cards.map((c) => {
                  const Icon = c.icon;
                  return (
                    <Card
                      key={c.key}
                      className="cursor-pointer hover:bg-accent/40 transition"
                      onClick={() => navigate(`/admin/checklists/execucoes`)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${c.color}`} /> {c.label}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{c.value}</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Semana + Top reprovados */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Últimos 7 dias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Concluídos</span>
                    <span className="font-semibold">{data.semana.concluidos}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reprovados</span>
                    <span className="font-semibold text-destructive">{data.semana.reprovados}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ListChecks className="w-4 h-4" /> Itens mais reprovados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.topReprovados.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem reprovações na semana.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.topReprovados.map((t, i) => (
                        <li key={i} className="flex justify-between text-sm">
                          <span className="truncate pr-2">{t.descricao}</span>
                          <Badge variant="destructive">{t.count}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
