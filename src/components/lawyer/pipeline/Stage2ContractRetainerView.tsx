import { DELIVERY_UNIT_FEE_KRW, calcCourtFees } from '../../../services/court/courtFees';
import { getOfficeProfile } from '../../../services/lawyer/officeProfile';
import { localYmd } from '../../../utils/localDate';
import { computePipelineGates } from './pipelineGates';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, Calculator, Send, CheckCircle2, AlertTriangle, 
  Coins, UserCheck, Calendar, ArrowRight, ShieldAlert, Sparkles,
  ExternalLink, FileText, Phone, Clock, Eye, Edit3, Printer,
  Plus, Check, X, ShieldCheck, ChevronRight, FileSignature,
  Download, Layers, AlertCircle, Copy, CheckSquare, Square,
  Trash2, ChevronDown, ChevronUp, Bookmark, Save, RotateCcw, FolderKanban, Mail, Building2,
  PenTool, Shield, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import type { 
  ConsultRequest, CrmClientExtension, User, StaffMember, StaffRole,
  ElectronicContract, ContractDocument, ContractDocType, FeeInstallment, CourtCosts
} from '../../../types';
import { CONTRACT_DOC_TYPES } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';
import { 
  getContractsByClientId, createContract, saveContract, 
  calculateCourtCosts 
} from '../../../services/contractService';
import { syncContractToCrm, buildContractSyncPatch, createDefaultCrmExtension } from '../../../services/crmService';
import { feeAmountWon, feeTotalWon } from '../../../utils/feeUnits';
import { 
  numberToKoreanAmount, 
  buildSimpleFeeClause, 
  buildSimpleMainContractDocument,
  type CustomInstallmentItem 
} from '../../../utils/contractFeeFormatters';
import { 
  getFeePresets, 
  saveFeePreset, 
  deleteFeePreset, 
  type FeePreset 
} from '../../../services/feePresetService';
import ContractWizard from '../ContractWizard';
import { ContractDocEditModal } from '../ContractDocEditModal';
import PaperContractModal, { type PaperContractSubmitData } from './PaperContractModal';
import type { DocumentFile } from '../../../types';
import { ContractDocLibraryModal } from '../ContractDocLibraryModal';
import ClientSignShareModal from '../ClientSignShareModal';
import { HighlightedDocumentViewer } from '../../common/HighlightedDocumentViewer';
import { useDialog } from '../../common/DialogProvider';
import ModalPortal from '../../common/ModalPortal';

interface Stage2ContractRetainerViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  activeStaff?: StaffMember | null;
  /** @returns 상태 저장 여부 (false면 취소·차단·저장 실패) */
  onUpdateStatus: (newStatus: any) => void | boolean | Promise<boolean | void>;
  onAdvanceToNextStage: () => void;
  onOpenContractSubTab?: () => void;
  onOpenPowerOfAttorneyModal?: () => void;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
}

// 실무 필수 특약사항 추천 목록
const PRESET_SPECIAL_TERMS = [
  { id: 'allcare', label: '인가 시까지 추가보수 없음', text: '변호사 보수는 최종 인가결정 시까지 추가 청구하지 아니하며, 일체의 회생위원 보정권고 대응을 포함한다.' },
  { id: 'refund', label: '기각 시 50% 환불', text: '의뢰인의 고의·중과실 및 허위진술이 없는 상태에서 법원의 기각결정 또는 불허가 결정이 확정된 경우 착수금의 50%를 환불한다.' },
  { id: 'trustee', label: '외부회생위원 보정비용 면제', text: '법원 외부회생위원 선임에 따른 예납금(150,000원)은 실비로 정산하며, 보정 대응에 따른 추가 수임료는 일체 면제한다.' },
  { id: 'cancel_refund', label: '접수 전 철회 시 실비 외 전액 환불', text: '개시신청서 법원 접수 전 의뢰인의 요청으로 위임계약이 해지된 경우, 기발생 실비를 제외한 수임료 전액을 반환한다.' },
  { id: 'grace', label: '분납 미납 2회 유예', text: '급여 지연 또는 생계 곤란 사유 발생 시 사전 고지 후 수임료 분납을 최대 2회까지 기한이익 상실 없이 유예할 수 있다.' },
];

