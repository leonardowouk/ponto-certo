import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardCheck, Loader2, Eye, ShieldCheck } from 'lucide-react';

interface Props {
  companyId: string | null;
}

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

interface SignatureRow {
  documentId: string;
  documentTitle: string;
  documentType: string;
  refMonth: string | null;
  employeeName: string;
  status: string;
  signedAt: string | null;
  signedVia: string | null;
  pinVerified: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  documentHash: string | null;
  acceptanceText: string | null;
}

export function SignatureTracker({ companyId }: Props) {
  const { toast } = useToast();
  const monthOptions = getMonthOptions();
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [rows, setRows] = useState<SignatureRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<SignatureRow | null>(null);

  const totalSigs = rows.length;
  const signedCount = rows.filter(r => r.status === 'assinado').length;
  const pendingCount = rows.filter(r => r.status === 'pendente').length;
  const progress = totalSigs > 0 ? Math.round((signedCount / totalSigs) * 100) : 0;

  useEffect(() => {
    if (companyId) loadSignatures();
  }, [companyId, filterMonth, filterStatus]);

  const loadSignatures = async () => {
    if (!companyId) return;
    setLoading(true);

    let docQuery = supabase
      .from('employee_documents')
      .select('id, title, document_type, ref_month')
      .eq('company_id', companyId)
      .eq('requires_signature', true);

    if (filterMonth !== 'all') {
      docQuery = docQuery.eq('ref_month', filterMonth);
    }

    const { data: docs } = await docQuery;
    if (!docs || docs.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const docIds = docs.map(d => d.id);
    let sigQuery = supabase
      .from('document_signatures')
      .select('*, employees!inner(nome)')
      .in('document_id', docIds);

    if (filterStatus !== 'all') {
      sigQuery = sigQuery.eq('status', filterStatus as any);
    }

    const { data: sigs } = await sigQuery;

    const docMap = new Map(docs.map(d => [d.id, d]));
    const result: SignatureRow[] = (sigs || []).map((s: any) => {
      const doc = docMap.get(s.document_id);
      return {
        documentId: s.document_id,
        documentTitle: doc?.title || '',
        documentType: doc?.document_type || '',
        refMonth: doc?.ref_month || null,
        employeeName: s.employees?.nome || '',
        status: s.status,
        signedAt: s.signed_at,
        signedVia: s.signed_via,
        pinVerified: s.pin_verified,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        documentHash: s.document_hash,
        acceptanceText: s.acceptance_text,
      };
    });

    setRows(result);
    setLoading(false);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'assinado': return <Badge className="bg-green-100 text-green-800">Assinado</Badge>;
      case 'recusado': return <Badge className="bg-red-100 text-red-800">Recusado</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalSigs}</div>
            <p className="text-xs text-muted-foreground">Total de assinaturas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{signedCount}</div>
            <p className="text-xs text-muted-foreground">Assinados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{progress}%</div>
            <Progress value={progress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Signature Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Assinaturas
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Status:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="assinado">Assinado</SelectItem>
                  <SelectItem value="recusado">Recusado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Mês:</Label>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma assinatura encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Assinado em</TableHead>
                  <TableHead>Via</TableHead>
                  <TableHead className="text-center">PIN</TableHead>
                  <TableHead className="text-center">Evidências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.documentTitle}</TableCell>
                    <TableCell>{docTypeLabels[r.documentType] || r.documentType}</TableCell>
                    <TableCell>{r.employeeName}</TableCell>
                    <TableCell className="text-center">{statusBadge(r.status)}</TableCell>
                    <TableCell>
                      {r.signedAt ? format(new Date(r.signedAt), 'dd/MM/yyyy HH:mm') : '-'}
                    </TableCell>
                    <TableCell>{r.signedVia || '-'}</TableCell>
                    <TableCell className="text-center">
                      {r.pinVerified ? <Badge className="bg-green-100 text-green-800">✓</Badge> : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.status === 'assinado' && r.documentHash ? (
                        <Button size="sm" variant="ghost" onClick={() => setDetailRow(r)}>
                          <Eye className="w-3 h-3 mr-1" /> Ver
                        </Button>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Signature Evidence Dialog */}
      <Dialog open={!!detailRow} onOpenChange={() => setDetailRow(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Comprovante de Assinatura Digital
            </DialogTitle>
          </DialogHeader>
          {detailRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Documento:</span></div>
                <div className="font-medium">{detailRow.documentTitle}</div>
                <div><span className="text-muted-foreground">Colaborador:</span></div>
                <div className="font-medium">{detailRow.employeeName}</div>
                <div><span className="text-muted-foreground">Assinado em:</span></div>
                <div>{detailRow.signedAt ? format(new Date(detailRow.signedAt), 'dd/MM/yyyy HH:mm:ss') : '-'}</div>
                <div><span className="text-muted-foreground">Via:</span></div>
                <div>{detailRow.signedVia || '-'}</div>
                <div><span className="text-muted-foreground">PIN verificado:</span></div>
                <div>{detailRow.pinVerified ? '✓ Sim' : '✗ Não'}</div>
                <div><span className="text-muted-foreground">IP:</span></div>
                <div className="font-mono text-xs">{detailRow.ipAddress || '-'}</div>
                <div><span className="text-muted-foreground">User-Agent:</span></div>
                <div className="font-mono text-xs break-all">{detailRow.userAgent || '-'}</div>
              </div>

              <div className="border-t pt-3">
                <p className="text-muted-foreground mb-1">Hash SHA-256 do documento:</p>
                <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                  {detailRow.documentHash || '-'}
                </p>
              </div>

              {detailRow.acceptanceText && (
                <div className="border-t pt-3">
                  <p className="text-muted-foreground mb-1">Termo de aceite registrado:</p>
                  <p className="text-xs bg-muted p-2 rounded leading-relaxed">
                    {detailRow.acceptanceText}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
