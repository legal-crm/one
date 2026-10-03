import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Building2, Home, Briefcase, CreditCard, ShieldCheck, 
  Upload, Eye, CheckCircle2, AlertCircle, Clock, FileText,
  ArrowRight, Camera, RefreshCw, AlertTriangle, Send, 
  ExternalLink, Smartphone, Sparkles, FolderArchive, Check,
  RotateCcw, Filter, FileCheck2, Mail, Truck, Stamp, Info, Copy,
  FileSpreadsheet, Lock, Unlock, ArrowUpRight, Edit2, Save, X,
  BookOpen, Calendar, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, DocumentFile } from '../../../types';
import { 
  ApplicationDocTemplateService, 
  compareDocItemsPriority,
  type DocPhase, 
  type SubmissionMethod 
} from '../../../services/documents/applicationDocTemplateService';
import BatchDocRequestModal, { type BatchDocItem } from './BatchDocRequestModal';
import SpeedDocReviewModal, { type ReviewDocItem } from './SpeedDocReviewModal';
import { sendAlimtok } from '../../../services/alimtokService';
import { addClientNotification } from '../../../services/clientNotificationService';
import DebtAgencyApplicationModal from '../repayment/DebtAgencyApplicationModal';
import { loadDebtCertificateOrder, saveDebtCertificateOrder } from '../../../services/repayment/debtCertificateService';
import type { DebtCertificateOrder } from '../../../services/repayment/repaymentTypes';
import { getOfficeProfile } from '../../../services/lawyer/officeProfile';
import { localYmd } from '../../../utils/localDate';
import { CARRIER_LIST, getCarrierTrackingUrl, getCarrierLabel } from '../../../utils/carrierTracking';
import SmartDocumentDropzone from './SmartDocumentDropzone';
import CertificateVaultCard from '../vault/CertificateVaultCard';
import { won } from '../quickdock/ui/money';

interface Stage3DocumentsHubViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage: () => void;
  onOpenDocScanner?: () => void;
  onOpenStatementSyncModal?: () => void;
  onOpenIncomeExpenseModal?: () => void;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
}

export type DocLifecycleStatus = 
  | 'NOT_REQUESTED'       // 요청 전
  | 'REQUESTED'           // 고객 요청됨
  | 'SUBMITTED'           // 제출됨 / 검토대기
  | 'UNDER_REVIEW'        // 검토 진행중
  | 'APPROVED'            // 승인 완료
  | 'SUPPLEMENT_NEEDED';  // 보완 필요

export interface DocItemModel {
  id: string;
  name: string;
  phase: DocPhase;
  order?: number;
  submissionMethod: SubmissionMethod;
  agency: string;
  isRequired: boolean;
  notes: string;
  isThirdPartyMaskingRequired?: boolean;
  isCreditorMultiplier?: boolean;
  targetParty?: 'APPLICANT' | 'SPOUSE' | 'BOTH';
  status: DocLifecycleStatus;
  requestedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  supplementReason?: string;
}

