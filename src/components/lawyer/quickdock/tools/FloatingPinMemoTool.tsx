import React, { useState, useEffect, useRef } from 'react';
import { 
  Pin, Image as ImageIcon, FileText, ZoomIn, ZoomOut, RotateCw, 
  Trash2, Copy, Check, Upload, Sparkles, Plus, AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

interface MemoSlot {
  id: string;
  title: string;
  type: 'image' | 'text';
  imageDataUrl?: string;
  text?: string;
  zoom: number; // 0.5 ~ 3.0
  rotation: number; // 0, 90, 180, 270
}

const STORAGE_KEY = 'legal_dock_pin_memo_slots_v1';

const DEFAULT_SLOTS: MemoSlot[] = [
  { id: 'slot-1', title: '메모 1', type: 'text', text: '의뢰인과의 상담 메모 또는 체크할 서류 번호를 적어두세요.', zoom: 1, rotation: 0 },
  { id: 'slot-2', title: '서류 이미지 2', type: 'image', zoom: 1, rotation: 0 },
];

export default function FloatingPinMemoTool() {
  const [slots, setSlots] = useState<MemoSlot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SLOTS;
  });

  const [activeSlotId, setActiveSlotId] = useState<string>(slots[0]?.id || 'slot-1');
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSlot = slots.find(s => s.id === activeSlotId) || slots[0];

  // 슬롯 상태 변경 시 로컬스토리지 저장
  const updateCurrentSlot = (updates: Partial<MemoSlot>) => {
    setSlots(prev => {
      const next = prev.map(s => s.id === activeSlotId ? { ...s, ...updates } : s);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        // 용량 초과 시 알림
        if (updates.imageDataUrl) {
          toast.warning('이미지 용량이 커서 브라우저 임시 메모리에만 보존됩니다.');
        }
      }
      return next;
    });
  };

  // 클립보드 붙여넣기 (Ctrl + V) 이벤트 리스너
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const result = event.target?.result as string;
              if (result) {
                updateCurrentSlot({
                  type: 'image',
                  imageDataUrl: result,
                  zoom: 1,
                  rotation: 0,
                });
                toast.success('클립보드 이미지가 핀 메모에 띄워졌습니다!');
              }
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeSlotId]);

  // 파일 업로드
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        updateCurrentSlot({
          type: 'image',
          imageDataUrl: result,
          zoom: 1,
          rotation: 0,
        });
        toast.success('이미지가 정상적으로 등록되었습니다.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // 줌 조절
  const handleZoom = (delta: number) => {
    const nextZoom = Math.min(3.0, Math.max(0.4, Number((currentSlot.zoom + delta).toFixed(1))));
    updateCurrentSlot({ zoom: nextZoom });
  };

  // 회전
  const handleRotate = () => {
    const nextRotation = (currentSlot.rotation + 90) % 360;
    updateCurrentSlot({ rotation: nextRotation });
  };

  // 슬롯 추가
  const handleAddSlot = () => {
    if (slots.length >= 4) {
      toast.warning('슬롯은 최대 4개까지 생성할 수 있습니다.');
      return;
    }
    const newId = `slot-${Date.now()}`;
    const newSlot: MemoSlot = {
      id: newId,
      title: `슬롯 ${slots.length + 1}`,
      type: 'text',
      text: '',
      zoom: 1,
      rotation: 0,
    };
    const next = [...slots, newSlot];
    setSlots(next);
    setActiveSlotId(newId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    toast.success(`'${newSlot.title}' 슬롯이 추가되었습니다.`);
  };

  // 슬롯 삭제
  const handleDeleteSlot = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slots.length <= 1) {
      toast.warning('최소 1개의 슬롯은 유지되어야 합니다.');
      return;
    }
    const next = slots.filter(s => s.id !== id);
    setSlots(next);
    if (activeSlotId === id) {
      setActiveSlotId(next[0].id);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // 텍스트 복사
  const handleCopyText = () => {
    if (!currentSlot.text?.trim()) {
      toast.info('복사할 텍스트가 없습니다.');
      return;
    }
    navigator.clipboard.writeText(currentSlot.text);
    setCopied(true);
    toast.success('메모 내용이 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={containerRef} className="p-3.5 space-y-3 text-xs text-slate-800">
      {/* ── 슬롯 탭 바 ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {slots.map((slot, idx) => (
            <button
              key={slot.id}
              onClick={() => setActiveSlotId(slot.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                activeSlotId === slot.id
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {slot.type === 'image' && slot.imageDataUrl ? (
                <ImageIcon className="w-3 h-3 text-amber-200" />
              ) : (
                <FileText className="w-3 h-3 text-slate-400" />
              )}
              <span className="truncate max-w-[70px]">{slot.title}</span>
              {slots.length > 1 && (
                <span
                  onClick={(e) => handleDeleteSlot(slot.id, e)}
                  className="hover:text-rose-200 font-normal ml-0.5 text-[10px]"
                >
                  ✕
                </span>
              )}
            </button>
          ))}

          {slots.length < 4 && (
            <button
              onClick={handleAddSlot}
              className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              title="새 핀 메모 탭 추가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 타입 전환 토글 (텍스트 <-> 사진) */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
          <button
            onClick={() => updateCurrentSlot({ type: 'text' })}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
              currentSlot.type === 'text' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            메모
          </button>
          <button
            onClick={() => updateCurrentSlot({ type: 'image' })}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
              currentSlot.type === 'image' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            사진
          </button>
        </div>
      </div>

      {/* ── 이미지 모드 ── */}
      {currentSlot.type === 'image' && (
        <div className="space-y-2">
          {currentSlot.imageDataUrl ? (
            <>
              {/* 이미지 툴바 컨트롤 (줌, 회전, 지우기) */}
              <div className="flex items-center justify-between bg-slate-100 px-2.5 py-1.5 rounded-xl text-[11px] text-slate-600">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleZoom(-0.2)}
                    className="p-1 hover:bg-white rounded hover:text-slate-900 transition-colors cursor-pointer"
                    title="축소"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-bold w-12 text-center">
                    {Math.round(currentSlot.zoom * 100)}%
                  </span>
                  <button
                    onClick={() => handleZoom(0.2)}
                    className="p-1 hover:bg-white rounded hover:text-slate-900 transition-colors cursor-pointer"
                    title="확대"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateCurrentSlot({ zoom: 1 })}
                    className="px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 rounded hover:bg-white transition-colors cursor-pointer ml-1"
                  >
                    100%
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRotate}
                    className="p-1 hover:bg-white rounded hover:text-slate-900 transition-colors cursor-pointer"
                    title="90도 시계방향 회전"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => updateCurrentSlot({ imageDataUrl: undefined })}
                    className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer ml-1"
                    title="이미지 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 이미지 뷰어 캔버스 */}
              <div className="w-full h-72 border border-slate-200 rounded-2xl bg-slate-950 flex items-center justify-center overflow-auto p-2 relative group">
                <img
                  src={currentSlot.imageDataUrl}
                  alt="핀 메모 이미지"
                  style={{
                    transform: `scale(${currentSlot.zoom}) rotate(${currentSlot.rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-w-none max-h-none object-contain rounded select-none shadow-xl"
                  draggable={false}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                💡 돋보기로 확대하여 작은 영수증/서류 숫자를 보면서 사이트에 편하게 입력하세요.
              </p>
            </>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/80 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-2 group"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-slate-800 text-xs">
                  캡처 후 <span className="text-amber-700 bg-amber-200/60 px-1.5 py-0.5 rounded font-mono">Ctrl + V</span> 를 누르세요!
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  또는 클릭하여 신분증, 등기부, 급여명세서 이미지 파일 업로드
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}

      {/* ── 텍스트 모드 ── */}
      {currentSlot.type === 'text' && (
        <div className="space-y-2">
          <textarea
            value={currentSlot.text || ''}
            onChange={e => updateCurrentSlot({ text: e.target.value })}
            placeholder="상담 중 기억할 내용, 의뢰인 특이사항, 법원 보정 제출기한 등을 적어두세요..."
            rows={9}
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none font-sans"
          />

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>글자수: {(currentSlot.text || '').length}자</span>
            <button
              onClick={() => updateCurrentSlot({ text: '' })}
              className="hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              비우기
            </button>
          </div>

          <button
            onClick={handleCopyText}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '복사 완료' : '메모 내용 복사'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
