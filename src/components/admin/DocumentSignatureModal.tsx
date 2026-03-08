import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck, FileText, ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  documentId: string;
  employeeId: string;
  employeeName: string;
  documentTitle: string;
  fileUrl: string;
}

export function DocumentSignatureModal({ open, onClose, documentId, employeeId, employeeName, documentTitle, fileUrl }: Props) {
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

  const handleSign = async () => {
    if (!pin || pin.length < 4) {
      toast({ title: 'PIN obrigatório', description: 'Digite o PIN do colaborador para confirmar.', variant: 'destructive' });
      return;
    }

    setSigning(true);

    // Verify PIN via edge function
    const { data: empData } = await supabase
      .from('employees')
      .select('pin_hash')
      .eq('id', employeeId)
      .single();

    if (!empData) {
      toast({ title: 'Erro', description: 'Colaborador não encontrado.', variant: 'destructive' });
      setSigning(false);
      return;
    }

    // Verify PIN using hash-pin function
    const { data: hashResult } = await supabase.functions.invoke('hash-pin', {
      body: { pin, salt: empData.pin_hash.split(':')[0] },
    });

    const pinMatch = hashResult?.hash === empData.pin_hash;

    if (!pinMatch) {
      toast({ title: 'PIN incorreto', description: 'O PIN informado não confere.', variant: 'destructive' });
      setSigning(false);
      return;
    }

    // Register signature
    const { error } = await supabase
      .from('document_signatures')
      .update({
        status: 'assinado' as any,
        signed_at: new Date().toISOString(),
        signed_via: 'admin',
        pin_verified: true,
        notes: notes.trim() || null,
      })
      .eq('document_id', documentId)
      .eq('employee_id', employeeId);

    if (error) {
      toast({ title: 'Erro ao registrar assinatura', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Assinatura registrada!', description: `${employeeName} assinou "${documentTitle}" com sucesso.` });
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
            <Button onClick={handleSign} disabled={signing || !pin}>
              {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Confirmar Assinatura
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
