import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KioskLayout } from '@/components/kiosk/KioskLayout';
import { CPFInput } from '@/components/kiosk/CPFInput';
import { PINInput } from '@/components/kiosk/PINInput';
import { ConfirmIdentity } from '@/components/kiosk/ConfirmIdentity';
import { SelfieCapture } from '@/components/kiosk/SelfieCapture';
import { PunchSuccess } from '@/components/kiosk/PunchSuccess';
import { ProgressIndicator } from '@/components/kiosk/ProgressIndicator';
import { ExtraRegistrationForm } from '@/components/kiosk/ExtraRegistrationForm';
import { supabase } from '@/integrations/supabase/client';
import { hashCPF } from '@/lib/hash';
import { useInactivityTimeout } from '@/hooks/useInactivityTimeout';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, UserPlus } from 'lucide-react';

type Step = 'cpf' | 'pin' | 'confirm' | 'selfie' | 'extra_form' | 'extra_selfie' | 'success';

interface EmployeeData {
  id: string;
  nome: string;
  foto_cadastro_url?: string;
}

interface PunchResult {
  punchType: string;
  punchTime: Date;
  selfieImage: string;
}

interface ExtraData {
  nomeCompleto: string;
  cpf: string;
}

// Para demo, usamos um device_secret fixo. Em produção, seria configurado no tablet.
const DEVICE_SECRET = 'demo-device-secret-123';
const UNIDADE = 'Matriz';
const INACTIVITY_TIMEOUT = 60000; // 60 segundos

const stepToNumber: Record<Step, number> = {
  cpf: 1,
  pin: 2,
  confirm: 3,
  selfie: 4,
  success: 5,
};

