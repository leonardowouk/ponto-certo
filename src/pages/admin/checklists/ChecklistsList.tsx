import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Loader2, ListChecks, CalendarClock, ClipboardList, LayoutDashboard, AlertCircle, Bell } from 'lucide-react';

interface Checklist {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export default function ChecklistsList() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Checklist | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '', ativo: true });

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('checklists')
      .select('*')
      .eq('company_id', selectedCompanyId)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [selectedCompanyId]);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', descricao: '', ativo: true });
    setOpen(true);
  };

  const openEdit = (c: Checklist) => {
    setEditing(c);
    setForm({ nome: c.nome, descricao: c.descricao || '', ativo: c.ativo });
    setOpen(true);
  };

  const save = async () => {
    if (!selectedCompanyId) return;
    if (!form.nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('checklists')
        .update({ nome: form.nome, descricao: form.descricao || null, ativo: form.ativo })
        .eq('id', editing.id);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else toast({ title: 'Atualizado' });
    } else {
      const { data, error } = await supabase
        .from('checklists')
        .insert({ company_id: selectedCompanyId, nome: form.nome, descricao: form.descricao || null, ativo: form.ativo })
        .select()
        .single();
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else {
        toast({ title: 'Criado' });
        setOpen(false);
        setSaving(false);
        if (data) navigate(`/admin/checklists/${data.id}`);
        return;
      }
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={() => navigate('/admin/checklists/dashboard')}>
            <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard do dia
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/checklists/agendamentos')}>
            <CalendarClock className="w-4 h-4 mr-2" /> Agendamentos
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/checklists/execucoes')}>
            <ClipboardList className="w-4 h-4 mr-2" /> Execuções
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/checklists/revisao')}>
            <AlertCircle className="w-4 h-4 mr-2" /> Fila de revisão
          </Button>
          <Button variant="outline" onClick={() => navigate('/admin/checklists/notificacoes')}>
            <Bell className="w-4 h-4 mr-2" /> Notificações
          </Button>
          <div className="ml-auto">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo checklist</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Editar checklist' : 'Novo checklist'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Abertura da loja" />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
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
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-50" />
            Nenhum checklist criado ainda.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {items.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:bg-accent/40 transition" onClick={() => navigate(`/admin/checklists/${c.id}`)}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{c.nome}</h3>
                      <Badge variant={c.ativo ? 'default' : 'secondary'}>{c.ativo ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    {c.descricao && <p className="text-sm text-muted-foreground mt-1">{c.descricao}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
