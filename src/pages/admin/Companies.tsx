import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Power, PowerOff, Loader2, Building2 } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';

interface Company {
  id: string;
  nome: string;
  cnpj_hash: string | null;
  ativo: boolean;
  created_at: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({ nome: '', cnpj: '' });
  const [formLoading, setFormLoading] = useState(false);
  const { toast } = useToast();
  const { isSuperAdmin, refreshCompanies } = useCompany();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, nome, cnpj_hash, ativo, created_at')
        .order('nome');
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar empresas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setFormData({ nome: company.nome, cnpj: '' });
    } else {
      setEditingCompany(null);
      setFormData({ nome: '', cnpj: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (editingCompany) {
        const { error } = await supabase
          .from('companies')
          .update({ nome: formData.nome })
          .eq('id', editingCompany.id);
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Empresa atualizada' });
      } else {
        // Hash CNPJ if provided
        let cnpjHash: string | null = null;
        if (formData.cnpj) {
          const encoder = new TextEncoder();
          const data = encoder.encode(formData.cnpj.replace(/\D/g, ''));
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          cnpjHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        const { error } = await supabase
          .from('companies')
          .insert({ nome: formData.nome, cnpj_hash: cnpjHash });
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Empresa cadastrada' });
      }
      setIsDialogOpen(false);
      loadCompanies();
      refreshCompanies();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar empresa', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  };

  const toggleStatus = async (company: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ ativo: !company.ativo })
        .eq('id', company.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: `Empresa ${company.ativo ? 'desativada' : 'ativada'}` });
      loadCompanies();
      refreshCompanies();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({ title: 'Erro', description: 'Erro ao alterar status', variant: 'destructive' });
    }
  };

  if (!isSuperAdmin) {
    return (
      <AdminLayout currentPage="companies">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito a super administradores.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPage="companies">
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCompany ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Empresa *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                {!editingCompany && (
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingCompany ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Empresas ({companies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma empresa cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.nome}</TableCell>
                        <TableCell>
                          <Badge variant={company.ativo ? 'default' : 'secondary'}>
                            {company.ativo ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(company.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(company)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleStatus(company)}
                            >
                              {company.ativo ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
