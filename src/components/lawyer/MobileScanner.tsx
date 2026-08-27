import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, RotateCcw, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface MobileScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: { name: string; dataUrl: string; mimeType: string; fileSize: number }) => void;
}

export default function MobileScanner({ isOpen, onClose, onCapture }: MobileScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [docName, setDocName] = useState('');

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      toast.error('카메라에 접근할 수 없습니다. 권한을 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw with slight contrast enhancement
    ctx.filter = 'contrast(1.15) brightness(1.05)';
    ctx.drawImage(video, 0, 0);
    ctx.filter = 'none';
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const confirm = useCallback(() => {
    if (!capturedImage) return;
    const name = docName.trim() || `스캔_${new Date().toISOString().split('T')[0]}_${Date.now().toString(36)}`;
    // Estimate file size from base64
    const sizeEstimate = Math.round((capturedImage.length * 3) / 4);
    onCapture({
      name: `${name}.jpg`,
      dataUrl: capturedImage,
      mimeType: 'image/jpeg',
      fileSize: sizeEstimate,
    });
    setCapturedImage(null);
    setDocName('');
    onClose();
    toast.success('서류가 스캔되었습니다.');
  }, [capturedImage, docName, onCapture, onClose]);

  React.useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera();
    }
    return () => { stopCamera(); };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Camera className="w-4 h-4" /> 서류 스캔
        </h3>
        <button onClick={() => { stopCamera(); setCapturedImage(null); onClose(); }} className="text-white/70 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Camera / Preview */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {/* Guide overlay */}
            <div className="absolute inset-8 border-2 border-white/30 rounded-2xl pointer-events-none">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-white/50 text-[10px] font-medium whitespace-nowrap">
                서류를 프레임 안에 맞춰주세요
              </div>
            </div>
          </>
        ) : (
          <img src={capturedImage} alt="captured" className="max-w-full max-h-full object-contain" />
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* Controls */}
      <div className="p-4 bg-black/80 space-y-3">
        {!capturedImage ? (
          <div className="flex justify-center">
            <button
              onClick={capture}
              disabled={!stream}
              className="w-16 h-16 rounded-full bg-white border-4 border-white/30 hover:scale-105 active:scale-95 transition-transform disabled:opacity-30"
            >
              <div className="w-12 h-12 rounded-full bg-white mx-auto" />
            </button>
          </div>
        ) : (
          <>
            <input
              value={docName}
              onChange={e => setDocName(e.target.value)}
              placeholder="서류명 (예: 주민등록등본, 부채증명서)"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            <div className="flex gap-3">
              <button onClick={retake} className="flex-1 py-3 text-sm font-bold text-white/70 bg-white/10 rounded-xl hover:bg-white/20 transition-colors flex items-center justify-center gap-2">
                <RotateCcw className="w-4 h-4" /> 다시 촬영
              </button>
              <button onClick={confirm} className="flex-1 py-3 text-sm font-bold text-black bg-white rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 press-scale">
                <Check className="w-4 h-4" /> 저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
