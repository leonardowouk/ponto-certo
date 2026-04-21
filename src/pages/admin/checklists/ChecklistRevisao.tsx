import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle2, XCircle, AlertCircle, ImageOff } from 'lucide-react';

type RespStatus = 'pendente' | 'aprovado' | 'reprovado' | 'revisar';

interface RevisaoItem {
  id: string;
  execucao_id: string;
  foto_url: string | null;
  texto_resposta: string | null;
  status_ia: RespStatus | null;
  motivo_ia: string | null;
  confianca_ia: number | null;
  status_final: RespStatus;
  observacao_gestor: string | null;
  created_at: string;
  checklist_items?: { descricao: string; tipo: string; ordem: number; criterios_ia: string | null };
  checklist_execucoes?: {
    data: string;
    checklists?: { nome: string };
    employees?: { nome: string };
  };
}

export default function ChecklistRevisao() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<RevisaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [obs, setObs] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    // Pega execuções da empresa, depois respostas em revisão dessas execuções
    const { data: execs } = await supabase
      .from('checklist_execucoes')
      .select('id')
      .eq('company_id', selectedCompanyId);
    const execIds = (execs || []).map((e: any) => e.id);
    if (execIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('checklist_respostas')
      .select(`
        *,
        checklist_items(descricao, tipo, ordem, criterios_ia),
        checklist_execucoes(data, checklists(nome), employees(nome))
      `)
      .in('execucao_id', execIds)
      .eq('status_final', 'revisar')
      .order('created_at', { ascending: true });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setItems((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedCompanyId]);

  const decide = async (id: string, status: RespStatus) => {
    setActing(id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('checklist_respostas')
      .update({
        status_final: status,
        observacao_gestor: obs[id] || null,
        revisado_por: user?.id,
        revisado_em: new Date().toISOString(),
      })
      .eq('id', id);
    setActing(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: status === 'aprovado' ? 'Aprovado' : 'Reprovado' });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-semibold">Fila de revisão</h2>
            <p className="text-sm text-muted-foreground">
              Itens marcados como "revisar" pela IA aguardando decisão do gestor.
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            {items.length} {items.length === 1 ? 'item pendente' : 'itens pendentes'}
          </Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-primary mb-2" />
              <p className="font-medium">Tudo em dia!</p>
              <p className="text-sm text-muted-foreground">Nenhum item aguardando revisão.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((r) => {
              const ordem = (r.checklist_items?.ordem ?? 0) + 1;
              const exec = r.checklist_execucoes;
              return (
                <Card key={r.id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {exec?.checklists?.nome} · {exec?.employees?.nome}
                        </p>
                        <p className="font-medium leading-tight">
                          {ordem}. {r.checklist_items?.descricao}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {exec?.data && new Date(exec.data).toLocaleDateString('pt-BR')} ·{' '}
                          {new Date(r.created_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {r.status_ia && (
                        <Badge
                          variant={
                            r.status_ia === 'aprovado'
                              ? 'default'
                              : r.status_ia === 'reprovado'
                              ? 'destructive'
                              : 'outline'
                          }
                          className="text-xs"
                        >
                          IA: {r.status_ia}
                          {r.confianca_ia != null && ` (${Math.round(Number(r.confianca_ia) * 100)}%)`}
                        </Badge>
                      )}
                    </div>

                    {r.foto_url ? (
                      <a href={r.foto_url} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={r.foto_url}
                          alt="resposta"
                          className="w-full max-h-72 object-contain rounded border bg-muted"
                        />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded p-3">
                        <ImageOff className="w-4 h-4" /> Sem foto
                      </div>
                    )}

                    {r.texto_resposta && (
                      <p className="text-sm border-l-2 border-muted pl-2">{r.texto_resposta}</p>
                    )}

                    {r.checklist_items?.criterios_ia && (
                      <p className="text-xs text-muted-foreground">
                        <strong>Critérios:</strong> {r.checklist_items.criterios_ia}
                      </p>
                    )}

                    {r.motivo_ia && (
                      <div className="text-xs bg-muted/50 rounded p-2">
                        <strong>Parecer da IA:</strong> {r.motivo_ia}
                      </div>
                    )}

                    <Textarea
                      placeholder="Observação (opcional)"
                      value={obs[r.id] || ''}
                      onChange={(e) => setObs((p) => ({ ...p, [r.id]: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => decide(r.id, 'aprovado')}
                        disabled={acting === r.id}
                      >
                        {acting === r.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => decide(r.id, 'reprovado')}
                        disabled={acting === r.id}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reprovar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