// ── 서류 진행 상태 저장 (의뢰인별 로컬 캐시) ──
type Stage3DocState = Pick<DocItemModel, 'status' | 'requestedAt' | 'submittedAt' | 'approvedAt' | 'supplementReason'>;
interface Stage3SavedState { docs?: Record<string, Stage3DocState>; postalCarrier?: string; postalTrackingNumber?: string }
const stage3Key = (clientId: string) => `legal_crm_stage3_docs_${clientId}`;
function loadStage3State(clientId: string): Stage3SavedState | null {
  try { const raw = localStorage.getItem(stage3Key(clientId)); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveStage3State(clientId: string, patch: Stage3SavedState): boolean {
  try {
    const cur = loadStage3State(clientId) || {};
    localStorage.setItem(stage3Key(clientId), JSON.stringify({ ...cur, ...patch }));
    return true;
  } catch { return false; }
}

type AgencyTab = 'all' | 'gov' | 'tax' | 'work' | 'finance' | 'personal';
type StatusFilter = 'all' | 'unsubmitted' | 'review' | 'supplement' | 'approved';

/**
 * 3단계 서류 준비 (기획서 3-1 & 4.3 Stage 3)
 * - 3대 섹션:
 *   1. 발급 서류 (`docs`): 발급처별 그룹 목록, 상태 칩 한 줄, 행당 1개 버튼, 인증서 금고 카드, 스마트 드롭존
 *   2. 부채증명서 (`debt-cert`): 대행 발주 관리, D+n 경과, 채권기관별 의뢰 목록
 *   3. 진술서·수지표 (`statement`): 진술서 동기화 및 가계수지표 점검
 * - 라이트 서페이스(#F8FAFC) 디자인 토큰 준수, 12px 하한, 상태별 단일 주 버튼
 */
export default function Stage3DocumentsHubView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenDocScanner,
  onOpenStatementSyncModal,
  onOpenIncomeExpenseModal,
  onUpdateCrmExt,
  activeSection = 'docs',
  onSelectSection,
}: Stage3DocumentsHubViewProps) {
  // 현재 활성 섹션 매핑
  const currentSection = useMemo(() => {
    if (activeSection === 'debt-cert') return 'debt-cert';
    if (activeSection === 'statement') return 'statement';
    return 'docs';
  }, [activeSection]);

  const [activeAgency, setActiveAgency] = useState<AgencyTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 채권자 수 및 인감증명서 부수 계산
  const creditorCount = Number(
    (clientRequest as any).creditorCount ||
    clientRequest.financialProfile?.creditorCount ||
    (crmExt as any)?.creditorCount ||
    loadDebtCertificateOrder(clientRequest.id)?.items?.length ||
    0
  );
  const requiredSealCount = ApplicationDocTemplateService.getRequiredSealCertCount(creditorCount);

  // 1차 실물 등기 및 배송추적 상태
  const savedStage3 = loadStage3State(clientRequest.id);
  const [postalCarrier, setPostalCarrier] = useState<string>(crmExt?.postalCarrier || savedStage3?.postalCarrier || '');
  const [postalTrackingNumber, setPostalTrackingNumber] = useState<string>(crmExt?.postalTrackingNumber || savedStage3?.postalTrackingNumber || '');
  const [isEditingPostal, setIsEditingPostal] = useState<boolean>(false);
  const [inputCarrier, setInputCarrier] = useState<string>(postalCarrier);
  const [inputTracking, setInputTracking] = useState<string>(postalTrackingNumber);

  // 인감 보관 및 부채증명서 대행 진행 상태
  const [isSealKeptInSafe, setIsSealKeptInSafe] = useState<boolean>(() => Boolean(crmExt?.isSealKeptInSafe));
  const [isDebtDispatched, setIsDebtDispatched] = useState<boolean>(() => {
    const o = loadDebtCertificateOrder(clientRequest.id);
    return Boolean(o && o.orderStatus !== 'draft');
  });
  const [debtCertElapsedDays, setDebtCertElapsedDays] = useState<number>(() => {
    const o = loadDebtCertificateOrder(clientRequest.id);
    if (!o || o.orderStatus === 'draft' || !o.requestedAt) return 0;
    const t = new Date(o.requestedAt).getTime();
    if (!Number.isFinite(t)) return 0;
    return Math.max(1, Math.floor((Date.now() - t) / 86_400_000) + 1);
  });

  // 모달 상태
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPresetPhase, setBatchPresetPhase] = useState<DocPhase | undefined>(undefined);
  const [showSpeedReviewModal, setShowSpeedReviewModal] = useState(false);
  const [isAgencyAppModalOpen, setIsAgencyAppModalOpen] = useState(false);

  // 부채증명서 대행 주문 상태
  const [debtOrder, setDebtOrder] = useState<DebtCertificateOrder>(() => {
    const loaded = loadDebtCertificateOrder(clientRequest.id);
    if (loaded) return loaded;
    return {
      orderId: `order_${clientRequest.id}`,
      clientId: clientRequest.id,
      clientName: clientRequest.clientName || '의뢰인',
      clientPhone: clientRequest.phone || '',
      agencyName: '',
      orderStatus: 'draft',
      items: [],
      createdAt: new Date().toISOString(),
      totalAgencyCost: 0,
    };
  });

  // 서류 목록 초기화 (CRM 서버 crmExt 우선 -> 브라우저 캐시 -> 기본 템플릿)
  const [docList, setDocList] = useState<DocItemModel[]>(() => {
    const uploaded = crmExt?.uploadedFiles || [];
    const serverStage3 = (crmExt as any)?.stage3DocsState || {};
    const crmDocs = crmExt?.documents || [];
    const saved = loadStage3State(clientRequest.id)?.docs || {};
    const masterTemplates = ApplicationDocTemplateService.getRecommendedDocsForClient(clientRequest)
      .sort(compareDocItemsPriority);

    return masterTemplates.map((rawItem) => {
      const isSeal = rawItem.name.includes('인감');
      const item = isSeal ? { ...rawItem, phase: 1 as DocPhase, isRequired: true } : rawItem;
      const base: DocItemModel = {
        id: item.id,
        name: item.name,
        order: item.order,
        phase: item.phase,
        submissionMethod: item.submissionMethod,
        agency: item.agency,
        isRequired: item.isRequired,
        notes: item.tips,
        isThirdPartyMaskingRequired: item.isThirdPartyMasking,
        isCreditorMultiplier: item.isCreditorMultiplier,
        targetParty: item.targetParty,
        status: 'NOT_REQUESTED',
      };

      // 1순위: CRM 서버의 3단계 상태
      const serverSt = serverStage3[item.id];
      if (serverSt?.status) return { ...base, ...serverSt };

      // 2순위: CRM 표준 documents 체크리스트 매칭
      const matchedCrmDoc = crmDocs.find(cd => cd.id === item.id || cd.label === item.name);
      if (matchedCrmDoc) {
        if (matchedCrmDoc.reviewStatus === 'approved' || matchedCrmDoc.checked) {
          return { ...base, status: 'APPROVED' as const, approvedAt: matchedCrmDoc.checkedAt };
        }
        if (matchedCrmDoc.reviewStatus === 'submitted' || matchedCrmDoc.reviewStatus === 'under_review') {
          return { ...base, status: 'SUBMITTED' as const, submittedAt: matchedCrmDoc.submittedAt };
        }
        if (matchedCrmDoc.reviewStatus === 'rejected') {
          return { ...base, status: 'SUPPLEMENT_NEEDED' as const, supplementReason: matchedCrmDoc.rejectionReason };
        }
      }

      // 3순위: 브라우저 캐시
      const st = saved[item.id];
      if (st?.status) return { ...base, ...st };

      // 4순위: 업로드 파일 매칭
      const match = uploaded.find(f => f.name.includes(item.name.slice(0, 3)));
      if (match) return { ...base, status: 'SUBMITTED' as const, submittedAt: match.uploadedAt ? localYmd(new Date(match.uploadedAt)) : undefined };
      return base;
    }).sort(compareDocItemsPriority);
  });

  const isFirstRenderRef = useRef(true);
  const prevClientIdRef = useRef(clientRequest.id);
  if (prevClientIdRef.current !== clientRequest.id) {
    prevClientIdRef.current = clientRequest.id;
    isFirstRenderRef.current = true;
  }

  const onUpdateCrmExtRef = useRef(onUpdateCrmExt);
  useEffect(() => {
    onUpdateCrmExtRef.current = onUpdateCrmExt;
  });

  const crmExtRef = useRef(crmExt);
  useEffect(() => {
    crmExtRef.current = crmExt;
  });

  // 서류 진행 상태 변경 시 서버(crmExt) + 브라우저 로컬 캐시 동기화
  useEffect(() => {
    const docs: Record<string, Stage3DocState> = {};
    docList.forEach(d => {
      if (d.status !== 'NOT_REQUESTED' || d.requestedAt) {
        docs[d.id] = { status: d.status, requestedAt: d.requestedAt, submittedAt: d.submittedAt, approvedAt: d.approvedAt, supplementReason: d.supplementReason };
      }
    });

    saveStage3State(clientRequest.id, { docs, postalCarrier, postalTrackingNumber });

    // 첫 마운트 또는 고객 전환 시에는 이미 로드된 데이터이므로 서버 저장을 건너뜀 (무한 루프 방지)
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    if (!onUpdateCrmExtRef.current) return;
    const timer = setTimeout(() => {
      const ext = crmExtRef.current;
      const currentDocs = [...(ext?.documents || [])];
      let hasDocsChanged = false;

      docList.forEach(d => {
        const idx = currentDocs.findIndex(cd => cd.id === d.id || cd.label === d.name);
        const mappedReviewStatus = d.status === 'APPROVED' 
          ? 'approved' 
          : d.status === 'SUBMITTED' || d.status === 'UNDER_REVIEW'
          ? 'submitted'
          : d.status === 'SUPPLEMENT_NEEDED'
          ? 'rejected'
          : 'not_submitted';
        const isChecked = d.status === 'APPROVED';

        if (idx >= 0) {
          if (currentDocs[idx].reviewStatus !== mappedReviewStatus || currentDocs[idx].checked !== isChecked) {
            currentDocs[idx] = {
              ...currentDocs[idx],
              reviewStatus: mappedReviewStatus,
              checked: isChecked,
              rejectionReason: d.supplementReason,
              submittedAt: d.submittedAt,
            };
            hasDocsChanged = true;
          }
        }
      });

      const hasPostalCarrierChanged = postalCarrier !== (ext?.postalCarrier || '');
      const hasPostalTrackingChanged = postalTrackingNumber !== (ext?.postalTrackingNumber || '');
      const hasSealChanged = Boolean(isSealKeptInSafe) !== Boolean(ext?.isSealKeptInSafe);
      const prevStage3Docs = (ext as any)?.stage3DocsState || {};
      const hasDocsStateChanged = JSON.stringify(docs) !== JSON.stringify(prevStage3Docs);

      // 실제 변경사항이 없으면 불필요한 서버 저장 호출 차단
      if (!hasDocsChanged && !hasPostalCarrierChanged && !hasPostalTrackingChanged && !hasSealChanged && !hasDocsStateChanged) {
        return;
      }

      onUpdateCrmExtRef.current?.({
        ...(hasDocsChanged ? { documents: currentDocs } : {}),
        ...(hasPostalCarrierChanged ? { postalCarrier } : {}),
        ...(hasPostalTrackingChanged ? { postalTrackingNumber } : {}),
        ...(hasSealChanged ? { isSealKeptInSafe } : {}),
        ...(hasDocsStateChanged ? { stage3DocsState: docs } as any : {}),
      }).catch(() => {});
    }, 600);

    return () => clearTimeout(timer);
  }, [docList, postalCarrier, postalTrackingNumber, isSealKeptInSafe, clientRequest.id]);

  // 서류 통계
  const stats = useMemo(() => {
    const total = docList.length;
    const required = docList.filter(d => d.isRequired);
    const approved = docList.filter(d => d.status === 'APPROVED');
    const submitted = docList.filter(d => d.status === 'SUBMITTED');
    const supplement = docList.filter(d => d.status === 'SUPPLEMENT_NEEDED');
    const unsubmitted = docList.filter(d => ['NOT_REQUESTED', 'REQUESTED', 'SUPPLEMENT_NEEDED'].includes(d.status) && d.isRequired);

    const phase1Docs = docList.filter(d => d.phase === 1);
    const phase1Required = phase1Docs.filter(d => d.isRequired);
    const phase1Approved = phase1Docs.filter(d => d.status === 'APPROVED');
    const isPhase1Done = phase1Approved.length >= phase1Required.length;

    const progressRate = Math.round((approved.length / (required.length || 1)) * 100);
    // 완료 기준: 필수 서류 승인 80% 이상 & 검토 대기 0건
    const isReadyForStage4 = progressRate >= 80 && submitted.length === 0;

    return {
      total,
      requiredCount: required.length,
      approvedCount: approved.length,
      submittedCount: submitted.length,
      supplementCount: supplement.length,
      unsubmittedCount: unsubmitted.length,
      progressRate,
      isReadyForStage4,
      phase1Total: phase1Docs.length,
      phase1RequiredCount: phase1Required.length,
      phase1ApprovedCount: phase1Approved.length,
      isPhase1Done,
    };
  }, [docList]);

  // 필터링된 서류 목록
  const filteredDocs = useMemo(() => {
    return docList.filter(doc => {
      // 발급처 필터
      if (activeAgency === 'gov' && !doc.agency.includes('주민센터') && !doc.agency.includes('정부24') && !doc.agency.includes('대법원')) return false;
      if (activeAgency === 'tax' && !doc.agency.includes('홈택스') && !doc.agency.includes('국세청') && !doc.agency.includes('위택스')) return false;
      if (activeAgency === 'work' && !doc.agency.includes('직장') && !doc.agency.includes('사업장')) return false;
      if (activeAgency === 'finance' && !doc.agency.includes('은행') && !doc.agency.includes('보험') && !doc.agency.includes('공단') && !doc.agency.includes('금융') && !doc.agency.includes('국토')) return false;
      if (activeAgency === 'personal' && !doc.agency.includes('신청인') && !doc.agency.includes('보관')) return false;

      // 상태 필터
      if (statusFilter === 'unsubmitted' && doc.status === 'APPROVED') return false;
      if (statusFilter === 'review' && doc.status !== 'SUBMITTED') return false;
      if (statusFilter === 'supplement' && doc.status !== 'SUPPLEMENT_NEEDED') return false;
      if (statusFilter === 'approved' && doc.status !== 'APPROVED') return false;

      return true;
    }).sort(compareDocItemsPriority);
  }, [docList, activeAgency, statusFilter]);

  // 발급처별 서류 카운트
  const agencyCounts = useMemo(() => {
    const counts = { all: docList.length, gov: 0, tax: 0, work: 0, finance: 0 };
    docList.forEach(d => {
      if (d.agency.includes('주민센터') || d.agency.includes('정부24') || d.agency.includes('대법원')) counts.gov++;
      if (d.agency.includes('홈택스') || d.agency.includes('국세청') || d.agency.includes('위택스')) counts.tax++;
      if (d.agency.includes('직장') || d.agency.includes('사업장')) counts.work++;
      if (d.agency.includes('은행') || d.agency.includes('보험') || d.agency.includes('공단') || d.agency.includes('금융') || d.agency.includes('국토')) counts.finance++;
    });
    return counts;
  }, [docList]);

  // 사무소 정보
  const office = getOfficeProfile((clientRequest as any).assignedLawyerName);
  const trackingUrl = typeof window !== 'undefined' ? `${window.location.origin}/?tab=mypage` : '';
  const ensureOffice = (): boolean => {
    if (!office.firmName || !office.address) {
      toast.error('사무소명·주소가 설정되지 않았습니다. [설정 > 사업자 정보]를 먼저 입력해 주세요.');
      return false;
    }
    return true;
  };

  // 1차 서류 일괄 수령 완료
  const handleApproveAllPhase1 = () => {
    setDocList(prev => prev.map(d => 
      d.phase === 1 
        ? { ...d, status: 'APPROVED', approvedAt: localYmd() } 
        : d
    ));
    setIsSealKeptInSafe(true);
    setIsDebtDispatched(false);
    toast.success('1차 기본 서류 수령 및 인감 보관이 확인되었습니다.');
    addClientNotification({
      type: 'document_request',
      title: `[1차 서류 수령완료] ${clientRequest.clientName}님, 보내주신 서류가 안전하게 도착했습니다.`,
      emoji: '📦',
      linkTab: 'diagnosis',
    });
  };

  // 배송 송장정보 저장
  const handleSavePostalTracking = async () => {
    const trimmedCarrier = inputCarrier;
    const trimmedTracking = inputTracking.trim();
    setPostalCarrier(trimmedCarrier);
    setPostalTrackingNumber(trimmedTracking);
    setIsEditingPostal(false);
    saveStage3State(clientRequest.id, { postalCarrier: trimmedCarrier, postalTrackingNumber: trimmedTracking });
    if (onUpdateCrmExt) {
      try {
        await onUpdateCrmExt({
          postalCarrier: trimmedCarrier,
          postalTrackingNumber: trimmedTracking,
        });
      } catch {
        // ignore
      }
    }
    toast.success(`배송 정보가 저장되었습니다: [${getCarrierLabel(trimmedCarrier)}] ${trimmedTracking || '미등록'}`);
  };

  // 부채대행 발송완료 마킹
  const handleConfirmDebtDispatched = () => {
    setIsDebtDispatched(true);
    setDebtCertElapsedDays(1);
    const nextOrder: DebtCertificateOrder = { ...debtOrder, orderStatus: 'requested', requestedAt: new Date().toISOString() };
    setDebtOrder(nextOrder);
    saveDebtCertificateOrder(nextOrder);
    toast.success('부채증명서 대행사 발송이 확인되었습니다. (약 7영업일 소요 시작)');
    addClientNotification({
      type: 'status_change',
      title: `[부채증명서 발급 개시] ${clientRequest.clientName}님, 채권사 부채증명서 발급을 정식 개시했습니다.`,
      emoji: '🏛️',
      linkTab: 'diagnosis',
    });
  };

  // 개별 서류 승인
  const handleApproveDoc = (docId: string) => {
    setDocList(prev => prev.map(d => 
      d.id === docId 
        ? { ...d, status: 'APPROVED', approvedAt: localYmd() } 
        : d
    ));
  };

  // 개별 서류 보완 요청
  const handleRejectDoc = (docId: string, reason: string) => {
    setDocList(prev => prev.map(d => 
      d.id === docId 
        ? { ...d, status: 'SUPPLEMENT_NEEDED', supplementReason: reason } 
        : d
    ));
    addClientNotification({
      type: 'status_change',
      title: `[서류 보완요청] ${clientRequest.clientName}님, '${reason}' 사유로 재제출이 필요합니다.`,
      emoji: '⚠️',
      linkTab: 'diagnosis',
    });
  };

  // 묶음 서류 요청 전송
  const handleConfirmBatchSend = async (
    selectedDocIds: string[],
    deadlineDays: number,
    requestType: 'phase1' | 'phase2' | 'custom',
    previewText: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    const today = localYmd();
    setDocList(prev => prev.map(d => 
      selectedDocIds.includes(d.id) 
        ? { ...d, status: 'REQUESTED', requestedAt: today } 
        : d
    ));
    if (!ensureOffice()) return { ok: false, error: '사무소 정보 미설정' };
    if (!clientRequest.phone) return { ok: false, error: '의뢰인 연락처가 없습니다.' };

    const due = new Date(); due.setDate(due.getDate() + deadlineDays);
    const deadline = `${due.getMonth() + 1}월 ${due.getDate()}일`;
    const names = docList.filter(d => selectedDocIds.includes(d.id)).map(d => d.name);
    const base = { clientName: clientRequest.clientName, firmName: office.firmName, lawyerName: office.lawyerName || '담당 변호사', trackingUrl };
    
    const res = requestType === 'phase1'
      ? await sendAlimtok(clientRequest.phone, 'doc_request_phase1', { ...base, creditorCount: `${requiredSealCount}부`, creditorNum: `${creditorCount}`, firmAddress: office.address })
      : requestType === 'phase2'
      ? await sendAlimtok(clientRequest.phone, 'doc_request_phase2', base)
      : await sendAlimtok(clientRequest.phone, 'document_request', { ...base, documentList: names.map((n, i) => `${i + 1}. ${n}`).join('\n'), deadline });

    if (res.ok) {
      addClientNotification({
        type: 'status_change',
        title: `[서류 요청] ${clientRequest.clientName}님, 서류 ${selectedDocIds.length}건 제출 요청이 도착했습니다.`,
        emoji: '📑',
        linkTab: 'diagnosis',
      });
    }
    return { ok: res.ok, error: res.error };
  };

  // 개별 서류 다시 알림
  const handleSendSingleReminder = async (docName: string) => {
    if (!ensureOffice() || !clientRequest.phone) return;
    const res = await sendAlimtok(clientRequest.phone, 'doc_phase2_reminder', {
      clientName: clientRequest.clientName,
      unsubmittedCount: '1',
      unsubmittedDocNames: docName,
      deadline: '이번 주 금요일 18:00',
      firmName: office.firmName,
      lawyerName: office.lawyerName || '담당 변호사',
      trackingUrl,
    });
    if (res.ok) toast.success(`'${docName}' 제출 안내 알림톡이 발송되었습니다.`);
    else toast.error(`알림톡 발송 실패: ${res.error || '원인 불명'}`);
  };

  // 진술서 및 수지표 요약 계산
  const fp = clientRequest.financialProfile;
  const incomeWon = (fp?.income || 0) * 10000;
  const debtWon = (fp?.debtTotal || 0) * 10000;
  const hasStatement = Boolean(crmExt?.courtStatement);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto text-slate-800 text-xs">
      
      {/* ══════════════════════════════════════════════════════════════
          SECTION 1: 발급 서류 (docs)
          ══════════════════════════════════════════════════════════════ */}
      {currentSection === 'docs' && (
        <div className="space-y-5 animate-fadeIn">
          {/* 스마트 자동 분류 투입함 */}
          <SmartDocumentDropzone
            clientId={clientRequest.id}
            clientName={clientRequest.clientName || '의뢰인'}
          />

          {/* 상단 2열 요약 카드 (1차 서류 배송 및 보관 & 인증서 금고) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 카드 A: 1차 실물 서류 & 인감 수령 상태 */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      stats.isPhase1Done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      <Truck className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">1차 실물 서류 & 인감</h4>
                      <p className="text-[12px] text-slate-500">인감도장 및 인감증명서 원본 수령</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    stats.isPhase1Done
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {stats.isPhase1Done ? '수령 완료' : `${stats.phase1ApprovedCount}/${stats.phase1RequiredCount}건 준비 중`}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1.5">
                      <Stamp className="w-3.5 h-3.5 text-indigo-600" /> 인감도장 사무소 금고 보관:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsSealKeptInSafe(!isSealKeptInSafe)}
                      className={`px-2.5 py-0.5 rounded-lg font-bold transition-all cursor-pointer ${
                        isSealKeptInSafe 
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                          : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {isSealKeptInSafe ? '보관 중' : '미수령 (클릭하여 확인)'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">인감증명서 필수 부수:</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      채권사 {creditorCount}곳 + 5부 = <strong className="text-indigo-600">총 {requiredSealCount}부 필수</strong>
                    </span>
                  </div>

                  {/* 배송 송장정보 한 줄 */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> 등기/택배 배송:
                    </span>
                    {isEditingPostal ? (
                      <div className="flex items-center gap-1">
                        <select
                          value={inputCarrier}
                          onChange={(e) => setInputCarrier(e.target.value)}
                          className="text-xs bg-white border border-slate-300 rounded-lg p-1"
                        >
                          {CARRIER_LIST.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={inputTracking}
                          onChange={(e) => setInputTracking(e.target.value)}
                          placeholder="송장번호"
                          className="w-28 text-xs bg-white border border-slate-300 rounded-lg p-1 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleSavePostalTracking}
                          className="px-2 py-1 bg-[#1E3A5F] text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-800">
                          [{getCarrierLabel(postalCarrier)}] {postalTrackingNumber || '미등록'}
                        </span>
                        {postalTrackingNumber && getCarrierTrackingUrl(postalCarrier, postalTrackingNumber) && (
                          <a
                            href={getCarrierTrackingUrl(postalCarrier, postalTrackingNumber)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 hover:bg-blue-100"
                          >
                            조회
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setInputCarrier(postalCarrier);
                            setInputTracking(postalTrackingNumber);
                            setIsEditingPostal(true);
                          }}
                          className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApproveAllPhase1}
                  className={`flex-1 py-2 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale ${
                    stats.isPhase1Done
                      ? 'bg-slate-100 text-emerald-800 border border-emerald-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{stats.isPhase1Done ? '1차 서류 수령완료됨' : '1차 서류 일괄 수령확인'}</span>
                </button>
              </div>
            </div>

            {/* 카드 B: 인증서 금고 연동 카드 (기획서 309행) */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <CertificateVaultCard
                clientId={clientRequest.id}
                clientRequest={clientRequest}
                crmExt={crmExt}
                onUpdateCrmExt={onUpdateCrmExt}
                compact={true}
              />
            </div>
          </div>

          {/* 발급 서류 테이블 카드 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* ── 1줄 통합 상태 및 필터 툴바 ── */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              {/* 상태 칩 한 줄 */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-slate-500 font-bold text-xs mr-1 flex items-center gap-1 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400" /> 서류 상태:
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'all' ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  전체 ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('review')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'review' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  검토 대기 ({stats.submittedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('supplement')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'supplement' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  보완 필요 ({stats.supplementCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('approved')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                    statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  승인 완료 ({stats.approvedCount})
                </button>
              </div>

              {/* 우측 묶음 재요청 액션 */}
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#163152] text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 press-scale"
              >
                <Send className="w-3.5 h-3.5" />
                <span>미제출 묶음 재요청</span>
              </button>
            </div>

            {/* 발급처별 필터 탭 */}
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-100/60 flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveAgency('all')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  activeAgency === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                전체 발급처 ({agencyCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setActiveAgency('gov')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeAgency === 'gov' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Home className="w-3.5 h-3.5 text-emerald-600" />
                <span>주민센터·정부24 ({agencyCounts.gov})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAgency('tax')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeAgency === 'tax' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>국세청·홈택스 ({agencyCounts.tax})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAgency('work')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeAgency === 'work' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                <span>직장·사업장 ({agencyCounts.work})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAgency('finance')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeAgency === 'finance' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                <span>금융·재산 ({agencyCounts.finance})</span>
              </button>
            </div>

            {/* 서류 목록 테이블 */}
            <div className="divide-y divide-slate-100">
              {filteredDocs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  조건에 일치하는 서류가 없습니다.
                </div>
              ) : (
                filteredDocs.map((doc) => {
                  return (
                    <div 
                      key={doc.id}
                      className="p-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          doc.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : doc.status === 'SUBMITTED'
                            ? 'bg-blue-100 text-blue-700'
                            : doc.status === 'SUPPLEMENT_NEEDED'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}>
                          {doc.status === 'APPROVED' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900">{doc.name}</span>
                            {doc.isRequired ? (
                              <span className="text-xs px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                필수
                              </span>
                            ) : (
                              <span className="text-xs px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
                                선택
                              </span>
                            )}
                            {doc.isCreditorMultiplier && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                총 {requiredSealCount}부 필수
                              </span>
                            )}
                            {doc.phase === 1 && (
                              <span className="text-xs px-1.5 py-0.2 rounded font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                실물 등기
                              </span>
                            )}
                          </div>

                          <div className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="text-slate-600 font-medium">{doc.agency}</span>
                            <span className="text-slate-300">•</span>
                            <span className="truncate max-w-md">{doc.notes}</span>
                            {doc.supplementReason && (
                              <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                                보완 사유: {doc.supplementReason}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── 행당 단일 액션 버튼 (기획서 3-1: 행 버튼 1개 원칙) ── */}
                      <div className="shrink-0">
                        {doc.status === 'SUBMITTED' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (doc.phase === 1) {
                                handleApproveDoc(doc.id);
                                toast.success(`'${doc.name}' 수령이 확인되었습니다.`);
                              } else {
                                setShowSpeedReviewModal(true);
                              }
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>검토하기</span>
                          </button>
                        )}

                        {doc.status === 'APPROVED' && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1 whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>승인 완료</span>
                          </span>
                        )}

                        {doc.status === 'NOT_REQUESTED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setDocList(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'REQUESTED', requestedAt: localYmd() } : d));
                              toast.success(`'${doc.name}' 요청 상태로 전환되었습니다.`);
                            }}
                            className="px-3 py-1.5 text-slate-700 hover:text-slate-900 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                          >
                            요청하기
                          </button>
                        )}

                        {doc.status === 'REQUESTED' && (
                          <button
                            type="button"
                            onClick={() => handleSendSingleReminder(doc.name)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                            title="고객에게 알림톡 다시 알림"
                          >
                            다시 알림
                          </button>
                        )}

                        {doc.status === 'SUPPLEMENT_NEEDED' && (
                          <button
                            type="button"
                            onClick={() => {
                              toast.info(`'${doc.name}' 보완 가이드 알림톡을 발송합니다.`);
                              handleSendSingleReminder(doc.name);
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
                          >
                            보완 재요청
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── 하단 라이트 단계 완료 조건 바 (기획서 3-1 & 5.1 라이트 캔버스 규칙) ── */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${stats.isReadyForStage4 ? 'bg-emerald-600' : 'bg-amber-500'}`} />
              <span className="font-bold text-slate-900">3단계 완료 조건:</span>
              <span className="text-slate-600">
                필수 서류 승인율 80% 이상 & 검토 대기 0건 ({stats.approvedCount}/{stats.requiredCount}건 승인됨, 검토 대기 {stats.submittedCount}건)
              </span>
            </div>

            {stats.isReadyForStage4 ? (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              >
                <span>다음: 4단계 (신청·접수)로 이동</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : stats.submittedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowSpeedReviewModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>제출 서류 {stats.submittedCount}건 빠른 검토</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>미제출 서류 묶음 요청</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2: 부채증명서 (debt-cert)
          ══════════════════════════════════════════════════════════════ */}
      {currentSection === 'debt-cert' && (
        <div className="space-y-5 animate-fadeIn">
          {/* 부채증명서 대행 종합 관리 카드 */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">금융기관 부채증명서 대행 발주 관리</h4>
                  <p className="text-[12px] text-slate-500">인감증명서 원본 기반 금융기관 부채증명서 일괄 발주 및 수령</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAgencyAppModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>대행 신청서 작성 / 인쇄</span>
                </button>
              </div>
            </div>

            {/* 대행 메타데이터 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-500 block text-xs mb-0.5">의뢰 대상 채권기관</span>
                <span className="font-bold text-slate-900 text-sm">{creditorCount}개 기관</span>
                <span className="text-xs text-slate-500 block mt-0.5">인감증명서 {requiredSealCount}부 동봉 필요</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-500 block text-xs mb-0.5">발급 진행 경과 (약 7영업일)</span>
                <span className="font-bold text-indigo-700 text-sm">
                  {isDebtDispatched ? `${debtCertElapsedDays}일차 / 7일 소요 (D-${Math.max(1, 7 - debtCertElapsedDays)})` : '발주 대기 중'}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">대행업체: {debtOrder.agencyName || '미지정'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-500 block text-xs mb-0.5">총 예상 대행비용</span>
                <span className="font-bold text-slate-900 text-sm">
                  {won(debtOrder.totalAgencyCost || creditorCount * 17000)}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">실비 수납 내역 연동</span>
              </div>
            </div>

            {/* 발송 완료 및 검수 액션 */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {!isDebtDispatched ? (
                <button
                  type="button"
                  onClick={handleConfirmDebtDispatched}
                  className="px-3.5 py-2 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>대행사 발송 완료 마킹</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAgencyAppModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>서류철 도착확인 및 채권 검수</span>
                </button>
              )}
            </div>
          </div>

          {/* 의뢰 채권기관 목록 테이블 */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-bold text-xs text-slate-800">
              <span>채권기관별 발급 내역 ({debtOrder.items.length}곳)</span>
              <span className="text-slate-500 font-normal text-xs">
                완료 후 4단계 신청서 채권자목록으로 자동 반영됩니다
              </span>
            </div>

            {debtOrder.items.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                등록된 채권기관이 없습니다. [대행 신청서 작성] 버튼을 눌러 채권기관을 추가하세요.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-2.5 bg-slate-100/60 grid grid-cols-12 gap-2 text-slate-600 font-bold text-xs">
                  <div className="col-span-1">No</div>
                  <div className="col-span-5">금융기관명 (채권사)</div>
                  <div className="col-span-3 text-right">예상 채무원금</div>
                  <div className="col-span-3 text-center">발급 상태</div>
                </div>
                {debtOrder.items.map((item, idx) => (
                  <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50">
                    <div className="col-span-1 font-mono text-slate-400 font-bold">{idx + 1}</div>
                    <div className="col-span-5 font-bold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{item.creditorName}</span>
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-slate-800">
                      {item.expectedPrincipal ? won(item.expectedPrincipal) : '-'}
                    </div>
                    <div className="col-span-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        isDebtDispatched
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {isDebtDispatched ? '대행 발급 중' : '발주 대기'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3: 진술서·수지표 (statement)
          ══════════════════════════════════════════════════════════════ */}
      {currentSection === 'statement' && (
        <div className="space-y-5 animate-fadeIn">
          {/* 1. 채무증대경위서 / 진술서 카드 */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">개인회생·파산 진술서 (채무증대경위서)</h4>
                  <p className="text-[12px] text-slate-500">법원 제출 서식 제4호 진술서 및 지급불능에 이른 경위 작성</p>
                </div>
              </div>

              {onOpenStatementSyncModal && (
                <button
                  type="button"
                  onClick={onOpenStatementSyncModal}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>진술서 작성·검토 열기</span>
                </button>
              )}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">진술서 작성 상태:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                  hasStatement ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {hasStatement ? '작성 완료' : '작성 및 검토 대기'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">주요 채무 원인:</span>
                <span className="font-bold text-slate-800">
                  {fp?.debtCause === 'LIVING' ? '생활비 부족' : fp?.debtCause === 'BUSINESS' ? '사업 실패' : fp?.debtCause === 'INVESTMENT' ? '투자/사행성 손실' : fp?.debtCause || '미입력'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">독촉 및 법적 절차:</span>
                <span className="text-slate-700">
                  독촉 수준: {fp?.harassmentLevel || '미입력'} / 소송: {(fp?.legalActions || []).length}건
                </span>
              </div>
            </div>
          </div>

          {/* 2. 가계수지표 (수입 및 지출 목록) 카드 */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">수입 및 지출에 관한 목록 (가계수지표)</h4>
                  <p className="text-[12px] text-slate-500">신청인의 월 평균 가용소득 산출 및 법정 생계비 검토</p>
                </div>
              </div>

              {onOpenIncomeExpenseModal && (
                <button
                  type="button"
                  onClick={onOpenIncomeExpenseModal}
                  className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>수지표 점검 및 수정</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-500 block text-xs mb-0.5">월 평균 실수령 소득</span>
                <span className="font-bold text-slate-900 text-sm">{won(incomeWon)}</span>
                <span className="text-xs text-slate-500 block mt-0.5">직업: {fp?.jobType || '급여소득자'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-500 block text-xs mb-0.5">가구원 수</span>
                <span className="font-bold text-slate-900 text-sm">{(fp?.dependents || 0) + 1}인 가구</span>
                <span className="text-xs text-slate-500 block mt-0.5">부양가족 {fp?.dependents || 0}명</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <span className="text-slate-500 block text-xs mb-0.5">월 변제 예정 가용소득</span>
                <span className="font-bold text-teal-800 text-sm">
                  {won(crmExt?.repaymentPlan?.monthlyRepaymentTotal || 0)}
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">수지표 자동 연산 기준</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 모달 렌더링 ── */}
      <BatchDocRequestModal
        key={`${clientRequest.id}-${batchPresetPhase || 'all'}-${showBatchModal ? 'open' : 'closed'}`}
        isOpen={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        clientName={clientRequest.clientName}
        clientPhone={clientRequest.phone}
        creditorCount={creditorCount}
        initialPhase={batchPresetPhase}
        unsubmittedDocs={docList.filter(d => ['NOT_REQUESTED', 'REQUESTED', 'SUPPLEMENT_NEEDED'].includes(d.status)).map(d => ({
          id: d.id,
          name: d.name,
          agency: d.agency,
          isRequired: d.isRequired,
          notes: d.notes,
          phase: d.phase,
        }))}
        onConfirmBatchSend={handleConfirmBatchSend}
      />

      <SpeedDocReviewModal
        isOpen={showSpeedReviewModal}
        onClose={() => setShowSpeedReviewModal(false)}
        clientName={clientRequest.clientName}
        reviewDocs={docList.filter(d => d.status === 'SUBMITTED').map(d => ({
          id: d.id,
          name: d.name,
          agency: d.agency,
          isRequired: d.isRequired,
          isThirdPartyMaskingRequired: d.isThirdPartyMaskingRequired,
        }))}
        onApproveDoc={handleApproveDoc}
        onRejectDoc={handleRejectDoc}
      />

      {isAgencyAppModalOpen && (
        <DebtAgencyApplicationModal
          isOpen={isAgencyAppModalOpen}
          onClose={() => setIsAgencyAppModalOpen(false)}
          clientId={clientRequest.id}
          clientRequest={clientRequest}
          crmExt={crmExt}
          order={debtOrder}
          onSaveOrder={(newOrder) => {
            setDebtOrder(newOrder);
            saveDebtCertificateOrder(newOrder);
          }}
          activeLawyerName={(clientRequest as any).assignedLawyerName || ''}
        />
      )}
    </div>
  );
}
