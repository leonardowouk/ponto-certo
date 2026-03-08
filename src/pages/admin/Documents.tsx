import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DocumentUploadForm } from '@/components/admin/DocumentUploadForm';
import { BulkHoleriteUpload } from '@/components/admin/BulkHoleriteUpload';
import { SignatureTracker } from '@/components/admin/SignatureTracker';
import { DocumentSignatureModal } from '@/components/admin/DocumentSignatureModal';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Upload, ClipboardCheck, Loader2, Trash2, Eye, Sparkles } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const docTypeLabels: Record<string, string> = {
  holerite: 'Holerite',
  espelho_ponto: 'Espelho de Ponto',
  contrato: 'Contrato',
  advertencia: 'Advertência',
  comunicado: 'Comunicado',
  outro: 'Outro',
};

const getMonthOptions = () => {
  const options = [{ value: 'all', label: 'Todos os meses' }];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    options.push({ value: format(first, 'yyyy-MM-dd'), label: format(first, 'MMMM/yyyy', { locale: ptBR }) });
  }
  return options;
};

interface DocRow {
  id: string;
  title: string;
  document_type: string;
  ref_month: string | null;
  requires_signature: boolean;
  created_at: string;
  employee_id: string;
  employee_name?: string;
  file_url: string;
  signature_status?: string;
  signature_count?: { total: number; signed: number };
}

export default function Documents() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const monthOptions = getMonthOptions();
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [signModalDoc, setSignModalDoc] = useState<DocRow | null>(null);

  useEffect(() => {
    if (selectedCompanyId) loadDocuments();
  }, [selectedCompanyId, filterMonth, filterType]);

  const loadDocuments = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);

    let query = supabase
      .from('employee_documents')
      .select('*, employees!inner(nome)')
      .eq('company_id', selectedCompanyId)
      .order('created_at', { ascending: false });

    if (filterMonth !== 'all') {
      query = query.eq('ref_month', filterMonth);
    }
    if (filterType !== 'all') {
      query = query.eq('document_type', filterType as any);
    }

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const docs: DocRow[] = (data || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      document_type: d.document_type,
      ref_month: d.ref_month,
      requires_signature: d.requires_signature,
      created_at: d.created_at,
      employee_id: d.employee_id,
      employee_name: d.employees?.nome,
      file_url: d.file_url,
    }));

    // Load signature statuses
    if (docs.length > 0) {
      const docIds = docs.map(d => d.id);
      const { data: sigs } = await supabase
        .from('document_signatures')
        .select('document_id, status')
        .in('document_id', docIds);

      const sigMap = new Map<string, { total: number; signed: number; status: string }>();
      (sigs || []).forEach((s: any) => {
        if (!sigMap.has(s.document_id)) {
          sigMap.set(s.document_id, { total: 0, signed: 0, status: s.status });
        }
        const entry = sigMap.get(s.document_id)!;
        entry.total++;
        if (s.status === 'assinado') entry.signed++;
        entry.status = s.status;
      });

      docs.forEach(d => {
        const sig = sigMap.get(d.id);
        if (sig) {
          d.signature_status = sig.status;
          d.signature_count = { total: sig.total, signed: sig.signed };
        }
      });
    }

    setDocuments(docs);
    setLoading(false);
  };

  const handleDelete = async (docId: string, fileUrl: string) => {
    // Delete from storage
    if (fileUrl) {
      await supabase.storage.from('documentos').remove([fileUrl]);
    }
    const { error } = await supabase.from('employee_documents').delete().eq('id', docId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Documento excluído' });
      loadDocuments();
    }
  };

  const handleViewFile = async (fileUrl: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const sigStatusBadge = (doc: DocRow) => {
    if (!doc.requires_signature) return <Badge variant="outline">Sem assinatura</Badge>;
    if (!doc.signature_count) return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    if (doc.signature_count.signed === doc.signature_count.total) {
      return <Badge className="bg-green-100 text-green-800">Assinado</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
  };

  return (
    <AdminLayout currentPage="documents">
      <div className="space-y-6">
        <Tabs defaultValue="upload">
          <TabsList>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="w-4 h-4" />
              Enviar Documentos
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Upload Inteligente
            </TabsTrigger>
            <TabsTrigger value="tracker" className="gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Acompanhar Assinaturas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            {/* Upload Form */}
            <DocumentUploadForm
              companyId={selectedCompanyId}
              onUploaded={loadDocuments}
            />

            {/* Documents List */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documentos Enviados
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Tipo:</Label>
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {Object.entries(docTypeLabels).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Mês:</Label>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : documents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum documento encontrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Mês Ref.</TableHead>
                        <TableHead className="text-center">Assinatura</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map(doc => (
                        <TableRow key={doc.id}>
                          <TableCell className="font-medium">{doc.title}</TableCell>
                          <TableCell>{doc.employee_name}</TableCell>
                          <TableCell>{docTypeLabels[doc.document_type] || doc.document_type}</TableCell>
                          <TableCell>
                            {doc.ref_month ? format(new Date(doc.ref_month + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR }) : '-'}
                          </TableCell>
                          <TableCell className="text-center">{sigStatusBadge(doc)}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => handleViewFile(doc.file_url)}>
                                <Eye className="w-3 h-3 mr-1" />Ver
                              </Button>
                              {doc.requires_signature && (!doc.signature_count || doc.signature_count.signed === 0) && (
                                <Button size="sm" variant="outline" onClick={() => setSignModalDoc(doc)}>
                                  <ClipboardCheck className="w-3 h-3 mr-1" />Assinar
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. O documento e assinaturas vinculadas serão removidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(doc.id, doc.file_url)}>
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk">
            <BulkHoleriteUpload companyId={selectedCompanyId} onUploaded={loadDocuments} />
          </TabsContent>

          <TabsContent value="tracker">
            <SignatureTracker companyId={selectedCompanyId} />
          </TabsContent>
        </Tabs>
      </div>

      {signModalDoc && (
        <DocumentSignatureModal
          open={!!signModalDoc}
          onClose={() => { setSignModalDoc(null); loadDocuments(); }}
          documentId={signModalDoc.id}
          employeeId={signModalDoc.employee_id}
          employeeName={signModalDoc.employee_name || ''}
          documentTitle={signModalDoc.title}
          fileUrl={signModalDoc.file_url}
        />
      )}
    </AdminLayout>
  );
}
