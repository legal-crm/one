// src/components/common/SecureDocumentViewerModal.tsx
// ============================================================
// [Zero-Trust Document Security] 로펌 열람실 보안 뷰어 모달
// - 열람자 정보(변호사명, 역할, 시각)를 실시간 포렌식 워터마크로 화면에 오버레이
// - 스마트폰 화면 도촬 시 유출자 즉각 특정 및 심리적 유출 억제
// - 마우스 우클릭, 이미지 드래그, 복사 단축키 차단
// - 안전한 브라우저 인메모리 직접 인쇄 지원 (로컬 다운로드 파일 방치 방지)
// ============================================================

import React, { useEffect, useRef } from 'react';
import { X, ShieldAlert, Printer, AlertTriangle, Lock } from 'lucide-react';
import { writeAuditLog } from '../../services/auditService';

interface SecureDocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentName: string;
  dataUrl: string;
  mimeType?: string;
  viewerName: string;
  viewerRole?: string;
  clientId?: string;
}

export default function SecureDocumentViewerModal({
  isOpen,
  onClose,
  documentName,
  dataUrl,
  mimeType = 'image/jpeg',
  viewerName,
  viewerRole = '대리인',
  clientId
}: SecureDocumentViewerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. 감사 로그 자동 기록 (누가 언제 어떤 문서를 열람했는지 법적 추적성 확보)
  useEffect(() => {
    if (isOpen && clientId) {
      writeAuditLog({
        actor_id: viewerName,
        actor_role: viewerRole.toLowerCase() as any,
        action: 'view_client_detail',
        target_type: 'document',
        target_id: documentName,
        detail: {
          action_desc: '초민감 서류(신분증/인감) 보안 열람실 조회',
          document_name: documentName,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.warn('[Audit Log Warning]', err));
    }
  }, [isOpen, clientId, documentName, viewerName, viewerRole]);

  // 2. 포렌식 워터마크 캔버스 실시간 렌더링
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 뷰어 창 크기에 맞게 캔버스 해상도 조절
    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.parentElement?.clientHeight || 600;
    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // 격자 형태 반복 렌더링
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const watermarkText = `${viewerName} (${viewerRole}) | ${dateStr} | my김변 보안열람`;

    ctx.save();
    ctx.rotate((-25 * Math.PI) / 180);
    ctx.font = '600 13px "Pretendard", -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(100, 116, 139, 0.12)'; // slate-500 은은한 포렌식 오버레이
    ctx.textAlign = 'center';

    const stepX = 260;
    const stepY = 130;

    // 대각선 회전 시 여백을 고려하여 넓게 타일링
    for (let x = -width; x < width * 2; x += stepX) {
      for (let y = -height; y < height * 2; y += stepY) {
        ctx.fillText(watermarkText, x, y);
      }
    }
    ctx.restore();
  }, [isOpen, viewerName, viewerRole]);

  // 3. 보안 키보드 단축키 및 화면 캡처 방지 리스너
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S (저장), Ctrl+P (기본 인쇄 방지 -> 전용 인쇄 함수 유도), Ctrl+C (복사) 차단
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'c' || e.key === 'p')) {
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // 4. 안전한 인메모리 법원제출 직접 인쇄
  const handleSecurePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${documentName} - 법원 제출용 인쇄</title>
          <style>
            @page { margin: 10mm; size: auto; }
            body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; font-family: sans-serif; }
            img { max-width: 100%; max-height: 92vh; object-fit: contain; }
            .footer { font-size: 10px; color: #64748b; margin-top: 8px; }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="서류" />
          <div class="footer">대한민국 법원 전자소송 제출용 서류 [열람자: ${viewerName} | 발급일시: ${new Date().toLocaleString('ko-KR')}]</div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const isPdf = mimeType === 'application/pdf' || documentName.toLowerCase().endsWith('.pdf');

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fadeIn"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 상단 보안 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight truncate max-w-md">{documentName}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  보안 열람 모드
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                화면 도촬 방지용 포렌식 워터마크가 실시간 활성화되어 있습니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSecurePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all press-scale cursor-pointer border border-slate-700"
              title="로컬 저장 없이 안전하게 법원 제출용으로 직접 인쇄"
            >
              <Printer className="w-3.5 h-3.5" />
              법원 제출 인쇄
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 본문 영역 (포렌식 오버레이 결합) */}
        <div 
          className="relative flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] select-none"
          onDragStart={e => e.preventDefault()}
        >
          {isPdf ? (
            <iframe 
              src={dataUrl} 
              className="w-full h-[650px] rounded-xl border border-slate-800"
              title="PDF 뷰어"
            />
          ) : (
            <div className="relative inline-block max-w-full">
              {/* 신분증/서류 원본 이미지 (이미 비가역 워터마크가 합성되어 있음) */}
              <img
                src={dataUrl}
                alt={documentName}
                className="max-h-[70vh] max-w-full object-contain rounded-xl border border-slate-800 shadow-lg pointer-events-none"
                draggable={false}
              />
              {/* 화면 도촬 추적 포렌식 캔버스 오버레이 */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none rounded-xl"
              />
            </div>
          )}
        </div>

        {/* 하단 보안 알림 바 */}
        <div className="px-6 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>본 서류는 개인회생·파산 법원 제출 외 타 용도(대출, 개통 등) 사용이 엄격히 금지됩니다.</span>
          </div>
          <span className="font-mono text-slate-500">
            열람자: {viewerName}
          </span>
        </div>
      </div>
    </div>
  );
}
