import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

const DAYS: { key: keyof WeeklyDays; label: string }[] = [
  { key: 'mon', label: 'Seg' }, { key: 'tue', label: 'Ter' }, { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' }, { key: 'fri', label: 'Sex' }, { key: 'sat', label: 'Sáb' }, { key: 'sun', label: 'Dom' },
];

interface WeeklyDays { mon: boolean; tue: boolean; wed: boolean; thu: boolean; fri: boolean; sat: boolean; sun: boolean; }

interface Agendamento {
  id: string;
  checklist_id: string;
  hora: string;
  weekly_days: WeeklyDays;
  ativo: boolean;
  checklists?: { nome: string };
  checklist_agendamento_employees: { employee_id: string; employees?: { nome: string } }[];
}

export default function ChecklistAgendamentos() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Agendamento[]>([]);
  const [checklists, setChecklists] = useState<{ id: string; nome: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Agendamento | null>(null);
  const [form, setForm] = useState<{ checklist_id: string; hora: string; weekly_days: WeeklyDays; ativo: boolean; employee_ids: string[] }>({
    checklist_id: '', hora: '08:00',
    weekly_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    ativo: true, employee_ids: [],
  });

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    const [{ data: ag }, { data: cks }, { data: emps }] = await Promise.all([
      supabase.from('checklist_agendamentos')
        .select('*, checklists(nome), checklist_agendamento_employees(employee_id, employees(nome))')
        .eq('company_id', selectedCompanyId).order('hora'),
      supabase.from('checklists').select('id, nome').eq('company_id', selectedCompanyId).eq('ativo', true).order('nome'),
      supabase.from('employees').select('id, nome').eq('company_id', selectedCompanyId).eq('ativo', true).order('nome'),
    ]);
    setItems((ag || []) as any);
    setChecklists(cks || []);
    setEmployees(emps || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [selectedCompanyId]);

  const openNew = () => {
    setEditing(null);
    setForm({
      checklist_id: '', hora: '08:00',
      weekly_days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
      ativo: true, employee_ids: [],
    });
    setOpen(true);
  };
  const openEdit = (a: Agendamento) => {
    setEditing(a);
    setForm({
      checklist_id: a.checklist_id,
      hora: a.hora.slice(0, 5),
      weekly_days: a.weekly_days,
      ativo: a.ativo,
      employee_ids: a.checklist_agendamento_employees.map(e => e.employee_id),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!selectedCompanyId) return;
    if (!form.checklist_id) { toast({ title: 'Selecione um checklist', variant: 'destructive' }); return; }
    setSaving(true);
    let agId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('checklist_agendamentos').update({
        checklist_id: form.checklist_id,
        hora: form.hora + ':00',
        weekly_days: form.weekly_days as any,
        ativo: form.ativo,
      }).eq('id', editing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('checklist_agendamentos').insert({
        company_id: selectedCompanyId,
        checklist_id: form.checklist_id,
        hora: form.hora + ':00',
        weekly_days: form.weekly_days as any,
        ativo: form.ativo,
      }).select().single();
      if (error || !data) { toast({ title: 'Erro', description: error?.message, variant: 'destructive' }); setSaving(false); return; }
      agId = data.id;
    }

    if (agId) {
      // Replace employees: simples — apaga e reinsere
      await supabase.from('checklist_agendamento_employees').delete().eq('agendamento_id', agId);
      if (form.employee_ids.length > 0) {
        const rows = form.employee_ids.map(eid => ({ agendamento_id: agId!, employee_id: eid }));
        const { error: e2 } = await supabase.from('checklist_agendamento_employees').insert(rows);
        if (e2) toast({ title: 'Erro vínculos', description: e2.message, variant: 'destructive' });
      }
    }
    toast({ title: 'Salvo' });
    setSaving(false); setOpen(false); load();
  };

  const remove = async (a: Agendamento) => {
    if (!confirm('Remover este agendamento?')) return;
    const { error } = await supabase.from('checklist_agendamentos').delete().eq('id', a.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else load();
  };

  const toggleEmp = (id: string, checked: boolean) => {
    setForm(f => ({ ...f, employee_ids: checked ? [...f.employee_ids, id] : f.employee_ids.filter(x => x !== id) }));
  };

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo agendamento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Checklist</Label>
                  <Select value={form.checklist_id} onValueChange={(v) => setForm({ ...form, checklist_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {checklists.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Hora</Label>
                  <Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
                </div>
                <div>
                  <Label>Dias da semana</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DAYS.map(d => (
                      <label key={d.key} className="flex items-center gap-1 px-2 py-1 border rounded cursor-pointer">
                        <Checkbox checked={form.weekly_days[d.key]} onCheckedChange={(v) => setForm({ ...form, weekly_days: { ...form.weekly_days, [d.key]: !!v } })} />
                        <span className="text-sm">{d.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Colaboradores participantes</Label>
                  <div className="max-h-48 overflow-auto border rounded p-2 space-y-1">
                    {employees.length === 0 && <p className="text-sm text-muted-foreground">Nenhum colaborador ativo.</p>}
                    {employees.map(e => (
                      <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={form.employee_ids.includes(e.id)} onCheckedChange={(v) => toggleEmp(e.id, !!v)} />
                        <span className="text-sm">{e.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum agendamento ainda.</CardContent></Card>
        ) : (
          <div className="grid gap-2">
            {items.map(a => (
              <Card key={a.id}>
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{a.checklists?.nome}</span>
                      <Badge variant="outline">{a.hora.slice(0, 5)}</Badge>
                      <Badge variant={a.ativo ? 'default' : 'secondary'}>{a.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      {DAYS.filter(d => a.weekly_days[d.key]).map(d => (
                        <Badge key={d.key} variant="outline" className="text-xs">{d.label}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.checklist_agendamento_employees.length} colaborador(es): {a.checklist_agendamento_employees.map(e => e.employees?.nome).filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
