import { Button } from '@/components/ui/button';
import { Check, ArrowLeft, User } from 'lucide-react';

interface ConfirmIdentityProps {
  employeeName: string;
  employeePhoto?: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function ConfirmIdentity({ 
  employeeName, 
  employeePhoto, 
  onConfirm, 
  onBack 
}: ConfirmIdentityProps) {
  return (
    <div className="bg-card rounded-3xl p-8 card-elevated-lg animate-scale-in">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Confirma que é você?
        </h1>
        <p className="text-muted-foreground">
          Verifique seus dados antes de continuar
        </p>
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mb-4 overflow-hidden border-4 border-primary/20">
          {employeePhoto ? (
            <img 
              src={employeePhoto} 
              alt={employeeName}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-16 h-16 text-muted-foreground" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {employeeName}
        </h2>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1 h-14 text-lg rounded-xl"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Não sou eu
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          className="flex-1 h-14 text-lg rounded-xl kiosk-button gradient-primary border-0"
        >
          <Check className="w-5 h-5 mr-2" />
          Confirmar
        </Button>
      </div>
    </div>
  );
}
