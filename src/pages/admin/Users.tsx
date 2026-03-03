import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Shield, Search } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  roles: string[];
  companies: { company_id: string; nome: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  rh: 'RH',
  gestor: 'Gestor',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-destructive text-destructive-foreground',
  admin: 'bg-primary text-primary-foreground',
  rh: 'bg-secondary text-secondary-foreground',
  gestor: 'bg-accent text-accent-foreground',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const { toast } = useToast();
  const { companies, isSuperAdmin } = useCompany();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'admin',
    company_ids: [] as string[],
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'list' },
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar usuários', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData({ email: '', password: '', role: 'admin', company_ids: [] });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      role: user.roles[0] || 'admin',
      company_ids: user.companies.map(c => c.company_id),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingUser) {
        const { error } = await supabase.functions.invoke('manage-admin-users', {
          body: {
            action: 'update',
            user_id: editingUser.id,
            role: formData.role,
            company_ids: formData.role === 'super_admin' ? [] : formData.company_ids,
          },
        });
        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Usuário atualizado' });
      } else {
        if (!formData.email || !formData.password) {
          toast({ title: 'Erro', description: 'Preencha email e senha', variant: 'destructive' });
          setFormLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('manage-admin-users', {
          body: {
            action: 'create',
            email: formData.email,
            password: formData.password,
            role: formData.role,
            company_ids: formData.role === 'super_admin' ? [] : formData.company_ids,
          },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        toast({ title: 'Sucesso', description: 'Usuário criado' });
      }

      setIsDialogOpen(false);
      loadUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({ title: 'Erro', description: error.message || 'Erro ao salvar usuário', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const { data, error } = await supabase.functions.invoke('manage-admin-users', {
        body: { action: 'delete', user_id: deleteUser.id },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: 'Sucesso', description: 'Usuário removido' });
      setDeleteUser(null);
      loadUsers();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao remover', variant: 'destructive' });
    }
  };

  const toggleCompany = (companyId: string) => {
    setFormData(prev => ({
      ...prev,
      company_ids: prev.company_ids.includes(companyId)
        ? prev.company_ids.filter(id => id !== companyId)
        : [...prev.company_ids, companyId],
    }));
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.roles.some(r => ROLE_LABELS[r]?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <AdminLayout currentPage="users">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum usuário administrativo encontrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Empresas</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        {user.roles.map(role => (
                          <Badge key={role} className={`mr-1 ${ROLE_COLORS[role] || ''}`}>
                            {ROLE_LABELS[role] || role}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell>
                        {user.roles.includes('super_admin') ? (
                          <span className="text-sm text-muted-foreground italic">Todas</span>
                        ) : user.companies.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">Nenhuma</span>
                        ) : (
                          user.companies.map(c => (
                            <Badge key={c.company_id} variant="outline" className="mr-1">
                              {c.nome}
                            </Badge>
                          ))
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(user)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteUser(user)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {editingUser ? 'Editar Usuário' : 'Novo Usuário Administrativo'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-email">E-mail *</Label>
              <Input
                id="user-email"
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editingUser}
                required={!editingUser}
              />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="user-password">Senha *</Label>
                <Input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Papel *</Label>
              <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {formData.role !== 'super_admin' && (
              <div className="space-y-2">
                <Label>Empresas com acesso</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {companies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma empresa cadastrada</p>
                  ) : (
                    companies.map(company => (
                      <div key={company.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`company-${company.id}`}
                          checked={formData.company_ids.includes(company.id)}
                          onCheckedChange={() => toggleCompany(company.id)}
                        />
                        <label htmlFor={`company-${company.id}`} className="text-sm cursor-pointer">
                          {company.nome}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingUser ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{deleteUser?.email}</strong> perderá todo o acesso ao painel administrativo. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
