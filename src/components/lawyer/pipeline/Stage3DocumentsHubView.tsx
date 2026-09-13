import React, { useState, useMemo } from 'react';
import { 
  Building2, Home, Briefcase, CreditCard, ShieldCheck, 
  Upload, Eye, CheckCircle2, AlertCircle, Clock, FileText,
  ArrowRight, Camera, RefreshCw, AlertTriangle, Send, 
  ExternalLink, Smartphone, Sparkles, FolderArchive, Check,
  RotateCcw, Filter, FileCheck2
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, DocumentFile } from '../../../types';
import ApplicationDocSettingsModal from '../documents/ApplicationDocSettingsModal';
import MobileApplicationDocHubModal from '../../client/MobileApplicationDocHubModal';
import BatchDocRequestModal, { type BatchDocItem } from './BatchDocRequestModal';
import SpeedDocReviewModal, { type ReviewDocItem } from './SpeedDocReviewModal';
import { addClientNotification } from '../../../services/clientNotificationService';

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
  agency: '주민센터/정부24' | '국세청/홈택스' | '직장/사업장' | '금융기관/공공포털';
  isRequired: boolean;
  notes: string;
  isThirdPartyMaskingRequired?: boolean;
  status: DocLifecycleStatus;
  requestedAt?: string;
  submittedAt?: string;
  approvedAt?: string;
  supplementReason?: string;
}

type AgencyTab = 'all' | 'gov' | 'tax' | 'work' | 'finance' | 'special';
type StatusFilter = 'all' | 'unsubmitted' | 'review' | 'supplement' | 'approved';

