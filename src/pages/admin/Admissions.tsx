import { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { logAudit } from '@/lib/audit';
import {
  Plus, Loader2, FileText, CheckCircle2, Upload, Trash2, UserPlus, Download, ExternalLink,
} from 'lucide-react';

interface Process {
  id: string;
  employee_id: string;
  status: string;
  data_prevista_inicio: string | null;
  observacoes: string | null;
  created_at: string;
  employees?: { nome: string; cargo: string | null } | null;
}

interface AdmissionDoc {
  id: string;
  process_id: string;
  titulo: string;
  obrigatorio: boolean;
  requer_assinatura: boolean;
  status: string;
  file_url: string | null;
  document_id: string | null;
  created_at: string;
  arquivo_assinado_url?: string | null;
  metodo?: string | null;
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v.length <= 10 ? `${v}T12:00:00` : v).toLocaleDateString('pt-BR') : '—';

export default function AdmissionsPage() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();

  const [processes, setProcesses] = useState<Process[]>([]);
  const [docsByProcess, setDocsByProcess] = useState<Record<string, AdmissionDoc[]>>({});
  const [employees, setEmployees] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [newOpen, setNewOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [activeProcess, setActiveProcess] = useState<Process | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docRequired, setDocRequired] = useState(true);
  const [docNeedsSignature, setDocNeedsSignature] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    const [procRes, empRes] = await Promise.all([
      supabase
        .from('admission_processes')
        .select('id, employee_id, status, data_prevista_inicio, observacoes, created_at, employees(nome, cargo)')
        .eq('company_id', selectedCompanyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('employees')
        .select('id, nome')
        .eq('company_id', selectedCompanyId)
        .eq('ativo', true)
        .order('nome'),
    ]);

    const procs = (procRes.data || []).map(p => ({
      ...p,
      employees: p.employees as { nome: string; cargo: string | null } | null,
    }));
    setProcesses(procs);
    setEmployees(empRes.data || []);

    if (procs.length > 0) {
      const { data: docs } = await supabase
        .from('admission_documents')
        .select('id, process_id, titulo, obrigatorio, requer_assinatura, status, file_url, document_id, created_at')
        .in('process_id', procs.map(p => p.id))
        .order('created_at');

      // Sincroniza status com as assinaturas existentes
      const docIds = (docs || []).map(d => d.document_id).filter(Boolean) as string[];
      let signed = new Set<string>();
      if (docIds.length > 0) {
        const { data: sigs } = await supabase
          .from('document_signatures')
          .select('document_id, status')
          .in('document_id', docIds);
        signed = new Set((sigs || []).filter(s => s.status === 'assinado').map(s => s.document_id));
      }

      const grouped: Record<string, AdmissionDoc[]> = {};
      for (const d of docs || []) {
        const status = d.document_id && signed.has(d.document_id) ? 'assinado' : d.status;
        (grouped[d.process_id] ||= []).push({ ...d, status });
      }
      setDocsByProcess(grouped);
    } else {
      setDocsByProcess({});
    }

    setLoading(false);
  }, [selectedCompanyId]);

  useEffect(() => { load(); }, [load]);

  const openProcessIds = new Set(processes.filter(p => p.status !== 'concluida').map(p => p.employee_id));
  const availableEmployees = employees.filter(e => !openProcessIds.has(e.id));

  const createProcess = async () => {
    if (!newEmployeeId || !selectedCompanyId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('admission_processes')
      .insert({
        company_id: selectedCompanyId,
        employee_id: newEmployeeId,
        data_prevista_inicio: newDate || null,
        observacoes: newNotes || null,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single();

    setSaving(false);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível abrir a admissão.', variant: 'destructive' });
      return;
    }

    await supabase.from('employees').update({ admission_status: 'em_admissao' }).eq('id', newEmployeeId);
    await logAudit({
      companyId: selectedCompanyId,
      action: 'Admissão iniciada',
      entityType: 'admission_process',
      entityId: data.id,
      employeeId: newEmployeeId,
    });

    toast({ title: 'Admissão iniciada' });
    setNewOpen(false);
    setNewEmployeeId('');
    setNewDate('');
    setNewNotes('');
    load();
  };

  const uploadDoc = async () => {
    if (!activeProcess || !docFile || !docTitle.trim() || !selectedCompanyId) {
      toast({ title: 'Informe o título e escolha o arquivo', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = docFile.name.split('.').pop() || 'pdf';
      const storagePath = `${selectedCompanyId}/${activeProcess.employee_id}/admissao_${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('documentos')
        .upload(storagePath, docFile, { upsert: true });
      if (upErr) throw upErr;

      const { data: doc, error: docErr } = await supabase
        .from('employee_documents')
        .insert({
          company_id: selectedCompanyId,
          employee_id: activeProcess.employee_id,
          document_type: 'contrato',
          title: docTitle.trim(),
          file_url: storagePath,
          requires_signature: docNeedsSignature,
          created_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (docErr) throw docErr;

      if (docNeedsSignature) {
        await supabase.from('document_signatures').insert({
          document_id: doc.id,
          employee_id: activeProcess.employee_id,
          status: 'pendente',
        });
      }

      const { error: admErr } = await supabase.from('admission_documents').insert({
        process_id: activeProcess.id,
        company_id: selectedCompanyId,
        employee_id: activeProcess.employee_id,
        titulo: docTitle.trim(),
        obrigatorio: docRequired,
        requer_assinatura: docNeedsSignature,
        file_url: storagePath,
        document_id: doc.id,
        status: docNeedsSignature ? 'enviado' : 'assinado',
        enviado_em: new Date().toISOString(),
        created_by: user?.id ?? null,
      });
      if (admErr) throw admErr;

      await logAudit({
        companyId: selectedCompanyId,
        action: 'Documento de admissão enviado',
        entityType: 'admission_document',
        employeeId: activeProcess.employee_id,
        documentId: doc.id,
        details: { titulo: docTitle.trim(), obrigatorio: docRequired },
      });

      toast({ title: 'Documento enviado', description: 'Já aparece no portal do colaborador.' });
      setDocTitle('');
      setDocFile(null);
      setDocRequired(true);
      setDocNeedsSignature(true);
      await load();
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro', description: 'Não foi possível enviar o documento.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const removeDoc = async (doc: AdmissionDoc) => {
    await supabase.from('admission_documents').delete().eq('id', doc.id);
    if (doc.document_id) {
      await supabase.from('document_signatures').delete().eq('document_id', doc.document_id);
      await supabase.from('employee_documents').delete().eq('id', doc.document_id);
    }
    if (doc.file_url) await supabase.storage.from('documentos').remove([doc.file_url]);
    toast({ title: 'Documento removido' });
    load();
  };

  const pendingRequired = (processId: string) =>
    (docsByProcess[processId] || []).filter(d => d.obrigatorio && d.status !== 'assinado');

  const concludeProcess = async (p: Process) => {
    const docs = docsByProcess[p.id] || [];
    if (docs.filter(d => d.obrigatorio).length === 0) {
      toast({
        title: 'Faltam documentos',
        description: 'Adicione ao menos um documento obrigatório antes de concluir.',
        variant: 'destructive',
      });
      return;
    }
    if (pendingRequired(p.id).length > 0) {
      toast({
        title: 'Assinaturas pendentes',
        description: 'Todos os documentos obrigatórios precisam estar assinados.',
        variant: 'destructive',
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('admission_processes')
      .update({ status: 'concluida', concluido_em: new Date().toISOString(), concluido_por: user?.id ?? null })
      .eq('id', p.id);
    await supabase.from('employees').update({ admission_status: 'ativo' }).eq('id', p.employee_id);
    await logAudit({
      companyId: selectedCompanyId,
      action: 'Admissão concluída',
      entityType: 'admission_process',
      entityId: p.id,
      employeeId: p.employee_id,
    });

    toast({ title: 'Admissão concluída' });
    load();
  };

  const activeDocs = activeProcess ? docsByProcess[activeProcess.id] || [] : [];

  return (
    <AdminLayout currentPage="admissions">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Acompanhe as admissões em andamento e os documentos enviados pela contabilidade.
          </p>
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova admissão
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : processes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <UserPlus className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma admissão aberta.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {processes.map(p => {
              const docs = docsByProcess[p.id] || [];
              const obrig = docs.filter(d => d.obrigatorio);
              const assinados = obrig.filter(d => d.status === 'assinado').length;
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{p.employees?.nome || 'Colaborador'}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {p.employees?.cargo || 'Sem cargo'} · início {fmtDate(p.data_prevista_inicio)}
                        </p>
                      </div>
                      <StatusBadge status={p.status === 'concluida' ? 'admissao_concluida' : 'em_admissao'} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">
                      {docs.length} documento(s) · obrigatórios assinados: {assinados}/{obrig.length}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setActiveProcess(p)}>
                        <FileText className="w-4 h-4 mr-2" />
                        Documentos
                      </Button>
                      {p.status !== 'concluida' && (
                        <Button size="sm" onClick={() => concludeProcess(p)}>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Concluir admissão
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Nova admissão */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova admissão</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Select value={newEmployeeId} onValueChange={setNewEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableEmployees.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre o colaborador primeiro na tela de Colaboradores.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data prevista de início</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={3} />
            </div>
            <Button onClick={createProcess} disabled={saving || !newEmployeeId} className="w-full">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Iniciar admissão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Documentos da admissão */}
      <Dialog open={!!activeProcess} onOpenChange={(o) => !o && setActiveProcess(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documentos · {activeProcess?.employees?.nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              {activeDocs.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
              )}
              {activeDocs.map(d => (
                <div key={d.id} className="flex items-center gap-3 border rounded-lg p-3">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.obrigatorio ? 'Obrigatório' : 'Opcional'}
                      {d.requer_assinatura ? ' · exige assinatura' : ''}
                    </p>
                  </div>
                  <StatusBadge status={d.status} />
                  <Button variant="ghost" size="icon" onClick={() => removeDoc(d)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="space-y-2">
                <Label>Título do documento *</Label>
                <Input
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="Contrato de trabalho"
                />
              </div>
              <div className="space-y-2">
                <Label>Arquivo (PDF ou imagem) *</Label>
                <Input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setDocFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="obrig">Documento obrigatório</Label>
                <Switch id="obrig" checked={docRequired} onCheckedChange={setDocRequired} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="assin">Exige assinatura do colaborador</Label>
                <Switch id="assin" checked={docNeedsSignature} onCheckedChange={setDocNeedsSignature} />
              </div>
              <Button onClick={uploadDoc} disabled={uploading} className="w-full">
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Enviar documento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
