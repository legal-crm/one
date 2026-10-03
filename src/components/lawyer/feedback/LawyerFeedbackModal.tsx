import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquarePlus, Send, History, CheckCircle2, 
  AlertCircle, Sparkles, Building2, HelpCircle, Flame, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import ModalPortal from '../../common/ModalPortal';

export type FeedbackCategory = 
  | 'FORM_REQUEST'      // 서식·양식 추가 요청
  | 'CORRECTION_ADVICE'  // 법원 보정명령 대응 건의
  | 'FEATURE_IDEA'      // 기능 개선·UX 제안
  | 'BUG_REPORT'        // 오류·버그 신고
  | 'OTHER';            // 기타 실무 문의

export interface LawyerFeedbackRecord {
  id: string;
  category: FeedbackCategory;
  title: string;
  content: string;
  urgency: 'NORMAL' | 'URGENT';
  screenContext: string;
  clientContext?: string;
  courtContext?: string;
  replyPhone?: string;
  submittedAt: string;
  status: 'RECEIVED' | 'IN_REVIEW' | 'RESOLVED';
}

interface LawyerFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  lawyerName?: string;
  firmName?: string;
  currentScreen?: string;
  currentCaseNumber?: string;
  currentClientName?: string;
  currentCourtName?: string;
}

const STORAGE_KEY = 'legal_crm_lawyer_feedbacks_v1';

