import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { getPunchTypeLabel } from '@/lib/hash';

interface PunchSuccessProps {
  employeeName: string;
  punchType: string;
  punchTime: Date;
  onReset: () => void;
}

export function PunchSuccess({ 
  employeeName, 
  punchType, 
  punchTime,
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
    <div className="bg-card rounded-3xl p-8 card-elevated-lg animate-scale-in">
      <div className="text-center">
        {/* Success Icon */}
        <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 animate-pulse-success">
          <CheckCircle2 className="w-14 h-14 text-success" />
        </div>

        {/* Success Message */}
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Ponto Registrado!
        </h1>
        
        <p className="text-xl text-muted-foreground mb-6">
          Olá, <span className="font-semibold text-foreground">{employeeName}</span>
        </p>

        {/* Punch Details */}
        <div className="bg-muted rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted-foreground">Tipo:</span>
            <span className="font-semibold text-foreground text-lg">
              {getPunchTypeLabel(punchType)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Horário:</span>
            <span className="font-mono font-bold text-2xl text-primary">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Countdown */}
        <p className="text-muted-foreground text-sm">
          Voltando à tela inicial em{' '}
          <span className="font-bold text-foreground">{countdown}</span> segundos...
        </p>
      </div>
    </div>
  );
}
