import { useState, useCallback } from 'react';
import { KioskLayout } from '@/components/kiosk/KioskLayout';
import { CPFInput } from '@/components/kiosk/CPFInput';
import { PINInput } from '@/components/kiosk/PINInput';
import { ConfirmIdentity } from '@/components/kiosk/ConfirmIdentity';
import { SelfieCapture } from '@/components/kiosk/SelfieCapture';
import { PunchSuccess } from '@/components/kiosk/PunchSuccess';
import { supabase } from '@/integrations/supabase/client';
import { hashCPF } from '@/lib/hash';

type Step = 'cpf' | 'pin' | 'confirm' | 'selfie' | 'success';

interface EmployeeData {
  id: string;
  nome: string;
  foto_cadastro_url?: string;
}

interface PunchResult {
  punchType: string;
  punchTime: Date;
}

// Para demo, usamos um device_secret fixo. Em produção, seria configurado no tablet.
const DEVICE_SECRET = 'demo-device-secret-123';
const UNIDADE = 'Matriz';

export default function KioskPage() {
  const [step, setStep] = useState<Step>('cpf');
  const [cpf, setCPF] = useState('');
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null);
  const [pinError, setPinError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCPFSubmit = async (submittedCPF: string) => {
    setCPF(submittedCPF);
    setStep('pin');
  };

  const handlePINSubmit = async (pin: string) => {
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
        setPinError('Erro ao validar. Tente novamente.');
        return;
      }

      if (!data.success) {
        setPinError(data.message || 'Credenciais inválidas');
        return;
      }

      setEmployee(data.employee);
      setStep('confirm');
    } catch (err) {
      console.error('Validation error:', err);
      setPinError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    setStep('selfie');
  };

  const handleSelfieCapture = async (imageData: string) => {
    if (!employee) return;

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
        alert('Erro ao registrar ponto. Tente novamente.');
        return;
      }

      if (!data.success) {
        alert(data.message || 'Erro ao registrar ponto');
        return;
      }

      setPunchResult({
        punchType: data.punch_type,
        punchTime: new Date(data.punched_at),
      });
      setStep('success');
    } catch (err) {
      console.error('Punch error:', err);
      alert('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = useCallback(() => {
    setStep('cpf');
    setCPF('');
    setEmployee(null);
    setPunchResult(null);
    setPinError('');
  }, []);

  const handleBack = () => {
    if (step === 'pin') {
      setStep('cpf');
      setPinError('');
    } else if (step === 'confirm') {
      setStep('pin');
    }
  };

  return (
    <KioskLayout>
      {step === 'cpf' && (
        <CPFInput onSubmit={handleCPFSubmit} />
      )}

      {step === 'pin' && (
        <PINInput 
          onSubmit={handlePINSubmit} 
          onBack={handleBack}
          error={pinError}
        />
      )}

      {step === 'confirm' && employee && (
        <ConfirmIdentity
          employeeName={employee.nome}
          employeePhoto={employee.foto_cadastro_url}
          onConfirm={handleConfirm}
          onBack={handleBack}
        />
      )}

      {step === 'selfie' && (
        <SelfieCapture 
          onCapture={handleSelfieCapture}
          isLoading={isLoading}
        />
      )}

      {step === 'success' && employee && punchResult && (
        <PunchSuccess
          employeeName={employee.nome}
          punchType={punchResult.punchType}
          punchTime={punchResult.punchTime}
          onReset={handleReset}
        />
      )}
    </KioskLayout>
  );
}
