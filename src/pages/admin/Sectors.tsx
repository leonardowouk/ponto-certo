import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Plus, Pencil, Building2, Power, PowerOff, Loader2, Search } from 'lucide-react';

interface WeeklyDays {
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
}

interface SectorSchedule {
  id: string;
  expected_start: string;
  expected_end: string;
  break_minutes: number;
  tolerance_early_minutes: number;
  tolerance_late_minutes: number;
  weekly_days: WeeklyDays;
}

interface Sector {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
  sector_schedules?: SectorSchedule[];
}

const defaultWeeklyDays: WeeklyDays = {
  mon: true,
  tue: true,
  wed: true,
  thu: true,
  fri: true,
  sat: false,
  sun: false,
};

const dayLabels: { key: keyof WeeklyDays; label: string }[] = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [formData, setFormData] = useState({
    nome: '',
    expected_start: '08:00',
    expected_end: '18:00',
    break_minutes: 60,
    tolerance_early_minutes: 10,
    tolerance_late_minutes: 10,
    weekly_days: { ...defaultWeeklyDays },
  });
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadSectors();
  }, [selectedCompanyId]);

  const loadSectors = async () => {
    try {
      let query = supabase
        .from('sectors')
        .select(`
          id,
          nome,
          ativo,
          created_at,
          sector_schedules (
            id,
            expected_start,
            expected_end,
            break_minutes,
            tolerance_early_minutes,
            tolerance_late_minutes,
            weekly_days
          )
        `)
        .order('nome');

      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Map data to expected format (sector_schedules comes as array from Supabase)
      const mappedSectors: Sector[] = (data || []).map((s) => ({
        id: s.id,
        nome: s.nome,
        ativo: s.ativo,
        created_at: s.created_at,
        sector_schedules: Array.isArray(s.sector_schedules) 
          ? s.sector_schedules.map((ss) => ({
              id: ss.id,
              expected_start: ss.expected_start,
              expected_end: ss.expected_end,
              break_minutes: ss.break_minutes,
              tolerance_early_minutes: ss.tolerance_early_minutes,
              tolerance_late_minutes: ss.tolerance_late_minutes,
              weekly_days: ss.weekly_days as unknown as WeeklyDays,
            }))
          : s.sector_schedules 
            ? [{
                id: (s.sector_schedules as unknown as SectorSchedule).id,
                expected_start: (s.sector_schedules as unknown as SectorSchedule).expected_start,
                expected_end: (s.sector_schedules as unknown as SectorSchedule).expected_end,
                break_minutes: (s.sector_schedules as unknown as SectorSchedule).break_minutes,
                tolerance_early_minutes: (s.sector_schedules as unknown as SectorSchedule).tolerance_early_minutes,
                tolerance_late_minutes: (s.sector_schedules as unknown as SectorSchedule).tolerance_late_minutes,
                weekly_days: (s.sector_schedules as unknown as SectorSchedule).weekly_days as WeeklyDays,
              }]
            : undefined,
      }));
      setSectors(mappedSectors);
    } catch (error) {
      console.error('Error loading sectors:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar setores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (sector?: Sector) => {
    if (sector) {
      setEditingSector(sector);
      const schedule = sector.sector_schedules?.[0];
      setFormData({
        nome: sector.nome,
        expected_start: schedule?.expected_start || '08:00',
        expected_end: schedule?.expected_end || '18:00',
        break_minutes: schedule?.break_minutes || 60,
        tolerance_early_minutes: schedule?.tolerance_early_minutes || 10,
        tolerance_late_minutes: schedule?.tolerance_late_minutes || 10,
        weekly_days: (schedule?.weekly_days as WeeklyDays) || { ...defaultWeeklyDays },
      });
    } else {
      setEditingSector(null);
      setFormData({
        nome: '',
        expected_start: '08:00',
        expected_end: '18:00',
        break_minutes: 60,
        tolerance_early_minutes: 10,
        tolerance_late_minutes: 10,
        weekly_days: { ...defaultWeeklyDays },
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingSector) {
        // Update sector
        const { error: sectorError } = await supabase
          .from('sectors')
          .update({ nome: formData.nome })
          .eq('id', editingSector.id);

        if (sectorError) throw sectorError;

        // Upsert schedule
        const scheduleData = {
          sector_id: editingSector.id,
          expected_start: formData.expected_start,
          expected_end: formData.expected_end,
          break_minutes: formData.break_minutes,
          tolerance_early_minutes: formData.tolerance_early_minutes,
          tolerance_late_minutes: formData.tolerance_late_minutes,
          weekly_days: formData.weekly_days,
        };

        const existingSchedule = editingSector.sector_schedules?.[0];
        if (existingSchedule) {
          const { error: scheduleError } = await supabase
            .from('sector_schedules')
            .update(scheduleData)
            .eq('id', existingSchedule.id);
          if (scheduleError) throw scheduleError;
        } else {
          const { error: scheduleError } = await supabase
            .from('sector_schedules')
            .insert(scheduleData);
          if (scheduleError) throw scheduleError;
        }

        toast({ title: 'Sucesso', description: 'Setor atualizado' });
      } else {
        // Create sector
        const { data: newSector, error: sectorError } = await supabase
          .from('sectors')
          .insert({ nome: formData.nome, company_id: selectedCompanyId || null })
          .select('id')
          .single();

        if (sectorError) throw sectorError;

        // Create schedule
        const { error: scheduleError } = await supabase
          .from('sector_schedules')
          .insert({
            sector_id: newSector.id,
            expected_start: formData.expected_start,
            expected_end: formData.expected_end,
            break_minutes: formData.break_minutes,
            tolerance_early_minutes: formData.tolerance_early_minutes,
            tolerance_late_minutes: formData.tolerance_late_minutes,
            weekly_days: formData.weekly_days,
          });

        if (scheduleError) throw scheduleError;

        toast({ title: 'Sucesso', description: 'Setor cadastrado' });
      }

      setIsDialogOpen(false);
      loadSectors();
    } catch (error) {
      console.error('Error saving sector:', error);
      toast({ title: 'Erro', description: 'Erro ao salvar setor', variant: 'destructive' });
    } finally {
      setFormLoading(false);
    }
  };

  const toggleSectorStatus = async (sector: Sector) => {
    try {
      const { error } = await supabase
        .from('sectors')
        .update({ ativo: !sector.ativo })
        .eq('id', sector.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: `Setor ${sector.ativo ? 'desativado' : 'ativado'}`,
      });
      loadSectors();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast({ title: 'Erro', description: 'Erro ao alterar status', variant: 'destructive' });
    }
  };

  const toggleWeekDay = (day: keyof WeeklyDays) => {
    setFormData({
      ...formData,
      weekly_days: {
        ...formData.weekly_days,
        [day]: !formData.weekly_days[day],
      },
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '-';
    return time.substring(0, 5);
  };

  const formatWorkDays = (weeklyDays: WeeklyDays | null) => {
    if (!weeklyDays) return '-';
    const days = dayLabels.filter(d => weeklyDays[d.key]).map(d => d.label);
    return days.length > 0 ? days.join(', ') : '-';
  };

  const filteredSectors = sectors.filter(sector =>
    sector.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout currentPage="sectors">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar setor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Setor
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSector ? 'Editar Setor' : 'Novo Setor'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Setor *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Produção, Administrativo"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expected_start">Entrada</Label>
                    <Input
                      id="expected_start"
                      type="time"
                      value={formData.expected_start}
                      onChange={(e) => setFormData({ ...formData, expected_start: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_end">Saída</Label>
                    <Input
                      id="expected_end"
                      type="time"
                      value={formData.expected_end}
                      onChange={(e) => setFormData({ ...formData, expected_end: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="break_minutes">Intervalo (min)</Label>
                    <Input
                      id="break_minutes"
                      type="number"
                      min={0}
                      max={180}
                      value={formData.break_minutes}
                      onChange={(e) => setFormData({ ...formData, break_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tolerance">Tolerância (min)</Label>
                    <Input
                      id="tolerance"
                      type="number"
                      min={0}
                      max={60}
                      value={formData.tolerance_late_minutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          tolerance_early_minutes: val,
                          tolerance_late_minutes: val,
                        });
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex flex-wrap gap-3">
                    {dayLabels.map((day) => (
                      <div key={day.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={day.key}
                          checked={formData.weekly_days[day.key]}
                          onCheckedChange={() => toggleWeekDay(day.key)}
                        />
                        <label htmlFor={day.key} className="text-sm cursor-pointer">
                          {day.label}
                        </label>
                      </div>
                    ))}
                  </div>
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
                    {editingSector ? 'Salvar' : 'Cadastrar'}
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
              Setores ({filteredSectors.length})
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
                    <TableHead>Horário</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSectors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum setor encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSectors.map((sector) => {
                      const schedule = sector.sector_schedules?.[0];
                      return (
                        <TableRow key={sector.id}>
                          <TableCell className="font-medium">{sector.nome}</TableCell>
                          <TableCell>
                            {formatTime(schedule?.expected_start ?? null)} - {formatTime(schedule?.expected_end ?? null)}
                          </TableCell>
                          <TableCell>{schedule?.break_minutes ?? 60} min</TableCell>
                          <TableCell className="text-sm">
                            {formatWorkDays(schedule?.weekly_days ?? null)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sector.ativo ? 'default' : 'secondary'}>
                              {sector.ativo ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(sector)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleSectorStatus(sector)}
                              >
                                {sector.ativo ? (
                                  <PowerOff className="w-4 h-4 text-destructive" />
                                ) : (
                                  <Power className="w-4 h-4 text-green-600" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
