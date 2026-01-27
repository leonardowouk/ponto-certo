import { useState, useRef, useEffect } from 'react';
import { formatCPF, validateCPF } from '@/lib/hash';
import { Button } from '@/components/ui/button';
import { User, ArrowRight, AlertCircle } from 'lucide-react';

interface CPFInputProps {
  onSubmit: (cpf: string) => void;
}

export function CPFInput({ onSubmit }: CPFInputProps) {
  const [cpf, setCPF] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCPF(formatted);
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCPF(cpf)) {
      setError('CPF inválido');
      return;
    }
    
    onSubmit(cpf);
  };

  const isValid = cpf.replace(/\D/g, '').length === 11;

  return (
    <div className="bg-card rounded-3xl p-8 card-elevated-lg animate-scale-in">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Registrar Ponto
        </h1>
        <p className="text-muted-foreground">
          Digite seu CPF para continuar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={handleChange}
            placeholder="000.000.000-00"
            className="w-full h-16 text-center text-2xl font-mono tracking-wider 
                       bg-muted rounded-2xl border-2 border-transparent 
                       focus:border-primary focus:outline-none focus:ring-0
                       transition-colors placeholder:text-muted-foreground/50"
            autoComplete="off"
          />
          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm animate-fade-in-up">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={!isValid}
          className="w-full h-16 text-xl font-semibold rounded-2xl kiosk-button 
                     bg-primary hover:bg-primary/90 disabled:opacity-50"
        >
          Continuar
          <ArrowRight className="w-6 h-6 ml-2" />
        </Button>
      </form>
    </div>
  );
}
