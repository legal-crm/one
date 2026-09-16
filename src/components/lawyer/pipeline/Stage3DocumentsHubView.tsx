import React, { useState, useMemo } from 'react';
import { 
  Building2, Home, Briefcase, CreditCard, ShieldCheck, 
  Upload, Eye, CheckCircle2, AlertCircle, Clock, FileText,
  ArrowRight, Camera, RefreshCw, AlertTriangle, Send, 
  ExternalLink, Smartphone, Sparkles, FolderArchive, Check,
  RotateCcw, Filter, FileCheck2, Mail, Truck, Stamp, Info, Copy,
  FileSpreadsheet, Lock, Unlock, ArrowUpRight, Edit2, Save, X
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, DocumentFile } from '../../../types';
import { 
  ApplicationDocTemplateService, 
  type DocPhase, 
  type SubmissionMethod 
} from '../../../services/documents/applicationDocTemplateService';
import ApplicationDocSettingsModal from '../documents/ApplicationDocSettingsModal';
import BatchDocRequestModal, { type BatchDocItem } from './BatchDocRequestModal';
import SpeedDocReviewModal, { type ReviewDocItem } from './SpeedDocReviewModal';
import { sendAlimtok } from '../../../services/alimtokService';
import { addClientNotification } from '../../../services/clientNotificationService';
import DebtAgencyApplicationModal from '../repayment/DebtAgencyApplicationModal';
import { loadDebtCertificateOrder, saveDebtCertificateOrder } from '../../../services/repayment/debtCertificateService';
import type { DebtCertificateOrder } from '../../../services/repayment/repaymentTypes';
import { CARRIER_LIST, getCarrierTrackingUrl, getCarrierLabel } from '../../../utils/carrierTracking';

interface Stage3DocumentsHubViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage: () => void;
  onOpenDocScanner?: () => void;
  onOpenStatementSyncModal?: () => void;
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

type AgencyTab = 'all' | 'gov' | 'tax' | 'work' | 'finance' | 'personal';
type StatusFilter = 'all' | 'unsubmitted' | 'review' | 'supplement' | 'approved';
type PhaseTab = 'all' | 1 | 'debt' | 2;

