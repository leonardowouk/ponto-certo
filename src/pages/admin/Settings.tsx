import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Tablet, Shield, Clock } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();

  const handleSave = () => {
    toast({ title: 'Salvo!', description: 'Configurações atualizadas com sucesso' });
  };

  return (
    <AdminLayout currentPage="settings">
      <div className="space-y-6 max-w-2xl">
        {/* Dispositivos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tablet className="w-5 h-5" />
              Dispositivos
            </CardTitle>
            <CardDescription>
              Configure os tablets autorizados para registro de ponto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="device_name">Nome do Dispositivo</Label>
              <Input id="device_name" placeholder="Ex: Tablet Portaria Principal" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_unit">Unidade</Label>
              <Input id="device_unit" placeholder="Ex: Matriz Guarapuava" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device_secret">Secret do Dispositivo</Label>
              <Input id="device_secret" type="password" placeholder="Chave secreta para autorização" />
            </div>
            <Button onClick={handleSave}>Cadastrar Dispositivo</Button>
          </CardContent>
        </Card>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Segurança
            </CardTitle>
            <CardDescription>
              Configurações de bloqueio e tentativas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Bloquear após 5 tentativas incorretas</Label>
                <p className="text-sm text-muted-foreground">
                  Bloqueia o colaborador por 2 minutos
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Cooldown entre batidas</Label>
                <p className="text-sm text-muted-foreground">
                  Impede batidas duplicadas em menos de 3 minutos
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Jornada Padrão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Jornada Padrão
            </CardTitle>
            <CardDescription>
              Configuração padrão para novos colaboradores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_start">Horário de Entrada</Label>
                <Input id="default_start" type="time" defaultValue="08:00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_end">Horário de Saída</Label>
                <Input id="default_end" type="time" defaultValue="18:00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default_break">Intervalo (minutos)</Label>
                <Input id="default_break" type="number" defaultValue="60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default_tolerance">Tolerância (minutos)</Label>
                <Input id="default_tolerance" type="number" defaultValue="10" />
              </div>
            </div>
            <Button onClick={handleSave}>Salvar Configurações</Button>
          </CardContent>
        </Card>

        {/* LGPD */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Privacidade (LGPD)
            </CardTitle>
            <CardDescription>
              Configurações de retenção de dados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="selfie_retention">Retenção de Selfies (dias)</Label>
              <Input id="selfie_retention" type="number" defaultValue="90" />
              <p className="text-sm text-muted-foreground">
                Selfies são automaticamente excluídas após este período
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Criptografar CPF</Label>
                <p className="text-sm text-muted-foreground">
                  Armazenar CPF criptografado além do hash
                </p>
              </div>
              <Switch />
            </div>
            <Button onClick={handleSave}>Salvar Configurações</Button>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
