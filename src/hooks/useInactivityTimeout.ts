import { useEffect, useRef, useCallback } from 'react';

interface UseInactivityTimeoutOptions {
  timeout: number; // em milissegundos
  onTimeout: () => void;
  enabled?: boolean;
}

export function useInactivityTimeout({ 
  timeout, 
  onTimeout, 
  enabled = true 
}: UseInactivityTimeoutOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Manter referência atualizada do callback
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, timeout);
    }
  }, [timeout, enabled]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'touchmove',
      'click',
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Iniciar timer
    resetTimer();

    // Adicionar listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimer();
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer, clearTimer]);

  return { resetTimer, clearTimer };
}
