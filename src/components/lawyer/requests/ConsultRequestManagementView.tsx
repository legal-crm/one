import React, { useState, useMemo } from 'react';
import { 
  Inbox, Sparkles, Send, MessageSquare, ArrowRight, Eye, 
  Clock, ShieldAlert, CheckCircle2, AlertTriangle, FileText, 
  Building2, User, ChevronRight, Search, Filter, EyeOff, RotateCcw,
  Coins, Scale, Check, X, PhoneCall, Zap, HelpCircle, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ConsultRequest, FinancialProfile, User as UserType, StaffMember 
} from '../../../types';
import { useDialog } from '../../common/DialogProvider';
import { CONSULT_DECLINE_REASONS, lawyerDeclineConsultRequest, type ConsultDeclineReason } from '../../../services/consultService';
import CaseReviewPanel from '../case/CaseReviewPanel';

interface ConsultRequestManagementViewProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  activeLawyer: UserType;
  activeStaff?: StaffMember | null;
  onOpenCase: (clientId: string, stage?: number, section?: string) => void;
  onOpenChat: (threadId: string) => void;
  /** 제안서 작성 화면(ProposalWorkspace) 열기 — 제안서는 이 화면 하나에서만 (CV-6) */
  onOpenProposalDraft?: (requestId: string) => void;
  /** 사건 검토 기록 (CV-1) */
  officeId?: string;
  canWriteReview?: boolean;
}

export type RequestFilterTab = 'all' | 'new' | 'reviewing' | 'proposal_sent' | 'urgent' | 'hidden';

