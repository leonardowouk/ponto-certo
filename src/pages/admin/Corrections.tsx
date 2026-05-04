import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, X, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { approveCorrection, rejectCorrection } from '@/lib/punchCorrections';

const punchTypeLabels: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  intervalo_inicio: 'Início Intervalo',
  intervalo_fim: 'Fim Intervalo',
};

interface CorrectionRow {
  id: string;
  employee_id: string;
  work_date: string;
  punch_type: string;
  requested_time: string;
  reason: string;
  status: string;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  employees: { nome: string; company_id: string } | null;
}

export default function CorrectionsPage() {
  const [items, setItems] = useState<CorrectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'all'>('pendente');
  const [actioning, setActioning] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<CorrectionRow | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('punch_corrections')
      .select('*, employees!inner(nome, company_id)')
      .order('created_at', { ascending: false });
    if (selectedCompanyId) q = q.eq('employees.company_id', selectedCompanyId);
    if (tab !== 'all') q = q.eq('status', tab as any);
    const { data, error } = await q;
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    } else {
      setItems((data || []) as any);
    }
    setLoading(false);
  }, [selectedCompanyId, tab, toast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (c: CorrectionRow) => {
    setActioning(c.id);
    try {
      await approveCorrection(c.id);
      toast({ title: 'Solicitação aprovada', description: 'Batida criada e espelho recalculado.' });
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao aprovar', description: e.message, variant: 'destructive' });
    }
    setActioning(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectNotes.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' });
      return;
    }
    setActioning(rejectModal.id);
    try {
      await rejectCorrection(rejectModal.id, rejectNotes.trim());
      toast({ title: 'Solicitação rejeitada' });
      setRejectModal(null);
      setRejectNotes('');
      load();
    } catch (e: any) {
      toast({ title: 'Erro ao rejeitar', description: e.message, variant: 'destructive' });
    }
    setActioning(null);
  };

  const statusBadge = (s: string) => {
    if (s === 'pendente') return <Badge variant="secondary">Pendente</Badge>;
    if (s === 'aprovado') return <Badge>Aprovada</Badge>;
    return <Badge variant="destructive">Rejeitada</Badge>;
  };

  return (
    <AdminLayout currentPage="corrections">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" /> Correções de Ponto
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="aprovado">Aprovadas</TabsTrigger>
              <TabsTrigger value="rejeitado">Rejeitadas</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma solicitação.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Solicitada em</TableHead>
                      <TableHead>Colaborador</TableHead>
                      <TableHead>Data do ponto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(c.created_at), 'dd/MM/yy HH:mm')}
                        </TableCell>
                        <TableCell className="font-medium">{c.employees?.nome}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(c.work_date + 'T12:00:00'), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>{punchTypeLabels[c.punch_type] || c.punch_type}</TableCell>
                        <TableCell className="font-mono">{c.requested_time?.slice(0, 5)}</TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={c.reason}>{c.reason}</div>
                          {c.review_notes && (
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              Revisor: {c.review_notes}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell className="text-right">
                          {c.status === 'pendente' && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm" variant="default"
                                disabled={actioning === c.id}
                                onClick={() => handleApprove(c)}
                              >
                                {actioning === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Aprovar
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => { setRejectModal(c); setRejectNotes(''); }}
                              >
                                <X className="w-3 h-3" /> Rejeitar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!rejectModal} onOpenChange={(v) => !v && setRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da rejeição. O colaborador verá esta nota.
            </p>
            <Textarea
              rows={3}
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Motivo..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!!actioning}>
              {actioning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
