import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileUp, Loader2, Sparkles, CheckCircle2, AlertCircle, HelpCircle, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  companyId: string | null;
  onUploaded: () => void;
}

interface SplitResult {
  page: number;
  extracted_name: string | null;
  matched_employee: { id: string; nome: string } | null;
  status: 'matched' | 'unmatched' | 'error';
  document_id?: string;
}

interface SplitSummary {
  total_pages: number;
  matched: number;
  unmatched: number;
  errors: number;
  results: SplitResult[];
  temp_storage_path?: string;
}

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

export function BulkHoleriteUpload({ companyId, onUploaded }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [refMonth, setRefMonth] = useState(getMonthOptions()[1]?.value || getMonthOptions()[0]?.value);
  const [title, setTitle] = useState('Holerite');
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [summary, setSummary] = useState<SplitSummary | null>(null);
  const [employees, setEmployees] = useState<{ id: string; nome: string }[]>([]);
  const [manualAssignments, setManualAssignments] = useState<Record<number, string>>({});
  const [savingPages, setSavingPages] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (companyId) {
      supabase.from('employees').select('id, nome').eq('company_id', companyId).eq('ativo', true).order('nome')
        .then(({ data }) => setEmployees(data || []));
    }
  }, [companyId]);

  const handleProcess = async () => {
    if (!companyId || !file) {
      toast({ title: 'Selecione um arquivo PDF', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    setSummary(null);
    setManualAssignments({});

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', companyId);
      formData.append('ref_month', refMonth);
      formData.append('title', title);
      formData.append('requires_signature', String(requiresSignature));

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/split-holerites`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(err.error || `Erro ${response.status}`);
      }

      const result: SplitSummary = await response.json();
      setSummary(result);

      toast({
        title: 'Processamento concluído!',
        description: `${result.matched} de ${result.total_pages} holerites distribuídos com sucesso.`,
      });

      if (result.matched > 0) onUploaded();
    } catch (error: any) {
      console.error('Bulk upload error:', error);
      toast({ title: 'Erro no processamento', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleManualAssign = async (page: number) => {
    const employeeId = manualAssignments[page];
    if (!employeeId || !summary?.temp_storage_path || !companyId) return;

    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    setSavingPages(prev => ({ ...prev, [page]: true }));

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/split-holerites`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storage_path: summary.temp_storage_path,
            page,
            employee_id: emp.id,
            employee_name: emp.nome,
            company_id: companyId,
            ref_month: refMonth,
            title,
            requires_signature: requiresSignature,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erro' }));
        throw new Error(err.error || 'Erro ao salvar');
      }

      const result = await response.json();

      // Update summary
      setSummary(prev => {
        if (!prev) return prev;
        const updatedResults = prev.results.map(r =>
          r.page === page
            ? { ...r, status: 'matched' as const, matched_employee: emp, document_id: result.document_id }
            : r
        );
        return {
          ...prev,
          results: updatedResults,
          matched: updatedResults.filter(r => r.status === 'matched').length,
          unmatched: updatedResults.filter(r => r.status === 'unmatched').length,
        };
      });

      toast({ title: `Holerite vinculado a ${emp.nome}` });
      onUploaded();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setSavingPages(prev => ({ ...prev, [page]: false }));
    }
  };

  const resetForm = () => {
    setFile(null);
    setSummary(null);
    setManualAssignments({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'matched': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'unmatched': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'matched': return <Badge className="bg-green-100 text-green-800">Distribuído</Badge>;
      case 'unmatched': return <Badge className="bg-yellow-100 text-yellow-800">Não identificado</Badge>;
      case 'error': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="outline">-</Badge>;
    }
  };

  // Get already-assigned employee IDs to filter them out of manual selects
  const assignedEmployeeIds = new Set(
    summary?.results.filter(r => r.status === 'matched' && r.matched_employee).map(r => r.matched_employee!.id) || []
  );

  const unmatchedCount = summary?.results.filter(r => r.status === 'unmatched').length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Upload Inteligente de Holerites
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Envie o PDF completo com todos os holerites. O sistema usa IA para identificar cada colaborador e distribuir automaticamente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Título base</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Holerite" />
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
              <div className="space-y-2">
                <Label>Arquivo PDF (todos os holerites)</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  {file ? (
                    <p className="text-sm font-medium">{file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Clique para selecionar o PDF</p>
                  )}
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={requiresSignature} onCheckedChange={(v) => setRequiresSignature(!!v)} />
                <span className="text-sm">Requer assinatura do colaborador</span>
              </label>

              <Button onClick={handleProcess} disabled={processing || !file || !companyId}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processando com IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Processar e Distribuir
                  </>
                )}
              </Button>
            </div>

            {processing && (
              <div className="space-y-2 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analisando cada página com IA para identificar os colaboradores...</span>
                </div>
                <Progress value={undefined} className="h-2" />
                <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos por página.</p>
              </div>
            )}
          </>
        )}

        {summary && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{summary.matched}</p>
                <p className="text-sm text-green-600 dark:text-green-500">Distribuídos</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{unmatchedCount}</p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">Não identificados</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{summary.total_pages}</p>
                <p className="text-sm text-muted-foreground">Total de páginas</p>
              </div>
            </div>

            {unmatchedCount > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  {unmatchedCount} página(s) não identificada(s). Selecione o colaborador manualmente abaixo e clique em "Vincular".
                </p>
              </div>
            )}

            {/* Results table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Página</TableHead>
                  <TableHead>Nome Extraído (IA)</TableHead>
                  <TableHead>Colaborador Vinculado</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center w-28">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.results.map(r => (
                  <TableRow key={r.page}>
                    <TableCell className="font-mono">{r.page}</TableCell>
                    <TableCell className="text-sm">{r.extracted_name || <span className="text-muted-foreground italic">Não encontrado</span>}</TableCell>
                    <TableCell>
                      {r.status === 'matched' && r.matched_employee ? (
                        <span className="font-medium">{r.matched_employee.nome}</span>
                      ) : r.status === 'unmatched' ? (
                        <Select
                          value={manualAssignments[r.page] || ''}
                          onValueChange={(v) => setManualAssignments(prev => ({ ...prev, [r.page]: v }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o colaborador..." />
                          </SelectTrigger>
                          <SelectContent>
                            {employees
                              .filter(e => !assignedEmployeeIds.has(e.id))
                              .map(e => (
                                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground italic">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {statusIcon(r.status)}
                        {statusLabel(r.status)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.status === 'unmatched' && (
                        <Button
                          size="sm"
                          disabled={!manualAssignments[r.page] || savingPages[r.page]}
                          onClick={() => handleManualAssign(r.page)}
                        >
                          {savingPages[r.page] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Save className="w-3 h-3 mr-1" />
                              Vincular
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <Button variant="outline" onClick={resetForm}>
                Processar outro arquivo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
