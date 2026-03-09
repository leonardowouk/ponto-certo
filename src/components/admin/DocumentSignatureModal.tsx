import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, FileText, ExternalLink, CheckCircle2, Camera, Mail } from 'lucide-react';
import { SignatureSelfieCapture } from '@/components/signature/SignatureSelfieCapture';

interface Props {
  open: boolean;
  onClose: () => void;
  documentId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail?: string | null;
  documentTitle: string;
  fileUrl: string;
  signatureId?: string;
}

type Step = 'view' | 'selfie' | 'otp' | 'confirm';

export function DocumentSignatureModal({ open, onClose, documentId, employeeId, employeeName, employeeEmail, documentTitle, fileUrl, signatureId }: Props) {
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [notes, setNotes] = useState('');
  const [signing, setSigning] = useState(false);
  const [step, setStep] = useState<Step>('view');

  // Selfie
  const [selfieData, setSelfieData] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);

  // OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');

  const handleViewDocument = async () => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const getAcceptanceText = () =>
    `Assinatura presencial registrada via painel administrativo. Colaborador "${employeeName}" confirmou ciência do documento "${documentTitle}" com verificação de PIN. Conforme Art. 10, §2º da MP 2.200-2/2001.`;

  const handleSelfieCapture = async (imageData: string) => {
    setSelfieData(imageData);
    setUploadingSelfie(true);

    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      const fileName = `${employeeId}/${documentId}_${Date.now()}.jpg`;

      const { error } = await supabase.storage.from('selfies_assinatura').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      setSelfieUrl(fileName);

      if (employeeEmail) {
        setStep('otp');
      } else {
        setStep('confirm');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao salvar foto', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingSelfie(false);
    }
  };

  const handleSendOtp = async () => {
    let sigId = signatureId;
    if (!sigId) {
      const { data: sigData } = await supabase
        .from('document_signatures')
        .select('id')
        .eq('document_id', documentId)
        .eq('employee_id', employeeId)
        .single();
      sigId = sigData?.id;
    }
    if (!sigId) return;

    setOtpSending(true);
    const { data, error } = await supabase.functions.invoke('send-signature-otp', {
      body: { employee_id: employeeId, signature_id: sigId },
    });

    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      setOtpSent(true);
      setOtpMaskedEmail(data.email_masked || '');
      toast({ title: 'Código enviado!', description: `Verifique o e-mail (${data.email_masked})` });
    }
    setOtpSending(false);
  };

  const handleSign = async () => {
    if (!pin || pin.length < 4) {
      toast({ title: 'PIN obrigatório', description: 'Digite o PIN do colaborador.', variant: 'destructive' });
      return;
    }

    let sigId = signatureId;
    if (!sigId) {
      const { data: sigData } = await supabase
        .from('document_signatures')
        .select('id')
        .eq('document_id', documentId)
        .eq('employee_id', employeeId)
        .single();
      sigId = sigData?.id;
    }

    if (!sigId) {
      toast({ title: 'Erro', description: 'Registro de assinatura não encontrado.', variant: 'destructive' });
      return;
    }

    setSigning(true);

    const { data, error } = await supabase.functions.invoke('sign-document', {
      body: {
        signature_id: sigId,
        pin,
        acceptance_text: getAcceptanceText() + (notes.trim() ? ` Obs: ${notes.trim()}` : ''),
        signed_via: 'admin',
        selfie_url: selfieUrl || undefined,
        otp_code: otpCode || undefined,
      },
    });

    if (error || data?.error) {
      toast({ title: 'Erro ao registrar assinatura', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: 'Assinatura registrada!', description: `${employeeName} assinou "${documentTitle}" com sucesso. Hash: ${data?.document_hash?.substring(0, 16)}...` });
      onClose();
    }

    setSigning(false);
  };

  const resetAndClose = () => {
    setStep('view');
    setPin('');
    setNotes('');
    setSelfieData(null);
    setSelfieUrl(null);
    setOtpCode('');
    setOtpSent(false);
    onClose();
  };

  const steps: Step[] = employeeEmail ? ['view', 'selfie', 'otp', 'confirm'] : ['view', 'selfie', 'confirm'];
  const stepLabels: Record<Step, string> = { view: 'Revisão', selfie: 'Foto', otp: 'Código', confirm: 'PIN' };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
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
          {/* Document info - always visible */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{documentTitle}</span>
            </div>
            <p className="text-sm text-muted-foreground">Colaborador: <strong>{employeeName}</strong></p>
            {step === 'view' && (
              <Button variant="outline" size="sm" onClick={handleViewDocument}>
                <ExternalLink className="w-3 h-3 mr-1" /> Visualizar Documento
              </Button>
            )}
          </div>

          {/* Step: View */}
          {step === 'view' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Após visualizar o documento, prossiga para a captura de foto do colaborador.
              </p>
              <Button onClick={() => setStep('selfie')}>
                <Camera className="w-4 h-4 mr-2" /> Prosseguir para Foto
              </Button>
            </div>
          )}

          {/* Step: Selfie */}
          {step === 'selfie' && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                O colaborador deve tirar uma selfie para comprovar identidade. A foto será carimbada com data/hora.
              </p>
              {uploadingSelfie ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Salvando foto...</p>
                </div>
              ) : (
                <SignatureSelfieCapture employeeName={employeeName} onCapture={handleSelfieCapture} />
              )}
              <Button variant="outline" size="sm" onClick={() => setStep('view')}>Voltar</Button>
            </>
          )}

          {/* Step: OTP */}
          {step === 'otp' && (
            <>
              <div className="text-center space-y-2">
                <Mail className="w-10 h-10 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Envie um código de verificação para o e-mail do colaborador.
                </p>
              </div>

              {!otpSent ? (
                <Button className="w-full" onClick={handleSendOtp} disabled={otpSending}>
                  {otpSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Enviar Código
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-center text-green-600">Código enviado para <strong>{otpMaskedEmail}</strong></p>
                  <Input maxLength={6} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="text-center text-lg tracking-widest" autoFocus />
                  <Button className="w-full" onClick={() => setStep('confirm')} disabled={otpCode.length !== 6}>Prosseguir</Button>
                  <Button variant="ghost" size="sm" className="w-full" onClick={handleSendOtp} disabled={otpSending}>Reenviar</Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep('selfie')}>Voltar</Button>
                <Button variant="ghost" size="sm" onClick={() => setStep('confirm')}>Pular</Button>
              </div>
            </>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <>
              {selfieData && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={selfieData} alt="Selfie" className="w-full h-32 object-cover" />
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-3 border text-xs leading-relaxed">
                <p className="flex items-center gap-1 mb-1 font-medium text-sm">
                  <CheckCircle2 className="w-3 h-3" /> Termo de Aceite
                </p>
                {getAcceptanceText()}
              </div>

              <div className="space-y-2">
                <Label>PIN do Colaborador</Label>
                <Input type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="PIN de 4-6 dígitos" autoFocus />
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
              </div>
            </>
          )}
        </div>

        {step === 'confirm' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(employeeEmail ? 'otp' : 'selfie')}>Voltar</Button>
            <Button onClick={handleSign} disabled={signing || !pin || pin.length < 4}>
              {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Confirmar Assinatura
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
