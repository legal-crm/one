import React, { useState } from 'react';
import { 
  X, Send, CheckSquare, Square, Calendar, ShieldCheck, 
  Smartphone, Clock, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export interface BatchDocItem {
  id: string;
  name: string;
  agency: string;
  isRequired: boolean;
  notes: string;
}

interface BatchDocRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone?: string;
  unsubmittedDocs: BatchDocItem[];
  onConfirmBatchSend: (selectedDocIds: string[], deadlineDays: number) => void;
}

export default function BatchDocRequestModal({
  isOpen,
  onClose,
  clientName,
  clientPhone = '',
  unsubmittedDocs,
  onConfirmBatchSend,
}: BatchDocRequestModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => unsubmittedDocs.map(d => d.id));
  const [deadlineDays, setDeadlineDays] = useState<number>(3);
  const [includeReminder, setIncludeReminder] = useState<boolean>(true);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === unsubmittedDocs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unsubmittedDocs.map(d => d.id));
    }
  };

  const handleSend = () => {
    if (selectedIds.length === 0) {
      toast.error('요청할 서류를 1건 이상 선택해주세요.');
      return;
    }
    onConfirmBatchSend(selectedIds, deadlineDays);
    toast.success(`${clientName}님께 미제출 서류 ${selectedIds.length}건 묶음 요청 알림톡이 전송되었습니다.`);
    onClose();
  };

  const targetDeadlineDate = new Date();
  targetDeadlineDate.setDate(targetDeadlineDate.getDate() + deadlineDays);
  const deadlineStr = `${targetDeadlineDate.getMonth() + 1}월 ${targetDeadlineDate.getDate()}일`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="px-6 py-4 bg-[#1E3A5F] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-white">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                미제출 서류 묶음 요청 (카카오 알림톡)
              </h3>
              <p className="text-xs text-blue-200 mt-0.5">
                {clientName} 고객 ({clientPhone || '연락처'}) · 개별 전송 없이 한 번에 발송
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* 제출 기한 및 옵션 바 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1E3A5F]" />
                <span>제출 마감일 설정</span>
              </label>
              <div className="flex items-center gap-2">
                {[3, 5, 7].map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDeadlineDays(days)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      deadlineDays === days 
                        ? 'bg-[#1E3A5F] text-white shadow-xs' 
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    D-{days} ({days}일 이내)
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                마감일: <strong className="text-[#1E3A5F] font-bold">{deadlineStr}</strong>까지 제출 안내
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>자동 리마인더</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeReminder}
                  onChange={e => setIncludeReminder(e.target.checked)}
                  className="rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                />
                <span className="font-medium text-slate-800">
                  마감 24시간 전 자동 알림톡 발송
                </span>
              </label>
            </div>
          </div>

          {/* 요청 서류 목록 선택 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-slate-900 flex items-center gap-1.5">
                <span>요청 서류 선택</span>
                <span className="text-blue-600 font-mono">({selectedIds.length}/{unsubmittedDocs.length}건)</span>
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-slate-600 hover:text-slate-900 font-bold text-[11px] cursor-pointer"
              >
                {selectedIds.length === unsubmittedDocs.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {unsubmittedDocs.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  미제출 서류가 없습니다. 모든 서류가 수합되었습니다.
                </div>
              ) : (
                unsubmittedDocs.map(doc => {
                  const isChecked = selectedIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleSelect(doc.id)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#1E3A5F] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="font-bold text-slate-900 mr-2">{doc.name}</span>
                          <span className="text-[10px] text-slate-400">{doc.agency}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${
                        doc.isRequired 
                          ? 'bg-rose-50 text-rose-600 border-rose-200' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {doc.isRequired ? '필수' : '해당자'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 카카오 알림톡 미리보기 카드 */}
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-amber-950 flex items-center gap-1.5 text-xs">
                <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                고객 스마트폰 카카오 알림톡 도착 미리보기
              </span>
              <span className="text-[10px] text-amber-700 font-bold">인증 알림톡</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-amber-200 text-slate-700 leading-relaxed text-[11px] font-mono whitespace-pre-line">
              {`[법무법인 개인회생 전담센터]
${clientName}님, 사건 접수를 위한 맞춤 서류함이 준비되었습니다.

■ 요청 서류: ${selectedIds.length}건 (${unsubmittedDocs.filter(d => selectedIds.includes(d.id)).slice(0, 2).map(d => d.name).join(', ')}${selectedIds.length > 2 ? ` 외 ${selectedIds.length - 2}건` : ''})
■ 제출 기한: ${deadlineStr}까지
■ 간편 제출: 아래 링크를 누르면 정부24/홈택스 간편인증 및 스마트폰 촬영으로 1분 만에 제출하실 수 있습니다.

[모바일 원클릭 서류함 열기]`}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={selectedIds.length === 0}
            className="px-6 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer press-scale"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>선택한 {selectedIds.length}건 한 번에 발송</span>
          </button>
        </div>
      </div>
    </div>
  );
}
