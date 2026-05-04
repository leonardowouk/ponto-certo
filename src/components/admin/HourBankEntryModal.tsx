import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { recalculateHourBankBalance, getExpectedMinutesForDate } from '@/lib/hourBank';
import { Loader2 } from 'lucide-react';

interface Employee { id: string; nome: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  /** 'compensacao' = folga rápida (auto calc); 'manual' = ajuste livre */
  mode: 'compensacao' | 'manual';
  onSaved: () => void;
}

const SOURCE_OPTIONS = [
  { value: 'ajuste_manual', label: 'Ajuste manual' },
  { value: 'abono', label: 'Abono' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'compensacao', label: 'Compensação / Folga' },
];

export function HourBankEntryModal({ open, onClose, employees, mode, onSaved }: Props) {
  const { toast } = useToast();
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<string>(mode === 'compensacao' ? 'compensacao' : 'ajuste_manual');
  const [minutes, setMinutes] = useState<string>('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoMinutes, setAutoMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setEmployeeId('');
      setDate(new Date().toISOString().slice(0, 10));
      setSource(mode === 'compensacao' ? 'compensacao' : 'ajuste_manual');
      setMinutes('');
      setDescription('');
      setAutoMinutes(null);
    }
  }, [open, mode]);

  // Para folga: pré-calcular minutos a debitar pela jornada
  useEffect(() => {
    if (mode !== 'compensacao' || !employeeId) {
      setAutoMinutes(null);
      return;
    }
    getExpectedMinutesForDate(employeeId, date).then(setAutoMinutes);
  }, [mode, employeeId, date]);

  const formatHHmm = (mins: number) => {
    const sign = mins < 0 ? '-' : '';
    const abs = Math.abs(mins);
    return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}h${String(abs % 60).padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!employeeId) {
      toast({ title: 'Selecione o colaborador', variant: 'destructive' });
      return;
    }

    let finalMinutes: number;
    let finalSource = source;
    let finalDesc = description.trim();

    if (mode === 'compensacao') {
      if (autoMinutes == null) {
        toast({ title: 'Aguarde o cálculo da jornada', variant: 'destructive' });
        return;
      }
      finalMinutes = -Math.abs(autoMinutes);
      finalSource = 'compensacao';
      if (!finalDesc) finalDesc = 'Folga compensada do banco de horas';
    } else {
      const parsed = parseInt(minutes, 10);
      if (Number.isNaN(parsed) || parsed === 0) {
        toast({ title: 'Informe os minutos (positivo ou negativo, diferente de zero)', variant: 'destructive' });
        return;
      }
      finalMinutes = parsed;
    }

    setSaving(true);
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const { error } = await supabase.from('hour_bank_ledger').insert({
      employee_id: employeeId,
      ref_date: date,
      minutes: finalMinutes,
      source: finalSource as 'automatico' | 'ajuste_manual' | 'abono' | 'atestado' | 'compensacao',
      description: finalDesc || null,
      approval_status: 'aprovado',
      approved_by: userId,
      approved_at: new Date().toISOString(),
      created_by: userId,
    });

    if (error) {
      setSaving(false);
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }

    await recalculateHourBankBalance(employeeId);
    setSaving(false);
    toast({
      title: mode === 'compensacao' ? 'Folga lançada' : 'Lançamento registrado',
      description: `${formatHHmm(finalMinutes)} no saldo do colaborador.`,
    });
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'compensacao' ? 'Lançar folga compensada' : 'Novo lançamento manual'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {mode === 'manual' && (
            <>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Minutos (use valor negativo para descontar)</Label>
                <Input
                  type="number"
                  placeholder="Ex: -480 para descontar 8h"
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                />
                {minutes && !Number.isNaN(parseInt(minutes, 10)) && (
                  <p className="text-xs text-muted-foreground">
                    Equivale a {formatHHmm(parseInt(minutes, 10))}
                  </p>
                )}
              </div>
            </>
          )}

          {mode === 'compensacao' && employeeId && (
            <div className="rounded-md bg-muted p-3 text-sm">
              {autoMinutes == null ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Calculando jornada...
                </span>
              ) : (
                <>
                  Será debitado <strong>{formatHHmm(autoMinutes)}</strong> do saldo
                  (jornada esperada do dia).
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Descrição {mode === 'compensacao' && '(opcional)'}</Label>
            <Textarea
              rows={2}
              placeholder={mode === 'compensacao' ? 'Folga compensada do banco de horas' : 'Motivo do lançamento'}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
