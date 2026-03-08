import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Upload, FileText, Loader2, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function PortalCertificates() {
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    ref_date: '',
    description: '',
    file: null as File | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id, company_id')
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return;
    setEmployeeId(emp.id);
    setCompanyId(emp.company_id);

    // Load atestados uploaded by employee (document_type = 'outro' with title pattern)
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', emp.id)
      .eq('document_type', 'outro')
      .ilike('title', 'Atestado%')
      .order('created_at', { ascending: false });

    setCertificates(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!employeeId || !companyId || !formData.file || !formData.ref_date) {
      toast({ title: 'Preencha a data e selecione o arquivo', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    try {
      // Upload file
      const ext = formData.file.name.split('.').pop();
      const path = `atestados/${employeeId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, formData.file);

      if (uploadError) throw uploadError;

      // Create document record - use edge function or direct insert
      // Employee can't insert into employee_documents directly (RLS), so we use a workaround
      // We'll create an edge function for this
      const { error } = await supabase.functions.invoke('upload-certificate', {
        body: {
          employee_id: employeeId,
          company_id: companyId,
          ref_date: formData.ref_date,
          description: formData.description,
          file_url: path,
        },
      });

      if (error) throw error;

      toast({ title: 'Atestado enviado com sucesso!' });
      setShowForm(false);
      setFormData({ ref_date: '', description: '', file: null });
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar atestado', description: err.message, variant: 'destructive' });
    }
    setSubmitting(false);
  };

  const handleView = async (fileUrl: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  return (
    <PortalLayout currentPage="certificates">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-bold">Atestados</h1>
          <Button onClick={() => setShowForm(true)}>
            <Upload className="w-4 h-4 mr-2" /> Enviar Atestado
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Meus Atestados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : certificates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum atestado enviado.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Ref.</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">
                          {c.ref_month ? format(new Date(c.ref_month + 'T12:00:00'), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                        <TableCell>{c.description || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(c.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="outline" onClick={() => handleView(c.file_url)}>
                            <Eye className="w-3 h-3 mr-1" /> Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
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
            <DialogTitle>Enviar Atestado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data de referência</Label>
              <Input
                type="date"
                value={formData.ref_date}
                onChange={e => setFormData(p => ({ ...p, ref_date: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder="Ex: Atestado médico - 2 dias"
                rows={2}
              />
            </div>
            <div>
              <Label>Arquivo (PDF ou imagem)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setFormData(p => ({ ...p, file: e.target.files?.[0] || null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
