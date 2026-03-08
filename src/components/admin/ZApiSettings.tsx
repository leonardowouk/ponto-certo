import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { MessageSquare, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function ZApiSettings() {
  const { toast } = useToast();
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const [config, setConfig] = useState({
    instance_id: '',
    instance_token: '',
    client_token: '',
    is_active: false,
  });

  useEffect(() => {
    if (selectedCompanyId) loadConfig();
  }, [selectedCompanyId]);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_integrations')
      .select('*')
      .eq('company_id', selectedCompanyId!)
      .eq('integration_type', 'zapi')
      .maybeSingle();

    if (data) {
      setConfig({
        instance_id: data.instance_id || '',
        instance_token: data.instance_token || '',
        client_token: data.client_token || '',
        is_active: data.is_active || false,
      });
    } else {
      setConfig({ instance_id: '', instance_token: '', client_token: '', is_active: false });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);

    const { error } = await supabase
      .from('company_integrations')
      .upsert({
        company_id: selectedCompanyId,
        integration_type: 'zapi',
        instance_id: config.instance_id || null,
        instance_token: config.instance_token || null,
        client_token: config.client_token || null,
        is_active: config.is_active,
      }, { onConflict: 'company_id,integration_type' });

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Configuração Z-API salva!' });
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!config.instance_id || !config.instance_token) {
      toast({ title: 'Preencha Instance ID e Token', variant: 'destructive' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          company_id: selectedCompanyId,
          action: 'test',
        },
      });

      if (error) throw error;
      setTestResult(data?.success ? 'success' : 'error');
      toast({
        title: data?.success ? 'Conexão OK!' : 'Falha na conexão',
        description: data?.success ? 'Z-API conectada e funcional.' : data?.error || 'Verifique as credenciais.',
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err: any) {
      setTestResult('error');
      toast({ title: 'Erro no teste', description: err.message, variant: 'destructive' });
    }
    setTesting(false);
  };

  if (!selectedCompanyId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Integração Z-API (WhatsApp)
        </CardTitle>
        <CardDescription>
          Configure as credenciais da Z-API para envio de notificações via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <Label>Ativar notificações WhatsApp</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita o envio automático de mensagens
                </p>
              </div>
              <Switch
                checked={config.is_active}
                onCheckedChange={v => setConfig(p => ({ ...p, is_active: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zapi_instance_id">Instance ID</Label>
              <Input
                id="zapi_instance_id"
                value={config.instance_id}
                onChange={e => setConfig(p => ({ ...p, instance_id: e.target.value }))}
                placeholder="Ex: 3C7A2B1D..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zapi_instance_token">Instance Token</Label>
              <Input
                id="zapi_instance_token"
                type="password"
                value={config.instance_token}
                onChange={e => setConfig(p => ({ ...p, instance_token: e.target.value }))}
                placeholder="Token da instância"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zapi_client_token">Client Token (opcional)</Label>
              <Input
                id="zapi_client_token"
                type="password"
                value={config.client_token}
                onChange={e => setConfig(p => ({ ...p, client_token: e.target.value }))}
                placeholder="Token do cliente (se aplicável)"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing || !config.instance_id}>
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Testar Conexão
              </Button>
              {testResult === 'success' && (
                <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Conectado
                </Badge>
              )}
              {testResult === 'error' && (
                <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Erro
                </Badge>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
