import { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Cake, Award, Loader2, Users, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Row {
  id: string;
  nome: string;
  cargo: string | null;
  data_nascimento: string | null;
  data_admissao: string | null;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Interpreta 'YYYY-MM-DD' sem deslocamento de fuso. */
function parseDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function daysUntil(month: number, day: number) {
  const today = new Date();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < todayMid) next = new Date(today.getFullYear() + 1, month - 1, day);
  return Math.round((next.getTime() - todayMid.getTime()) / 86400000);
}

interface Item {
  id: string;
  nome: string;
  cargo: string | null;
  day: number;
  month: number;
  years: number;
  days: number;
}

function buildItems(rows: Row[], field: 'data_nascimento' | 'data_admissao', month: number): Item[] {
  const currentYear = new Date().getFullYear();
  return rows
    .filter(r => !!r[field])
    .map(r => {
      const { year, month: m, day } = parseDate(r[field] as string);
      return {
        id: r.id,
        nome: r.nome,
        cargo: r.cargo,
        day,
        month: m,
        years: Math.max(0, currentYear - year),
        days: daysUntil(m, day),
      };
    })
    .filter(i => i.month === month)
    .sort((a, b) => a.day - b.day);
}

/** Formata 'YYYY-MM-DD' como dd/mm sem deslocamento de fuso. */
function formatDM(value: string | null) {
  if (!value) return '—';
  const { day, month } = parseDate(value);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** Tempo de empresa em anos e meses a partir de 'YYYY-MM-DD'. */
function tenureText(admissao: string | null) {
  if (!admissao) return '—';
  const { year, month, day } = parseDate(admissao);
  const start = new Date(year, month - 1, day);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return '—';
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return m === 0 ? '< 1 mês' : `${m} ${m === 1 ? 'mês' : 'meses'}`;
  if (m === 0) return `${y} ${y === 1 ? 'ano' : 'anos'}`;
  return `${y} a ${m} m`;
}

export default function BirthdaysPage() {
  const { selectedCompanyId } = useCompany();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from('employees')
        .select('id, nome, cargo, data_nascimento, data_admissao')
        .eq('ativo', true)
        .order('nome');
      if (selectedCompanyId) q = q.eq('company_id', selectedCompanyId);
      const { data } = await q;
      setRows(data || []);
      setLoading(false);
    };
    load();
  }, [selectedCompanyId]);

  const m = Number(month);
  const birthdays = useMemo(() => buildItems(rows, 'data_nascimento', m), [rows, m]);
  const anniversaries = useMemo(
    () => buildItems(rows, 'data_admissao', m).filter(i => i.years > 0),
    [rows, m],
  );

  const renderList = (items: Item[], kind: 'nascimento' | 'empresa') => {
    if (items.length === 0) {
      return <p className="text-sm text-muted-foreground py-6 text-center">Ninguém neste mês.</p>;
    }
    return (
      <ul className="divide-y">
        {items.map(i => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
              <span className="text-sm font-semibold leading-none">{String(i.day).padStart(2, '0')}</span>
              <span className="text-[10px] text-muted-foreground uppercase">{MONTHS[i.month - 1].slice(0, 3)}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{i.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {kind === 'nascimento'
                  ? `${i.cargo || 'Colaborador'} · completa ${i.years} anos`
                  : `${i.years} ${i.years === 1 ? 'ano' : 'anos'} de empresa`}
              </p>
            </div>
            {i.days <= 7 && (
              <Badge variant={i.days === 0 ? 'default' : 'secondary'} className="shrink-0">
                {i.days === 0 ? 'Hoje' : i.days === 1 ? 'Amanhã' : `em ${i.days} dias`}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <AdminLayout currentPage="birthdays">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Aniversários de vida e de tempo de empresa dos colaboradores ativos.
          </p>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((name, idx) => (
                <SelectItem key={name} value={String(idx + 1)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cake className="w-4 h-4 text-primary" />
                  Aniversariantes do mês ({birthdays.length})
                </CardTitle>
              </CardHeader>
              <CardContent>{renderList(birthdays, 'nascimento')}</CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="w-4 h-4 text-primary" />
                  Tempo de empresa ({anniversaries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>{renderList(anniversaries, 'empresa')}</CardContent>
            </Card>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          As datas de nascimento aparecem aqui assim que forem preenchidas no cadastro do colaborador.
        </p>
      </div>
    </AdminLayout>
  );
}
