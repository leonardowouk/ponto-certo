import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, UserX, UserCheck, Loader2, Search } from 'lucide-react';
import { hashCPF, formatCPF, validateCPF } from '@/lib/hash';

interface Employee {
  id: string;
  nome: string;
  cpf_hash: string;
  ativo: boolean;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  created_at: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    pin: '',
    cargo: '',
    setor: '',
    data_admissao: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome, cpf_hash, ativo, cargo, setor, data_admissao, created_at')
        .order('nome');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar colaboradores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        nome: employee.nome,
        cpf: '',
        pin: '',
        cargo: employee.cargo || '',
        setor: employee.setor || '',
        data_admissao: employee.data_admissao || '',
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        nome: '',
        cpf: '',
        pin: '',
        cargo: '',
        setor: '',
        data_admissao: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingEmployee) {
        // Update existing
        const updateData: Record<string, unknown> = {
          nome: formData.nome,
          cargo: formData.cargo || null,
          setor: formData.setor || null,
          data_admissao: formData.data_admissao || null,
        };

        // Se informou novo PIN, gera novo hash
        if (formData.pin) {
          // Em produção, o hash deveria ser feito no backend
          // Aqui usamos uma função simplificada para demo
          const { data: hashData } = await supabase.functions.invoke('hash-pin', {
            body: { pin: formData.pin },
          });
          if (hashData?.pin_hash) {
            updateData.pin_hash = hashData.pin_hash;
          }
        }

        const { error } = await supabase
          .from('employees')
          .update(updateData)
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast({ title: 'Sucesso', description: 'Colaborador atualizado' });
      } else {
        // Create new
        if (!validateCPF(formData.cpf)) {
          toast({ title: 'Erro', description: 'CPF inválido', variant: 'destructive' });
          setFormLoading(false);
          return;
        }

        if (formData.pin.length !== 6 || !/^\d+$/.test(formData.pin)) {
          toast({ title: 'Erro', description: 'PIN deve ter 6 dígitos', variant: 'destructive' });
          setFormLoading(false);
          return;
        }

        // Hash CPF e PIN
        const cpfHash = await hashCPF(formData.cpf);
        
        // Gerar hash do PIN via edge function
        const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-pin', {
          body: { pin: formData.pin },
        });

        if (hashError || !hashData?.pin_hash) {
          toast({ title: 'Erro', description: 'Erro ao processar PIN', variant: 'destructive' });
          setFormLoading(false);
          return;
        }

        const { error } = await supabase
          .from('employees')
          .insert({
            nome: formData.nome,
            cpf_hash: cpfHash,
            pin_hash: hashData.pin_hash,
            cargo: formData.cargo || null,
            setor: formData.setor || null,
            data_admissao: formData.data_admissao || null,
          });

        if (error) {
          if (error.message.includes('duplicate')) {
            toast({ title: 'Erro', description: 'CPF já cadastrado', variant: 'destructive' });
          } else {
            throw error;
          }
          setFormLoading(false);
          return;
        }

        toast({ title: 'Sucesso', description: 'Colaborador cadastrado' });
      }

      setIsDialogOpen(false);
      loadEmployees();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar colaborador', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ ativo: !employee.ativo })
        .eq('id', employee.id);

      if (error) throw error;
      
      toast({ 
        title: 'Sucesso', 
        description: `Colaborador ${employee.ativo ? 'desativado' : 'ativado'}` 
      });
      loadEmployees();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({ title: 'Erro', description: 'Erro ao alterar status', variant: 'destructive' });
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.setor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout currentPage="employees">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEmployee ? 'Editar Colaborador' : 'Novo Colaborador'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                {!editingEmployee && (
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                      placeholder="000.000.000-00"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="pin">
                    PIN (6 dígitos) {editingEmployee ? '(deixe em branco para manter)' : '*'}
                  </Label>
                  <Input
                    id="pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="••••••"
                    required={!editingEmployee}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cargo">Cargo</Label>
                    <Input
                      id="cargo"
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="setor">Setor</Label>
                    <Input
                      id="setor"
                      value={formData.setor}
                      onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_admissao">Data de Admissão</Label>
                  <Input
                    id="data_admissao"
                    type="date"
                    value={formData.data_admissao}
                    onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={formLoading} className="flex-1">
                    {formLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingEmployee ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Colaboradores ({filteredEmployees.length})</CardTitle>
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
                    <TableHead>Cargo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admissão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum colaborador encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.nome}</TableCell>
                        <TableCell>{employee.cargo || '-'}</TableCell>
                        <TableCell>{employee.setor || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={employee.ativo ? 'default' : 'secondary'}>
                            {employee.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {employee.data_admissao 
                            ? new Date(employee.data_admissao).toLocaleDateString('pt-BR')
                            : '-'
                          }
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(employee)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleEmployeeStatus(employee)}
                            >
                              {employee.ativo ? (
                                <UserX className="w-4 h-4 text-destructive" />
                              ) : (
                                <UserCheck className="w-4 h-4 text-success" />
                              )}
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
