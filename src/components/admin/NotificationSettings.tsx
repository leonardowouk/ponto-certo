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
import { Bell, Loader2, Save, Plus, Trash2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface NotificationType {
  key: string;
  label: string;
  description: string;
  icon: string;
  defaultTemplate: string;
  hasSchedule?: boolean;
  variables: string[];
  isCustom?: boolean;
}

const BUILTIN_NOTIFICATION_TYPES: NotificationType[] = [
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

const ICON_OPTIONS = ['📢', '📌', '🔔', '💬', '📋', '🎉', '⚠️', '🗓️', '👋', '💼'];

const AVAILABLE_VARIABLES = [
  { value: 'nome', label: 'Nome do colaborador' },
  { value: 'data', label: 'Data' },
  { value: 'mes', label: 'Mês de referência' },
  { value: 'documento', label: 'Nome do documento' },
  { value: 'empresa', label: 'Nome da empresa' },
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
  const [allTypes, setAllTypes] = useState<NotificationType[]>([...BUILTIN_NOTIFICATION_TYPES]);

  // New notification dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIcon, setNewIcon] = useState('📢');
  const [newTemplate, setNewTemplate] = useState('');
  const [newHasSchedule, setNewHasSchedule] = useState(false);
  const [newScheduleTime, setNewScheduleTime] = useState('09:00');

  // Manual send dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [sendPhone, setSendPhone] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);

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
    const customTypes: NotificationType[] = [];

    // Initialize builtin with defaults
    BUILTIN_NOTIFICATION_TYPES.forEach(nt => {
      map[nt.key] = {
        notification_type: nt.key,
        is_enabled: true,
        message_template: nt.defaultTemplate,
        schedule_time: nt.hasSchedule ? '09:00' : null,
      };
    });

    // Override with saved and detect custom
    (data || []).forEach((row: any) => {
      const isBuiltin = BUILTIN_NOTIFICATION_TYPES.some(b => b.key === row.notification_type);
      
      map[row.notification_type] = {
        notification_type: row.notification_type,
        is_enabled: row.is_enabled,
        message_template: row.message_template || map[row.notification_type]?.message_template || '',
        schedule_time: row.schedule_time,
      };

      if (!isBuiltin) {
        // Reconstruct custom type from saved data
        const label = row.notification_type.replace(/^custom_/, '').replace(/_/g, ' ');
        customTypes.push({
          key: row.notification_type,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          description: 'Notificação personalizada',
          icon: '📢',
          defaultTemplate: row.message_template || '',
          hasSchedule: !!row.schedule_time,
          variables: ['nome', 'data'],
          isCustom: true,
        });
      }
    });

    setAllTypes([...BUILTIN_NOTIFICATION_TYPES, ...customTypes]);
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

  const handleCreateNotification = () => {
    if (!newLabel.trim()) {
      toast({ title: 'Informe o nome da notificação', variant: 'destructive' });
      return;
    }
    if (!newTemplate.trim()) {
      toast({ title: 'Informe o template da mensagem', variant: 'destructive' });
      return;
    }

    const key = 'custom_' + newLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    if (settings[key]) {
      toast({ title: 'Já existe uma notificação com esse nome', variant: 'destructive' });
      return;
    }

    const newType: NotificationType = {
      key,
      label: newLabel.trim(),
      description: newDescription.trim() || 'Notificação personalizada',
      icon: newIcon,
      defaultTemplate: newTemplate.trim(),
      hasSchedule: newHasSchedule,
      variables: ['nome', 'data'],
      isCustom: true,
    };

    setAllTypes(prev => [...prev, newType]);
    setSettings(prev => ({
      ...prev,
      [key]: {
        notification_type: key,
        is_enabled: true,
        message_template: newTemplate.trim(),
        schedule_time: newHasSchedule ? newScheduleTime : null,
      },
    }));

    // Reset form
    setNewLabel('');
    setNewDescription('');
    setNewIcon('📢');
    setNewTemplate('');
    setNewHasSchedule(false);
    setNewScheduleTime('09:00');
    setNewDialogOpen(false);

    toast({ title: 'Notificação criada!', description: 'Clique em Salvar para persistir.' });
  };

  const handleDeleteCustom = async (key: string) => {
    if (!selectedCompanyId) return;

    // Remove from DB
    await supabase
      .from('notification_settings')
      .delete()
      .eq('company_id', selectedCompanyId)
      .eq('notification_type', key);

    // Remove from state
    setAllTypes(prev => prev.filter(t => t.key !== key));
    setSettings(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    toast({ title: 'Notificação removida' });
  };

  const handleOpenSend = (key: string) => {
    const setting = settings[key];
    setSendingKey(key);
    setSendMessage(setting?.message_template || '');
    setSendPhone('');
    setSendDialogOpen(true);
  };

  const handleSendManual = async () => {
    if (!selectedCompanyId || !sendPhone.trim() || !sendMessage.trim()) {
      toast({ title: 'Preencha telefone e mensagem', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          company_id: selectedCompanyId,
          action: 'send',
          phone: sendPhone.trim(),
          message: sendMessage.trim(),
        },
      });

      if (error) throw error;
      if (data?.success) {
        toast({ title: 'Mensagem enviada!' });
        setSendDialogOpen(false);
      } else {
        toast({ title: 'Falha ao enviar', description: data?.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  if (!selectedCompanyId) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notificações WhatsApp
            </CardTitle>
            <CardDescription>
              Configure notificações automáticas e crie notificações personalizadas
            </CardDescription>
          </div>
          <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Nova Notificação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Notificação Personalizada</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ícone</Label>
                    <Select value={newIcon} onValueChange={setNewIcon}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(icon => (
                          <SelectItem key={icon} value={icon}>
                            <span className="text-lg">{icon}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Nome da notificação *</Label>
                    <Input
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      placeholder="Ex: Aniversário do colaborador"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Breve descrição do propósito"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Template da mensagem *</Label>
                  <Textarea
                    value={newTemplate}
                    onChange={e => setNewTemplate(e.target.value)}
                    placeholder="Olá {nome}! ..."
                    rows={3}
                  />
                  <div className="flex gap-1 flex-wrap">
                    <span className="text-xs text-muted-foreground">Variáveis disponíveis:</span>
                    {AVAILABLE_VARIABLES.map(v => (
                      <Badge
                        key={v.value}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-accent"
                        onClick={() => setNewTemplate(prev => prev + `{${v.value}}`)}
                      >
                        {`{${v.value}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Agendar horário</Label>
                    <p className="text-xs text-muted-foreground">Envio em horário fixo</p>
                  </div>
                  <Switch checked={newHasSchedule} onCheckedChange={setNewHasSchedule} />
                </div>

                {newHasSchedule && (
                  <div className="space-y-1">
                    <Label className="text-xs">Horário</Label>
                    <Input
                      type="time"
                      value={newScheduleTime}
                      onChange={e => setNewScheduleTime(e.target.value)}
                      className="w-32"
                    />
                  </div>
                )}

                <Button onClick={handleCreateNotification} className="w-full">
                  <Plus className="w-4 h-4 mr-1" />
                  Criar Notificação
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            {allTypes.map(nt => {
              const setting = settings[nt.key];
              if (!setting) return null;

              return (
                <div key={nt.key} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-lg">{nt.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium">{nt.label}</Label>
                          {nt.isCustom && (
                            <Badge variant="secondary" className="text-xs">Personalizada</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{nt.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {nt.isCustom && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenSend(nt.key)}
                            title="Enviar manualmente"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteCustom(nt.key)}
                            title="Excluir notificação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Switch
                        checked={setting.is_enabled}
                        onCheckedChange={v => updateSetting(nt.key, 'is_enabled', v)}
                      />
                    </div>
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
                          {(nt.variables || ['nome', 'data']).map(v => (
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

      {/* Manual Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Telefone (com DDD)</Label>
              <Input
                value={sendPhone}
                onChange={e => setSendPhone(e.target.value)}
                placeholder="(42) 99999-9999"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={sendMessage}
                onChange={e => setSendMessage(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={handleSendManual} disabled={sending} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
