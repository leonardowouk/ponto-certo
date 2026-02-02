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
    <div className="min-h-screen kiosk-mode gradient-primary flex flex-col">
      {/* Header com hora e status de conexão */}
      <header className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 text-primary-foreground/90">
            <Clock className="w-6 h-6" />
            <span className="text-lg font-medium capitalize">{formattedDate}</span>
          </div>
          <ConnectionStatus />
        </div>
        <div className="time-display text-5xl font-bold text-primary-foreground tracking-wider">
          {formattedTime}
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-4 text-center text-primary-foreground/60 text-sm">
        Sistema de Ponto Eletrônico
      </footer>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
}
