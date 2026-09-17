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
  phase?: 1 | 2;
}

interface BatchDocRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName: string;
  clientPhone?: string;
  creditorCount?: number;
  initialPhase?: 1 | 2;
  unsubmittedDocs: BatchDocItem[];
  onConfirmBatchSend: (selectedDocIds: string[], deadlineDays: number, requestType?: 'phase1' | 'phase2' | 'custom') => void;
}

export default function BatchDocRequestModal({
  isOpen,
  onClose,
  clientName,
  clientPhone = '',
  creditorCount = 5,
  initialPhase,
  unsubmittedDocs,
  onConfirmBatchSend,
}: BatchDocRequestModalProps) {
  const [selectedPhase, setSelectedPhase] = useState<'all' | 1 | 2>(initialPhase || 'all');
  const [deadlineDays, setDeadlineDays] = useState<number>(initialPhase === 2 ? 7 : 3);
  const [includeReminder, setIncludeReminder] = useState<boolean>(true);

  // 선택된 phase에 따른 서류 ID 필터링
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialPhase) {
      return unsubmittedDocs.filter(d => d.phase === initialPhase).map(d => d.id);
    }
    return unsubmittedDocs.map(d => d.id);
  });

  if (!isOpen) return null;

  const handlePhaseChange = (phase: 'all' | 1 | 2) => {
    setSelectedPhase(phase);
    if (phase === 'all') {
      setSelectedIds(unsubmittedDocs.map(d => d.id));
      setDeadlineDays(5);
    } else {
      setSelectedIds(unsubmittedDocs.filter(d => (d.phase || 1) === phase).map(d => d.id));
      setDeadlineDays(phase === 1 ? 3 : 7);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const currentPool = selectedPhase === 'all' 
      ? unsubmittedDocs 
      : unsubmittedDocs.filter(d => (d.phase || 1) === selectedPhase);

    if (selectedIds.length === currentPool.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentPool.map(d => d.id));
    }
  };

  const handleSend = () => {
    if (selectedIds.length === 0) {
      toast.error('요청할 서류를 1건 이상 선택해주세요.');
      return;
    }
    const type = selectedPhase === 1 ? 'phase1' : selectedPhase === 2 ? 'phase2' : 'custom';
    onConfirmBatchSend(selectedIds, deadlineDays, type);
    const typeLabel = selectedPhase === 1 ? '[1차 서류]' : selectedPhase === 2 ? '[2차 서류]' : '';
    toast.success(`${clientName}님께 ${typeLabel} 미제출 서류 ${selectedIds.length}건 묶음 요청 알림톡이 전송되었습니다.`);
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
          {/* ── 1차 / 2차 묶음 유형 선택 탭 ── */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>서류 요청 단계 (실무 1차/2차 프리셋)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePhaseChange('all')}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-xs cursor-pointer ${
                  selectedPhase === 'all'
                    ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                전체 서류 ({unsubmittedDocs.length}건)
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange(1)}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-xs cursor-pointer ${
                  selectedPhase === 1
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-amber-50/60 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
              >
                📮 1차 서류 ({unsubmittedDocs.filter(d => (d.phase || 1) === 1).length}건)
              </button>
              <button
                type="button"
                onClick={() => handlePhaseChange(2)}
                className={`py-2 px-3 rounded-xl font-bold border transition-all text-xs cursor-pointer ${
                  selectedPhase === 2
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-blue-50/60 text-blue-900 border-blue-200 hover:bg-blue-100'
                }`}
              >
                📋 2차 서류 ({unsubmittedDocs.filter(d => d.phase === 2).length}건)
              </button>
            </div>
          </div>

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
                <span className="text-blue-600 font-mono">({selectedIds.length}건 선택됨)</span>
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-slate-600 hover:text-slate-900 font-bold text-[11px] cursor-pointer"
              >
                전체 반전
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

                      <div className="flex items-center gap-1.5 shrink-0">
                        {doc.phase === 1 ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            1차 등기
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            2차 모바일
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                          doc.isRequired 
                            ? 'bg-rose-50 text-rose-600 border-rose-200' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {doc.isRequired ? '필수' : '해당자'}
                        </span>
                      </div>
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
                {selectedPhase === 1 
                  ? '[1차 빠른등기] 알림톡 도착 미리보기' 
                  : selectedPhase === 2 
                  ? '[2차 모바일 간편제출] 알림톡 도착 미리보기' 
                  : '고객 스마트폰 카카오 알림톡 도착 미리보기'}
              </span>
              <span className="text-[10px] text-amber-700 font-bold">인증 알림톡</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-amber-200 text-slate-700 leading-relaxed text-[11px] font-mono whitespace-pre-line">
              {selectedPhase === 1 ? (
`[법률사무소 보광 회생전담센터]
${clientName}님, 개인회생 신속 착수를 위한 [1차 기본서류] 빠른등기 안내입니다.

금융기관 부채증명서 발급 대행(약 7일 소요)을 위해 아래 실물 서류를 빠른 등기우편으로 발송해 주세요.

■ 요청 서류: ${selectedIds.length}건
1. 주민등록등본 및 초본 각 1부
2. 가족관계증명서 및 혼인관계증명서 (상세)
3. 신분증 사본 및 인감도장 실물
4. 인감증명서 ${creditorCount + 5}부 (채권사 ${creditorCount}곳 + 5부)
5. 지방세 세목별 과세증명서 (최근 5년)

📮 등기 주소: 서울시 도봉구 마들로 760, 한발법조타워 301호
수신: 법률사무소 보광 회생전담팀 앞
제출 기한: ${deadlineStr}까지

[1차 서류 상세 가이드 및 등기주소 복사]`
              ) : selectedPhase === 2 ? (
`[법률사무소 보광 회생전담센터]
${clientName}님, 1차 서류 수령 확인 완료! 부채증명서 발급(약 7일 소요)에 착수했습니다.

부채증명서가 발급되는 동안 아래 [2차 서류]를 스마트폰으로 촬영하여 올려주시면 가장 빠른 접수가 가능합니다.

■ 요청 서류: ${selectedIds.length}건 (${unsubmittedDocs.filter(d => selectedIds.includes(d.id)).slice(0, 2).map(d => d.name).join(', ')}${selectedIds.length > 2 ? ` 외 ${selectedIds.length - 2}건` : ''})
■ 제출 기한: ${deadlineStr}까지
■ 제출 방법: 스마트폰 간편 업로드 또는 등기우편 발송 모두 가능

[모바일 원클릭 2차 서류함 열기]`
              ) : (
`[법률사무소 보광 개인회생 전담센터]
${clientName}님, 사건 접수를 위한 맞춤 서류함이 준비되었습니다.

■ 요청 서류: ${selectedIds.length}건 (${unsubmittedDocs.filter(d => selectedIds.includes(d.id)).slice(0, 2).map(d => d.name).join(', ')}${selectedIds.length > 2 ? ` 외 ${selectedIds.length - 2}건` : ''})
■ 제출 기한: ${deadlineStr}까지
■ 간편 제출: 아래 링크를 누르면 정부24/홈택스 간편인증 및 스마트폰 촬영으로 1분 만에 제출하실 수 있습니다.

[모바일 원클릭 서류함 열기]`
              )}
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
