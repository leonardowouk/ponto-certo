import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, FileText, ExternalLink, CheckCircle2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  documentId: string;
  employeeId: string;
  employeeName: string;
  documentTitle: string;
  fileUrl: string;
  signatureId?: string;
}

export function DocumentSignatureModal({ open, onClose, documentId, employeeId, employeeName, documentTitle, fileUrl, signatureId }: Props) {
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [notes, setNotes] = useState('');
  const [signing, setSigning] = useState(false);
  const [step, setStep] = useState<'view' | 'confirm'>('view');

  const handleViewDocument = async () => {
    const { data } = await supabase.storage.from('documentos').createSignedUrl(fileUrl, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const getAcceptanceText = () =>
    `Assinatura presencial registrada via painel administrativo. Colaborador "${employeeName}" confirmou ciência do documento "${documentTitle}" com verificação de PIN. Conforme Art. 10, §2º da MP 2.200-2/2001.`;

  const handleSign = async () => {
    if (!pin || pin.length < 4) {
      toast({ title: 'PIN obrigatório', description: 'Digite o PIN do colaborador para confirmar.', variant: 'destructive' });
      return;
    }

    // Need signature_id - find it if not provided
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
      },
    });

    if (error || data?.error) {
      toast({
        title: 'Erro ao registrar assinatura',
        description: data?.error || error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Assinatura registrada!',
        description: `${employeeName} assinou "${documentTitle}" com sucesso. Hash: ${data?.document_hash?.substring(0, 16)}...`,
      });
      onClose();
    }

    setSigning(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Assinatura Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Document info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{documentTitle}</span>
            </div>
            <p className="text-sm text-muted-foreground">Colaborador: <strong>{employeeName}</strong></p>
            <Button variant="outline" size="sm" onClick={handleViewDocument}>
              <ExternalLink className="w-3 h-3 mr-1" />
              Visualizar Documento
            </Button>
          </div>

          {step === 'view' && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Após visualizar o documento, clique em "Prosseguir para Assinatura" para confirmar com o PIN do colaborador.
              </p>
              <Button onClick={() => setStep('confirm')}>
                Prosseguir para Assinatura
              </Button>
            </div>
          )}

          {step === 'confirm' && (
            <>
              {/* Acceptance info */}
              <div className="bg-muted/30 rounded-lg p-3 border text-xs leading-relaxed">
                <p className="flex items-center gap-1 mb-1 font-medium text-sm">
                  <CheckCircle2 className="w-3 h-3" /> Termo de Aceite
                </p>
                {getAcceptanceText()}
              </div>

              <div className="space-y-2">
                <Label>PIN do Colaborador</Label>
                <Input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Digite o PIN de 4-6 dígitos"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  O colaborador deve digitar seu PIN para confirmar a assinatura.
                </p>
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
            <Button variant="outline" onClick={() => setStep('view')}>Voltar</Button>
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
