import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, Tablet, Shield, Users } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen gradient-primary">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6 backdrop-blur">
            <Clock className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-4">
            Sistema de Ponto Eletrônico
          </h1>
          <p className="text-xl text-primary-foreground/80 max-w-2xl mx-auto">
            Controle de jornada, banco de horas e registro de ponto com segurança e praticidade
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
            <Tablet className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary-foreground mb-2">
              Modo Quiosque
            </h3>
            <p className="text-primary-foreground/70 text-sm">
              Interface simples para registro rápido via tablet na entrada
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
            <Shield className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary-foreground mb-2">
              Segurança Avançada
            </h3>
            <p className="text-primary-foreground/70 text-sm">
              CPF e PIN criptografados, validação com selfie e LGPD compliant
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
            <Users className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-primary-foreground mb-2">
              Gestão Completa
            </h3>
            <p className="text-primary-foreground/70 text-sm">
              Painel administrativo com espelho de ponto e banco de horas
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/kiosk">
            <Button 
              size="lg" 
              className="w-full sm:w-auto h-14 px-8 text-lg bg-white text-primary hover:bg-white/90"
            >
              <Tablet className="w-5 h-5 mr-2" />
              Modo Quiosque
            </Button>
          </Link>
          <Link to="/auth">
            <Button 
              size="lg" 
              variant="outline"
              className="w-full sm:w-auto h-14 px-8 text-lg border-white/50 text-primary-foreground hover:bg-white/10"
            >
              <Users className="w-5 h-5 mr-2" />
              Painel Admin
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
