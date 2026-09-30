import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useDialog } from '../../common/DialogProvider';
import { loadFeeNotificationSettings } from '../../../services/alimtokService';
import { loadCertificateVault } from '../../../services/vault/certificateVaultService';
import { loadContractsLocal } from '../../../services/contractService';
import { getCrmClientSync } from '../../../services/crmService';
import { getMyPageNextAction } from './nextAction';
import type { MyPageSubTab } from './nextAction';
import { getRequestRoomStage } from '../consultFlow';
import { localYmd } from '../../../utils/localDate';
import { getUnreadCount } from '../../../services/clientNotificationService';
import type { ClientNotification } from '../../../services/clientNotificationService';
import { startContractFromProposal } from '../../../services/proposalContractService';
import { calculateKoreanAgeInfo, parseFamilyDocument } from '../../../services/documents/familyParserService';
import { formatKoreanWon } from '../ui/form';
import type { CertificateVaultData, ConsultProposal, ConsultRequest, DocumentCheckItem, DocumentRequest, ElectronicContract, FeeInstallment, User } from '../../../types';
import type { RehabCalculationResult } from '../../../rehab-chatbot-package/services/calculationService';

export interface MyPageViewProps {
  userAlias: string;
  setUserAlias: (alias: string) => void;
  isEditingAlias: boolean;
  setIsEditingAlias: (v: boolean) => void;
  tempAlias: string;
  setTempAlias: (v: string) => void;
  
  // 동적 진단 데이터 연동
  activeRequest?: ConsultRequest;
  activeResult?: RehabCalculationResult;
  onUpdateFinancialProfile: (updatedProfile: any) => void;
  onStartDiagnosis?: () => void;
  
  requests: ConsultRequest[];
  onNavigateToChat: (reqId?: string) => void;
  isCompact?: boolean;
  initialSubTab?: 'companion' | 'diagnosis' | 'settings';
  /** 실제 등록 변호사 목록 (mock 데이터 대신 사용) */
  lawyers?: User[];
  /** 로그인 여부 (알림·설정 탭 안내용) */
  isLoggedIn?: boolean;
  /** 알림·설정 탭 아래에 붙일 계정 설정(가명 변경·로그아웃·문의 내역 등) */
  settingsPanel?: React.ReactNode;
  /** 회생동행 기록을 찾을 때 함께 볼 예전 저장 키 (최상위 회생동행 탭에서 쓰던 의뢰인 ID 등) */
  companionFallbackIds?: string[];
  /** 알림 목록·동작 (헤더 알림과 같은 상태). 넘기지 않으면 이 기기 저장소를 직접 읽는다 */
  notifications?: ClientNotification[];
  onNotificationClick?: (n: ClientNotification) => void;
  onMarkAllNotificationsRead?: () => void;
}

/**
 * 마이페이지 상태·파생 값·핸들러 (이전: MyPageView 본문 앞부분)
 * 섹션 컴포넌트는 이 반환값(vm)에서 필요한 값만 꺼내 쓴다. 코드는 옮기기만 하고 바꾸지 않았다.
 */
