import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileCheck2, Calculator, Send, CheckCircle2, AlertTriangle, 
  Coins, UserCheck, Calendar, ArrowRight, ShieldAlert, Sparkles,
  ExternalLink, FileText, Phone, Clock, Eye, Edit3, Printer,
  Plus, Check, X, ShieldCheck, ChevronRight, FileSignature,
  Download, Layers, AlertCircle, Copy, CheckSquare, Square
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
import ContractWizard from '../ContractWizard';
import { ContractDocEditModal } from '../ContractDocEditModal';
import ClientSignShareModal from '../ClientSignShareModal';
import { HighlightedDocumentViewer } from '../../common/HighlightedDocumentViewer';

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
  // ── 1. 수임료·실비 파라미터 상태 ──
  const [creditorCount, setCreditorCount] = useState<number>(() => {
    return (crmExt?.debtCertificateOrders?.[0]?.items || []).length || (clientRequest as any)?.creditorCount || 5;
  });
  const [isBusinessDebtor, setIsBusinessDebtor] = useState(() => {
    return (clientRequest as any)?.category === 'business' || (clientRequest as any)?.jobType === 'business';
  });
  const [retainerFee, setRetainerFee] = useState<number>(() => {
    return crmExt?.feeSchedule?.[0]?.amount || (crmExt?.totalFee ? Math.round(crmExt.totalFee * 0.3) : 500000);
  });
  const [monthlyFee, setMonthlyFee] = useState<number>(() => {
    return crmExt?.feeSchedule?.[1]?.amount || 300000;
  });
  const [installmentMonths, setInstallmentMonths] = useState<number>(() => {
    return crmExt?.feeSchedule?.length ? Math.max(1, crmExt.feeSchedule.length - 1) : 4;
  });
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

  // 법원 실비 계산 공식 (2026 전자소송 기준)
  const stampFee = 28800; // 인지대: 개시 27,000 + 금지명령 1,800
  const deliveryFee = 5200 * (10 + (creditorCount * 8)); // 송달료
  const trusteeDeposit = isBusinessDebtor ? 150000 : 0; // 외부회생위원 선임 예납금
  const totalCourtCost = stampFee + deliveryFee + trusteeDeposit;

  // 총 변호사 수임료 (원화)
  const totalLawyerFee = retainerFee + (monthlyFee * installmentMonths);
  // 의뢰인 총 부담금
  const grandTotal = totalCourtCost + totalLawyerFee;

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

  // 분납 일정 계산 함수
  const buildFeeSchedule = (): FeeInstallment[] => {
    const today = new Date();
    const schedule: FeeInstallment[] = [
      {
        round: 1,
        dueDate: today.toISOString().split('T')[0],
        amount: retainerFee,
        status: 'pending',
        label: '착수금 (1회차)',
      }
    ];
    for (let i = 1; i <= installmentMonths; i++) {
      const d = new Date(today);
      d.setMonth(today.getMonth() + i);
      schedule.push({
        round: i + 1,
        dueDate: d.toISOString().split('T')[0],
        amount: monthlyFee,
        status: 'pending',
        label: `월 분납금 (${i + 1}회차)`,
      });
    }
    return schedule;
  };

  // 금액/실비 변경 시 활성 계약서 인스턴스 실시간 반영
  const syncContractState = (customTermsList: string[] = selectedSpecialTerms) => {
    if (!contract) return null;
    const schedule = buildFeeSchedule();
    const lawyerFeeManwon = Math.round(totalLawyerFee / 10000);

    // 특약사항 텍스트 생성
    const termsTexts = customTermsList.map(id => {
      const preset = PRESET_SPECIAL_TERMS.find(p => p.id === id);
      return preset ? preset.text : id;
    });

    // 제1호 사건위임계약서 본문 특약 조항 업데이트
    const updatedDocs = contract.documents.map(d => {
      if (d.type === 'main_contract') {
        const headerMarker = '════════════════════════════════════════════════\n[특약사항 (당사자 합의 특약)]';
        const base = d.content.split(headerMarker)[0].trimEnd();
        if (termsTexts.length === 0) return { ...d, content: base };
        const termsBody = termsTexts.map((t, idx) => `제 ${idx + 1} 항: ${t}`).join('\n\n');
        return {
          ...d,
          content: `${base}\n\n${headerMarker}\n${termsBody}\n════════════════════════════════════════════════`
        };
      }
      return d;
    });

    const updatedContract: ElectronicContract = {
      ...contract,
      totalFee: lawyerFeeManwon,
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
  const handleSendElectronicContract = () => {
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
          <div style="white-space: pre-wrap; font-size: 12px; min-height: 520px; background: #f8fafc; padding: 24px; border-radius: 8px; border: 1px solid #e2e8f0; line-height: 1.8;">
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

  // ── 6. 서면계약 수동 완료 처리 ──
  const handleConfirmInPersonContract = async () => {
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
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 02 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            법원 실비·수임료 산출, 계약서 조항·특약 검토 및 모바일 전자계약 체결
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">계약 상태:</span>
          <span className={`font-bold px-2.5 py-0.5 rounded-lg border ${
            isContractSigned 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isContractSigned ? '✓ 정식 수임 체결 완료' : '서명 대기중'}
          </span>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card (1 Major + 1~2 Minor 원칙) ── */}
      <div className={`p-5 rounded-2xl border transition-all shadow-xs ${
        isContractSigned 
          ? 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950' 
          : 'bg-white border-slate-200 text-slate-900'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 mt-0.5 ${
              isContractSigned ? 'bg-emerald-600 text-white shadow-xs' : 'bg-[#1E3A5F] text-white shadow-xs'
            }`}>
              {isContractSigned ? <CheckCircle2 className="w-5 h-5" /> : <FileCheck2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {isContractSigned ? 'Gate 2 통과 완료' : '지금 해야 할 핵심 작업'}
                </span>
                <span className="text-sm font-black tracking-tight">
                  {isContractSigned 
                    ? '정식 위임계약이 완료되었습니다. 소송위임장을 확인하거나 3단계로 진행하세요.' 
                    : '계약 조항과 특약사항을 검토한 후, 의뢰인 스마트폰으로 전자계약서를 전송하세요.'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {isContractSigned 
                  ? '체결된 계약서와 소송대리 위임장이 안전하게 보관되었습니다. 3단계(고객정보·서류수집)로 진행하세요.' 
                  : '카카오 알림톡으로 스마트폰 전자서명 링크를 발송하거나, 방문 대면 고객인 경우 즉시 서면 인쇄하여 종이 체결합니다.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {!isContractSigned ? (
              <>
                <button
                  type="button"
                  onClick={handleSendElectronicContract}
                  className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                  <span>모바일 전자계약서 발송 (Major)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewAllOpen(true)}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="현재 설정된 수임료·특약이 반영된 계약서 전문 열람"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>계약서 미리보기</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsWizardOpen(true)}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="계약서 6단계 전체 정보(위임인, 계좌, 도장 등) 상세 수정"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  <span>계약내용 상세 수정</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintContract}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="대면 방문 고객용 종이 서면계약서 인쇄"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>서면 인쇄</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmInPersonContract}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  title="방문 상담 등으로 이미 종이 서면 계약서를 체결한 경우"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>서면계약 완료 처리</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onAdvanceToNextStage}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
                >
                  <span>Stage 3 (서류수집)로 진행</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewAllOpen(true)}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Eye className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  <span>체결된 계약서 열람</span>
                </button>

                {onOpenPowerOfAttorneyModal && (
                  <button
                    type="button"
                    onClick={onOpenPowerOfAttorneyModal}
                    className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    <span>소송위임장 발급</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handlePrintContract}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>재인쇄</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. 실비·수임료 2단 산정 캔버스 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 2026 전자소송 법원 실비 계산기 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#1E3A5F]" />
              <h4 className="font-black text-sm text-slate-900">법원 필수 실비 자동 산출</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-bold">2026 전자소송 요율 기준</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>채권자 수 (금융사 + 개인채권자)</span>
                <span className="text-[#1E3A5F] font-mono font-bold">{creditorCount}개 사</span>
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
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
              />
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBusinessDebtor}
                  onChange={e => {
                    setIsBusinessDebtor(e.target.checked);
                    setTimeout(() => syncContractState(), 50);
                  }}
                  className="rounded text-[#1E3A5F] border-slate-300 focus:ring-[#1E3A5F]"
                />
                <span className="font-bold text-slate-800">영업소득자 (외부회생위원 예납금 15만원 대상)</span>
              </label>
              <span className={`font-mono font-bold ${isBusinessDebtor ? 'text-blue-600' : 'text-slate-400'}`}>
                {isBusinessDebtor ? '+150,000원' : '해당없음'}
              </span>
            </div>

            {/* 실비 상세 내역 */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
              <div className="flex justify-between">
                <span>1. 인지대 (개시신청 + 금지명령 10% 감액)</span>
                <span className="font-mono font-bold text-slate-800">{stampFee.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span>2. 송달료 (기본 10회 + {creditorCount}곳 × 8회 = {10 + (creditorCount * 8)}회)</span>
                <span className="font-mono font-bold text-slate-800">{deliveryFee.toLocaleString()}원</span>
              </div>
              {isBusinessDebtor && (
                <div className="flex justify-between">
                  <span>3. 외부회생위원 선임 예납금</span>
                  <span className="font-mono font-bold text-slate-800">{trusteeDeposit.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100 font-extrabold text-slate-900">
                <span>법원 실비 소계</span>
                <span className="text-blue-600 font-mono text-sm">{totalCourtCost.toLocaleString()}원</span>
              </div>
            </div>
          </div>
        </div>

        {/* 우측: 로펌 수임료 및 분납 일정 확정 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-600" />
              <h4 className="font-black text-sm text-slate-900">수임료 및 분납 조건 설정</h4>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              무이자 분납 지원
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">착수금 (계약 시 납부)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="50000"
                    value={retainerFee}
                    onChange={e => {
                      setRetainerFee(Number(e.target.value));
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-medium">원</span>
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">월 분납금 (회당)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="50000"
                    value={monthlyFee}
                    onChange={e => {
                      setMonthlyFee(Number(e.target.value));
                      setTimeout(() => syncContractState(), 50);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-medium">원</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-bold text-slate-700 mb-1">
                <span>분납 회차</span>
                <span className="text-[#1E3A5F] font-mono font-bold">{installmentMonths}회 분납</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                value={installmentMonths}
                onChange={e => {
                  setInstallmentMonths(Number(e.target.value));
                  setTimeout(() => syncContractState(), 50);
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1E3A5F]"
              />
            </div>

            {/* 수임료 및 총액 요약 */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-slate-600">
              <div className="flex justify-between">
                <span>착수금 1회</span>
                <span className="font-mono font-bold text-slate-800">{retainerFee.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between">
                <span>분납 합계 ({monthlyFee.toLocaleString()}원 × {installmentMonths}회)</span>
                <span className="font-mono font-bold text-slate-800">{(monthlyFee * installmentMonths).toLocaleString()}원</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 font-extrabold text-slate-900">
                <span>총 수임료 (부가세 별도/포함 합의)</span>
                <span className="text-emerald-600 font-mono text-sm">{totalLawyerFee.toLocaleString()}원</span>
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
              onClick={() => setIsPreviewAllOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer press-scale"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>전체 전문 보기</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
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
      {isWizardOpen && contract && (
        <ContractWizard
          contract={contract}
          onClose={() => setIsWizardOpen(false)}
          onSave={handleWizardSave}
        />
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
