import React, { useState, useEffect, useRef } from 'react';
import {
  Image as ImageIcon, FileText, ZoomIn, ZoomOut, RotateCw, Trash2, Plus, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PIN_MEMO_KEY, pinImageCache, purgeLegacyDockMemos, PIN_IMAGE_MAX_BYTES } from '../dockStorage';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

interface MemoSlot {
  id: string;
  title: string;
  type: 'image' | 'text';
  imageDataUrl?: string;
  text?: string;
  zoom: number; // 0.4 ~ 3.0
  rotation: number; // 0, 90, 180, 270
}

const STORAGE_KEY = PIN_MEMO_KEY;

/** 텍스트·설정만 sessionStorage에 저장 (이미지 원본은 메모리 캐시에만 보관) */
function persistSlots(slots: MemoSlot[]) {
  slots.forEach(s => {
    if (s.imageDataUrl) pinImageCache.set(s.id, s.imageDataUrl);
    else pinImageCache.delete(s.id);
  });
  // 지운 칸의 이미지(신분증 등 민감 이미지)도 캐시에서 바로 지운다
  // (이전: 현재 칸 목록만 갱신해, 삭제한 칸의 이미지가 새로고침·로그아웃 전까지 메모리에 남았음)
  const liveIds = new Set(slots.map(s => s.id));
  pinImageCache.forEach((_img, id) => {
    if (!liveIds.has(id)) pinImageCache.delete(id);
  });
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(slots.map(({ imageDataUrl: _img, ...rest }) => rest)));
  } catch {
    // ignore
  }
}

function isEditableOutside(container: HTMLElement | null): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const editable = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  return editable && !(container && container.contains(el));
}

const DEFAULT_SLOTS: MemoSlot[] = [
  { id: 'slot-1', title: '메모 1', type: 'text', text: '', zoom: 1, rotation: 0 },
  { id: 'slot-2', title: '서류 이미지 2', type: 'image', zoom: 1, rotation: 0 },
];

interface FloatingPinMemoToolProps {
  /**
   * 현재 보이는 탭인지. 플로팅 창은 탭을 바꿔도 도구를 마운트한 채 숨기므로,
   * 숨겨진 상태에서 Ctrl+V 이미지를 가로채지 않도록 보일 때만 붙여넣기를 받는다.
   */
  isActive?: boolean;
}

