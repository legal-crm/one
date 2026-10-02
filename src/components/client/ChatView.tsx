import React, { useRef, useEffect, useState } from 'react';
import { Check, ListChecks, Lock, MessageCircle, Phone, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import MyPageView from './MyPageView';
import {
  LAWYER_REQUEST_LIMIT,
  clientSystemMessageText,
  getConsultRoomBadge,
  getConsultRoomStage,
  getRequestRoomStage,
  isChatStage,
  type ConsultRoomStage,
} from './consultFlow';
import { Button, Modal, SegmentedTabs } from './ui';
import { cn } from '../../utils/cn';
import { ConsultRequest, ConsultMessage, ConsultProposal, FinancialProfile, User as UserType } from '../../types';
import { purgeConsultationRecord } from '../../services/consultService';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import ChatMessageList from './room/ChatMessageList';
import ChatComposer, { type ChatComposerHandle } from './room/ChatComposer';
import MatchPanel from './room/MatchPanel';
import DebtSummaryPanel from './room/DebtSummaryPanel';
import ConsultStatusStrip, { getStageCopy } from './room/ConsultStatusStrip';
import { getDisplayName } from './lawyerDirectory';
import PremiumProposalReportModal from '../common/PremiumProposalReportModal';
import { startContractFromProposal, requestOfflineContractFromProposal } from '../../services/proposalContractService';
import ContractMethodSelectModal, { type OfflineContractRequestPayload } from './ContractMethodSelectModal';

const PrintableReportTemplate = React.lazy(() => import('./PrintableReportTemplate'));

/* ─────────────────────────────────────────────
   내 관리방 (상담방 우선 구조)
   - 맨 위: 지금 단계 + 다음 할 일 + 주 버튼 1개 (단계 계산은 consultFlow.getConsultRoomStage 한 곳)
   - 모바일: [상담방 | 요청·제안 | 내 채무] 세그먼트 탭 / 데스크톱(lg): 2열(주 영역 + 옆 칸)
   - 상담방: 날짜 구분선·말풍선 묶음·자동 높이 입력창·예시 질문
   ───────────────────────────────────────────── */

type RoomTab = 'room' | 'match' | 'debt';

const NOTICE_DISMISS_KEY = 'legal_crm_dismiss_privacy_banner';
const NOTICE_DISMISS_MS = 60 * 60 * 1000;

interface ChatViewProps {
  requests: ConsultRequest[];
  messages: ConsultMessage[];
  activeChatReqId: string;
  chatInput: string;
  isLoggedIn: boolean;
  userAlias: string;
  onSetActiveChatReqId: (id: string) => void;
  onSetChatInput: (val: string) => void;
  onSetActiveTab: (tab: string) => void;
  onSetRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  /** 대화 상대에게 입력 중인 메시지를 보낸다. 서버 저장까지 끝나면 true */
  onSendChat: (targetLawyerId?: string) => void | Promise<boolean>;
  onAddMessage: (requestId: string, message: string, senderType: 'client' | 'lawyer' | 'admin' | 'system', senderId: string, senderName: string, targetLawyerId?: string) => void | Promise<boolean>;
  /** 전송 실패한 메시지를 같은 id로 다시 보낸다 */
  onRetryMessage?: (messageId: string) => Promise<boolean>;
  /** 고른 변호사에게 상담을 요청한다 (상담 정보 제공 동의 → 기존 요청 유지·한도 적용·새 변호사에게만 안내) */
  onRequestLawyers: (request: ConsultRequest, lawyerIds: string[]) => void;
  /** 공개 요청으로 제안 받기 (상담 정보 제공 동의 후 등록·승인된 변호사가 확인) */
  onRequestOpenMatching?: (request: ConsultRequest) => void;
  /** 변호사 찾기를 '여러 명 골라 요청하기' 모드로 열어 이 상담 요청에 변호사를 더한다 */
  onBrowseLawyersToRequest?: (requestId: string) => void;

  activeRequest?: ConsultRequest;
  activeResult?: RehabCalculationResult;
  onUpdateFinancialProfile: (updatedProfile: FinancialProfile) => void;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  lawyers?: UserType[];
  showDiagnosisReport?: boolean;
}

const stripLawyerSuffix = (name?: string) => (name || '').replace(/\s*변호사$/, '');

function formatRequestDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export default function ChatView({
  requests, messages, activeChatReqId, chatInput,
  userAlias,
  onSetActiveChatReqId, onSetChatInput,
  onSetActiveTab, onSetRequests, onSendChat, onAddMessage, onRetryMessage, onRequestLawyers, onRequestOpenMatching,
  onBrowseLawyersToRequest,
  activeRequest,
  activeResult,
  onUpdateFinancialProfile,
  setUserAlias,
  isEditingAlias,
  setIsEditingAlias,
  tempAlias,
  setTempAlias,
  lawyers = [],
}: ChatViewProps) {
  const dialog = useDialog();
  const chatFeedRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ChatComposerHandle>(null);
  const [showProfilePanel, setShowProfilePanel] = useState<boolean>(false);
  const [showPhoneConsultModal, setShowPhoneConsultModal] = useState<boolean>(false);
  const [activeChatLawyerId, setActiveChatLawyerId] = useState<string | null>(null);
  const [selectedProposalForReport, setSelectedProposalForReport] = useState<ConsultProposal | null>(null);
  const [contractSelectProposal, setContractSelectProposal] = useState<ConsultProposal | null>(null);
  const [showNotice, setShowNotice] = useState<boolean>(true);
  const [noticeExpanded, setNoticeExpanded] = useState<boolean>(false);

  const currentRequest = requests.find(r => r.id === activeChatReqId) || activeRequest;

  // ── 상담 안내(비밀 보호·참고 의견): 닫으면 1시간 동안 숨긴다 ──
  useEffect(() => {
    const dismissedAt = parseInt(localStorage.getItem(NOTICE_DISMISS_KEY) || '0', 10);
    setShowNotice(!dismissedAt || Date.now() - dismissedAt > NOTICE_DISMISS_MS);
  }, [currentRequest?.id]);
  const closeNotice = () => {
    localStorage.setItem(NOTICE_DISMISS_KEY, Date.now().toString());
    setShowNotice(false);
  };

  // 제안서 조건으로 전자 수임계약 시작 (채팅방 내 원스톱)
  // 버튼 클릭만으로 '체결 완료'를 기록하지 않는다 — 서명 대기 계약서를 만든 뒤
  // 본인인증·약관 동의·자필 서명 화면으로 이동한다.
  const handleAppointLawyerFromChat = async (proposal: ConsultProposal) => {
    if (!currentRequest) return;
    const confirmed = await dialog.confirm({
      title: `${proposal.lawyerName} 변호사 전자 수임계약 진행`,
      message: `${proposal.lawyerName} 변호사의 제안 조건(수임료 ${proposal.fee}만원${proposal.installment ? `, ${proposal.installment}` : ''})으로 전자 수임계약서를 작성합니다.\n\n다음 화면에서 휴대폰 본인인증과 계약서 확인·서명을 마쳐야 계약이 체결됩니다. 본인인증 시 가명 대신 실명으로 계약서가 작성됩니다.`,
      confirmText: '계약서 확인하러 가기',
      cancelText: '더 상담하기',
      variant: 'primary'
    });

    if (!confirmed) return;

    try {
      const { signUrl } = await startContractFromProposal({
        request: currentRequest,
        proposal,
        clientDisplayName: currentRequest.stealthNickname || currentRequest.clientName || '의뢰인',
      });
      setSelectedProposalForReport(null);
      window.location.assign(signUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계약서 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  // 온·오프라인 서면(방문/우편) 수임계약 요청 핸들러
  const handleExecuteOfflineContract = async (payload: OfflineContractRequestPayload) => {
    if (!currentRequest || !contractSelectProposal) return;
    try {
      await requestOfflineContractFromProposal({
        request: currentRequest,
        proposal: contractSelectProposal,
        clientDisplayName: currentRequest.stealthNickname || currentRequest.clientName || '의뢰인',
        payload,
      });

      const modeLabel = payload.method === 'in_person' ? '방문 체결' : '우편 등기 계약';
      const detailInfo = payload.method === 'in_person'
        ? `방문 희망: ${payload.visitDate || ''} ${payload.visitTime || ''}${payload.notes ? ` (메모: ${payload.notes})` : ''}`
        : `배송 주소: ${payload.postalAddress || ''} ${payload.postalDetailAddress || ''}${payload.notes ? ` (메모: ${payload.notes})` : ''}`;

      if (currentRequest.id && onAddMessage) {
        await onAddMessage(
          currentRequest.id,
          `[${modeLabel} 요청] 의뢰인님이 제안서 조건으로 ${modeLabel}을 요청하셨습니다. (${detailInfo})\n담당자가 확인 후 연락드립니다.`,
          'client',
          currentRequest.clientId || 'client',
          currentRequest.stealthNickname || currentRequest.clientName || '의뢰인',
          contractSelectProposal.lawyerId
        );
      }

      toast.success(`${modeLabel} 요청이 정상 접수되었습니다. 담당 사무소에서 확인 후 연락드립니다.`);
    } catch (err: any) {
      toast.error(err?.message || '요청 처리 중 오류가 발생했습니다. 담당 사무소로 직접 문의해 주세요.');
    }
  };

  // financialProfile → RehabUserInput 재구성 (상세 진단서 표시용)
  const reportUserInput: RehabUserInput | undefined = React.useMemo(() => {
    const profile = activeRequest?.financialProfile;
    if (!profile) return undefined;
    return {
      address: profile.residenceRegion || '서울',
      workLocation: undefined,
      age: 35,
      employmentType: profile.jobType === 'SALARIED' ? 'salary' :
                      profile.jobType === 'BUSINESS' ? 'business' :
                      profile.jobType === 'DAILY' ? 'daily' :
                      profile.jobType === 'FREELANCER' ? 'freelancer' : 'salary',
      monthlyIncome: (profile.income || 0) * 10000,
      familySize: (profile.dependents || 0) + 1,
      spouseAssets: (profile.spouseAsset || 0) * 10000,
      rentCost: (profile.rentCost || 0) * 10000,
      deposit: (profile.rentalDeposit || 0) * 10000,
      depositLoan: (profile.depositLoan || 0) * 10000,
      housingType: profile.housingType,
      housingContractHolder: profile.housingContractHolder,
      myAssets: Math.max(0, (profile.assetsTotal || 0) - (profile.rentalDeposit || 0) - (profile.spouseAsset || 0) - (profile.retirementPay || 0)) * 10000,
      totalDebt: (profile.debtTotal || 0) * 10000,
      priorityDebt: (profile.priorityDebt || 0) * 10000,
      speculativeLoss: (profile.speculativeLoss || 0) * 10000,
      gamblingLoss: (profile.gamblingLoss || 0) * 10000,
      retirementPensionType: profile.retirementPensionType || 'unknown',
      retirementPay: (profile.retirementPay || 0) * 10000,
      isMarried: profile.maritalStatus === 'MARRIED',
      maritalStatus: profile.maritalStatus === 'SINGLE' ? 'single' : profile.maritalStatus === 'MARRIED' ? 'married' : 'divorced',
      minorChildren: profile.dependents || 0,
      legalActions: profile.legalActions || [],
      name: (profile as any).name || profile.clientName || userAlias || '의뢰인',
    };
  }, [activeRequest]);

  // 상담을 요청한 변호사 = 상담 요청에 저장된 목록 (화면 전용 사본을 두지 않아 새로고침·다른 상담방 전환에도 어긋나지 않는다)
  const requestedLawyerIds: string[] = currentRequest?.selectedLawyerIds || [];
  const acceptedIds = currentRequest?.acceptedLawyerIds || [];
  const hasMultipleAccepted = acceptedIds.length > 1;

  // 제안서: 의뢰인이 지정한 변호사의 제안만, 요청당 최대 3건 (LAWYER_REQUEST_LIMIT와 동일 한도)
  const proposals: ConsultProposal[] = React.useMemo(() => {
    const all = currentRequest?.proposals || [];
    const selectedIds = currentRequest?.selectedLawyerIds || [];
    const scoped = selectedIds.length > 0 ? all.filter(p => selectedIds.includes(p.lawyerId)) : all;
    return scoped.slice(0, LAWYER_REQUEST_LIMIT);
  }, [currentRequest?.proposals, currentRequest?.selectedLawyerIds]);

  // 현재 대화 상대 변호사: 탭 선택 > 전담 변호사 > 상담을 수락한 첫 변호사(탭 기본 선택) > 제안서가 1건뿐이면 그 변호사
  // 탭 선택값은 이 상담방의 변호사일 때만 쓴다 (다른 상담방에서 고른 값이 남아 엉뚱한 변호사에게 보내지 않도록)
  const isKnownChatLawyer = (id: string | null): id is string =>
    !!id && (acceptedIds.includes(id) || proposals.some(p => p.lawyerId === id) || currentRequest?.selectedLawyerId === id);
  const currentChatLawyerId: string | undefined =
    (isKnownChatLawyer(activeChatLawyerId) ? activeChatLawyerId : undefined)
    || currentRequest?.selectedLawyerId
    || acceptedIds[0]
    || (proposals.length === 1 ? proposals[0].lawyerId : undefined);
  const lawyerNameOf = (id?: string) => stripLawyerSuffix(
    (id && (proposals.find(p => p.lawyerId === id)?.lawyerName || lawyers.find(l => l.id === id)?.name)) || ''
  );
  const currentChatLawyerName = lawyerNameOf(currentChatLawyerId);
  // 다른 변호사를 전담으로 정한 뒤에는 나머지 변호사와의 대화를 닫는다
  const isChatClosedWithCurrent = currentRequest?.status === 'counseling'
    && !!currentRequest.selectedLawyerId && !!currentChatLawyerId
    && currentRequest.selectedLawyerId !== currentChatLawyerId;
  const canSendChat = !!currentChatLawyerId && !isChatClosedWithCurrent;
  const composerHint = !currentChatLawyerId
    ? (proposals.length > 0
      ? '대화할 변호사를 먼저 선택해 주세요. 제안서의 \'상담 시작\'을 누르면 그 변호사와 대화할 수 있습니다.'
      : '변호사가 상담을 수락하면 대화할 수 있습니다.')
    : isChatClosedWithCurrent ? '이 변호사와의 상담은 종료되었습니다.' : '';

  const handleSendChatMessage = () => {
    if (!canSendChat || !chatInput.trim()) return;
    void onSendChat(currentChatLawyerId);
  };

  const handleRetryChatMessage = async (messageId: string) => {
    if (!onRetryMessage) return;
    const ok = await onRetryMessage(messageId);
    if (!ok) toast.error('다시 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
  };
  // 계약 대상 제안서는 현재 대화 상대의 제안서로만 한정 (다른 변호사 제안서로 폴백하지 않음)
  const currentChatProposal = currentChatLawyerId ? (proposals.find(p => p.lawyerId === currentChatLawyerId) || null) : null;

  // 변호사별 대화 격리: 다른 변호사의 메시지·그 변호사 대상 메시지는 절대 섞어 보여주지 않는다
  const activeChatMessages = messages.filter(m => {
    if (m.consultRequestId !== (currentRequest?.id || activeChatReqId)) return false;
    const isSystem = m.senderType === 'system' || m.senderId === 'system';
    if (isSystem) {
      // 변호사에게만 필요한 안내(예: '상담 요청이 접수되었습니다… 검토해 주세요')는 의뢰인 화면에서 뺀다
      if (clientSystemMessageText(m.message) === null) return false;
      if (!m.targetLawyerId || m.targetLawyerId === 'client-only') return true;
      return m.targetLawyerId === currentChatLawyerId;
    }
    if (m.senderType === 'lawyer') return !!currentChatLawyerId && m.senderId === currentChatLawyerId;
    if (m.senderType === 'client') {
      // targetLawyerId 없는 과거 메시지는 대화 상대가 1명일 때만 표시 (하위 호환)
      if (!m.targetLawyerId) return !hasMultipleAccepted;
      return m.targetLawyerId === currentChatLawyerId;
    }
    // admin 등 기타 메시지는 특정 변호사 대상이면 해당 탭에서만
    return !m.targetLawyerId || m.targetLawyerId === currentChatLawyerId;
  });

  // ── 단계 (상태 줄·주 버튼·기본 탭을 여기서 한 번에 정한다) ──
  const stage: ConsultRoomStage = getConsultRoomStage({
    hasCheck: !!activeResult || !!currentRequest?.financialProfile,
    status: currentRequest?.status,
    requestType: currentRequest?.requestType,
    requestedLawyerIds,
    acceptedLawyerIds: acceptedIds,
    selectedLawyerId: currentRequest?.selectedLawyerId,
    proposalCount: proposals.length,
  });
  const chatAvailable = isChatStage(stage);
  const consultStatus = getConsultRoomBadge(stage, currentRequest?.status);
  const isOpenRequest = currentRequest?.requestType === 'open' && currentRequest?.status === 'requested';
  const canRequestOpenMatching = !!onRequestOpenMatching && !!currentRequest && !!activeResult && !isOpenRequest && requestedLawyerIds.length === 0;
  const slotsLeft = Math.max(0, LAWYER_REQUEST_LIMIT - new Set(requestedLawyerIds).size);
  const proposalLawyerIds = new Set(proposals.map(p => p.lawyerId));
  const waitingLawyers = requestedLawyerIds
    .filter(id => !proposalLawyerIds.has(id))
    .map(id => lawyers.find(l => l.id === id))
    .filter((l): l is UserType => !!l);

  // 모바일 기본 탭: 대화할 수 있으면 상담방, 아니면 요청·제안
  const [mobileTab, setMobileTab] = useState<RoomTab>(() => (chatAvailable ? 'room' : 'match'));
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMobileTab(chatAvailable ? 'room' : 'match');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRequest?.id]);
  /** 탭 전환 (탭 줄이 화면 위쪽에 오도록 올려 패널을 넓게 보여 준다) */
  const selectTab = (tab: RoomTab) => {
    setMobileTab(tab);
    window.requestAnimationFrame(() => {
      const el = tabsRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - (window.innerWidth >= 768 ? 72 : 64);
      if (window.scrollY < top - 1) window.scrollTo({ top, behavior: 'smooth' });
    });
  };

  // 새 메시지·대화 상대 변경·상담방 탭 전환 때 맨 아래로
  useEffect(() => {
    const feed = chatFeedRef.current;
    if (feed) feed.scrollTop = feed.scrollHeight;
  }, [activeChatMessages.length, currentChatLawyerId, mobileTab, chatAvailable]);

  /** 변호사 찾기로 이동: 이 상담 요청에 변호사를 더하는 선택 모드로 연다 */
  const browseLawyersForRequest = () => {
    if (currentRequest && onBrowseLawyersToRequest) onBrowseLawyersToRequest(currentRequest.id);
    else onSetActiveTab('lawyers');
  };

  /** 제안서의 '상담 시작': 지정 요청(direct)이면 바로 상담 변호사로, 여러 명 요청이면 비교 상담에 더한다 */
  const startConsultWithProposal = (bid: ConsultProposal) => {
    if (!currentRequest) return;
    if (currentRequest.requestType === 'direct') {
      onSetRequests(prev => prev.map(r =>
        r.id === currentRequest.id
          ? { ...r, status: 'counseling' as const, selectedLawyerId: bid.lawyerId }
          : r
      ));
      // 변호사 화면 필터(chatSelectors)가 이 문장으로 구분하므로 저장 문구는 그대로 둔다(의뢰인 화면은 consultFlow에서 바꿔 보여 줌)
      onAddMessage(
        currentRequest.id,
        `${bid.lawyerName} 변호사님의 제안서를 수락하셨습니다. 이제 1:1 전담 상담을 시작할 수 있습니다.`,
        'system', 'system', '시스템 안내', bid.lawyerId
      );
    } else {
      const newAccepted = Array.from(new Set([...(currentRequest.acceptedLawyerIds || []), bid.lawyerId]));
      onSetRequests(prev => prev.map(r =>
        r.id === currentRequest.id
          ? { ...r, status: 'comparing' as const, acceptedLawyerIds: newAccepted }
          : r
      ));
      onAddMessage(
        currentRequest.id,
        `${bid.lawyerName} 변호사님과 비교 상담을 시작합니다.`,
        'system', 'system', '시스템 안내', bid.lawyerId
      );
    }
    setActiveChatLawyerId(bid.lawyerId);
    selectTab('room');
  };

  const openChatWith = (lawyerId: string) => {
    setActiveChatLawyerId(lawyerId);
    selectTab('room');
  };

  /** 비교 상담 중 지금 대화 상대와 상담을 이어간다 (나머지 변호사와의 대화는 종료) */
  const continueWithCurrentLawyer = async () => {
    if (!currentRequest || !currentChatLawyerId) return;
    const chosenId = currentChatLawyerId;
    const chosenName = currentChatLawyerName ? `${currentChatLawyerName} 변호사` : '이 변호사';
    const confirmed = await dialog.confirm({
      title: `${chosenName}와 상담을 이어갈까요?`,
      message: '다른 변호사와의 비교 상담은 종료됩니다.\n수임 계약은 제안서 조건으로 본인인증과 서명을 마쳐야 체결됩니다.',
      confirmText: '이 변호사와 상담 이어가기',
      cancelText: '더 비교하기',
      variant: 'primary'
    });
    if (!confirmed) return;

    onSetRequests(prev => prev.map(r =>
      r.id === currentRequest.id
        ? { ...r, status: 'counseling' as const, selectedLawyerId: chosenId, rejectionNotified: true }
        : r
    ));
    setActiveChatLawyerId(chosenId);

    // 변호사 화면 문구는 변호사 대화 목록 필터(chatSelectors)가 문장으로 구분하므로 그대로 둔다
    onAddMessage(
      currentRequest.id,
      `[System] 🎉 의뢰인이 귀하를 전담 변호사로 선임하였습니다!`,
      'system', 'system', '시스템 안내', chosenId
    );
    const otherLawyers = (currentRequest.acceptedLawyerIds || []).filter(id => id !== chosenId);
    otherLawyers.forEach(otherId => {
      onAddMessage(
        currentRequest.id,
        `[System] 📋 의뢰인이 다른 변호사를 전담으로 선임하였습니다. 상담에 참여해 주셔서 감사합니다.`,
        'system', 'system', '시스템 안내', otherId
      );
    });
    toast.success(`${chosenName}와 상담을 이어갑니다.`);
  };

  /** 상담 변호사 확정 취소 → 다시 비교할 수 있게 */
  const cancelConfirmedLawyer = async () => {
    const confirmed = await dialog.confirm({
      title: '상담 변호사 확정을 취소할까요?',
      message: '취소하면 다른 변호사와 다시 비교 상담할 수 있습니다. 지금까지의 대화 기록은 남습니다.',
      confirmText: '확정 취소',
      cancelText: '그대로 두기',
      variant: 'warning'
    });
    if (!confirmed || !currentRequest) return;
    onSetRequests(prev => prev.map(r =>
      r.id === currentRequest.id ? { ...r, selectedLawyerId: undefined, status: 'responding' } : r
    ));
    toast.success('상담 변호사 확정을 취소했습니다.');
  };

  /** 답변 전 변호사에게 보낸 요청 취소 */
  const cancelLawyerRequest = async (lawyer: UserType) => {
    if (!currentRequest) return;
    const name = getDisplayName(lawyer);
    const confirmed = await dialog.confirm({
      title: `${name} 변호사에게 보낸 요청을 취소할까요?`,
      message: '취소하면 이 변호사에게 취소 안내가 전달됩니다. 빈 자리만큼 다른 변호사에게 다시 요청할 수 있어요.',
      confirmText: '요청 취소',
      cancelText: '그대로 두기',
      variant: 'danger'
    });
    if (!confirmed) return;

    // 상담 요청 대상에서 제외 (화면의 요청 목록도 이 값을 그대로 읽는다)
    const updatedLawyerIds = (currentRequest.selectedLawyerIds || []).filter(id => id !== lawyer.id);
    const allCancelled = updatedLawyerIds.length === 0;
    onSetRequests(prev => prev.map(r =>
      r.id === currentRequest.id
        ? { ...r, selectedLawyerIds: updatedLawyerIds, status: allCancelled ? 'cancelled' as const : r.status }
        : r
    ));
    // 변호사 화면 필터가 '상담 요청을 취소하였습니다'와 변호사 이름으로 구분한다
    if (allCancelled) {
      onAddMessage(currentRequest.id, `의뢰인이 모든 변호사에 대한 상담 요청을 취소하였습니다.`, 'system', 'system', '시스템 안내');
    } else {
      onAddMessage(currentRequest.id, `의뢰인이 ${name} 변호사님에 대한 상담 요청을 취소하였습니다.`, 'system', 'system', '시스템 안내', lawyer.id);
    }
    toast.success(`${name} 변호사에게 보낸 요청을 취소했습니다.`);
  };

  const requestPhoneConsult = () => {
    if (!currentRequest || !currentChatLawyerId) return;
    onAddMessage(
      currentRequest.id,
      '[System] 📞 의뢰인이 전화상담을 요청했습니다. 채팅으로 통화 가능한 시간을 조율해 주세요.',
      'system', 'system', '시스템 안내', currentChatLawyerId
    );
    setShowPhoneConsultModal(false);
    toast.success('전화상담 요청을 보냈습니다. 변호사의 답변을 채팅에서 확인해 주세요.');
  };

  // 상담 기록 완전 삭제 (대화·제안서·체크 정보)
  const handlePurgeRecord = async () => {
    if (!currentRequest?.id) return;
    const confirmed = await dialog.confirm({
      title: '이 상담 기록을 삭제할까요?',
      message: '이 상담방의 대화 내용, 제안서, 진단 정보가 서버와 이 기기에서 영구 삭제되며 복구할 수 없습니다.\n\n변호사 사무소가 법령에 따라 보관하는 수임 기록은 이 기능으로 삭제되지 않습니다.',
      confirmText: '영구 삭제',
      variant: 'danger',
    });

    if (confirmed) {
      const success = await purgeConsultationRecord(currentRequest.id);
      if (success) {
        onSetRequests(prev => prev.filter(r => r.id !== currentRequest.id));
        toast.success('상담 기록과 대화 내용을 삭제했습니다.');
      } else {
        toast.error('기록을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }
    }
  };

  // ── 상태 줄의 주 버튼 (단계마다 최대 1개 + 필요할 때 보조 1개) ──
  const stageActions: React.ReactNode = (() => {
    switch (stage) {
      case 'no_check':
        return <Button onClick={() => onSetActiveTab('request')}>내 상황 체크하기</Button>;
      case 'choose_lawyers':
        return (
          <>
            <Button onClick={browseLawyersForRequest} leftIcon={<ListChecks className="w-4 h-4" aria-hidden="true" />}>변호사 고르기</Button>
            {canRequestOpenMatching && currentRequest && (
              <Button variant="ghost" onClick={() => onRequestOpenMatching?.(currentRequest)}>공개 요청으로 제안 받기</Button>
            )}
          </>
        );
      case 'open_waiting':
        return <Button variant="secondary" onClick={browseLawyersForRequest}>변호사 직접 고르기</Button>;
      case 'counseling':
        return currentChatProposal && !isChatClosedWithCurrent
          ? <Button onClick={() => setContractSelectProposal(currentChatProposal)} leftIcon={<Check className="w-4 h-4" aria-hidden="true" />}>수임 계약 진행</Button>
          : null;
      case 'contracted':
        return <Button variant="secondary" onClick={() => onSetActiveTab('mypage')}>마이페이지에서 진행 보기</Button>;
      case 'closed':
        return <Button variant="secondary" onClick={() => onSetActiveTab('request')}>내 상황 체크 다시 하기</Button>;
      default:
        return null;
    }
  })();

  const stageCopy = getStageCopy(stage, {
    requestedCount: new Set(requestedLawyerIds).size,
    proposalCount: proposals.length,
    lawyerName: lawyerNameOf(currentRequest?.selectedLawyerId),
  });

  const switcher = requests.length > 1 && currentRequest ? (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-bold text-slate-600 shrink-0">상담 선택</span>
      <select
        value={currentRequest.id}
        onChange={(e) => { onSetActiveChatReqId(e.target.value); setActiveChatLawyerId(null); }}
        className="min-h-11 flex-1 sm:flex-none rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand"
      >
        {requests.map(r => {
          const s = getConsultRoomBadge(getRequestRoomStage(r), r.status);
          return (
            <option key={r.id} value={r.id}>
              {[formatRequestDate(r.createdAt) && `${formatRequestDate(r.createdAt)} 요청`, s?.label].filter(Boolean).join(' · ') || '상담 요청'}
            </option>
          );
        })}
      </select>
    </label>
  ) : null;

  // ── 잠긴 상담방 안내 (대화 전 단계) ──
  const lockedCopy: Record<string, string> = {
    no_check: '내 상황 체크를 마치고 변호사에게 상담을 요청하면, 제안서를 받은 뒤 이곳에서 1:1로 대화할 수 있어요.',
    choose_lawyers: '변호사에게 상담을 요청하면, 제안서를 받은 뒤 이곳에서 1:1로 대화할 수 있어요.',
    open_waiting: '제안서가 도착한 뒤 \'상담 시작\'을 누르면 그 변호사와 대화할 수 있어요.',
    waiting_reply: '변호사가 제안서를 보내면 \'상담 시작\'으로 대화를 열 수 있어요.',
    review_proposals: '제안서의 \'상담 시작\'을 누르면 그 변호사와 1:1로 대화할 수 있어요.',
    closed: '종료된 상담입니다.',
  };

  const tabs = [
    { id: 'room' as const, label: '상담방' },
    { id: 'match' as const, label: proposals.length > 0 ? `요청·제안 ${proposals.length}` : '요청·제안' },
    { id: 'debt' as const, label: '내 채무' },
  ];
  const panelClass = (tab: RoomTab, desktop: 'show' | 'hide' = 'show') =>
    cn(mobileTab === tab ? 'block' : 'hidden', desktop === 'show' ? 'lg:block' : 'lg:hidden');

  // ── 상담방 ──
  const roomSection = (desktop: 'show' | 'hide') => (
    <section
      id="room-panel-room"
      role="tabpanel"
      aria-labelledby="room-tab-room"
      className={panelClass('room', desktop)}
    >
      {/* 높이: 모바일은 헤더·탭 줄·하단 메뉴를 뺀 화면 높이, 태블릿은 하단 메뉴 없음, 데스크톱은 최대 760px */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white h-[calc(100dvh-12.75rem)] min-h-[420px] md:h-[calc(100dvh-10.5rem)] md:max-h-[900px] lg:h-[min(760px,calc(100dvh-11rem))]">
        {/* 머리글 */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {chatAvailable && currentChatLawyerName ? `${currentChatLawyerName} 변호사와 1:1 상담` : '1:1 상담방'}
            </h2>
            <p className="text-xs text-slate-600 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
              본인과 선택한 변호사만 볼 수 있어요
            </p>
          </div>
          {stage === 'counseling' && !isChatClosedWithCurrent && (
            <Button variant="secondary" size="md" onClick={() => setShowPhoneConsultModal(true)} leftIcon={<Phone className="w-4 h-4" aria-hidden="true" />}>
              전화상담 요청
            </Button>
          )}
        </div>

        {/* 여러 변호사와 대화 중이면 대화 상대 고르기 */}
        {chatAvailable && hasMultipleAccepted && (
          <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-50 flex gap-2 overflow-x-auto scrollbar-hide" role="group" aria-label="대화할 변호사">
            {acceptedIds.map(lawyerId => {
              const name = lawyerNameOf(lawyerId) || '변호사';
              const isChosen = currentRequest?.status === 'counseling' && currentRequest.selectedLawyerId === lawyerId;
              const isOther = currentRequest?.status === 'counseling' && currentRequest.selectedLawyerId !== lawyerId;
              const active = currentChatLawyerId === lawyerId;
              return (
                <button
                  key={lawyerId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveChatLawyerId(lawyerId)}
                  className={cn(
                    'shrink-0 min-h-11 px-3.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors',
                    active ? 'bg-white border-brand text-brand shadow-sm' : 'bg-transparent border-slate-300 text-slate-700 hover:bg-white',
                  )}
                >
                  {name} 변호사
                  <span className={cn('ml-1.5 text-xs font-bold', isOther ? 'text-slate-500' : isChosen ? 'text-emerald-700' : 'text-slate-500')}>
                    {isOther ? '상담 종료' : isChosen ? '상담 변호사' : '상담 중'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* 대화 상대의 제안서 요약 */}
        {chatAvailable && currentChatProposal && (
          <div className="shrink-0 px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
            <p className="flex-1 min-w-0 text-sm text-slate-700 truncate">
              <span className="font-bold text-slate-900">제안서</span>
              <span className="text-slate-400 mx-1.5" aria-hidden="true">·</span>
              월 {currentChatProposal.monthlyPayment}만원 · 감면율 {currentChatProposal.reductionRate}%{currentChatProposal.fee ? ` · 수임료 ${currentChatProposal.fee}만원` : ''}
            </p>
            <Button variant="ghost" size="md" onClick={() => setSelectedProposalForReport(currentChatProposal)} className="shrink-0 -mr-3 px-3">
              제안서 보기
            </Button>
          </div>
        )}

        {/* 비밀 보호·참고 의견 안내 (닫으면 1시간 숨김) */}
        {chatAvailable && showNotice && (
          <div className="shrink-0 px-4 py-2.5 border-b border-slate-200 bg-sky-50/70 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-700 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0 text-xs text-slate-700 leading-relaxed break-keep">
              <p>
                대화와 재정 정보는 암호화되어 오가며 본인과 선택한 변호사만 조회할 수 있습니다. 계약 전 상담과 제안서는 참고 의견입니다.{' '}
                <button type="button" onClick={() => setNoticeExpanded(v => !v)} aria-expanded={noticeExpanded} className="font-bold text-sky-800 underline underline-offset-2">
                  {noticeExpanded ? '접기' : '자세히'}
                </button>
              </p>
              {noticeExpanded && (
                <div className="mt-1.5 space-y-1.5">
                  <p>1:1 대화와 재정 정보는 전송 구간(TLS)으로 암호화되어 오가며, 데이터베이스 접근 규칙상 본인과 선택하신 변호사만 조회할 수 있습니다. 법령상 필요한 경우 외에는 제3자에게 제공되지 않습니다. 필요하면 언제든지 '요청·제안'의 '이 상담 기록 삭제'로 상담 기록을 삭제할 수 있습니다.</p>
                  <p>수임계약 체결 전의 상담과 제안서 내용은 제출 자료를 바탕으로 한 참고 의견이며, 실제 변제금·면책 여부는 법원 심리로 결정됩니다. 수임계약은 본인인증과 전자서명을 거쳐 체결되며, 계약서에 적힌 조건 외의 비용 요구가 있으면 고객센터로 알려 주세요.</p>
                </div>
              )}
            </div>
            <button type="button" onClick={closeNotice} aria-label="안내 닫기" className="-my-2 -mr-2.5 w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-slate-500 hover:bg-sky-100">
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {chatAvailable ? (
          <>
            <div
              ref={chatFeedRef}
              role="log"
              aria-live="polite"
              aria-label={currentChatLawyerName ? `${currentChatLawyerName} 변호사와의 대화` : '상담 대화'}
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-50/60"
            >
              <ChatMessageList
                messages={activeChatMessages}
                partnerName={currentChatLawyerName}
                canSend={canSendChat}
                onPickExample={(text) => { onSetChatInput(text); composerRef.current?.focus(); }}
                onRetry={onRetryMessage ? handleRetryChatMessage : undefined}
              />
            </div>
            {stage === 'comparing' && currentChatLawyerId && (
              <div className="shrink-0 px-3 sm:px-4 pt-3 bg-white border-t border-slate-200">
                <Button variant="secondary" fullWidth onClick={continueWithCurrentLawyer} leftIcon={<Check className="w-4 h-4" aria-hidden="true" />}>
                  {currentChatLawyerName ? `${currentChatLawyerName} 변호사와 상담 이어가기` : '이 변호사와 상담 이어가기'}
                </Button>
              </div>
            )}
            <ChatComposer
              ref={composerRef}
              value={chatInput}
              onChange={onSetChatInput}
              onSend={handleSendChatMessage}
              disabled={!canSendChat}
              placeholder={!currentChatLawyerId
                ? '대화할 변호사를 먼저 선택해 주세요'
                : isChatClosedWithCurrent
                  ? '상담이 종료되었습니다'
                  : '메시지를 입력하세요'}
              label={currentChatLawyerName ? `${currentChatLawyerName} 변호사에게 보낼 메시지` : '변호사에게 보낼 메시지'}
              recipient={currentChatLawyerName ? `${currentChatLawyerName} 변호사` : undefined}
              hint={composerHint || undefined}
            />
          </>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-10 bg-slate-50/60">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center mb-3" aria-hidden="true">
              <Lock className="w-6 h-6" />
            </div>
            <p className="max-w-sm text-sm font-bold text-slate-800 break-keep">{lockedCopy[stage] || lockedCopy.choose_lawyers}</p>
            {stage === 'review_proposals' && (
              <Button className="mt-4 lg:hidden" onClick={() => selectTab('match')} leftIcon={<MessageCircle className="w-4 h-4" aria-hidden="true" />}>
                제안서 보러 가기
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );

  // ── 요청·제안 ──
  const matchSection = (
    <section id="room-panel-match" role="tabpanel" aria-labelledby="room-tab-match" className={panelClass('match')}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="sr-only lg:not-sr-only lg:mb-4 lg:text-base lg:font-bold lg:text-slate-900">요청·제안</h2>
        <MatchPanel
          stage={stage}
          proposals={proposals}
          waitingLawyers={waitingLawyers}
          lawyers={lawyers}
          acceptedLawyerIds={acceptedIds}
          selectedLawyerId={currentRequest?.selectedLawyerId}
          slotsLeft={slotsLeft}
          onAddLawyers={browseLawyersForRequest}
          onCancelRequest={cancelLawyerRequest}
          onViewProposal={(p) => setSelectedProposalForReport(p)}
          onStartConsult={startConsultWithProposal}
          onOpenChatWith={openChatWith}
          onCancelConfirmed={cancelConfirmedLawyer}
          onPurge={currentRequest ? handlePurgeRecord : undefined}
        />
      </div>
    </section>
  );

  // ── 내 채무 ──
  const debtSection = (
    <section id="room-panel-debt" role="tabpanel" aria-labelledby="room-tab-debt" className={panelClass('debt')}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="sr-only lg:not-sr-only lg:mb-4 lg:text-base lg:font-bold lg:text-slate-900">내 채무</h2>
        <DebtSummaryPanel
          result={activeResult}
          compact
          onEdit={() => setShowProfilePanel(true)}
          onStartCheck={() => onSetActiveTab('request')}
        />
      </div>
    </section>
  );

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-5 font-sans text-left">
        <ConsultStatusStrip stage={stage} status={consultStatus} copy={stageCopy} actions={stageActions} switcher={switcher} />

        {/* 모바일·태블릿: 탭 줄은 헤더 아래에 붙고, 탭을 누르면 탭 줄이 맨 위로 올라와 상담방이 화면 높이를 다 쓴다 */}
        <div ref={tabsRef} className="lg:hidden sticky top-16 md:top-[72px] z-30 bg-white/95 backdrop-blur-sm py-2">
          <SegmentedTabs<RoomTab>
            tabs={tabs}
            value={mobileTab}
            onChange={selectTab}
            ariaLabel="내 관리방 보기"
            idPrefix="room"
          />
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
          <div className="min-w-0 space-y-5">
            {chatAvailable ? roomSection('show') : (
              <>
                {matchSection}
                {roomSection('hide')}
              </>
            )}
          </div>
          <aside className="min-w-0 space-y-5 mt-0 lg:sticky lg:top-24" aria-label="상담 요약">
            {chatAvailable && matchSection}
            {debtSection}
          </aside>
        </div>
      </div>

      {/* 내 채무 정보 보기·수정 */}
      <Modal
        open={showProfilePanel}
        onClose={() => setShowProfilePanel(false)}
        title="내 채무 정보 보기·수정"
        size="xl"
        mobile="fullscreen"
        bodyClassName="p-0 sm:p-0"
      >
        <MyPageView
          userAlias={userAlias}
          setUserAlias={setUserAlias}
          isEditingAlias={isEditingAlias}
          setIsEditingAlias={setIsEditingAlias}
          tempAlias={tempAlias}
          setTempAlias={setTempAlias}
          activeRequest={activeRequest}
          activeResult={activeResult}
          onUpdateFinancialProfile={onUpdateFinancialProfile}
          onStartDiagnosis={() => { setShowProfilePanel(false); onSetActiveTab('request'); }}
          requests={requests}
          onNavigateToChat={() => setShowProfilePanel(false)}
          isCompact={true}
          initialSubTab="diagnosis"
          lawyers={lawyers}
        />
      </Modal>

      {/* 오프스크린 PDF 템플릿 (화면에 안 보이지만 html2canvas가 캡처) */}
      {showProfilePanel && activeResult && reportUserInput && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '794px', zIndex: -9999, pointerEvents: 'none', opacity: 1 }} aria-hidden="true">
          <React.Suspense fallback={null}>
            <PrintableReportTemplate result={activeResult} userInput={reportUserInput} />
          </React.Suspense>
        </div>
      )}

      {/* 전화상담 요청 */}
      <Modal
        open={showPhoneConsultModal}
        onClose={() => setShowPhoneConsultModal(false)}
        title="전화상담 요청"
        icon={<Phone className="w-5 h-5" />}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPhoneConsultModal(false)}>취소</Button>
            <Button onClick={requestPhoneConsult} disabled={!currentRequest || !currentChatLawyerId}>요청 보내기</Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 leading-relaxed break-keep">
          {currentChatLawyerName ? `${currentChatLawyerName} 변호사` : '상담 변호사'}에게 전화상담 요청을 보냅니다. 변호사가 이 대화방에서 통화 가능한 시간을 여쭤본 뒤 연락드리며, 연락처는 직접 알려 주시기 전까지 공개되지 않습니다.
        </p>
      </Modal>

      {/* 제안서 및 분석 리포트 */}
      {selectedProposalForReport && (
        <PremiumProposalReportModal
          isOpen={!!selectedProposalForReport}
          onClose={() => setSelectedProposalForReport(null)}
          isContracted={stage === 'contracted'}
          proposal={selectedProposalForReport}
          clientInfo={currentRequest || activeResult}
          onAppointLawyer={() => setContractSelectProposal(selectedProposalForReport)}
          onAcceptProposal={() => setContractSelectProposal(selectedProposalForReport)}
        />
      )}

      {/* 온·오프라인 수임계약 방식 선택 모달 (전자계약 / 방문 내방 / 우편 등기) */}
      {contractSelectProposal && (
        <ContractMethodSelectModal
          isOpen={!!contractSelectProposal}
          onClose={() => setContractSelectProposal(null)}
          proposal={contractSelectProposal}
          clientDisplayName={currentRequest?.stealthNickname || currentRequest?.clientName || '의뢰인'}
          onSelectElectronic={async () => {
            const p = contractSelectProposal;
            setContractSelectProposal(null);
            await handleAppointLawyerFromChat(p);
          }}
          onSelectOffline={handleExecuteOfflineContract}
        />
      )}
    </>
  );
}
