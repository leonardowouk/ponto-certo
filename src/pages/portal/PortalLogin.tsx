import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Mail, Lock, Loader2, User, KeyRound } from 'lucide-react';
import { hashCPF } from '@/lib/hash';

export default function PortalLogin() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cpf, setCpf] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotMethod, setForgotMethod] = useState<'email' | 'cpfpin'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCpf, setForgotCpf] = useState('');
  const [forgotPin, setForgotPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const resetForgotState = () => {
    setShowForgot(false);
    setForgotMethod('email');
    setForgotEmail('');
    setForgotCpf('');
    setForgotPin('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast({ title: 'Informe seu email', variant: 'destructive' });
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/portal/reset-password`,
      });
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      resetForgotState();
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotCpfPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotCpf || !forgotPin || !newPassword) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setForgotLoading(true);
    try {
      const cpfClean = forgotCpf.replace(/\D/g, '');
      const cpfHash = await hashCPF(cpfClean);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/reset-password-cpf-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ cpf_hash: cpfHash, pin: forgotPin, new_password: newPassword }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: 'Senha redefinida!', description: `${result.employee_name}, faça login com sua nova senha.` });
      resetForgotState();
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setForgotLoading(false);
    }
  };

  const formatCPF = (val: string) => {
    const nums = val.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 3) return nums;
    if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
    if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
    return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: 'Erro', description: 'Email ou senha incorretos', variant: 'destructive' });
        return;
      }

      // Check if user is a colaborador
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee) {
        await supabase.auth.signOut();
        toast({ title: 'Acesso negado', description: 'Esta conta não está vinculada a um colaborador.', variant: 'destructive' });
        return;
      }

      navigate('/portal');
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpf || !pin || !email || !password) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const cpfClean = cpf.replace(/\D/g, '');
      const cpfHash = await hashCPF(cpfClean);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/register-employee-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'apikey': anonKey,
          },
          body: JSON.stringify({ email, password, cpf_hash: cpfHash, pin }),
        }
      );

      const result = await response.json();
      if (!response.ok) {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
        return;
      }

      toast({ title: `Bem-vindo, ${result.employee_name}!`, description: 'Conta criada. Faça login.' });
      setTab('login');
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md card-elevated-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Portal do Colaborador</CardTitle>
          <CardDescription>Acesse seus documentos, pontos e solicitações</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'register')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Primeiro Acesso</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" disabled={loading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" disabled={loading} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Entrar
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors mt-2"
                >
                  Esqueci minha senha
                </button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Para criar sua conta, informe seu CPF e PIN cadastrados pela empresa.</p>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} className="pl-10" disabled={loading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>PIN</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} className="pl-10" disabled={loading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email (para login)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" disabled={loading} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" disabled={loading} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <a href="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Acesso administrativo →
            </a>
          </div>
        </CardContent>
      </Card>

      {showForgot && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md card-elevated-lg">
            <CardHeader>
              <CardTitle>Recuperar senha</CardTitle>
              <CardDescription>Escolha como deseja recuperar sua senha.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={forgotMethod} onValueChange={(v) => setForgotMethod(v as 'email' | 'cpfpin')}>
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="email">Via Email</TabsTrigger>
                  <TabsTrigger value="cpfpin">Via CPF + PIN</TabsTrigger>
                </TabsList>

                <TabsContent value="email">
                  <form onSubmit={handleForgotEmail} className="space-y-4">
                    <p className="text-sm text-muted-foreground">Enviaremos um link de recuperação para seu email cadastrado.</p>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" placeholder="seu@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="pl-10" disabled={forgotLoading} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={resetForgotState} disabled={forgotLoading}>Cancelar</Button>
                      <Button type="submit" className="flex-1" disabled={forgotLoading}>
                        {forgotLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Enviar
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                <TabsContent value="cpfpin">
                  <form onSubmit={handleForgotCpfPin} className="space-y-4">
                    <p className="text-sm text-muted-foreground">Informe seu CPF e PIN para redefinir a senha imediatamente.</p>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="000.000.000-00" value={forgotCpf} onChange={e => setForgotCpf(formatCPF(e.target.value))} className="pl-10" disabled={forgotLoading} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>PIN</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••" maxLength={6} value={forgotPin} onChange={e => setForgotPin(e.target.value.replace(/\D/g, ''))} className="pl-10" disabled={forgotLoading} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nova senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="pl-10" disabled={forgotLoading} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Confirmar nova senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="password" placeholder="Repita a senha" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} className="pl-10" disabled={forgotLoading} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={resetForgotState} disabled={forgotLoading}>Cancelar</Button>
                      <Button type="submit" className="flex-1" disabled={forgotLoading}>
                        {forgotLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Redefinir
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
