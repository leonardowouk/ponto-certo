import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Eye, CheckCircle2, AlertCircle, Loader2, ShieldCheck, ExternalLink, Camera } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { SignatureSelfieCapture } from '@/components/signature/SignatureSelfieCapture';

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

type SignStep = 'review' | 'selfie' | 'pin';

export default function PortalDocuments() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingDoc, setSigningDoc] = useState<DocItem | null>(null);
  const [signing, setSigning] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState('');

  // Signing flow state
  const [step, setStep] = useState<SignStep>('review');
  const [pin, setPin] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [docViewed, setDocViewed] = useState(false);
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  const resetSigningState = () => {
    setSigningDoc(null);
    setStep('review');
    setPin('');
    setAccepted(false);
    setDocViewed(false);
    setSelfieData(null);
    setSelfieUrl(null);
  };

  useEffect(() => { loadDocs(); }, []);

  const loadDocs = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: emp } = await supabase
      .from('employees')
      .select('id, nome')
      .eq('auth_user_id', user.id)
      .single();

    if (!emp) return;
    setEmployeeId(emp.id);
    setEmployeeName(emp.nome);

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
        id: d.id, title: d.title, document_type: d.document_type,
        ref_month: d.ref_month, file_url: d.file_url, created_at: d.created_at,
        requires_signature: d.requires_signature,
        signature_id: sig?.id || null, signature_status: sig?.status || null,
      };
    });

    setDocs(items);
    setLoading(false);
  };

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);

  const handleView = async (fileUrl: string) => {
    setViewerLoading(true);
    const { data, error } = await supabase.storage.from('documentos').createSignedUrl(fileUrl, 3600);
    if (error || !data?.signedUrl) {
      toast({ title: 'Erro ao abrir documento', description: error?.message || 'Não foi possível gerar o link do arquivo.', variant: 'destructive' });
      setViewerLoading(false);
      return;
    }
    setViewerUrl(data.signedUrl);
    setViewerOpen(true);
    setViewerLoading(false);
    if (signingDoc) setDocViewed(true);
  };

  const getAcceptanceText = (title: string) =>
    `Declaro que li e estou de acordo com o conteúdo do documento "${title}". Esta assinatura digital tem validade jurídica conforme Art. 10, §2º da MP 2.200-2/2001.`;

  const handleSelfieCapture = async (imageData: string) => {
    if (!signingDoc || !employeeId) return;
    setSelfieData(imageData);
    setUploadingSelfie(true);

    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      const fileName = `${employeeId}/${signingDoc.id}_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('selfies_assinatura')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (error) throw error;
      setSelfieUrl(fileName);
      setStep('pin');
    } catch (err: any) {
      toast({ title: 'Erro ao salvar foto', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingSelfie(false);
    }
  };

  const handleSign = async () => {
    if (!signingDoc?.signature_id || !pin || !accepted) return;
    setSigning(true);

    const { data, error } = await supabase.functions.invoke('sign-document', {
      body: {
        signature_id: signingDoc.signature_id,
        pin,
        acceptance_text: getAcceptanceText(signingDoc.title),
        signed_via: 'portal',
        selfie_url: selfieUrl || undefined,
      },
    });

    if (error || data?.error) {
      toast({ title: 'Erro ao assinar', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Documento assinado com sucesso!', description: `Hash: ${data?.document_hash?.substring(0, 16)}...` });
      loadDocs();
    }
    setSigning(false);
    resetSigningState();
  };

  const pendingDocs = docs.filter(d => d.requires_signature && d.signature_status === 'pendente');

  const stepLabels: Record<SignStep, string> = { review: 'Revisão', selfie: 'Foto', pin: 'PIN' };
  const steps: SignStep[] = ['review', 'selfie', 'pin'];

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

      {/* Multi-step Signing Dialog */}
      <Dialog open={!!signingDoc} onOpenChange={() => resetSigningState()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Assinatura Digital
            </DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1 justify-center mb-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? 'bg-primary text-primary-foreground' :
                  steps.indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                }`}>{i + 1}</div>
                <span className={`text-xs hidden sm:inline ${step === s ? 'font-semibold' : 'text-muted-foreground'}`}>{stepLabels[s]}</span>
                {i < steps.length - 1 && <div className="w-6 h-px bg-border mx-1" />}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {/* Step 1: Review */}
            {step === 'review' && (
              <>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{signingDoc?.title}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => signingDoc && handleView(signingDoc.file_url)}>
                    <ExternalLink className="w-3 h-3 mr-1" /> Visualizar Documento
                  </Button>
                  {docViewed && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Documento visualizado
                    </p>
                  )}
                </div>

                <div className="bg-muted/30 rounded-lg p-4 border">
                  <p className="text-sm leading-relaxed">{signingDoc && getAcceptanceText(signingDoc.title)}</p>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox id="accept-terms" checked={accepted} onCheckedChange={(c) => setAccepted(c === true)} />
                  <Label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
                    Li o documento e concordo com o termo acima. Entendo que esta assinatura tem validade jurídica.
                  </Label>
                </div>

                <Button className="w-full" onClick={() => setStep('selfie')} disabled={!accepted}>
                  <Camera className="w-4 h-4 mr-2" /> Prosseguir para Foto
                </Button>
              </>
            )}

            {/* Step 2: Selfie */}
            {step === 'selfie' && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Tire uma selfie para comprovar sua identidade. A foto será carimbada com data e hora.
                </p>
                {uploadingSelfie ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Salvando foto...</p>
                  </div>
                ) : (
                  <SignatureSelfieCapture employeeName={employeeName} onCapture={handleSelfieCapture} />
                )}
                <Button variant="outline" size="sm" onClick={() => setStep('review')}>Voltar</Button>
              </>
            )}

            {/* Step 3: PIN */}
            {step === 'pin' && (
              <>
                {selfieData && (
                  <div className="rounded-lg overflow-hidden border">
                    <img src={selfieData} alt="Selfie" className="w-full h-32 object-cover" />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>PIN de Confirmação</Label>
                  <Input
                    type="password"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Digite seu PIN de 4-6 dígitos"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Seu PIN pessoal é necessário para confirmar a identidade.</p>
                </div>
              </>
            )}
          </div>

          {step === 'pin' && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('selfie')}>Voltar</Button>
              <Button onClick={handleSign} disabled={signing || !pin || pin.length < 4 || !accepted}>
                {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Confirmar Assinatura
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </PortalLayout>
  );
}
