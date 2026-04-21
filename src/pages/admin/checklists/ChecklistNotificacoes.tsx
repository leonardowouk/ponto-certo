import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Save, Bell, AlertCircle, Clock } from 'lucide-react';

interface Setting {
  is_enabled: boolean;
  schedule_time: string | null;
}

export default function ChecklistNotificacoes() {
  const { selectedCompanyId } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resumo, setResumo] = useState<Setting>({ is_enabled: true, schedule_time: '18:00' });
  const [reprov, setReprov] = useState<Setting>({ is_enabled: true, schedule_time: null });

  const load = async () => {
    if (!selectedCompanyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('notification_settings')
      .select('notification_type, is_enabled, schedule_time')
      .eq('company_id', selectedCompanyId)
      .in('notification_type', ['checklist_daily_summary', 'checklist_reprovacao']);
    (data || []).forEach((d: any) => {
      if (d.notification_type === 'checklist_daily_summary') {
        setResumo({ is_enabled: d.is_enabled, schedule_time: d.schedule_time?.slice(0, 5) || '18:00' });
      }
      if (d.notification_type === 'checklist_reprovacao') {
        setReprov({ is_enabled: d.is_enabled, schedule_time: null });
      }
    });
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [selectedCompanyId]);

  const save = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    const rows = [
      {
        company_id: selectedCompanyId,
        notification_type: 'checklist_daily_summary',
        is_enabled: resumo.is_enabled,
        schedule_time: (resumo.schedule_time || '18:00') + ':00',
      },
      {
        company_id: selectedCompanyId,
        notification_type: 'checklist_reprovacao',
        is_enabled: reprov.is_enabled,
        schedule_time: null,
      },
    ];

    for (const r of rows) {
      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('company_id', r.company_id)
        .eq('notification_type', r.notification_type)
        .maybeSingle();

      if (existing) {
        await supabase.from('notification_settings').update({
          is_enabled: r.is_enabled,
          schedule_time: r.schedule_time,
        }).eq('id', existing.id);
      } else {
        await supabase.from('notification_settings').insert(r);
      }
    }

    setSaving(false);
    toast({ title: 'Configurações salvas' });
  };

  return (
    <AdminLayout currentPage="checklists">
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" onClick={() => navigate('/admin/checklists')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" /> Notificações de checklists
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure alertas e resumos enviados via WhatsApp para Admin e RH.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Alerta de item reprovado pela IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Envia mensagem imediata para Admin/RH (com telefone cadastrado) sempre que a IA reprovar um item.
                </p>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch
                    checked={reprov.is_enabled}
                    onCheckedChange={(v) => setReprov((p) => ({ ...p, is_enabled: v }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Resumo diário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Envia um resumo dos checklists do dia (concluídos, reprovados, a revisar) no horário definido.
                </p>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch
                    checked={resumo.is_enabled}
                    onCheckedChange={(v) => setResumo((p) => ({ ...p, is_enabled: v }))}
                  />
                </div>
                <div>
                  <Label>Horário do envio</Label>
                  <Input
                    type="time"
                    value={resumo.schedule_time || '18:00'}
                    onChange={(e) => setResumo((p) => ({ ...p, schedule_time: e.target.value }))}
                    className="max-w-32"
                    disabled={!resumo.is_enabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Horário de Brasília (verificado a cada hora cheia).</p>
                </div>
              </CardContent>
            </Card>

            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar configurações
            </Button>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
