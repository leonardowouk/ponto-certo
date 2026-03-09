import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RotateCcw, Check, Loader2, AlertCircle } from 'lucide-react';

interface SignatureSelfieCaptureProps {
  employeeName: string;
  onCapture: (imageData: string) => void;
}

export function SignatureSelfieCapture({ employeeName, onCapture }: SignatureSelfieCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setCameraReady(false);
  }, [stream]);

  const startCamera = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    setError(null);
    stopCamera();

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      const video = videoRef.current;
      if (video) {
        video.srcObject = mediaStream;
        try { await video.play(); } catch {}
        setTimeout(() => setCameraReady(true), 500);
      }
    } catch (err: any) {
      setError(err.name === 'NotAllowedError' ? 'Permissão de câmera negada.' : 'Erro ao acessar câmera.');
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, stopCamera]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    // Flip for selfie
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    // Reset transform for overlay
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw timestamp overlay
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const stamp = `${employeeName} • ${dateStr} ${timeStr}`;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, h - 40, w, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(stamp, w / 2, h - 14);

    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(imageData);
    stopCamera();
  }, [stopCamera, employeeName]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    setCameraReady(false);
    startCamera();
  }, [startCamera]);

  const confirm = useCallback(() => {
    if (capturedImage) onCapture(capturedImage);
  }, [capturedImage, onCapture]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] bg-black rounded-lg overflow-hidden">
        {capturedImage ? (
          <img src={capturedImage} alt="Selfie" className="w-full h-full object-cover" />
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-muted text-center">
            <AlertCircle className="w-8 h-8 text-destructive mb-2" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={startCamera}>Tentar novamente</Button>
          </div>
        ) : !cameraReady && !isStarting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted">
            <Camera className="w-10 h-10 text-muted-foreground" />
            <Button size="sm" onClick={startCamera}>
              <Camera className="w-4 h-4 mr-1" /> Ativar Câmera
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {capturedImage ? (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={retake}>
            <RotateCcw className="w-3 h-3 mr-1" /> Nova foto
          </Button>
          <Button size="sm" className="flex-1" onClick={confirm}>
            <Check className="w-3 h-3 mr-1" /> Usar esta foto
          </Button>
        </div>
      ) : cameraReady ? (
        <Button className="w-full" onClick={capturePhoto}>
          <Camera className="w-4 h-4 mr-1" /> Capturar Foto
        </Button>
      ) : null}
    </div>
  );
}
