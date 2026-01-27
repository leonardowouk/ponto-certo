import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, Loader2 } from 'lucide-react';

interface SelfieCaptureProps {
  onCapture: (imageData: string) => void;
  isLoading?: boolean;
}

export function SelfieCapture({ onCapture, isLoading }: SelfieCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
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
    stopCamera();
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmPhoto = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

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
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-destructive text-center">{error}</p>
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
        {!capturedImage && !error && (
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
          disabled={!!error}
          className="w-full h-16 text-xl font-semibold rounded-2xl kiosk-button"
        >
          <Camera className="w-6 h-6 mr-2" />
          Capturar Foto
        </Button>
      )}
    </div>
  );
}