export function useMyPageModel(props: MyPageViewProps) {
  const {
    lawyers = [],
    userAlias, setUserAlias,
    isEditingAlias, setIsEditingAlias,
    tempAlias, setTempAlias,
    activeRequest,
    activeResult,
    onUpdateFinancialProfile,
    onStartDiagnosis,
    requests,
    onNavigateToChat,
    isCompact = false,
    initialSubTab,
    isLoggedIn = false,
    settingsPanel,
    companionFallbackIds,
    notifications,
    onNotificationClick,
    onMarkAllNotificationsRead,
  } = props;

  const dialog = useDialog();

  // 마이페이지 3대 서브 탭 (계약 전에는 제안서/진단 'diagnosis' 우선 활성화)
  const [mypageTab, setMypageTab] = useState<MyPageSubTab>(initialSubTab || 'diagnosis');
  const mypageTabsRef = React.useRef<HTMLDivElement>(null);
  const didPickDefaultTab = React.useRef(!!initialSubTab);

  useEffect(() => {
    if (initialSubTab) {
      setMypageTab(initialSubTab);
    }
  }, [initialSubTab]);

  // CRM 변경 이벤트 및 스토리지 변경 수신 시 마이페이지 실시간 자동 갱신
  useEffect(() => {
    const handleCrmChange = () => setRefreshTick(t => t + 1);
    window.addEventListener('legal_crm_data_updated', handleCrmChange);
    window.addEventListener('storage', handleCrmChange);
    return () => {
      window.removeEventListener('legal_crm_data_updated', handleCrmChange);
      window.removeEventListener('storage', handleCrmChange);
    };
  }, []);

  // 다중 전달사항 로컬 편집 상태
  const [newNoteInput, setNewNoteInput] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  
  // UI 갱신을 위한 강제 렌더링 트리거
  const [refreshTick, setRefreshTick] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  
  // 진단서 상세 항목 수정 폼 접기/펼치기 상태 (컴팩트 모드에서는 항상 펼침)
  const [isEditingBlueprint, setIsEditingBlueprint] = useState(false);
  // 2차 서류 원스톱 완성 허브 모달 열림 상태
  const [isFastDocHubOpen, setIsFastDocHubOpen] = useState(false);
  // 법원 진술서 모달 열림 상태
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  // 법원 재산상황표(D5102) 모달 열림 상태
  const [isPropertyIntakeModalOpen, setIsPropertyIntakeModalOpen] = useState(false);
  // 법원 수입및지출목록(D5103, 수지표) 모달 열림 상태
  const [isIncomeExpenseModalOpen, setIsIncomeExpenseModalOpen] = useState(false);
  // 법원 100만 원 이상 금융거래 소명표 모달 열림 상태
  const [isBankAuditModalOpen, setIsBankAuditModalOpen] = useState(false);

  // 서류함 1차(착수등기)/2차(소득재산) 단계 필터 탭
  const [docPhaseTab, setDocPhaseTab] = useState<'all' | 'phase1' | 'phase2'>('all');
  
  const feeSettings = useMemo(() => loadFeeNotificationSettings(), []);

  // 프리미엄 제안서/7p 리포트 모달 열림 상태
  const [selectedProposalForReport, setSelectedProposalForReport] = useState<any | null>(null);
  // 채권자집회 출석 가이드 모달 상태
  const [isCreditorMeetingModalOpen, setIsCreditorMeetingModalOpen] = useState(false);
  // 보정 소명자료 업로드 영역 열림 상태
  const [isCorrectionUploadOpen, setIsCorrectionUploadOpen] = useState(false);
  // 면책신청 요청 전달 여부 (CRM dischargeRequestedAt과 병행)
  const [dischargeRequestedLocal, setDischargeRequestedLocal] = useState(false);

  // ── 의뢰인 인증서 안전 금고 상태 ──
  const [isCertSubmissionModalOpen, setIsCertSubmissionModalOpen] = useState(false);
  // (이전: 요청이 없으면 'client-self' 공용 키 → 같은 브라우저의 다른 사용자와 인증서 금고가 섞임)
  const targetClientId = activeRequest?.id || requests[0]?.id || '';
  const [clientVault, setClientVault] = useState<CertificateVaultData | null>(() => {
    return targetClientId ? loadCertificateVault(targetClientId) : null;
  });

  useEffect(() => {
    const loaded = targetClientId ? loadCertificateVault(targetClientId) : null;
    setClientVault(loaded);
  }, [targetClientId, refreshTick]);

  // 모든 상담 요청에 포함된 변호사 제안서 취합
  const allProposals = useMemo(() => {
    const list: { req: ConsultRequest; proposal: ConsultProposal }[] = [];
    const reqs = (Array.isArray(requests) && requests.length > 0) ? requests : (activeRequest ? [activeRequest] : []);
    reqs.forEach(r => {
      if (!r) return;
      (r.proposals || []).forEach(p => {
        if (!p) return;
        list.push({ req: r, proposal: p });
      });
    });
    return list;
  }, [requests, activeRequest]);

  // 아래 계약서 조회(useMemo)가 profile을 쓰므로 먼저 선언한다
  // (이전: 선언 전에 접근해 오류가 났고 try/catch가 삼켜서 계약서가 늘 '없음'으로 보였음)
  const profile = activeRequest?.financialProfile;
  // 연속 입력 시 이전 값으로 덮어쓰지 않도록 가장 최근 프로필을 보관
  const profileRef = React.useRef(profile);
  profileRef.current = profile;

  // 체결된 또는 진행 중인 전자수임계약서 조회
  const clientContract = useMemo(() => {
    try {
      const contracts = loadContractsLocal();
      const reqId = activeRequest?.id || requests[0]?.id;
      return contracts.find((c: ElectronicContract) => 
        (reqId && (c.clientId === reqId || c.clientRefId === reqId)) ||
        (profile?.phone && c.clientPhone && c.clientPhone.replace(/[^0-9]/g, '') === profile.phone.replace(/[^0-9]/g, '')) ||
        (c.clientName && (profile?.name || userAlias) && (c.clientName === profile?.name || c.clientName === userAlias))
      ) || null;
    } catch {
      return null;
    }
  }, [activeRequest, requests, activeRequest?.financialProfile, userAlias, refreshTick]);

  // CRM 확장 상세 정보 (13단계 심리 상태, 법원 사건정보, 보정권고 연동)
  const crmExt = useMemo(() => {
    try {
      const clientId = activeRequest?.id || requests[0]?.id;
      if (!clientId) return null;
      return getCrmClientSync(clientId);
    } catch {
      return null;
    }
  }, [activeRequest?.id, requests, refreshTick]);

  // 계약 체결 여부 (제안서 검토 완료 후 정식 계약 단계 진입 여부)
  const isContracted = useMemo(() => {
    if (clientContract && (clientContract.signedAt || clientContract.status === 'completed' || clientContract.status === 'signed')) return true;
    if (crmExt?.thirteenStage && crmExt.thirteenStage !== 'consult_waiting' && crmExt.thirteenStage !== 'consult_completed') return true;
    const reqStatus = activeRequest?.status || requests[0]?.status;
    if (reqStatus && ['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'].includes(reqStatus)) return true;
    return false;
  }, [clientContract, crmExt?.thirteenStage, activeRequest?.status, requests]);

  // ── '지금 할 일' (사건 상태 하나로 맨 위 카드와 첫 탭을 정한다) ──
  const openDocRequestCount = (Array.isArray(crmExt?.documentRequests) ? crmExt.documentRequests : [])
    .filter((r: DocumentRequest) => r && !r.fulfilled).length;
  const nextFeeInstallment = (() => {
    const schedule: FeeInstallment[] = (Array.isArray(crmExt?.feeSchedule) && crmExt.feeSchedule.length > 0)
      ? crmExt.feeSchedule
      : (clientContract?.feeSchedule || []);
    const next = schedule
      .filter((f: FeeInstallment) => f && f.status !== 'paid' && f.dueDate)
      .sort((a: FeeInstallment, b: FeeInstallment) => a.dueDate.localeCompare(b.dueDate))[0];
    return next ? { round: next.round, dueDate: next.dueDate.slice(0, 10), overdue: next.status === 'overdue' } : null;
  })();
  const rejectedDocCount = (Array.isArray(crmExt?.documents) ? crmExt.documents : [])
    .filter((d: DocumentCheckItem) => d && d.reviewStatus === 'rejected').length;
  const nextAction = getMyPageNextAction({
    hasCheck: !!profile,
    isContracted,
    roomStage: activeRequest ? getRequestRoomStage(activeRequest) : null,
    proposalCount: (activeRequest?.proposals || []).length,
    openDocRequests: openDocRequestCount,
    rejectedDocs: rejectedDocCount,
    nextFee: nextFeeInstallment,
    today: localYmd(),
  });
  // 헤더와 같은 알림 상태가 있으면 그것으로 센다(읽음 처리하면 탭 숫자도 바로 줄어든다)
  const unreadNotificationCount = notifications ? notifications.filter(n => !n.isRead).length : getUnreadCount();

  // 수임 계약한 변호사의 제안서 (상담 변호사 → 계약서의 변호사 이름 → 제안서가 하나뿐일 때만). 모르면 추측하지 않는다
  const contractedProposal: ConsultProposal | null = (() => {
    if (!isContracted || allProposals.length === 0) return null;
    const chosenId = activeRequest?.selectedLawyerId;
    const byLawyer = chosenId ? allProposals.find(x => x.proposal.lawyerId === chosenId) : undefined;
    if (byLawyer) return byLawyer.proposal;
    const contractName = String(clientContract?.lawyerName || '').replace(/\s*변호사$/, '');
    const byName = contractName ? allProposals.find(x => String(x.proposal.lawyerName || '').replace(/\s*변호사$/, '') === contractName) : undefined;
    if (byName) return byName.proposal;
    return allProposals.length === 1 ? allProposals[0].proposal : null;
  })();

  // 담당 변호사: 사무소가 배정했거나, 상담 변호사로 정했거나, 계약한 경우만 (요청만 보낸 변호사는 담당이 아니다)
  const assignedLawyer = (() => {
    const ext = crmExt as any;
    const targetId = ext?.assigneeId || ext?.assignedLawyerId || activeRequest?.selectedLawyerId;
    const found = lawyers.find(l => (!!targetId && l.id === targetId) || (!!clientContract?.lawyerName && l.name === clientContract.lawyerName));
    const name = String(clientContract?.lawyerName || found?.name || '').replace(/\s*변호사$/, '');
    if (!name) return null;
    return { name, firm: found?.firmName || found?.firm || clientContract?.lawFirmName || '', avatar: found?.avatarData || found?.avatar || '' };
  })();

  // 따로 고른 탭이 없으면 첫 화면을 사건 상태에 맞춘다 (예: 계약 후에는 회생동행)
  useEffect(() => {
    if (didPickDefaultTab.current) return;
    didPickDefaultTab.current = true;
    if (nextAction.defaultTab !== mypageTab) setMypageTab(nextAction.defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** '지금 할 일' 버튼 */
  const runNextAction = () => {
    const action = nextAction.action;
    if (!action) return;
    if (action.kind === 'check') { onStartDiagnosis?.(); return; }
    if (action.kind === 'room') { onNavigateToChat(activeRequest?.id || requests[0]?.id); return; }
    if (action.tab) {
      setMypageTab(action.tab);
      window.requestAnimationFrame(() => mypageTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  // 제안서 조건으로 전자 수임계약 시작 — 서명 대기 계약서 생성 후 본인인증·서명 화면으로 이동
  // (버튼 클릭만으로 '체결 완료'를 기록하지 않는다)
  const handleStartContractFromProposal = async (proposal: ConsultProposal) => {
    // 반드시 이 제안서가 실제로 도착한 요청을 사용 (다른 요청으로 폴백 금지)
    const targetReq = requests.find(r => r.proposals?.some(p => p.id === proposal.id));
    if (!targetReq) {
      toast.error('이 제안서가 연결된 상담 요청을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }

    const confirmed = await dialog.confirm({
      title: `${proposal.lawyerName} 변호사 전자 수임계약 진행`,
      message: `${proposal.lawyerName} 변호사의 제안 조건(수임료 ${proposal.fee}만원${proposal.installment ? `, ${proposal.installment}` : ''})으로 전자 수임계약서를 작성합니다.\n\n다음 화면에서 휴대폰 본인인증과 계약서 확인·서명을 마쳐야 계약이 체결됩니다. 본인인증 시 가명 대신 실명으로 계약서가 작성됩니다.`,
      confirmText: '계약서 확인하러 가기',
      cancelText: '더 검토하기',
      variant: 'primary'
    });

    if (!confirmed) return;

    try {
      const { signUrl } = await startContractFromProposal({
        request: targetReq,
        proposal,
        clientDisplayName: targetReq.stealthNickname || userAlias || targetReq.clientName || '의뢰인',
      });
      window.location.assign(signUrl);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '계약서 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const handleAddMypageNote = () => {
    if (!newNoteInput.trim() || !profile) return;
    const currentNotes = profile?.clientNotes || (profile?.clientNote ? [profile.clientNote] : []);
    handleFieldChange('clientNotes', [...currentNotes, newNoteInput.trim()]);
    setNewNoteInput('');
  };

  const handleSaveMypageNote = (idx: number) => {
    if (!editingNoteValue.trim() || !profile) return;
    const currentNotes = profile?.clientNotes || (profile?.clientNote ? [profile.clientNote] : []);
    const updated = currentNotes.map((note, i) => i === idx ? editingNoteValue.trim() : note);
    handleFieldChange('clientNotes', updated);
    setEditingNoteIndex(null);
    setEditingNoteValue('');
  };

  const handleDeleteMypageNote = async (idx: number) => {
    if (!profile) return;
    const confirmed = await dialog.confirm({
      title: '전달사항 메모 삭제',
      message: '해당 전달사항 메모를 삭제하시겠습니까?',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    const currentNotes = profile?.clientNotes || (profile?.clientNote ? [profile.clientNote] : []);
    const updated = currentNotes.filter((_, i) => i !== idx);
    handleFieldChange('clientNotes', updated);
    toast.success('전달사항 메모가 삭제되었습니다.');
  };

  // 세부 데이터 핸들러 — 가장 최근 값(profileRef)에 병합해 연속 변경이 서로 덮어쓰지 않게 한다
  const handleFieldChange = (field: string, value: any) => {
    const next = { ...(profileRef.current || profile), [field]: value } as typeof profile;
    profileRef.current = next;
    onUpdateFinancialProfile(next);
  };

  const handleDebtChange = (debtTypeField: string, val: number) => {
    const base = (profileRef.current || profile) as typeof profile;
    const updatedDebtTypes = {
      ...base.debtTypes,
      [debtTypeField]: val
    };
    
    // 총 채무액 합산
    const totalDebt = (updatedDebtTypes.banks || 0) + (updatedDebtTypes.cards || 0) + (updatedDebtTypes.personals || 0) + (base.priorityDebt || 0);

    const next = {
      ...base,
      debtTypes: updatedDebtTypes,
      debtTotal: totalDebt
    } as typeof profile;
    profileRef.current = next;
    onUpdateFinancialProfile(next);
  };

  // ── 등본/가족관계 서류 자동 파싱 상태 & 핸들러 ──
  const [isParsingClientFamilyDoc, setIsParsingClientFamilyDoc] = useState(false);
  const clientFamilyDocInputRef = React.useRef<HTMLInputElement>(null);

  const handleClientFamilyDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsingClientFamilyDoc(true);
    try {
      const result = await parseFamilyDocument(file);
      if (result.ok && result.extractedMembers?.length > 0) {
        const parsedMembers = result.extractedMembers;
        
        // 미성년 자녀 자동 집계
        const minorChildren = parsedMembers.filter(m => (m.relationship.includes('자') || m.relationship.includes('녀')) && calculateKoreanAgeInfo(m.birthDate).isMinor).length;
        const otherDependents = parsedMembers.filter(m => !m.relationship.includes('본인') && !m.relationship.includes('자') && !m.relationship.includes('녀') && m.isEligibleDependent).length;
        
        // 배우자 확인
        const hasSpouse = parsedMembers.some(m => m.relationship.includes('배우자'));
        
        onUpdateFinancialProfile({
          ...profile,
          familyMembers: parsedMembers,
          minorChildren,
          otherDependents,
          dependents: minorChildren + otherDependents,
          maritalStatus: hasSpouse ? 'MARRIED' : (profile?.maritalStatus || 'SINGLE'),
        });
        toast.success(`${result.docTitle}에서 가족 ${parsedMembers.length}명을 읽어 채웠어요. 이름·생년월일이 맞는지 확인해 주세요.`);
      } else {
        toast.error('서류에서 가족 정보를 명확히 인식하지 못했습니다. 수기로 입력해 주세요.');
      }
    } catch (err: any) {
      toast.error('서류 파싱 중 오류가 발생했습니다: ' + (err?.message || ''));
    } finally {
      setIsParsingClientFamilyDoc(false);
      if (clientFamilyDocInputRef.current) {
        clientFamilyDocInputRef.current.value = '';
      }
    }
  };

  // 계산 결과(RehabCalculationResult)는 항상 원 단위다. 만원/원을 추측하는 formatCurrency에 넣으면
  // 10만원 미만 금액(예: 월 변제금 56,614원)이 '5억 6,614만원'처럼 부풀려지므로 따로 포맷한다.
  const formatResultMonthly = (won: number | undefined): string => formatKoreanWon(Math.max(0, won || 0));
  const formatResultTotal = (won: number | undefined): string => {
    const n = Math.max(0, Math.round(won || 0));
    if (n < 10000) return formatKoreanWon(n);
    return `${n % 10000 === 0 ? '' : '약 '}${Math.round(n / 10000).toLocaleString('ko-KR')}만원`;
  };

  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined) return '0원';
    if (amount === 0) return '0원';
    const absAmount = Math.abs(amount);
    
    // 세션 저장/화면 만원단위 호환
    let valInWon = absAmount;
    if (absAmount < 100000) {
      // 만원 단위인 경우 원 단위로 보정해 포맷
      valInWon = absAmount * 10000;
    }
    
    const eok = Math.floor(valInWon / 100000000);
    const remainder = valInWon % 100000000;
    const man = Math.floor(remainder / 10000);

    let res = '';
    if (eok > 0) res += `${eok}억 `;
    if (man > 0) res += `${man.toLocaleString()}만`;
    return `${res}원`.trim();
  };

  const totalDebtValue = profile 
    ? (profile.totalDebt || profile.debtTotal || ((profile.debtTypes?.banks || 0) + (profile.debtTypes?.cards || 0) + (profile.debtTypes?.personals || 0) + (profile.priorityDebt || 0)))
    : 0;

  return {
    lawyers,
    userAlias,
    setUserAlias,
    isEditingAlias,
    setIsEditingAlias,
    tempAlias,
    setTempAlias,
    activeRequest,
    activeResult,
    onUpdateFinancialProfile,
    onStartDiagnosis,
    requests,
    onNavigateToChat,
    isCompact,
    initialSubTab,
    isLoggedIn,
    settingsPanel,
    companionFallbackIds,
    notifications,
    onNotificationClick,
    onMarkAllNotificationsRead,
    dialog,
    mypageTab,
    setMypageTab,
    mypageTabsRef,
    didPickDefaultTab,
    newNoteInput,
    setNewNoteInput,
    editingNoteIndex,
    setEditingNoteIndex,
    editingNoteValue,
    setEditingNoteValue,
    refreshTick,
    setRefreshTick,
    showScanner,
    setShowScanner,
    isEditingBlueprint,
    setIsEditingBlueprint,
    isFastDocHubOpen,
    setIsFastDocHubOpen,
    isStatementModalOpen,
    setIsStatementModalOpen,
    isPropertyIntakeModalOpen,
    setIsPropertyIntakeModalOpen,
    isIncomeExpenseModalOpen,
    setIsIncomeExpenseModalOpen,
    isBankAuditModalOpen,
    setIsBankAuditModalOpen,
    docPhaseTab,
    setDocPhaseTab,
    feeSettings,
    selectedProposalForReport,
    setSelectedProposalForReport,
    isCreditorMeetingModalOpen,
    setIsCreditorMeetingModalOpen,
    isCorrectionUploadOpen,
    setIsCorrectionUploadOpen,
    dischargeRequestedLocal,
    setDischargeRequestedLocal,
    isCertSubmissionModalOpen,
    setIsCertSubmissionModalOpen,
    targetClientId,
    clientVault,
    setClientVault,
    allProposals,
    profile,
    profileRef,
    clientContract,
    crmExt,
    isContracted,
    openDocRequestCount,
    nextFeeInstallment,
    rejectedDocCount,
    nextAction,
    unreadNotificationCount,
    contractedProposal,
    assignedLawyer,
    runNextAction,
    handleStartContractFromProposal,
    handleAddMypageNote,
    handleSaveMypageNote,
    handleDeleteMypageNote,
    handleFieldChange,
    handleDebtChange,
    isParsingClientFamilyDoc,
    setIsParsingClientFamilyDoc,
    clientFamilyDocInputRef,
    handleClientFamilyDocUpload,
    formatResultMonthly,
    formatResultTotal,
    formatCurrency,
    totalDebtValue,
  };
}

export type MyPageModel = ReturnType<typeof useMyPageModel>;
