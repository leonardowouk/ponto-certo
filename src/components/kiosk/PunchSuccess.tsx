import { useEffect, useState } from 'react';
import { CheckCircle2, User } from 'lucide-react';
import { getPunchTypeLabel } from '@/lib/hash';

interface PunchSuccessProps {
  employeeName: string;
  punchType: string;
  punchTime: Date;
  selfieImage?: string;
  onReset: () => void;
}

export function PunchSuccess({ 
  employeeName, 
  punchType, 
  punchTime,
  selfieImage,
  onReset 
}: PunchSuccessProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onReset]);

  const formattedTime = punchTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="bg-card rounded-3xl p-6 card-elevated-lg animate-scale-in">
      <div className="text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4 animate-pulse-success">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Ponto Registrado!
        </h1>
        
        <p className="text-lg text-muted-foreground mb-4">
          Olá, <span className="font-semibold text-foreground">{employeeName}</span>
        </p>

        {/* Selfie Preview */}
        <div className="flex justify-center mb-4">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-success/30 shadow-lg">
            {selfieImage ? (
              <img 
                src={selfieImage} 
                alt="Selfie registrada"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <User className="w-10 h-10 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Punch Details */}
        <div className="bg-muted rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted-foreground text-sm">Tipo:</span>
            <span className="font-semibold text-foreground">
              {getPunchTypeLabel(punchType)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Horário:</span>
            <span className="font-mono font-bold text-xl text-primary">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Countdown */}
        <p className="text-muted-foreground text-xs">
          Voltando à tela inicial em{' '}
          <span className="font-bold text-foreground">{countdown}</span> segundos...
        </p>
      </div>
    </div>
  );
}
