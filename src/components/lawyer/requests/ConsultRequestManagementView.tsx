import React, { useState, useMemo } from 'react';
import { 
  Inbox, Sparkles, Send, MessageSquare, ArrowRight, Eye, 
  Clock, ShieldAlert, CheckCircle2, AlertTriangle, FileText, 
  Building2, User, ChevronRight, Search, Filter, EyeOff, RotateCcw,
  Coins, Scale, Check, X, PhoneCall, Zap, HelpCircle, UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ConsultRequest, ConsultProposal, FinancialProfile, User as UserType, StaffMember 
} from '../../../types';
import { useDialog } from '../../common/DialogProvider';
import { getLivingExpense } from '../../../services/repayment/repaymentConstants2026';

interface ConsultRequestManagementViewProps {
  requests: ConsultRequest[];
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  activeLawyer: UserType;
  activeStaff?: StaffMember | null;
  onOpenCase: (clientId: string, stage?: number, section?: string) => void;
  onOpenChat: (threadId: string) => void;
}

export type RequestFilterTab = 'all' | 'new' | 'reviewing' | 'proposal_sent' | 'urgent' | 'hidden';

export default function ConsultRequestManagementView({
  requests,
  setRequests,
  activeLawyer,
  activeStaff,
  onOpenCase,
  onOpenChat,
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

  // 제안서 편집 폼 상태
  const [proposalFee, setProposalFee] = useState(200); // 수임료 (만원)
  const [proposalInstallment, setProposalInstallment] = useState('3회 분납');
  const [proposalDuration, setProposalDuration] = useState(36); // 변제기간 (개월)
  const [proposalReductionRate, setProposalReductionRate] = useState(65); // 탕감률 (%)
  const [proposalMonthlyPayment, setProposalMonthlyPayment] = useState(40); // 월 변제금 (만원)
  const [proposalMessage, setProposalMessage] = useState('');
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

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

  // 선택된 요청 변경 시 제안서 폼 초기화 & AI 검토 자동 프리필 연동
  const currentMyProposal = activeRequest ? getMyProposal(activeRequest) : null;

  React.useEffect(() => {
    if (activeRequest) {
      const fp: Partial<FinancialProfile> = activeRequest.financialProfile || {};
      const debt = fp.debtTotal || 5000;
      const income = fp.income || 250;
      const dependents = fp.dependents || 1;
      const livingCost = getLivingExpense(dependents);
      const available = Math.max(0, income - livingCost);
      const calculatedReduction = debt > 0 ? Math.min(85, Math.max(20, Math.round((1 - (available * 36) / Math.max(1, debt)) * 100))) : 65;

      if (currentMyProposal) {
        setProposalFee(currentMyProposal.fee || 200);
        setProposalInstallment(currentMyProposal.installment || '3회 분납');
        setProposalDuration(currentMyProposal.duration || 36);
        setProposalReductionRate(currentMyProposal.reductionRate || calculatedReduction);
        setProposalMonthlyPayment(currentMyProposal.monthlyPayment || available);
        setProposalMessage(currentMyProposal.remark || '');
      } else {
        setProposalFee(200);
        setProposalInstallment('3회 분납');
        setProposalDuration(36);
        setProposalReductionRate(calculatedReduction);
        setProposalMonthlyPayment(available);
        setProposalMessage(
          `신청인의 소득(${income.toLocaleString()}만원)과 ${dependents}인 가구 법정생계비를 고려할 때, 월 변제금 약 ${available.toLocaleString()}만원 선에서 총 채무의 약 ${calculatedReduction}% 수준 탕감이 기대됩니다. 신속하고 안전하게 사건을 수임해 드리겠습니다.`
        );
      }
    }
  }, [activeRequest?.id, currentMyProposal]);

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

  // AI 분석 결과 제안서 자동 반영
  const handleApplyAiToProposal = () => {
    if (!activeRequest) return;
    const fp: Partial<FinancialProfile> = activeRequest.financialProfile || {};
    const debt = fp.debtTotal || 5000;
    const income = fp.income || 250;
    const dependents = fp.dependents || 1;
    const livingCost = getLivingExpense(dependents);
    const available = Math.max(0, income - livingCost);
    const calculatedReduction = debt > 0 ? Math.min(85, Math.max(20, Math.round((1 - (available * 36) / Math.max(1, debt)) * 100))) : 68;

    setProposalReductionRate(calculatedReduction);
    setProposalMonthlyPayment(available);
    setProposalMessage(
      `[AI 사건 정밀진단 반영]\n신청인님의 총 채무 ${debt.toLocaleString()}만원 대비 청산가치 및 가용소득을 분석한 결과, 월 약 ${available.toLocaleString()}만원씩 36개월간 변제 시 원금의 약 ${calculatedReduction}% 감면이 가능할 것으로 진단되었습니다. 변호사가 직접 보정권고 및 개시결정까지 1:1 전담 대응합니다.`
    );
    setPreviewTab('proposal');
    toast.success('AI 사건 분석 결과가 제안서 작성기에 자동 반영되었습니다.');
  };

  // 제안서 발송 (변호사) 또는 컨펌 요청 (직원)
  const handleSubmitProposal = async (isConfirmRequest: boolean = false) => {
    if (!activeRequest) return;
    if (proposalFee <= 0) {
      toast.warning('제안 수임료를 입력해 주세요.');
      return;
    }

    setIsSubmittingProposal(true);
    try {
      const proposalDebtTotal = activeRequest.financialProfile?.debtTotal || 0;
      const newProposal: ConsultProposal = {
        id: `prop-${Date.now()}`,
        lawyerId: activeLawyer.id,
        lawyerName: activeLawyer.name,
        lawyerAvatar: activeLawyer.avatar || '',
        firmName: activeLawyer.firmName || activeLawyer.firm || '',
        feasibility: '',
        fee: proposalFee,
        installment: proposalInstallment,
        duration: proposalDuration,
        reductionRate: proposalReductionRate,
        totalReduction: Math.round(proposalDebtTotal * (proposalReductionRate / 100)),
        monthlyPayment: proposalMonthlyPayment,
        remark: proposalMessage,
        createdAt: new Date().toISOString(),
        // 대표 변호사 컨펌 요청이면 승인 대기 (이전: ConsultProposal에 없는 status/message/updatedAt 필드 사용)
        approvalStatus: isConfirmRequest ? 'pending' : 'approved',
      };

      setRequests(prev => prev.map(r => {
        if (r.id === activeRequest.id) {
          const others = (r.proposals || []).filter(p => p.lawyerId !== activeLawyer.id);
          return {
            ...r,
            proposals: [...others, newProposal],
            status: isConfirmRequest ? r.status : 'comparing',
          };
        }
        return r;
      }));

      if (isConfirmRequest) {
        toast.success('대표 변호사님께 제안서 승인(컨펌) 요청이 전송되었습니다.');
      } else {
        toast.success(`의뢰인(${getClientDisplay(activeRequest).displayName})에게 맞춤 제안서가 성공적으로 발송되었습니다!`);
      }
    } finally {
      setIsSubmittingProposal(false);
    }
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
              플랫폼에 접수된 고객의 무료 상담 신청 및 자가진단 내역을 검토하고 제안서를 발송하세요.
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
                  { key: 'ai-review', label: 'AI 정밀 검토' },
                  { key: 'proposal', label: '맞춤 제안서' },
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
              </div>
            </div>

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

              {/* ── 탭 2: AI 정밀 검토 (청산가치 · 가용소득 · 3대 리스크) ── */}
              {previewTab === 'ai-review' && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-2xs">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">AI 사건 종합 진단 및 탕감 시뮬레이션</h3>
                          <p className="text-xs text-slate-500">채무-자산-소득 데이터를 교차 분석한 인공지능 리포트입니다.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyAiToProposal}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer press-scale"
                      >
                        <Sparkles className="w-3 h-3 text-amber-300" />
                        <span>제안서에 분석 반영</span>
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-950 leading-relaxed">
                      신청인은 월 가용소득 약 {(activeRequest.financialProfile?.income || 0) > 130 ? ((activeRequest.financialProfile?.income || 0) - 130).toLocaleString() : 0}만원 수준으로 36개월 기준 총 채무의 최대 약 {proposalReductionRate}% 감면 및 인가가 가능한 우량 적격 사례로 분석됩니다.
                    </div>
                  </div>
                </div>
              )}

              {/* ── 탭 3: 맞춤 제안서 작성 및 발송 ── */}
              {previewTab === 'proposal' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-blue-600 text-white shadow-2xs">
                        <Send className="w-4 h-4" />
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">맞춤 솔루션 및 제안서 작성</h3>
                        <p className="text-xs text-slate-500">의뢰인의 모바일 앱으로 실시간 전송되는 1:1 맞춤 제안서입니다.</p>
                      </div>
                    </div>

                    {currentMyProposal && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                        기존 제안서 발송됨
                      </span>
                    )}
                  </div>

                  {/* 3대 핵심 수치 입력 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">예상 채무 탕감률 (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="95"
                        value={proposalReductionRate}
                        onChange={e => setProposalReductionRate(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">예상 월 변제금 (만원)</label>
                      <input
                        type="number"
                        value={proposalMonthlyPayment}
                        onChange={e => setProposalMonthlyPayment(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">제안 수임료 (만원)</label>
                      <input
                        type="number"
                        value={proposalFee}
                        onChange={e => setProposalFee(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>

                  {/* 전달 메시지 입력창 */}
                  <div className="space-y-1.5 text-xs">
                    <label className="font-bold text-slate-700">의뢰인 전달 상담 소견 및 메시지</label>
                    <textarea
                      rows={5}
                      value={proposalMessage}
                      onChange={e => setProposalMessage(e.target.value)}
                      placeholder="의뢰인에게 맞춤형 법률 조언과 안심 메시지를 작성하세요..."
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#1E3A5F] leading-relaxed"
                    />
                  </div>

                  {/* 발송 / 컨펌 요청 액션 바 */}
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    {isStaff ? (
                      <button
                        type="button"
                        onClick={() => handleSubmitProposal(true)}
                        disabled={isSubmittingProposal}
                        className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>대표 변호사 컨펌 요청</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubmitProposal(false)}
                        disabled={isSubmittingProposal}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{currentMyProposal ? '제안서 수정 재발송' : '의뢰인에게 제안서 발송'}</span>
                      </button>
                    )}
                  </div>
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
    </div>
  );
}
