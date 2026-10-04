import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Plus, Trash2, Search, LayoutGrid, List, GripVertical,
  CheckCircle2, ArrowRightLeft, UserPlus, Settings, Filter,
  FileText, Clock, AlertTriangle, X, Star, Download, Upload, RotateCcw, Check,
  Phone, Copy, Edit3, Sparkles, TrendingDown, Scale, Calculator,
  Building2, Home, AlertCircle, Calendar, BadgePercent, Coins, Briefcase,
  ShieldCheck, FileCheck2, ExternalLink, Camera, Eye, Lock, MessageSquare, KeyRound, Cloud, SlidersHorizontal,
  Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import NewCaseModal from './NewCaseModal';
import type { NewCaseData } from './NewCaseModal';
import ImportCasesModal from './ImportCasesModal';
import type { ImportedCase } from './ImportCasesModal';
import ExportCasesModal from './ExportCasesModal';
import DropOffReasonModal from './DropOffReasonModal';
import AssignmentDirectiveModal from './AssignmentDirectiveModal';
import MobileScanner from './MobileScanner';
import FeeNotificationSettingsModal from './FeeNotificationSettingsModal';
import FeeAlimtokModal from './FeeAlimtokModal';
import BulkMessageSendModal from './BulkMessageSendModal';
import CaseBriefingBanner from './CaseBriefingBanner';
import CrmSettingsModal from './CrmSettingsModal';
import { extractBriefingFromClient } from '../../services/leadService';
import { ClientCaseSummarySubTab } from './ClientCaseSummarySubTab';
import { ClientCallsSmsSubTab } from './ClientCallsSmsSubTab';
import { GoogleDriveSettingsModal } from './leads/GoogleDriveSettingsModal';
import ClientContractSubTab from './ClientContractSubTab';
import TaskTicketTab from './TaskTicketTab';
import InternalThreadTab from './InternalThreadTab';
import CourtCaseTab from './CourtCaseTab';
import DebtCertificateTab from './repayment/DebtCertificateTab';
import RepaymentPlanEditor from './repayment/RepaymentPlanEditor';
import ComprehensiveCorrectionCenter from './correction/ComprehensiveCorrectionCenter';
import BatchFilingPackagingModal from './filing/BatchFilingPackagingModal';
import BankruptcyManagementTab from './bankruptcy/BankruptcyManagementTab';
import AncillaryPetitionsModal from './petitions/AncillaryPetitionsModal';
import PostCommencementManagementModal from './postcare/PostCommencementManagementModal';
import LawyerStatementReviewSection from './statement/LawyerStatementReviewSection';
import LegalDocHubModal from './documents/LegalDocHubModal';
import CourtDocSuiteViewerModal, { type DocTabId, formCodeToDocTabId } from './courtDocs/CourtDocSuiteViewerModal';
import CourtFormLibraryModal from './courtDocs/CourtFormLibraryModal';
import IncomeExpenseModal from './repayment/IncomeExpenseModal';
import PropertyValuationModal from './assets/PropertyValuationModal';
import CourtDocumentExportModal from './filing/CourtDocumentExportModal';
import CourtPetitionEditModal from './filing/CourtPetitionEditModal';
import CreditorManagementModal from './filing/CreditorManagementModal';
import CourtFormPreviewModal from './filing/CourtFormPreviewModal';
import ClientStatementSyncModal from './statement/ClientStatementSyncModal';
import ClientIntakeDetailModal from './ClientIntakeDetailModal';
import LitigationPowerOfAttorneyModal from './petitions/LitigationPowerOfAttorneyModal';
import { ContractDocLibraryModal } from './ContractDocLibraryModal';
import { buildRepaymentPlan, rebuildPlanWithAssets } from '../../services/repayment/repaymentCalculationEngine';
import { checkSpecial24Eligibility, special24FromCondition } from '../../services/repayment/rehabLegalCore';
import WorkflowPipelineStepper, { type PipelineStage } from './pipeline/WorkflowPipelineStepper';
import { computePipelineGates, pipelineLockReason, stageForStatus, getJourneyState } from './pipeline/pipelineGates';
import { CaseWorkspaceHeader, JourneyRail, StageHeader, ContextPanel, CaseTimelineModal, StageTransitionModal, StageLockSheet, CaseListView } from './case';
import { getOfficeProfile } from '../../services/lawyer/officeProfile';
import CertificateVaultCard from './vault/CertificateVaultCard';
import { formatVaultDday } from '../../services/vault/certificateVaultService';
import LegalFlowThirteenStepper from './pipeline/LegalFlowThirteenStepper';
import { defaultThirteenStageFor, crmStatusForThirteenStage, thirteenStageAfterStatusChange } from './pipeline/journeyStage';
import { syncDockFromCase, clearDockCaseContext, registerDockCaseHandlers, type DockApplyData } from './quickdock/dockShared';
import { createTask } from '../../services/taskTicketService';
import { STAGE_TEST_REQUEST_IDS } from '../../data';

/**
 * 16개 구형 서브탭을 6단계 수임 여정 파이프라인 단계 및 세부 섹션으로 변환
 * 기획서 4.3 서브탭 16개 재배치 매핑 규칙 준수
 */
function mapSubtabToPipeline(tab: string): {
  stage: PipelineStage;
  section: string;
  openContext?: boolean;
} {
  switch (tab) {
    case 'info':
    case 'summary':
      return { stage: 1, section: 'summary', openContext: true };
    case 'notes':
    case 'calls':
    case 'tasks':
    case 'thread':
      return { stage: 1, section: 'summary', openContext: true };
    case 'timeline':
      return { stage: 1, section: 'summary' };
    case 'fees':
      return { stage: 2, section: 'fees' };
    case 'contracts':
      return { stage: 2, section: 'contract' };
    case 'documents':
    case 'vault':
      return { stage: 3, section: 'docs' };
    case 'debt-certs':
      return { stage: 3, section: 'debt-cert' };
    case 'statement':
      return { stage: 3, section: 'statement' };
    case 'repayment':
    case 'bankruptcy':
      return { stage: 4, section: 'petition' };
    case 'corrections':
      return { stage: 5, section: 'corrections' };
    case 'court':
      return { stage: 5, section: 'court-progress' };
    default:
      return { stage: 1, section: 'summary' };
  }
}

import { isNewRequestForLawyer, requestTypeLabel } from './requestScope';
import DecisionSummaryCard from './pipeline/DecisionSummaryCard';
import Stage1ConsultationView from './pipeline/Stage1ConsultationView';
import Stage2ContractRetainerView from './pipeline/Stage2ContractRetainerView';
import Stage3DocumentsHubView from './pipeline/Stage3DocumentsHubView';
import Stage4FilingBundleView from './pipeline/Stage4FilingBundleView';
import Stage5CorrectionCenterView from './pipeline/Stage5CorrectionCenterView';
import Stage6PostCareDischargeView from './pipeline/Stage6PostCareDischargeView';
import ClientCommunicationSidePanel from './pipeline/ClientCommunicationSidePanel';
import { getContractsByClientId } from '../../services/contractService';
import { validateUploadFile } from '../../utils/fileSecurity';
import { localYmd } from '../../utils/localDate';
import { inspectPdfFile } from '../../services/pdfQualityService';
import { applyCourtSubmissionWatermark } from '../../utils/documentWatermark';
import { syncCompanionWithCrmCase } from '../../services/companionService';
import { detectClientIncomeType } from '../../utils/incomeTypeHelper';
import SecureDocumentViewerModal from '../common/SecureDocumentViewerModal';
import PdfPreprocessorModal from '../common/PdfPreprocessorModal';
import type { 
  ConsultRequest, User, StaffMember, StaffRole, CrmStatus, CrmClientExtension,
  CrmNote, CrmNoteCategory, DocumentCheckItem, CrmActivityLog, CrmActivityType,
  ConsultOutcome, NoteReminder, DropOffReason,
  DirectivePriority, AssignmentDirective,
  DocumentReviewStatus, DocumentRequest
} from '../../types';
import { 
  CRM_STATUS_CONFIG, STAFF_ROLE_CONFIG, CRM_NOTE_CATEGORIES, 
  DEFAULT_REHAB_DOCUMENTS, DEFAULT_BANKRUPTCY_DOCUMENTS, DEFAULT_PERMISSIONS, OUTCOME_CONFIG,
  DIRECTIVE_PRIORITY_CONFIG, DOC_REVIEW_STATUS_CONFIG,
  LEGALFLOW_REHAB_STAGES, LEGALFLOW_BANKRUPTCY_STAGES
} from '../../types';
import { 
  loadCrmData, saveCrmClient, loadStaffMembers, saveStaffMember, 
  deleteStaffMember, createActivityLog, createCrmNote, createDefaultCrmExtension,
  softDeleteCrmClient, restoreCrmClient, cleanupRecycleBin, RECYCLE_BIN_RETENTION_DAYS,
  formatPhone, checkDuplicatePhone,
  approveDocument, rejectDocument, requestDocument,
  type CrmDataStore 
} from '../../services/crmService';
import { createEvent as createCalendarEvent } from '../../services/calendarEventService';
import type { FeeInstallment, IntakeChannel, CorrectionOrder, DocumentFile, AlimtokLog, AlimtokMilestone } from '../../types';
import { INTAKE_CHANNEL_CONFIG, DOC_CATEGORY_CONFIG, ALIMTOK_MILESTONE_CONFIG, STATUS_TO_MILESTONE } from '../../types';
import { triggerAlimtokOnStatusChange, loadFeeNotificationSettings, sendAlimtok, feeAmountWon, feeTotalWon } from '../../services/alimtokService';
import { loadNotificationSettings } from '../../services/notificationService';
import { addClientNotification } from '../../services/clientNotificationService';

interface CrmTabProps {
  requests: ConsultRequest[];
  lawyers: User[];
  activeLawyer: User;
  setRequests: React.Dispatch<React.SetStateAction<ConsultRequest[]>>;
  getDisplayPhoneNumber: (r: ConsultRequest) => string;
  getDisplayClientName?: (r: ConsultRequest) => string;
  handleOpenProposalDraft?: (requestId: string) => void;
  setActiveTab?: (tab: string) => void;
  setCopilotPreselectedReqId?: (id: string) => void;
  initialView?: 'leads';
  initialClientId?: string;
  initialDetailTab?: 'info' | 'summary' | 'notes' | 'timeline' | 'calls' | 'tasks' | 'thread' | 'fees' | 'contracts' | 'documents' | 'debt-certs' | 'statement' | 'repayment' | 'bankruptcy' | 'corrections' | 'court' | 'vault';
  /** 딥링크 1회 적용 후 부모 상태 초기화 콜백 (기획서 0-8) */
  onClearInitialTarget?: () => void;
  /** 로그인한 직원 (대표 변호사 본인이면 null) — 권한·작업자 기록에 사용 */
  currentStaff?: StaffMember | null;
  /** 업무·일정 공유 단위 (직원이면 초대한 대표의 ID) */
  firmTenantId?: string;
}

type CrmDetailTab = NonNullable<CrmTabProps['initialDetailTab']>;
type SortField = 'clientName' | 'createdAt' | 'debtTotal' | 'crmStatus' | 'lastActivity' | 'income' | 'reminderCount';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'kanban' | 'leads';

const CRM_STATUSES: CrmStatus[] = ['requested','consulting','contracted','document','filed','commenced','repaying','discharged','cancelled'];

/** 등록 후 48시간 이내 → NEW 뱃지 표시 */
const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;
function isNewCase(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_THRESHOLD_MS;
}
/** 재사용 가능한 NEW 뱃지 */
function NewBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-black tracking-wider text-white bg-rose-500 px-1.5 py-[1px] rounded-md shadow-sm animate-pulse whitespace-nowrap ${className}`}>
      NEW
    </span>
  );
}

/** 만 원 단위 금액을 "1억 2,500만" 형식으로 직관적으로 포맷 */
function formatWonShort(amountManWon: number | undefined): string {
  if (!amountManWon || amountManWon <= 0) return '0원';
  const eok = Math.floor(amountManWon / 10000);
  const remainder = amountManWon % 10000;
  if (eok > 0) {
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만` : `${eok}억`;
  }
  return `${amountManWon.toLocaleString()}만`;
}

/** 사건 구분 뱃지 (개인회생 / 개인파산) — 저장된 유형 기반 (임의 추정 금지) */
function getCaseTypeBadge(r: ConsultRequest, ext?: CrmClientExtension) {
  const caseType = ext?.caseType || (r as any).caseType || (r as any).category;
  const isBankruptcy = caseType === 'bankruptcy' || caseType === 'individual_bankruptcy' || caseType === '개인파산';
  return !isBankruptcy ? (
    <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 whitespace-nowrap">
      개인회생
    </span>
  ) : (
    <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/80 whitespace-nowrap">
      개인파산
    </span>
  );
}

/**
 * crmStatus만 바꾸는 저장에 13단계 동기화를 더한다 (13단계를 직접 지정한 저장은 그대로)
 * 이전: 13단계는 스테퍼에서만 바뀌어, 상태 드롭다운·칸반·일괄 변경 뒤에도 의뢰인 마이페이지 단계가 예전 값으로 남음
 */
function withThirteenStageSync(current: CrmClientExtension, updates: Partial<CrmClientExtension>): Partial<CrmClientExtension> {
  const nextStatus = updates.crmStatus;
  if (!nextStatus || nextStatus === current.crmStatus || 'thirteenStage' in updates) return updates;
  const isBk = current.caseType === 'bankruptcy' || current.caseType === 'individual_bankruptcy';
  const nextStage = thirteenStageAfterStatusChange(current.thirteenStage, nextStatus, isBk);
  return nextStage === current.thirteenStage ? updates : { ...updates, thirteenStage: nextStage };
}

