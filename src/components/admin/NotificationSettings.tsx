import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { Bell, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface NotificationType {
  key: string;
  label: string;
  description: string;
  icon: string;
  defaultTemplate: string;
  hasSchedule?: boolean;
  variables: string[];
}

const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: 'new_document',
    label: 'Novo documento disponível',
    description: 'Enviado ao colaborador quando um novo documento é distribuído',
    icon: '📄',
    defaultTemplate: '📄 Olá {nome}! Você tem um novo documento disponível: *{documento}*. Acesse o Portal do Colaborador para visualizar e assinar.',
    variables: ['nome', 'documento'],
  },
  {
    key: 'correction_approved',
    label: 'Correção de ponto aprovada',
    description: 'Enviado ao colaborador quando sua correção é aprovada',
    icon: '✅',
    defaultTemplate: '✅ Olá {nome}! Sua solicitação de correção de ponto do dia {data} foi *aprovada*.',
    variables: ['nome', 'data'],
  },
  {
    key: 'correction_rejected',
    label: 'Correção de ponto rejeitada',
    description: 'Enviado ao colaborador quando sua correção é rejeitada',
    icon: '❌',
    defaultTemplate: '❌ Olá {nome}! Sua solicitação de correção de ponto do dia {data} foi *rejeitada*. Motivo: {motivo}',
    variables: ['nome', 'data', 'motivo'],
  },
  {
    key: 'punch_reminder',
    label: 'Lembrete de ponto',
    description: 'Lembrete diário para colaboradores que não registraram entrada',
    icon: '⏰',
    defaultTemplate: '⏰ Olá {nome}! Você ainda não registrou seu ponto hoje. Não esqueça de bater o ponto!',
    hasSchedule: true,
    variables: ['nome'],
  },
  {
    key: 'monthly_closing',
    label: 'Fechamento mensal disponível',
    description: 'Enviado quando o espelho de ponto do mês está pronto',
    icon: '📊',
    defaultTemplate: '📊 Olá {nome}! Seu espelho de ponto de *{mes}* está disponível para conferência no Portal do Colaborador.',
    variables: ['nome', 'mes'],
  },
  {
    key: 'certificate_received',
    label: 'Atestado recebido (para RH)',
    description: 'Enviado ao RH quando um colaborador envia um atestado',
    icon: '🏥',
    defaultTemplate: '🏥 Novo atestado recebido de *{nome}* para o dia {data}. Acesse o painel para verificar.',
    variables: ['nome', 'data'],
  },
];

interface SettingRow {
  notification_type: string;
  is_enabled: boolean;
  message_template: string;
  schedule_time: string | null;
}

export function NotificationSettings() {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, SettingRow>>({});

  useEffect(() => {
    if (selectedCompanyId) loadSettings();
  }, [selectedCompanyId]);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('company_id', selectedCompanyId!);

    const map: Record<string, SettingRow> = {};
    // Initialize with defaults
    NOTIFICATION_TYPES.forEach(nt => {
      map[nt.key] = {
        notification_type: nt.key,
        is_enabled: true,
        message_template: nt.defaultTemplate,
        schedule_time: nt.hasSchedule ? '09:00' : null,
      };
    });
    // Override with saved
    (data || []).forEach((row: any) => {
      map[row.notification_type] = {
        notification_type: row.notification_type,
        is_enabled: row.is_enabled,
        message_template: row.message_template || map[row.notification_type]?.message_template || '',
        schedule_time: row.schedule_time,
      };
    });

    setSettings(map);
    setLoading(false);
  };

  const updateSetting = (key: string, field: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);

    const upserts = Object.values(settings).map(s => ({
      company_id: selectedCompanyId,
      notification_type: s.notification_type,
      is_enabled: s.is_enabled,
      message_template: s.message_template,
      schedule_time: s.schedule_time,
    }));

    const { error } = await supabase
      .from('notification_settings')
      .upsert(upserts, { onConflict: 'company_id,notification_type' });

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configurações de notificação salvas!' });
    }
    setSaving(false);
  };

  if (!selectedCompanyId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notificações WhatsApp
        </CardTitle>
        <CardDescription>
          Configure quais notificações enviar automaticamente via WhatsApp e personalize as mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            {NOTIFICATION_TYPES.map(nt => {
              const setting = settings[nt.key];
              if (!setting) return null;

              return (
                <div key={nt.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{nt.icon}</span>
                      <div>
                        <Label className="text-sm font-medium">{nt.label}</Label>
                        <p className="text-xs text-muted-foreground">{nt.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={setting.is_enabled}
                      onCheckedChange={v => updateSetting(nt.key, 'is_enabled', v)}
                    />
                  </div>

                  {setting.is_enabled && (
                    <div className="space-y-2 pl-8">
                      <div className="space-y-1">
                        <Label className="text-xs">Template da mensagem</Label>
                        <Textarea
                          value={setting.message_template}
                          onChange={e => updateSetting(nt.key, 'message_template', e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex gap-1 flex-wrap">
                          {nt.variables.map(v => (
                            <Badge key={v} variant="outline" className="text-xs cursor-help">
                              {`{${v}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {nt.hasSchedule && (
                        <div className="space-y-1">
                          <Label className="text-xs">Horário do lembrete</Label>
                          <Input
                            type="time"
                            value={setting.schedule_time || '09:00'}
                            onChange={e => updateSetting(nt.key, 'schedule_time', e.target.value)}
                            className="w-32"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configurações de Notificação
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
