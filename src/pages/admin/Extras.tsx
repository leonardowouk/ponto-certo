import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Clock, Eye, FileUp, Loader2, Receipt, UserPlus } from 'lucide-react';

type ExtraPerson = {
  id: string;
  nome_completo: string;
  cpf_last4: string | null;
  foto_url: string | null;
};

type ExtraRecord = {
  id: string;
  record_date: string;
  entrada_at: string;
  saida_intervalo_at: string | null;
  retorno_intervalo_at: string | null;
  saida_at: string | null;
  total_minutes: number | null;
  entrada_foto_url: string | null;
  saida_foto_url: string | null;
  saida_intervalo_foto_url: string | null;
  retorno_intervalo_foto_url: string | null;
  comprovante_pagamento_url: string | null;
  observacao_admin: string | null;
  extra_people?: ExtraPerson;
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes: number | null | undefined) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function cleanStoragePath(path: string, bucket: string) {
  return path.replace(new RegExp(`^${bucket}/`), '');
}

export default function Extras() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const [records, setRecords] = useState<ExtraRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterPersonId, setFilterPersonId] = useState<string>('all');
  const [extraPeople, setExtraPeople] = useState<ExtraPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<ExtraPerson | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    let query = (supabase as any)
      .from('extra_time_records')
      .select('*, extra_people(id, nome_completo, cpf_last4, foto_url)')
      .eq('company_id', selectedCompanyId)
      .order('record_date', { ascending: false })
      .order('entrada_at', { ascending: false });

    if (filterDate) query = query.eq('record_date', filterDate);

    const { data, error } = await query;
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      setRecords([]);
    } else {
      setRecords((data || []) as ExtraRecord[]);
    }
    setLoading(false);
  };

  // Load extra people list
  const loadPeople = async () => {
    if (!selectedCompanyId) return;
    const { data } = await (supabase as any)
      .from('extra_people')
      .select('id, nome_completo, cpf_last4, foto_url')
      .eq('company_id', selectedCompanyId)
      .order('nome_completo');
    setExtraPeople((data || []) as ExtraPerson[]);
  };

  useEffect(() => { load(); loadPeople(); }, [selectedCompanyId, filterDate]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => {
      const name = record.extra_people?.nome_completo?.toLowerCase() || '';
      const cpf = record.extra_people?.cpf_last4 || '';
      return name.includes(term) || cpf.includes(term);
    });
  }, [records, search]);

  const personRecords = useMemo(() => {
    if (!selectedPerson) return [];
    return records.filter(r => r.extra_people?.id === selectedPerson.id);
  }, [records, selectedPerson]);

  const totalsByPerson = useMemo(() => {
    return filtered.reduce<Record<string, number>>((acc, record) => {
      const id = record.extra_people?.id;
      if (!id) return acc;
      acc[id] = (acc[id] || 0) + (record.total_minutes || 0);
      return acc;
    }, {});
  }, [filtered]);

  useEffect(() => {
    const paths: Array<{ key: string; bucket: string; path: string }> = [];
    filtered.forEach((record) => {
      if (record.entrada_foto_url) paths.push({ key: `${record.id}:entrada`, bucket: 'extra_fotos', path: record.entrada_foto_url });
      if (record.saida_foto_url) paths.push({ key: `${record.id}:saida`, bucket: 'extra_fotos', path: record.saida_foto_url });
      if (record.comprovante_pagamento_url) paths.push({ key: `${record.id}:comprovante`, bucket: 'extra_comprovantes', path: record.comprovante_pagamento_url });
    });

    if (paths.length === 0) {
      setSignedUrls({});
      return;
    }

    let cancelled = false;
    Promise.all(paths.map(async ({ key, bucket, path }) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrl(cleanStoragePath(path, bucket), 3600);
      return [key, data?.signedUrl || ''] as const;
    })).then((entries) => {
      if (!cancelled) setSignedUrls(Object.fromEntries(entries.filter(([, url]) => !!url)));
    });

    return () => { cancelled = true; };
  }, [filtered]);

  const uploadProof = async (record: ExtraRecord, file: File | undefined) => {
    if (!file || !selectedCompanyId) return;
    setUploadingId(record.id);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const path = `${selectedCompanyId}/${record.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('extra_comprovantes')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
      if (uploadError) throw uploadError;

      const { error: updateError } = await (supabase as any)
        .from('extra_time_records')
        .update({ comprovante_pagamento_url: `extra_comprovantes/${path}` })
        .eq('id', record.id);
      if (updateError) throw updateError;

      toast({ title: 'Comprovante anexado' });
      await load();
    } catch (error: any) {
      toast({ title: 'Erro ao anexar', description: error.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setUploadingId(null);
    }
  };

  /** Determines which step is the "next" punch for a record */
  function getRecordStatus(record: ExtraRecord) {
    if (!record.saida_intervalo_at) return 'Aguardando saída intervalo';
    if (!record.retorno_intervalo_at) return 'Aguardando retorno intervalo';
    if (!record.saida_at) return 'Aguardando saída final';
    return 'Completo';
  }

  return (
    <AdminLayout currentPage="extras">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Extras</h2>
            <p className="text-sm text-muted-foreground">Presenças esporádicas registradas no quiosque.</p>
          </div>
          <Badge variant="outline" className="h-9 px-3">
            <Clock className="w-4 h-4 mr-2" />
            {formatMinutes(filtered.reduce((sum, r) => sum + (r.total_minutes || 0), 0))}
          </Badge>
        </div>

        <Card>
          <CardContent className="py-3 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            <div className="min-w-[260px]">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome ou final do CPF" />
            </div>
            <Button variant="outline" onClick={() => { setFilterDate(''); setSearch(''); }}>Limpar</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4" /> Registros de extras
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">Nenhum extra encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída Int.</TableHead>
                    <TableHead>Retorno Int.</TableHead>
                    <TableHead>Saída Final</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comprovante</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="font-medium">{record.extra_people?.nome_completo}</div>
                        <div className="text-xs text-muted-foreground">CPF final {record.extra_people?.cpf_last4 || '—'} · Total filtrado {formatMinutes(totalsByPerson[record.extra_people?.id || ''])}</div>
                      </TableCell>
                      <TableCell>{formatDate(record.record_date)}</TableCell>
                      <TableCell>{formatTime(record.entrada_at)}</TableCell>
                      <TableCell>{formatTime(record.saida_intervalo_at)}</TableCell>
                      <TableCell>{formatTime(record.retorno_intervalo_at)}</TableCell>
                      <TableCell>{formatTime(record.saida_at)}</TableCell>
                      <TableCell className="font-mono">{formatMinutes(record.total_minutes)}</TableCell>
                      <TableCell>
                        <Badge variant={record.saida_at ? 'default' : 'secondary'} className="text-xs whitespace-nowrap">
                          {getRecordStatus(record)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {signedUrls[`${record.id}:comprovante`] ? (
                          <a className="text-primary text-xs underline inline-flex items-center gap-1" href={signedUrls[`${record.id}:comprovante`]} target="_blank" rel="noreferrer">
                            <Receipt className="w-3 h-3" /> Ver
                          </a>
                        ) : <span className="text-xs text-muted-foreground">Sem anexo</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {record.extra_people && (
                            <Button variant="outline" size="sm" onClick={() => setSelectedPerson(record.extra_people!)}>
                              <Eye className="w-4 h-4 mr-1" /> Histórico
                            </Button>
                          )}
                          <label className="inline-flex">
                            <input className="hidden" type="file" accept="application/pdf,image/*" onChange={e => uploadProof(record, e.target.files?.[0])} />
                            <Button asChild variant="outline" size="sm" disabled={uploadingId === record.id}>
                              <span>
                                {uploadingId === record.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileUp className="w-4 h-4 mr-1" />}
                                Anexar
                              </span>
                            </Button>
                          </label>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedPerson} onOpenChange={(open) => !open && setSelectedPerson(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>{selectedPerson?.nome_completo}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="w-4 h-4" /> Histórico do período carregado
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída Int.</TableHead>
                    <TableHead>Retorno Int.</TableHead>
                    <TableHead>Saída Final</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personRecords.map(record => (
                    <TableRow key={record.id}>
                      <TableCell>{formatDate(record.record_date)}</TableCell>
                      <TableCell>{formatTime(record.entrada_at)}</TableCell>
                      <TableCell>{formatTime(record.saida_intervalo_at)}</TableCell>
                      <TableCell>{formatTime(record.retorno_intervalo_at)}</TableCell>
                      <TableCell>{formatTime(record.saida_at)}</TableCell>
                      <TableCell className="font-mono">{formatMinutes(record.total_minutes)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
