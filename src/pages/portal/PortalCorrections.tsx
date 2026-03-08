import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Plus, Loader2, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const punchTypeLabels: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  intervalo_inicio: 'Início Intervalo',
  intervalo_fim: 'Fim Intervalo',
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  aprovado: { label: 'Aprovado', variant: 'default' },
  rejeitado: { label: 'Rejeitado', variant: 'destructive' },
};

export default function PortalCorrections() {
  const { toast } = useToast();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    work_date: '',
    requested_time: '',
    punch_type: '' as string,
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return;
    setEmployeeId(emp.id);

    const { data } = await supabase
      .from('punch_corrections')
      .select('*')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false });

    setCorrections(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!employeeId || !formData.work_date || !formData.requested_time || !formData.punch_type || !formData.reason) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase
      .from('punch_corrections')
      .insert({
        employee_id: employeeId,
        work_date: formData.work_date,
        requested_time: formData.requested_time,
        punch_type: formData.punch_type as any,
        reason: formData.reason,
      });

    if (error) {
      toast({ title: 'Erro ao enviar solicitação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Solicitação enviada com sucesso!' });
      setShowForm(false);
      setFormData({ work_date: '', requested_time: '', punch_type: '', reason: '' });
      loadData();
    }
    setSubmitting(false);
  };

  return (
    <PortalLayout currentPage="corrections">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Correções de Ponto</h1>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Solicitação
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" /> Minhas Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : corrections.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma solicitação de correção.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Horário Solicitado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Obs. Revisor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {corrections.map((c: any) => {
                      const st = statusConfig[c.status] || { label: c.status, variant: 'outline' as const };
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(c.work_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>{punchTypeLabels[c.punch_type] || c.punch_type}</TableCell>
                          <TableCell className="font-mono">{c.requested_time?.slice(0, 5)}</TableCell>
                          <TableCell className="max-w-48 truncate">{c.reason}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={st.variant}>{st.label}</Badge>
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-muted-foreground">
                            {c.review_notes || '-'}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Correção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data do ponto</Label>
              <Input
                type="date"
                value={formData.work_date}
                onChange={e => setFormData(p => ({ ...p, work_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo de batida</Label>
              <Select value={formData.punch_type} onValueChange={v => setFormData(p => ({ ...p, punch_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(punchTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horário correto</Label>
              <Input
                type="time"
                value={formData.requested_time}
                onChange={e => setFormData(p => ({ ...p, requested_time: e.target.value }))}
              />
            </div>
            <div>
              <Label>Motivo / Justificativa</Label>
              <Textarea
                value={formData.reason}
                onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))}
                placeholder="Descreva o motivo da correção..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
