import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, ArrowRight, Delete, AlertCircle, Loader2 } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PINInputProps {
  onSubmit: (pin: string) => void;
  onBack: () => void;
  error?: string;
  isLoading?: boolean;
}

export function PINInput({ onSubmit, onBack, error, isLoading }: PINInputProps) {
  const [pin, setPin] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const { vibrate } = useHapticFeedback();

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Reset PIN when error changes (new error = wrong PIN)
  useEffect(() => {
    if (error) {
      setPin('');
      vibrate('error');
    }
  }, [error, vibrate]);

  const handleKeyPress = useCallback((key: string) => {
    if (isLoading) return;
    
    vibrate('light');
    
    if (key === 'delete') {
      setPin(prev => prev.slice(0, -1));
    } else if (key === 'clear') {
      setPin('');
    } else if (pin.length < 6) {
      setPin(prev => prev + key);
    }
  }, [isLoading, pin.length, vibrate]);

  const handleSubmit = useCallback(() => {
    if (pin.length === 6 && !isLoading) {
      vibrate('medium');
      onSubmit(pin);
    }
  }, [pin, isLoading, onSubmit, vibrate]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading) return;
      
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
      } else if (e.key === 'Enter' && pin.length === 6) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isLoading, handleKeyPress, handleSubmit]);

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
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Digite seu PIN
        </h1>
        <p className="text-muted-foreground text-sm">
          6 dígitos
        </p>
      </div>

      {/* PIN Display */}
      <div className="flex justify-center gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center
                       transition-all duration-200
                       ${i < pin.length 
                         ? 'bg-primary border-primary' 
                         : 'bg-muted border-border'}`}
          >
            {i < pin.length && (
              <div className="w-3 h-3 rounded-full bg-primary-foreground" />
            )}
          </div>
        ))}
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
                disabled={isLoading}
                className="keypad-button flex items-center justify-center disabled:opacity-50"
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

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 h-14 text-lg rounded-xl"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Voltar
        </Button>
        <Button
          type="button"
          disabled={pin.length !== 6 || isLoading}
          onClick={handleSubmit}
          className="flex-1 h-14 text-lg rounded-xl kiosk-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              Confirmar
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
