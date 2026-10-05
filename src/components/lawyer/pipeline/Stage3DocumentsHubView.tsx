import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Building2, Home, Briefcase, CreditCard, ShieldCheck, 
  Upload, Eye, CheckCircle2, AlertCircle, Clock, FileText,
  ArrowRight, Camera, RefreshCw, AlertTriangle, Send, 
  ExternalLink, Smartphone, Sparkles, FolderArchive, Check,
  RotateCcw, Filter, FileCheck2, Mail, Truck, Stamp, Info, Copy,
  FileSpreadsheet, Lock, Unlock, ArrowUpRight, Edit2, Save, X,
  BookOpen, Calendar, HelpCircle, Landmark, ChevronDown, ChevronUp
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
import PublicDocGuideModal from '../documents/PublicDocGuideModal';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('auto');

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
  const [showPublicDocGuide, setShowPublicDocGuide] = useState(false);

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

  // 스마트 카테고리 아코디언 상태 및 그룹핑 (옵션 1: 스크롤 단축 및 인지 부하 해결)
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const categoryGroups = useMemo(() => {
    const groups = [
      {
        id: 'gov',
        title: '주민센터 · 정부24 · 대법원',
        desc: '인적·가족관계 증빙 및 기본 증명',
        icon: <Home className="w-4 h-4 text-emerald-600" />,
        match: (d: DocItemModel) => d.agency.includes('주민센터') || d.agency.includes('정부24') || d.agency.includes('대법원')
      },
      {
        id: 'tax',
        title: '국세청 · 홈택스 · 위택스',
        desc: '소득금액 및 지방세 세목별 과세 증명',
        icon: <Building2 className="w-4 h-4 text-blue-600" />,
        match: (d: DocItemModel) => d.agency.includes('홈택스') || d.agency.includes('국세청') || d.agency.includes('위택스')
      },
      {
        id: 'work',
        title: '직장 · 사업장 · 국민건강보험·연금공단',
        desc: '소득·재직 및 4대보험 자격 증빙',
        icon: <Briefcase className="w-4 h-4 text-indigo-600" />,
        match: (d: DocItemModel) => d.agency.includes('직장') || d.agency.includes('사업장') || d.agency.includes('공단')
      },
      {
        id: 'finance',
        title: '금융기관 · 카드사 · 보험사',
        desc: '부채증명서, 신용정보조회서, 보험해약환급금 등',
        icon: <CreditCard className="w-4 h-4 text-amber-600" />,
        match: (d: DocItemModel) => d.agency.includes('은행') || d.agency.includes('보험') || d.agency.includes('금융') || d.agency.includes('국토')
      },
      {
        id: 'personal',
        title: '신청인 직접 준비 및 기타 첨부',
        desc: '진술서, 임대차계약서, 가계수지표 등',
        icon: <FileText className="w-4 h-4 text-slate-600" />,
        match: () => true
      }
    ];

    const assignedIds = new Set<string>();
    return groups.map(g => {
      const docsInGroup = filteredDocs.filter(d => {
        if (assignedIds.has(d.id)) return false;
        if (g.match(d)) {
          assignedIds.add(d.id);
          return true;
        }
        return false;
      });
      const approvedCount = docsInGroup.filter(d => d.status === 'APPROVED').length;
      const isAllApproved = docsInGroup.length > 0 && approvedCount === docsInGroup.length;
      return {
        ...g,
        docs: docsInGroup,
        approvedCount,
        totalCount: docsInGroup.length,
        isAllApproved
      };
    }).filter(g => g.docs.length > 0);
  }, [filteredDocs]);

  const isCategoryOpen = (catId: string, isAllApproved: boolean) => {
    if (openCategories[catId] !== undefined) {
      return openCategories[catId];
    }
    // 스마트 기본값: 전원 승인 완료된 카테고리는 기본 접힘(false), 미완료 카테고리는 기본 펼침(true)
    return !isAllApproved;
  };

  const toggleCategoryOpen = (catId: string, isAllApproved: boolean) => {
    const current = isCategoryOpen(catId, isAllApproved);
    setOpenCategories(prev => ({ ...prev, [catId]: !current }));
  };

  const setAllCategoriesOpen = (open: boolean) => {
    const next: Record<string, boolean> = {};
    categoryGroups.forEach(g => { next[g.id] = open; });
    setOpenCategories(next);
  };

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
          {/* 체크리스트 우선 뷰 카드 */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* 상단 진행률 및 헤더 */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-indigo-600" />
                  {clientRequest.clientName} · 신청서류
                </h3>
                
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap">
                    <span className="text-emerald-600">{stats.approvedCount}</span>
                    <span className="text-slate-400">/</span>
                    <span>{stats.total} 받음</span>
                  </div>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${stats.total > 0 ? (stats.approvedCount / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                  {stats.submittedCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-bold whitespace-nowrap">
                      확인 필요 {stats.submittedCount}건
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(true)}
                  className="px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#163152] text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 press-scale whitespace-nowrap min-h-[44px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>의뢰인에게 요청 보내기</span>
                </button>
              </div>
            </div>

            {/* 필터 툴바 */}
            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-white">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 min-h-[44px]"
              >
                <option value="auto">급여소득자 기본 ▾</option>
                <option value="manual1">영업소득자 기본 ▾</option>
              </select>

              <div className="relative flex-1 max-w-xs">
                <input
                  type="text"
                  placeholder="서류명 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-400 min-h-[44px]"
                />
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              <button className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all press-scale whitespace-nowrap min-h-[44px]">
                + 추가
              </button>
              
              <div className="ml-auto flex items-center gap-2">
                 <button
                  type="button"
                  onClick={() => setShowPublicDocGuide(true)}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 press-scale min-h-[44px]"
                  title="8대 공공기관별 필수 발급 옵션 및 의뢰인 전송용 문자 템플릿 확인"
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">공공기관 발급 가이드</span>
                </button>
              </div>
            </div>

            {/* 체크리스트 테이블 */}
            <div className="divide-y divide-slate-100 bg-white">
              <div className="grid grid-cols-12 gap-3 px-5 py-2 bg-slate-50/50 text-xs font-bold text-slate-500">
                <div className="col-span-1 text-center">번호</div>
                <div className="col-span-6">서류명</div>
                <div className="col-span-3 text-center">발급 안내</div>
                <div className="col-span-2 text-center">수령 상태</div>
              </div>

              {filteredDocs.filter(d => d.name.includes(searchQuery)).map((doc, idx) => {
                const isExpanded = expandedDocId === doc.id;
                
                return (
                  <div key={doc.id} className="flex flex-col border-b border-slate-100 last:border-b-0">
                    <div 
                      className={`grid grid-cols-12 gap-3 px-5 py-3 items-center cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}
                      onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                    >
                      <div className="col-span-1 text-center text-slate-400 font-mono text-xs font-medium">
                        {idx + 1}
                      </div>
                      
                      <div className="col-span-6 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{doc.name}</span>
                          {doc.isRequired && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              필수
                            </span>
                          )}
                          {doc.phase === 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              실물 등기
                            </span>
                          )}
                        </div>
                        {doc.status !== 'APPROVED' && doc.status !== 'NOT_REQUESTED' && (
                          <div className="flex items-center gap-1.5 text-xs mt-0.5">
                            <ArrowUpRight className="w-3 h-3 text-slate-400" />
                            <span className={`font-medium ${
                              doc.status === 'SUBMITTED' ? 'text-blue-600' :
                              doc.status === 'SUPPLEMENT_NEEDED' ? 'text-amber-600' :
                              doc.status === 'REQUESTED' ? 'text-indigo-600' : 'text-slate-500'
                            }`}>
                              {doc.status === 'SUBMITTED' ? '업로드됨 · 확인 필요' :
                               doc.status === 'SUPPLEMENT_NEEDED' ? '보완 필요' :
                               doc.status === 'REQUESTED' ? '요청함 (미제출)' : ''}
                            </span>
                            {doc.supplementReason && (
                              <span className="text-slate-500 truncate max-w-[200px]">- {doc.supplementReason}</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-3 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowPublicDocGuide(true); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                        >
                          안내 보기 <HelpCircle className="w-3 h-3" />
                        </button>
                      </div>
                      
                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (doc.status === 'APPROVED') {
                              setDocList(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'NOT_REQUESTED' } : d));
                            } else {
                              handleApproveDoc(doc.id);
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                            doc.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              doc.status === 'APPROVED' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 행 확장 시 보이는 세부 정보 패널 */}
                    {isExpanded && (
                      <div className="px-12 py-4 bg-slate-50/80 border-t border-slate-100 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5" /> 상세 정보
                              </h5>
                              <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-500 w-16 shrink-0">발급처</span>
                                  <span className="font-medium text-slate-800">{doc.agency}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="text-slate-500 w-16 shrink-0">메모</span>
                                  <span className="text-slate-700">{doc.notes || '-'}</span>
                                </div>
                                {doc.isThirdPartyMaskingRequired && (
                                  <div className="flex items-start gap-2 mt-2 pt-2 border-t border-slate-100">
                                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-bold shrink-0">
                                      마스킹 필수
                                    </span>
                                    <span className="text-slate-600 text-[11px]">제3자 주민등록번호 뒷자리 마스킹 처리 요망</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {doc.status === 'SUBMITTED' && (
                               <button
                                  type="button"
                                  onClick={() => setShowSpeedReviewModal(true)}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer press-scale"
                                >
                                  <FileCheck2 className="w-4 h-4" />
                                  <span>제출된 파일 검토하기</span>
                                </button>
                            )}
                          </div>
                          
                          <div>
                            <h5 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" /> 파일 직접 업로드
                            </h5>
                            <div className="bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                              <SmartDocumentDropzone
                                clientId={clientRequest.id}
                                clientName={clientRequest.clientName || '의뢰인'}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 2열 요약 카드 (1차 서류 배송 및 보관 & 인증서 금고) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 카드 A: 1차 실물 서류 & 인감 수령 상태 */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
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
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
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
                  className={`flex-1 py-2 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale min-h-[44px] ${
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

            {/* 카드 B: 인증서 금고 연동 카드 */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
              <CertificateVaultCard
                clientId={clientRequest.id}
                clientRequest={clientRequest}
                crmExt={crmExt}
                onUpdateCrmExt={onUpdateCrmExt}
                compact={true}
              />
            </div>
          </div>

          {/* 하단 라이트 단계 완료 조건 바 */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
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
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap min-h-[44px]"
              >
                <span>다음: 4단계 (신청·접수)로 이동</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : stats.submittedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowSpeedReviewModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap min-h-[44px]"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>제출 서류 {stats.submittedCount}건 빠른 검토</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap min-h-[44px]"
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

      {/* 8대 공공기관 서류 발급 가이드 & 안내 센터 모달 */}
      {showPublicDocGuide && (
        <PublicDocGuideModal
          isOpen={showPublicDocGuide}
          onClose={() => setShowPublicDocGuide(false)}
          clientName={clientRequest.clientName}
        />
      )}
    </div>
  );
}
