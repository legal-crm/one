import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Check, RotateCcw } from 'lucide-react';

interface SignatureCanvasProps {
  onComplete: (base64: string) => void;
  width?: number;
  height?: number;
  label?: string;
}

// 점 하나 찍기·짧은 선처럼 서명으로 보기 어려운 입력을 막기 위한 최소 획 길이(CSS px 기준)
const MIN_STROKE_LENGTH = 60;

export default function SignatureCanvas({ onComplete, width = 500, height = 200, label = '서명해 주세요' }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeLength, setStrokeLength] = useState(0);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = strokeLength >= MIN_STROKE_LENGTH;

  // 고해상도(레티나) 화면에서 흐려지지 않도록 devicePixelRatio 배율로 내부 해상도 설정
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height]);

  useEffect(() => { setupCanvas(); }, [setupCanvas]);

  // 논리 좌표(width×height) 기준 포인터 위치
  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (width / rect.width), y: (e.clientY - rect.top) * (height / rect.height) };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPointRef.current = pos;
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    const last = lastPointRef.current;
    if (last) setStrokeLength(l => l + Math.hypot(pos.x - last.x, pos.y - last.y));
    lastPointRef.current = pos;
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    setupCanvas();
    setStrokeLength(0);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    onComplete(canvas.toDataURL('image/png'));
  };

  return (
    <div className="space-y-3">
      <p id="signature-canvas-label" className="text-sm font-bold text-slate-700">{label}</p>
      <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby="signature-canvas-label"
          aria-describedby="signature-canvas-help"
          className="w-full cursor-crosshair touch-none block"
          style={{ aspectRatio: `${width} / ${height}`, maxHeight: `${height}px` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
      <p id="signature-canvas-help" className="text-[11px] text-slate-600">
        {strokeLength > 0 && !hasDrawn ? '서명을 조금 더 길게 써 주세요.' : '손가락이나 펜으로 네모 안에 이름을 써 주세요.'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center gap-1.5 px-4 min-h-[44px] text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> 지우기
        </button>
        <button
          type="button"
          onClick={confirmSignature}
          disabled={!hasDrawn}
          className={`flex items-center gap-1.5 px-4 min-h-[44px] text-xs font-bold rounded-xl transition-colors whitespace-nowrap ${hasDrawn ? 'bg-brand text-white hover:bg-brand/90 cursor-pointer' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
        >
          <Check className="w-3.5 h-3.5" aria-hidden="true" /> 서명 확인
        </button>
      </div>
    </div>
  );
}