export default function Stage2ContractRetainerView({
  clientRequest,
  crmExt,
  activeLawyer,
  activeStaff,
  onUpdateStatus,
  onAdvanceToNextStage,
  onOpenContractSubTab,
  onOpenPowerOfAttorneyModal,
  onUpdateCrmExt,
  activeSection,
  onSelectSection,
}: Stage2ContractRetainerViewProps) {
  const dialog = useDialog();

  // 선행 조건: 제안서 발송 및 의뢰인 확인 여부
  // 파이프라인 게이트와 같은 산식 (이전: 전화번호에 '*'가 없으면 연락처 공개로 간주)
  const stage2Gates = computePipelineGates(clientRequest, crmExt);
  const hasProposalSent = stage2Gates.hasProposalSent || !!(crmExt as any)?.isExternalClient;
  const isContactShared = stage2Gates.isContactShared;
  // ── 1. 수임료·실비 파라미터 상태 ──
  const [creditorCount, setCreditorCount] = useState<number>(() => {
    // 채권자 수를 모르면 임의값(이전: 5) 대신 채권자목록 → 0 순 (송달료 산식은 최소 1명 기준)
    return (crmExt?.repaymentPlan?.creditors || []).length || (crmExt?.debtCertificateOrders?.[0]?.items || []).length || Number((clientRequest as any)?.creditorCount) || 0;
  });
  const [isBusinessDebtor, setIsBusinessDebtor] = useState(() => {
    return (clientRequest as any)?.category === 'business' || (clientRequest as any)?.jobType === 'business';
  });

  // 계약금(가계약금) 옵션
  const [hasDeposit, setHasDeposit] = useState<boolean>(() => {
    const s = crmExt?.feeSchedule;
    return Boolean(s && s.length > 2 && (s[0]?.memo?.includes('계약금') || s[0]?.itemType === 'down_payment'));
  });
  const [depositFee, setDepositFee] = useState<number>(() => {
    const s = crmExt?.feeSchedule;
    if (s && s.length > 2 && (s[0]?.memo?.includes('계약금') || s[0]?.itemType === 'down_payment')) {
      return s[0] ? feeAmountWon(s[0]) : 300000;
    }
    return 300000;
  });

  // 착수금 (사건 착수 시)
  const [retainerFee, setRetainerFee] = useState<number>(() => {
    const s = crmExt?.feeSchedule;
    if (s && s.length > 2 && (s[0]?.memo?.includes('계약금') || s[0]?.itemType === 'down_payment')) {
      return s[1] ? feeAmountWon(s[1]) : 1000000;
    }
    if (s?.[0]) return feeAmountWon(s[0]);
    if (crmExt?.totalFee) {
      const totalWon = feeTotalWon(crmExt.totalFee);
      return Math.round(totalWon * 0.3);
    }
    return 1000000;
  });

  // 부가세 포함/별도
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);

  // 분납 방식: 'equal' (균등) | 'custom' (월별 맞춤 수동)
  const [installmentMode, setInstallmentMode] = useState<'equal' | 'custom'>('equal');

  // 균등 분납 시 파라미터
  const [monthlyFee, setMonthlyFee] = useState<number>(() => {
    const s1 = crmExt?.feeSchedule?.[1];
    return s1 ? feeAmountWon(s1) : 500000;
  });
  const [installmentMonths, setInstallmentMonths] = useState<number>(() => {
    return crmExt?.feeSchedule?.length ? Math.max(1, crmExt.feeSchedule.length - 1) : 4;
  });

  // 월별 수동 맞춤 분납 리스트
  const [customInstallments, setCustomInstallments] = useState<CustomInstallmentItem[]>(() => {
    const list: CustomInstallmentItem[] = [];
    const today = new Date();
    const count = 4;
    for (let i = 1; i <= count; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const amt = i === 1 ? 1000000 : 500000;
      list.push({
        round: i,
        amount: amt,
        dueDate: `${yyyy}-${mm}-${dd}`,
        label: `${i}회차 분납`,
      });
    }
    return list;
  });

  // 매달 납부 기준일 (말일 vs 10일 vs 25일)
  const [paymentDayType, setPaymentDayType] = useState<'last_day' | 'fixed_10th' | 'fixed_25th'>('last_day');

  // 계약서 서식 스타일: 'simple_box' (첨부 실제 간략형) | 'standard' (표준형)
  const [contractStyle, setContractStyle] = useState<'simple_box' | 'standard'>('simple_box');

  // 간략 표기 조항 실시간 미리보기 토글
  const [showClausePreview, setShowClausePreview] = useState(false);

  // ── 수임료 프리셋 (메모리) 상태 ──
  const [feePresets, setFeePresets] = useState<FeePreset[]>(() => getFeePresets());
  const [activePresetId, setActivePresetId] = useState<string>('preset-standard-300');
  const [isSavePresetModalOpen, setIsSavePresetModalOpen] = useState<boolean>(false);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newPresetDesc, setNewPresetDesc] = useState<string>('');

  // 금액 콤마 포맷터 & 파서
  const formatWon = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Number(val).toLocaleString();
  };
  const parseWon = (str: string) => {
    const clean = str.replace(/[^0-9]/g, '');
    return clean ? parseInt(clean, 10) : 0;
  };

  const [isContractSigned, setIsContractSigned] = useState(() => {
    // 수임 계약 이후 단계면 체결된 것으로 본다 (이전: CrmStatus에 없는 'preparing'/'completed' 비교)
    const signedStatuses = ['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged'];
    return (!!crmExt?.crmStatus && signedStatuses.includes(crmExt.crmStatus)) || !!crmExt?.contractDate;
  });

  // ── 2. 계약서 인스턴스 및 모달 상태 ──
  const [contract, setContract] = useState<ElectronicContract | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isDocEditOpen, setIsDocEditOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ContractDocument | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<ContractDocument | null>(null);
  const [isPreviewAllOpen, setIsPreviewAllOpen] = useState(false);
  const [selectedSpecialTerms, setSelectedSpecialTerms] = useState<string[]>(['allcare', 'cancel_refund']);
  const [customSpecialTerm, setCustomSpecialTerm] = useState('');
  const [showAddCustomTerm, setShowAddCustomTerm] = useState(false);
  const [showOfflineMenu, setShowOfflineMenu] = useState(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // 법원 실비 계산 공식 (2026 전자소송 기준)
  // 인지대·송달료: 공통 산식(courtFees.ts) — 전자소송, 금지명령 동시신청 기준
  // (이전: 28,800원 고정값, 파산 사건에도 회생 인지대 적용)
  const isBankruptcyCase = crmExt?.caseType === 'bankruptcy' || crmExt?.caseType === 'individual_bankruptcy';
  const courtFeeCalc = calcCourtFees({ caseType: isBankruptcyCase ? 'bankruptcy' : 'rehab', creditorCount, withProhibition: !isBankruptcyCase, electronic: true });
  const stampFee = courtFeeCalc.stampFee;
  const deliveryFee = courtFeeCalc.deliveryFee; // 송달료
  const trusteeDeposit = isBusinessDebtor ? 150000 : 0; // 외부회생위원 선임 예납금
  const totalCourtCost = stampFee + deliveryFee + trusteeDeposit;

  // 잔금 분납 총액 계산
  const totalInstallmentFee = useMemo(() => {
    if (installmentMode === 'custom') {
      return customInstallments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    }
    return monthlyFee * installmentMonths;
  }, [installmentMode, customInstallments, monthlyFee, installmentMonths]);

  // 계약금 실효액
  const effectiveDepositFee = hasDeposit ? depositFee : 0;

  // 총 변호사 수임료 (원화)
  const totalLawyerFee = effectiveDepositFee + retainerFee + totalInstallmentFee;
  // 의뢰인 총 부담금
  const grandTotal = totalCourtCost + totalLawyerFee;

  const paymentDayLabel = useMemo(() => {
    if (paymentDayType === 'fixed_10th') return '매월 10일';
    if (paymentDayType === 'fixed_25th') return '매월 25일';
    return '매달 말일';
  }, [paymentDayType]);

  // ── 3. 전자계약서 로드 및 동기화 ──
  useEffect(() => {
    let isMounted = true;
    async function loadContract() {
      try {
        const list = await getContractsByClientId(clientRequest.id, (clientRequest as any).clientId, clientRequest.phone);
        if (!isMounted) return;
        if (list && list.length > 0) {
          const found = list[0];
          setContract(found);
          if (found.status === 'completed' || found.status === 'signed' || !!found.signedAt) {
            setIsContractSigned(true);
          }
        } else {
          // 신규 계약서 뼈대 생성
          const lawyerName = activeLawyer.name || '담당 변호사';
          const lawFirmName = (activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || '');
          const newC = createContract({
            clientId: clientRequest.id,
            clientName: clientRequest.clientName,
            clientPhone: clientRequest.phone,
            clientAddress: clientRequest.financialProfile?.residenceRegion || '',
            lawyerName,
            lawFirmName,
            lawFirmPhone: activeLawyer.officePhone || undefined,
            assignedLawyerId: crmExt?.assigneeId || activeLawyer.id,
            totalFee: Math.round(totalLawyerFee / 10000),
            courtCosts: {
              creditorCount,
              deliveryFee,
              stampFee,
              miscFee: 0,
              debtCertFee: 0,
              debtCertUnitFee: 15000,
              deliveryUnitFee: DELIVERY_UNIT_FEE_KRW,
              provisionalDeposit: trusteeDeposit,
              isCustomized: true,
            },
          });
          setContract(newC);
        }
      } catch (e) {
        console.error('계약서 로드 실패:', e);
      }
    }
    loadContract();
    return () => { isMounted = false; };
  }, [clientRequest.id, clientRequest.phone]);

  // 활성 계약서 인스턴스 보장 함수
  const ensureContract = (): ElectronicContract => {
    if (contract) return contract;
    const lawyerName = activeLawyer.name || '담당 변호사';
    const lawFirmName = (activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || '');
    const newC = createContract({
      clientId: clientRequest.id,
      clientName: clientRequest.clientName,
      clientPhone: clientRequest.phone,
      clientAddress: clientRequest.financialProfile?.residenceRegion || '',
      lawyerName,
      lawFirmName,
      lawFirmPhone: activeLawyer.officePhone || undefined,
      assignedLawyerId: crmExt?.assigneeId || activeLawyer.id,
      totalFee: Math.round(totalLawyerFee / 10000),
      courtCosts: {
        creditorCount,
        deliveryFee,
        stampFee,
        miscFee: 0,
        debtCertFee: 0,
        debtCertUnitFee: 15000,
        deliveryUnitFee: DELIVERY_UNIT_FEE_KRW,
        provisionalDeposit: trusteeDeposit,
        isCustomized: true,
      },
    });
    setContract(newC);
    return newC;
  };

  // 분납 일정 계산 함수 (계약금 + 착수금 + 분납 일정 일괄 조립)
  const buildFeeSchedule = (): FeeInstallment[] => {
    const today = new Date();
    const todayStr = localYmd(today);
    const schedule: FeeInstallment[] = [];
    let roundIndex = 1;

    // 1. 계약금 (선택 시)
    if (hasDeposit && depositFee > 0) {
      schedule.push({
        id: `inst-deposit-${Date.now()}`,
        round: roundIndex++,
        dueDate: todayStr,
        amount: depositFee,
        status: 'pending',
        itemTitle: '계약금 (가계약금)',
        memo: '계약 체결 시 즉시 납부',
        itemType: 'down_payment',
        paymentMethod: '계좌이체',
      });
    }

    // 2. 착수금
    schedule.push({
      id: `inst-retainer-${Date.now()}`,
      round: roundIndex++,
      dueDate: todayStr,
      amount: retainerFee,
      status: 'pending',
      itemTitle: '착수금',
      memo: '사건 착수 시 납부',
      itemType: hasDeposit ? 'installment' : 'down_payment',
      paymentMethod: '계좌이체',
    });

    // 3. 잔금 분납
    if (installmentMode === 'custom') {
      customInstallments.forEach((item, idx) => {
        schedule.push({
          id: `inst-custom-${Date.now()}-${idx}`,
          round: roundIndex++,
          dueDate: item.dueDate,
          amount: item.amount,
          status: 'pending',
          itemTitle: `${item.round}회차 분납`,
          memo: `월 잔금 분납 (${item.round}회차)`,
          itemType: 'installment',
          paymentMethod: '계좌이체',
        });
      });
    } else {
      for (let i = 1; i <= installmentMonths; i++) {
        let d = new Date(today);
        if (paymentDayType === 'last_day') {
          d = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
        } else if (paymentDayType === 'fixed_10th') {
          d = new Date(today.getFullYear(), today.getMonth() + i, 10);
        } else {
          d = new Date(today.getFullYear(), today.getMonth() + i, 25);
        }
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        schedule.push({
          id: `inst-equal-${Date.now()}-${i}`,
          round: roundIndex++,
          dueDate: `${yyyy}-${mm}-${dd}`,
          amount: monthlyFee,
          status: 'pending',
          itemTitle: `${i}회차 분납`,
          memo: `월 잔금 분납 (${i}회차)`,
          itemType: 'installment',
          paymentMethod: '계좌이체',
        });
      }
    }

    return schedule;
  };

  // 금액/실비 변경 시 활성 계약서 인스턴스 실시간 반영
  const syncContractState = (
    customTermsList: string[] = selectedSpecialTerms,
    overrideStyle?: 'simple_box' | 'standard'
  ) => {
    if (!contract) return null;
    const schedule = buildFeeSchedule();
    const lawyerFeeManwon = Math.round(totalLawyerFee / 10000);
    const effectiveStyle = overrideStyle || contractStyle;

    // 특약사항 텍스트 생성
    const termsTexts = customTermsList.map(id => {
      const preset = PRESET_SPECIAL_TERMS.find(p => p.id === id);
      return preset ? preset.text : id;
    });
    const termsBody = termsTexts.map((t, idx) => `제 ${idx + 1} 항: ${t}`).join('\n\n');

    // 실무 간략 박스형 조항 생성
    const feeClauseText = buildSimpleFeeClause({
      totalFeeWon: totalLawyerFee,
      vatIncluded,
      hasDeposit,
      depositWon: depositFee,
      retainerWon: retainerFee,
      installmentMode,
      equalMonthlyFeeWon: monthlyFee,
      installmentCount: installmentMonths,
      customInstallments,
      paymentDayText: paymentDayLabel,
      articleNumber: 5,
    });

    // 제1호 사건위임계약서 본문 업데이트
    const updatedDocs = contract.documents.map(d => {
      if (d.type === 'main_contract') {
        if (effectiveStyle === 'simple_box') {
          return {
            ...d,
            title: '사건위임계약서 (실무 간략형)',
            content: buildSimpleMainContractDocument({
              clientName: clientRequest.clientName,
              clientPhone: clientRequest.phone,
              clientAddress: clientRequest.financialProfile?.residenceRegion || '',
              lawyerName: activeLawyer.name || '담당 변호사',
              lawFirmName: (activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || ''),
              feeClauseText,
              specialTermsText: termsBody,
              contractDate: contract.contractDate || localYmd(),
            }),
          };
        } else {
          const headerMarker = '════════════════════════════════════════════════\n[특약사항 (당사자 합의 특약)]';
          const base = d.content.split(headerMarker)[0].trimEnd();
          const baseWithFee = base.replace(
            /총 수임료는 일금 [^정]+정/g,
            `총 수임료는 일금 ${totalLawyerFee.toLocaleString()}원정`
          );
          if (termsTexts.length === 0) return { ...d, content: baseWithFee };
          return {
            ...d,
            content: `${baseWithFee}\n\n${headerMarker}\n${termsBody}\n════════════════════════════════════════════════`
          };
        }
      }
      return d;
    });

    const updatedContract: ElectronicContract = {
      ...contract,
      totalFee: lawyerFeeManwon,
      vatIncluded,
      courtCosts: {
        creditorCount,
        deliveryFee,
        stampFee,
        miscFee: 0,
        debtCertFee: 0,
        debtCertUnitFee: 15000,
        deliveryUnitFee: DELIVERY_UNIT_FEE_KRW,
        provisionalDeposit: trusteeDeposit,
        isCustomized: true,
      },
      feeSchedule: schedule,
      documents: updatedDocs,
      updatedAt: new Date().toISOString(),
    };

    saveContract(updatedContract);
    setContract(updatedContract);
    return updatedContract;
  };

  // 특약 토글 핸들러
  const handleToggleSpecialTerm = (termId: string) => {
    const next = selectedSpecialTerms.includes(termId)
      ? selectedSpecialTerms.filter(id => id !== termId)
      : [...selectedSpecialTerms, termId];
    setSelectedSpecialTerms(next);
    syncContractState(next);
    toast.success('계약서 특약사항이 업데이트되었습니다.');
  };

  // 커스텀 특약 추가
  const handleAddCustomTerm = () => {
    if (!customSpecialTerm.trim()) return;
    const next = [...selectedSpecialTerms, customSpecialTerm.trim()];
    setSelectedSpecialTerms(next);
    setCustomSpecialTerm('');
    setShowAddCustomTerm(false);
    syncContractState(next);
    toast.success('커스텀 특약 조항이 계약서에 추가되었습니다.');
  };

  // ── 3-1. 수임료 프리셋 (메모리) 적용 핸들러 ──
  const handleApplyPreset = (presetId: string) => {
    const target = feePresets.find(p => p.id === presetId);
    if (!target) return;

    setActivePresetId(presetId);
    setHasDeposit(target.hasDeposit);
    setDepositFee(target.depositFee);
    setRetainerFee(target.retainerFee);
    setVatIncluded(target.vatIncluded);
    setInstallmentMode(target.installmentMode);
    setMonthlyFee(target.monthlyFee);
    setInstallmentMonths(target.installmentMonths);

    if (target.customInstallments && target.customInstallments.length > 0) {
      const today = new Date();
      const updatedCustom = target.customInstallments.map((item, idx) => {
        if (item.dueDate) return item;
        const d = new Date(today.getFullYear(), today.getMonth() + idx + 2, 0);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return {
          ...item,
          dueDate: `${yyyy}-${mm}-${dd}`,
        };
      });
      setCustomInstallments(updatedCustom);
    }

    setPaymentDayType(target.paymentDayType);
    setContractStyle(target.contractStyle);

    setTimeout(() => {
      syncContractState(selectedSpecialTerms, target.contractStyle);
    }, 60);

    toast.success(`[${target.name}] 프리셋이 적용되었습니다.`);
  };

  // ── 3-2. 현재 수임료 조건을 새 프리셋으로 저장 ──
  const handleSaveCurrentAsPreset = () => {
    if (!newPresetName.trim()) {
      toast.error('프리셋 명칭을 입력해 주세요.');
      return;
    }

    try {
      const saved = saveFeePreset({
        name: newPresetName.trim(),
        description: newPresetDesc.trim() || undefined,
        hasDeposit,
        depositFee,
        retainerFee,
        vatIncluded,
        installmentMode,
        monthlyFee,
        installmentMonths,
        customInstallments: customInstallments.map(i => ({ ...i, label: i.label || `${i.round}회차 분납` })),
        paymentDayType,
        contractStyle,
      });

      const updated = getFeePresets();
      setFeePresets(updated);
      setActivePresetId(saved.id);
      setIsSavePresetModalOpen(false);
      setNewPresetName('');
      setNewPresetDesc('');
      toast.success(`'${saved.name}' 프리셋이 저장되었습니다.`);
    } catch (e) {
      toast.error('프리셋 저장 중 오류가 발생했습니다.');
    }
  };

  // ── 3-3. 사용자 정의 프리셋 삭제 ──
  const handleDeletePreset = async (presetId: string, presetName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const confirmed = await dialog.confirm({
      title: '🗑️ 프리셋 삭제',
      message: `'${presetName}' 프리셋을 영구 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (!confirmed) return;

    deleteFeePreset(presetId);
    const updated = getFeePresets();
    setFeePresets(updated);
    if (activePresetId === presetId) {
      setActivePresetId(updated[0]?.id || '');
    }
    toast.success(`'${presetName}' 프리셋이 삭제되었습니다.`);
  };

  // ── 4. 전자계약서 모바일 발송 핸들러 (ClientSignShareModal 연동) ──
  const handleSendElectronicContract = async () => {
    if (!hasProposalSent || !isContactShared) {
      await dialog.alert({
        title: '🔒 선행 단계 미완료 (제안서 미발송)',
        message: '의뢰인에게 맞춤 제안서가 발송되지 않았거나 의뢰인이 확인하지 않았습니다.\n\n[Stage 01 맞춤 제안서 발송]을 먼저 완료해 주세요.',
        variant: 'warning'
      });
      return;
    }

    const current = syncContractState() || contract;
    if (!current) {
      toast.error('계약서 데이터를 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    // 알림톡 알림 기록
    addClientNotification({
      type: 'document_request',
      title: `[전자계약서 발송] ${clientRequest.clientName}님께 수임계약서 전자서명 링크가 전송되었습니다.`,
      body: '카카오 알림톡으로 전송된 전자서명 링크를 열어 본인인증 후 서명을 완료해주세요.',
      emoji: '✍️',
      linkTab: 'diagnosis',
    });

    // 공유 및 발송 모달 열기
    setIsShareModalOpen(true);
  };

  // ── 5. 서면/종이 계약 인쇄 핸들러 ──
  const handlePrintContract = () => {
    const current = syncContractState() || contract;
    if (!current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.');
      return;
    }

    const docsHtml = current.documents
      .filter(d => d.included)
      .map((d, i) => `
        <div style="page-break-after: always; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; line-height: 1.6; color: #0f172a;">
          <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px;">
            <span style="font-size: 11px; font-weight: bold; color: #475569;">${current.lawFirmName} 표준 사건위임서식</span>
            <span style="font-size: 11px; font-family: monospace; color: #64748b;">계약관리번호: ${current.id}</span>
          </div>
          <h2 style="text-align: center; margin-bottom: 24px; font-size: 20px; font-weight: 800;">
            [제${i + 1}호 서식] ${d.title}
          </h2>
          <div style="white-space: pre-wrap; font-family: 'Consolas', -apple-system, BlinkMacSystemFont, 'Pretendard', monospace; font-size: 12px; min-height: 520px; background: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; line-height: 1.8;">
${d.content}
          </div>
          <div style="margin-top: 36px; border-top: 1px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; font-size: 12px;">
            <div>
              <p style="margin: 0 0 8px 0;"><strong>위임인 (의뢰인):</strong> ${current.clientName} (서명 또는 날인)</p>
              <div style="width: 140px; height: 50px; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px;">
                (인 / 서명)
              </div>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0 0 8px 0;"><strong>수임인 (법률대리인):</strong> ${current.lawFirmName} ${current.lawyerName} (직인)</p>
              <div style="width: 140px; height: 50px; border: 1px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; margin-left: auto;">
                (법률사무소 직인)
              </div>
            </div>
          </div>
        </div>
      `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>전자계약서 전문 인쇄 - ${current.clientName} (${current.id})</title>
          <style>
            @media print {
              body { margin: 0; background: white; }
            }
          </style>
        </head>
        <body>
          ${docsHtml}
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── 5-1. 온·오프라인 하이브리드 서면/우편 계약 등록 핸들러 ──
  const handleConfirmPaperContract = async (data: PaperContractSubmitData) => {
    if (!hasProposalSent || !isContactShared) {
      await dialog.alert({
        title: '🔒 선행 단계 미완료 (제안서 미발송)',
        message: '의뢰인에게 맞춤 제안서가 발송되지 않았거나 의뢰인이 확인하지 않았습니다.\n\n[Stage 01 맞춤 제안서 발송]을 먼저 완료해 주세요.',
        variant: 'warning'
      });
      return;
    }

    const statusOk = await onUpdateStatus('contracted');
    if (statusOk === false) return;
    setIsContractSigned(true);

    const current = syncContractState() || contract;
    if (current) {
      const completedContract: ElectronicContract = {
        ...current,
        status: 'completed',
        contractDate: data.signedDate,
        signedAt: new Date(data.signedDate).toISOString(),
        contractMethod: data.method,
        paperContractInfo: {
          method: data.method,
          signedDate: data.signedDate,
          scannedFiles: data.scannedFiles,
          postalInfo: data.postalInfo,
          notes: data.notes,
        },
      };
      const serverOk = await saveContract(completedContract);
      setContract(completedContract);

      const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
      const currentExt = crmExt || createDefaultCrmExtension(clientRequest.id);
      const patch = buildContractSyncPatch(currentExt, completedContract, actor);

      const newDocFiles: DocumentFile[] = (data.scannedFiles || []).map(sf => ({
        id: sf.id,
        name: `[서면계약서] ${sf.name}`,
        category: 'other' as const,
        uploadedAt: sf.uploadedAt,
        uploadedBy: actor.name,
        fileSize: sf.size,
        dataUrl: sf.url,
        uploadSource: 'lawyer' as const,
        reviewStatus: 'approved' as const,
        notes: `${data.method === 'in_person' ? '방문 체결' : '우편 등기 체결'} 실물 날인본 스캔 (${data.signedDate})`,
      }));

      const existingFiles = currentExt.uploadedFiles || [];
      const mergedFiles = [...existingFiles, ...newDocFiles];

      const methodLabel = data.method === 'in_person' ? '방문 대면' : '우편 등기';
      const noteText = data.notes ? ` (비고: ${data.notes})` : '';
      const postalTracking = data.postalInfo?.trackingNumber ? ` [등기번호: ${data.postalInfo.trackingNumber}]` : '';

      const newActivity = {
        id: `act-paper-${Date.now()}`,
        clientId: clientRequest.id,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        type: 'contract_signed' as const,
        createdAt: new Date().toISOString(),
        description: `[서면 계약 체결 완료] ${methodLabel} 방식으로 수임계약 체결 등록${postalTracking}${noteText}`,
        metadata: { detail: `체결일자: ${data.signedDate}, 증빙 파일: ${data.scannedFiles?.length || 0}건 첨부` },
      };

      if (onUpdateCrmExt) {
        await onUpdateCrmExt({
          ...patch,
          crmStatus: 'contracted',
          contractMethod: data.method,
          totalFee: Math.round(totalLawyerFee / 10000),
          contractDate: data.signedDate,
          uploadedFiles: mergedFiles,
          activities: [newActivity, ...(currentExt.activities || [])],
        });
      } else {
        await syncContractToCrm(clientRequest.id, completedContract, actor);
      }

      if (!serverOk) {
        toast.warning('전자계약서가 서버에 반영되지 않고 로컬에 임시 저장되었습니다.');
      }
    }

    addClientNotification({
      type: 'status_change',
      title: `[수임계약 체결 완료] ${data.method === 'in_person' ? '방문(대면)' : '우편(등기)'} 방식으로 정식 사건 위임계약이 체결되었습니다.`,
      emoji: data.method === 'in_person' ? '🏢' : '📮',
      linkTab: 'diagnosis',
    });
    toast.success(`${data.method === 'in_person' ? '방문 대면' : '우편 등기'} 서면 계약 체결이 완료 처리되었습니다!`);
  };

  // ── 6. 서면계약 수동 완료 처리 (2단계 확인 팝업 적용) ──
  const handleConfirmInPersonContract = async () => {
    if (!hasProposalSent || !isContactShared) {
      await dialog.alert({
        title: '🔒 선행 단계 미완료 (제안서 미발송)',
        message: '의뢰인에게 맞춤 제안서가 발송되지 않았거나 의뢰인이 확인하지 않았습니다.\n\n[Stage 01 맞춤 제안서 발송]을 먼저 완료해 주세요.',
        variant: 'warning'
      });
      return;
    }

    const confirmed = await dialog.confirm({
      title: '📝 수임계약 체결 완료 처리',
      message: '의뢰인과의 사건 위임계약 및 착수금 약정을 완료 처리하시겠습니까?\n\n※ 체결 완료 시 사건 계약 상태가 확정되며 서류 준비(Stage 03)로 진행할 수 있습니다.',
      confirmText: '계약 체결 완료',
      cancelText: '취소',
      variant: 'primary'
    });
    if (!confirmed) return;

    // 상태 저장이 확정된 뒤에만 계약 완료로 기록 (이전: 상태 변경 확인창을 취소해도 계약서가 '체결 완료'로 저장됨)
    const statusOk = await onUpdateStatus('contracted');
    if (statusOk === false) return;
    setIsContractSigned(true);

    if (contract) {
      const completedContract: ElectronicContract = {
        ...contract,
        status: 'completed',
        contractDate: localYmd(),
        signedAt: new Date().toISOString(),
      };
      const serverOk = await saveContract(completedContract);
      setContract(completedContract);

      const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
      const currentExt = crmExt || createDefaultCrmExtension(clientRequest.id);
      const patch = buildContractSyncPatch(currentExt, completedContract, actor);

      if (onUpdateCrmExt) {
        await onUpdateCrmExt({
          ...patch,
          crmStatus: 'contracted',
          totalFee: Math.round(totalLawyerFee / 10000),
          contractDate: localYmd(),
        });
      } else {
        await syncContractToCrm(clientRequest.id, completedContract, actor);
      }

      if (!serverOk) {
        toast.warning('전자계약서가 서버에 반영되지 않고 로컬에 임시 저장되었습니다.');
      }
    }

    addClientNotification({
      type: 'status_change',
      title: '[수임계약 체결 완료] 정식 사건 위임계약이 체결되어 서류 수합 및 사건 진행을 개시합니다.',
      emoji: '📝',
      linkTab: 'diagnosis',
    });
    toast.success('방문/서면 계약 체결이 완료 처리되었습니다. (계약 체결 완료)');
  };

  // ── 7. 위자드 저장 핸들러 ──
  const handleWizardSave = async (saved: ElectronicContract) => {
    const serverOk = await saveContract(saved);
    setContract(saved);
    setIsWizardOpen(false);

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    const currentExt = crmExt || createDefaultCrmExtension(clientRequest.id);
    const patch = buildContractSyncPatch(currentExt, saved, actor);

    if (onUpdateCrmExt) {
      await onUpdateCrmExt(patch);
    } else {
      await syncContractToCrm(clientRequest.id, saved, actor);
    }

    if (!serverOk) {
      toast.error('전자계약서를 서버에 저장하지 못했습니다. 이 기기에만 임시 저장되었으며, 의뢰인 서명 링크가 열리지 않을 수 있습니다.');
      return;
    }

    if (saved.status === 'completed' || saved.status === 'signed') {
      setIsContractSigned(true);
      const statusOk = await onUpdateStatus('contracted');
      if (statusOk === false) {
        toast.info('전자계약은 저장했지만 사건 상태는 변경되지 않았습니다.');
        return;
      }
      toast.success('전자계약 체결이 CRM 수임료와 사건 상태에 반영되었습니다.');
    } else {
      toast.success('전자계약서 변경사항이 저장되었습니다.');
    }
  };

  // ── 8. 개별 조항 편집기 저장 핸들러 ──
  const handleDocEditSave = (updatedDoc: ContractDocument) => {
    if (!contract) return;
    const updatedDocs = contract.documents.map(d => d.id === updatedDoc.id ? updatedDoc : d);
    const updatedContract = { ...contract, documents: updatedDocs, updatedAt: new Date().toISOString() };
    saveContract(updatedContract);
    setContract(updatedContract);
    setIsDocEditOpen(false);
    setEditingDoc(null);
    toast.success(`[${updatedDoc.title}] 조항 수정사항이 계약서에 반영되었습니다.`);
  };

  // 4대 핵심 문서 필터링
  const coreDocuments = useMemo(() => {
    if (!contract?.documents) return [];
    return contract.documents.filter(d => ['main_contract', 'power_of_attorney', 'privacy_consent', 'third_party_consent', 'installment_agreement'].includes(d.type));
  }, [contract]);

  // 섹션 탭 라우팅: 'contract' | 'fees' | 'court-fees' (기본값: 전체 표시)
  const currentSection = activeSection || 'all';
  const showCourtFees = currentSection === 'court-fees' || currentSection === 'all';
  const showFees = currentSection === 'fees' || currentSection === 'all';
  const showContract = currentSection === 'contract' || currentSection === 'all';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Next Action Hero Card (슬림 & 컴팩트 레이아웃) ── */}
      {showContract && (
      <div className={`p-3.5 sm:p-4 rounded-2xl border transition-all shadow-2xs ${
        isContractSigned 
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 좌측 안내 (1줄 타이틀 + 1줄 부제 슬림 구성) */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isContractSigned ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
            }`}>
              {isContractSigned ? <CheckCircle2 className="w-5 h-5" /> : <FileCheck2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${
                  isContractSigned 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {isContractSigned ? '계약 체결 완료' : '지금 해야 할 핵심 작업'}
                </span>
                <span className="text-sm font-black tracking-tight text-slate-900 truncate">
                  {isContractSigned 
                    ? '정식 위임계약 체결 완료' 
                    : '전자계약서 발송 및 수임 체결'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-normal truncate">
                {isContractSigned 
                  ? '체결된 위임계약서 패키지(위임장 포함)가 안전하게 보관되었습니다. 3단계(고객정보·서류수집)로 진행하세요.' 
                  : '계약 조항과 특약사항 검토 후 의뢰인에게 모바일 전자계약서를 발송하세요.'}
              </p>
            </div>
          </div>

          {/* 우측 CTA 영역 (컴팩트 버튼 그룹) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {!isContractSigned ? (
              <>
                <button
                  type="button"
                  onClick={handleSendElectronicContract}
                  className="px-4 py-2 bg-[#1E3A5F] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>전자계약서 발송</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsLibraryOpen(true)}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  title="11대 법률 표준 위임계약서 및 서식 보관함 전체보기"
                >
                  <FolderKanban className="w-3.5 h-3.5 text-indigo-600" />
                  <span>서식함</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewAllOpen(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  title="현재 설정된 수임료·특약이 반영된 계약서 전문 열람"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>미리보기</span>
                </button>

                {/* 대면 방문 서면계약 보조 메뉴 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowOfflineMenu(prev => !prev)}
                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                    title="대면 방문 고객용 종이 인쇄 및 수동 체결 처리"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>서면 ▾</span>
                  </button>

                  {showOfflineMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-20" 
                        onClick={() => setShowOfflineMenu(false)} 
                      />
                      <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 space-y-1 text-xs animate-fadeIn">
                        <button
                          type="button"
                          onClick={() => { setShowOfflineMenu(false); setIsPaperModalOpen(true); }}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-2 font-bold cursor-pointer"
                        >
                          <FileSignature className="w-3.5 h-3.5 text-indigo-600" />
                          <span>서면계약 등록 (방문/우편)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowOfflineMenu(false); handlePrintContract(); }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg flex items-center gap-2 text-slate-700 font-bold cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>종이 계약서 서식 인쇄</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowOfflineMenu(false); handleConfirmInPersonContract(); }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-100 text-slate-600 rounded-lg flex items-center gap-2 font-medium cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>간편 서면 체결 (스킵)</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAdvanceToNextStage}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
                >
                  <span>Stage 3 (서류수집)로 진행</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewAllOpen(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  title="전자서명 완료된 위임계약서 및 위임장 전체 패키지 열람"
                >
                  <Eye className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  <span>계약서 열람</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintContract}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer press-scale whitespace-nowrap"
                  title="계약서 패키지 재인쇄"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>인쇄</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── 의뢰인 온·오프라인 서면(방문/우편) 전환 요청 알림 카드 ── */}
      {!isContractSigned && (contract?.paperContractInfo || crmExt?.contractMethod) && (
        <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              {contract?.contractMethod === 'postal' || contract?.paperContractInfo?.method === 'postal' ? (
                <Mail className="w-5 h-5 text-purple-700" />
              ) : (
                <Building2 className="w-5 h-5 text-amber-700" />
              )}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  의뢰인이 [{contract?.contractMethod === 'postal' || contract?.paperContractInfo?.method === 'postal' ? '우편(등기) 계약' : '법률사무소 방문 체결'}]을 요청했습니다
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-200/80 text-amber-900 rounded-md">
                  서면 전환 요청 접수
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 truncate">
                {contract?.paperContractInfo?.notes || 
                  (contract?.paperContractInfo?.postalInfo ? `배송지: ${contract.paperContractInfo.postalInfo.recipientAddress}` : '방문 상담 및 서면 계약 날인 희망')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsPaperModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0 transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>서면계약 확인 및 체결 등록</span>
          </button>
        </div>
      )}

      {/* ── [기획서 4.3 2단계] 의뢰인 총 부담금 요약 한 줄 (하단 다크 바 대체) ── */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 sm:px-5 sm:py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="p-1.5 rounded-lg bg-[#1E3A5F] text-white shadow-2xs">
            <Calculator className="w-3.5 h-3.5" />
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">의뢰인 총 부담 예정액:</span>
            <span className="font-mono text-base font-black text-slate-900">{grandTotal.toLocaleString()}원</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            법원 실비: <strong className="text-slate-700 font-bold">{totalCourtCost.toLocaleString()}원</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            변호사 수임료: <strong className="text-slate-700 font-bold">{totalLawyerFee.toLocaleString()}원</strong>
          </span>
          {isContractSigned && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold font-sans text-xs">
              ✓ 수임계약 체결 완료
            </span>
          )}
        </div>
      </div>

      {/* ── 3. 수임료·실비·계약 요약 카드 (상세 입력은 계약서 위저드 5탭에서 수행) ── */}
      {(showCourtFees || showFees) && (
      <div className="space-y-4 animate-fadeIn">
        {/* 수임료·실비 요약 카드 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" />
              <span>수임료·실비 요약</span>
            </h3>
            <button
              type="button"
              onClick={() => { syncContractState(); setIsWizardOpen(true); }}
              className="px-3.5 py-2 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer whitespace-nowrap"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>계약서에서 수정</span>
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 법원 실비 */}
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-600 font-bold block">법원 실비</span>
              <span className="text-sm font-black text-blue-900 font-mono">{totalCourtCost.toLocaleString()}원</span>
              <div className="text-xs text-blue-500 mt-1 space-y-0.5">
                <div>인지대 {stampFee.toLocaleString()}원</div>
                <div>송달료 {deliveryFee.toLocaleString()}원</div>
                {trusteeDeposit > 0 && <div>회생위원 예납금 {trusteeDeposit.toLocaleString()}원</div>}
              </div>
            </div>

            {/* 변호사 수임료 */}
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-600 font-bold block">변호사 수임료</span>
              <span className="text-sm font-black text-emerald-900 font-mono">{totalLawyerFee.toLocaleString()}원</span>
              <div className="text-xs text-emerald-500 mt-1 space-y-0.5">
                {hasDeposit && <div>계약금 {formatWon(depositFee)}원</div>}
                <div>착수금 {formatWon(retainerFee)}원</div>
                <div>분납 {installmentMonths}회 × {formatWon(monthlyFee)}원</div>
              </div>
            </div>

            {/* 채권자 수 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-bold block">채권자 수</span>
              <span className="text-sm font-black text-slate-900 font-mono">{creditorCount}곳</span>
              <p className="text-xs text-slate-400 mt-1">송달료·인지대 산정 기준</p>
            </div>

            {/* 총 부담금 */}
            <div className="p-3 bg-[#1E3A5F]/5 rounded-xl border border-[#1E3A5F]/15">
              <span className="text-xs text-[#1E3A5F] font-bold block">의뢰인 총 부담</span>
              <span className="text-sm font-black text-[#1E3A5F] font-mono">{grandTotal.toLocaleString()}원</span>
              {vatIncluded && <p className="text-xs text-slate-400 mt-1">VAT 포함</p>}
            </div>
          </div>

          {/* 상담 데이터 가져오기 안내 */}
          {crmExt?.totalFee && !isContractSigned && (
            <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold">상담 단계에서 입력된 수임료({typeof crmExt.totalFee === 'number' ? `${crmExt.totalFee.toLocaleString()}만원` : crmExt.totalFee})가 있습니다.</span>
              </div>
              <button
                type="button"
                onClick={() => { syncContractState(); toast.success('상담 데이터가 계약서에 반영되었습니다.'); }}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg border border-amber-300 cursor-pointer press-scale whitespace-nowrap"
              >
                가져오기
              </button>
            </div>
          )}
        </div>

        {/* 특약사항 요약 */}
        {selectedSpecialTerms.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <h4 className="text-xs font-black text-slate-700 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              적용된 특약사항 ({selectedSpecialTerms.length}개)
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {selectedSpecialTerms.map(id => {
                const preset = PRESET_SPECIAL_TERMS.find(p => p.id === id);
                return (
                  <span key={id} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold">
                    {preset?.label || id}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 계약서 서식 요약 */}
        {contract && (contract.documents || []).length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand" />
                계약서 서식 ({(contract.documents || []).filter(d => d.included).length}/{(contract.documents || []).length}개 포함)
              </h4>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-lg cursor-pointer press-scale whitespace-nowrap"
              >
                서식함
              </button>
            </div>
            <div className="space-y-1">
              {(contract.documents || []).map((doc, idx) => (
                <div key={doc.id || idx} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${doc.included ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={`truncate ${doc.included ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>{doc.title}</span>
                  </div>
                  {doc.included && doc.lawyerSignature && (
                    <span className="text-emerald-600 font-bold shrink-0">서명 완료</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── 6. 모달 렌더링 영역 ── */}

      {/* 6-1. 6단계 전자계약 전체 위자드 모달 */}
      {isWizardOpen && (contract || ensureContract()) && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-fadeIn">
            <div className="bg-slate-100 w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <ContractWizard
                  contract={contract || ensureContract()}
                  onClose={() => setIsWizardOpen(false)}
                  onSave={handleWizardSave}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 6-2. 개별 서식 조항 및 법률 스니펫 수정 모달 */}
      {isDocEditOpen && editingDoc && (
        <ContractDocEditModal
          isOpen={isDocEditOpen}
          doc={editingDoc}
          contractContext={{
            clientName: clientRequest.clientName,
            clientPhone: clientRequest.phone,
            clientAddress: clientRequest.financialProfile?.residenceRegion || '',
            lawyerName: activeLawyer.name || '담당 변호사',
            lawFirmName: (activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || ''),
            totalFee: Math.round(totalLawyerFee / 10000),
            contractDate: contract?.contractDate || localYmd(),
          }}
          onClose={() => {
            setIsDocEditOpen(false);
            setEditingDoc(null);
          }}
          onSave={handleDocEditSave}
        />
      )}

      {/* 6-3. 카카오 알림톡/문자 전자서명 공유 모달 */}
      {isShareModalOpen && contract && (
        <ClientSignShareModal
          contract={contract}
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
        />
      )}

      {/* 6-4. 단일 서식 퀵 뷰어 모달 */}
      {previewDoc && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] my-auto flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="font-black text-sm text-slate-900">{previewDoc.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto flex-1 bg-slate-50 text-xs font-mono">
                <HighlightedDocumentViewer content={previewDoc.content} />
              </div>
              <div className="p-3 border-t border-slate-100 bg-white flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const docToEdit = previewDoc;
                    setPreviewDoc(null);
                    setEditingDoc(docToEdit);
                    setIsDocEditOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>조항 수정하기</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 6-5. 계약서 전체 통합 미리보기 모달 */}
      {isPreviewAllOpen && contract && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[88vh] my-auto flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <FileSignature className="w-5 h-5 text-[#1E3A5F]" />
                  <div>
                    <h3 className="font-black text-sm text-slate-900">
                      {clientRequest.clientName} 의뢰인 전자계약서 패키지 전문 미리보기
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      관리번호: {contract.id} · 총 수임료: {totalLawyerFee.toLocaleString()}원 · 법원실비: {totalCourtCost.toLocaleString()}원
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrintContract}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>인쇄</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewAllOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-100/60">
                {contract.documents.filter(d => d.included).map((d, i) => (
                  <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="font-black text-xs text-[#1E3A5F]">
                        [제{i + 1}호 서식] {d.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPreviewAllOpen(false);
                          setEditingDoc(d);
                          setIsDocEditOpen(true);
                        }}
                        className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>수정</span>
                      </button>
                    </div>
                    <div className="text-xs font-mono leading-relaxed bg-slate-50/70 p-4 rounded-lg border border-slate-100">
                      <HighlightedDocumentViewer content={d.content} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 font-bold">
                  ✓ 사무소 위임약관 기반 · 전자서명 동의 절차 포함
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPreviewAllOpen(false);
                      handleSendElectronicContract();
                    }}
                    className="px-4 py-2 bg-[#1E3A5F] hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>이대로 모바일 전자서명 발송</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewAllOpen(false)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── 프리셋 저장 모달 (ModalPortal) ── */}
      {isSavePresetModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                    <Bookmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">현재 수임료 조건 프리셋 저장</h3>
                    <p className="text-xs text-slate-500">저장된 세팅은 언제든지 원클릭으로 다시 불러올 수 있습니다.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSavePresetModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 저장 대상 요약 프리뷰 */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-slate-700 flex justify-between">
                  <span>총 수임료</span>
                  <span className="text-blue-700 font-mono font-black">{totalLawyerFee.toLocaleString()}원</span>
                </div>
                <div className="text-xs text-slate-500 flex justify-between">
                  <span>구성</span>
                  <span className="font-medium text-slate-700">
                    {hasDeposit ? `계약금 ${depositFee.toLocaleString()}원 + ` : ''}
                    착수금 {retainerFee.toLocaleString()}원 + 
                    잔금 {installmentMode === 'equal' ? `${monthlyFee.toLocaleString()}원 × ${installmentMonths}회` : `${customInstallments.length}회 맞춤`}
                  </span>
                </div>
              </div>

              {/* 입력 폼 */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  handleSaveCurrentAsPreset();
                }}
                className="space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">
                    프리셋 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: 실무 5회 분납 (총 350만), 급여소득자 기본형 등"
                    value={newPresetName}
                    onChange={e => setNewPresetName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">
                    설명 / 비고 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="예: 착수 100만 + 50만 5회, 매월 25일 급여일 납부"
                    value={newPresetDesc}
                    onChange={e => setNewPresetDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                </div>

                {/* 모달 버튼 */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSavePresetModalOpen(false)}
                    className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-black text-white bg-[#1E3A5F] hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer press-scale flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>프리셋 저장</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── 온·오프라인 하이브리드 서면(방문/우편) 계약 체결 모달 ── */}
      {isPaperModalOpen && (contract || syncContractState()) && (
        <PaperContractModal
          isOpen={isPaperModalOpen}
          onClose={() => setIsPaperModalOpen(false)}
          contract={(syncContractState() || contract)!}
          onConfirm={handleConfirmPaperContract}
          onPrint={handlePrintContract}
        />
      )}

      {/* ── 11대 법률 표준 위임계약서 및 서식 보관함 모달 ── */}
      {isLibraryOpen && (
        <ContractDocLibraryModal
          isOpen={isLibraryOpen}
          onClose={() => setIsLibraryOpen(false)}
          lawyerName={activeLawyer.name}
          lawFirmName={(activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || '')}
          contractContext={{
            clientName: clientRequest.clientName,
            clientPhone: clientRequest.phone,
            clientAddress: clientRequest.financialProfile?.residenceRegion || '',
            lawyerName: activeLawyer.name || '담당 변호사',
            lawFirmName: (activeLawyer.firmName || getOfficeProfile(activeLawyer.name).firmName || ''),
            totalFee: Math.round(totalLawyerFee / 10000),
            contractDate: contract?.contractDate || localYmd(),
          }}
        />
      )}
    </div>
  );
}
