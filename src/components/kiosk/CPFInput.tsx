import { useState, useRef, useEffect } from 'react';
import { formatCPF, validateCPF } from '@/lib/hash';
import { Button } from '@/components/ui/button';
import { User, ArrowRight, AlertCircle, Delete } from 'lucide-react';

interface CPFInputProps {
  onSubmit: (cpf: string) => void;
}

export function CPFInput({ onSubmit }: CPFInputProps) {
  const [cpf, setCPF] = useState('');
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleKeyPress = (key: string) => {
    if (key === 'delete') {
      const numbers = cpf.replace(/\D/g, '');
      const newNumbers = numbers.slice(0, -1);
      setCPF(formatCPF(newNumbers));
    } else if (key === 'clear') {
      setCPF('');
    } else {
      const numbers = cpf.replace(/\D/g, '');
      if (numbers.length < 11) {
        setCPF(formatCPF(numbers + key));
      }
    }
    setError('');
  };

  const handleSubmit = () => {
    if (!validateCPF(cpf)) {
      setError('CPF inválido');
      return;
    }
    onSubmit(cpf);
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
      } else if (e.key === 'Enter') {
        const numbers = cpf.replace(/\D/g, '');
        if (numbers.length === 11) {
          handleSubmit();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cpf]);

  const isValid = cpf.replace(/\D/g, '').length === 11;

  const keypadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['clear', '0', 'delete'],
  ];

  return (
    <div 
      ref={containerRef}
      className="bg-card rounded-3xl p-8 card-elevated-lg animate-scale-in"
      tabIndex={0}
    >
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Registrar Ponto
        </h1>
        <p className="text-muted-foreground text-sm">
          Digite seu CPF para continuar
        </p>
      </div>

      {/* CPF Display */}
      <div className="mb-4">
        <div className="w-full h-14 flex items-center justify-center text-2xl font-mono tracking-wider 
                      bg-muted rounded-2xl border-2 border-transparent">
          {cpf || <span className="text-muted-foreground/50">000.000.000-00</span>}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-center gap-2 text-destructive text-sm mb-4 animate-fade-in-up">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Keypad */}
      <div className="grid gap-3 mb-6">
        {keypadNumbers.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-3">
            {row.map((key) => (
              <button
                key={key}
                onClick={() => handleKeyPress(key)}
                className="keypad-button flex items-center justify-center"
              >
                {key === 'delete' ? (
                  <Delete className="w-6 h-6 text-muted-foreground" />
                ) : key === 'clear' ? (
                  <span className="text-base text-muted-foreground">Limpar</span>
                ) : (
                  key
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Submit Button */}
      <Button
        type="button"
        disabled={!isValid}
        onClick={handleSubmit}
        className="w-full h-14 text-lg font-semibold rounded-xl kiosk-button"
      >
        Continuar
        <ArrowRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}