export default function CrmTab({ 
  requests, 
  lawyers, 
  activeLawyer, 
  setRequests, 
  getDisplayPhoneNumber, 
  getDisplayClientName,
  handleOpenProposalDraft, 
  setActiveTab, 
  setCopilotPreselectedReqId, 
  initialView,
  initialClientId,
  initialDetailTab,
  onClearInitialTarget,
  currentStaff = null,
  firmTenantId
}: CrmTabProps) {
  const dialog = useDialog();
  // ── 기본 State ──
  const [crmData, setCrmData] = useState<CrmDataStore>({});
  /** 첫 CRM 데이터 불러오기가 끝났는지 (끝나기 전 자동 저장 금지) */
  const [crmLoaded, setCrmLoaded] = useState(false);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [activeStaff, setActiveStaff] = useState<StaffMember | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView || 'list');
  
  // ── 검색/필터/정렬 ──
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  // ── 페이지네이션 ──
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  
  // ── 선택 ──
  const [selectedId, setSelectedId] = useState(initialClientId || '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // ── 상세 패널 편집 ──
  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<CrmStatus>('requested');
  const [editLawyerId, setEditLawyerId] = useState('');       // legacy (이관 등에서 아직 사용)
  const [editConsultantId, setEditConsultantId] = useState(''); // legacy
  const [editStaffId, setEditStaffId] = useState('');           // legacy
  const [editAssigneeId, setEditAssigneeId] = useState('');     // 통합 담당자
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<CrmNoteCategory>('consult');
  const [newNoteOutcome, setNewNoteOutcome] = useState<import('../../types').ConsultOutcome | ''>('');
  const [showReminder, setShowReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderAction, setReminderAction] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMemo, setReminderMemo] = useState('');
  
  // ── 이관 모달 ──
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  
  // ── 직원 관리 패널 ──
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('CONSULTANT');

  // ── 초민감 서류 보안 뷰어 ──
  const [viewingDoc, setViewingDoc] = useState<DocumentFile | null>(null);
  
  // ── 일괄 작업 ──
  const [bulkStatus, setBulkStatus] = useState<CrmStatus>('consulting');
  const [bulkAssignee, setBulkAssignee] = useState('');

  // ── 활동 탭 ──
  const [detailTab, setDetailTab] = useState<'info' | 'summary' | 'notes' | 'timeline' | 'calls' | 'tasks' | 'thread' | 'fees' | 'contracts' | 'documents' | 'debt-certs' | 'statement' | 'repayment' | 'bankruptcy' | 'corrections' | 'court' | 'vault'>(initialDetailTab || 'info');
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  // ── 6단계 수임 여정 파이프라인 상태 ──
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>(1);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  // 부모가 지정한 서브탭 — [selectedId] 효과가 고객을 고른 뒤 이 값을 적용하고 비운다
  const pendingDetailTabRef = React.useRef<{ clientId: string; tab: CrmDetailTab } | null>(
    initialClientId && initialDetailTab ? { clientId: initialClientId, tab: initialDetailTab } : null
  );

  // ── 리걸플로 벤치마킹 실무 모달 상태 ──
  const [showBatchFilingModal, setShowBatchFilingModal] = useState(false);
  const [showAncillaryModal, setShowAncillaryModal] = useState(false);
  const [showPostCareModal, setShowPostCareModal] = useState(false);
  const [showDocHubModal, setShowDocHubModal] = useState(false);
  const [showCourtDocSuite, setShowCourtDocSuite] = useState(false);
  const [courtDocSuiteInitialTab, setCourtDocSuiteInitialTab] = useState<DocTabId>('PETITION_BODY');
  const [showFormLibrary, setShowFormLibrary] = useState(false);
  const [showIncomeExpenseModal, setShowIncomeExpenseModal] = useState(false);
  const [showPropertyValuationModal, setShowPropertyValuationModal] = useState(false);
  const [showCourtDocExportModal, setShowCourtDocExportModal] = useState(false);
  const [showStatementSyncModal, setShowStatementSyncModal] = useState(false);
  const [showPowerOfAttorneyModal, setShowPowerOfAttorneyModal] = useState(false);
  const [showPetitionEditModal, setShowPetitionEditModal] = useState(false);
  const [showCreditorEditModal, setShowCreditorEditModal] = useState(false);
  const [showCourtFormPreviewModal, setShowCourtFormPreviewModal] = useState(false);
  const [courtFormPreviewCode, setCourtFormPreviewCode] = useState('R01');
  const [showContractDocLibraryModal, setShowContractDocLibraryModal] = useState(false);
  const [showFormsDropdown, setShowFormsDropdown] = useState(false);
  // ── 서류 작업 집중 모드 (Wide Workbench): 팩트시트와 소통창 기본 닫힘 ──
  const [isFactSheetOpen, setIsFactSheetOpen] = useState(false);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(true);
  const [showCommPanel, setShowCommPanel] = useState(false);
  const [showFinanceAccordion, setShowFinanceAccordion] = useState(false);
  const [showFeeAccordion, setShowFeeAccordion] = useState(false);
  const [showStatusAccordion, setShowStatusAccordion] = useState(false);
  const [showMetaAccordion, setShowMetaAccordion] = useState(false);
  const [showMoreActionsDropdown, setShowMoreActionsDropdown] = useState(false);

  // 외부(채팅 '고객관리에서 열기'·메모 링크·계약 체결 뒤 이동 등)에서 지정한 고객 ID 및 탭 동기화
  // 16개 서브탭 매핑 규칙에 따라 6단계 파이프라인의 해당 Stage 및 세부 섹션으로 자동 라우팅
  useEffect(() => {
    if (!initialClientId) return;
    setSelectedId(initialClientId);
    setViewMode('list'); // 상세 화면은 리스트 보기에서만 열린다
    if (initialDetailTab) {
      pendingDetailTabRef.current = { clientId: initialClientId, tab: initialDetailTab };
      const { stage, section, openContext } = mapSubtabToPipeline(initialDetailTab);
      setPipelineStage(stage);
      setDetailTab(section as any);
      if (openContext) {
        setIsContextPanelOpen(true);
      }
      if (initialDetailTab === 'timeline') {
        setShowTimelineModal(true);
      }
    }
    // 딥링크 1회 적용 후 부모 상태 초기화 (기획서 0-8)
    if (onClearInitialTarget) {
      onClearInitialTarget();
    }
  }, [initialClientId, initialDetailTab, onClearInitialTarget]);

  const [showBulkMessage, setShowBulkMessage] = useState(false);
  const [bulkFilter, setBulkFilter] = useState<string>('doc_overdue');
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [bulkSendModalConfig, setBulkSendModalConfig] = useState<{
    isOpen: boolean;
    channel: 'alimtok' | 'sms';
  } | null>(null);

  // ── 케이스 관리 확장 (LeadMaster 이식) ──
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDropOffModalOpen, setIsDropOffModalOpen] = useState(false);
  const [isMasterSettingsModalOpen, setIsMasterSettingsModalOpen] = useState(false);
  
  // ── 수임료 자동 발송 및 모달 상태 ──
  const [isFeeSettingsModalOpen, setIsFeeSettingsModalOpen] = useState(false);
  const [feeAlimtokModalConfig, setFeeAlimtokModalConfig] = useState<{ isOpen: boolean; installment?: FeeInstallment; initialMilestone?: AlimtokMilestone }>({ isOpen: false });
  const [dropOffTargetId, setDropOffTargetId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [starFilter, setStarFilter] = useState(false);

  // ── 서류 관리 기능 ──
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showDocRequest, setShowDocRequest] = useState(false);
  const [newDocRequestLabel, setNewDocRequestLabel] = useState('');
  const [newDocRequestDesc, setNewDocRequestDesc] = useState('');
  const [showDocScanner, setShowDocScanner] = useState(false);
  const [showPdfPreprocessor, setShowPdfPreprocessor] = useState(false);
  const [preprocessorTargetDoc, setPreprocessorTargetDoc] = useState<{ name: string; dataUrl: string } | undefined>(undefined);
  // ── 고객 자가진단 전수 상세 팝업 ──
  const [showIntakeDetailModal, setShowIntakeDetailModal] = useState(false);
  // ── 배정 지시 모달 ──
  const [showDirectiveModal, setShowDirectiveModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    clientId: string;
    lawyerId: string;
    consultantId: string;
    staffId: string;
    status: CrmStatus;
  } | null>(null);

  // ── 업그레이드: 스마트 툴바 & 퀵 액션 상태 ──
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const [isDetailFilterOpen, setIsDetailFilterOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [quickStatusMenuId, setQuickStatusMenuId] = useState<string | null>(null);
  const toolsMenuRef = React.useRef<HTMLDivElement>(null);

  // 도구 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePeriodChange = (val: string) => {
    setPeriodFilter(val);
    const now = new Date();
    if (val === 'today') {
      const t = localYmd(now);
      setDateFrom(t);
      setDateTo(t);
    } else if (val === 'week') {
      const d = now.getDay();
      const mon = new Date(now);
      mon.setDate(now.getDate() - (d === 0 ? 6 : d - 1));
      setDateFrom(localYmd(mon));
      setDateTo(localYmd(now));
    } else if (val === 'month') {
      setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
      setDateTo(localYmd(now));
    } else if (val === '3month') {
      const ago = new Date(now);
      ago.setMonth(ago.getMonth() - 3);
      setDateFrom(localYmd(ago));
      setDateTo(localYmd(now));
    } else {
      setDateFrom('');
      setDateTo('');
    }
    setPage(1);
  };

  // ── 초기 로드 ──
  useEffect(() => {
    loadCrmData().then(data => {
      setCrmData(data);
      setCrmLoaded(true);
      // 보관 기간(30일) 지난 휴지통 정리 — 이 브라우저 + 서버(본인 권한 범위)
      cleanupRecycleBin().then(r => {
        const total = Math.max(r.localDeleted, r.serverDeleted);
        if (total > 0) toast.info(`휴지통에서 보관 기간이 지난 ${total}건을 영구 삭제했습니다.`);
        if (r.serverError) console.warn('[CRM] 서버 휴지통 정리 실패:', r.serverError);
      });
    });
    // 작업자 = 로그인한 직원(없으면 대표 변호사 본인)
    // 이전: staff_members에서 아무 사무소의 첫 OWNER 행을 골라 작업자로 쓰고, 없으면 OWNER 행을 자동 생성
    //       → 직원이 로그인해도 대표 권한으로 CRM 전체가 열림
    setActiveStaff(currentStaff || null);
    loadStaffMembers(currentStaff?.invitedBy || activeLawyer.id)
      .then(members => setStaffMembers(members.filter(m => m.status === 'active')))
      .catch(err => {
        console.warn('[CRM] 직원 목록 조회 실패:', err?.message || err);
        setStaffMembers([]);
      });
  }, [activeLawyer.id, currentStaff]);

  // ── 이 변호사(또는 같은 사무소)가 담당·참여 중인 요청만 CRM 대상 ──
  // (이전: requestType === 'open'이면 누구의 요청이든 모든 변호사 CRM·엑셀 내보내기에 포함됨)
  const isMine = useCallback((r: ConsultRequest): boolean => {
    if (!activeLawyer.id) return false;
    const isStageTestCase = STAGE_TEST_REQUEST_IDS.has(r.id);
    const directMatch = isStageTestCase ||
                        r.selectedLawyerIds?.includes(activeLawyer.id) ||
                        r.selectedLawyerId === activeLawyer.id ||
                        r.acceptedLawyerIds?.includes(activeLawyer.id) ||
                        r.assignedLawyerId === activeLawyer.id ||
                        (r as any).createdByLawyerId === activeLawyer.id ||
                        (activeLawyer.email && (r.assignedLawyerEmail === activeLawyer.email || r.selectedLawyerEmails?.includes(activeLawyer.email) || r.selectedLawyerIds?.includes(activeLawyer.email))) ||
                        (r.proposals && r.proposals.some((p: any) => p.lawyerId === activeLawyer.id)) ||
                        // 이 변호사가 CRM에서 직접 등록한 외부 의뢰인
                        (r.id.startsWith('ext-') && Boolean(crmData[r.id]));
    const sameFirmMatch = Boolean(activeLawyer.lawFirmId) && r.selectedLawyerIds?.some(id => {
      const targetLawyer = lawyers.find(l => l.id === id);
      return targetLawyer?.lawFirmId === activeLawyer.lawFirmId;
    });
    return Boolean(directMatch || sameFirmMatch);
  }, [activeLawyer.id, activeLawyer.email, activeLawyer.lawFirmId, lawyers, crmData]);
  const myRequests = useMemo(() => requests.filter(isMine), [requests, isMine]);

  // ── ConsultRequest 상태 → CRM 확장 데이터 자동 동기화 (현재 변호사 관련 요청만) ──
  // CRM 데이터를 불러온 뒤에만 실행 (이전: 첫 렌더의 빈 crmData로 기본값 행을 만들어 서버 행의 메모·서류·활동을 덮어씀)
  useEffect(() => {
    if (!crmLoaded) return;
    requests.forEach(r => {
      if (!isMine(r)) return;

      if (r.status === 'cancelled') {
        const ext = crmData[r.id] || createDefaultCrmExtension(r.id);
        if (ext.crmStatus !== 'cancelled') {
          const updated = { 
            ...ext, 
            // 13단계도 함께 맞춘다 (접수 전이면 비워 의뢰인 화면에 '법원 기각·폐지' 안내가 나가지 않게)
            ...withThirteenStageSync(ext, { crmStatus: 'cancelled' as CrmStatus }),
            lastActivityAt: new Date().toISOString(),
            activities: [
              ...(ext.activities || []),
              {
                id: `act-cancel-${Date.now()}`,
                clientId: r.id,
                actorId: 'system',
                actorName: '시스템',
                actorRole: 'OWNER' as StaffRole,
                type: 'status_change' as CrmActivityType,
                description: '의뢰인이 상담 요청을 취소하였습니다.',
                createdAt: new Date().toISOString(),
              },
            ],
          };
          setCrmData(prev => ({ ...prev, [r.id]: updated }));
          saveCrmClient(r.id, updated);
        }
      }
    });
  }, [requests, crmData, crmLoaded]);

  // ── CRM 확장 데이터 가져오기/생성 ──
  const getCrmExt = useCallback((clientId: string): CrmClientExtension => {
    return crmData[clientId] || createDefaultCrmExtension(clientId);
  }, [crmData]);

  // ── 신규 리드: 이 변호사가 아직 제안서를 보내지 않았고 보낼 수 있는 요청 (대시보드·사이드바 배지와 같은 기준) ──
  // (이전: 상태가 requested/responding일 때만 포함해 비교 상담 중 추가로 요청받은 건이 빠졌고,
  //  공개 요청은 제안서 자리가 찼거나 다른 변호사와 상담을 이어가기로 한 뒤에도 계속 보였다)
  const newLeadRequests = useMemo(
    () => requests.filter(r => isNewRequestForLawyer(r, activeLawyer, lawyers)),
    [requests, activeLawyer, lawyers]
  );

  /** @returns 서버 저장 성공 여부 (실패 시 이 기기에만 저장된 상태) */
  const updateCrmExt = useCallback(async (clientId: string, updates: Partial<CrmClientExtension>): Promise<boolean> => {
    if (!clientId || Object.keys(updates).length === 0) return true;
    const current = getCrmExt(clientId);
    // 상태만 바꾸는 저장이면 13단계도 새 상태에 맞춘다 (상태 변경 핸들러·칸반·일괄 변경·배정·이탈 처리 공통)
    const updated = { ...current, ...withThirteenStageSync(current, updates), lastActivityAt: new Date().toISOString() };
    setCrmData(prev => ({ ...prev, [clientId]: updated }));
    return saveCrmClient(clientId, updated);
  }, [getCrmExt]);

  /** 하위 탭용 저장: 서버 저장 실패 시 오류 안내 후 예외 → 하위 컴포넌트의 '저장 완료' 안내가 뜨지 않게 함 */
  const saveOrThrow = useCallback(async (clientId: string, updates: Partial<CrmClientExtension>): Promise<void> => {
    const ok = await updateCrmExt(clientId, updates);
    if (!ok) {
      toast.error('서버 저장에 실패했습니다. 이 기기에만 임시 저장되었으니 네트워크 확인 후 다시 시도해 주세요.', { id: 'crm-save-error' });
      throw new Error('서버 저장 실패 (이 기기에만 임시 저장됨)');
    }
  }, [updateCrmExt]);

  /** 저장 결과에 따라 성공/실패 토스트 */
  const notifySaved = useCallback((ok: boolean, successMsg: string) => {
    if (ok) toast.success(successMsg);
    else toast.error('서버 저장에 실패했습니다. 이 기기에만 임시 저장되었으니 네트워크 확인 후 다시 시도해 주세요.', { id: 'crm-save-error' });
  }, []);

  // ── 현재 권한 확인 ──
  const currentPermissions = activeStaff?.permissions || DEFAULT_PERMISSIONS.OWNER;

  // ── 필터링 + 정렬 + 페이지네이션 ──
  const filteredRequests = useMemo(() => {
    let result = requests.filter(r => {
      // 현재 변호사에게 관련된 요청만 표시 (지정, 수락, 배정, 제안서 발송 포함)
      if (!isMine(r)) return false;

      const ext = getCrmExt(r.id);

      // ── 휴지통 뷰 분리 ──
      if (showTrash) {
        return !!ext.deletedAt; // 휴지통에서는 삭제된 건만 표시
      } else {
        if (ext.deletedAt) return false; // 일반 뷰에서는 삭제된 건 숨김
      }

      // 검색은 화면에 표시되는 값(계약 전 가명·마스킹 번호) 기준 — 마스킹된 실명·번호로 역검색 불가
      const q = search.trim().toLowerCase();
      const shownPhone = getDisplayPhoneNumber(r);
      const matchSearch = !q ||
        getDisplayClientName(r).toLowerCase().includes(q) ||
        (!shownPhone.includes('*') && shownPhone.replace(/-/g, '').includes(q.replace(/-/g, '')));
      
      const matchStatus = statusFilter === 'all' ||
        (statusFilter === 'consulting' ? ['requested','consulting'].includes(ext.crmStatus) :
         statusFilter === 'contracted' ? ['contracted','document','filed','commenced','repaying'].includes(ext.crmStatus) :
         statusFilter === 'discharged' ? ['discharged','cancelled'].includes(ext.crmStatus) :
         ext.crmStatus === statusFilter);
      
      // 완료 건 숨기기 (전체 보기에서만 적용)
      if (hideCompleted && statusFilter === 'all' && ['discharged','cancelled'].includes(ext.crmStatus)) return false;
      
      if (channelFilter !== 'all') {
        if ((ext.intakeChannel || 'mykim') !== channelFilter) return false;
      }
      
      let matchAssignee = true;
      const effectiveAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || ext.assignedStaffId;
      if (assigneeFilter === 'unassigned') {
        matchAssignee = !effectiveAssignee;
      } else if (assigneeFilter !== 'all') {
        matchAssignee = effectiveAssignee === assigneeFilter;
      }

      // 권한에 따른 필터 (본인 배정 건만)
      if (!currentPermissions.viewAllClients && activeStaff) {
        if (effectiveAssignee !== activeStaff.id) return false;
      }

      // ── 기간 필터 ──
      if (dateFrom) {
        const from = new Date(dateFrom + 'T00:00:00');
        if (new Date(r.createdAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59');
        if (new Date(r.createdAt) > to) return false;
      }

      // ── 즐겨찾기 필터 ──
      if (starFilter && !ext.isStarred) return false;
      
      return matchSearch && matchStatus && matchAssignee;
    });

    // 정렬
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'clientName': cmp = a.clientName.localeCompare(b.clientName); break;
        case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case 'debtTotal': cmp = a.financialProfile.debtTotal - b.financialProfile.debtTotal; break;
        case 'income': cmp = a.financialProfile.income - b.financialProfile.income; break;
        case 'lastActivity': {
          const aActs = getCrmExt(a.id).activities || [];
          const bActs = getCrmExt(b.id).activities || [];
          const aLast = aActs.length > 0 ? new Date(aActs[aActs.length - 1].createdAt).getTime() : new Date(a.createdAt).getTime();
          const bLast = bActs.length > 0 ? new Date(bActs[bActs.length - 1].createdAt).getTime() : new Date(b.createdAt).getTime();
          cmp = aLast - bLast; break;
        }
        case 'reminderCount': {
          const aRem = getCrmExt(a.id).notes.filter(n => n.reminder && !n.reminder.completed).length;
          const bRem = getCrmExt(b.id).notes.filter(n => n.reminder && !n.reminder.completed).length;
          cmp = aRem - bRem; break;
        }
        case 'crmStatus': {
          const ai = CRM_STATUSES.indexOf(getCrmExt(a.id).crmStatus);
          const bi = CRM_STATUSES.indexOf(getCrmExt(b.id).crmStatus);
          cmp = ai - bi; break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [requests, search, statusFilter, hideCompleted, assigneeFilter, channelFilter, sortField, sortDir, getCrmExt, currentPermissions, activeStaff, isMine, showTrash, dateFrom, dateTo, starFilter, getDisplayClientName, getDisplayPhoneNumber]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / perPage));
  const pagedRequests = filteredRequests.slice((page - 1) * perPage, page * perPage);

  // 페이지 범위 벗어나면 리셋
  useEffect(() => { if (page > totalPages) setPage(1); }, [totalPages, page]);

  // ── 선택 변경 시 편집 필드 동기화 ──
  const selectedClient = myRequests.find(r => r.id === selectedId);
  const selectedExt = selectedId ? getCrmExt(selectedId) : null;

  const activeRepaymentPlan = useMemo(() => {
    if (selectedExt?.repaymentPlan) return selectedExt.repaymentPlan;
    return buildRepaymentPlan({
      clientId: selectedId || 'temp',
      clientName: selectedClient?.clientName || '신청인',
      courtName: selectedExt?.courtCase?.courtName || '',
      caseNumber: selectedExt?.courtCase?.caseNumber || '',
      // 시작월: 다음 달(참고값). 소득·가구원 수는 상담 입력값만 사용 (임의 기본값 350만원·2인 제거)
      startYearMonth: (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })(),
      paymentDayOfMonth: 25,
      incomeExpense: {
        incomeType: 'salary',
        monthlyNetIncome: (selectedClient?.financialProfile?.income || 0) * 10000,
        householdSize: (selectedClient?.financialProfile?.dependents || 0) + 1,
        region: 'SEOUL',
        actualHousingExpense: 0,
        actualMedicalExpense: 0,
        numberOfChildren: 0,
        educationExpensePerChild: 0,
        isSpecialEducation: false,
        otherApprovedExpense: 0,
        trusteeType: 'INTERNAL',
      },
      assets: [],
      creditors: [],
      special24Eligible: checkSpecial24Eligibility(special24FromCondition(
        selectedExt?.courtCase?.courtName || '',
        selectedClient?.financialProfile?.age,
        selectedClient?.financialProfile?.specialCondition,
      )).eligible,
    });
  }, [selectedId, selectedClient, selectedExt]);

  useEffect(() => {
    // 부모가 지정한 탭은 그 고객을 고른 이번 한 번만 쓴다 (다른 고객으로 바꾸면 'info')
    const pending = pendingDetailTabRef.current;
    pendingDetailTabRef.current = null;
    if (selectedClient && selectedExt) {
      setEditName(selectedClient.clientName);
      setEditPhone(selectedClient.phone);
      setEditStatus(selectedExt.crmStatus);
      setEditAssigneeId(selectedExt.assigneeId || selectedExt.assignedLawyerId || selectedExt.assignedConsultantId || '');
      setEditLawyerId(selectedExt.assignedLawyerId || '');
      setEditConsultantId(selectedExt.assignedConsultantId || '');
      setEditStaffId(selectedExt.assignedStaffId || '');
      setDetailTab(pending && pending.clientId === selectedId ? pending.tab : 'info');
      // 상태 기반 6단계 파이프라인 단계 자동 동기화 (고객 전환 시)
      setPipelineStage(stageForStatus(selectedExt.crmStatus));
    }
  }, [selectedId]);

  // 같은 고객의 사건 상태가 진행되면 파이프라인도 앞으로만 따라감
  // (이전: 고객을 다시 선택해야만 단계가 갱신됨)
  useEffect(() => {
    if (!selectedExt?.crmStatus) return;
    const target = stageForStatus(selectedExt.crmStatus);
    setPipelineStage(prev => (target > prev ? target : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExt?.crmStatus]);

  // ── 퀵툴 사건 연결: 사건 선택/변경 시 퀵독 프리필 및 액션 핸들러 등록 (Task 2-9) ──
  useEffect(() => {
    if (selectedClient && selectedExt) {
      const clientName = getDisplayClientName ? getDisplayClientName(selectedClient) : selectedClient.clientName;
      // 1. 사건 데이터로 퀵독 공유값 프리필
      syncDockFromCase(
        {
          caseId: selectedClient.id,
          clientName,
          phone: selectedClient.phone,
          caseNumber: selectedExt.courtCase?.caseNumber,
          courtName: selectedExt.courtCase?.courtName,
          tenantId: firmTenantId,
          actorId: activeLawyer.id,
          actorName: activeLawyer.name,
          caseType: selectedExt.caseType,
        },
        selectedClient.financialProfile,
        selectedExt
      );

      // 2. 퀵툴 액션 핸들러 등록
      const unregister = registerDockCaseHandlers({
        onApplyToCase: async (data: DockApplyData) => {
          const currentExt = getCrmExt(selectedClient.id);
          const prevPlan = currentExt.repaymentPlan;
          const updatedPlan: any = {
            ...prevPlan,
            monthlyRepaymentTotal: data.monthlyPay ?? prevPlan?.monthlyRepaymentTotal ?? 0,
            months: data.periodMonths ?? prevPlan?.months ?? 36,
            totalDebt: data.totalDebt ?? prevPlan?.totalDebt ?? (selectedClient.financialProfile?.debtTotal || 0) * 10000,
            totalLiquidationValue: data.liquidationValue ?? prevPlan?.totalLiquidationValue ?? 0,
            totalRepaymentRate: data.repaymentRate ?? prevPlan?.totalRepaymentRate ?? 0,
            totalForgivenAmount: (data.totalDebt && data.monthlyPay && data.periodMonths)
              ? Math.max(0, data.totalDebt - (data.monthlyPay * data.periodMonths))
              : prevPlan?.totalForgivenAmount,
          };
          updateCrmExt(selectedClient.id, {
            ...currentExt,
            repaymentPlan: updatedPlan,
          });
          return true;
        },
        onAddTaskTicket: async (task) => {
          await createTask(firmTenantId || 'default-firm', {
            targetType: 'case',
            targetId: selectedClient.id,
            assignerId: activeLawyer.id,
            assignerName: activeLawyer.name,
            assigneeId: activeLawyer.id,
            assigneeName: activeLawyer.name,
            title: task.title,
            description: task.description,
            priority: (task.priority as any) || 'NORMAL',
            dueDate: task.dueDate || undefined,
          });
          return true;
        },
        onAddMemo: async (text, category = 'consult') => {
          const currentExt = getCrmExt(selectedClient.id);
          const note = createCrmNote(
            category as any,
            text.trim(),
            activeLawyer.id,
            activeLawyer.name
          );
          const updatedNotes = [note, ...(currentExt.notes || [])];
          updateCrmExt(selectedClient.id, {
            ...currentExt,
            notes: updatedNotes,
          });
          return true;
        },
        onOpenAlimtok: () => {
          if (selectedExt.feeSchedule && selectedExt.feeSchedule.length > 0) {
            const firstPending = selectedExt.feeSchedule.find(f => f.status !== 'paid') || selectedExt.feeSchedule[0];
            setFeeAlimtokModalConfig({
              isOpen: true,
              installment: firstPending,
            });
          } else {
            setFeeAlimtokModalConfig({
              isOpen: true,
              installment: {
                id: 'inst-initial',
                round: 1,
                amount: 500000,
                dueDate: localYmd(),
                status: 'pending',
                memo: '착수금 안내',
              },
            });
          }
        },
      });

      return () => {
        unregister();
      };
    } else {
      clearDockCaseContext();
    }
  }, [selectedId, selectedClient, selectedExt, firmTenantId, activeLawyer.id, activeLawyer.name, getDisplayClientName]);

  // CRM 탭 언마운트 시 퀵툴 컨텍스트 해제
  useEffect(() => {
    return () => {
      clearDockCaseContext();
    };
  }, []);

  // ── 단계 전환 확인 시트 및 잠금 안내 시트 상태 (Task 2-3) ──
  const [transitionSheetState, setTransitionSheetState] = useState<{
    isOpen: boolean;
    fromStage: PipelineStage;
    toStage: PipelineStage;
  }>({ isOpen: false, fromStage: 1, toStage: 2 });

  const [lockSheetState, setLockSheetState] = useState<{
    isOpen: boolean;
    targetStage: PipelineStage;
  }>({ isOpen: false, targetStage: 2 });

  const executeStageTransition = (target: PipelineStage) => {
    const prevStage = pipelineStage;
    setPipelineStage(target);
    const defaultSections: Record<PipelineStage, string> = {
      1: 'summary',
      2: 'contract',
      3: 'docs',
      4: 'petition',
      5: 'court-progress',
      6: 'decision-summary',
    };
    setDetailTab((defaultSections[target] || 'summary') as any);

    const STAGE_NAMES: Record<PipelineStage, string> = {
      1: '상담·제안',
      2: '수임 계약',
      3: '서류 준비',
      4: '신청·접수',
      5: '보정·개시',
      6: '변제·면책',
    };

    toast.success(`${target}단계(${STAGE_NAMES[target]})로 이동했습니다.`, {
      duration: 5000,
      action: {
        label: '되돌리기',
        onClick: () => {
          setPipelineStage(prevStage as PipelineStage);
          setDetailTab((defaultSections[prevStage as PipelineStage] || 'summary') as any);
          toast.info(`${prevStage}단계(${STAGE_NAMES[prevStage as PipelineStage]})로 되돌렸습니다.`);
        },
      },
    });
  };

  /** Stage 뷰의 '다음 단계' 버튼 및 레일 클릭 핸들러 (Task 2-3: 확인 시트 및 잠금 안내 시트 연동) */
  const advancePipelineStage = async (target: PipelineStage) => {
    if (!selectedClient) return;
    const gates = computePipelineGates(selectedClient, selectedExt);

    // 1. 잠긴 단계를 열려고 할 때: window.alert 대신 잠금 안내 시트 오픈 (기획서 3.4-4)
    if (gates.locked[target]) {
      setLockSheetState({ isOpen: true, targetStage: target });
      return;
    }

    // 2. 현재 단계보다 전진할 때: 확인 시트(ConfirmSheet) 오픈 (기획서 3.4-3)
    if (target > pipelineStage) {
      setTransitionSheetState({
        isOpen: true,
        fromStage: pipelineStage as PipelineStage,
        toStage: target,
      });
      return;
    }

    // 3. 이전 단계 또는 현재 단계로 이동할 때: 즉시 열람 (기획서 3.4-5)
    executeStageTransition(target);
  };

  // ── 핸들러 ──
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pagedRequests.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pagedRequests.map(r => r.id)));
  };

  const handleSaveClientInfo = () => {
    if (!selectedId || !editName.trim()) return;
    setRequests(prev => prev.map(r => r.id === selectedId ? { ...r, clientName: editName.trim(), phone: editPhone.trim() } : r));
  };

  /** 사건 담당 변호사/직원 전용 사건 유형 전환 (개인회생 <-> 개인파산·면책) */
  const handleSwitchCaseType = async (newType: 'individual_rehab' | 'bankruptcy') => {
    if (!selectedId) return;
    const ext = getCrmExt(selectedId);
    const currentIsBk = ext.caseType === 'bankruptcy' || ext.caseType === 'individual_bankruptcy';
    if ((newType === 'bankruptcy' && currentIsBk) || (newType === 'individual_rehab' && !currentIsBk)) {
      return;
    }

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const targetLabel = newType === 'bankruptcy' ? '개인파산·면책' : '개인회생';
    
    const activity = createActivityLog(
      selectedId,
      actor.id,
      actor.name,
      actor.role,
      'status_change',
      `사건 유형을 [${targetLabel}]으로 전환하였습니다.`
    );

    const updatedActivities = [activity, ...(ext.activities || [])];

    const targetDocs = newType === 'bankruptcy' ? DEFAULT_BANKRUPTCY_DOCUMENTS : DEFAULT_REHAB_DOCUMENTS;
    const existingDocs = ext.documents || [];
    // 진행된 서류(체크되었거나 검토요청/승인된 서류)가 없으면 해당 사건 유형의 표준 서류함으로 자동 전환
    const hasProgress = existingDocs.some(d => d.checked || (d.reviewStatus && d.reviewStatus !== 'not_submitted'));
    let updatedDocuments = existingDocs;
    if (!hasProgress || existingDocs.length === 0) {
      updatedDocuments = targetDocs.map(d => ({ ...d, reviewStatus: 'not_submitted' as DocumentReviewStatus }));
    }

    await updateCrmExt(selectedId, {
      caseType: newType,
      activities: updatedActivities,
      documents: updatedDocuments
    });

    // requests 목록 상태도 동기화
    setRequests(prev => prev.map(r => {
      if (r.id === selectedId) {
        return {
          ...r,
          caseType: newType,
          category: newType === 'bankruptcy' ? 'bankruptcy' : 'rehab',
          caseCategory: newType === 'bankruptcy' ? 'individual_bankruptcy' : 'individual_rehab'
        };
      }
      return r;
    }));

    // 탭 자동 전환
    if (newType === 'bankruptcy' && detailTab === 'repayment') {
      setDetailTab('bankruptcy');
    } else if (newType === 'individual_rehab' && detailTab === 'bankruptcy') {
      setDetailTab('repayment');
    }

    toast.success(`사건 유형이 [${targetLabel}]으로 전환되었습니다.`);
  };

  const handleSaveAssignment = async () => {
    if (!selectedId) return;
    const ext = getCrmExt(selectedId);
    const currentAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || '';

    // 상태 변경 시 2단계 확인 및 선행 조건 검증
    if (editStatus !== ext.crmStatus) {
      const clientReq = requests.find(r => r.id === selectedId);
      const editGates = clientReq ? computePipelineGates(clientReq, ext) : null;

      if (editGates && editGates.locked[2] && !['requested', 'consulting', 'cancelled'].includes(editStatus)) {
        await dialog.alert({
          title: '🔒 선행 단계(제안서 발송) 미완료',
          message: '의뢰인에게 맞춤 제안서를 발송하고 의뢰인이 확인(상담 요청)하기 전에는 사건 상태를 계약/접수 등으로 임의 변경할 수 없습니다.',
          variant: 'warning'
        });
        return;
      }

      const clientName = clientReq?.clientName || '고객';
      const confirmed = await dialog.confirm({
        title: '사건 진행 상태 변경 확인',
        message: `[${clientName}] 의뢰인의 사건 상태를\n"${CRM_STATUS_CONFIG[ext.crmStatus].label}" ➔ "${CRM_STATUS_CONFIG[editStatus].label}"\n(으)로 변경하시겠습니까?\n\n※ 상태 변경 시 파이프라인 단계 및 업무 관리가 즉시 갱신됩니다.`,
        confirmText: '상태 변경 실행',
        cancelText: '취소',
        variant: 'primary'
      });
      if (!confirmed) return;
    }
    
    // 담당자가 변경되었는지 확인
    const assigneeChanged = editAssigneeId !== currentAssignee;
    
    if (assigneeChanged && editAssigneeId) {
      // 담당자 변경 → 배정 지시 모달 팝업
      setPendingAssignment({
        clientId: selectedId,
        lawyerId: editAssigneeId,
        consultantId: '',
        staffId: '',
        status: editStatus,
      });
      setShowDirectiveModal(true);
    } else {
      // 담당자 변경 없음 또는 미배정으로 변경 → 즉시 저장
      await executeAssignment(selectedId, editStatus, editAssigneeId);
    }
  };

  /** 실제 배정 저장 실행 (모달 결과와 무관하게 호출) */
  const executeAssignment = async (
    clientId: string, status: CrmStatus, assigneeId: string,
    directive?: { memo: string; priority: DirectivePriority; deadline?: string }
  ) => {
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(clientId);
    const activities = [...ext.activities];
    
    if (status !== ext.crmStatus) {
      activities.push(createActivityLog(clientId, actor.id, actor.name, actor.role, 'status_change',
        `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[status].label}`));
    }

    // 배정 대상 정보 파악
    const currentAssignee = ext.assigneeId || ext.assignedLawyerId || ext.assignedConsultantId || '';
    const newAssignee = [...lawyers, ...staffMembers].find(l => l.id === assigneeId);
    
    if (assigneeId !== currentAssignee) {
      const desc = directive?.memo
        ? `담당자 배정: ${newAssignee?.name || '미배정'} (지시: ${directive.memo.slice(0, 40)}${directive.memo.length > 40 ? '...' : ''})`
        : `담당자 배정: ${newAssignee?.name || '미배정'}`;
      activities.push(createActivityLog(clientId, actor.id, actor.name, actor.role, 'assigned', desc));
    }

    // 배정 지시(Directive) 생성
    let directives = [...(ext.assignmentDirectives || [])];
    if (directive && newAssignee) {
      const newDirective: AssignmentDirective = {
        id: `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        clientId,
        assigneeId: newAssignee.id,
        assigneeName: newAssignee.name,
        assigneeRole: ('role' in newAssignee ? newAssignee.role : 'LAWYER') as StaffRole,
        assignedById: actor.id,
        assignedByName: actor.name,
        assignedByRole: actor.role,
        memo: directive.memo || undefined,
        priority: directive.priority,
        deadline: directive.deadline,
        createdAt: new Date().toISOString(),
      };
      directives.push(newDirective);
    }

    await updateCrmExt(clientId, {
      crmStatus: status,
      assigneeId: assigneeId || undefined,
      assignedLawyerId: assigneeId || undefined,  // 하위 호환
      activities,
      assignmentDirectives: directives.length > 0 ? directives : undefined,
    });
    toast.success('배정이 저장되었습니다.');
  };

  /** 배정 지시 모달: 지시사항과 함께 배정 */
  const handleDirectiveSubmit = async (data: { memo: string; priority: DirectivePriority; deadline?: string }) => {
    if (!pendingAssignment) return;
    await executeAssignment(pendingAssignment.clientId, pendingAssignment.status, pendingAssignment.lawyerId, data);
    setShowDirectiveModal(false);
    setPendingAssignment(null);
  };

  /** 배정 지시 모달: 메모 없이 배정 */
  const handleDirectiveSkip = async () => {
    if (!pendingAssignment) return;
    await executeAssignment(pendingAssignment.clientId, pendingAssignment.status, pendingAssignment.lawyerId);
    setShowDirectiveModal(false);
    setPendingAssignment(null);
  };

  /** 배정 지시 확인 완료 핸들러 */
  const handleAcknowledgeDirective = async (directiveId: string) => {
    if (!selectedId) return;
    const ext = getCrmExt(selectedId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const directives = (ext.assignmentDirectives || []).map(d =>
      d.id === directiveId ? { ...d, acknowledgedAt: new Date().toISOString(), acknowledgedById: actor.id } : d
    );
    await updateCrmExt(selectedId, { assignmentDirectives: directives });
    toast.success('배정 지시를 확인했습니다.');
  };

  const handleTransfer = async () => {
    if (!selectedId || !transferTargetId) return;
    const ext = getCrmExt(selectedId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const target = [...lawyers, ...staffMembers].find(l => l.id === transferTargetId);
    
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'transferred',
      `사건 이관: ${target?.name || '알 수 없음'} (사유: ${transferReason || '없음'})`
    )];

    await updateCrmExt(selectedId, {
      assigneeId: transferTargetId,
      assignedLawyerId: transferTargetId,  // 하위 호환
      activities,
    });
    setEditAssigneeId(transferTargetId);
    setEditLawyerId(transferTargetId);
    setShowTransferModal(false);
    setTransferTargetId('');
    setTransferReason('');
    toast.success('사건이 이관되었습니다.');
  };

  const handleAddNote = async () => {
    if (!selectedId) return;

    const hasNoteContent = Boolean(newNoteContent.trim());
    const hasReminder = Boolean(showReminder && reminderDate && reminderAction.trim());

    if (!hasNoteContent && !hasReminder) {
      if (showReminder && (!reminderDate || !reminderAction.trim())) {
        toast.error('리마인더 날짜와 액션을 입력해주세요.');
      } else {
        toast.error('메모 내용 또는 리마인더 일정을 입력해주세요.');
      }
      return;
    }

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const selectedReq = requests.find(r => r.id === selectedId);
    const clientName = selectedReq?.clientName || '';

    // Build reminder
    let reminder: NoteReminder | undefined;
    if (hasReminder) {
      const tenantId = activeLawyer.lawFirmId || activeLawyer.id;
      let calEvtId: string | undefined;
      try {
        const calEvt = await createCalendarEvent(tenantId, {
          title: `[🔔] ${clientName} - ${reminderAction.trim()}`,
          date: reminderDate,
          startTime: reminderTime || undefined,
          type: 'deadline',
          visibility: 'personal',
          recurrence: 'none',
          reminder: 'none',
          createdBy: actor.id,
          createdByName: actor.name,
          createdByRole: actor.role as string,
          description: reminderMemo.trim() || undefined,
        });
        calEvtId = calEvt.id;
      } catch (e: any) {
        toast.error(e?.message || '리마인더를 캘린더에 저장하지 못했습니다.');
        return;
      }
      reminder = { 
        date: reminderDate, 
        time: reminderTime || undefined, 
        action: reminderAction.trim(), 
        memo: reminderMemo.trim() || undefined, 
        completed: false, 
        calendarEventId: calEvtId 
      };
    }

    // 메모 내용이 없을 경우 리마인더 액션으로 메모 자동 생성
    const finalContent = hasNoteContent 
      ? newNoteContent.trim() 
      : `[일정/리마인더] ${reminderAction.trim()} (${reminderDate}${reminderTime ? ' ' + reminderTime : ''})${reminderMemo.trim() ? ' - ' + reminderMemo.trim() : ''}`;

    const note = createCrmNote(
      newNoteCategory, finalContent, actor.id, actor.name,
      newNoteOutcome || undefined, reminder
    );
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'note_added',
      `메모 추가 [${CRM_NOTE_CATEGORIES[newNoteCategory].label}]: ${finalContent.slice(0, 30)}...`
    )];
    const ok = await updateCrmExt(selectedId, { notes: [...ext.notes, note], activities });
    notifySaved(ok, hasReminder && hasNoteContent
      ? '상담 메모 및 리마인더 일정이 저장되었습니다.'
      : hasReminder ? '리마인더 일정이 캘린더에 저장되었습니다.' : '상담 메모가 추가되었습니다.');

    setNewNoteContent('');
    setNewNoteOutcome('');
    setShowReminder(false);
    setReminderDate('');
    setReminderAction('');
    setReminderTime('');
    setReminderMemo('');
  };

  /** 소통 패널 등에서 전달된 텍스트를 바로 메모로 저장 (이전: 인자를 무시하고 입력창 상태를 읽어 항상 실패) */
  const handleAddQuickNote = async (text: string, category: CrmNoteCategory = 'consult') => {
    if (!selectedId || !text.trim()) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const note = createCrmNote(category, text.trim(), actor.id, actor.name);
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'note_added',
      `메모 추가 [${CRM_NOTE_CATEGORIES[category]?.label || '일반'}]: ${text.trim().slice(0, 30)}...`
    )];
    const ok = await updateCrmExt(selectedId, { notes: [...ext.notes, note], activities });
    notifySaved(ok, '메모가 추가되었습니다.');
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedId) return;
    const ext = getCrmExt(selectedId);
    const targetNote = ext.notes.find(n => n.id === noteId);
    const hasReminder = Boolean(targetNote?.reminder);

    const confirmed = await dialog.confirm({
      title: hasReminder ? '상담 메모 및 리마인더 삭제' : '상담 메모 삭제',
      message: hasReminder
        ? '해당 상담 메모와 함께 설정된 리마인더 일정을 모두 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.'
        : '해당 상담 메모를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger'
    });
    if (!confirmed) return;

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'note_added',
      `메모 삭제: ${targetNote?.content?.slice(0, 20) || '메모'}`
    )];
    await updateCrmExt(selectedId, { notes: ext.notes.filter(n => n.id !== noteId), activities });
    toast.success('상담 메모가 삭제되었습니다.');
  };

  const handleCompleteReminder = async (noteId: string) => {
    if (!selectedId) return;
    const confirmed = await dialog.confirm({
      title: '리마인더 완료 처리',
      message: '이 리마인더 일정을 완료 처리하시겠습니까?',
      confirmText: '완료 처리',
      variant: 'success'
    });
    if (!confirmed) return;

    const ext = getCrmExt(selectedId);
    const updatedNotes = ext.notes.map(n => n.id === noteId ? { ...n, reminder: { ...n.reminder!, completed: true, completedAt: new Date().toISOString() } } : n);
    await updateCrmExt(selectedId, { notes: updatedNotes });
    toast.success('리마인더가 완료 처리되었습니다.');
  };

  const handleDeleteReminderOnly = async (noteId: string) => {
    if (!selectedId) return;
    const confirmed = await dialog.confirm({
      title: '리마인더 일정 삭제',
      message: '이 메모에 설정된 리마인더 일정만 삭제하시겠습니까?\n(상담 메모 내용은 보존됩니다)',
      confirmText: '일정 삭제',
      variant: 'warning'
    });
    if (!confirmed) return;

    const ext = getCrmExt(selectedId);
    const updatedNotes = ext.notes.map(n => n.id === noteId ? { ...n, reminder: undefined } : n);
    await updateCrmExt(selectedId, { notes: updatedNotes });
    toast.success('리마인더 일정이 삭제되었습니다.');
  };

  const handleToggleDocument = async (docId: string) => {
    if (!selectedId) return;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const ext = getCrmExt(selectedId);
    const docs = ext.documents.map(d => {
      if (d.id === docId) {
        const checked = !d.checked;
        return { 
          ...d, 
          checked, 
          reviewStatus: (checked ? 'approved' : 'not_submitted') as DocumentReviewStatus,
          checkedBy: checked ? actor.name : undefined, 
          checkedAt: checked ? new Date().toISOString() : undefined 
        };
      }
      return d;
    });
    const toggled = docs.find(d => d.id === docId);
    const activities = [...ext.activities, createActivityLog(
      selectedId, actor.id, actor.name, actor.role, 'document_checked',
      `서류 ${toggled?.checked ? '확인(승인)' : '해제(미제출)'}: ${toggled?.label}`
    )];
    await updateCrmExt(selectedId, { documents: docs, activities });
  };

  // (직원 추가·삭제는 '사용자 관리' 탭에서만 — 이전 CRM 내 미사용 직원 추가/삭제 핸들러 제거)

  // ── 일괄 작업 핸들러 ──
  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;

    const confirmed = await dialog.confirm({
      title: '일괄 상태 변경 확인',
      message: `선택하신 ${count}건의 사건 상태를\n"${CRM_STATUS_CONFIG[bulkStatus].label}"(으)로 일괄 변경하시겠습니까?`,
      confirmText: '일괄 변경 실행',
      cancelText: '취소',
      variant: 'primary'
    });
    if (!confirmed) return;

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    for (const id of selectedIds) {
      const ext = getCrmExt(id);
      const activities = [...ext.activities, createActivityLog(
        id, actor.id, actor.name, actor.role, 'status_change',
        `일괄 상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[bulkStatus].label}`
      )];
      await updateCrmExt(id, { crmStatus: bulkStatus, activities });
    }
    setSelectedIds(new Set());
    toast.success(`${count}건 상태 변경 완료`);
  };

  const handleBulkAssign = async () => {
    if (selectedIds.size === 0 || !bulkAssignee) return;
    const count = selectedIds.size;
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const target = [...lawyers, ...staffMembers].find(l => l.id === bulkAssignee);
    for (const id of selectedIds) {
      const ext = getCrmExt(id);
      const activities = [...ext.activities, createActivityLog(
        id, actor.id, actor.name, actor.role, 'assigned',
        `일괄 배정: ${target?.name || '알 수 없음'}`
      )];
      await updateCrmExt(id, { assigneeId: bulkAssignee, assignedLawyerId: bulkAssignee, activities });
    }
    setSelectedIds(new Set());
    toast.success(`${count}건 배정 완료`);
  };

  // ── 칸반 드래그 ──
  const handleKanbanDrop = async (clientId: string, newStatus: CrmStatus) => {
    const ext = getCrmExt(clientId);
    if (ext.crmStatus === newStatus) return;

    const clientReq = requests.find(r => r.id === clientId);
    const dragGates = clientReq ? computePipelineGates(clientReq, ext) : null;

    if (dragGates && dragGates.locked[2] && !['requested', 'consulting', 'cancelled'].includes(newStatus)) {
      await dialog.alert({
        title: '🔒 선행 단계(제안서 발송) 미완료',
        message: '의뢰인에게 맞춤 제안서를 발송하고 의뢰인이 확인(상담 요청)하기 전에는 사건 상태를 계약/접수 등으로 임의 변경할 수 없습니다.',
        variant: 'warning'
      });
      return;
    }

    const clientName = clientReq?.clientName || '고객';
    const confirmed = await dialog.confirm({
      title: '칸반 상태 변경 확인',
      message: `[${clientName}] 의뢰인의 사건 상태를\n"${CRM_STATUS_CONFIG[ext.crmStatus].label}" ➔ "${CRM_STATUS_CONFIG[newStatus].label}"\n(으)로 이동하시겠습니까?`,
      confirmText: '이동 실행',
      cancelText: '취소',
      variant: 'primary'
    });
    if (!confirmed) return;

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const activities = [...ext.activities, createActivityLog(
      clientId, actor.id, actor.name, actor.role, 'status_change',
      `파이프라인 이동: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[newStatus].label}`
    )];
    await updateCrmExt(clientId, { crmStatus: newStatus, activities });
    
    // 알림톡 자동 트리거
    try {
      const notiSettings = loadNotificationSettings();
      if (notiSettings.kakao.autoTrigger) {
        const clientReq = requests.find(r => r.id === clientId);
        if (clientReq) {
          const caseLabel = (clientReq.caseType === 'bankruptcy' || (ext as any).caseType === 'bankruptcy') ? '개인파산' : '개인회생';
          const extraVars: Record<string, string> = { caseType: caseLabel };
          if (ext.courtCase?.caseNumber) extraVars.caseNumber = ext.courtCase.caseNumber;
          const months = (ext as any).repaymentPlan?.months;
          const monthly = (ext as any).repaymentPlan?.monthlyRepaymentTotal;
          if (months) extraVars.duration = String(months);
          if (monthly) extraVars.monthlyPayment = Number(monthly).toLocaleString();
          // 결과를 기다려 사실대로 안내 (이전: 결과 무시·오류 삼킴 → 발송 여부를 알 수 없었음)
          const outcome = await triggerAlimtokOnStatusChange(ext.crmStatus, newStatus, {
            clientId,
            clientName: clientReq.clientName, phone: clientReq.phone,
            firmName: notiSettings.kakao.firmName || getOfficeProfile(activeLawyer.name).firmName || '',
            lawyerName: notiSettings.kakao.lawyerName || activeLawyer.name || '',
            extraVars,
          }, notiSettings.kakao);
          if (outcome.attempted) {
            if (outcome.ok) toast.success(`[${ALIMTOK_MILESTONE_CONFIG[outcome.milestone]?.label}] 자동 알림톡이 접수되었습니다.`);
            else toast.error(`자동 알림톡 미발송: ${outcome.error || '발송 실패'}`);
          } else if ((outcome as any).reason === 'missing_vars') {
            toast.info(`자동 알림톡 미발송: 필요한 정보(${((outcome as any).missing || []).join(', ')})가 사건에 없습니다.`);
          } else if ((outcome as any).reason === 'no_phone') {
            toast.info('자동 알림톡 미발송: 의뢰인 연락처가 없습니다.');
          }
        }
      }
    } catch (e: any) {
      console.error('[자동 알림톡] 오류', e);
      toast.error('자동 알림톡 처리 중 오류가 발생했습니다 (발송되지 않았을 수 있음).');
    }
  };

  // ── 통계 ──
  const stats = useMemo(() => {
    const total = requests.length;
    const byStatus: Record<string, number> = {};
    CRM_STATUSES.forEach(s => byStatus[s] = 0);
    requests.forEach(r => {
      const ext = getCrmExt(r.id);
      byStatus[ext.crmStatus] = (byStatus[ext.crmStatus] || 0) + 1;
    });
    const consulting = (byStatus['consulting'] || 0) + (byStatus['contracted'] || 0);
    const active = (byStatus['document'] || 0) + (byStatus['filed'] || 0) + (byStatus['commenced'] || 0) + (byStatus['repaying'] || 0);
    const thisMonth = requests.filter(r => {
      const d = new Date(r.createdAt);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, consulting, active, thisMonth, byStatus };
  }, [requests, getCrmExt]);

  // ── 담당자 이름 조회 헬퍼 ──
  const getStaffName = (id?: string) => {
    if (!id) return '미배정';
    const found = [...lawyers, ...staffMembers].find(l => l.id === id);
    return found?.name || '알 수 없음';
  };

  const getStaffRoleBadge = (id?: string) => {
    if (!id) return null;
    const staff = staffMembers.find(s => s.id === id);
    if (staff) {
      const cfg = STAFF_ROLE_CONFIG[staff.role];
      return <span className={`text-xs px-1 py-0.5 rounded ${cfg.bgColor} ${cfg.color} font-bold`}>{cfg.label}</span>;
    }
    const lawyer = lawyers.find(l => l.id === id);
    if (lawyer) return <span className="text-xs px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">변호사</span>;
    return null;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    return `${days}일 전`;
  };

  // ── 케이스 관리 핸들러 (LeadMaster 이식) ──

  /** 신규 케이스 등록 핸들러 */
  const handleNewCaseRegister = useCallback((data: NewCaseData) => {
    const newId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRequest: ConsultRequest = {
      id: newId, clientId: newId, clientName: data.clientName, phone: data.phone,
      requestType: 'direct', maxParticipants: 1, status: 'counseling',
      createdAt: new Date().toISOString(), title: `[외부] ${data.clientName} 상담`,
      content: data.channelDetail || '',
      financialProfile: {
        clientName: data.clientName, age: 0, gender: data.gender === '여' ? 'female' : 'male',
        maritalStatus: data.maritalStatus === '기혼' ? 'MARRIED' : data.maritalStatus === '이혼' ? 'DIVORCED' : 'SINGLE',
        dependents: data.childrenCount || 0, minorChildren: data.childrenCount || 0,
        income: data.income || 0, debtTotal: data.debtTotal || 0,
        priorityDebt: 0, assetsTotal: 0, creditorCount: 0,
        jobType: (data.jobTypes?.[0] === '직장인' ? 'SALARIED' : data.jobTypes?.[0] === '개인사업자' ? 'SELF_EMPLOYED' : data.jobTypes?.[0] === '프리랜서' ? 'FREELANCE' : 'UNEMPLOYED') as any,
        companyName: '', companyNameMasked: '', employmentDate: '', residenceRegion: data.region || '',
        workLocation: '', housingType: (data.housingType === '전세' ? 'jeonse' : data.housingType === '월세' ? 'rent' : data.housingType === '자가' ? 'owned' : 'rent') as any,
        housingContractHolder: 'self',
        debtCause: 'LIVING', harassmentLevel: 'NONE',
        debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 },
        legalActions: [], myAssets: 0, spouseAsset: 0, spouseIncome: 0,
        rentalDeposit: data.deposit || 0, depositLoan: 0, rentCost: data.rent || 0,
        medicalCost: 0, educationCost: 0, monthlyFixedExpenses: data.loanMonthlyPay || 0,
        retirementPay: 0, retirementPensionType: 'none', specialCondition: 'none',
        riskFlags: [], clientNotes: [], debts: [], assets: [],
      },
    };
    setRequests(prev => [newRequest, ...prev]);
    const ext = createDefaultCrmExtension(newId);
    ext.crmStatus = data.initialStatus;
    ext.intakeChannel = data.intakeChannel;
    ext.intakeChannelDetail = data.channelDetail;
    ext.isExternalClient = true;
    ext.caseType = data.caseType;
    ext.region = data.region;
    if (data.specialMemo) {
      ext.preInfo = data.specialMemo;
    }
    setCrmData(prev => ({ ...prev, [newId]: ext }));
    setIsNewCaseModalOpen(false);
    saveCrmClient(newId, ext).then(ok => notifySaved(ok, `${data.clientName} 건이 등록되었습니다.`));
  }, [setRequests, notifySaved]);

  /** 대량 업로드 핸들러 */
  const handleBulkImport = useCallback(async (cases: ImportedCase[]) => {
    const saves: Promise<boolean>[] = [];
    // 템플릿의 한글 사건유형 → 내부 코드
    const mapCaseType = (v?: string): CrmClientExtension['caseType'] => {
      const t = (v || '').replace(/\s/g, '');
      if (t.includes('파산')) return 'bankruptcy';
      if (t.includes('회생') || t === 'individual_rehab') return 'individual_rehab';
      return undefined;
    };
    cases.forEach(c => {
      const newId = `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newRequest: ConsultRequest = {
        id: newId, clientId: newId, clientName: c.clientName, phone: c.phone,
        requestType: 'direct', maxParticipants: 1, status: 'counseling',
        createdAt: new Date().toISOString(), title: `[일괄] ${c.clientName} 상담`,
        content: c.specialMemo || '',
        financialProfile: {
          clientName: c.clientName, age: 0, gender: c.gender === '여' ? 'female' : 'male',
          maritalStatus: 'SINGLE', dependents: 0, minorChildren: 0,
          income: c.income || 0, debtTotal: c.debtTotal || 0,
          priorityDebt: 0, assetsTotal: 0, creditorCount: 0, jobType: 'SALARIED' as any,
          companyName: '', companyNameMasked: '', employmentDate: '', residenceRegion: c.region || '',
          workLocation: '', housingType: 'rent', housingContractHolder: 'self',
          debtCause: 'LIVING', harassmentLevel: 'NONE',
          debtTypes: { banks: 0, cards: 0, personals: 0, recentLoans: 0, coinCrypto: 0 },
          legalActions: [], myAssets: 0, spouseAsset: 0, spouseIncome: 0,
          rentalDeposit: 0, depositLoan: 0, rentCost: 0, medicalCost: 0,
          educationCost: 0, monthlyFixedExpenses: 0, retirementPay: 0,
          retirementPensionType: 'none', specialCondition: 'none',
          riskFlags: [], clientNotes: [], debts: [], assets: [],
        },
      };
      setRequests(prev => [newRequest, ...prev]);
      const ext = createDefaultCrmExtension(newId);
      ext.crmStatus = 'requested';
      ext.intakeChannel = c.intakeChannel;
      ext.isExternalClient = true;
      ext.caseType = mapCaseType(c.caseType as any) || ext.caseType;
      ext.region = c.region;
      setCrmData(prev => ({ ...prev, [newId]: ext }));
      saves.push(saveCrmClient(newId, ext));
    });
    setIsImportModalOpen(false);
    const results = await Promise.all(saves);
    const failed = results.filter(ok => !ok).length;
    if (failed === 0) toast.success(`${results.length}건 일괄 등록 완료`);
    else toast.warning(`${results.length}건 중 ${failed}건은 서버 저장에 실패해 이 기기에만 저장되었습니다.`);
  }, [setRequests]);

  /** 이탈 사유 확정 핸들러 */
  const handleDropOffConfirm = useCallback((reason: DropOffReason, detail: string) => {
    if (!dropOffTargetId) return;
    const ext = getCrmExt(dropOffTargetId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const note = createCrmNote('consult', `[이탈 사유] ${reason}${detail ? ` — ${detail}` : ''}`, actor.id, actor.name, 'cancelled');
    const activities = [...ext.activities, createActivityLog(
      dropOffTargetId, actor.id, actor.name, actor.role, 'status_change',
      `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → 의뢰인 취소 (사유: ${reason})`
    )];
    updateCrmExt(dropOffTargetId, {
      crmStatus: 'cancelled', notes: [...ext.notes, note], activities,
      dropOffReason: reason, dropOffDetail: detail,
    }).then(ok => notifySaved(ok, '이탈 사유가 기록되었습니다.'));
    setIsDropOffModalOpen(false);
    setDropOffTargetId('');
  }, [dropOffTargetId, getCrmExt, activeStaff, activeLawyer, updateCrmExt, notifySaved]);

  /** 즐겨찾기 토글 */
  const handleToggleStar = useCallback(async (clientId: string) => {
    const ext = getCrmExt(clientId);
    await updateCrmExt(clientId, { isStarred: !ext.isStarred });
  }, [getCrmExt, updateCrmExt]);

  /** 단일 사건 담당자 변경 */
  const handleChangeAssignee = useCallback(async (clientId: string, staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (!staff) return;
    const ext = getCrmExt(clientId);
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const activities = [...(ext.activities || []), createActivityLog(
      clientId, actor.id, actor.name, actor.role, 'status_change',
      `담당자 변경: ${staff.name} (${STAFF_ROLE_CONFIG[staff.role]?.label || staff.role})`
    )];
    const saved = await updateCrmExt(clientId, {
      assigneeId: staffId,
      assignedLawyerId: staff.role === 'OWNER' || staff.role === 'LAWYER' ? staffId : ext.assignedLawyerId,
      assignedConsultantId: staff.role === 'CONSULTANT' ? staffId : ext.assignedConsultantId,
      assignedStaffId: staff.role === 'PARALEGAL' ? staffId : ext.assignedStaffId,
      activities,
    });
    notifySaved(saved, `${staff.name} 님으로 담당자가 변경되었습니다.`);
  }, [staffMembers, getCrmExt, activeStaff, activeLawyer, updateCrmExt, notifySaved]);

  /** 휴지통 이동 (소프트 삭제) */
  const handleSoftDelete = useCallback(async (clientId: string): Promise<boolean> => {
    const confirmed = await dialog.confirm({
      title: '휴지통 이동',
      message: `해당 고객 사건을 휴지통으로 이동하시겠습니까?\n${RECYCLE_BIN_RETENTION_DAYS}일 안에는 복원할 수 있고, 그 뒤에는 영구 삭제됩니다.`,
      confirmText: '휴지통 이동',
      variant: 'warning'
    });
    if (!confirmed) return false;

    const { serverOk } = await softDeleteCrmClient(clientId);
    setCrmData(prev => prev[clientId]
      ? { ...prev, [clientId]: { ...prev[clientId], deletedAt: new Date().toISOString() } }
      : prev);
    if (serverOk) toast.success('휴지통으로 이동했습니다.');
    else toast.warning('이 브라우저에서만 휴지통으로 이동했습니다. 서버에는 반영되지 않았습니다.');
    return true;
  }, [dialog]);

  /** 휴지통 복원 (삭제 전 진행 단계 유지) */
  const handleRestore = useCallback(async (clientId: string) => {
    const { serverOk } = await restoreCrmClient(clientId);
    setCrmData(prev => {
      if (!prev[clientId]) return prev;
      const { deletedAt: _d, ...rest } = prev[clientId];
      return { ...prev, [clientId]: rest as CrmClientExtension };
    });
    if (serverOk) toast.success('복원했습니다.');
    else toast.warning('이 브라우저에서만 복원했습니다. 서버에는 반영되지 않았습니다.');
  }, []);

  /** 상태 변경 시 cancelled이면 이탈 사유 모달 표시 */
  /** @returns 상태가 실제로 저장되었는지 (취소·차단·실패 시 false) */
  const handleStatusChangeWithDropOff = useCallback(async (clientId: string, newStatus: CrmStatus): Promise<boolean> => {
    if (newStatus === 'cancelled') {
      setDropOffTargetId(clientId);
      setIsDropOffModalOpen(true);
      return false;
    }
    const ext = getCrmExt(clientId);
    if (ext.crmStatus === newStatus) return true;

    // 선행 제안서 발송 검증 (파이프라인 게이트와 같은 산식)
    const clientReq = requests.find(r => r.id === clientId);
    const gates = clientReq ? computePipelineGates(clientReq, ext) : null;
    if (gates && gates.locked[2] && !['requested', 'consulting', 'cancelled'].includes(newStatus)) {
      await dialog.alert({
        title: '🔒 선행 단계(제안서 발송) 미완료',
        message: '의뢰인에게 맞춤 제안서를 발송하고 의뢰인이 확인(상담 요청)하기 전에는 사건 상태를 계약/접수 등으로 임의 변경할 수 없습니다.',
        variant: 'warning'
      });
      return false;
    }

    const clientName = clientReq?.clientName || '고객';
    const confirmed = await dialog.confirm({
      title: '사건 진행 상태 변경 확인',
      message: `[${clientName}] 의뢰인의 사건 상태를\n"${CRM_STATUS_CONFIG[ext.crmStatus].label}" ➔ "${CRM_STATUS_CONFIG[newStatus].label}"\n(으)로 변경하시겠습니까?\n\n※ 상태 변경 시 파이프라인 단계 및 업무 관리가 즉시 갱신됩니다.`,
      confirmText: '상태 변경 실행',
      cancelText: '취소',
      variant: 'primary'
    });
    if (!confirmed) return false;

    // 일반 상태 변경
    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const activities = [...ext.activities, createActivityLog(
      clientId, actor.id, actor.name, actor.role, 'status_change',
      `상태 변경: ${CRM_STATUS_CONFIG[ext.crmStatus].label} → ${CRM_STATUS_CONFIG[newStatus].label}`
    )];
    const saved = await updateCrmExt(clientId, { crmStatus: newStatus, activities });
    notifySaved(saved, `사건 상태가 [${CRM_STATUS_CONFIG[newStatus].label}](으)로 변경되었습니다.`);
    return saved;
  }, [getCrmExt, activeStaff, activeLawyer, updateCrmExt, requests, dialog]);

  // ══════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ── 사건 관리 목록 (개편된 CaseListView: 7열 테이블, 저장된 보기 8단계, 빠른 필터 칩, 1줄 툴바, 6단계 칸반 보드 내장) ── */}
      {!selectedId && (
        <CaseListView
          requests={requests}
          getCrmExt={getCrmExt}
          selectedId={selectedId}
          onSelectCase={(id) => setSelectedId(id)}
          onNewCase={() => setIsNewCaseModalOpen(true)}
          onOpenChat={(client) => {
            if (setActiveTab) setActiveTab('chat');
          }}
          onToggleStar={handleToggleStar}
          onDeleteCase={handleSoftDelete}
          onChangeAssignee={handleChangeAssignee}
          staffMembers={staffMembers}
          currentStaffId={activeStaff?.id || activeLawyer.id}
          onOpenBulkMessage={() => setShowBulkMessage(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onOpenImport={() => setIsImportModalOpen(true)}
          onOpenTrash={() => setShowTrash(true)}
          onOpenSettings={() => setIsMasterSettingsModalOpen(true)}
        />
      )}

      {/* ══════════ 상세 뷰 (풀사이즈) ══════════ */}
      {viewMode === 'list' && selectedId && selectedClient && selectedExt && (() => {
        // DTI 및 가용소득 계산 헬퍼
        const fp = selectedClient.financialProfile;
        const income = fp.income || 0;
        const debtTotal = fp.debtTotal || 0;
        const assetsTotal = fp.assetsTotal || 0;
        const dtiRatio = income > 0 ? (debtTotal / income).toFixed(1) : '-';
        const dtiNum = income > 0 ? debtTotal / income : 0;
        
        // 2026 기준 최저생계비 (중위소득 60%)
        const depCount = fp.dependents || 0;
        const minLivingCost = depCount === 0 ? 133 : depCount === 1 ? 220 : depCount === 2 ? 282 : 343;
        const monthlyDisposable = Math.max(0, income - minLivingCost);
        const termMonths = fp.specialCondition && fp.specialCondition !== 'none' || (fp.age && fp.age < 30) ? 24 : 36;
        const estimatedTotalRepay = monthlyDisposable * termMonths;
        const estimatedDischargeRate = debtTotal > 0 ? Math.max(0, Math.min(95, Math.round(((debtTotal - estimatedTotalRepay) / debtTotal) * 100))) : 0;
        
        // 소득 유형 및 법원 필수 서류 가이드 정보 판별
        const incomeTypeInfo = detectClientIncomeType(fp, selectedExt?.incomeExpenseD5103, selectedClient);

        // 수임료 납부 및 분납 현황 지표 계산
        const feeSchedule = selectedExt?.feeSchedule || [];
        const rawTotalFee = selectedExt?.totalFee || selectedExt?.contractAmount || 0;
        
        let contractTotalWon = 0;
        try {
          const cleanPhone = selectedClient?.phone ? selectedClient.phone.replace(/[^0-9]/g, '') : '';
          const cList = JSON.parse(localStorage.getItem('electronic_contracts') || '[]').filter((c: any) => {
            if (c.clientId === selectedId) return true;
            if (selectedClient?.clientId && (c.clientId === selectedClient.clientId || c.clientRefId === selectedClient.clientId)) return true;
            if (selectedClient?.id && c.clientRefId === selectedClient.id) return true;
            if (cleanPhone && c.clientPhone && c.clientPhone.replace(/[^0-9]/g, '') === cleanPhone) return true;
            return false;
          });
          if (cList.length > 0 && cList[0].totalFee) {
            contractTotalWon = cList[0].totalFee < 10000 ? cList[0].totalFee * 10000 : cList[0].totalFee;
          }
        } catch {}

        // 단위 환산은 공용 헬퍼로 통일 (이전: 이 화면만 100,000 기준 → 5만원 회차가 5억원으로 계산)
        const totalFeeWon = rawTotalFee > 0
          ? feeTotalWon(rawTotalFee)
          : (contractTotalWon > 0 
              ? contractTotalWon 
              : feeSchedule.reduce((sum, f) => sum + feeAmountWon(f), 0)
            );

        const paidSchedule = feeSchedule.filter(f => f.status === 'paid');
        const overdueSchedule = feeSchedule.filter(f => f.status === 'overdue');
        const pendingSchedule = feeSchedule.filter(f => f.status === 'pending');

        const totalPaidWon = feeSchedule.length > 0
          ? paidSchedule.reduce((sum, f) => sum + feeAmountWon(f), 0)
          : feeTotalWon(selectedExt?.totalPaid);

        const unpaidWon = Math.max(0, totalFeeWon - totalPaidWon);
        const paymentRate = totalFeeWon > 0 ? Math.min(100, Math.round((totalPaidWon / totalFeeWon) * 100)) : 0;
        const isFullyPaid = totalFeeWon > 0 && unpaidWon === 0;
        const isOverdue = overdueSchedule.length > 0;
        const nextInst = overdueSchedule[0] || pendingSchedule[0] || null;

        let feeBadgeLabel = '미약정';
        let feeBadgeClass = 'bg-slate-100 text-slate-600 border-slate-200';

        if (totalFeeWon > 0) {
          if (isFullyPaid) {
            feeBadgeLabel = '완납 (100%)';
            feeBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          } else if (isOverdue) {
            feeBadgeLabel = `연체 ${overdueSchedule.length}건`;
            feeBadgeClass = 'bg-rose-50 text-rose-600 border-rose-200';
          } else if (totalPaidWon > 0) {
            feeBadgeLabel = `${paidSchedule.length}/${feeSchedule.length || 1}회 (${paymentRate}%)`;
            feeBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
          } else {
            feeBadgeLabel = '미납 (0%)';
            feeBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
          }
        }

        // 이전/다음 사건 탐색기
        const currentReqIndex = pagedRequests.findIndex(r => r.id === selectedId);
        const prevCaseId = currentReqIndex > 0 ? pagedRequests[currentReqIndex - 1]?.id : undefined;
        const nextCaseId = currentReqIndex >= 0 && currentReqIndex < pagedRequests.length - 1 ? pagedRequests[currentReqIndex + 1]?.id : undefined;

        const isBankruptcyCase = selectedExt.caseType === 'bankruptcy' || selectedExt.caseType === 'individual_bankruptcy';
        const gates = computePipelineGates(selectedClient, selectedExt);
        const journey = getJourneyState(selectedClient, selectedExt, activeLawyer.id);
        const currentStageDetail = journey.stages[pipelineStage as 1 | 2 | 3 | 4 | 5 | 6] || journey.currentStageDetail;

        const assignedLawyerName = lawyers.find(l => l.id === (selectedExt.assigneeId || selectedExt.assignedLawyerId))?.name || 
          staffMembers.find(m => m.id === (selectedExt.assigneeId || selectedExt.assignedStaffId))?.name || 
          '담당 미배정';

        // 단일 주 버튼 (Primary CTA)
        const primaryActionConfig = ((): { label: string; onClick: () => void; disabled?: boolean } => {
          if (pipelineStage === 1) {
            const hasProposal = (selectedClient.proposals || []).length > 0;
            return {
              label: hasProposal ? '다음: 수임 계약 (2단계)' : '다음: 제안서 작성',
              onClick: () => {
                if (!hasProposal && handleOpenProposalDraft) {
                  handleOpenProposalDraft(selectedClient.id);
                } else {
                  advancePipelineStage(2);
                }
              },
            };
          }
          if (pipelineStage === 2) {
            return {
              label: '다음: 서류 준비 (3단계)',
              onClick: () => advancePipelineStage(3),
            };
          }
          if (pipelineStage === 3) {
            return {
              label: '다음: 신청·접수 (4단계)',
              onClick: () => advancePipelineStage(4),
            };
          }
          if (pipelineStage === 4) {
            return {
              label: '다음: 보정·개시 (5단계)',
              onClick: () => advancePipelineStage(5),
            };
          }
          if (pipelineStage === 5) {
            return {
              label: '다음: 변제·면책 (6단계)',
              onClick: () => advancePipelineStage(6),
            };
          }
          return {
            label: '사건 완료 및 종결',
            onClick: () => handleStatusChangeWithDropOff(selectedId, 'discharged'),
          };
        })();

        // 완료 조건 체크리스트 3~5개
        const stageConditions = (() => {
          switch (pipelineStage) {
            case 1:
              return [
                { id: 'c1', label: '기본 재무 정보 수집', isMet: Boolean(fp.income && fp.debtTotal) },
                { id: 'c2', label: '회생·파산 적격 검토', isMet: gates.isConsultCompleted },
                { id: 'c3', label: '솔루션 제안서 발송', isMet: (selectedClient.proposals || []).length > 0 },
              ];
            case 2:
              return [
                { id: 'c1', label: '전자 사건위임계약 체결', isMet: gates.isContractCompleted },
                { id: 'c2', label: '착수금 / 1회차 수납', isMet: totalPaidWon > 0 },
                { id: 'c3', label: '소송위임장 날인 및 보관', isMet: Boolean(selectedExt.isSealKeptInSafe || selectedExt.contractDate) },
              ];
            case 3:
              return [
                { id: 'c1', label: '기본 관공서 서류 수합', isMet: (selectedExt.documents || []).length > 0 },
                { id: 'c2', label: '채권기관별 부채증명서 발급', isMet: (selectedExt.debtCertificateOrders || []).every(o => o.orderStatus === 'completed') },
                { id: 'c3', label: '필수 서류 승인 80% 이상', isMet: gates.isDocCompleted },
              ];
            case 4:
              return [
                { id: 'c1', label: '개시신청서 및 재산·수지표 검토', isMet: Boolean(selectedExt.propertyListD5102 || selectedExt.incomeExpenseD5103) },
                { id: 'c2', label: '의뢰인 최종 제출 동의', isMet: Boolean(selectedExt.courtStatement) },
                { id: 'c3', label: '법원 접수 및 사건번호 채번', isMet: gates.isFilingCompleted },
              ];
            case 5:
              return [
                { id: 'c1', label: '금지·중지명령 인용 확인', isMet: Boolean(selectedExt.courtCase?.caseNumber) },
                { id: 'c2', label: '법원 보정권고/명령 소명서 제출', isMet: !(selectedExt.correctionOrders || []).some(c => c.status === 'pending') },
                { id: 'c3', label: '개시결정 등록 및 가상계좌 확인', isMet: gates.isCommenced },
              ];
            case 6:
              return [
                { id: 'c1', label: '회생위원 가상계좌 1회차 적립', isMet: Boolean(selectedExt.decisionSummary?.virtualAccountNumber) },
                { id: 'c2', label: '채권자집회 참석 및 인가결정', isMet: gates.isCommenced },
                { id: 'c3', label: '변제 완료 및 면책 확정', isMet: gates.isDischarged },
              ];
            default:
              return [];
          }
        })();

        // 단계별 세부 섹션 탭
        const stageSectionTabs = (() => {
          switch (pipelineStage) {
            case 1:
              return [
                { id: 'summary', label: '상담 요약' },
                { id: 'eligibility', label: '적격 검토' },
                { id: 'ai-review', label: 'AI 사건 분석' },
                { id: 'proposal', label: '제안서' },
              ];
            case 2:
              return [
                { id: 'contract', label: '위임계약서' },
                { id: 'fees', label: '수임료·분납' },
                { id: 'court-fees', label: '법원 비용' },
              ];
            case 3:
              return [
                { id: 'docs', label: '발급 서류' },
                { id: 'debt-cert', label: '부채증명서' },
                { id: 'statement', label: '진술서·수지표' },
              ];
            case 4:
              return [
                { id: 'petition', label: '신청 서식' },
                { id: 'ancillary', label: '부수 신청' },
                { id: 'filing', label: '검토·제출' },
              ];
            case 5:
              return [
                { id: 'court-progress', label: '법원 진행' },
                { id: 'corrections', label: '보정 센터' },
                { id: 'decision', label: '결정 등록' },
              ];
            case 6:
              return [
                { id: 'decision-summary', label: '개시결정 요약' },
                { id: 'creditors-meeting', label: '채권자집회·인가' },
                { id: 'repayment', label: '변제 관리' },
                { id: 'discharge', label: '면책' },
              ];
            default:
              return [];
          }
        })();

        return (
          <div className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-sm animate-fadeIn pb-16 lg:pb-0">
            {/* ── 1. 사건 워크스페이스 상단 라이트 헤더 ── */}
            <CaseWorkspaceHeader
              clientRequest={selectedClient}
              crmExt={selectedExt}
              assignedLawyerName={assignedLawyerName}
              onBackToList={() => { setSelectedId(''); setIsEditingName(false); }}
              onPrevCase={prevCaseId ? () => setSelectedId(prevCaseId) : undefined}
              onNextCase={nextCaseId ? () => setSelectedId(nextCaseId) : undefined}
              hasPrevCase={Boolean(prevCaseId)}
              hasNextCase={Boolean(nextCaseId)}
              onOpenChat={() => { if (setActiveTab) setActiveTab('chat'); }}
              primaryAction={primaryActionConfig}
              onSwitchCaseType={handleSwitchCaseType}
              onOpenFormsHub={() => setShowDocHubModal(true)}
              onOpenIntakeDetail={() => setShowIntakeDetailModal(true)}
              onToggleContextPanel={() => setIsContextPanelOpen(!isContextPanelOpen)}
              isContextPanelOpen={isContextPanelOpen}
              onDeleteCase={currentPermissions.deleteClients ? () => handleSoftDelete(selectedId) : undefined}
            />

            {/* ── 2. 6단계 수임 여정 레일 ── */}
            <JourneyRail
              currentStage={pipelineStage as PipelineStage}
              onSelectStage={(stage) => advancePipelineStage(stage)}
              gates={gates}
              isBankruptcy={isBankruptcyCase}
              onOpenDocuments={() => advancePipelineStage(3)}
              onOpenTimeline={() => setShowTimelineModal(true)}
            />

            {/* ── 3. 단계 헤더 (완료 조건 체크리스트 & 섹션 탭) ── */}
            <StageHeader
              stageNumber={pipelineStage}
              stageTitle={currentStageDetail.title}
              stageDescription={currentStageDetail.nextAction}
              conditions={stageConditions}
              progressText={currentStageDetail.progressText}
              progressPercent={currentStageDetail.progressPercent}
              sectionTabs={stageSectionTabs}
              activeSection={detailTab}
              onSelectSection={(secId) => setDetailTab(secId as any)}
            />

            {/* ── 4. 메인 워크스페이스 캔버스 + 우측 컨텍스트 패널 ── */}
            <div className="flex flex-col xl:flex-row min-h-[650px] bg-slate-50/40 relative">
              {/* 중앙 6단계 실무 캔버스 */}
              <div className="flex-1 min-w-0">
                    {pipelineStage === 1 && (
                      <Stage1ConsultationView
                        clientRequest={selectedClient}
                        crmExt={selectedExt}
                        activeLawyer={activeLawyer}
                        onUpdateStatus={(newStatus) => handleStatusChangeWithDropOff(selectedId, newStatus)}
                        onAdvanceToNextStage={() => advancePipelineStage(2)}
                        onSwitchCaseType={handleSwitchCaseType}
                        onOpenProposalDraft={handleOpenProposalDraft ? () => handleOpenProposalDraft(selectedClient.id) : undefined}
                        onNavigateToChat={() => {
                          if (setActiveTab) setActiveTab('chat');
                        }}
                        activeSection={detailTab}
                        onSelectSection={(sec) => setDetailTab(sec as any)}
                        // 시연용 — 개발 환경에서만 연결한다 (운영에서는 의뢰인 동의 없이 연락처 공개 상태로 바꾸게 됨)
                        onSimulateContactShare={!import.meta.env.DEV ? undefined : () => {
                          setRequests(prev => prev.map(r => {
                            if (r.id === selectedId) {
                              return {
                                ...r,
                                contactDisclosureStatus: 'contact_shared',
                                phoneConsultationRequested: true,
                                contactSharedAt: new Date().toISOString(),
                              };
                            }
                            return r;
                          }));
                        }}
                      />
                    )}
                    {pipelineStage === 2 && (
                      <Stage2ContractRetainerView
                        clientRequest={selectedClient}
                        crmExt={selectedExt}
                        activeLawyer={activeLawyer}
                        activeStaff={activeStaff}
                        onUpdateStatus={(newStatus) => handleStatusChangeWithDropOff(selectedId, newStatus)}
                        onAdvanceToNextStage={() => advancePipelineStage(3)}
                        onOpenContractSubTab={() => {
                          setDetailTab('contracts');
                        }}
                        onOpenPowerOfAttorneyModal={() => setShowPowerOfAttorneyModal(true)}
                        onUpdateCrmExt={async (patch) => {
                          await saveOrThrow(selectedId, patch);
                        }}
                        activeSection={detailTab}
                        onSelectSection={(sec) => setDetailTab(sec as any)}
                      />
                    )}
                    {pipelineStage === 3 && (
                      <Stage3DocumentsHubView
                        clientRequest={selectedClient}
                        crmExt={selectedExt}
                        onUpdateCrmExt={async (patch) => {
                          await updateCrmExt(selectedId, patch);
                        }}
                        onAdvanceToNextStage={() => advancePipelineStage(4)}
                        onOpenDocScanner={() => setShowDocScanner(true)}
                        onOpenStatementSyncModal={() => setShowStatementSyncModal(true)}
                        onOpenIncomeExpenseModal={() => setShowIncomeExpenseModal(true)}
                        activeSection={detailTab}
                        onSelectSection={(sec) => setDetailTab(sec as any)}
                      />
                    )}
                    {pipelineStage === 4 && (
                      <Stage4FilingBundleView
                        clientRequest={selectedClient}
                        crmExt={selectedExt}
                        onUpdateStatus={(newStatus) => handleStatusChangeWithDropOff(selectedId, newStatus)}
                        onUpdateCrmExt={async (patch) => {
                          await saveOrThrow(selectedId, patch);
                        }}
                        onAdvanceToNextStage={() => advancePipelineStage(5)}
                        onOpenBatchFilingModal={() => setShowBatchFilingModal(true)}
                        onOpenAncillaryModal={() => setShowAncillaryModal(true)}
                        onOpenCourtDocExportModal={() => setShowCourtDocExportModal(true)}
                        onOpenCourtDocSuite={(formCode) => {
                          setCourtDocSuiteInitialTab(formCode ? formCodeToDocTabId(formCode) : 'PETITION_BODY');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenPropertyValuationModal={() => {
                          setCourtDocSuiteInitialTab('ASSET_LIST');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenIncomeExpenseModal={() => {
                          setCourtDocSuiteInitialTab('INCOME_EXPENSE');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenPetitionEditModal={() => {
                          setCourtDocSuiteInitialTab('PETITION_BODY');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenCreditorEditModal={() => {
                          setCourtDocSuiteInitialTab('CREDITOR_LIST');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenStatementSyncModal={() => {
                          setCourtDocSuiteInitialTab('STATEMENT');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenRepaymentPlanEditor={() => {
                          setCourtDocSuiteInitialTab('REPAYMENT_PLAN');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenPowerOfAttorneyModal={() => {
                          setCourtDocSuiteInitialTab('POWER_OF_ATTORNEY');
                          setShowCourtDocSuite(true);
                        }}
                        onOpenDocScannerModal={() => setShowDocScanner(true)}
                        onOpenCourtFormPreviewModal={(formCode) => {
                          setCourtDocSuiteInitialTab(formCode ? formCodeToDocTabId(formCode) : 'PETITION_BODY');
                          setShowCourtDocSuite(true);
                        }}
                        activeSection={detailTab}
                        onSelectSection={(sec) => setDetailTab(sec as any)}
                      />
                    )}
                    {pipelineStage === 5 && (
                      <Stage5CorrectionCenterView
                        clientRequest={selectedClient}
                        crmExt={selectedExt}
                        onUpdateStatus={(newStatus) => handleStatusChangeWithDropOff(selectedId, newStatus)}
                        onUpdateCrmExt={async (patch) => {
                          await saveOrThrow(selectedId, patch);
                        }}
                        onAdvanceToNextStage={() => advancePipelineStage(6)}
                        onOpenComprehensiveCorrectionModal={() => {
                          setDetailTab('corrections');
                        }}
                        activeSection={detailTab as any}
                        onSelectSection={(sec) => setDetailTab(sec as any)}
                        activeLawyerName={assignedLawyerName}
                      />
                    )}
                      {pipelineStage === 6 && (
                        <Stage6PostCareDischargeView
                          clientRequest={selectedClient}
                          crmExt={selectedExt}
                          onUpdateStatus={(newStatus) => handleStatusChangeWithDropOff(selectedId, newStatus)}
                          onUpdateCrmExt={async (patch) => {
                            await saveOrThrow(selectedId, patch);
                          }}
                          onOpenPostCareModal={() => setShowPostCareModal(true)}
                          activeSection={detailTab as any}
                          onSelectSection={(sec) => setDetailTab(sec as any)}
                          activeLawyerName={assignedLawyerName}
                        />
                      )}
                    </div>

                    {/* 우측 사건 컨텍스트 패널 (의뢰인 팩트시트 + 고객 소통 + 상담 메모 통합) */}
                    <ContextPanel
                      clientRequest={selectedClient}
                      crmExt={selectedExt}
                      activeLawyer={activeLawyer}
                      lawyers={lawyers}
                      staffMembers={staffMembers}
                      isOpen={isContextPanelOpen}
                      mode="docked"
                      onClose={() => setIsContextPanelOpen(false)}
                      onOpenChat={() => { if (setActiveTab) setActiveTab('chat'); }}
                      onOpenFeeTab={() => { advancePipelineStage(2); setDetailTab('fees'); }}
                      onUpdateExt={async (patch) => { await saveOrThrow(selectedId, patch); }}
                    />
                  </div>

                  {/* ── 사건 활동 기록 타임라인 모달 ── */}
                  <CaseTimelineModal
                    isOpen={showTimelineModal}
                    onClose={() => setShowTimelineModal(false)}
                    clientRequest={selectedClient}
                    crmExt={selectedExt}
                  />

                  {/* ── 단계 전환 완료 확인 시트 (Task 2-3) ── */}
                  <StageTransitionModal
                    isOpen={transitionSheetState.isOpen}
                    onClose={() => setTransitionSheetState(prev => ({ ...prev, isOpen: false }))}
                    fromStage={transitionSheetState.fromStage}
                    toStage={transitionSheetState.toStage}
                    clientRequest={selectedClient}
                    crmExt={selectedExt}
                    activeLawyer={activeLawyer}
                    onConfirm={() => executeStageTransition(transitionSheetState.toStage)}
                  />

                  {/* ── 잠긴 단계 선행 조건 안내 시트 (Task 2-3) ── */}
                  <StageLockSheet
                    isOpen={lockSheetState.isOpen}
                    onClose={() => setLockSheetState(prev => ({ ...prev, isOpen: false }))}
                    targetStage={lockSheetState.targetStage}
                    gates={gates}
                    onNavigateToPrerequisite={(stage, sec) => {
                      setPipelineStage(stage);
                      if (sec) setDetailTab(sec as any);
                    }}
                  />

                  {/* ── 모바일 전용 하단 고정 '다음 할 일' 액션 바 (기획서 4.6 & Task 4-6) ── */}
                  <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-lg flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-xs text-slate-500 font-bold block truncate">다음 할 일</span>
                      <span className="text-xs font-black text-slate-900 truncate block">{primaryActionConfig.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={primaryActionConfig.onClick}
                      disabled={primaryActionConfig.disabled}
                      className="shrink-0 bg-[#1E3A5F] hover:bg-[#163152] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {primaryActionConfig.label}
                    </button>
                  </div>
                </div>
            );
          })()}

      {/* ══════════ 신규 리드 뷰 ══════════ */}
      {viewMode === 'leads' && handleOpenProposalDraft && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                📋 신규 상담 요청
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">채무 구조와 소득 진단을 검토한 후 제안서를 작성하세요.</p>
            </div>
            <span className="text-xs bg-brand/10 text-brand px-3 py-1.5 rounded-lg font-bold whitespace-nowrap">
              회생파산 전담팀
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {newLeadRequests
              .map((r, idx) => {
                // 자가진단 전에 요청한 의뢰인도 있어 재무 정보가 비어 있을 수 있다
                const fp = r.financialProfile || ({} as ConsultRequest['financialProfile']);
                const assets = fp.assetsTotal ?? fp.myAssets ?? 0;
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col">
                    {/* 카드 헤더 */}
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          r.requestType === 'direct' ? 'bg-[#1E3A5F] text-white' :
                          r.requestType === 'direct_multi' ? 'bg-slate-800 text-white' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {/* 대시보드·AI 사건 분석과 같은 이름 */}
                          {requestTypeLabel(r.requestType)}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{getDisplayClientName(r)}</span>
                        {isNewCase(r.createdAt) && <NewBadge />}
                      </div>
                      <span className="bg-rose-50 text-rose-600 font-bold text-xs px-2 py-0.5 rounded-md border border-rose-200">제안서 대기</span>
                    </div>

                    {/* 카드 본문 */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-900 line-clamp-1">{r.title}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mt-0.5">{r.content}</p>
                      </div>

                      {/* 핵심 재무 요약 (총채무 / 월소득 / 자산) */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500">총채무</div>
                          <div className="text-sm font-black text-slate-900">{(fp.debtTotal || 0).toLocaleString()}<span className="text-xs font-medium">만</span></div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500">월소득</div>
                          <div className="text-sm font-black text-slate-900">{(fp.income || 0).toLocaleString()}<span className="text-xs font-medium">만</span></div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 text-center">
                          <div className="text-xs text-slate-500">자산</div>
                          <div className="text-sm font-black text-slate-900">{assets.toLocaleString()}<span className="text-xs font-medium">만</span></div>
                        </div>
                      </div>

                      {/* 의뢰인 메모 */}
                      {((fp.clientNotes && fp.clientNotes.length > 0) || fp.clientNote) && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs">
                          <span className="text-xs font-bold text-slate-500 block mb-0.5">📝 의뢰인 메모</span>
                          {fp.clientNotes && fp.clientNotes.length > 0 ? (
                            <div className="text-xs text-slate-700 line-clamp-2">{fp.clientNotes.join(' / ')}</div>
                          ) : (
                            <div className="text-xs text-slate-700 line-clamp-2">{fp.clientNote}</div>
                          )}
                        </div>
                      )}

                      {/* 위험 플래그 */}
                      <div className="flex flex-wrap gap-1 mt-auto pt-1">
                        {fp.specialCondition && fp.specialCondition !== 'none' && (
                          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md font-bold border border-slate-200">
                            ⚡ 특례: {fp.specialCondition === 'basic_recipient' ? '기초수급' : fp.specialCondition === 'severe_disability' ? '중증장애' : fp.specialCondition === 'single_parent' ? '한부모' : fp.specialCondition === 'rent_fraud' ? '전세사기' : '고령자'}
                          </span>
                        )}
                        {(fp.riskFlags || []).map(rf => (
                          <span key={rf} className="bg-rose-50 text-rose-600 text-xs px-2 py-0.5 rounded-md font-bold border border-rose-200">⚠️ {rf}</span>
                        ))}
                      </div>
                    </div>

                    {/* 카드 푸터: 액션 버튼 */}
                    <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => { setSelectedId(r.id); setViewMode('list'); }}
                        className="text-slate-500 hover:text-slate-700 font-bold py-1.5 px-2.5 rounded-lg text-xs transition-all cursor-pointer hover:bg-slate-100 press-scale"
                      >
                        상세 보기
                      </button>
                      <div className="flex gap-2">
                        {setCopilotPreselectedReqId && setActiveTab && (
                          <button
                            onClick={() => { setCopilotPreselectedReqId(r.id); setActiveTab('case-copilot'); }}
                            className="bg-white hover:bg-slate-100 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center gap-1 border border-slate-200 whitespace-nowrap press-scale cursor-pointer"
                          >
                            🔬 AI 분석
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenProposalDraft(r.id)}
                          className="bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold py-2 px-4 rounded-xl text-xs tracking-wide transition-all shadow-xs flex items-center gap-1 whitespace-nowrap press-scale cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          제안서 작성
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* 빈 상태 */}
            {newLeadRequests.length === 0 && (
              <div className="col-span-full bg-white p-10 text-center rounded-2xl border border-slate-200 space-y-2">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm text-slate-700 font-bold">현재 대응할 신규 상담 요청이 없습니다.</p>
                <p className="text-xs text-slate-400">의뢰인이 상담을 요청하면 이곳에 표시됩니다.</p>
                <button onClick={() => setViewMode('list')} className="text-xs text-brand font-bold hover:underline cursor-pointer mt-2">
                  전체 고객 목록 보기 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showBulkMessage && (
        <div className="bg-white border-t border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-800">📢 타겟 메시지 대량 발송</h3>
            <button onClick={() => setShowBulkMessage(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'doc_overdue', label: '서류 3일+ 미제출', emoji: '📋' },
              { key: 'fee_overdue', label: '분납 2회+ 연체', emoji: '💸' },
              { key: 'hearing_month', label: '이달 집회 참석 대상', emoji: '🏛️' },
              { key: 'correction_urgent', label: '보정 기한 임박 (3일 내)', emoji: '⚠️' },
            ].map(f => (
              <button key={f.key} onClick={() => setBulkFilter(f.key)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors press-scale cursor-pointer ${bulkFilter === f.key ? 'bg-brand/10 border-brand/30 text-brand' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
          {(() => {
            const bulkFilteredClients = requests.filter(r => {
              const ext = getCrmExt(r.id);
              if (bulkFilter === 'doc_overdue') return ext.documents?.some((d: any) => !d.checked);
              if (bulkFilter === 'fee_overdue') return (ext.feeSchedule || []).filter((f: any) => f.status === 'overdue').length >= 2;
              if (bulkFilter === 'hearing_month') return String((ext as any).postCommencementPlan?.meetingPlan?.meetingDate || '').startsWith(localYmd().slice(0, 7));
              if (bulkFilter === 'correction_urgent') return (ext.correctionOrders || []).some((c: any) => c.status === 'pending');
              return false;
            }).map(r => ({
              id: r.id,
              clientName: r.clientName || '의뢰인',
              phone: r.phone || '',
              subText: (r.financialProfile?.debtTotal || (r as any).debtTotal) ? `${r.financialProfile?.debtTotal || (r as any).debtTotal}만원` : undefined
            }));

            return (
              <>
                <div className="bg-slate-50 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">
                    발송 대상 의뢰인: <span className="font-black text-sm text-slate-800">{bulkFilteredClients.length}명</span>
                  </p>
                  <span className="text-xs text-slate-400">
                    {bulkFilteredClients.slice(0, 3).map(c => c.clientName).join(', ')}
                    {bulkFilteredClients.length > 3 ? ` 외 ${bulkFilteredClients.length - 3}명` : ''}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (bulkFilteredClients.length === 0) {
                        toast.info('발송 대상 의뢰인이 없습니다.');
                        return;
                      }
                      setBulkSendModalConfig({ isOpen: true, channel: 'alimtok' });
                    }} 
                    className="flex-1 py-2.5 text-xs font-bold text-[#391B1B] bg-[#FAE100] hover:bg-[#F4D700] rounded-xl transition-colors press-scale whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    💬 카카오 알림톡 발송 ({bulkFilteredClients.length}명)
                  </button>
                  <button 
                    onClick={() => {
                      if (bulkFilteredClients.length === 0) {
                        toast.info('발송 대상 의뢰인이 없습니다.');
                        return;
                      }
                      setBulkSendModalConfig({ isOpen: true, channel: 'sms' });
                    }} 
                    className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors press-scale whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    📱 SMS 발송 ({bulkFilteredClients.length}명)
                  </button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── 케이스 관리 모달 ── */}
      <NewCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onRegister={handleNewCaseRegister}
        existingRequests={myRequests}
      />
      <ImportCasesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleBulkImport}
        existingRequests={myRequests}
      />
      <ExportCasesModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        requests={filteredRequests}
        getCrmExt={getCrmExt}
        getDisplayClientName={getDisplayClientName}
        getDisplayPhoneNumber={getDisplayPhoneNumber}
      />
      <CrmSettingsModal
        isOpen={isMasterSettingsModalOpen}
        onClose={() => setIsMasterSettingsModalOpen(false)}
      />
      <DropOffReasonModal
        isOpen={isDropOffModalOpen}
        onClose={() => { setIsDropOffModalOpen(false); setDropOffTargetId(''); }}
        clientName={requests.find(r => r.id === dropOffTargetId)?.clientName || ''}
        onConfirm={handleDropOffConfirm}
      />

      {/* ── 배정 지시 모달 ── */}
      <AssignmentDirectiveModal
        isOpen={showDirectiveModal}
        onClose={() => { setShowDirectiveModal(false); setPendingAssignment(null); }}
        onSkip={handleDirectiveSkip}
        onSubmit={handleDirectiveSubmit}
        assigneeName={(() => {
          if (!pendingAssignment) return '';
          return [...lawyers, ...staffMembers].find(l => l.id === pendingAssignment.lawyerId)?.name || '';
        })()}
        assigneeRole={(() => {
          if (!pendingAssignment) return 'STAFF';
          const found = staffMembers.find(m => m.id === pendingAssignment.lawyerId);
          return found?.role || 'LAWYER';
        })()}
        clientName={requests.find(r => r.id === pendingAssignment?.clientId)?.clientName || ''}
      />

      {/* ── 수임료 관리 모달 ── */}
      <FeeNotificationSettingsModal
        isOpen={isFeeSettingsModalOpen}
        onClose={() => setIsFeeSettingsModalOpen(false)}
      />
      
      {feeAlimtokModalConfig.isOpen && selectedClient && selectedExt && feeAlimtokModalConfig.installment && (
        <FeeAlimtokModal
          isOpen={true}
          onClose={() => setFeeAlimtokModalConfig({ isOpen: false })}
          client={selectedClient}
          installment={feeAlimtokModalConfig.installment}
          totalFeeWon={feeTotalWon(selectedExt.totalFee || selectedExt.contractAmount)}
          totalPaidWon={(selectedExt.feeSchedule || []).filter(f => f.status === 'paid').reduce((sum, f) => sum + feeAmountWon(f), 0)}
          firmName={activeLawyer.firmName || (activeLawyer as any).firm || ''}
          lawyerName={activeLawyer.name}
          initialMilestone={feeAlimtokModalConfig.initialMilestone}
          onSent={(milestone) => {
             // 알림 기록 업데이트
             const latestExt = getCrmExt(selectedClient.id);
             const updated = {
               ...latestExt,
               feeSchedule: (latestExt.feeSchedule || []).map(f => f.id === feeAlimtokModalConfig.installment?.id ? {
                 ...f,
                 lastNotifiedAt: new Date().toISOString(),
                 lastNotifiedType: milestone
               } : f)
             };
             updateCrmExt(selectedClient.id, updated);
          }}
        />
      )}

      {/* ── 타겟 대량 메시지 발송 사전 확인 & 미리보기 모달 ── */}
      {bulkSendModalConfig && (
        <BulkMessageSendModal
          isOpen={bulkSendModalConfig.isOpen}
          onClose={() => setBulkSendModalConfig(null)}
          channel={bulkSendModalConfig.channel}
          filterKey={bulkFilter}
          filterLabel={
            bulkFilter === 'doc_overdue' ? '서류 3일+ 미제출 의뢰인' :
            bulkFilter === 'fee_overdue' ? '분납 2회+ 연체 의뢰인' :
            bulkFilter === 'hearing_month' ? '이달 채권자집회 참석 대상자' :
            bulkFilter === 'correction_urgent' ? '법원 보정 기한 임박 (3일 내) 의뢰인' :
            '타겟 의뢰인 세그먼트'
          }
          targetClients={requests.filter(r => {
            const ext = getCrmExt(r.id);
            if (bulkFilter === 'doc_overdue') return ext.documents?.some((d: any) => !d.checked);
            if (bulkFilter === 'fee_overdue') return (ext.feeSchedule || []).filter((f: any) => f.status === 'overdue').length >= 2;
            if (bulkFilter === 'hearing_month') return String((ext as any).postCommencementPlan?.meetingPlan?.meetingDate || '').startsWith(localYmd().slice(0, 7));
            if (bulkFilter === 'correction_urgent') return (ext.correctionOrders || []).some((c: any) => c.status === 'pending');
            return false;
          }).map(r => ({
            id: r.id,
            clientName: r.clientName || '의뢰인',
            phone: r.phone || '',
            subText: (r.financialProfile?.debtTotal || (r as any).debtTotal) ? `${r.financialProfile?.debtTotal || (r as any).debtTotal}만원` : undefined
          }))}
          firmName={activeLawyer.firmName || '법무법인'}
          lawyerName={activeLawyer.name || '담당 변호사'}
          onConfirmSend={async (message, channel) => {
            const targets = requests.filter(r => {
              const ext = getCrmExt(r.id);
              if (bulkFilter === 'doc_overdue') return ext.documents?.some((d: any) => !d.checked);
              if (bulkFilter === 'fee_overdue') return (ext.feeSchedule || []).filter((f: any) => f.status === 'overdue').length >= 2;
              if (bulkFilter === 'hearing_month') return String((ext as any).postCommencementPlan?.meetingPlan?.meetingDate || '').startsWith(localYmd().slice(0, 7));
              if (bulkFilter === 'correction_urgent') return (ext.correctionOrders || []).some((c: any) => c.status === 'pending');
              return false;
            });
            const channelName = channel === 'alimtok' ? '카카오 알림톡' : 'SMS';
            const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
            // 실제 발송 API를 대상별로 호출하고 결과를 그대로 기록 (이전: 아무것도 보내지 않고 '발송 완료' 기록·표시)
            let sent = 0; let failed = 0; let noPhone = 0; let firstError = '';
            for (const t of targets) {
              const ext = getCrmExt(t.id);
              let resultText: string;
              if (!t.phone) {
                noPhone++;
                resultText = '연락처 없음 — 미발송';
              } else {
                const personalized = message.replace(/#\{의뢰인명\}/g, () => t.clientName || '');
                const res = await sendAlimtok(t.phone, 'document_request', { clientName: t.clientName || '' }, { customText: personalized, receiverName: t.clientName || '' });
                if (res.ok) { sent++; resultText = `접수됨${res.channel && res.channel !== 'alimtalk' ? ` (${res.channel === 'lms_fallback' ? 'LMS 대체' : 'SMS 대체'})` : ''}`; }
                else { failed++; firstError = firstError || res.error || '발송 실패'; resultText = `실패: ${res.error || '발송 실패'}`; }
              }
              const logEntry = createActivityLog(
                t.id,
                actor.id,
                actor.name,
                actor.role,
                'communication',
                `타겟 메시지 ${channelName} — ${resultText}`,
                { filter: bulkFilter, snippet: message.slice(0, 40) }
              );
              await updateCrmExt(t.id, {
                activities: [...(ext.activities || []), logEntry]
              });
            }
            if (targets.length === 0) toast.info('조건에 맞는 의뢰인이 없습니다.');
            else if (failed === 0 && noPhone === 0) toast.success(`${sent}명에게 ${channelName} 발송이 접수되었습니다.`);
            else toast.error(`접수 ${sent}명 · 실패 ${failed}명 · 연락처 없음 ${noPhone}명${firstError ? ` — ${firstError}` : ''}`, { duration: 8000 });
            setShowBulkMessage(false);
            setBulkSendModalConfig(null);
          }}
        />
      )}

      {/* ── 0. 사건 위임계약서 서식함 (11대 표준 라이브러리) 모달 ── */}
      {showContractDocLibraryModal && (
        <ContractDocLibraryModal
          isOpen={showContractDocLibraryModal}
          onClose={() => setShowContractDocLibraryModal(false)}
          lawyerName={activeLawyer.name}
          lawFirmName={activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || ''}
          contractContext={selectedClient ? {
            clientName: selectedClient.clientName,
            clientPhone: selectedClient.phone,
            clientAddress: selectedClient.financialProfile?.residenceRegion || '',
            lawyerName: activeLawyer.name,
            lawFirmName: activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || '',
            totalFee: selectedExt?.totalFee || 0,
            contractDate: new Date().toISOString().split('T')[0],
          } : undefined}
        />
      )}

      {/* ── 1. 전자소송 순서정렬 일괄 패키징 & CSV 모달 ── */}
      {showBatchFilingModal && selectedClient && (
        <BatchFilingPackagingModal
          isOpen={showBatchFilingModal}
          onClose={() => setShowBatchFilingModal(false)}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          isBankruptcy={(selectedClient.financialProfile?.income || 0) === 0 || (selectedClient.financialProfile?.debtTotal || 0) > 50000}
          onOpenDocHub={() => {
            setShowBatchFilingModal(false);
            setShowDocHubModal(true);
          }}
          onOpenIncomeExpenseModal={() => {
            setShowBatchFilingModal(false);
            setShowIncomeExpenseModal(true);
          }}
          onOpenPropertyModal={() => {
            setShowBatchFilingModal(false);
            setShowPropertyValuationModal(true);
          }}
        />
      )}

      {/* ── 2. 기타 법원 신청서 (중지/면제/압류해제/금지) 모달 ── */}
      {showAncillaryModal && selectedClient && (
        <AncillaryPetitionsModal
          isOpen={showAncillaryModal}
          onClose={() => setShowAncillaryModal(false)}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          activeLawyerName={activeLawyer.name}
        />
      )}

      {/* ── 3. 개시결정 이후 사후관리 (가상계좌/집회/이의대응) 모달 ── */}
      {showPostCareModal && selectedClient && (
        <PostCommencementManagementModal
          isOpen={showPostCareModal}
          onClose={() => setShowPostCareModal(false)}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
          activeLawyerName={activeLawyer.name}
        />
      )}

      {/* ── 4. 스마트 법원 서식 허브 (80종 라이브러리 & 전자소송 자동화) 모달 ── */}
      {showDocHubModal && selectedClient && (
        <LegalDocHubModal
          isOpen={showDocHubModal}
          onClose={() => setShowDocHubModal(false)}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          activeLawyerName={activeLawyer.name}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
          onOpenBatchFiling={() => {
            setShowBatchFilingModal(true);
          }}
          onAttachDocToPackage={async (docTitle) => {
            // 이전: 내용 없는 가짜 PDF(data:...mock_)를 '완성본'으로 저장 → 제거
            toast.info(`'${docTitle}' 서식을 인쇄 → PDF로 저장한 뒤 [문서] 탭의 '직접 업로드'로 첨부해 주세요.`);
          }}
        />
      )}

      {/* ── 4-1. 대법원 전자소송 13종 법원 표준 서식 통합 에디터 & 인쇄 뷰어 ── */}
      {showCourtDocSuite && selectedClient && (
        <CourtDocSuiteViewerModal
          isOpen={showCourtDocSuite}
          onClose={() => setShowCourtDocSuite(false)}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          initialTab={courtDocSuiteInitialTab}
          activeLawyerName={activeLawyer.name}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
        />
      )}

      {/* ── 4-2. 법원 양식 라이브러리 (60종) ── */}
      <CourtFormLibraryModal
        isOpen={showFormLibrary}
        onClose={() => setShowFormLibrary(false)}
      />

      {/* ── 5. 대법원 전산양식 D5103 수입 및 지출에 관한 목록 모달 ── */}
      {showIncomeExpenseModal && selectedClient && (
        <IncomeExpenseModal
          isOpen={showIncomeExpenseModal}
          onClose={() => setShowIncomeExpenseModal(false)}
          clientId={selectedId}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
          activeLawyerName={activeLawyer.name}
          onOpenBatchFiling={() => {
            setShowBatchFilingModal(true);
          }}
        />
      )}

      {/* ── 6. 대법원 전산양식 D5102 재산목록 및 자산 가치 산정 모달 ── */}
      {showPropertyValuationModal && selectedClient && (
        <PropertyValuationModal
          isOpen={showPropertyValuationModal}
          onClose={() => setShowPropertyValuationModal(false)}
          clientId={selectedId}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
          onSyncToRepaymentPlan={async (syncedAssets) => {
            const currentPlan = selectedExt.repaymentPlan;
            // 저장된 계획안이 없으면 반영 대상이 없음 → 모달이 사실대로 안내
            if (!currentPlan) return false;
            // 재산만 교체하지 않고 엔진으로 다시 계산해 현재가치·충족 여부 등 파생값까지 갱신
            await saveOrThrow(selectedId, { repaymentPlan: rebuildPlanWithAssets(currentPlan, syncedAssets) });
            return true;
          }}
        />
      )}

      {/* ── 7. 대법원 필수 8종 법원문서 일괄출력 및 모바일 의뢰인 제출동의 모달 ── */}
      {showCourtDocExportModal && selectedClient && (
        <CourtDocumentExportModal
          isOpen={showCourtDocExportModal}
          onClose={() => setShowCourtDocExportModal(false)}
          clientId={selectedId}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          plan={activeRepaymentPlan}
          activeLawyerName={activeLawyer.name}
          onOpenStatementPrint={() => setShowStatementSyncModal(true)}
          onOpenRepaymentPrint={() => setDetailTab('repayment')}
          onOpenPowerOfAttorney={() => setShowPowerOfAttorneyModal(true)}
          onOpenFilingPackaging={() => setShowBatchFilingModal(true)}
        />
      )}

      {/* ── 8. 의뢰인 모바일 작성 진술서 실시간 확인 및 동기화 모달 ── */}
      {showStatementSyncModal && selectedClient && (
        <ClientStatementSyncModal
          isOpen={showStatementSyncModal}
          onClose={() => setShowStatementSyncModal(false)}
          clientId={selectedId}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
        />
      )}

      {/* ── 9. 소송위임장 및 법무법인 담당변호사 지정서 발급 모달 ── */}
      {showPowerOfAttorneyModal && selectedClient && (
        <LitigationPowerOfAttorneyModal
          isOpen={showPowerOfAttorneyModal}
          onClose={() => setShowPowerOfAttorneyModal(false)}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          activeLawyerName={activeLawyer.name}
        />
      )}

      {/* ── 10. 개인회생절차 개시신청서 본안(D5101) 전용 4탭 편집 모달 ── */}
      {showPetitionEditModal && selectedClient && (
        <CourtPetitionEditModal
          isOpen={showPetitionEditModal}
          onClose={() => setShowPetitionEditModal(false)}
          clientId={selectedId}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          activeLawyerName={activeLawyer.name}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
        />
      )}

      {/* ── 11. 개인회생 채권자목록(R02) 추가·수정·삭제 및 대법원 CSV 모달 ── */}
      {showCreditorEditModal && selectedClient && (
        <CreditorManagementModal
          isOpen={showCreditorEditModal}
          onClose={() => setShowCreditorEditModal(false)}
          clientId={selectedId}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          onUpdateCrmExt={async (updates) => {
            await saveOrThrow(selectedId, updates);
          }}
        />
      )}

      {/* ── 12. 8대 법원 전산서식 고해상도 A4 미리보기 & 인쇄 & 즉시편집 통합 모달 ── */}
      {showCourtFormPreviewModal && selectedClient && (
        <CourtFormPreviewModal
          isOpen={showCourtFormPreviewModal}
          onClose={() => setShowCourtFormPreviewModal(false)}
          initialFormCode={courtFormPreviewCode}
          clientRequest={selectedClient}
          crmExt={selectedExt}
          activeLawyerName={activeLawyer.name}
          onOpenEditModal={(code) => {
            setShowCourtFormPreviewModal(false);
            setCourtDocSuiteInitialTab(formCodeToDocTabId(code));
            setShowCourtDocSuite(true);
          }}
        />
      )}

      {/* ── 13. 구글 드라이브 녹취 연동 설정 모달 ── */}
      <GoogleDriveSettingsModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        activeLawyerEmail={activeLawyer.email}
        activeLawyerName={activeLawyer.name}
      />

      {/* ── 14. 고객 자가진단('내 상황 체크하기') 11개 영역 전수 상세 팝업 ── */}
      {showIntakeDetailModal && selectedClient && (
        <ClientIntakeDetailModal
          clientRequest={selectedClient}
          crmExt={selectedExt}
          onClose={() => setShowIntakeDetailModal(false)}
          onOpenProposalDraft={handleOpenProposalDraft ? () => handleOpenProposalDraft(selectedClient.id) : undefined}
        />
      )}
    </div>
  );
}
