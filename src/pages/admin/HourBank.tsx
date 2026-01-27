import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { formatMinutesToHours } from '@/lib/hash';

interface Employee {
  id: string;
  nome: string;
}

interface HourBankBalance {
  employee_id: string;
  employee_name: string;
  balance_minutes: number;
}

interface LedgerEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  ref_date: string;
  minutes: number;
  source: string;
  description: string | null;
  approval_status: string;
  created_at: string;
}

export default function HourBankPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [balances, setBalances] = useState<HourBankBalance[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadEmployees();
    loadBalances();
  }, []);

  useEffect(() => {
    loadLedger();
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadBalances = async () => {
    try {
      const { data, error } = await supabase
        .from('hour_bank_balance')
        .select(`
          employee_id,
          balance_minutes,
          employees!inner(nome)
        `);

      if (error) throw error;

      setBalances((data || []).map((b: { employee_id: string; balance_minutes: number; employees: { nome: string } }) => ({
        employee_id: b.employee_id,
        employee_name: b.employees.nome,
        balance_minutes: b.balance_minutes,
      })));
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const loadLedger = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hour_bank_ledger')
        .select(`
          id,
          employee_id,
          ref_date,
          minutes,
          source,
          description,
          approval_status,
          created_at,
          employees!inner(nome)
        `)
        .order('ref_date', { ascending: false })
        .limit(100);

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLedgerEntries((data || []).map((entry: { id: string; employee_id: string; ref_date: string; minutes: number; source: string; description: string | null; approval_status: string; created_at: string; employees: { nome: string } }) => ({
        ...entry,
        employee_name: entry.employees.nome,
      })));
    } catch (error) {
      console.error('Error loading ledger:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar lançamentos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      automatico: 'Automático',
      ajuste_manual: 'Ajuste Manual',
      abono: 'Abono',
      atestado: 'Atestado',
      compensacao: 'Compensação',
    };
    return labels[source] || source;
  };

  const totalPositive = balances.filter(b => b.balance_minutes > 0).reduce((sum, b) => sum + b.balance_minutes, 0);
  const totalNegative = balances.filter(b => b.balance_minutes < 0).reduce((sum, b) => sum + b.balance_minutes, 0);

  return (
    <AdminLayout currentPage="hourbank">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Positivas</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {formatMinutesToHours(totalPositive)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total acumulado a favor
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horas Negativas</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {formatMinutesToHours(totalNegative)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total a compensar
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo Geral</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                totalPositive + totalNegative >= 0 ? 'text-success' : 'text-destructive'
              }`}>
                {formatMinutesToHours(totalPositive + totalNegative)}
              </div>
              <p className="text-xs text-muted-foreground">
                Balanço total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Balances by Employee */}
        <Card>
          <CardHeader>
            <CardTitle>Saldo por Colaborador</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {balances.length === 0 ? (
                <p className="text-muted-foreground col-span-full text-center py-4">
                  Nenhum saldo registrado
                </p>
              ) : (
                balances.map((balance) => (
                  <div
                    key={balance.employee_id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{balance.employee_name}</span>
                    <span className={`font-mono font-bold ${
                      balance.balance_minutes >= 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {formatMinutesToHours(balance.balance_minutes)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ledger */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Extrato de Lançamentos</CardTitle>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Filtrar por colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                    <TableHead>Data</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Minutos</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum lançamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {new Date(entry.ref_date).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{entry.employee_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getSourceLabel(entry.source)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {entry.description || '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono font-medium ${
                            entry.minutes >= 0 ? 'text-success' : 'text-destructive'
                          }`}>
                            {formatMinutesToHours(entry.minutes)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            entry.approval_status === 'aprovado' ? 'default' :
                            entry.approval_status === 'pendente' ? 'secondary' : 'destructive'
                          }>
                            {entry.approval_status}
                          </Badge>
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