export default function KioskPage() {
  const [step, setStep] = useState<Step>('cpf');
  const [cpf, setCPF] = useState('');
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null);
  const [pinError, setPinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selfieSessionId, setSelfieSessionId] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [extraData, setExtraData] = useState<ExtraData | null>(null);
  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();

  const handleReset = useCallback(() => {
    setStep('cpf');
    setCPF('');
    setEmployee(null);
    setPunchResult(null);
    setPinError('');
    setIsLoading(false);
    setSelfieSessionId(0);
    setIsAdmin(false);
    setExtraData(null);
  }, []);

  // Inactivity timeout - reset after 60 seconds of no activity
  useInactivityTimeout({
    timeout: INACTIVITY_TIMEOUT,
    onTimeout: () => {
      if (step !== 'cpf' && step !== 'success') {
        toast({
          title: 'Sessão expirada',
          description: 'Reiniciando por inatividade...',
          variant: 'destructive',
        });
        handleReset();
      }
    },
    enabled: step !== 'cpf' && step !== 'success',
  });

  // Check online status before actions
  const checkOnline = useCallback(() => {
    if (!isOnline) {
      toast({
        title: 'Sem conexão',
        description: 'Verifique sua conexão com a internet.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [isOnline, toast]);

  const handleCPFSubmit = async (submittedCPF: string) => {
    if (!checkOnline()) return;
    setCPF(submittedCPF);
    setStep('pin');
  };

  const handlePINSubmit = async (pin: string) => {
    if (!checkOnline()) return;
    
    setIsLoading(true);
    setPinError('');

    try {
      const cpfHash = await hashCPF(cpf);
      
      // Chama edge function para validar credenciais
      const { data, error } = await supabase.functions.invoke('ponto-validate', {
        body: {
          cpf_hash: cpfHash,
          pin,
          device_secret: DEVICE_SECRET,
          action: 'validate',
        },
      });

      if (error) {
        console.error('Validation error:', error);
        setPinError('Erro ao validar. Tente novamente.');
        return;
      }

      if (!data.success) {
        setPinError(data.message || 'Credenciais inválidas');
        return;
      }

      setEmployee(data.employee);
      setIsAdmin(data.is_admin || false);
      setStep('confirm');
    } catch (err) {
      console.error('Validation error:', err);
      setPinError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminAccess = async () => {
    if (!employee) return;
    if (!checkOnline()) return;

    setIsLoading(true);
    try {
      const cpfHash = await hashCPF(cpf);
      const { data, error } = await supabase.functions.invoke('ponto-validate', {
        body: {
          cpf_hash: cpfHash,
          device_secret: DEVICE_SECRET,
          action: 'admin_login',
        },
      });

      if (error || !data?.success) {
        toast({
          title: 'Erro',
          description: data?.message || 'Não foi possível acessar o painel admin',
          variant: 'destructive',
        });
        return;
      }

      // Use the magic link token to sign in
      const { error: authError } = await supabase.auth.verifyOtp({
        token_hash: data.admin_token,
        type: 'magiclink',
      });

      if (authError) {
        console.error('Admin auth error:', authError);
        toast({
          title: 'Erro de autenticação',
          description: 'Não foi possível autenticar. Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      navigate('/admin');
    } catch (err) {
      console.error('Admin access error:', err);
      toast({
        title: 'Erro',
        description: 'Erro de conexão. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    // Remonta o componente de selfie apenas ao ENTRAR nesta etapa,
    // evitando reset visual durante renders (ex.: isLoading).
    setSelfieSessionId(prev => prev + 1);
    setStep('selfie');
  };

  const handleStartExtra = () => {
    setExtraData(null);
    setPunchResult(null);
    setSelfieSessionId(prev => prev + 1);
    setStep('extra_form');
  };

  const handleExtraFormSubmit = (data: ExtraData) => {
    setExtraData(data);
    setSelfieSessionId(prev => prev + 1);
    setStep('extra_selfie');
  };

  const handleSelfieCapture = async (imageData: string) => {
    if (!employee) return;
    if (!checkOnline()) return;

    setIsLoading(true);

    try {
      const cpfHash = await hashCPF(cpf);

      // Chama edge function para registrar ponto
      const { data, error } = await supabase.functions.invoke('ponto-validate', {
        body: {
          cpf_hash: cpfHash,
          device_secret: DEVICE_SECRET,
          unidade: UNIDADE,
          selfie_image: imageData,
          action: 'punch',
        },
      });

      if (error) {
        console.error('Punch error:', error);
        toast({
          title: 'Erro ao registrar ponto',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      if (!data.success) {
        toast({
          title: 'Erro',
          description: data.message || 'Erro ao registrar ponto',
          variant: 'destructive',
        });
        return;
      }

      setPunchResult({
        punchType: data.punch_type,
        punchTime: new Date(data.punched_at),
        selfieImage: imageData,
      });
      setStep('success');
    } catch (err) {
      console.error('Punch error:', err);
      toast({
        title: 'Erro de conexão',
        description: 'Verifique sua internet e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtraSelfieCapture = async (imageData: string) => {
    if (!extraData) return;
    if (!checkOnline()) return;

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('extra-time-record', {
        body: {
          nome_completo: extraData.nomeCompleto,
          cpf: extraData.cpf,
          device_secret: DEVICE_SECRET,
          selfie_image: imageData,
        },
      });

      if (error || !data?.success) {
        toast({
          title: 'Erro no registro extra',
          description: data?.message || 'Tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      setEmployee({ id: 'extra', nome: extraData.nomeCompleto });
      setPunchResult({
        punchType: data.action === 'saida' ? 'saida' : 'entrada',
        punchTime: new Date(data.registered_at),
        selfieImage: imageData,
      });
      setStep('success');
    } catch (err) {
      console.error('Extra punch error:', err);
      toast({
        title: 'Erro de conexão',
        description: 'Verifique sua internet e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'pin') {
      setStep('cpf');
      setPinError('');
    } else if (step === 'confirm') {
      setStep('pin');
    } else if (step === 'extra_form') {
      setStep('cpf');
    } else if (step === 'extra_selfie') {
      setStep('extra_form');
    }
  };

  // Disable double-tap zoom on the kiosk page
  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    let lastTap = 0;
    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
      }
      lastTap = now;
    };

    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('touchend', preventDoubleTap, { passive: false });

    return () => {
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('touchend', preventDoubleTap);
    };
  }, []);

  const currentStepNumber = stepToNumber[step];
  const showProgress = !['success', 'extra_form', 'extra_selfie'].includes(step);

  return (
    <KioskLayout>
      {step === 'cpf' && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleStartExtra}
          className="fixed left-4 bottom-4 z-10 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Registro Extra
        </Button>
      )}

      {showProgress && (
        <div className="mb-4">
          <ProgressIndicator currentStep={currentStepNumber} totalSteps={4} />
        </div>
      )}

      {step === 'cpf' && (
        <CPFInput onSubmit={handleCPFSubmit} />
      )}

      {step === 'pin' && (
        <PINInput 
          onSubmit={handlePINSubmit} 
          onBack={handleBack}
          error={pinError}
          isLoading={isLoading}
        />
      )}

      {step === 'confirm' && employee && (
        <ConfirmIdentity
          employeeName={employee.nome}
          employeePhoto={employee.foto_cadastro_url}
          isAdmin={isAdmin}
          onConfirm={handleConfirm}
          onAdminAccess={isAdmin ? handleAdminAccess : undefined}
          onBack={handleBack}
        />
      )}

      {step === 'selfie' && (
        <SelfieCapture 
          key={`selfie-${selfieSessionId}`}
          onCapture={handleSelfieCapture}
          isLoading={isLoading}
        />
      )}

      {step === 'extra_form' && (
        <ExtraRegistrationForm onSubmit={handleExtraFormSubmit} onBack={handleBack} />
      )}

      {step === 'extra_selfie' && (
        <SelfieCapture
          key={`extra-selfie-${selfieSessionId}`}
          onCapture={handleExtraSelfieCapture}
          isLoading={isLoading}
        />
      )}

      {step === 'success' && employee && punchResult && (
        <PunchSuccess
          employeeName={employee.nome}
          punchType={punchResult.punchType}
          punchTime={punchResult.punchTime}
          selfieImage={punchResult.selfieImage}
          onReset={handleReset}
        />
      )}
    </KioskLayout>
  );
}
