import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Download, ExternalLink, Loader2, ShieldCheck, Upload, CheckCircle2 } from 'lucide-react';

export const ASSINADOR_GOVBR_URL = 'https://assinador.iti.br';
export const VALIDADOR_GOVBR_URL = 'https://validar.iti.gov.br';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: { id: string; title: string; file_url: string; signature_id: string | null } | null;
  onSigned: () => void;
}

export function GovBrSignDialog({ open, onOpenChange, doc, onSigned }: Props) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  const reset = () => { setDownloaded(false); setFile(null); };

  const handleDownload = async () => {
    if (!doc) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage.from('documentos').download(doc.file_url);
      if (error || !data) throw error || new Error('Arquivo não encontrado');
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^\w\s-]/g, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDownloaded(true);
    } catch (err: any) {
      toast({ title: 'Erro ao baixar documento', description: err.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const handleSend = async () => {
    if (!doc?.signature_id || !file) return;
    setSending(true);
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('sign-document-govbr', {
        body: { signature_id: doc.signature_id, file_base64: base64, file_name: file.name },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      if (data?.has_signature_dictionary === false) {
        toast({
          title: 'Documento recebido',
          description: 'Não identificamos um certificado digital neste arquivo. O RH vai conferir.',
        });
      } else {
        toast({
          title: 'Documento assinado com sucesso!',
          description: 'A assinatura do gov.br foi registrada.',
        });
      }
      reset();
      onOpenChange(false);
      onSigned();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar documento', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Assinar com gov.br
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Assinatura digital gratuita do Governo Federal, com validade jurídica. Você precisa de uma conta
            gov.br nível prata ou ouro.
          </p>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">1. Baixe o documento</p>
            <p className="text-xs text-muted-foreground">{doc?.title}</p>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
              Baixar PDF original
            </Button>
            {downloaded && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Documento baixado
              </p>
            )}
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">2. Assine no site oficial</p>
            <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1">
              <li>Entre com sua conta gov.br</li>
              <li>Escolha o PDF que você acabou de baixar</li>
              <li>Posicione a assinatura e confirme</li>
              <li>Baixe o arquivo assinado</li>
            </ol>
            <a href={ASSINADOR_GOVBR_URL} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-3 h-3 mr-1" /> Abrir assinador do gov.br
              </Button>
            </a>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">3. Envie o arquivo assinado</p>
            <Label htmlFor="govbr-file" className="sr-only">Arquivo assinado</Label>
            <Input
              id="govbr-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSend} disabled={!file || sending}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Enviar documento assinado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
