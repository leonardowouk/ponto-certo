import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { ArrowLeft, Loader2, FileText, Clock } from 'lucide-react';

interface Employee {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  data_nascimento: string | null;
  matricula: string | null;
  tipo_contrato: string | null;
  situacao: string | null;
  admission_status: string | null;
  ativo: boolean;
  auth_user_id: string | null;
  company_id: string | null;
  sectors?: { nome: string } | null;
}

interface DocRow {
  id: string;
  title: string;
  document_type: string;
  created_at: string | null;
  requires_signature: boolean | null;
  ref_month: string | null;
}

interface AuditRow {
  id: string;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  result: string;
  created_at: string;
}

interface PunchRow {
  id: string;
  punched_at: string | null;
  punch_type: string;
  unidade: string;
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v.length <= 10 ? `${v}T12:00:00` : v).toLocaleDateString('pt-BR') : '—';

const fmtDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || '—'}</p>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [punches, setPunches] = useState<PunchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const [emp, docRes, auditRes, punchRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, nome, email, telefone, cargo, setor, data_admissao, data_nascimento, matricula, tipo_contrato, situacao, admission_status, ativo, auth_user_id, company_id, sectors(nome)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('employee_documents')
          .select('id, title, document_type, created_at, requires_signature, ref_month')
          .eq('employee_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_logs')
          .select('id, action, actor_name, actor_role, result, created_at')
          .eq('employee_id', id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('time_punches')
          .select('id, punched_at, punch_type, unidade')
          .eq('employee_id', id)
          .order('punched_at', { ascending: false })
          .limit(20),
      ]);

      setEmployee(emp.data ? { ...emp.data, sectors: emp.data.sectors as { nome: string } | null } : null);
      setDocs(docRes.data || []);
      setAudit(auditRes.data || []);
      setPunches(punchRes.data || []);
      setLoading(false);
    };
    load();
  }, [id]);

  const holerites = docs.filter(d => d.document_type === 'holerite');
  const outros = docs.filter(d => d.document_type !== 'holerite');

  if (loading) {
    return (
      <AdminLayout currentPage="employees">
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </AdminLayout>
    );
  }

  if (!employee) {
    return (
      <AdminLayout currentPage="employees">
        <p className="text-muted-foreground">Colaborador não encontrado.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="employees">
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/employees')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{employee.nome}</h2>
            <p className="text-sm text-muted-foreground">
              {employee.cargo || 'Sem cargo'} · {employee.sectors?.nome || employee.setor || 'Sem setor'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={employee.admission_status || (employee.ativo ? 'ativo' : 'inativo')} />
            <span className="text-xs text-muted-foreground">
              {employee.auth_user_id ? 'Acesso ativo' : 'Sem acesso ao portal'}
            </span>
          </div>
        </div>

        <Tabs defaultValue="pessoais">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="pessoais">Dados pessoais</TabsTrigger>
            <TabsTrigger value="profissionais">Dados profissionais</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="admissao">Admissão</TabsTrigger>
            <TabsTrigger value="holerites">Holerites</TabsTrigger>
            <TabsTrigger value="ponto">Ponto</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="pessoais">
            <Card>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-6">
                <Field label="Nome completo" value={employee.nome} />
                <Field label="Data de nascimento" value={fmtDate(employee.data_nascimento)} />
                <Field label="E-mail" value={employee.email} />
                <Field label="Telefone" value={employee.telefone} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profissionais">
            <Card>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-6">
                <Field label="Cargo" value={employee.cargo} />
                <Field label="Setor / Departamento" value={employee.sectors?.nome || employee.setor} />
                <Field label="Matrícula" value={employee.matricula} />
                <Field label="Data de admissão" value={fmtDate(employee.data_admissao)} />
                <Field label="Tipo de contrato" value={employee.tipo_contrato} />
                <Field label="Situação" value={employee.ativo ? 'Ativo' : 'Inativo'} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentos">
            <Card>
              <CardHeader><CardTitle className="text-base">Documentos ({outros.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {outros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento.</p>}
                {outros.map(d => (
                  <div key={d.id} className="flex items-center gap-3 border rounded-lg p-3">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.document_type} · {fmtDate(d.created_at)}
                      </p>
                    </div>
                    {d.requires_signature && <StatusBadge status="pendente" />}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/documents')}>
                  Abrir módulo de documentos
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admissao">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Field label="Status da admissão" value={employee.admission_status} />
                <Field label="Data de admissão" value={fmtDate(employee.data_admissao)} />
                <p className="text-sm text-muted-foreground">
                  O processo de admissão digital com envio e assinatura dos documentos da contabilidade
                  será habilitado na próxima etapa.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holerites">
            <Card>
              <CardHeader><CardTitle className="text-base">Holerites ({holerites.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {holerites.length === 0 && <p className="text-sm text-muted-foreground">Nenhum holerite disponibilizado.</p>}
                {holerites.map(d => (
                  <div key={d.id} className="flex items-center gap-3 border rounded-lg p-3">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Competência: {d.ref_month ? fmtDate(d.ref_month) : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ponto">
            <Card>
              <CardHeader><CardTitle className="text-base">Últimas batidas</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {punches.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma batida registrada.</p>}
                {punches.map(p => (
                  <div key={p.id} className="flex items-center gap-3 border rounded-lg p-3">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{fmtDateTime(p.punched_at)}</p>
                      <p className="text-xs text-muted-foreground">{p.punch_type} · {p.unidade}</p>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/timesheet')}>
                  Abrir espelho de ponto
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico">
            <Card>
              <CardHeader><CardTitle className="text-base">Histórico de ações</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {audit.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
                {audit.map(a => (
                  <div key={a.id} className="border rounded-lg p-3">
                    <p className="text-sm font-medium">{a.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actor_name || 'Sistema'} {a.actor_role ? `(${a.actor_role})` : ''} · {fmtDateTime(a.created_at)} · {a.result}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