export default function LawyerFeedbackModal({
  isOpen,
  onClose,
  lawyerName = '변호사',
  firmName = '법무법인',
  currentScreen = 'CRM 메인 화면',
  currentCaseNumber,
  currentClientName,
  currentCourtName
}: LawyerFeedbackModalProps) {
  const [activeTab, setActiveTab] = useState<'NEW' | 'HISTORY'>('NEW');
  const [category, setCategory] = useState<FeedbackCategory>('FEATURE_IDEA');
  const [urgency, setUrgency] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [replyPhone, setReplyPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyList, setHistoryList] = useState<LawyerFeedbackRecord[]>([]);

  // 로컬스토리지에서 접수 내역 로드
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistoryList(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('제안 제목을 입력해 주세요.');
      return;
    }
    if (!content.trim()) {
      toast.error('구체적인 제안 또는 문의 내용을 작성해 주세요.');
      return;
    }

    setIsSubmitting(true);

    const newRecord: LawyerFeedbackRecord = {
      id: `fb-${Date.now()}`,
      category,
      title: title.trim(),
      content: content.trim(),
      urgency,
      screenContext: currentScreen,
      clientContext: currentClientName ? `${currentClientName} (${currentCaseNumber || '사건번호 미정'})` : undefined,
      courtContext: currentCourtName,
      replyPhone: replyPhone.trim() || undefined,
      submittedAt: new Date().toISOString(),
      status: 'RECEIVED'
    };

    try {
      const updated = [newRecord, ...historyList];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setHistoryList(updated);
      toast.success('소중한 실무 제안이 성공적으로 접수되었습니다. 플랫폼 고도화에 즉시 반영하겠습니다.');
      // 초기화
      setTitle('');
      setContent('');
      setActiveTab('HISTORY');
    } catch {
      toast.error('제안을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryLabels: Record<FeedbackCategory, { label: string; icon: string; desc: string }> = {
    FORM_REQUEST: { label: '서식·양식 추가', icon: '📑', desc: '특정 관할 법원 양식이나 필요한 별지 서식 추가 요청' },
    CORRECTION_ADVICE: { label: '보정명령 대응', icon: '⚖️', desc: '최신 보정권고 트렌드나 소명 문구 노하우 건의' },
    FEATURE_IDEA: { label: '기능·UX 제안', icon: '💡', desc: '단축키, 계산기, 필터 등 실무 편의 기능 제안' },
    BUG_REPORT: { label: '오류·버그 신고', icon: '🐛', desc: '계산 오류, 화면 멈춤, 서식 출력 문제 등' },
    OTHER: { label: '기타 실무 문의', icon: '💬', desc: '플랫폼 운영 및 협업 관련 문의' }
  };

  return (
    <ModalPortal>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
      >
        <div 
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* ═══ 헤더 ═══ */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
                <MessageSquarePlus className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="feedback-modal-title" className="text-base font-black tracking-tight">
                    변호사·실무관 개선 제안 & 피드백 센터
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/40 text-[10px] font-black text-indigo-300">
                    실무자 직통
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  회생·파산 실무 현장의 목소리를 최우선으로 반영하여 플랫폼을 업데이트합니다.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ═══ 상단 탭 ═══ */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 px-4 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('NEW')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'NEW'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>새 제안 작성</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>접수 내역 ({historyList.length})</span>
            </button>
          </div>

          {/* ═══ 본문 영역 ═══ */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 text-xs">
            {activeTab === 'NEW' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 1. 작업 맥락 정보 카드 (자동 첨부) */}
                <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>현재 실무 작업 환경 정보가 자동 첨부됩니다:</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      {firmName} {lawyerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800">
                      화면: <strong>{currentScreen}</strong>
                    </span>
                    {currentClientName && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800">
                        의뢰인: <strong>{currentClientName}</strong>
                      </span>
                    )}
                    {currentCourtName && (
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800">
                        관할: <strong>{currentCourtName}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. 제안 유형 선택 칩 */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    제안 유형을 선택해 주세요 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(categoryLabels) as FeedbackCategory[]).map(catKey => {
                      const item = categoryLabels[catKey];
                      const isSelected = category === catKey;
                      return (
                        <button
                          key={catKey}
                          type="button"
                          onClick={() => setCategory(catKey)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-900 dark:text-indigo-200'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-0.5">
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {item.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 긴급도 선택 */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300">
                    긴급도
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="urgency"
                        checked={urgency === 'NORMAL'}
                        onChange={() => setUrgency('NORMAL')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-slate-700 dark:text-slate-300">일반 건의 (향후 정기 업데이트 반영)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="urgency"
                        checked={urgency === 'URGENT'}
                        onChange={() => setUrgency('URGENT')}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" />
                        실무 긴급 (오늘/내일 제출 예정 사건)
                      </span>
                    </label>
                  </div>
                </div>

                {/* 4. 제목 입력 */}
                <div className="space-y-1.5">
                  <label htmlFor="fb-title" className="block font-bold text-slate-700 dark:text-slate-300">
                    제안 제목 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fb-title"
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="예: 수원회생법원 전용 임차보증금 반환소명서 양식 추가 요청"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* 5. 상세 내용 */}
                <div className="space-y-1.5">
                  <label htmlFor="fb-content" className="block font-bold text-slate-700 dark:text-slate-300">
                    상세 내용 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="fb-content"
                    rows={4}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="구체적인 상황이나 필요한 서식 항목, 계산 방식 등을 편하게 적어 주세요. 실제 보정명령 문구나 법원 지침이 있다면 요약해 주시면 더 빠르게 반영됩니다."
                    className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                  />
                </div>

                {/* 6. 회신 연락처 (선택) */}
                <div className="space-y-1.5">
                  <label htmlFor="fb-phone" className="block font-bold text-slate-700 dark:text-slate-300">
                    진행 상황 알림톡/연락받을 번호 (선택)
                  </label>
                  <input
                    id="fb-phone"
                    type="tel"
                    value={replyPhone}
                    onChange={e => setReplyPhone(e.target.value)}
                    placeholder="010-0000-0000 (반영 완료 시 안내 알림톡을 보내드립니다)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* 전송 버튼 */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold transition-all cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1.5 shadow-md active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? '접수 중...' : '제안 접수하기'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* 접수 내역 뷰 */
              <div className="space-y-3">
                {historyList.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl space-y-2 text-slate-400">
                    <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="font-bold text-slate-600 dark:text-slate-300">아직 제출한 제안이 없습니다.</p>
                    <p className="text-[11px]">실무 중 불편한 점이나 필요한 양식이 있다면 언제든 제안해 주세요.</p>
                  </div>
                ) : (
                  historyList.map(record => (
                    <div 
                      key={record.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-black text-[10px]">
                            {categoryLabels[record.category]?.label || record.category}
                          </span>
                          {record.urgency === 'URGENT' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 font-black text-[10px] flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              긴급
                            </span>
                          )}
                          <span className="font-mono text-slate-400 text-[10px]">
                            {new Date(record.submittedAt).toLocaleDateString('ko-KR')}
                          </span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          record.status === 'RESOLVED'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : record.status === 'IN_REVIEW'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        }`}>
                          {record.status === 'RESOLVED' ? '✓ 반영 완료' : record.status === 'IN_REVIEW' ? '검토 진행중' : '접수 완료'}
                        </span>
                      </div>

                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {record.title}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {record.content}
                      </p>

                      <div className="pt-1 text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
                        <span>작업 화면: {record.screenContext}</span>
                        {record.clientContext && <span>· 사건: {record.clientContext}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ═══ 푸터 ═══ */}
          <div className="p-3 px-5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>접수된 실무 건의는 48시간 이내에 전담 개발팀에서 검토 후 로드맵에 배정됩니다.</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-bold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
            >
              닫기
            </button>
          </div>

        </div>
      </div>
    </ModalPortal>
  );
}