export default function Stage3DocumentsHubView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenDocScanner,
  onOpenStatementSyncModal,
}: Stage3DocumentsHubViewProps) {
  const [activeAgency, setActiveAgency] = useState<AgencyTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [thirdPartyMaskingConfirmed, setThirdPartyMaskingConfirmed] = useState(true);

  // 모달 상태
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSpeedReviewModal, setShowSpeedReviewModal] = useState(false);
  const [showMobileHubModal, setShowMobileHubModal] = useState(false);

  // 초기 서류 목록 데이터 (신우법무사 표준 실무 23종)
  const [docList, setDocList] = useState<DocItemModel[]>(() => {
    const uploaded = crmExt?.uploadedFiles || [];
    const initialList: Omit<DocItemModel, 'status'>[] = [
      // 1. 주민센터·정부24
      { id: 'gov-1', name: '주민등록등본', agency: '주민센터/정부24', isRequired: true, notes: '배우자와 세대 분리 시 배우자 등본도 필수 발급', isThirdPartyMaskingRequired: true },
      { id: 'gov-2', name: '주민등록초본', agency: '주민센터/정부24', isRequired: true, notes: '과거 주소 전체, 개명, 주민등록번호 변동사항 포함', isThirdPartyMaskingRequired: false },
      { id: 'gov-3', name: '가족관계증명서(상세)', agency: '주민센터/정부24', isRequired: true, notes: '상세증명서 발급 (신청인 외 가족 뒷자리 마스킹 필수)', isThirdPartyMaskingRequired: true },
      { id: 'gov-4', name: '혼인관계증명서(상세)', agency: '주민센터/정부24', isRequired: true, notes: '미혼인 경우에도 반드시 상세증명서로 발급', isThirdPartyMaskingRequired: true },
      { id: 'gov-5', name: '지방세 세목별 과세증명서', agency: '주민센터/정부24', isRequired: true, notes: '최근 5년 동안, 전국 단위, 모든 세목 표시', isThirdPartyMaskingRequired: false },
      { id: 'gov-6', name: '인감증명서 (본인발급)', agency: '주민센터/정부24', isRequired: false, notes: '부채증명서 대리 발급 의뢰 시 채권자 수 + 3부 필요', isThirdPartyMaskingRequired: false },
      // 2. 국세청·홈택스
      { id: 'tax-1', name: '근로소득세 원천징수영수증', agency: '국세청/홈택스', isRequired: true, notes: '최근 1~2년도 해당분 (급여소득자)', isThirdPartyMaskingRequired: false },
      { id: 'tax-2', name: '소득금액증명원', agency: '국세청/홈택스', isRequired: true, notes: '최근 3년분 발급 (급여/영업 공통)', isThirdPartyMaskingRequired: false },
      { id: 'tax-3', name: '사업자등록증명원 / 폐업사실증명원', agency: '국세청/홈택스', isRequired: false, notes: '개인사업자 또는 과거 5년 내 사업 이력자 필수', isThirdPartyMaskingRequired: false },
      { id: 'tax-4', name: '부가가치세 과세표준증명원', agency: '국세청/홈택스', isRequired: false, notes: '최근 3년분 (영업소득자 필수, 면세사업자는 수입금액증명)', isThirdPartyMaskingRequired: false },
      { id: 'tax-5', name: '납세증명서 및 체납사실증명서', agency: '국세청/홈택스', isRequired: true, notes: '국세 체납 여부 소명 및 우선권 있는 채권 목록화용', isThirdPartyMaskingRequired: false },
      // 3. 직장·사업장
      { id: 'work-1', name: '재직증명서', agency: '직장/사업장', isRequired: true, notes: '현재 직장의 재직 사실 및 직위 확인', isThirdPartyMaskingRequired: false },
      { id: 'work-2', name: '근로계약서 및 급여명세서', agency: '직장/사업장', isRequired: true, notes: '재직 1년 미만인 경우 최근 3~6개월 급여명세서 첨부', isThirdPartyMaskingRequired: false },
      { id: 'work-3', name: '예상퇴직금확인서 (또는 퇴직연금)', agency: '직장/사업장', isRequired: true, notes: '재직 1년 이상 필수 (퇴직금의 1/2이 청산가치 반영)', isThirdPartyMaskingRequired: false },
      // 4. 금융·공공포털
      { id: 'fin-1', name: '금융결제원 계좌정보통합관리(어카운트인포)', agency: '금융기관/공공포털', isRequired: true, notes: '전 은행별 계좌목록 및 상세내역서 (휴면계좌 포함)', isThirdPartyMaskingRequired: false },
      { id: 'fin-2', name: '최근 1년 모든 계좌 거래내역서', agency: '금융기관/공공포털', isRequired: true, notes: '주거래/부거래 통장 1년 입출금 거래내역 (엑셀/PDF)', isThirdPartyMaskingRequired: false },
      { id: 'fin-3', name: '지적전산자료조회결과서 (K-Geo)', agency: '금융기관/공공포털', isRequired: true, notes: '전국 단위 토지 소유현황 (무소유 증명 포함 필수)', isThirdPartyMaskingRequired: false },
      { id: 'fin-4', name: '보험가입조회서 및 해약환급금확인서', agency: '금융기관/공공포털', isRequired: true, notes: '내보험다보여 조회서 + 각 보험사 예상 해약환급금', isThirdPartyMaskingRequired: false },
      { id: 'fin-5', name: '주거지 임대차계약서 (또는 무상거주확인서)', agency: '금융기관/공공포털', isRequired: true, notes: '임차보증금 반환채권 및 우선변제 소액보증금 산정', isThirdPartyMaskingRequired: false },
    ];

    // 기본 시뮬레이션 상태 매핑
    return initialList.map((doc, idx) => {
      const match = uploaded.find(f => f.name.includes(doc.name.slice(0, 3)));
      if (match) {
        return { ...doc, status: 'APPROVED' as DocLifecycleStatus, approvedAt: '2026.09.12' };
      }
      if (idx === 0) return { ...doc, status: 'SUBMITTED' as DocLifecycleStatus, submittedAt: '오늘 16:20' };
      if (idx === 6) return { ...doc, status: 'SUBMITTED' as DocLifecycleStatus, submittedAt: '오늘 16:35' };
      if (idx === 2) return { ...doc, status: 'SUPPLEMENT_NEEDED' as DocLifecycleStatus, supplementReason: '상세증명서가 아닌 일반증명서가 제출됨' };
      if (idx < 5) return { ...doc, status: 'REQUESTED' as DocLifecycleStatus, requestedAt: '오늘 14:20' };
      return { ...doc, status: 'NOT_REQUESTED' as DocLifecycleStatus };
    });
  });

  // 상태별 서류 집계
  const stats = useMemo(() => {
    const total = docList.length;
    const required = docList.filter(d => d.isRequired);
    const approved = docList.filter(d => d.status === 'APPROVED');
    const submitted = docList.filter(d => d.status === 'SUBMITTED');
    const supplement = docList.filter(d => d.status === 'SUPPLEMENT_NEEDED');
    const unsubmitted = docList.filter(d => ['NOT_REQUESTED', 'REQUESTED', 'SUPPLEMENT_NEEDED'].includes(d.status) && d.isRequired);

    return {
      total,
      requiredCount: required.length,
      approvedCount: approved.length,
      submittedCount: submitted.length,
      supplementCount: supplement.length,
      unsubmittedCount: unsubmitted.length,
      progressRate: Math.round((approved.length / required.length) * 100),
      isReadyForStage4: approved.length >= required.length * 0.8 && submitted.length === 0,
    };
  }, [docList]);

  // 필터링된 서류 목록
  const filteredDocs = useMemo(() => {
    return docList.filter(doc => {
      // 발급처 필터
      if (activeAgency === 'gov' && doc.agency !== '주민센터/정부24') return false;
      if (activeAgency === 'tax' && doc.agency !== '국세청/홈택스') return false;
      if (activeAgency === 'work' && doc.agency !== '직장/사업장') return false;
      if (activeAgency === 'finance' && doc.agency !== '금융기관/공공포털') return false;

      // 상태 필터
      if (statusFilter === 'unsubmitted' && doc.status === 'APPROVED') return false;
      if (statusFilter === 'review' && doc.status !== 'SUBMITTED') return false;
      if (statusFilter === 'supplement' && doc.status !== 'SUPPLEMENT_NEEDED') return false;
      if (statusFilter === 'approved' && doc.status !== 'APPROVED') return false;

      return true;
    });
  }, [docList, activeAgency, statusFilter]);

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
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 03 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            4대 발급처 필수서류 {stats.requiredCount}종 수합 및 제3자 마스킹 완비
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 font-medium">승인 진척도:</span>
          <span className="font-mono font-bold text-[#1E3A5F]">
            {stats.approvedCount} / {stats.requiredCount}건 승인 ({stats.progressRate}%)
          </span>
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#1E3A5F] rounded-full transition-all duration-500" 
              style={{ width: `${stats.progressRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card (상황별 단 하나의 핵심 작업 자동 제안) ── */}
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
                    ? '필수 서류 검토가 완료되었습니다. Stage 4(신청서 작성·접수)로 진행하세요.'
                    : `미제출된 필수서류 ${stats.unsubmittedCount}건을 고객에게 묶음 요청하세요.`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {stats.submittedCount > 0 
                  ? '연속 검토 모드를 통해 승인하거나 보완 사유를 고객에게 원클릭 알림톡으로 전송합니다.'
                  : stats.isReadyForStage4
                  ? '8대 법원 서식(D5102, D5103) 결합 및 전자소송 제출 패키징을 생성할 준비가 완료되었습니다.'
                  : '개별 서류마다 카톡을 보내지 않고, 미제출 서류 전체를 모바일 간편 발급함 링크로 한 번에 발송합니다.'}
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
                onClick={() => setShowBatchModal(true)}
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

        {/* 4대 발급처 네비게이션 탭 */}
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
                        <span className="font-extrabold text-xs text-slate-900">{doc.name}</span>
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
                        <span>승인 완료</span>
                      </span>
                    )}

                    {doc.status === 'SUBMITTED' && (
                      <button
                        type="button"
                        onClick={() => setShowSpeedReviewModal(true)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer press-scale shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>미리보기 & 검토</span>
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
        unsubmittedDocs={docList.filter(d => ['NOT_REQUESTED', 'REQUESTED', 'SUPPLEMENT_NEEDED'].includes(d.status)).map(d => ({
          id: d.id,
          name: d.name,
          agency: d.agency,
          isRequired: d.isRequired,
          notes: d.notes,
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
    </div>
  );
}
