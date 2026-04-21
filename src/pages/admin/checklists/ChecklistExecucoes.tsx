import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Eye, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

type ExecStatus = 'pendente' | 'em_andamento' | 'concluido' | 'reprovado' | 'revisar';
type RespStatus = 'pendente' | 'aprovado' | 'reprovado' | 'revisar';

interface Execucao {
  id: string;
  data: string;
  status: ExecStatus;
  iniciado_em: string | null;
  concluido_em: string | null;
  checklists?: { nome: string };
  employees?: { nome: string };
}

interface Resposta {
  id: string;
  item_id: string;
  foto_url: string | null;
  texto_resposta: string | null;
  status_ia: RespStatus | null;
  motivo_ia: string | null;
  status_final: RespStatus;
  observacao_gestor: string | null;
  checklist_items?: { descricao: string; tipo: string; ordem: number };
}

const statusBadge = (s: ExecStatus | RespStatus) => {
  const map: Record<string, { label: string; variant: any }> = {
    pendente: { label: 'Pendente', variant: 'secondary' },
    em_andamento: { label: 'Em andamento', variant: 'outline' },
    concluido: { label: 'Concluído', variant: 'default' },
    aprovado: { label: 'Aprovado', variant: 'default' },
    reprovado: { label: 'Reprovado', variant: 'destructive' },
    revisar: { label: 'A revisar', variant: 'outline' },
  };
  const c = map[s] || { label: s, variant: 'secondary' };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

export default function ChecklistExecucoes() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Execucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    let q = supabase.from('checklist_execucoes')
      .select('*, checklists(nome), employees(nome)')
      .eq('company_id', selectedCompanyId)
      .order('data', { ascending: false }).order('iniciado_em', { ascending: false });
    if (filterDate) q = q.eq('data', filterDate);
    if (filterStatus !== 'todos') q = q.eq('status', filterStatus as ExecStatus);
    const { data, error } = await q;
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setItems((data || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedCompanyId, filterDate, filterStatus]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setLoadingDetail(true);
    const { data } = await supabase.from('checklist_respostas')
      .select('*, checklist_items(descricao, tipo, ordem)')
      .eq('execucao_id', id);
    const sorted = (data || []).sort((a: any, b: any) => (a.checklist_items?.ordem || 0) - (b.checklist_items?.ordem || 0));
    setRespostas(sorted as any);
    setLoadingDetail(false);
  };

  const override = async (rid: string, status: RespStatus, observacao?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('checklist_respostas').update({
      status_final: status,
      observacao_gestor: observacao || null,
      revisado_por: user?.id,
      revisado_em: new Date().toISOString(),
    }).eq('id', rid);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Atualizado' }); if (detailId) openDetail(detailId); }
  };

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <Card>
          <CardContent className="py-3 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <div className="min-w-[180px]">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="reprovado">Reprovado</SelectItem>
                  <SelectItem value="revisar">A revisar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={() => { setFilterDate(''); setFilterStatus('todos'); }}>Limpar</Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma execução encontrada.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {items.map(e => (
              <Card key={e.id}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{e.checklists?.nome}</span>
                      {statusBadge(e.status)}
                      <span className="text-sm text-muted-foreground">— {e.employees?.nome}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(e.data).toLocaleDateString('pt-BR')}
                      {e.concluido_em && ` · concluído ${new Date(e.concluido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openDetail(e.id)}>
                    <Eye className="w-4 h-4 mr-2" /> Ver
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader><DialogTitle>Detalhe da execução</DialogTitle></DialogHeader>
            {loadingDetail ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : respostas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhuma resposta registrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {respostas.map(r => (
                  <Card key={r.id}>
                    <CardContent className="py-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{(r.checklist_items?.ordem ?? 0) + 1}. {r.checklist_items?.descricao}</span>
                        {statusBadge(r.status_final)}
                        {r.status_ia && <Badge variant="outline" className="text-xs">IA: {r.status_ia}</Badge>}
                      </div>
                      {r.foto_url && (
                        <img src={r.foto_url} alt="resposta" className="max-h-48 rounded border" />
                      )}
                      {r.texto_resposta && <p className="text-sm">{r.texto_resposta}</p>}
                      {r.motivo_ia && <p className="text-xs text-muted-foreground">Parecer IA: {r.motivo_ia}</p>}
                      {r.observacao_gestor && <p className="text-xs"><strong>Obs gestor:</strong> {r.observacao_gestor}</p>}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" onClick={() => override(r.id, 'aprovado')}>
                          <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          const obs = prompt('Motivo da reprovação:') || undefined;
                          override(r.id, 'reprovado', obs);
                        }}>
                          <XCircle className="w-4 h-4 mr-1 text-destructive" /> Reprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => override(r.id, 'revisar')}>
                          <AlertCircle className="w-4 h-4 mr-1" /> A revisar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
