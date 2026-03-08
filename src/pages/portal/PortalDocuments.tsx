import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Eye, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DocItem {
  id: string;
  title: string;
  document_type: string;
  ref_month: string | null;
  file_url: string;
  created_at: string;
  signature_id: string | null;
  signature_status: string | null;
  requires_signature: boolean;
}

const typeLabels: Record<string, string> = {
  holerite: 'Holerite',
  espelho_ponto: 'Espelho de Ponto',
  contrato: 'Contrato',
  advertencia: 'Advertência',
  comunicado: 'Comunicado',
  outro: 'Outro',
};

export default function PortalDocuments() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingDoc, setSigningDoc] = useState<DocItem | null>(null);
  const [signing, setSigning] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return;
    setEmployeeId(emp.id);

    const { data: documents } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', emp.id)
      .order('created_at', { ascending: false });

    const { data: signatures } = await supabase
      .from('document_signatures')
      .select('id, document_id, status')
      .eq('employee_id', emp.id);

    const sigMap = new Map<string, { id: string; status: string }>();
    (signatures || []).forEach((s: any) => sigMap.set(s.document_id, { id: s.id, status: s.status }));

    const items: DocItem[] = (documents || []).map((d: any) => {
      const sig = sigMap.get(d.id);
      return {
        id: d.id,
        title: d.title,
        document_type: d.document_type,
        ref_month: d.ref_month,
        file_url: d.file_url,
        created_at: d.created_at,
        requires_signature: d.requires_signature,
        signature_id: sig?.id || null,
        signature_status: sig?.status || null,
      };
    });

    setDocs(items);
    setLoading(false);
  };

  const handleView = async (fileUrl: string) => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleSign = async () => {
    if (!signingDoc?.signature_id) return;
    setSigning(true);

    const { error } = await supabase
      .from('document_signatures')
      .update({
        status: 'assinado',
        signed_at: new Date().toISOString(),
        signed_via: 'portal',
        pin_verified: true,
      })
      .eq('id', signingDoc.signature_id);

    if (error) {
      toast({ title: 'Erro ao assinar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Documento assinado com sucesso!' });
      loadDocs();
    }
    setSigning(false);
    setSigningDoc(null);
  };

  const pendingDocs = docs.filter(d => d.requires_signature && d.signature_status === 'pendente');
  const otherDocs = docs.filter(d => !d.requires_signature || d.signature_status !== 'pendente');

  return (
    <PortalLayout currentPage="documents">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Meus Documentos</h1>

        {pendingDocs.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                Documentos Pendentes de Assinatura ({pendingDocs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDocs.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>{typeLabels[doc.document_type] || doc.document_type}</TableCell>
                      <TableCell>
                        {doc.ref_month ? format(new Date(doc.ref_month + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleView(doc.file_url)}>
                            <Eye className="w-3 h-3 mr-1" /> Ver
                          </Button>
                          <Button size="sm" onClick={() => setSigningDoc(doc)}>
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Assinar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Todos os Documentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : docs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum documento encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.title}</TableCell>
                      <TableCell>{typeLabels[doc.document_type] || doc.document_type}</TableCell>
                      <TableCell>
                        {doc.ref_month ? format(new Date(doc.ref_month + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR }) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {!doc.requires_signature ? (
                          <Badge variant="outline">Sem assinatura</Badge>
                        ) : doc.signature_status === 'assinado' ? (
                          <Badge className="bg-green-100 text-green-800">Assinado</Badge>
                        ) : doc.signature_status === 'pendente' ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                        ) : (
                          <Badge variant="outline">{doc.signature_status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="outline" onClick={() => handleView(doc.file_url)}>
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!signingDoc} onOpenChange={() => setSigningDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assinar documento</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a assinar o documento <strong>"{signingDoc?.title}"</strong>.
              Ao confirmar, sua assinatura digital será registrada com data, hora e IP.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSign} disabled={signing}>
              {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirmar Assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}
