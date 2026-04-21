import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, GripVertical, Image as ImageIcon } from 'lucide-react';

type ItemType = 'foto_ia' | 'sim_nao';

interface Checklist {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface Item {
  id: string;
  ordem: number;
  tipo: ItemType;
  descricao: string;
  criterios_ia: string | null;
  foto_modelo_url: string | null;
}

export default function ChecklistEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<{ tipo: ItemType; descricao: string; criterios_ia: string }>({
    tipo: 'foto_ia', descricao: '', criterios_ia: ''
  });

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: c }, { data: its }] = await Promise.all([
      supabase.from('checklists').select('*').eq('id', id).maybeSingle(),
      supabase.from('checklist_items').select('*').eq('checklist_id', id).order('ordem', { ascending: true }),
    ]);
    setChecklist(c as any);
    setItems((its || []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const openNew = () => {
    setEditing(null);
    setForm({ tipo: 'foto_ia', descricao: '', criterios_ia: '' });
    setOpen(true);
  };
  const openEdit = (it: Item) => {
    setEditing(it);
    setForm({ tipo: it.tipo, descricao: it.descricao, criterios_ia: it.criterios_ia || '' });
    setOpen(true);
  };

  const save = async () => {
    if (!id) return;
    if (!form.descricao.trim()) { toast({ title: 'Descrição obrigatória', variant: 'destructive' }); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('checklist_items').update({
        tipo: form.tipo,
        descricao: form.descricao,
        criterios_ia: form.criterios_ia || null,
      }).eq('id', editing.id);
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else toast({ title: 'Item atualizado' });
    } else {
      const nextOrdem = items.length;
      const { error } = await supabase.from('checklist_items').insert({
        checklist_id: id,
        ordem: nextOrdem,
        tipo: form.tipo,
        descricao: form.descricao,
        criterios_ia: form.criterios_ia || null,
      });
      if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      else toast({ title: 'Item adicionado' });
    }
    setSaving(false);
    setOpen(false);
    load();
  };

  const removeItem = async (it: Item) => {
    if (!confirm('Remover este item?')) return;
    const { error } = await supabase.from('checklist_items').delete().eq('id', it.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Removido' }); load(); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const swap = idx + dir;
    if (swap < 0 || swap >= items.length) return;
    const a = items[idx], b = items[swap];
    await Promise.all([
      supabase.from('checklist_items').update({ ordem: b.ordem }).eq('id', a.id),
      supabase.from('checklist_items').update({ ordem: a.ordem }).eq('id', b.id),
    ]);
    load();
  };

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        {loading || !checklist ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {checklist.nome}
                  <Badge variant={checklist.ativo ? 'default' : 'secondary'}>{checklist.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </CardTitle>
                {checklist.descricao && <p className="text-sm text-muted-foreground">{checklist.descricao}</p>}
              </CardHeader>
            </Card>

            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Itens</h2>
              <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Adicionar item</Button>
            </div>

            {items.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                Nenhum item ainda. Adicione o primeiro.
              </CardContent></Card>
            ) : (
              <div className="grid gap-2">
                {items.map((it, idx) => (
                  <Card key={it.id}>
                    <CardContent className="py-3 flex items-center gap-3">
                      <div className="flex flex-col">
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => move(idx, -1)} aria-label="Subir">▲</button>
                        <button className="text-muted-foreground hover:text-foreground" onClick={() => move(idx, 1)} aria-label="Descer">▼</button>
                      </div>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{idx + 1}. {it.descricao}</span>
                          <Badge variant="outline">
                            {it.tipo === 'foto_ia' ? <><ImageIcon className="w-3 h-3 mr-1" /> Foto + IA</> : 'Sim/Não'}
                          </Badge>
                        </div>
                        {it.criterios_ia && (
                          <p className="text-xs text-muted-foreground mt-1">Critérios IA: {it.criterios_ia}</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(it)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(it)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar item' : 'Novo item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as ItemType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="foto_ia">Foto avaliada por IA</SelectItem>
                    <SelectItem value="sim_nao">Pergunta sim/não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Descrição / pergunta</Label>
                <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2}
                  placeholder={form.tipo === 'foto_ia' ? 'Ex: Foto da bancada limpa' : 'Ex: O frigobar está organizado?'} />
              </div>
              {form.tipo === 'foto_ia' && (
                <div>
                  <Label>Critérios para a IA</Label>
                  <Textarea value={form.criterios_ia} onChange={(e) => setForm({ ...form, criterios_ia: e.target.value })} rows={4}
                    placeholder="Descreva em linguagem natural o que a IA deve verificar. Ex: a bancada deve estar sem panos, copos ou louça suja; superfícies visíveis e secas." />
                </div>
              )}
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
    </AdminLayout>
  );
}
