import { ReactNode } from 'react';
import { useKioskClock } from '@/hooks/useKioskClock';
import { Clock } from 'lucide-react';
import { ConnectionStatus } from '@/components/kiosk/ConnectionStatus';
import { Toaster } from '@/components/ui/toaster';

interface KioskLayoutProps {
  children: ReactNode;
}

export function KioskLayout({ children }: KioskLayoutProps) {
  const { formattedTime, formattedDate } = useKioskClock();

  return (
    <div className="h-screen w-screen max-h-screen overflow-hidden kiosk-mode gradient-primary flex flex-col">
      {/* Header com hora e status de conexão - compacto para tablet */}
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 text-primary-foreground/90">
            <Clock className="w-5 h-5" />
            <span className="text-sm sm:text-base font-medium capitalize">{formattedDate}</span>
          </div>
          <ConnectionStatus />
        </div>
        <div className="time-display text-3xl sm:text-4xl font-bold text-primary-foreground tracking-wider">
          {formattedTime}
        </div>
      </header>

      {/* Conteúdo principal - otimizado para 1340x800 */}
      <main className="flex-1 flex items-center justify-center px-4 py-2 sm:px-6 sm:py-4 overflow-auto">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer compacto */}
      <footer className="px-4 py-2 text-center text-primary-foreground/60 text-xs">
        Sistema de Ponto Eletrônico
      </footer>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
