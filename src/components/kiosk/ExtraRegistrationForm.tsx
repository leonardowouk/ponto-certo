import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, ArrowRight, UserPlus } from 'lucide-react';
import { formatCPF, validateCPF } from '@/lib/hash';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface ExtraRegistrationFormProps {
  onSubmit: (data: { nomeCompleto: string; cpf: string }) => void;
  onBack: () => void;
}

export function ExtraRegistrationForm({ onSubmit, onBack }: ExtraRegistrationFormProps) {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [cpf, setCPF] = useState('');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const { vibrate } = useHapticFeedback();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleCPFChange = (value: string) => {
    setCPF(formatCPF(value));
    setError('');
  };

  const handleSubmit = () => {
    const normalizedName = nomeCompleto.trim().replace(/\s+/g, ' ');
    if (normalizedName.length < 5 || !normalizedName.includes(' ')) {
      setError('Informe nome e sobrenome');
      vibrate('error');
      return;
    }
    if (!validateCPF(cpf)) {
      setError('CPF inválido');
      vibrate('error');
      return;
    }
    vibrate('medium');
    onSubmit({ nomeCompleto: normalizedName, cpf });
  };

  return (
    <div className="bg-card rounded-3xl p-8 card-elevated-lg animate-scale-in">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Registro Extra</h1>
        <p className="text-muted-foreground text-sm">Informe os dados da pessoa</p>
      </div>

      <div className="space-y-4 mb-4">
        <div className="space-y-2">
          <Label htmlFor="extra-name">Nome completo</Label>
          <Input
            ref={nameRef}
            id="extra-name"
            value={nomeCompleto}
            onChange={(e) => { setNomeCompleto(e.target.value); setError(''); }}
            className="h-14 text-lg rounded-xl"
            autoComplete="name"
            maxLength={160}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="extra-cpf">CPF</Label>
          <Input
            id="extra-cpf"
            value={cpf}
            onChange={(e) => handleCPFChange(e.target.value)}
            className="h-14 text-lg rounded-xl font-mono tracking-wider"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 text-destructive text-sm mb-4 animate-fade-in-up">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1 h-14 text-lg rounded-xl">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </Button>
        <Button type="button" onClick={handleSubmit} className="flex-1 h-14 text-lg font-semibold rounded-xl kiosk-button">
          Continuar
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