export default function Stage3DocumentsHubView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenDocScanner,
  onOpenStatementSyncModal,
}: Stage3DocumentsHubViewProps) {
  // 1차/2차/부채대행 차수별 탭
  const [activePhaseTab, setActivePhaseTab] = useState<PhaseTab>('all');
  const [activeAgency, setActiveAgency] = useState<AgencyTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // 채권자 수 및 인감증명서 부수
  const creditorCount = Number(clientRequest.creditorCount || crmExt?.creditorCount || 5);
  const requiredSealCount = ApplicationDocTemplateService.getRequiredSealCertCount(creditorCount);

  // 1차 실물 등기 및 배송추적 상태 (우체국, 편의점 택배 등)
  const [postalCarrier, setPostalCarrier] = useState<string>(crmExt?.postalCarrier || 'GS25');
  const [postalTrackingNumber, setPostalTrackingNumber] = useState<string>(crmExt?.postalTrackingNumber || '682910385921');
  const [isEditingPostal, setIsEditingPostal] = useState<boolean>(false);
  const [inputCarrier, setInputCarrier] = useState<string>(postalCarrier);
  const [inputTracking, setInputTracking] = useState<string>(postalTrackingNumber);

  // 인감 보관 및 부채증명서 대행 진행 상태
  const [isSealKeptInSafe, setIsSealKeptInSafe] = useState<boolean>(true);
  const [isDebtDispatched, setIsDebtDispatched] = useState<boolean>(true); // 대행업체에 신청서/인감 발송 완료 여부
  const [debtCertElapsedDays, setDebtCertElapsedDays] = useState<number>(3); // 3일차/7일

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
      agencyName: '원클릭부채대행',
      orderStatus: 'draft',
      items: [
        {
          id: 'item_1',
          creditorName: '국민은행',
          expectedPrincipal: Math.round((clientRequest.financialProfile?.debtTotal || 5000) * 10000 * 0.4),
          issueStatus: 'pending',
          agencyFee: 15000,
          issuanceFee: 2000,
        },
        {
          id: 'item_2',
          creditorName: '신한카드',
          expectedPrincipal: Math.round((clientRequest.financialProfile?.debtTotal || 5000) * 10000 * 0.35),
          issueStatus: 'pending',
          agencyFee: 15000,
          issuanceFee: 2000,
        },
        {
          id: 'item_3',
          creditorName: 'OK저축은행',
          expectedPrincipal: Math.round((clientRequest.financialProfile?.debtTotal || 5000) * 10000 * 0.25),
          issueStatus: 'pending',
          agencyFee: 15000,
          issuanceFee: 2000,
        },
      ],
      createdAt: new Date().toISOString(),
      totalAgencyCost: 51000,
    };
  });

  // 로펌 실무 기준 서류 목록 초기화 (1차 실물 9종 + 2차 디지털 17종)
  const [docList, setDocList] = useState<DocItemModel[]>(() => {
    const uploaded = crmExt?.uploadedFiles || [];
    const masterTemplates = ApplicationDocTemplateService.getRecommendedDocsForClient(clientRequest);

    return masterTemplates.map((item, idx) => {
      // 1차 서류 기본 시뮬레이션 상태
      if (item.phase === 1) {
        // 인감도장/등본 등 초기 1차 수령 시뮬레이션
        const isApproved = idx < 6;
        return {
          id: item.id,
          name: item.name,
          phase: item.phase,
          submissionMethod: item.submissionMethod,
          agency: item.agency,
          isRequired: item.isRequired,
          notes: item.tips,
          isThirdPartyMaskingRequired: item.isThirdPartyMasking,
          isCreditorMultiplier: item.isCreditorMultiplier,
          targetParty: item.targetParty,
          status: isApproved ? 'APPROVED' : 'SUBMITTED',
          approvedAt: isApproved ? '2026.09.12' : undefined,
          submittedAt: !isApproved ? '오늘 11:20' : undefined,
        };
      }

      // 2차 디지털 서류 시뮬레이션 상태
      const match = uploaded.find(f => f.name.includes(item.name.slice(0, 3)));
      if (match) {
        return {
          id: item.id,
          name: item.name,
          phase: item.phase,
          submissionMethod: item.submissionMethod,
          agency: item.agency,
          isRequired: item.isRequired,
          notes: item.tips,
          isThirdPartyMaskingRequired: item.isThirdPartyMasking,
          isCreditorMultiplier: item.isCreditorMultiplier,
          targetParty: item.targetParty,
          status: 'APPROVED',
          approvedAt: '2026.09.13',
        };
      }

      if (idx === 10) {
        return {
          id: item.id,
          name: item.name,
          phase: item.phase,
          submissionMethod: item.submissionMethod,
          agency: item.agency,
          isRequired: item.isRequired,
          notes: item.tips,
          status: 'SUBMITTED',
          submittedAt: '오늘 15:40',
        };
      }
      if (idx === 14) {
        return {
          id: item.id,
          name: item.name,
          phase: item.phase,
          submissionMethod: item.submissionMethod,
          agency: item.agency,
          isRequired: item.isRequired,
          notes: item.tips,
          status: 'SUPPLEMENT_NEEDED',
          supplementReason: '마스킹 미처리 또는 유효기간 경과',
        };
      }

      return {
        id: item.id,
        name: item.name,
        phase: item.phase,
        submissionMethod: item.submissionMethod,
        agency: item.agency,
        isRequired: item.isRequired,
        notes: item.tips,
        isThirdPartyMaskingRequired: item.isThirdPartyMasking,
        isCreditorMultiplier: item.isCreditorMultiplier,
        targetParty: item.targetParty,
        status: idx < 16 ? 'REQUESTED' : 'NOT_REQUESTED',
        requestedAt: idx < 16 ? '2026.09.12' : undefined,
      };
    });
  });

  // 상태별 및 차수별 서류 집계
  const stats = useMemo(() => {
    const total = docList.length;
    const required = docList.filter(d => d.isRequired);
    const approved = docList.filter(d => d.status === 'APPROVED');
    const submitted = docList.filter(d => d.status === 'SUBMITTED');
    const supplement = docList.filter(d => d.status === 'SUPPLEMENT_NEEDED');
    const unsubmitted = docList.filter(d => ['NOT_REQUESTED', 'REQUESTED', 'SUPPLEMENT_NEEDED'].includes(d.status) && d.isRequired);

    // 1차 서류 집계
    const phase1Docs = docList.filter(d => d.phase === 1);
    const phase1Required = phase1Docs.filter(d => d.isRequired);
    const phase1Approved = phase1Docs.filter(d => d.status === 'APPROVED');
    const isPhase1Done = phase1Approved.length >= phase1Required.length;

    // 2차 서류 집계
    const phase2Docs = docList.filter(d => d.phase === 2);
    const phase2Required = phase2Docs.filter(d => d.isRequired);
    const phase2Approved = phase2Docs.filter(d => d.status === 'APPROVED');
    const phase2Submitted = phase2Docs.filter(d => d.status === 'SUBMITTED');

    return {
      total,
      requiredCount: required.length,
      approvedCount: approved.length,
      submittedCount: submitted.length,
      supplementCount: supplement.length,
      unsubmittedCount: unsubmitted.length,
      progressRate: Math.round((approved.length / (required.length || 1)) * 100),
      isReadyForStage4: approved.length >= required.length * 0.8 && submitted.length === 0,
      // 1차 vs 2차 분리 통계
      phase1Total: phase1Docs.length,
      phase1RequiredCount: phase1Required.length,
      phase1ApprovedCount: phase1Approved.length,
      isPhase1Done,
      phase2Total: phase2Docs.length,
      phase2RequiredCount: phase2Required.length,
      phase2ApprovedCount: phase2Approved.length,
      phase2SubmittedCount: phase2Submitted.length,
      phase2ProgressRate: Math.round((phase2Approved.length / (phase2Required.length || 1)) * 100),
    };
  }, [docList]);

  // 필터링된 서류 목록
  const filteredDocs = useMemo(() => {
    return docList.filter(doc => {
      // 1차 / 2차 탭 필터
      if (activePhaseTab !== 'all' && doc.phase !== activePhaseTab) return false;

      // 발급처 필터 (2차 탭 또는 전체일 때)
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
    });
  }, [docList, activePhaseTab, activeAgency, statusFilter]);

  // 1차 서류 일괄 수령 완료 처리 (게이트 통과)
  const handleApproveAllPhase1 = () => {
    setDocList(prev => prev.map(d => 
      d.phase === 1 
        ? { ...d, status: 'APPROVED', approvedAt: new Date().toLocaleDateString() } 
        : d
    ));
    setIsSealKeptInSafe(true);
    // 1차 서류 수령 직후 -> 대행 신청서 작성 대기 모드로 진입
    setIsDebtDispatched(false);
    toast.success('1차 실물 서류 9종 수령 및 인감 보관이 확인되었습니다! 이제 [대행 신청서 작성]을 진행해 주세요.', {
      duration: 5000,
    });
    
    addClientNotification({
      type: 'document_request',
      title: `[1차 서류 수령완료] ${clientRequest.clientName}님, 보내주신 1차 서류가 잘 도착하여 부채증명서 발급 준비에 들어갑니다.`,
      emoji: '📦',
      linkTab: 'diagnosis',
    });
  };

  // 배송 송장정보 어드민 직접 저장 핸들러
  const handleSavePostalTracking = () => {
    setPostalCarrier(inputCarrier);
    setPostalTrackingNumber(inputTracking.trim());
    setIsEditingPostal(false);
    toast.success(`배송 정보가 저장되었습니다: [${getCarrierLabel(inputCarrier)}] ${inputTracking.trim() || '미등록'}`);
  };

  // 대행업체 발송 완료 마킹 핸들러
  const handleConfirmDebtDispatched = () => {
    setIsDebtDispatched(true);
    setDebtCertElapsedDays(1);
    toast.success('부채증명서 대행업체 전달 및 발주가 완료되었습니다. (약 7영업일 소요 시작)');
    addClientNotification({
      type: 'status_change',
      title: `[부채증명서 발급 개시] ${clientRequest.clientName}님, 채권사 부채증명서 발급을 정식 개시했습니다. 발급 대기 기간 동안 2차 소득·재산 서류를 올려주세요.`,
      emoji: '🏛️',
      linkTab: 'diagnosis',
    });
  };

  // 1차 등기요청 알림톡 발송
  const handleSendPhase1Alimtalk = () => {
    sendAlimtok(clientRequest.phone, 'doc_request_phase1', {
      clientName: clientRequest.clientName,
      creditorCount: `${requiredSealCount}부`,
      creditorNum: `${creditorCount}`,
      firmAddress: '서울시 도봉구 마들로 760, 한발법조타워 301호',
      firmName: '법률사무소 보광',
      lawyerName: '대표 변호사',
      trackingUrl: 'https://mykim.kr/my',
    });
    toast.success(`${clientRequest.clientName}님께 [1차 기본서류 빠른등기 발송 안내] 알림톡이 발송되었습니다.`);
  };

  // 2차 간편제출 알림톡 발송
  const handleSendPhase2Alimtalk = () => {
    sendAlimtok(clientRequest.phone, 'doc_request_phase2', {
      clientName: clientRequest.clientName,
      firmName: '법률사무소 보광',
      lawyerName: '대표 변호사',
      trackingUrl: 'https://mykim.kr/my',
    });
    toast.success(`${clientRequest.clientName}님께 [2차 서류 모바일 간편제출 안내] 알림톡이 발송되었습니다.`);
  };

  // 2차 마감 리마인더 발송
  const handleSendPhase2Reminder = () => {
    const unsubmittedPhase2 = docList.filter(d => d.phase === 2 && d.status !== 'APPROVED' && d.isRequired);
    sendAlimtok(clientRequest.phone, 'doc_phase2_reminder', {
      clientName: clientRequest.clientName,
      unsubmittedCount: `${unsubmittedPhase2.length}`,
      unsubmittedDocNames: unsubmittedPhase2.slice(0, 3).map(d => d.name).join(', ') + (unsubmittedPhase2.length > 3 ? ' 외' : ''),
      deadline: '이번 주 금요일 18:00',
      firmName: '법률사무소 보광',
      lawyerName: '대표 변호사',
      trackingUrl: 'https://mykim.kr/my',
    });
    toast.success(`${clientRequest.clientName}님께 [2차 서류 마감 리마인더] 알림톡이 발송되었습니다.`);
  };

  // 서류 승인 핸들러
  const handleApproveDoc = (docId: string) => {
    setDocList(prev => prev.map(d => 
      d.id === docId 
        ? { ...d, status: 'APPROVED', approvedAt: new Date().toLocaleDateString() } 
        : d
    ));
  };

  // 서류 보완요청 핸들러
  const handleRejectDoc = (docId: string, reason: string) => {
    setDocList(prev => prev.map(d => 
      d.id === docId 
        ? { ...d, status: 'SUPPLEMENT_NEEDED', supplementReason: reason } 
        : d
    ));
    addClientNotification({
      type: 'status_change',
      title: `[서류 보완요청] ${clientRequest.clientName}님, 제출해주신 서류 중 보완이 필요한 항목이 있습니다. (${reason})`,
      emoji: '⚠️',
      linkTab: 'diagnosis',
    });
  };

  // 일괄 요청 확인 핸들러
  const handleConfirmBatchSend = (selectedDocIds: string[]) => {
    setDocList(prev => prev.map(d => 
      selectedDocIds.includes(d.id) 
        ? { ...d, status: 'REQUESTED', requestedAt: '방금 전' } 
        : d
    ));
    addClientNotification({
      type: 'status_change',
      title: `[서류 일괄요청] ${clientRequest.clientName}님, 법원 제출용 필수 서류 ${selectedDocIds.length}건 발급 안내가 도착했습니다.`,
      emoji: '📑',
      linkTab: 'diagnosis',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. [실무 타임라인] 릴레이 파이프라인 리본 (Relay Progress Ribbon) ── */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-2 py-0.5 rounded bg-slate-900 text-white">
              실무 프로세스
            </span>
            <h3 className="font-extrabold text-sm text-slate-900">
              개인회생 서류 수집 & 부채증명서 릴레이 파이프라인
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            1차 실물 확보 ➔ 대행 발주 (약 7일) ➔ 2차 서류 수합 ➔ 법원 접수
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          {/* Node 1: 1차 실물 서류 */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            stats.isPhase1Done 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold' 
              : 'bg-amber-50/80 border-amber-300 text-amber-950 font-bold'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
              stats.isPhase1Done ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}>
              {stats.isPhase1Done ? <Check className="w-3.5 h-3.5" /> : '1'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate">1차 실물서류 수령</span>
                <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-white/80 border">
                  {stats.isPhase1Done ? '완료' : '진행중'}
                </span>
              </div>
              <p className="text-[10px] font-normal text-slate-600 truncate mt-0.5">
                인감도장/증명서({requiredSealCount}부) 실물확보
              </p>
            </div>
          </div>

          {/* Node 2: 대행 신청서 작성 & 발송 */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            !stats.isPhase1Done
              ? 'bg-slate-50 border-slate-200 text-slate-400'
              : isDebtDispatched
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
              : 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold animate-pulse'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
              !stats.isPhase1Done 
                ? 'bg-slate-200 text-slate-500' 
                : isDebtDispatched 
                ? 'bg-emerald-600 text-white' 
                : 'bg-indigo-600 text-white'
            }`}>
              {isDebtDispatched ? <Check className="w-3.5 h-3.5" /> : '2'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate">대행신청서 작성·발송</span>
                <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-white/80 border">
                  {!stats.isPhase1Done ? '대기' : isDebtDispatched ? '발주완료' : '작성필요'}
                </span>
              </div>
              <p className="text-[10px] font-normal text-slate-600 truncate mt-0.5">
                채권사 {creditorCount}곳 대행신청서 전달
              </p>
            </div>
          </div>

          {/* Node 3: 부채증명 발급 & 2차 서류 병렬 */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            !isDebtDispatched
              ? 'bg-slate-50 border-slate-200 text-slate-400'
              : stats.phase2ProgressRate >= 80
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
              : 'bg-blue-50 border-blue-300 text-blue-950 font-bold'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
              !isDebtDispatched 
                ? 'bg-slate-200 text-slate-500' 
                : stats.phase2ProgressRate >= 80 
                ? 'bg-emerald-600 text-white' 
                : 'bg-blue-600 text-white'
            }`}>
              3
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate">부채대행 & 2차병렬</span>
                <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-white/80 border">
                  {!isDebtDispatched ? '대기' : `${debtCertElapsedDays}일차/7일`}
                </span>
              </div>
              <p className="text-[10px] font-normal text-slate-600 truncate mt-0.5">
                모바일 간편 서류 수합
              </p>
            </div>
          </div>

          {/* Node 4: 법원 접수 준비 완료 */}
          <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
            stats.isReadyForStage4
              ? 'bg-emerald-600 text-white font-bold shadow-xs'
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
              stats.isReadyForStage4 ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-500'
            }`}>
              4
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate">법원 접수 준비</span>
                <span className={`text-[10px] px-1 py-0.2 rounded font-bold border ${
                  stats.isReadyForStage4 ? 'bg-emerald-700 text-white border-emerald-500' : 'bg-white text-slate-500'
                }`}>
                  {stats.isReadyForStage4 ? '준비완료' : '대기'}
                </span>
              </div>
              <p className={`text-[10px] truncate mt-0.5 ${stats.isReadyForStage4 ? 'text-emerald-100' : 'text-slate-500'}`}>
                신청서·변제계획안 패키징
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. [실무 핵심 3-스마트 카드] (인과관계 및 의존성 반영) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5">
        
        {/* 카드 1: [📮 1차 기본서류 & 인감 수령 (착수 게이트)] */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
          stats.isPhase1Done ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl ${stats.isPhase1Done ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    1차 서류 & 인감
                  </h4>
                </div>
              </div>
              <span className={`text-[11px] font-black px-2 py-0.8 rounded-full border shrink-0 ${
                stats.isPhase1Done 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {stats.isPhase1Done ? '수령 완료 (게이트 오픈)' : `${stats.phase1ApprovedCount}/${stats.phase1RequiredCount}건 준비중`}
              </span>
            </div>

            {/* 카드 1 내부 메타데이터 박스 */}
            <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
              {/* 인감도장 금고 보관 */}
              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <Stamp className="w-3.5 h-3.5 text-indigo-600" /> 인감도장 사무소 보관:
                </span>
                <button 
                  type="button" 
                  onClick={() => setIsSealKeptInSafe(!isSealKeptInSafe)}
                  className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                    isSealKeptInSafe ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                  }`}
                  title="클릭하여 보관 상태 토글"
                >
                  {isSealKeptInSafe ? '보관중 (금고 A-03)' : '미수령'}
                </button>
              </div>

              {/* 인감증명서 부수 검증 */}
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-medium">인감증명서 필수 부수:</span>
                <span className="font-mono font-bold text-slate-800">
                  채권사 {creditorCount}곳 + 5부 = <strong className="text-indigo-600">총 {requiredSealCount}부</strong>
                </span>
              </div>

              {/* 등기/택배 배송 송장정보 컴팩트 Row (인라인 수정 지원) */}
              <div className="pt-2 border-t border-slate-100">
                {isEditingPostal ? (
                  <div className="space-y-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-600 flex items-center justify-between">
                      <span>배송사 및 송장번호 입력</span>
                      <button 
                        type="button" 
                        onClick={() => setIsEditingPostal(false)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      <select
                        value={inputCarrier}
                        onChange={(e) => setInputCarrier(e.target.value)}
                        className="col-span-2 text-[11px] bg-white border border-slate-300 rounded p-1"
                      >
                        {CARRIER_LIST.map(c => (
                          <option key={c.code} value={c.code}>{c.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={inputTracking}
                        onChange={(e) => setInputTracking(e.target.value)}
                        placeholder="송장번호 숫자"
                        className="col-span-3 text-[11px] bg-white border border-slate-300 rounded p-1 font-mono"
                      />
                    </div>
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={handleSavePostalTracking}
                        className="px-2 py-0.5 bg-slate-800 text-white rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Save className="w-2.5 h-2.5" /> 저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 font-medium text-slate-600">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>배송 송장:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-slate-800">
                        [{getCarrierLabel(postalCarrier).slice(0, 4)}] {postalTrackingNumber || '미등록'}
                      </span>
                      {postalTrackingNumber && getCarrierTrackingUrl(postalCarrier, postalTrackingNumber) && (
                        <a
                          href={getCarrierTrackingUrl(postalCarrier, postalTrackingNumber)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10px] font-bold flex items-center gap-0.5 border border-blue-200 transition-colors"
                          title="공식 배송조회 페이지 열기"
                        >
                          <Truck className="w-2.5 h-2.5" />
                          <span>조회</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setInputCarrier(postalCarrier);
                          setInputTracking(postalTrackingNumber);
                          setIsEditingPostal(true);
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-700 underline cursor-pointer"
                      >
                        수정
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 카드 1 액션 버튼 */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleApproveAllPhase1}
              className={`px-3 py-1.5 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale ${
                stats.isPhase1Done
                  ? 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{stats.isPhase1Done ? '1차 9종 수령완료됨' : '1차 실물 9종 일괄 수령확인'}</span>
            </button>
            <button
              type="button"
              onClick={handleSendPhase1Alimtalk}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3 h-3 text-amber-600" />
              <span>등기요청 카톡</span>
            </button>
          </div>
        </div>

        {/* 카드 2: [🏛️ 부채증명서 대행 관리 (신청서 작성 ➔ 발송 ➔ 일괄 반환)] */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
          !stats.isPhase1Done
            ? 'bg-slate-50/70 border-slate-200 text-slate-400'
            : !isDebtDispatched
            ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 shadow-xs'
            : 'bg-amber-50/60 border-amber-200'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl ${
                  !stats.isPhase1Done ? 'bg-slate-200 text-slate-500' : isDebtDispatched ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'
                }`}>
                  {!stats.isPhase1Done ? <Lock className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    부채증명서 신청
                  </h4>
                </div>
              </div>

              <span className={`text-[11px] font-black px-2 py-0.8 rounded-full border shrink-0 ${
                !stats.isPhase1Done 
                  ? 'bg-slate-100 text-slate-400 border-slate-200'
                  : !isDebtDispatched
                  ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                {!stats.isPhase1Done ? '1차 대기 (Lock)' : !isDebtDispatched ? '신청서 작성대기' : `진행중 (${debtCertElapsedDays}일차)`}
              </span>
            </div>

            {/* 카드 2 메타데이터 박스 */}
            <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200/80 space-y-2 text-xs">
              {!stats.isPhase1Done ? (
                <div className="py-2 text-center text-slate-500 space-y-1">
                  <Lock className="w-5 h-5 text-slate-400 mx-auto" />
                  <p className="font-bold text-slate-700">1차 서류 도착 대기중</p>
                  <p className="text-[11px] text-slate-500">
                    인감도장과 인감증명서 실물이 도착해야 금융기관 대행 신청서를 작성할 수 있습니다.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>의뢰 대행업체:</span>
                    <span className="font-bold text-slate-800">원클릭부채대행</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>의뢰 대상 채권기관:</span>
                    <span className="font-bold text-indigo-700 font-mono">총 {creditorCount}개 금융기관 (누락없음)</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-700">발급 진행 경과 (약 7영업일):</span>
                      <span className="font-mono font-bold text-amber-700">
                        {isDebtDispatched ? `${debtCertElapsedDays}일차 / 7일 소요 (D-${Math.max(1, 7 - debtCertElapsedDays)})` : '발주 대기중'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${isDebtDispatched ? Math.min(100, Math.round((debtCertElapsedDays / 7) * 100)) : 0}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 카드 2 액션 버튼 */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {!stats.isPhase1Done ? (
              <button
                type="button"
                disabled
                className="w-full py-2 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>1차 서류 수령 후 신청서 작성 가능</span>
              </button>
            ) : !isDebtDispatched ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsAgencyAppModalOpen(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="대행업체 신청서 작성, A4 인쇄 및 엑셀 다운로드"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>대행 신청서 작성 및 인쇄 (Major)</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDebtDispatched}
                  className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3 h-3" />
                  <span>대행사 발송완료 마킹</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsAgencyAppModalOpen(true)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                  <span>신청서 다시보기</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.success('대행사로부터 부채증명서 실물 서류철이 도착했습니다! 원리금 검수를 시작합니다.');
                    setIsAgencyAppModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>서류철 도착확인 & 검수</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 카드 3: [📱 2차 소득·재산 서류 수합 (골든타임 병렬)] */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
          stats.phase2ProgressRate >= 80 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-blue-50/50 border-blue-200'
        }`}>
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    2차 서류
                  </h4>
                </div>
              </div>
              <span className="text-[11px] font-black px-2 py-0.8 rounded-full bg-blue-100 text-blue-800 border border-blue-300 shrink-0">
                {stats.phase2ApprovedCount} / {stats.phase2RequiredCount}건 ({stats.phase2ProgressRate}%)
              </span>
            </div>

            {/* 카드 3 메타데이터 박스 */}
            <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>검토 대기중인 업로드 서류:</span>
                <span className="font-mono font-bold text-blue-600">{stats.phase2SubmittedCount}건</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>보완 필요(재업로드 요청) 서류:</span>
                <span className="font-mono font-bold text-amber-600">{stats.supplementCount}건</span>
              </div>
            </div>
          </div>

          {/* 카드 3 액션 버튼 */}
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            {stats.phase2SubmittedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowSpeedReviewModal(true)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-blue-200" />
                <span>서류 {stats.phase2SubmittedCount}건 연속 검토 (Major)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendPhase2Alimtalk}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              >
                <Send className="w-3.5 h-3.5 text-blue-200" />
                <span>2차 간편제출 카톡 안내</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSendPhase2Reminder}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-blue-600" />
              <span>서류 제출 리마인더</span>
            </button>
          </div>
        </div>

      </div>


      {/* ── 4. 서류 작업 테이블 (상태 필터 + 기관별 탭 + 정제된 단일 액션) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* 상태 필터 바 */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-bold text-[11px] mr-2 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" /> 상태 필터:
            </span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체 ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('review')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'review' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              검토 대기 ({stats.submittedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('supplement')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'supplement' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              보완 필요 ({stats.supplementCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approved')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                statusFilter === 'approved' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              승인 완료 ({stats.approvedCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowBatchModal(true)}
            className="text-[11px] font-bold text-[#1E3A5F] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3 text-[#1E3A5F]" />
            <span>미제출 묶음 재요청 열기</span>
          </button>
        </div>

        {/* ── 1차 / 부채대행 / 2차 실무 단계 분리 상위 탭 ── */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-1.5 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => { setActivePhaseTab('all'); setActiveAgency('all'); }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activePhaseTab === 'all' 
                ? 'bg-[#1E3A5F] text-white shadow-xs' 
                : 'text-slate-600 hover:bg-white hover:text-slate-900'
            }`}
          >
            <span>전체 서류 ({stats.total})</span>
          </button>
          <button
            type="button"
            onClick={() => { setActivePhaseTab(1); setActiveAgency('all'); }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activePhaseTab === 1 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'text-amber-900 bg-amber-50/80 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>📮 1차 실물 등기 서류 ({stats.phase1ApprovedCount}/{stats.phase1Total}건)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-bold">인감·등본</span>
          </button>
          <button
            type="button"
            onClick={() => { setActivePhaseTab('debt'); setActiveAgency('all'); }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activePhaseTab === 'debt' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>🏛️ 부채증명서 대행 ({debtOrder.items.length}개 기관)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-bold">
              {isDebtDispatched ? `${debtCertElapsedDays}일차` : '작성대기'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setActivePhaseTab(2); setActiveAgency('all'); }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activePhaseTab === 2 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-blue-900 bg-blue-50/80 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>📲 2차 디지털 사본 서류 ({stats.phase2ApprovedCount}/{stats.phase2Total}건)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-bold">모바일 업로드</span>
          </button>
        </div>

        {/* 1차 탭 선택 시 등기 및 인감 안내 배너 */}
        {activePhaseTab === 1 && (
          <div className="px-5 py-3.5 bg-amber-50/90 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-950">
              <Info className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>1차 서류 실무 안내:</strong> 금융기관 부채증명서 대리 발급을 위해 인감도장과 인감증명서는 반드시 <strong>실물 원본</strong>으로 수령해야 합니다. (채권사 <strong>{creditorCount}곳</strong> 기준: <strong>총 {requiredSealCount}부</strong> 필요)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText('서울시 도봉구 마들로 760, 한발법조타워 301호 법률사무소 보광 회생전담팀 앞');
                toast.success('사무소 등기 발송 주소가 클립보드에 복사되었습니다.');
              }}
              className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3 text-amber-700" />
              <span>등기 수령 주소 복사</span>
            </button>
          </div>
        )}

        {/* 부채증명서 탭 선택 시 대행 안내 및 채권사 현황 전용 뷰 */}
        {activePhaseTab === 'debt' && (
          <div className="p-5 space-y-4 bg-slate-50/50">
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="font-extrabold text-sm text-indigo-950 flex items-center gap-2">
                  <span>🏛️ 금융기관 부채증명서 대행 일괄 발주 내역</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 font-bold">
                    대행사: {debtOrder.agencyName}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  대행업체는 모든 채권사 발급이 완료된 후 실물 서류철 봉투로 일괄 반환합니다. (약 3~7영업일 소요)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAgencyAppModalOpen(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>대행 신청서 작성 / 인쇄 / 엑셀 다운로드</span>
                </button>
              </div>
            </div>

            {/* 의뢰 채권기관 목록 테이블 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 text-xs font-black text-slate-700 grid grid-cols-12 gap-2">
                <div className="col-span-1">No</div>
                <div className="col-span-4">금융기관명 (채권사)</div>
                <div className="col-span-3 text-right">예상 채무원금</div>
                <div className="col-span-2 text-right">발급 대행비</div>
                <div className="col-span-2 text-center">발급 상태</div>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {debtOrder.items.map((item, idx) => (
                  <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/80">
                    <div className="col-span-1 font-mono text-slate-400 font-bold">{idx + 1}</div>
                    <div className="col-span-4 font-extrabold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{item.creditorName}</span>
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-slate-800">
                      {item.expectedPrincipal ? `${(item.expectedPrincipal / 10000).toLocaleString()}만원` : '-'}
                    </div>
                    <div className="col-span-2 text-right font-mono text-slate-600">
                      {item.agencyFee ? `${item.agencyFee.toLocaleString()}원` : '15,000원'}
                    </div>
                    <div className="col-span-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        isDebtDispatched
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {isDebtDispatched ? '대행발급중' : '발주대기'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>총 {debtOrder.items.length}개 금융기관 의뢰 (인감증명서 {requiredSealCount}부 동봉)</span>
                <span className="font-mono text-indigo-700">
                  총 대행비용: {(debtOrder.totalAgencyCost || (debtOrder.items.length * 17000)).toLocaleString()}원
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4대 발급처 네비게이션 탭 (전체 또는 2차 탭일 때 유용) */}
        {activePhaseTab !== 1 && activePhaseTab !== 'debt' && (
          <div className="flex border-b border-slate-200 bg-slate-50/40 p-1.5 gap-1 text-xs font-bold overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveAgency('all')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeAgency === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>전체 발급처</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAgency('gov')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeAgency === 'gov' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-emerald-600" />
              <span>주민센터·정부24</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAgency('tax')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeAgency === 'tax' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>국세청·홈택스</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAgency('work')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeAgency === 'work' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              <span>직장·사업장</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAgency('finance')}
              className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeAgency === 'finance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              <span>금융·공공포털</span>
            </button>
          </div>
        )}

        {/* 서류 행 리스트 (activePhaseTab !== 'debt' 일 때만 렌더링) */}
        {activePhaseTab !== 'debt' && (
        <div className="divide-y divide-slate-100">
          {filteredDocs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              해당 조건에 부합하는 서류가 없습니다.
            </div>
          ) : (
            filteredDocs.map((doc) => {
              return (
                <div 
                  key={doc.id}
                  className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      doc.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-700'
                        : doc.status === 'SUBMITTED'
                        ? 'bg-blue-100 text-blue-700 animate-pulse'
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 1차/2차 및 제출방식 뱃지 */}
                        {doc.phase === 1 ? (
                          <span className="text-[10px] px-2 py-0.5 rounded font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                            <Mail className="w-2.5 h-2.5" /> 1차 등기실물
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded font-black bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
                            <Smartphone className="w-2.5 h-2.5" /> 2차 디지털
                          </span>
                        )}

                        <span className="font-extrabold text-xs text-slate-900">{doc.name}</span>

                        {doc.isCreditorMultiplier && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            채권사 {creditorCount}곳 + 5부 = <strong>총 {requiredSealCount}부 필수</strong>
                          </span>
                        )}

                        {doc.isRequired ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-rose-50 text-rose-600 border border-rose-200">
                            필수
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-500">
                            해당자
                          </span>
                        )}
                        {doc.isThirdPartyMaskingRequired && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            제3자 마스킹
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{doc.agency}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-slate-600 truncate">{doc.notes}</span>
                        {doc.supplementReason && (
                          <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            사유: {doc.supplementReason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 상태별 단일 동적 액션 (단색화) */}
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.status === 'APPROVED' && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>수령/승인 완료</span>
                      </span>
                    )}

                    {doc.status === 'SUBMITTED' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (doc.phase === 1) {
                            handleApproveDoc(doc.id);
                            toast.success(`'${doc.name}' 실물 서류 수령이 확인되었습니다.`);
                          } else {
                            setShowSpeedReviewModal(true);
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale shadow-xs"
                      >
                        {doc.phase === 1 ? <Check className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{doc.phase === 1 ? '수령 확인' : '미리보기 & 검토'}</span>
                      </button>
                    )}

                    {doc.status === 'NOT_REQUESTED' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDocList(prev => prev.map(d => d.id === doc.id ? { ...d, status: 'REQUESTED' } : d));
                          toast.success(`'${doc.name}' 요청 상태로 전환되었습니다.`);
                        }}
                        className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        요청하기
                      </button>
                    )}

                    {doc.status === 'SUPPLEMENT_NEEDED' && (
                      <button
                        type="button"
                        onClick={() => {
                          toast.warning(`[보완 알림톡 전송] ${clientRequest.clientName}님께 '${doc.name}' 보완 가이드가 발송되었습니다.`);
                        }}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>보완 재요청</span>
                      </button>
                    )}

                    {doc.status === 'REQUESTED' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-mono">
                          {doc.requestedAt || '요청됨'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            toast.info(`[다시 알림] ${clientRequest.clientName}님께 '${doc.name}' 리마인더가 전송되었습니다.`);
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                          title="고객에게 알림톡 다시 알림"
                        >
                          다시 알림
                        </button>
                      </div>
                    )}

                    {doc.status === 'NOT_REQUESTED' && (
                      <span className="text-[11px] text-slate-400 font-medium px-2 py-1 bg-slate-50 rounded-lg">
                        요청 대기
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        )}
      </div>

      {/* ── 5. 단계 완료 조건 바 (Gatekeeper Bar) ── */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold">Stage 3 완료 조건:</span>
          <span className="text-slate-300">
            필수 서류 승인율 80% 이상 & 검토 대기 0건 ({stats.approvedCount}/{stats.requiredCount}건 완료)
          </span>
        </div>

        {stats.isReadyForStage4 ? (
          <button
            type="button"
            onClick={onAdvanceToNextStage}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>Stage 4 (신청서 작성·접수)로 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (stats.submittedCount > 0) {
                setShowSpeedReviewModal(true);
              } else {
                setShowBatchModal(true);
              }
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>{stats.submittedCount > 0 ? '남은 검토 서류 확인하기' : '미제출 서류 묶음 요청하기'}</span>
          </button>
        )}
      </div>

      {/* 모달 렌더링 */}
      <BatchDocRequestModal
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
          activeLawyerName={clientRequest.assignedLawyerName}
        />
      )}
    </div>
  );
}
