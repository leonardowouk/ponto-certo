import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';

interface Punch {
  id: string;
  punch_type: string;
  punched_at: string;
}

interface DayRecord {
  work_date: string;
  first_punch_at: string | null;
  last_punch_at: string | null;
  worked_minutes: number | null;
  expected_minutes: number | null;
  balance_minutes: number | null;
  break_minutes: number | null;
  status: string | null;
  punches?: Punch[];
}

interface TimesheetPrintViewProps {
  employeeName: string;
  companyName: string;
  refMonth: Date;
  days: DayRecord[];
  totals: {
    worked: number;
    expected: number;
    balance: number;
    breaks: number;
  };
  onClose: () => void;
}

const formatMinutes = (m: number | null) => {
  if (m === null || m === undefined) return '00:00';
  const sign = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const formatTime = (iso: string | null) => {
  if (!iso) return '--:--';
  return format(new Date(iso), 'HH:mm');
};

const weekday = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return format(d, 'EEE', { locale: ptBR });
};

const punchTypeLabel: Record<string, string> = {
  entrada: 'Ent',
  saida: 'Saí',
  intervalo_inicio: 'Int↓',
  intervalo_fim: 'Int↑',
};

export function TimesheetPrintView({ employeeName, companyName, refMonth, days, totals, onClose }: TimesheetPrintViewProps) {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      <div className="print:hidden flex items-center gap-2 p-4 border-b bg-muted/50">
        <Button onClick={handlePrint} size="sm"><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
        <Button onClick={onClose} variant="outline" size="sm"><X className="w-4 h-4 mr-1" />Fechar</Button>
      </div>

      <div className="max-w-[210mm] mx-auto p-8 print:p-4 print:max-w-none">
        {/* Header */}
        <div className="text-center mb-6 border-b pb-4">
          <h1 className="text-lg font-bold uppercase">{companyName}</h1>
          <h2 className="text-base font-semibold mt-1">Espelho de Ponto</h2>
          <p className="text-sm mt-1">
            Colaborador: <strong>{employeeName}</strong> | 
            Referência: <strong>{format(refMonth, 'MMMM/yyyy', { locale: ptBR })}</strong>
          </p>
        </div>

        {/* Table */}
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="border p-1 text-left">Dia</th>
              <th className="border p-1 text-left">Sem</th>
              <th className="border p-1 text-center">Entrada</th>
              <th className="border p-1 text-center">Int. Início</th>
              <th className="border p-1 text-center">Int. Fim</th>
              <th className="border p-1 text-center">Saída</th>
              <th className="border p-1 text-center">Trab.</th>
              <th className="border p-1 text-center">Esper.</th>
              <th className="border p-1 text-center">Saldo</th>
              <th className="border p-1 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const punches = d.punches || [];
              const entrada = punches.find(p => p.punch_type === 'entrada');
              const intInicio = punches.find(p => p.punch_type === 'intervalo_inicio');
              const intFim = punches.find(p => p.punch_type === 'intervalo_fim');
              const saida = punches.find(p => p.punch_type === 'saida');

              return (
                <tr key={d.work_date} className="even:bg-muted/20">
                  <td className="border p-1">{format(new Date(d.work_date + 'T12:00:00'), 'dd/MM')}</td>
                  <td className="border p-1 capitalize">{weekday(d.work_date)}</td>
                  <td className="border p-1 text-center">{formatTime(entrada?.punched_at || d.first_punch_at)}</td>
                  <td className="border p-1 text-center">{formatTime(intInicio?.punched_at || null)}</td>
                  <td className="border p-1 text-center">{formatTime(intFim?.punched_at || null)}</td>
                  <td className="border p-1 text-center">{formatTime(saida?.punched_at || d.last_punch_at)}</td>
                  <td className="border p-1 text-center">{formatMinutes(d.worked_minutes)}</td>
                  <td className="border p-1 text-center">{formatMinutes(d.expected_minutes)}</td>
                  <td className={`border p-1 text-center ${(d.balance_minutes ?? 0) < 0 ? 'text-destructive' : ''}`}>
                    {formatMinutes(d.balance_minutes)}
                  </td>
                  <td className="border p-1 text-center capitalize">{d.status || '-'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-muted/50">
              <td colSpan={6} className="border p-1 text-right">TOTAIS:</td>
              <td className="border p-1 text-center">{formatMinutes(totals.worked)}</td>
              <td className="border p-1 text-center">{formatMinutes(totals.expected)}</td>
              <td className={`border p-1 text-center ${totals.balance < 0 ? 'text-destructive' : ''}`}>
                {formatMinutes(totals.balance)}
              </td>
              <td className="border p-1"></td>
            </tr>
          </tfoot>
        </table>

        {/* Signatures */}
        <div className="mt-16 flex justify-between print:mt-12">
          <div className="text-center">
            <div className="w-56 border-t border-foreground pt-1">
              <p className="text-xs">Colaborador</p>
              <p className="text-xs font-medium">{employeeName}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="w-56 border-t border-foreground pt-1">
              <p className="text-xs">Responsável</p>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-8 text-center print:mt-4">
          Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
        </p>
      </div>
    </div>
  );
}
