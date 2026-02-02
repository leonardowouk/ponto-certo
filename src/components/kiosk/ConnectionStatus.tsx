import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const { isOnline, isChecking } = useOnlineStatus();

  if (isChecking) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-xs">Verificando conexão...</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className={`flex items-center gap-2 text-destructive animate-pulse ${className}`}>
        <WifiOff className="w-4 h-4" />
        <span className="text-xs font-medium">Sem conexão</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-primary-foreground/60 ${className}`}>
      <Wifi className="w-4 h-4" />
      <span className="text-xs">Conectado</span>
    </div>
  );
}
