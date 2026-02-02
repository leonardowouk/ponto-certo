import { Check } from 'lucide-react';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function ProgressIndicator({ 
  currentStep, 
  totalSteps, 
  labels = ['CPF', 'PIN', 'Confirmar', 'Selfie']
}: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-4">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        
        return (
          <div key={index} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  transition-all duration-300
                  ${isCompleted 
                    ? 'bg-primary text-primary-foreground' 
                    : isCurrent 
                      ? 'bg-primary/20 border-2 border-primary text-primary' 
                      : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  stepNumber
                )}
              </div>
              {labels[index] && (
                <span 
                  className={`
                    text-[10px] mt-1 transition-colors duration-300
                    ${isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'}
                  `}
                >
                  {labels[index]}
                </span>
              )}
            </div>
            
            {/* Connector line */}
            {index < totalSteps - 1 && (
              <div 
                className={`
                  w-8 h-0.5 mx-1 transition-colors duration-300
                  ${isCompleted ? 'bg-primary' : 'bg-muted'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