export default function FloatingPinMemoTool({ isActive = true }: FloatingPinMemoToolProps) {
  const [slots, setSlots] = useState<MemoSlot[]>(() => {
    purgeLegacyDockMemos();
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((s: MemoSlot) => ({ ...s, imageDataUrl: pinImageCache.get(s.id) }));
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SLOTS;
  });

  const [activeSlotId, setActiveSlotId] = useState<string>(slots[0]?.id || 'slot-1');
  const { copied, copy } = useCopyFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentSlot = slots.find(s => s.id === activeSlotId) || slots[0];

  // 슬롯 상태 변경 시 세션 저장
  const updateCurrentSlot = (updates: Partial<MemoSlot>) => {
    setSlots(prev => {
      const next = prev.map(s => (s.id === activeSlotId ? { ...s, ...updates } : s));
      persistSlots(next);
      return next;
    });
  };

  // 클립보드 붙여넣기 (Ctrl + V) — 이 도구가 보일 때만
  useEffect(() => {
    if (!isActive) return;
    const handlePaste = (e: ClipboardEvent) => {
      // 다른 입력창(채팅·CRM 폼 등)에 붙여넣는 중이면 가로채지 않음
      if (isEditableOutside(containerRef.current)) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob && blob.size > PIN_IMAGE_MAX_BYTES) {
            toast.error('이미지가 5MB를 넘어 핀 메모에 띄울 수 없습니다.');
            e.preventDefault();
            return;
          }
          if (blob) {
            const reader = new FileReader();
            reader.onload = event => {
              const result = event.target?.result as string;
              if (result) {
                updateCurrentSlot({ type: 'image', imageDataUrl: result, zoom: 1, rotation: 0 });
                toast.success('클립보드 이미지를 핀 메모에 띄웠습니다.');
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
  }, [activeSlotId, isActive]);

  // 파일 업로드
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 등록할 수 있습니다.');
      e.target.value = '';
      return;
    }
    if (file.size > PIN_IMAGE_MAX_BYTES) {
      toast.error('이미지가 5MB를 넘어 등록할 수 없습니다.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = event => {
      const result = event.target?.result as string;
      if (result) {
        updateCurrentSlot({ type: 'image', imageDataUrl: result, zoom: 1, rotation: 0 });
        toast.success('이미지가 등록되었습니다.');
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
    updateCurrentSlot({ rotation: (currentSlot.rotation + 90) % 360 });
  };

  // 슬롯 추가
  const handleAddSlot = () => {
    if (slots.length >= 4) {
      toast.warning('슬롯은 최대 4개까지 만들 수 있습니다.');
      return;
    }
    const newId = `slot-${Date.now()}`;
    const newSlot: MemoSlot = { id: newId, title: `슬롯 ${slots.length + 1}`, type: 'text', text: '', zoom: 1, rotation: 0 };
    const next = [...slots, newSlot];
    setSlots(next);
    setActiveSlotId(newId);
    persistSlots(next);
    toast.success(`'${newSlot.title}' 슬롯이 추가되었습니다.`);
  };

  // 슬롯 삭제
  const handleDeleteSlot = (id: string) => {
    if (slots.length <= 1) {
      toast.warning('최소 1개의 슬롯은 유지되어야 합니다.');
      return;
    }
    const next = slots.filter(s => s.id !== id);
    setSlots(next);
    if (activeSlotId === id) setActiveSlotId(next[0].id);
    persistSlots(next);
  };

  // 텍스트 복사
  const handleCopyText = () => {
    if (!currentSlot.text?.trim()) {
      toast.info('복사할 텍스트가 없습니다.');
      return;
    }
    copy(currentSlot.text, '메모 내용이 복사되었습니다.');
  };

  return (
    <div ref={containerRef} className="p-3.5 space-y-3 text-xs text-slate-800">
      {/* ── 슬롯 탭 바 ── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {slots.map(slot => {
            const selected = activeSlotId === slot.id;
            return (
              <div
                key={slot.id}
                className={`flex items-center rounded-lg font-bold text-xs transition-all shrink-0 ${
                  selected ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveSlotId(slot.id)}
                  aria-pressed={selected}
                  className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 cursor-pointer"
                >
                  {slot.type === 'image' && slot.imageDataUrl ? (
                    <ImageIcon className={`w-3 h-3 ${selected ? 'text-amber-100' : 'text-slate-500'}`} aria-hidden="true" />
                  ) : (
                    <FileText className={`w-3 h-3 ${selected ? 'text-amber-100' : 'text-slate-500'}`} aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[70px]">{slot.title}</span>
                </button>
                {slots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    aria-label={`${slot.title} 슬롯 삭제`}
                    className={`pr-1.5 py-1 cursor-pointer ${selected ? 'text-amber-100 hover:text-white' : 'text-slate-500 hover:text-rose-600'}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {slots.length < 4 && (
            <button
              type="button"
              onClick={handleAddSlot}
              className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title="새 핀 메모 탭 추가"
              aria-label="핀 메모 슬롯 추가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 타입 전환 토글 (텍스트 <-> 사진) */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0" role="radiogroup" aria-label="슬롯 종류">
          <button
            type="button"
            role="radio"
            aria-checked={currentSlot.type === 'text'}
            onClick={() => updateCurrentSlot({ type: 'text' })}
            className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
              currentSlot.type === 'text' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            메모
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={currentSlot.type === 'image'}
            onClick={() => updateCurrentSlot({ type: 'image' })}
            className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
              currentSlot.type === 'image' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
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
              <div className="flex items-center justify-between bg-slate-100 px-2.5 py-1.5 rounded-xl text-xs text-slate-700">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => handleZoom(-0.2)} className="p-1 hover:bg-white rounded hover:text-slate-900 transition-colors cursor-pointer" title="축소" aria-label="축소">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-bold w-12 text-center" aria-live="polite">
                    {Math.round(currentSlot.zoom * 100)}%
                  </span>
                  <button type="button" onClick={() => handleZoom(0.2)} className="p-1 hover:bg-white rounded hover:text-slate-900 transition-colors cursor-pointer" title="확대" aria-label="확대">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentSlot({ zoom: 1 })}
                    className="px-1.5 py-0.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded hover:bg-white transition-colors cursor-pointer ml-1"
                  >
                    100%
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button type="button" onClick={handleRotate} className="p-1 hover:bg-white rounded hover:text-slate-900 transition-colors cursor-pointer" title="90도 시계방향 회전" aria-label="90도 회전">
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateCurrentSlot({ imageDataUrl: undefined })}
                    className="p-1 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded transition-colors cursor-pointer ml-1"
                    title="이미지 삭제"
                    aria-label="이미지 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="w-full h-72 border border-slate-200 rounded-2xl bg-slate-950 flex items-center justify-center overflow-auto p-2 relative">
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
              <p className="text-xs text-slate-500 text-center">
                작은 영수증·서류 숫자는 확대해서 보면서 입력하세요. 이미지는 이 탭 메모리에만 있고 새로고침·로그아웃 시 지워집니다.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/80 rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-2 group"
            >
              <span className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <ImageIcon className="w-5 h-5" aria-hidden="true" />
              </span>
              <span className="block">
                <span className="block font-extrabold text-slate-800 text-xs">
                  캡처 후 <span className="text-amber-800 bg-amber-200/60 px-1.5 py-0.5 rounded font-mono">Ctrl + V</span>를 누르세요
                </span>
                <span className="block text-xs text-slate-600 mt-1">
                  또는 클릭해서 신분증·등기부·급여명세서 이미지 파일 올리기 (5MB 이하)
                </span>
              </span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}

      {/* ── 텍스트 모드 ── */}
      {currentSlot.type === 'text' && (
        <div className="space-y-2">
          <textarea
            value={currentSlot.text || ''}
            onChange={e => updateCurrentSlot({ text: e.target.value })}
            placeholder="상담 중 기억할 내용, 의뢰인 특이사항, 법원 보정 제출기한 등을 적어두세요..."
            aria-label="핀 메모 내용"
            rows={9}
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none font-sans"
          />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>글자수: {(currentSlot.text || '').length}자</span>
            <button
              type="button"
              onClick={() => updateCurrentSlot({ text: '' })}
              className="hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" />
              비우기
            </button>
          </div>

          <CopyButton copied={copied} onClick={handleCopyText} label="메모 내용 복사" copiedLabel="복사 완료" />
        </div>
      )}
    </div>
  );
}
