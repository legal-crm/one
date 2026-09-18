import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, Calculator, Send, CheckCircle2, AlertTriangle, 
  Coins, UserCheck, Calendar, ArrowRight, ShieldAlert, Sparkles,
  ExternalLink, FileText, Phone, Clock, Eye, Edit3, Printer,
  Plus, Check, X, ShieldCheck, ChevronRight, FileSignature,
  Download, Layers, AlertCircle, Copy, CheckSquare, Square,
  Trash2, ChevronDown, ChevronUp
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
import { syncContractToCrm } from '../../../services/crmService';
import { 
  numberToKoreanAmount, 
  buildSimpleFeeClause, 
  buildSimpleMainContractDocument,
  type CustomInstallmentItem 
} from '../../../utils/contractFeeFormatters';
import ContractWizard from '../ContractWizard';
import { ContractDocEditModal } from '../ContractDocEditModal';
import ClientSignShareModal from '../ClientSignShareModal';
import { HighlightedDocumentViewer } from '../../common/HighlightedDocumentViewer';
import { useDialog } from '../../common/DialogProvider';
import ModalPortal from '../../common/ModalPortal';

interface Stage2ContractRetainerViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  activeStaff?: StaffMember | null;
  onUpdateStatus: (newStatus: any) => void;
  onAdvanceToNextStage: () => void;
  onOpenContractSubTab?: () => void;
  onOpenPowerOfAttorneyModal?: () => void;
  onUpdateCrmExt?: (patch: Partial<CrmClientExtension>) => Promise<void>;
}