export default function ConsultRequestManagementView({
  requests,
  setRequests,
  activeLawyer,
  activeStaff,
  onOpenCase,
  onOpenChat,
  onOpenProposalDraft,
  officeId,
  canWriteReview = true,
}: ConsultRequestManagementViewProps) {
  const dialog = useDialog();

  // 선택된 상담 요청 ID
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(() => {
    return requests.length > 0 ? requests[0].id : null;
  });

  // 활성 필터 탭
  const [activeFilter, setActiveFilter] = useState<RequestFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 오른쪽 미리보기 탭 3개: 'summary' (요약) | 'ai-review' (AI 검토) | 'proposal' (제안서)
  const [previewTab, setPreviewTab] = useState<'summary' | 'ai-review' | 'proposal'>('summary');

  // 관심 없음(숨김) 요청 ID 목록 (localStorage 영속화)
  const [hiddenRequestIds, setHiddenRequestIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`lawyer_hidden_requests_${activeLawyer.id}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  // 숨김 처리 핸들러
  const handleHideRequest = async (reqId: string) => {
    const confirmed = await dialog.confirm({
      title: '상담 요청 숨기기',
      message: '이 상담 요청을 목록에서 숨기시겠습니까?\n(필터에서 "숨긴 요청"을 선택해 언제든지 다시 복원할 수 있습니다)',
      confirmText: '숨기기',
      cancelText: '취소',
      variant: 'primary',
    });
    if (!confirmed) return;

    setHiddenRequestIds(prev => {
      const next = new Set(prev);
      next.add(reqId);
      localStorage.setItem(`lawyer_hidden_requests_${activeLawyer.id}`, JSON.stringify([...next]));
      return next;
    });
    toast.info('상담 요청이 숨김 처리되었습니다.');
  };

  // 숨김 해제(복원) 핸들러
  const handleRestoreRequest = (reqId: string) => {
    setHiddenRequestIds(prev => {
      const next = new Set(prev);
      next.delete(reqId);
      localStorage.setItem(`lawyer_hidden_requests_${activeLawyer.id}`, JSON.stringify([...next]));
      return next;
    });
    toast.success('상담 요청이 복원되었습니다.');
  };

  // 경과 시간 포맷터
  const formatElapsedTime = (createdAt: string) => {
    try {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const diffMin = Math.floor((now - created) / 60000);
      if (diffMin < 5) return '방금 전';
      if (diffMin < 60) return `${diffMin}분 전`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      const diffDays = Math.floor(diffHours / 24);
      return `D+${diffDays}`;
    } catch {
      return '최근';
    }
  };

  // 의뢰인 표시 이름 헬퍼
  const getClientDisplay = (req: ConsultRequest) => {
    const raw = req.clientName || '고객';
    const parts = raw.split('_');
    const stealth = req.stealthNickname || (parts.length > 1 ? parts[1] : raw);
    const real = req.realClientName || (parts.length > 1 ? parts[0] : raw);
    const hasShared = req.phoneConsultationRequested || req.contactDisclosureStatus === 'contact_shared';
    return {
      displayName: hasShared ? `${real} (${stealth})` : stealth,
      stealth,
      isShared: hasShared,
    };
  };

  // 내 제안서 찾기
  const getMyProposal = (req: ConsultRequest) => {
    return (req.proposals || []).find(p => p.lawyerId === activeLawyer.id);
  };

  // 요청 상태 판별 (신규 · 검토 중 · 제안 발송 · 응답 대기)
  const getRequestWorkflowState = (req: ConsultRequest) => {
    const myProp = getMyProposal(req);
    if (myProp) {
      if (req.phoneConsultationRequested || req.contactDisclosureStatus === 'contact_shared') {
        return { key: 'contact_shared', label: '상담 수락 (연락처 공개)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      }
      return { key: 'proposal_sent', label: '제안 발송 완료 (응답 대기)', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    }
    if (req.status === 'responding' || req.status === 'counseling') {
      return { key: 'reviewing', label: '검토 중', color: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    return { key: 'new', label: '신규 접수', color: 'text-rose-700 bg-rose-50 border-rose-200' };
  };

  // 위험 태그 추출 헬퍼 (최대 2개 + n)
  const getRiskTags = (req: ConsultRequest) => {
    const tags: string[] = [];
    const fp: Partial<FinancialProfile> = req.financialProfile || {};
    const debtTotal = fp.debtTotal || 0;
    const assetsTotal = fp.assetsTotal || 0;
    const speculative = (fp.debtTypes?.coinCrypto || 0) + (fp.debtTypes?.recentLoans || 0);

    if (debtTotal > 0 && speculative / debtTotal > 0.3) {
      tags.push('최근·사행성 채무 과다');
    }
    if (fp.harassmentLevel === 'SEIZURE' || fp.harassmentLevel === 'LAWSUIT') {
      tags.push('압류·소송 진행 중');
    }
    if (assetsTotal > debtTotal && debtTotal > 0) {
      tags.push('자산 초과 채무');
    }
    if ((fp.debtTypes?.recentLoans || 0) > 3000) {
      tags.push('1년 내 대출 집중');
    }
    if (tags.length === 0) {
      tags.push('일반 급여 소득');
    }
    return tags;
  };

  // 필터링된 요청 목록
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const isHidden = hiddenRequestIds.has(req.id);
      if (activeFilter === 'hidden') {
        return isHidden;
      }
      if (isHidden) return false;

      // 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (req.clientName || '').toLowerCase();
        const stealth = (req.stealthNickname || '').toLowerCase();
        const memo = (req.content || '').toLowerCase();
        if (!clientName.includes(q) && !stealth.includes(q) && !memo.includes(q)) {
          return false;
        }
      }

      const workflowState = getRequestWorkflowState(req).key;

      if (activeFilter === 'new') {
        return workflowState === 'new';
      }
      if (activeFilter === 'reviewing') {
        return workflowState === 'reviewing';
      }
      if (activeFilter === 'proposal_sent') {
        return workflowState === 'proposal_sent' || workflowState === 'contact_shared';
      }
      if (activeFilter === 'urgent') {
        const fp: Partial<FinancialProfile> = req.financialProfile || {};
        return fp.harassmentLevel === 'SEIZURE' || fp.harassmentLevel === 'LAWSUIT' || (fp.debtTypes?.recentLoans || 0) > 3000;
      }

      return true;
    });
  }, [requests, hiddenRequestIds, activeFilter, searchQuery, activeLawyer.id]);

  // 현재 선택된 상담 요청
  const activeRequest = useMemo(() => {
    return requests.find(r => r.id === selectedRequestId) || (filteredRequests.length > 0 ? filteredRequests[0] : null);
  }, [requests, selectedRequestId, filteredRequests]);

  // 내가 이미 보낸 제안서 (작성·발송은 제안서 작성 화면 하나에서, CV-6)
  const currentMyProposal = activeRequest ? getMyProposal(activeRequest) : null;

  // 응답 기한 표시 (기한은 그날 밤 12시라 1분 앞 시각으로 보여 준다)
  const formatRespondBy = (iso: string) => {
    const d = new Date(new Date(iso).getTime() - 60_000);
    return d.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // 거절 (사유는 사무소 기록에만, 의뢰인에게는 '이번엔 어렵다'만 전달)
  const [declineTarget, setDeclineTarget] = useState<ConsultRequest | null>(null);
  const [declineReason, setDeclineReason] = useState<ConsultDeclineReason>('not_my_field');
  const [declineNote, setDeclineNote] = useState('');
  const [declineBusy, setDeclineBusy] = useState(false);
  const submitDecline = async () => {
    if (!declineTarget) return;
    setDeclineBusy(true);
    const res = await lawyerDeclineConsultRequest(declineTarget.id, declineReason, declineNote);
    setDeclineBusy(false);
    if (res.ok === false) { toast.error(res.message); return; }
    const id = declineTarget.id;
    setRequests(prev => prev.filter(r => r.id !== id));
    setDeclineTarget(null);
    setDeclineNote('');
    toast.success('거절을 전했어요. 의뢰인에게는 사유 없이 "이번엔 어렵다"고만 안내돼요.');
  };

  // 검토 시작 액션
  const handleStartReview = (req: ConsultRequest) => {
    setRequests(prev => prev.map(r => {
      if (r.id === req.id) {
        return {
          ...r,
          status: 'responding',
          acceptedLawyerIds: Array.from(new Set([...(r.acceptedLawyerIds || []), activeLawyer.id]))
        };
      }
      return r;
    }));
    setPreviewTab('ai-review');
    toast.success(`[${getClientDisplay(req).displayName}] 사건 검토를 시작했습니다.`);
  };

  const isStaff = Boolean(activeStaff && activeStaff.role !== 'OWNER');

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC]">
      {/* ── 상단 헤더: 제목 + 핵심 탭 ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#1E3A5F] text-white shadow-xs">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>상담 요청 센터</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {requests.length}건
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              의뢰인이 보낸 상담 요청과 '내 상황 체크하기' 정리 내용을 검토하고 제안서를 보내세요.
            </p>
          </div>
        </div>

        {/* 퀵 카운터 요약 칩 */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200/80">
            신규: <strong className="text-rose-600">{requests.filter(r => getRequestWorkflowState(r).key === 'new').length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200/80">
            검토 중: <strong className="text-amber-600">{requests.filter(r => getRequestWorkflowState(r).key === 'reviewing').length}</strong>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold border border-slate-200/80">
            제안 완료: <strong className="text-blue-600">{requests.filter(r => getRequestWorkflowState(r).key === 'proposal_sent' || getRequestWorkflowState(r).key === 'contact_shared').length}</strong>
          </span>
        </div>
      </div>

      {/* ── 메인 바디: 좌측 목록 (40%) + 우측 미리보기 (60%) 분할 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── 좌측 목록 영역 ── */}
        <div className="w-full lg:w-[440px] xl:w-[480px] border-r border-slate-200 bg-white flex flex-col shrink-0">
          {/* 검색 및 필터 탭 바 */}
          <div className="p-3 border-b border-slate-100 space-y-2.5">
            {/* 검색창 */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="가명, 의뢰인명, 사연 내용 검색..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:bg-white"
              />
            </div>

            {/* 필터 칩 탭 */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { key: 'all', label: '전체' },
                { key: 'new', label: '신규' },
                { key: 'reviewing', label: '검토 중' },
                { key: 'proposal_sent', label: '제안 완료' },
                { key: 'urgent', label: '🚨 긴급' },
                { key: 'hidden', label: '숨긴 요청' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key as RequestFilterTab)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap press-scale ${
                    activeFilter === tab.key
                      ? 'bg-[#1E3A5F] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 요청 카드 목록 리스트 */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1.5">
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-slate-400">
                <Inbox className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">해당하는 상담 요청이 없습니다.</p>
              </div>
            ) : (
              filteredRequests.map(req => {
                const isSelected = activeRequest?.id === req.id;
                const client = getClientDisplay(req);
                const workflow = getRequestWorkflowState(req);
                const fp: Partial<FinancialProfile> = req.financialProfile || {};
                const tags = getRiskTags(req);
                const isHidden = hiddenRequestIds.has(req.id);

                return (
                  <div
                    key={req.id}
                    onClick={() => {
                      setSelectedRequestId(req.id);
                      setPreviewTab('summary');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-blue-50/60 border-[#1E3A5F] shadow-xs ring-1 ring-[#1E3A5F]/20'
                        : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {/* 상단 1행: 가명 + 요청유형 + 경과시간 */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-black text-sm text-slate-900 truncate">
                          {client.displayName}
                        </span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
                          req.requestType === 'direct'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {req.requestType === 'direct' ? '지명' : '오픈'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-slate-400 font-mono flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {formatElapsedTime(req.createdAt)}
                        </span>
                        {!isHidden ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHideRequest(req.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                            title="관심 없음 (숨기기)"
                          >
                            <EyeOff className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreRequest(req.id);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-800 rounded"
                            title="요청 복원하기"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 중간 2행: 핵심 재무 스펙 (채무 / 월소득 / 재산) */}
                    <div className="grid grid-cols-3 gap-2 my-2 py-1.5 px-2 bg-slate-50/70 rounded-lg text-xs font-mono">
                      <div>
                        <span className="text-xs text-slate-400 block font-sans">총 채무</span>
                        <strong className="text-slate-900 font-black">{(fp.debtTotal || 0).toLocaleString()}만</strong>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block font-sans">월 소득</span>
                        <strong className="text-blue-600 font-bold">{(fp.income || 0).toLocaleString()}만</strong>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 block font-sans">총 자산</span>
                        <strong className="text-slate-700 font-bold">{(fp.assetsTotal || 0).toLocaleString()}만</strong>
                      </div>
                    </div>

                    {/* 하단 3행: 위험 태그 2개+n + 상태 뱃지 */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1 overflow-hidden">
                        {tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                            {t}
                          </span>
                        ))}
                        {tags.length > 2 && (
                          <span className="text-xs font-bold px-1 py-0.5 text-slate-400">
                            +{tags.length - 2}
                          </span>
                        )}
                      </div>

                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${workflow.color}`}>
                        {workflow.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── 우측 미리보기 영역 (탭 3개: 요약 / AI 검토 / 제안서) ── */}
        {activeRequest ? (
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {/* 우측 상단 탭 & 주 버튼 액션 바 */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[
                  { key: 'summary', label: '사건 요약' },
                  { key: 'ai-review', label: '사건 검토' },
                  { key: 'proposal', label: '제안서' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPreviewTab(tab.key as any)}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer press-scale ${
                      previewTab === tab.key
                        ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 주 버튼 흐름 (기획서 4.6: 상태에 따라 하나) */}
              <div className="flex items-center gap-2">
                {getRequestWorkflowState(activeRequest).key === 'new' && (
                  <button
                    type="button"
                    onClick={() => handleStartReview(activeRequest)}
                    className="px-4 py-2 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>사건 검토 시작</span>
                  </button>
                )}

                {getRequestWorkflowState(activeRequest).key === 'reviewing' && (
                  <button
                    type="button"
                    onClick={() => setPreviewTab('proposal')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>맞춤 제안서 작성</span>
                  </button>
                )}

                {(getRequestWorkflowState(activeRequest).key === 'proposal_sent' || getRequestWorkflowState(activeRequest).key === 'contact_shared') && (
                  <button
                    type="button"
                    onClick={() => onOpenCase(activeRequest.id, 1, 'proposal')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <span>사건 워크스페이스 열기</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenChat(activeRequest.id)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>채팅창</span>
                </button>

                {(activeRequest.mySeatStatus === 'requested' || activeRequest.mySeatStatus === 'reviewing' || activeRequest.mySeatStatus === 'proposed') && (
                  <button
                    type="button"
                    onClick={() => setDeclineTarget(activeRequest)}
                    className="px-3 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>이번엔 어려워요</span>
                  </button>
                )}
              </div>
            </div>

            {/* 응답 기한 (요청 다음 날부터 2영업일째 끝, 20261031001300) */}
            {activeRequest.mySeatStatus === 'requested' && activeRequest.myRespondBy && (
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 text-xs text-amber-900 font-bold flex flex-wrap items-center gap-2" role="status">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  응답 기한 {formatRespondBy(activeRequest.myRespondBy)}까지 · 검토 시작·채팅·제안서·거절 중 하나로 답해 주세요.
                  기한이 지나면 요청이 닫히고 의뢰인은 다른 변호사를 고를 수 있어요.
                </span>
              </div>
            )}
            {activeRequest.mySeatStatus === 'released' && (
              <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 text-xs text-slate-700 font-bold" role="status">
                의뢰인이 다른 변호사와 상담을 이어가기로 해 이 요청에는 더 응답할 수 없어요.
              </div>
            )}

            {/* 우측 탭 컨텐츠 바디 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* ── 탭 1: 요약 (사연 · 재무 · 확인 필요 사항) ── */}
              {previewTab === 'summary' && (
                <div className="space-y-5 animate-fadeIn">
                  {/* 의뢰인 기본 정보 및 사연 카드 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">신청인 프로필</span>
                        <h3 className="text-base font-black text-slate-900 mt-0.5">
                          {getClientDisplay(activeRequest).displayName} ({activeRequest.financialProfile?.residenceRegion || '지역 미지정'})
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                        사건접수 ID: {activeRequest.id}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 block">채무 발생 경위 및 사연</span>
                      <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap font-sans">
                        {activeRequest.content || '고객이 작성한 추가 사연 내용이 없습니다.'}
                      </p>
                    </div>
                  </div>

                  {/* 재무 상태 4대 요건 카드 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <h4 className="text-xs font-black text-slate-800">자가진단 재무 프로필 세부</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block">총 채무액</span>
                        <span className="text-sm font-black text-slate-900 font-mono mt-0.5 block">
                          {(activeRequest.financialProfile?.debtTotal || 0).toLocaleString()}만원
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block">총 자산액 (청산가치)</span>
                        <span className="text-sm font-black text-blue-600 font-mono mt-0.5 block">
                          {(activeRequest.financialProfile?.assetsTotal || 0).toLocaleString()}만원
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block">월 평균 소득</span>
                        <span className="text-sm font-black text-emerald-600 font-mono mt-0.5 block">
                          {(activeRequest.financialProfile?.income || 0).toLocaleString()}만원
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-400 block">부양가족</span>
                        <span className="text-sm font-black text-indigo-600 font-mono mt-0.5 block">
                          {activeRequest.financialProfile?.dependents || 1}명
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 탭 2: 사건 검토 (CV-2: 통합 엔진·서버 기록, 고정 문장 총평 삭제) ── */}
              {previewTab === 'ai-review' && (
                <div className="space-y-5 animate-fadeIn">
                  <CaseReviewPanel
                    officeId={officeId}
                    caseKey={activeRequest.id}
                    financialProfile={activeRequest.financialProfile}
                    canWrite={canWriteReview}
                    onUseInProposal={onOpenProposalDraft ? () => onOpenProposalDraft(activeRequest.id) : undefined}
                  />
                </div>
              )}

              {/* ── 탭 3: 제안서 — 작성·발송은 제안서 작성 화면 하나에서 (CV-6) ── */}
              {previewTab === 'proposal' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 animate-fadeIn">
                  <h3 className="font-bold text-sm text-slate-900">변호사 검토 제안서</h3>
                  {currentMyProposal ? (
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div><dt className="text-slate-500">월 변제금</dt><dd className="font-bold text-slate-900">{currentMyProposal.monthlyPayment ? `${Number(currentMyProposal.monthlyPayment).toLocaleString('ko-KR')}만원` : '-'}</dd></div>
                      <div><dt className="text-slate-500">변제 기간</dt><dd className="font-bold text-slate-900">{currentMyProposal.duration ? `${currentMyProposal.duration}개월` : '-'}</dd></div>
                      <div><dt className="text-slate-500">수임료</dt><dd className="font-bold text-slate-900">{currentMyProposal.fee ? `${Number(currentMyProposal.fee).toLocaleString('ko-KR')}만원` : '-'}</dd></div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-600">아직 보낸 제안서가 없어요. '사건 검토'에서 계산을 확인한 뒤 제안서를 써 주세요.</p>
                  )}
                  {onOpenProposalDraft && (
                    <div className="flex justify-end">
                      <button type="button" onClick={() => onOpenProposalDraft(activeRequest.id)} className="min-h-[44px] px-5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-sm rounded-xl whitespace-nowrap active:scale-[0.98]">
                        {currentMyProposal ? '제안서 고쳐 보내기' : '제안서 쓰기'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 text-slate-400">
            <div className="text-center space-y-2">
              <Inbox className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-bold">좌측 목록에서 상담 요청을 선택해 주세요.</p>
            </div>
          </div>
        )}
      </div>

      {declineTarget && (
        <div className="fixed inset-0 z-[300] bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="decline-title">
          <div className="bg-white rounded-3xl shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="space-y-1">
              <h3 id="decline-title" className="text-base font-black text-slate-900">이번 상담 요청을 거절할까요?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                의뢰인에게는 사유 없이 "이번엔 맡기 어렵다"고만 안내되고, 의뢰인은 다른 변호사를 고를 수 있어요.
                거절하면 이 요청과 보낸 제안서는 더 볼 수 없어요.
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold text-slate-700 mb-1">사유 (사무소 기록에만 남아요)</legend>
              {CONSULT_DECLINE_REASONS.map(r => (
                <label key={r.value} className="flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-slate-200 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                  <input type="radio" name="decline-reason" value={r.value} checked={declineReason === r.value} onChange={() => setDeclineReason(r.value)} />
                  <span className="text-sm text-slate-800">{r.label}</span>
                </label>
              ))}
            </fieldset>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-slate-700">메모 (선택, 300자)</span>
              <textarea
                value={declineNote}
                onChange={e => setDeclineNote(e.target.value.slice(0, 300))}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeclineTarget(null)} disabled={declineBusy}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 whitespace-nowrap active:scale-[0.98] cursor-pointer">
                닫기
              </button>
              <button type="button" onClick={submitDecline} disabled={declineBusy}
                className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-60">
                {declineBusy ? '보내는 중…' : '거절 전하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
