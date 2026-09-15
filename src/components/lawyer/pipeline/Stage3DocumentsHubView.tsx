import React, { useState, useMemo } from 'react';
import { 
  Building2, Home, Briefcase, CreditCard, ShieldCheck, 
  Upload, Eye, CheckCircle2, AlertCircle, Clock, FileText,
  ArrowRight, Camera, RefreshCw, AlertTriangle, Send, 
  ExternalLink, Smartphone, Sparkles, FolderArchive, Check,
  RotateCcw, Filter, FileCheck2, Mail, Truck, Stamp, Info, Copy,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, DocumentFile } from '../../../types';
import { 
  ApplicationDocTemplateService, 
  type DocPhase, 
  type SubmissionMethod 
} from '../../../services/documents/applicationDocTemplateService';
import ApplicationDocSettingsModal from '../documents/ApplicationDocSettingsModal';
import MobileApplicationDocHubModal from '../../client/MobileApplicationDocHubModal';
import BatchDocRequestModal, { type BatchDocItem } from './BatchDocRequestModal';
import SpeedDocReviewModal, { type ReviewDocItem } from './SpeedDocReviewModal';
import { sendAlimtok } from '../../../services/alimtokService';
import { addClientNotification } from '../../../services/clientNotificationService';
import CertificateVaultCard from '../vault/CertificateVaultCard';
import DebtAgencyApplicationModal from '../repayment/DebtAgencyApplicationModal';
import { loadDebtCertificateOrder, saveDebtCertificateOrder } from '../../../services/repayment/debtCertificateService';
import type { DebtCertificateOrder } from '../../../services/repayment/repaymentTypes';

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
type PhaseTab = 'all' | 1 | 2;

