import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

interface UseHapticFeedbackReturn {
  vibrate: (pattern?: HapticPattern) => void;
  isSupported: boolean;
}

const patterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [25, 50, 25],
  error: [50, 25, 50, 25, 50],
  warning: [25, 25, 25],
};

export function useHapticFeedback(): UseHapticFeedbackReturn {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const vibrate = useCallback((pattern: HapticPattern = 'light') => {
    if (!isSupported) return;

    try {
      const vibrationPattern = patterns[pattern];
      navigator.vibrate(vibrationPattern);
    } catch (error) {
      // Silently fail - vibration is just enhancement
      console.debug('Vibration failed:', error);
    }
  }, [isSupported]);

  return { vibrate, isSupported };
}
