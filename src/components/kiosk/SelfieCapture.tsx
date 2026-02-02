import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface SelfieCaptureProps {
  onCapture: (imageData: string) => void;
  isLoading?: boolean;
}

type CameraError = 'NotAllowedError' | 'NotFoundError' | 'NotReadableError' | 'OverconstrainedError' | 'unknown';

type CameraDebugInfo = {
  lastErrorName?: string;
  lastErrorMessage?: string;
  lastConstraintLabel?: string;
};

const errorMessages: Record<CameraError, { title: string; description: string }> = {
  NotAllowedError: {
    title: 'Permissão negada',
    description: 'Permita o acesso à câmera nas configurações do navegador.',
  },
  NotFoundError: {
    title: 'Câmera não encontrada',
    description: 'Nenhuma câmera foi detectada neste dispositivo.',
  },
  NotReadableError: {
    title: 'Câmera em uso',
    description: 'A câmera pode estar sendo usada por outro aplicativo.',
  },
  OverconstrainedError: {
    title: 'Configuração inválida',
    description: 'A câmera não suporta as configurações solicitadas.',
  },
  unknown: {
    title: 'Erro na câmera',
    description: 'Não foi possível acessar a câmera. Tente novamente.',
  },
};

export function SelfieCapture({ onCapture, isLoading }: SelfieCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<CameraDebugInfo>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);
  const { vibrate } = useHapticFeedback();

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setCameraReady(false);
  }, [stream]);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setIsStartingCamera(true);
    setError(null);
    setDebugInfo({});

    // Limpar stream anterior
    stopCamera();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setDebugInfo({ lastErrorName: 'NotSupportedError', lastErrorMessage: 'mediaDevices.getUserMedia não disponível' });
        setError('unknown');
        return;
      }

      // Alguns devices/navegadores (incluindo variações no Android/Samsung) rejeitam constraints específicas.
      // Tentamos uma sequência de constraints (do mais específico ao mais permissivo).
      const attempts: Array<{ label: string; constraints: MediaStreamConstraints }> = [
        {
          label: 'user + 640x480 (ideal)',
          constraints: {
            video: {
              facingMode: { ideal: 'user' },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          },
        },
        {
          label: 'user (ideal)',
          constraints: {
            video: { facingMode: { ideal: 'user' } },
            audio: false,
          },
        },
        {
          label: 'video: true (fallback)',
          constraints: {
            video: true,
            audio: false,
          },
        },
      ];

      let mediaStream: MediaStream | null = null;
      let lastErr: unknown = null;

      for (const attempt of attempts) {
        try {
          setDebugInfo(prev => ({ ...prev, lastConstraintLabel: attempt.label }));
          mediaStream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
          break;
        } catch (e) {
          lastErr = e;
          // Se for overconstrained, tenta o próximo. Para outros erros, não adianta insistir.
          const name = e instanceof Error ? e.name : '';
          if (name !== 'OverconstrainedError') {
            throw e;
          }
        }
      }

      if (!mediaStream) {
        throw lastErr ?? new Error('Falha ao obter MediaStream');
      }
      
      streamRef.current = mediaStream;
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;

        // Em alguns Androids, autoPlay pode não iniciar imediatamente; tentamos dar play.
        try {
          await videoRef.current.play();
        } catch {
          // Ignorar — o autoplay/muted pode iniciar sozinho.
        }
      }
      
      setError(null);
      setRetryCount(0);
      setCameraReady(true);
    } catch (err) {
      console.error('Camera error:', err);
      
      let errorType: CameraError = 'unknown';
      if (err instanceof Error) {
        setDebugInfo(prev => ({
          ...prev,
          lastErrorName: err.name,
          lastErrorMessage: err.message,
        }));

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorType = 'NotAllowedError';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorType = 'NotFoundError';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorType = 'NotReadableError';
        } else if (err.name === 'OverconstrainedError') {
          errorType = 'OverconstrainedError';
        }
      } else {
        setDebugInfo(prev => ({
          ...prev,
          lastErrorName: typeof err,
        }));
      }
      
      setError(errorType);
      
      // Auto-retry para erros temporários (até 3 vezes)
      if (errorType === 'NotReadableError' && retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          startCamera();
        }, 1500);
      }
    } finally {
      setIsStartingCamera(false);
      isStartingRef.current = false;
    }
  }, [retryCount, stopCamera]);

  // Cleanup ao desmontar - NÃO iniciar automaticamente (requer gesto do usuário em mobile)
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handler para iniciar câmera via gesto do usuário (obrigatório em mobile)
  const handleStartCamera = useCallback(() => {
    vibrate('light');
    startCamera();
  }, [startCamera, vibrate]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Flip horizontally for selfie
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    vibrate('medium');
    stopCamera();
  }, [stopCamera, vibrate]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCameraReady(false);
    vibrate('light');
    startCamera();
  }, [startCamera, vibrate]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      vibrate('success');
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture, vibrate]);

  const handleRetryCamera = useCallback(() => {
    vibrate('light');
    setRetryCount(0);
    startCamera();
  }, [startCamera, vibrate]);

  return (
    <div className="bg-card rounded-3xl p-8 card-elevated-lg animate-scale-in">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Tire uma selfie
        </h1>
        <p className="text-muted-foreground text-sm">
          Posicione seu rosto no centro da tela
        </p>
      </div>

      {/* Camera view */}
      <div className="relative aspect-[4/3] bg-muted rounded-2xl overflow-hidden mb-6">
        {!cameraReady && !error && !isStartingCamera ? (
          // Tela inicial - botão para iniciar câmera (obrigatório em mobile)
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-10 h-10 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              Toque no botão abaixo para ativar a câmera
            </p>
            <Button
              type="button"
              onPointerDown={handleStartCamera}
              onClick={handleStartCamera}
              className="h-14 px-8 text-lg rounded-xl kiosk-button"
            >
              <Camera className="w-5 h-5 mr-2" />
              Ativar Câmera
            </Button>
          </div>
        ) : isStartingCamera && !error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Iniciando câmera...</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {errorMessages[error].title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {errorMessages[error].description}
            </p>

            {(debugInfo.lastErrorName || debugInfo.lastConstraintLabel) && (
              <div className="mb-4 w-full max-w-sm rounded-xl bg-muted/50 p-3 text-left">
                <p className="text-xs font-medium text-foreground">Detalhes (debug)</p>
                {debugInfo.lastConstraintLabel && (
                  <p className="text-xs text-muted-foreground">Constraints: {debugInfo.lastConstraintLabel}</p>
                )}
                {debugInfo.lastErrorName && (
                  <p className="text-xs text-muted-foreground">Erro: {debugInfo.lastErrorName}</p>
                )}
                {debugInfo.lastErrorMessage && (
                  <p className="text-xs text-muted-foreground break-words">Msg: {debugInfo.lastErrorMessage}</p>
                )}
              </div>
            )}

            <Button
              onClick={handleRetryCamera}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar novamente
            </Button>
          </div>
        ) : capturedImage ? (
          <img 
            src={capturedImage} 
            alt="Selfie capturada"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}
        
        {/* Overlay guide */}
        {!capturedImage && !error && !isStartingCamera && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-56 border-4 border-dashed border-primary/50 rounded-full" />
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Actions */}
      {capturedImage ? (
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={retakePhoto}
            disabled={isLoading}
            className="flex-1 h-14 text-lg rounded-xl"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Tirar outra
          </Button>
          <Button
            type="button"
            onClick={confirmPhoto}
            disabled={isLoading}
            className="flex-1 h-14 text-lg rounded-xl kiosk-button gradient-success border-0"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Check className="w-5 h-5 mr-2" />
            )}
            Registrar Ponto
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={capturePhoto}
          disabled={!!error || isStartingCamera}
          className="w-full h-16 text-xl font-semibold rounded-2xl kiosk-button"
        >
          <Camera className="w-6 h-6 mr-2" />
          Capturar Foto
        </Button>
      )}
    </div>
  );
}