// 실무 필수 특약사항 추천 목록
const PRESET_SPECIAL_TERMS = [
  { id: 'allcare', label: '인가 전액 보증', text: '변호사 보수는 최종 인가결정 시까지 추가 청구하지 아니하며, 일체의 회생위원 보정권고 대응을 포함한다.' },
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
}: Stage2ContractRetainerViewProps) {
  const dialog = useDialog();

  // 선행 조건: 제안서 발송 및 의뢰인 확인 여부
  const hasProposalSent = Boolean(clientRequest.hasProposalSent || crmExt?.hasProposalSent);
  const isContactShared = Boolean(
    clientRequest.status === 'contracted' ||
    crmExt?.crmStatus === 'contracted' ||
    clientRequest.phoneConsultationRequested || 
    clientRequest.contactDisclosureStatus === 'contact_shared' ||
    crmExt?.isContactShared ||
    (clientRequest.phone && !clientRequest.phone.includes('*'))
  );
  // ── 1. 수임료·실비 파라미터 상태 ──
  const [creditorCount, setCreditorCount] = useState<number>(() => {
    return (crmExt?.debtCertificateOrders?.[0]?.items || []).length || (clientRequest as any)?.creditorCount || 5;
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
      return s[0].amount || 300000;
    }
    return 300000;
  });

  // 착수금 (사건 착수 시)
  const [retainerFee, setRetainerFee] = useState<number>(() => {
    const s = crmExt?.feeSchedule;
    if (s && s.length > 2 && (s[0]?.memo?.includes('계약금') || s[0]?.itemType === 'down_payment')) {
      return s[1]?.amount || 1000000;
    }
    return crmExt?.feeSchedule?.[0]?.amount || (crmExt?.totalFee ? Math.round(crmExt.totalFee * 0.3) : 1000000);
  });

  // 부가세 포함/별도
  const [vatIncluded, setVatIncluded] = useState<boolean>(true);

  // 분납 방식: 'equal' (균등) | 'custom' (월별 맞춤 수동)
  const [installmentMode, setInstallmentMode] = useState<'equal' | 'custom'>('equal');

  // 균등 분납 시 파라미터
  const [monthlyFee, setMonthlyFee] = useState<number>(() => {
    return crmExt?.feeSchedule?.[1]?.amount || 500000;
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
    return crmExt?.crmStatus === 'contracted' || crmExt?.crmStatus === 'preparing' || crmExt?.crmStatus === 'completed' || !!crmExt?.contractDate;
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

  // 법원 실비 계산 공식 (2026 전자소송 기준)
  const stampFee = 28800; // 인지대: 개시 27,000 + 금지명령 1,800
  const deliveryFee = 5200 * (10 + (creditorCount * 8)); // 송달료
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
          const lawFirmName = activeLawyer.lawFirmName || '법무법인 로앤';
          const newC = createContract({
            clientId: clientRequest.id,
            clientName: clientRequest.clientName,
            clientPhone: clientRequest.phone,
            clientAddress: clientRequest.financialProfile?.residenceRegion || '',
            lawyerName,
            lawFirmName,
            assignedLawyerId: crmExt?.assigneeId || activeLawyer.id,
            totalFee: Math.round(totalLawyerFee / 10000),
            courtCosts: {
              creditorCount,
              deliveryFee,
              stampFee,
              miscFee: 0,
              debtCertFee: 0,
              debtCertUnitFee: 15000,
              deliveryUnitFee: 5200,
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
    const lawFirmName = activeLawyer.lawFirmName || '법무법인 로앤';
    const newC = createContract({
      clientId: clientRequest.id,
      clientName: clientRequest.clientName,
      clientPhone: clientRequest.phone,
      clientAddress: clientRequest.financialProfile?.residenceRegion || '',
      lawyerName,
      lawFirmName,
      assignedLawyerId: crmExt?.assigneeId || activeLawyer.id,
      totalFee: Math.round(totalLawyerFee / 10000),
      courtCosts: {
        creditorCount,
        deliveryFee,
        stampFee,
        miscFee: 0,
        debtCertFee: 0,
        debtCertUnitFee: 15000,
        deliveryUnitFee: 5200,
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
    const todayStr = today.toISOString().split('T')[0];
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
        label: '계약금 (가계약금)',
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
      label: '착수금',
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
          label: `${item.round}회차 분납`,
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
          label: `${i}회차 분납`,
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
              lawFirmName: activeLawyer.lawFirmName || '법무법인 로앤',
              feeClauseText,
              specialTermsText: termsBody,
              contractDate: contract.contractDate || new Date().toISOString().split('T')[0],
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
        deliveryUnitFee: 5200,
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
      message: '의뢰인과의 사건 위임계약 및 착수금 약정을 완료 처리하시겠습니까?\n\n※ 체결 완료 시 사건이 [Stage 03 고객정보·서류수집] 단계로 전환됩니다.',
      confirmText: '계약 체결 완료',
      cancelText: '취소',
      variant: 'primary'
    });
    if (!confirmed) return;

    setIsContractSigned(true);
    onUpdateStatus('contracted');

    if (contract) {
      const completedContract: ElectronicContract = {
        ...contract,
        status: 'completed',
        contractDate: new Date().toISOString().split('T')[0],
        signedAt: new Date().toISOString(),
      };
      saveContract(completedContract);
      setContract(completedContract);

      const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
      await syncContractToCrm(clientRequest.id, completedContract, actor);
    }

    if (onUpdateCrmExt) {
      await onUpdateCrmExt({
        crmStatus: 'contracted',
        totalFee: Math.round(totalLawyerFee / 10000),
        contractDate: new Date().toISOString().split('T')[0],
      });
    }

    addClientNotification({
      type: 'status_change',
      title: '[수임계약 체결 완료] 정식 사건 위임계약이 체결되어 서류 수합 및 사건 진행을 개시합니다.',
      emoji: '📝',
      linkTab: 'diagnosis',
    });
    toast.success('방문/서면 계약 체결이 완료 처리되었습니다. [Gate 2 통과]');
  };

  // ── 7. 위자드 저장 핸들러 ──
  const handleWizardSave = async (saved: ElectronicContract) => {
    saveContract(saved);
    setContract(saved);
    setIsWizardOpen(false);

    const actor = activeStaff || { id: activeLawyer.id, name: activeLawyer.name, role: 'OWNER' as StaffRole };
    await syncContractToCrm(clientRequest.id, saved, actor);

    if (onUpdateCrmExt) {
      await onUpdateCrmExt({
        totalFee: saved.totalFee,
        contractDate: saved.contractDate,
      });
    }

    if (saved.status === 'completed' || saved.status === 'signed') {
      setIsContractSigned(true);
      onUpdateStatus('contracted');
      toast.success('전자계약이 체결 완료되어 CRM 수임료와 사건상태가 동기화되었습니다.');
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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Next Action Hero Card (슬림 & 컴팩트 레이아웃) ── */}
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
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${
                  isContractSigned 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {isContractSigned ? 'Gate 2 통과 완료' : '지금 해야 할 핵심 작업'}
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
                      <div className="absolute right-0 top-full mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 space-y-1 text-xs animate-fadeIn">
                        <button
                          type="button"
                          onClick={() => { setShowOfflineMenu(false); handlePrintContract(); }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-lg flex items-center gap-2 text-slate-700 font-bold cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-slate-500" />
                          <span>종이 계약서 인쇄</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowOfflineMenu(false); handleConfirmInPersonContract(); }}
                          className="w-full px-3 py-2 text-left hover:bg-emerald-50 text-emerald-700 rounded-lg flex items-center gap-2 font-bold cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>서면계약 완료 처리</span>
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

      {/* ── 3. 실비·수임료 2단 산정 캔버스 (균형감 & 가독성 극대화 리디자인) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* 좌측: 🏛️ 법원 필수 실비 자동 산출 (공과금 관제) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">법원 필수 실비 산출</h4>
                  <span className="text-[10px] text-slate-400 font-medium">채권자 수 기반 2026 전자소송 공과금</span>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                전자소송 10% 감액
              </span>
            </div>

            <div className="space-y-4 pt-3 text-xs">
              {/* 채권자 수 슬라이더 및 빠른 선택 칩 */}
              <div className="space-y-2 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/70">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span>채권자 수 (금융사 + 개인채권자)</span>
                  </label>
                  <span className="text-[#1E3A5F] font-mono font-black text-sm px-2 py-0.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                    {creditorCount}개 사
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="30"
                  value={creditorCount}
                  onChange={e => {
                    setCreditorCount(Number(e.target.value));
                    setTimeout(() => syncContractState(), 50);
                  }}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                />

                {/* 채권자 수 빠른 선택 칩 */}
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">빠른 선택:</span>
                  {[3, 5, 7, 10, 15, 20].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setCreditorCount(cnt);
                        setTimeout(() => syncContractState(), 50);
                      }}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        creditorCount === cnt
                          ? 'bg-[#1E3A5F] text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cnt}곳
                    </button>
                  ))}
                </div>
              </div>

              {/* 영업소득자 여부 카드 */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isBusinessDebtor}
                    onChange={e => {
                      setIsBusinessDebtor(e.target.checked);
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className="w-4 h-4 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block text-xs">영업소득자 (외부회생위원 대상)</span>
                    <span className="text-[10px] text-slate-400">서울·수원 등 외부회생위원 선임 예납금 대상</span>
                  </div>
                </label>
                <span className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg ${isBusinessDebtor ? 'bg-blue-100 text-blue-800' : 'bg-slate-200/70 text-slate-500'}`}>
                  {isBusinessDebtor ? '+150,000원' : '해당없음'}
                </span>
              </div>

              {/* 법원 공과금 상세 영수증 명세서 */}
              <div className="bg-slate-50/90 rounded-xl p-4 border border-slate-200 space-y-2 font-mono">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[11px] font-sans font-bold text-slate-500">
                  <span>법원 납부 공과금 항목</span>
                  <span>산출 금액</span>
                </div>
                <div className="flex justify-between text-slate-700 text-xs">
                  <span className="font-sans">1. 인지대 (개시신청 + 금지명령 10% 감액)</span>
                  <span className="font-bold">{stampFee.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-slate-700 text-xs">
                  <span className="font-sans">2. 송달료 (기본 10회 + {creditorCount}곳 × 8회 = {10 + (creditorCount * 8)}회)</span>
                  <span className="font-bold">{deliveryFee.toLocaleString()}원</span>
                </div>
                {isBusinessDebtor && (
                  <div className="flex justify-between text-blue-700 text-xs">
                    <span className="font-sans">3. 외부회생위원 선임 예납금</span>
                    <span className="font-bold">+{trusteeDeposit.toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2.5 border-t border-slate-200 text-slate-900 font-sans font-black">
                  <span className="text-xs">법원 실비 합계 (소계)</span>
                  <span className="text-blue-700 font-mono text-base font-black">{totalCourtCost.toLocaleString()}원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 좌측 하단: 실무 법률 정산 가이드 팁 (여백 밸런스 & 신뢰도 강화) */}
          <div className="mt-4 p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-blue-900/90 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1 text-blue-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>법원 공과금 실비 정산 원칙</span>
            </div>
            <p className="text-[11px] text-slate-600">
              송달료 및 인지대는 법원 접수 시 전자소송 시스템에 직접 예납되는 법정 실비입니다. 채권자 수 변동이나 송달 추가 발생 시 법원 영수증 기준으로 정산됩니다.
            </p>
          </div>
        </div>

        {/* 우측: 💼 로펌 수임료 및 분납 일정 확정 (보수 관제) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Coins className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">수임료 및 분납 조건 설정</h4>
                <span className="text-[10px] text-slate-400 font-medium">착수금 + 잔금 맞춤 분납 플랜</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = contractStyle === 'simple_box' ? 'standard' : 'simple_box';
                setContractStyle(next);
                syncContractState(selectedSpecialTerms, next);
                toast.success(next === 'simple_box' ? '실무 간략 박스형 서식이 적용되었습니다.' : '표준형 서식이 적용되었습니다.');
              }}
              className={`px-2.5 py-1 text-[11px] font-black rounded-lg border transition-all cursor-pointer flex items-center gap-1 press-scale ${
                contractStyle === 'simple_box'
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="클릭하여 계약서 수임료 표기 방식을 전환합니다"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>{contractStyle === 'simple_box' ? '실무 간략 표기형 적용중' : '표준형 표기'}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Step 1: 착수금 & 계약금 설정 (콤마 지원 & 빠른 증감 칩) */}
            <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasDeposit}
                    onChange={e => {
                      const checked = e.target.checked;
                      setHasDeposit(checked);
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className="w-4 h-4 rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                  />
                  <span className="font-black text-slate-800 text-xs">계약금(가계약금) 별도 수납</span>
                </label>
                <span className="text-[10px] text-slate-400">사무실별 수납 정책에 따라 선택</span>
              </div>

              <div className={`grid ${hasDeposit ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3 pt-1`}>
                {hasDeposit && (
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">
                      계약금 (계약 체결 시 즉시)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formatWon(depositFee)}
                        onChange={e => {
                          setDepositFee(parseWon(e.target.value));
                          setTimeout(() => syncContractState(), 50);
                        }}
                        className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white shadow-2xs"
                      />
                      <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">원</span>
                    </div>
                    {/* 계약금 퀵 칩 */}
                    <div className="flex gap-1 pt-0.5">
                      {[100000, 200000, 300000, 500000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setDepositFee(amt);
                            setTimeout(() => syncContractState(), 50);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            depositFee === amt ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {amt / 10000}만
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">
                    착수금 (사건 착수 시 납부)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatWon(retainerFee)}
                      onChange={e => {
                        setRetainerFee(parseWon(e.target.value));
                        setTimeout(() => syncContractState(), 50);
                      }}
                      className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white shadow-2xs"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">원</span>
                  </div>
                  {/* 착수금 퀵 칩 */}
                  <div className="flex gap-1 pt-0.5">
                    {[500000, 1000000, 1500000, 2000000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setRetainerFee(amt);
                          setTimeout(() => syncContractState(), 50);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                          retainerFee === amt ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {amt / 10000}만
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: 잔금 분납 플랜 설정 (균등 vs 월별 수동 탭) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-slate-800">잔금 분납 방식</span>
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setInstallmentMode('equal');
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className={`px-3 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                      installmentMode === 'equal'
                        ? 'bg-white text-[#1E3A5F] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    균등 분납 (자동)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInstallmentMode('custom');
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className={`px-3 py-1 text-[11px] font-black rounded-md transition-all cursor-pointer ${
                      installmentMode === 'custom'
                        ? 'bg-white text-[#1E3A5F] shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    월별 맞춤 (수동 설정)
                  </button>
                </div>
              </div>

              {/* 2-A. 균등 분납 모드 UI */}
              {installmentMode === 'equal' ? (
                <div className="space-y-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">월 분납금 (회당)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formatWon(monthlyFee)}
                          onChange={e => {
                            const val = parseWon(e.target.value);
                            setMonthlyFee(val);
                            setCustomInstallments(prev => prev.map(item => ({ ...item, amount: val })));
                            setTimeout(() => syncContractState(), 50);
                          }}
                          className="w-full px-3 py-2 pr-7 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold text-right text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white shadow-2xs"
                        />
                        <span className="absolute right-3 top-2.5 text-slate-400 font-bold text-xs">원</span>
                      </div>
                      {/* 분납금 퀵 칩 */}
                      <div className="flex gap-1 pt-0.5">
                        {[300000, 400000, 500000, 600000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setMonthlyFee(amt);
                              setCustomInstallments(prev => prev.map(item => ({ ...item, amount: amt })));
                              setTimeout(() => syncContractState(), 50);
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              monthlyFee === amt ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {amt / 10000}만
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-700">매달 납부 약정일</label>
                      <select
                        value={paymentDayType}
                        onChange={e => {
                          setPaymentDayType(e.target.value as any);
                          setTimeout(() => syncContractState(), 50);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] bg-white cursor-pointer shadow-2xs text-xs"
                      >
                        <option value="last_day">매달 말일 (실무 권장)</option>
                        <option value="fixed_10th">매월 10일</option>
                        <option value="fixed_25th">매월 25일 (급여일)</option>
                      </select>
                      <span className="text-[10px] text-slate-400 block pt-0.5">※ 착수금 입금 익월부터 기산</span>
                    </div>
                  </div>

                  {/* 분납 회차 슬라이더 & 퀵 회차 칩 */}
                  <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                    <div className="flex justify-between items-center font-bold text-slate-700">
                      <span>분납 회차</span>
                      <span className="text-[#1E3A5F] font-mono font-black text-sm px-2 py-0.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                        {installmentMonths}회 분납
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={installmentMonths}
                      onChange={e => {
                        const count = Number(e.target.value);
                        setInstallmentMonths(count);
                        setCustomInstallments(prev => {
                          const today = new Date();
                          const list: CustomInstallmentItem[] = [];
                          for (let i = 1; i <= count; i++) {
                            const existing = prev[i - 1];
                            if (existing) {
                              list.push(existing);
                            } else {
                              const d = new Date(today.getFullYear(), today.getMonth() + i + 1, 0);
                              list.push({
                                round: i,
                                amount: monthlyFee,
                                dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                                label: `${i}회차 분납`,
                              });
                            }
                          }
                          return list;
                        });
                        setTimeout(() => syncContractState(), 50);
                      }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
                    />
                    {/* 회차 퀵 칩 */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="text-[10px] text-slate-400 font-medium mr-1">자주 쓰는 회차:</span>
                      {[2, 3, 4, 5, 6, 8, 10].map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setInstallmentMonths(m);
                            setTimeout(() => syncContractState(), 50);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                            installmentMonths === m ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {m}회
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* 2-B. 월별 수동 맞춤 분납 모드 UI */
                <div className="space-y-2.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[11px] text-slate-600 font-medium">
                      💡 회차별 원하는 납부 금액과 약정기일을 직접 지정합니다.
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomInstallments(prev =>
                            prev.map((item, idx) => ({
                              ...item,
                              amount: idx === 0 ? 1000000 : 500000,
                            }))
                          );
                          setTimeout(() => syncContractState(), 50);
                          toast.success('첫 달 100만 + 이후 50만 프리셋이 적용되었습니다.');
                        }}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                      >
                        100만+50만
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomInstallments(prev =>
                            prev.map(item => ({ ...item, amount: monthlyFee }))
                          );
                          setTimeout(() => syncContractState(), 50);
                          toast.success('균등 분납액으로 재배분되었습니다.');
                        }}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 cursor-pointer shadow-2xs"
                      >
                        균등 분할
                      </button>
                    </div>
                  </div>

                  {/* 회차 목록 리스트 */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {customInstallments.map((inst, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs"
                      >
                        <span className="w-14 text-center text-[11px] font-black text-[#1E3A5F] bg-blue-50 py-1.5 rounded-lg border border-blue-100">
                          {idx + 1}회차
                        </span>
                        <input
                          type="date"
                          value={inst.dueDate}
                          onChange={e => {
                            const newDueDate = e.target.value;
                            setCustomInstallments(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], dueDate: newDueDate };
                              return next;
                            });
                            setTimeout(() => syncContractState(), 50);
                          }}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={formatWon(inst.amount)}
                            onChange={e => {
                              const val = parseWon(e.target.value);
                              setCustomInstallments(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], amount: val };
                                return next;
                              });
                              setTimeout(() => syncContractState(), 50);
                            }}
                            className="w-full px-2.5 py-1.5 pr-6 rounded-lg border border-slate-200 text-xs font-mono font-black text-right text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F]"
                          />
                          <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-400 font-bold">원</span>
                        </div>
                        {customInstallments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomInstallments(prev => {
                                const next = prev.filter((_, i) => i !== idx).map((item, i) => ({
                                  ...item,
                                  round: i + 1,
                                  label: `${i + 1}회차 분납`,
                                }));
                                return next;
                              });
                              setTimeout(() => syncContractState(), 50);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 cursor-pointer"
                            title="회차 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomInstallments(prev => {
                          const last = prev[prev.length - 1];
                          let nextDate = '';
                          if (last && last.dueDate) {
                            const parts = last.dueDate.split('-');
                            const nextMonth = new Date(Number(parts[0]), Number(parts[1]) + 1, 0);
                            nextDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(nextMonth.getDate()).padStart(2, '0')}`;
                          } else {
                            nextDate = new Date().toISOString().split('T')[0];
                          }
                          return [
                            ...prev,
                            {
                              round: prev.length + 1,
                              amount: last ? last.amount : 500000,
                              dueDate: nextDate,
                              label: `${prev.length + 1}회차 분납`,
                            },
                          ];
                        });
                        setTimeout(() => syncContractState(), 50);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>회차 추가</span>
                    </button>
                    <span className="text-xs text-slate-600 font-mono">
                      총 {customInstallments.length}회 분납 합계: <strong className="text-slate-900">{totalInstallmentFee.toLocaleString()}원</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: 프리미엄 수임료 정산 요약 카드 (다크 영수증 스타일) */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                  <span>변호사 보수 정산 영수증</span>
                </span>
                {/* VAT 토글 */}
                <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setVatIncluded(true);
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                      vatIncluded ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    VAT 포함
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVatIncluded(false);
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                      !vatIncluded ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    VAT 별도
                  </button>
                </div>
              </div>

              {/* 금액 상세 내역 */}
              <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                {hasDeposit && (
                  <div className="flex justify-between items-center">
                    <span className="font-sans text-slate-400">· 계약금 (가계약금)</span>
                    <span className="font-bold text-white">{depositFee.toLocaleString()}원</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-sans text-slate-400">· 착수금 (사건 착수 시)</span>
                  <span className="font-bold text-white">{retainerFee.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-sans text-slate-400">
                    · 잔금 합계 ({installmentMode === 'equal' ? `${monthlyFee.toLocaleString()}원 × ${installmentMonths}회` : `${customInstallments.length}회 분납`})
                  </span>
                  <span className="font-bold text-white">{totalInstallmentFee.toLocaleString()}원</span>
                </div>
              </div>

              {/* 총 수임료 합계 바 */}
              <div className="pt-2.5 border-t border-dashed border-slate-700 flex justify-between items-end">
                <div>
                  <div className="text-[11px] text-slate-400 font-bold">
                    총 수임료 <span className="text-[10px] text-slate-400 font-normal">({vatIncluded ? '부가가치세 포함' : '부가가치세 별도'})</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                    공식 표기: <strong className="text-white font-bold">금 {numberToKoreanAmount(totalLawyerFee)} 원정</strong>
                  </div>
                </div>
                <span className="text-emerald-400 font-mono text-xl font-black">{totalLawyerFee.toLocaleString()}원</span>
              </div>

              {/* 계약서 조항 실시간 미리보기 버튼 */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClausePreview(prev => !prev)}
                  className="w-full px-3 py-1.5 bg-slate-800 hover:bg-slate-750 rounded-xl text-slate-200 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileSignature className="w-3.5 h-3.5 text-emerald-400" />
                    <span>실제 계약서 제5조 조항 실시간 문안 확인</span>
                  </span>
                  {showClausePreview ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                </button>

                {showClausePreview && (
                  <div className="mt-2 p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap border border-slate-800 max-h-52 overflow-y-auto">
                    {buildSimpleFeeClause({
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
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. 📜 계약서 4대 서식 구성 및 특약사항 확인·수정 패널 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-[#1E3A5F]" />
              <h4 className="font-black text-base text-slate-900">사건위임계약서 및 법적 서식 구성</h4>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {coreDocuments.length}종 서식 세트
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              산출된 실비와 분납 수임료가 반영된 실제 계약서입니다. 각 서식의 조항을 확인하거나 특약사항을 즉시 수정할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                ensureContract();
                setIsPreviewAllOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer press-scale"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>전체 전문 보기</span>
            </button>
            <button
              type="button"
              onClick={() => {
                ensureContract();
                setIsWizardOpen(true);
              }}
              className="px-3.5 py-2 bg-[#1E3A5F] hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer press-scale"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-300" />
              <span>전체 위자드 편집</span>
            </button>
          </div>
        </div>

        {/* 4대 서식 목록 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coreDocuments.map((doc, idx) => {
            const isMain = doc.type === 'main_contract';
            const isPoa = doc.type === 'power_of_attorney';

            return (
              <div 
                key={doc.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  isMain 
                    ? 'bg-blue-50/40 border-blue-200' 
                    : isPoa 
                    ? 'bg-purple-50/30 border-purple-200'
                    : 'bg-slate-50/60 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">
                        제{idx + 1}호: {doc.title}
                      </span>
                      {doc.signatureRequired !== 'none' && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-800">
                          {doc.signatureRequired === 'both' ? '양측 서명' : '의뢰인 서명'}
                        </span>
                      )}
                      {isPoa && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800">
                          법원 제출용
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {isMain 
                      ? `위임 사무 범위, 총 수임료 ${totalLawyerFee.toLocaleString()}원, 분납 약정 및 합의 특약사항 포함`
                      : isPoa 
                      ? `개인회생/파산 개시신청, 금지·중지명령 신청, 채권자목록 제출 일체의 소송대리 권한`
                      : doc.title.includes('개인정보') 
                      ? '사건 처리를 위한 고유식별정보(주민등록번호) 수집 및 도산시스템 조회 동의'
                      : '부채증명원 발급 및 법원 제출용 금융거래정보 제공 위임 동의'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {doc.content.length.toLocaleString()} 글자
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-slate-500" />
                      <span>조항 보기</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc(doc);
                        setIsDocEditOpen(true);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-blue-600" />
                      <span>조항 수정</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 4-2. 사건 특약사항(Special Terms) 설정 영역 ── */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-black text-slate-900">사건 맞춤 특약사항 (계약서 제1호에 자동 반영)</span>
            </div>
            <span className="text-[11px] text-slate-500">
              클릭하여 특약을 활성화/비활성화하세요.
            </span>
          </div>

          {/* 특약 프리셋 칩 목록 */}
          <div className="flex flex-wrap gap-2">
            {PRESET_SPECIAL_TERMS.map(term => {
              const isSelected = selectedSpecialTerms.includes(term.id);
              return (
                <button
                  key={term.id}
                  type="button"
                  onClick={() => handleToggleSpecialTerm(term.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer press-scale border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {isSelected ? <Check className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{term.label}</span>
                </button>
              );
            })}
          </div>

          {/* 추가된 특약 전문 미리보기 */}
          {selectedSpecialTerms.length > 0 && (
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5 text-slate-700">
              <span className="font-bold text-[11px] text-blue-800 block">현재 적용된 특약 조항 ({selectedSpecialTerms.length}건):</span>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                {selectedSpecialTerms.map((termId, i) => {
                  const preset = PRESET_SPECIAL_TERMS.find(p => p.id === termId);
                  return (
                    <li key={i}>
                      <strong>{preset?.label || `사용자 지정 특약 ${i + 1}`}:</strong> {preset?.text || termId}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 커스텀 특약 직접 작성 */}
          {!showAddCustomTerm ? (
            <button
              type="button"
              onClick={() => setShowAddCustomTerm(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>직접 특약 조항 작성하여 추가하기</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 pt-1 animate-fadeIn">
              <input
                type="text"
                placeholder="예: 보정권고 2회 초과 시에도 추가 수임료 일체 면제"
                value={customSpecialTerm}
                onChange={e => setCustomSpecialTerm(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCustomTerm(); }}
                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddCustomTerm}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
              >
                특약 반영
              </button>
              <button
                type="button"
                onClick={() => { setShowAddCustomTerm(false); setCustomSpecialTerm(''); }}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 5. 의뢰인 총 부담금 종합 바 & 완료 이동 버튼 ── */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xs text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[10px] text-slate-400 block font-bold">의뢰인 총 부담 예정액 (실비 + 수임료)</span>
            <span className="font-mono text-lg font-black text-emerald-400">{grandTotal.toLocaleString()}원</span>
          </div>
          <div className="h-6 w-px bg-slate-700" />
          <div className="text-[11px] text-slate-300">
            <span>법원실비 {totalCourtCost.toLocaleString()}원 + 변호사보수 {totalLawyerFee.toLocaleString()}원</span>
          </div>
        </div>

        {isContractSigned ? (
          <button
            type="button"
            onClick={onAdvanceToNextStage}
            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <span>Stage 3 (고객정보·서류수집)로 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSendElectronicContract}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-emerald-300" />
            <span>모바일 전자계약서 발송하기</span>
          </button>
        )}
      </div>

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
            lawFirmName: activeLawyer.lawFirmName || '법무법인 로앤',
            totalFee: Math.round(totalLawyerFee / 10000),
            contractDate: contract?.contractDate || new Date().toISOString().split('T')[0],
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
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
            <div className="p-3 border-t border-slate-100 bg-white flex justify-end gap-2">
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
      )}

      {/* 6-5. 계약서 전체 통합 미리보기 모달 */}
      {isPreviewAllOpen && contract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-[#1E3A5F]" />
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    {clientRequest.clientName} 의뢰인 전자계약서 패키지 전문 미리보기
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
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
                      <Edit3 className="w-3 h-3" />
                      <span>수정</span>
                    </button>
                  </div>
                  <div className="text-xs font-mono leading-relaxed bg-slate-50/70 p-4 rounded-lg border border-slate-100">
                    <HighlightedDocumentViewer content={d.content} />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">
                ✓ 법무법인 로앤 표준 도산 사건 위임약관 및 전자서명법 제3조 규격 준수
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
      )}
    </div>
  );
}