export default function Stage3DocumentsHubView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenDocScanner,
  onOpenStatementSyncModal,
}: Stage3DocumentsHubViewProps) {
  // 1차/2차 차수별 탭
  const [activePhaseTab, setActivePhaseTab] = useState<PhaseTab>('all');
  const [activeAgency, setActiveAgency] = useState<AgencyTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [thirdPartyMaskingConfirmed, setThirdPartyMaskingConfirmed] = useState(true);

  // 채권자 수 및 인감증명서 부수
  const creditorCount = Number(clientRequest.creditorCount || crmExt?.creditorCount || 5);
  const requiredSealCount = ApplicationDocTemplateService.getRequiredSealCertCount(creditorCount);

  // 1차 실물 등기 및 부채증명서 대행 트랙 상태
  const [postalTrackingNumber, setPostalTrackingNumber] = useState<string>('682910385921');
  const [isSealKeptInSafe, setIsSealKeptInSafe] = useState<boolean>(true);
  const [debtCertTrackStatus, setDebtCertTrackStatus] = useState<'idle' | 'in_progress' | 'completed'>('in_progress');
  const [debtCertElapsedDays, setDebtCertElapsedDays] = useState<number>(3); // 3일차/7일

  // 모달 상태
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPresetPhase, setBatchPresetPhase] = useState<DocPhase | undefined>(undefined);
  const [showSpeedReviewModal, setShowSpeedReviewModal] = useState(false);
  const [showMobileHubModal, setShowMobileHubModal] = useState(false);
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

  // 1차 서류 일괄 수령 완료 처리
  const handleApproveAllPhase1 = () => {
    setDocList(prev => prev.map(d => 
      d.phase === 1 
        ? { ...d, status: 'APPROVED', approvedAt: new Date().toLocaleDateString() } 
        : d
    ));
    setDebtCertTrackStatus('in_progress');
    toast.success('1차 실물 등기 서류 9종이 모두 수령 확인되었습니다. 부채증명서 대행 발급(약 7일)을 개시합니다.');
    
    addClientNotification({
      type: 'document_request',
      title: `[1차 서류 수령완료] ${clientRequest.clientName}님, 보내주신 1차 서류가 도착하여 부채증명서 발급을 시작합니다. 2차 서류를 모바일로 올려주세요.`,
      emoji: '📦',
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
      {/* ── 의뢰인 공동인증서·금융인증서 안전 금고 ── */}
      <CertificateVaultCard
        clientId={clientRequest.id}
        clientRequest={clientRequest}
        crmExt={crmExt}
      />

      {/* ── 2. [실무 핵심] 2-트랙 병렬 진행 대시보드 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Track 1: 1차 실물 등기 & 부채증명서 대행 (약 7일) */}
        <div className={`p-5 rounded-2xl border transition-all ${
          stats.isPhase1Done ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2.5 rounded-xl ${stats.isPhase1Done ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200">
                    Track 1 · 실물 착수
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    1차 서류 & 부채증명서 발급 대행
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  인감도장/인감증명서({requiredSealCount}부) 실물 수령 후 채권 금융기관 일괄 발주
                </p>
              </div>
            </div>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
              stats.isPhase1Done 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {stats.isPhase1Done ? '수령 완료 (대행 진행)' : `${stats.phase1ApprovedCount}/${stats.phase1RequiredCount}건 준비중`}
            </span>
          </div>

          <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Stamp className="w-3.5 h-3.5 text-indigo-600" /> 인감도장 사무소 금고 보관:
              </span>
              <button 
                type="button" 
                onClick={() => setIsSealKeptInSafe(!isSealKeptInSafe)}
                className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                  isSealKeptInSafe ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isSealKeptInSafe ? '보관중 (금고 A-03)' : '미수령'}
              </button>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Mail className="w-3.5 h-3.5 text-slate-500" /> 등기 송장번호:
              </span>
              <span className="font-mono font-bold text-slate-800">{postalTrackingNumber || '미등록'}</span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700">부채증명서 발급 경과 (약 7영업일):</span>
                <span className="font-mono font-bold text-amber-700">{debtCertElapsedDays}일차 / 7일 소요</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((debtCertElapsedDays / 7) * 100))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsAgencyAppModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
              title="대행업체 엑셀 신청서 작성, A4 인쇄 및 엑셀 다운로드"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>대행 신청서 작성 및 인쇄</span>
            </button>
            <button
              type="button"
              onClick={handleApproveAllPhase1}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Check className="w-3.5 h-3.5" />
              <span>1차 실물 9종 일괄 수령확인</span>
            </button>
            <button
              type="button"
              onClick={handleSendPhase1Alimtalk}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-amber-600" />
              <span>1차 빠른등기 요청 카톡</span>
            </button>
          </div>
        </div>

        {/* Track 2: 2차 소득·재산 디지털 서류 (모바일 업로드) */}
        <div className={`p-5 rounded-2xl border transition-all ${
          stats.phase2ProgressRate >= 80 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-blue-50/50 border-blue-200'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-200">
                    Track 2 · 병렬 준비
                  </span>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    2차 소득·재산 디지털 서류
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  부채증명서 발급 7일 동안 통장내역, 소득증빙, 진술서 간편 업로드
                </p>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
              {stats.phase2ApprovedCount} / {stats.phase2RequiredCount}건 승인 ({stats.phase2ProgressRate}%)
            </span>
          </div>

          <div className="mt-4 p-3 bg-white rounded-xl border border-slate-200/80 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>검토 대기중인 업로드 서류:</span>
              <span className="font-mono font-bold text-blue-600">{stats.phase2SubmittedCount}건</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>보완 필요(재업로드 요청) 서류:</span>
              <span className="font-mono font-bold text-amber-600">{stats.supplementCount}건</span>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-700">2차 서류 수합률:</span>
                <span className="font-mono font-bold text-blue-700">{stats.phase2ProgressRate}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${stats.phase2ProgressRate}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSendPhase2Alimtalk}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <Send className="w-3.5 h-3.5 text-blue-200" />
              <span>2차 간편제출 카톡 안내</span>
            </button>
            <button
              type="button"
              onClick={handleSendPhase2Reminder}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>마감 D-2 리마인더</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. Next Action Card & 연속 검토 ── */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xs ${
        stats.submittedCount > 0
          ? 'bg-blue-50/70 border-blue-200/90 text-blue-950'
          : stats.isReadyForStage4
          ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
              stats.submittedCount > 0
                ? 'bg-blue-600 text-white shadow-xs'
                : stats.isReadyForStage4
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[#1E3A5F] text-white shadow-xs'
            }`}>
              {stats.isReadyForStage4 ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : stats.submittedCount > 0 ? (
                <FileCheck2 className="w-5 h-5" />
              ) : (
                <FolderArchive className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-white/80 text-slate-800 border border-slate-200">
                  {stats.submittedCount > 0 ? '지금 해야 할 핵심 작업' : stats.isReadyForStage4 ? '서류 수합 완비' : '서류 요청 단계'}
                </span>
                <span className="text-sm font-black tracking-tight">
                  {stats.submittedCount > 0 
                    ? `제출된 서류 ${stats.submittedCount}건의 제3자 마스킹 및 유효기간을 검토하세요.`
                    : stats.isReadyForStage4
                    ? '1·2차 필수 서류 검토가 완료되었습니다. Stage 4(신청서 작성·접수)로 진행하세요.'
                    : `미제출된 필수서류 ${stats.unsubmittedCount}건을 고객에게 요청하세요.`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {stats.submittedCount > 0 
                  ? '연속 검토 모드를 통해 승인하거나 보완 사유를 고객에게 원클릭 알림톡으로 전송합니다.'
                  : stats.isReadyForStage4
                  ? '부채증명서철과 8대 서식(D5102, D5103)을 결합하여 전자소송 제출 패키징을 생성할 준비가 완료되었습니다.'
                  : '1차 실물 등기 접수 및 2차 디지털 서류 수합을 상황별 원클릭 카카오 알림톡으로 신속히 안내합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {stats.submittedCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowSpeedReviewModal(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4 text-blue-200" />
                <span>서류 {stats.submittedCount}건 연속 검토 시작 (Major)</span>
              </button>
            ) : stats.isReadyForStage4 ? (
              <button
                type="button"
                onClick={onAdvanceToNextStage}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <span>Stage 4 (신청서 작성·접수)로 이동</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBatchPresetPhase(activePhaseTab === 'all' ? undefined : activePhaseTab);
                  setShowBatchModal(true);
                }}
                className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>미제출 서류 {stats.unsubmittedCount}건 한 번에 요청 (Major)</span>
              </button>
            )}

            {onOpenStatementSyncModal && (
              <button
                type="button"
                onClick={onOpenStatementSyncModal}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                title="의뢰인이 작성한 채무증대경위서(진술서) 실시간 확인 및 동기화"
              >
                <span>✍️ 고객 진술서 동기화</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMobileHubModal(true)}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title="의뢰인 모바일 서류함 화면 미리보기"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-600" />
              <span>모바일 서류함 확인</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 제3자 주민번호 마스킹 준칙 배너 ── */}
      <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start justify-between gap-4 text-xs shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold text-sm flex items-center gap-2 text-amber-900">
              <span>개인정보보호 및 법원 제출 기준: 제3자 주민번호 마스킹 준칙</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-200/70 text-amber-900 font-bold">
                보정명령 사전 예방
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed text-[11px]">
              가족관계증명서, 혼인관계증명서, 주민등록등본 제출 시 <strong>신청인 본인을 제외한 가족(배우자, 부모, 자녀 등)의 주민등록번호 뒷자리는 미표기(******)</strong>된 서류를 제출해야 법원 개인정보 보호 지침에 부합합니다.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-amber-300 shadow-2xs shrink-0">
          <input
            type="checkbox"
            checked={thirdPartyMaskingConfirmed}
            onChange={e => setThirdPartyMaskingConfirmed(e.target.checked)}
            className="w-4 h-4 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
          />
          <span className="font-bold text-slate-800 text-xs">제3자 마스킹 원칙 준수</span>
        </label>
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

        {/* ── 1차 / 2차 실무 단계 분리 상위 탭 ── */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 gap-1.5 text-xs font-bold">
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
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/20 font-bold">부채증명서 대행</span>
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

        {/* 4대 발급처 네비게이션 탭 (전체 또는 2차 탭일 때 유용) */}
        {activePhaseTab !== 1 && (
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

        {/* 서류 행 리스트 (산발적 버튼 제거, 상태별 동적 UI 제공) */}
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

      {showMobileHubModal && (
        <MobileApplicationDocHubModal
          isOpen={showMobileHubModal}
          onClose={() => setShowMobileHubModal(false)}
          clientRequest={clientRequest}
        />
      )}

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
