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
  videoState?: string;
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
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<CameraDebugInfo>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setVideoPlaying(false);
  }, [stream]);

  const startCamera = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    setIsStartingCamera(true);
    setError(null);
    setDebugInfo({});
    setVideoPlaying(false);

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
      let successLabel = '';

      for (const attempt of attempts) {
        try {
          setDebugInfo(prev => ({ ...prev, lastConstraintLabel: attempt.label }));
          mediaStream = await navigator.mediaDevices.getUserMedia(attempt.constraints);
          successLabel = attempt.label;
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
      setDebugInfo(prev => ({ ...prev, lastConstraintLabel: successLabel, videoState: 'connecting' }));
      
      // Aguardar o vídeo estar pronto antes de considerar câmera pronta
      const video = videoRef.current;
      if (video) {
        // Limpar srcObject antes de reatribuir (ajuda em alguns dispositivos)
        video.srcObject = null;
        video.srcObject = mediaStream;
        
        setDebugInfo(prev => ({ ...prev, videoState: 'srcObject assigned' }));

        // Usar evento 'loadedmetadata' + 'playing' para garantir que o vídeo está funcionando
        const onLoadedMetadata = () => {
          setDebugInfo(prev => ({ ...prev, videoState: 'loadedmetadata' }));
        };
        
        const onPlaying = () => {
          setDebugInfo(prev => ({ ...prev, videoState: 'playing' }));
          setVideoPlaying(true);
          setCameraReady(true);
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('playing', onPlaying);
          video.removeEventListener('canplay', onCanPlay);
        };

        const onCanPlay = () => {
          setDebugInfo(prev => ({ ...prev, videoState: 'canplay' }));
          // Em alguns dispositivos Samsung, o evento 'playing' não dispara
          // Se canplay disparar, tentamos forçar o play
          video.play().then(() => {
            setVideoPlaying(true);
            setCameraReady(true);
          }).catch(() => {
            // Se falhar, deixamos o autoPlay tentar
          });
        };

        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('canplay', onCanPlay);

        // Tentar dar play manualmente (necessário em alguns Androids)
        try {
          await video.play();
          setDebugInfo(prev => ({ ...prev, videoState: 'play() called' }));
        } catch (playErr) {
          setDebugInfo(prev => ({ ...prev, videoState: `play error: ${playErr}` }));
          // Ignorar — o autoplay/muted pode iniciar sozinho.
        }

        // Fallback: se após 2 segundos ainda não estiver playing, marcar como pronto mesmo assim
        setTimeout(() => {
          if (!cameraReady && streamRef.current) {
            setDebugInfo(prev => ({ ...prev, videoState: 'timeout fallback' }));
            setVideoPlaying(true);
            setCameraReady(true);
          }
        }, 2000);
      }
      
      setError(null);
      setRetryCount(0);
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
  }, [retryCount, stopCamera, cameraReady]);

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

    // Garantir que o vídeo tem dimensões válidas
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;
    
    // Flip horizontally for selfie
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(imageData);
    vibrate('medium');
    stopCamera();
  }, [stopCamera, vibrate]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setCameraReady(false);
    setVideoPlaying(false);
    vibrate('light');
    startCamera();
  }, [startCamera, vibrate]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage && !isSubmitting) {
      setIsSubmitting(true);
      vibrate('success');
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture, vibrate, isSubmitting]);

  const handleRetryCamera = useCallback(() => {
    vibrate('light');
    setRetryCount(0);
    startCamera();
  }, [startCamera, vibrate]);

  // Determinar se devemos mostrar o vídeo (câmera ativa e stream conectado)
  const showVideo = cameraReady && !capturedImage && !error;
  const showLoading = isStartingCamera || (cameraReady && !videoPlaying && !capturedImage && !error);

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
      <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden mb-6">
        {capturedImage ? (
          // Mostrar imagem capturada PRIMEIRO (prioridade sobre outros estados)
          <img 
            src={capturedImage} 
            alt="Selfie capturada"
            className="w-full h-full object-cover"
          />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-muted">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {errorMessages[error].title}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {errorMessages[error].description}
            </p>

            {(debugInfo.lastErrorName || debugInfo.lastConstraintLabel || debugInfo.videoState) && (
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
                {debugInfo.videoState && (
                  <p className="text-xs text-muted-foreground">Video: {debugInfo.videoState}</p>
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
        ) : !cameraReady && !isStartingCamera ? (
          // Tela inicial - botão para iniciar câmera (obrigatório em mobile)
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-muted">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-10 h-10 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm text-center">
              Toque no botão abaixo para ativar a câmera
            </p>
            <Button
              type="button"
              onTouchStart={handleStartCamera}
              onClick={handleStartCamera}
              className="h-14 px-8 text-lg rounded-xl kiosk-button"
            >
              <Camera className="w-5 h-5 mr-2" />
              Ativar Câmera
            </Button>
          </div>
        ) : (
          <>
            {/* Video element - sempre presente quando câmera está ativa */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              webkit-playsinline="true"
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            
            {/* Loading overlay sobre o vídeo enquanto não está playing */}
            {showLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/90">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-muted-foreground text-sm">Iniciando câmera...</p>
                {debugInfo.videoState && (
                  <p className="text-xs text-muted-foreground">Estado: {debugInfo.videoState}</p>
                )}
              </div>
            )}
          </>
        )}
        
        {/* Overlay guide */}
        {showVideo && videoPlaying && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-56 border-4 border-dashed border-white/50 rounded-full" />
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
            disabled={isLoading || isSubmitting}
            className="flex-1 h-14 text-lg rounded-xl"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            Tirar outra
          </Button>
          <Button
            type="button"
            onClick={confirmPhoto}
            disabled={isLoading || isSubmitting}
            className="flex-1 h-14 text-lg rounded-xl kiosk-button gradient-success border-0"
          >
            {(isLoading || isSubmitting) ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Check className="w-5 h-5 mr-2" />
            )}
            {isSubmitting ? 'Registrando...' : 'Registrar Ponto'}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={capturePhoto}
          disabled={!!error || !videoPlaying}
          className="w-full h-16 text-xl font-semibold rounded-2xl kiosk-button"
        >
          <Camera className="w-6 h-6 mr-2" />
          Capturar Foto
        </Button>
      )}
    </div>
  );
}
