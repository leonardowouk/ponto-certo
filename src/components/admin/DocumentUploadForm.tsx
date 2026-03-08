import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendWhatsAppNotification } from '@/lib/whatsapp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Upload, Loader2, FileUp } from 'lucide-react';

interface Props {
  companyId: string | null;
  onUploaded: () => void;
}

const docTypes = [
  { value: 'holerite', label: 'Holerite' },
  { value: 'espelho_ponto', label: 'Espelho de Ponto' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'advertencia', label: 'Advertência' },
  { value: 'comunicado', label: 'Comunicado' },
  { value: 'outro', label: 'Outro' },
];

const getMonthOptions = () => {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    options.push({ value: format(first, 'yyyy-MM-dd'), label: format(first, 'MMMM/yyyy', { locale: ptBR }) });
  }
  return options;
};

interface Employee {
  id: string;
  nome: string;
  sector_id: string | null;
}

interface Sector {
  id: string;
  nome: string;
}

export function DocumentUploadForm({ companyId, onUploaded }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docType, setDocType] = useState('holerite');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [refMonth, setRefMonth] = useState(getMonthOptions()[1]?.value || getMonthOptions()[0]?.value);
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<'all' | 'sector' | 'individual'>('all');
  const [selectedSector, setSelectedSector] = useState<string>('');

  useEffect(() => {
    if (companyId) {
      loadEmployeesAndSectors();
    }
  }, [companyId]);

  useEffect(() => {
    if (selectionMode === 'all') {
      setSelectedEmployees(new Set(employees.map(e => e.id)));
    } else if (selectionMode === 'sector' && selectedSector) {
      setSelectedEmployees(new Set(employees.filter(e => e.sector_id === selectedSector).map(e => e.id)));
    }
  }, [selectionMode, selectedSector, employees]);

  const loadEmployeesAndSectors = async () => {
    const [empRes, secRes] = await Promise.all([
      supabase.from('employees').select('id, nome, sector_id').eq('company_id', companyId!).eq('ativo', true).order('nome'),
      supabase.from('sectors').select('id, nome').eq('company_id', companyId!).eq('ativo', true).order('nome'),
    ]);
    setEmployees(empRes.data || []);
    setSectors(secRes.data || []);
    setSelectedEmployees(new Set((empRes.data || []).map(e => e.id)));
  };

  const toggleEmployee = (id: string) => {
    setSelectionMode('individual');
    const next = new Set(selectedEmployees);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedEmployees(next);
  };

  const handleSubmit = async () => {
    if (!companyId || !file || !title.trim() || selectedEmployees.size === 0) {
      toast({ title: 'Preencha todos os campos', description: 'Título, arquivo e ao menos 1 colaborador.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    let successCount = 0;
    const empArray = Array.from(selectedEmployees);

    for (const empId of empArray) {
      const ext = file.name.split('.').pop() || 'pdf';
      const storagePath = `${companyId}/${empId}/${docType}_${refMonth}.${ext}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      // Create document record
      const { data: docData, error: docError } = await supabase
        .from('employee_documents')
        .insert({
          company_id: companyId,
          employee_id: empId,
          document_type: docType as any,
          title: title.trim(),
          description: description.trim() || null,
          file_url: storagePath,
          ref_month: refMonth,
          requires_signature: requiresSignature,
          created_by: userId,
        })
        .select('id')
        .single();

      if (docError) {
        console.error('Doc insert error:', docError);
        continue;
      }

      // Create pending signature if required
      if (requiresSignature && docData) {
        await supabase.from('document_signatures').insert({
          document_id: docData.id,
          employee_id: empId,
          status: 'pendente' as any,
        });
      }

      // Send WhatsApp notification
      if (companyId) {
        sendWhatsAppNotification({
          companyId,
          action: 'notify_document',
          employeeId: empId,
          variables: { document_title: title.trim() },
        }).catch(console.error);
      }

      successCount++;
    }

    toast({
      title: 'Upload concluído',
      description: `${successCount} de ${empArray.length} documentos enviados com sucesso.`,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onUploaded();
    setUploading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Enviar Documento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Documento</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {docTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Holerite Fevereiro/2026" />
          </div>
          <div className="space-y-2">
            <Label>Mês de Referência</Label>
            <Select value={refMonth} onValueChange={setRefMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {getMonthOptions().map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Descrição (opcional)</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Arquivo</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}>
              <FileUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium">{file.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Clique para selecionar PDF ou arquivo</p>
              )}
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Destinatários</Label>
            <div className="flex gap-2 mb-2">
              <Button size="sm" variant={selectionMode === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectionMode('all')}>Todos</Button>
              <Button size="sm" variant={selectionMode === 'sector' ? 'default' : 'outline'}
                onClick={() => setSelectionMode('sector')}>Por Setor</Button>
              <Button size="sm" variant={selectionMode === 'individual' ? 'default' : 'outline'}
                onClick={() => setSelectionMode('individual')}>Individual</Button>
            </div>

            {selectionMode === 'sector' && (
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
              {employees.map(emp => (
                <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                  <Checkbox
                    checked={selectedEmployees.has(emp.id)}
                    onCheckedChange={() => toggleEmployee(emp.id)}
                  />
                  {emp.nome}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{selectedEmployees.size} selecionado(s)</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={requiresSignature} onCheckedChange={(v) => setRequiresSignature(!!v)} />
            <span className="text-sm">Requer assinatura do colaborador</span>
          </label>

          <Button onClick={handleSubmit} disabled={uploading || !file || !title.trim()}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? 'Enviando...' : `Enviar para ${selectedEmployees.size} colaborador(es)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
