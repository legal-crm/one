import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, ArrowRight, User, CreditCard, FileText, Shield, 
  PenTool, Eye, Plus, Trash2, GripVertical, Check, X, AlertTriangle, 
  Download, Loader2, Building2, Smartphone, Lock, CheckCircle2, 
  Share2, ShieldCheck, RefreshCw, Clock, ChevronDown, ChevronUp, ExternalLink,
  FolderKanban, Edit3, RotateCcw, Highlighter, ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import type { ElectronicContract, ContractDocument, ContractDocType, FeeInstallment } from '../../types';
import { CONTRACT_DOC_TYPES } from '../../types';
import { calculateCourtCosts, generateFeeSchedule, saveContract, getContract, addAuditLog, updateContractStatus, finalizeContractWithIntegrity } from '../../services/contractService';
import { validateBusinessRegistration } from '../../services/ntsService';
import { 
  STANDARD_LEGAL_TEMPLATES, 
  templateToContractDocument, 
  LawyerContractTemplate 
} from '../../services/contractTemplateService';
import SignatureCanvas from './SignatureCanvas';
import AuditTrailCertificate from './AuditTrailCertificate';
import ClientSignShareModal from './ClientSignShareModal';
import LegalContractTermsModal, { TermKey, LEGAL_TERMS_DATA } from '../common/LegalContractTermsModal';
import { ContractDocEditModal } from './ContractDocEditModal';
import { ContractDocLibraryModal } from './ContractDocLibraryModal';
import { HighlightedDocumentViewer } from '../common/HighlightedDocumentViewer';
import { generateCourtSubmissionPdf } from '../../services/contractPdfService';
import ContractPublicVerifierModal from '../common/ContractPublicVerifierModal';

interface Props {
  contract: ElectronicContract;
  onClose: () => void;
  onSave: (contract: ElectronicContract) => void;
}

const STEPS = [
  { key: 'client', label: '위임인·사업자 정보', icon: User },
  { key: 'fee', label: '수임료 및 스케줄', icon: CreditCard },
  { key: 'documents', label: '계약 문서 관리', icon: FileText },
  { key: 'terms', label: '약관·동의 안내', icon: Shield },
  { key: 'signature', label: '변호사 서명·고객 발송', icon: PenTool },
  { key: 'preview', label: '미리보기·감사증서', icon: Eye },
];

export default function ContractWizard({ contract: initialContract, onClose, onSave }: Props) {
  const dialog = useDialog();
  const [step, setStep] = useState(0);
  const [c, setC] = useState<ElectronicContract>(() => ({
    ...initialContract,
    courtCosts: initialContract.courtCosts || { creditorCount: 5, deliveryFee: 0, stampFee: 0, miscFee: 0 },
    feeSchedule: initialContract.feeSchedule || [],
    documents: initialContract.documents || [],
    auditTrail: initialContract.auditTrail || [],
  }));

  // 문서 편집 및 문서함 모달 상태
  const [editingDoc, setEditingDoc] = useState<ContractDocument | null>(null);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [expandedDocPreviews, setExpandedDocPreviews] = useState<Record<string, boolean>>({});

  // 사업자 검증 상태
  const [isBusiness, setIsBusiness] = useState<boolean>(c.isBusiness ?? false);
  const [bizCompany, setBizCompany] = useState(c.businessInfo?.companyName || '');
  const [bizNumber, setBizNumber] = useState(c.businessInfo?.businessNumber || '');
  const [bizRepName, setBizRepName] = useState(c.businessInfo?.representativeName || c.clientName || '');
  const [bizOpenDate, setBizOpenDate] = useState(c.businessInfo?.openingDate || '20200101');
  const [checkingNts, setCheckingNts] = useState(false);
  const [ntsStatus, setNtsStatus] = useState<'VALID' | 'INVALID' | 'CLOSED' | 'SUSPENDED' | 'PENDING'>(
    c.businessInfo?.ntsStatus || 'PENDING'
  );

  // 강제 스크롤 열람 검증
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // 원격 서명 링크 모달 및 상태 갱신
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [refreshingSign, setRefreshingSign] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // 분납 생성기 상태
  const [downPayment, setDownPayment] = useState(50);
  const [installments, setInstallments] = useState(3);
  const [downDate, setDownDate] = useState(c.contractDate || new Date().toISOString().slice(0, 10));
  const [firstDate, setFirstDate] = useState(c.contractDate || new Date().toISOString().slice(0, 10));

  // 약관 동의 (4대 효력 필수 항목) 및 상세 전문 열람 상태
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [agreeThirdParty, setAgreeThirdParty] = useState(true);
  const [agreeProcedure, setAgreeProcedure] = useState(true);
  const [agreeLegalEffect, setAgreeLegalEffect] = useState(true);
  const [selectedTermKey, setSelectedTermKey] = useState<TermKey | null>(null);
  const [expandedTerms, setExpandedTerms] = useState<Record<string, boolean>>({});

  const update = (patch: Partial<ElectronicContract>) => setC(prev => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));

  const handleSave = () => {
    const updated = addAuditLog(c, '계약서 임시 저장', 'lawyer');
    saveContract(updated);
    onSave(updated);
    toast.success('계약서가 저장되었습니다');
  };

  // 국세청 사업자 진위확인 실행
  const handleCheckNts = async () => {
    if (!bizNumber.replace(/\D/g, '')) {
      toast.error('사업자등록번호 10자리를 입력해주세요');
      return;
    }
    setCheckingNts(true);
    const res = await validateBusinessRegistration({
      businessNumber: bizNumber,
      openingDate: bizOpenDate,
      representativeName: bizRepName,
    });
    setCheckingNts(false);

    if (res.success && res.isValid && res.status === 'VALID') {
      setNtsStatus('VALID');
      update({
        isBusiness: true,
        businessInfo: {
          businessNumber: bizNumber.replace(/\D/g, ''),
          companyName: bizCompany || `${bizRepName} 상호`,
          representativeName: bizRepName,
          openingDate: bizOpenDate.replace(/\D/g, ''),
          ntsStatus: 'VALID',
          ntsCheckedAt: res.checkedAt,
          ntsTxId: res.txId,
        },
        authorityStatus: 'REPRESENTATIVE_VERIFIED',
      });
      toast.success(`[국세청 확인 완료] ${res.statusName} (${res.taxType})`);
    } else {
      setNtsStatus(res.status);
      toast.error(res.error || `국세청 확인 결과: ${res.statusName}`);
    }
  };

  // ─── Step 1: 위임인 및 사업자 정보 ───
  const renderClientInfo = () => (
    <div className="space-y-6">
      
      {/* 개인 vs 사업자 전환 탭 */}
      <div className="bg-slate-100 p-1 rounded-xl flex max-w-sm">
        <button
          type="button"
          onClick={() => { setIsBusiness(false); update({ isBusiness: false }); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            !isBusiness ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-3.5 h-3.5" /> 개인 의뢰인
        </button>
        <button
          type="button"
          onClick={() => { setIsBusiness(true); update({ isBusiness: true }); }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            isBusiness ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" /> 사업자 (개인·법인)
        </button>
      </div>

      {/* 사업자등록증 국세청 검증 영역 (사업자 선택 시 노출) */}
      {isBusiness && (
        <div className="bg-slate-50 border-2 border-brand/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand" />
              <span>국세청 사업자등록 진위확인 (권한성 검증)</span>
            </h4>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              ntsStatus === 'VALID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {ntsStatus === 'VALID' ? '✅ 정상 계속사업자 확인' : '⏳ 국세청 진위확인 필요'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">상호명 (법인/개인)</label>
              <input 
                value={bizCompany} 
                onChange={e => setBizCompany(e.target.value)} 
                placeholder="(주)로앤컴퍼니 / 스타트업" 
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">대표자 성명 (사업자등록증 기준)</label>
              <input 
                value={bizRepName} 
                onChange={e => {
                  setBizRepName(e.target.value);
                  update({ clientName: e.target.value });
                }} 
                placeholder="홍길동" 
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-900 font-bold" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">사업자등록번호 (10자리)</label>
              <input 
                value={bizNumber} 
                onChange={e => setBizNumber(e.target.value)} 
                placeholder="123-45-67890" 
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono text-slate-900" 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">개업일자 (YYYYMMDD)</label>
              <div className="flex gap-2">
                <input 
                  value={bizOpenDate} 
                  onChange={e => setBizOpenDate(e.target.value)} 
                  placeholder="20200501" 
                  className="flex-1 bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs font-mono text-slate-900" 
                />
                <button
                  type="button"
                  onClick={handleCheckNts}
                  disabled={checkingNts}
                  className="px-4 py-2 bg-brand text-white font-bold rounded-xl text-xs hover:bg-brand/90 cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1 shadow-xs"
                >
                  {checkingNts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>국세청 검증</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            ※ 국세청 공공데이터 API를 통해 폐업·휴업 여부 및 대표자 성명 일치를 실시간 대조하여 계약서 위조를 방지합니다.
          </p>
        </div>
      )}

      {/* 기본 의뢰인 인적사항 */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-800">👤 위임인 인적사항</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">의뢰인 성명</label>
            <input value={c.clientName} onChange={e => update({ clientName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">연락처 (스마트폰 번호)</label>
            <input value={c.clientPhone} onChange={e => update({ clientPhone: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400 font-mono" placeholder="010-0000-0000" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">주소 (선택)</label>
            <input value={c.clientAddress || ''} onChange={e => update({ clientAddress: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900 placeholder-slate-400" placeholder="서울시 서초구..." />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-3">수임인 정보</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">법무법인명</label>
            <input value={c.lawFirmName} onChange={e => update({ lawFirmName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block">담당 변호사</label>
            <input value={c.lawyerName} onChange={e => update({ lawyerName: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900" />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 mb-1.5 block">계약일자</label>
        <input type="date" value={c.contractDate} onChange={e => update({ contractDate: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 text-slate-900" />
      </div>
    </div>
  );

  // ─── Step 2: 수임료 및 스케줄 ───
  const renderFeeSchedule = () => {
    const costs = calculateCourtCosts(c.courtCosts?.creditorCount || 0);
    const totalCourt = costs.total + (c.courtCosts?.miscFee || 0);
    const totalWithCourt = (c.totalFee || 0) * 10000 + totalCourt;
    const scheduleTotal = (c.feeSchedule || []).reduce((s, f) => s + (f.amount || 0), 0);

    return (
      <div className="space-y-6">
        <h3 className="text-base font-black text-slate-800">💰 수임료 및 분납 스케줄</h3>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">📋 법원 비용 산출 (자동)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400">채권자 수</label>
              <input type="number" min={0} value={c.courtCosts.creditorCount} onChange={e => update({ courtCosts: { ...c.courtCosts, creditorCount: +e.target.value } })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">송달료 (자동)</label>
              <input type="text" readOnly value={`${costs.deliveryFee.toLocaleString()}원`} className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm mt-1 text-slate-500" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">인지대 (고정)</label>
              <input type="text" readOnly value={`${costs.stampFee.toLocaleString()}원`} className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm mt-1 text-slate-500" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">기타 공과금</label>
              <input type="number" min={0} value={c.courtCosts.miscFee} onChange={e => update({ courtCosts: { ...c.courtCosts, miscFee: +e.target.value } })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm mt-1" />
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-700">💳 총 수임료 설정 (필수)</h4>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <input 
                type="number" 
                min={0} 
                value={c.totalFee} 
                onChange={e => update({ totalFee: +e.target.value })} 
                className="w-48 px-4 py-2.5 border border-slate-200 rounded-xl text-base font-black text-slate-900 bg-white" 
              />
              <span className="text-sm font-bold text-slate-600">만원</span>
              <span className="text-xs text-slate-400">(= {((c.totalFee || 0) * 10000).toLocaleString()}원)</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-bold text-slate-600">분납 스케줄 자동 생성기</h5>
              <button 
                type="button"
                onClick={() => {
                  const schedule = generateFeeSchedule(c.totalFee * 10000, downPayment * 10000, installments, downDate, firstDate);
                  update({ feeSchedule: schedule });
                  toast.success('스케줄이 적용되었습니다');
                }} 
                className="text-[11px] font-bold text-white bg-brand px-3 py-1.5 rounded-lg cursor-pointer hover:bg-brand/90 whitespace-nowrap shadow-xs"
              >
                🔄 스케줄 적용
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400">착수금(계약금)</label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="number" value={downPayment} onChange={e => setDownPayment(+e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm bg-white" />
                  <span className="text-[11px] text-slate-400 shrink-0">만원</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">착수금 납부일</label>
                <input type="date" value={downDate} onChange={e => setDownDate(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm mt-1 bg-white" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">잔금 분할 횟수</label>
                <select value={installments} onChange={e => setInstallments(+e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm mt-1 bg-white">
                  {[2, 3, 4, 5, 6, 9, 12].map(n => <option key={n} value={n}>{n}개월</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">1회차 시작일</label>
                <input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm mt-1 bg-white" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600">스케줄 합계</span>
              <span className={`text-sm font-black ${scheduleTotal === c.totalFee * 10000 ? 'text-emerald-600' : 'text-red-500'}`}>
                {scheduleTotal.toLocaleString()}원 {scheduleTotal !== c.totalFee * 10000 && '(총 수임료와 불일치)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Step 3: 계약 문서 관리 ───
  const handleRestoreStandard7Docs = async () => {
    const confirmed = await dialog.confirm({
      title: '7대 표준서식 일괄 복원',
      message: '현재 편집된 문서 목록을 대한변호사협회 표준 7대 계약문서(위임계약서, 동의서, 위임장, 분납약정서 등)로 초기화하시겠습니까? (현재 입력된 의뢰인/변호사 정보가 자동 반영됩니다)',
      confirmText: '복원하기',
      variant: 'warning',
    });
    if (!confirmed) return;

    const std7Types: ContractDocType[] = [
      'main_contract', 'privacy_consent', 'third_party_consent', 
      'power_of_attorney', 'installment_agreement', 'procedure_consent', 'id_confirmation'
    ];

    const newDocs: ContractDocument[] = std7Types.map((type, i) => {
      const stdTpl = STANDARD_LEGAL_TEMPLATES.find(t => t.type === type) || STANDARD_LEGAL_TEMPLATES[0];
      return templateToContractDocument(stdTpl, {
        clientName: c.clientName,
        clientPhone: c.clientPhone,
        clientAddress: c.clientAddress,
        lawyerName: c.lawyerName,
        lawFirmName: c.lawFirmName,
        totalFee: c.totalFee,
        contractDate: c.contractDate,
      }, i);
    });

    update({ documents: newDocs });
    toast.success('7대 법률 표준문서 세트로 복원되었습니다.');
  };

  const handleDeleteDoc = async (doc: ContractDocument) => {
    const isRequiredDoc = ['main_contract', 'privacy_consent', 'third_party_consent', 'power_of_attorney'].includes(doc.type);
    const message = isRequiredDoc
      ? `"${doc.title}" 문서는 회생·파산 사건의 법정 필수 서식입니다. 삭제 시 전자계약 체결 및 법원 접수에 중대한 결함이 발생할 수 있습니다. 정말 삭제하시겠습니까?`
      : `"${doc.title}" 문서를 계약서에서 완전히 삭제하시겠습니까?`;

    const confirmed = await dialog.confirm({
      title: isRequiredDoc ? '⚠️ 필수 법률 문서 삭제 경고' : '계약 문서 삭제',
      message,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    update({ documents: c.documents.filter(d => d.id !== doc.id) });
    toast.success(`"${doc.title}" 문서가 삭제되었습니다.`);
  };

  const renderDocuments = () => {
    const sortedDocs = [...c.documents].sort((a, b) => a.order - b.order);

    return (
      <div className="space-y-6">
        {/* 상단 툴바 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand" />
              <span>계약 문서 관리 & 사무소 문서함</span>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                총 {c.documents.length}종 (선택 {c.documents.filter(d => d.included).length}종)
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              각 문서별 본문 내용, 특약사항, 형광펜 강조 및 고객 직접 확약 타이핑 문구를 자유롭게 편집할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. 문서함에서 서식 불러오기 */}
            <button
              type="button"
              onClick={() => setLibraryModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-indigo-200 whitespace-nowrap shadow-2xs"
            >
              <FolderKanban className="w-4 h-4 text-indigo-600" />
              <span>📂 문서함에서 불러오기</span>
            </button>

            {/* 2. 새 빈 문서 작성 */}
            <button
              type="button"
              onClick={() => {
                const newDoc: ContractDocument = {
                  id: `doc-${Date.now()}`,
                  type: 'custom',
                  title: '새 문서',
                  content: `새 문서 제목\n\n위임인: ${c.clientName || '의뢰인'}\n수임인: ${c.lawFirmName} ${c.lawyerName}\n\n제 1 조 (목적)\n본 조항의 내용을 입력하세요.`,
                  signatureRequired: 'both',
                  order: c.documents.length,
                  included: true,
                };
                update({ documents: [...c.documents, newDoc] });
                setEditingDoc(newDoc);
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-brand bg-brand/10 hover:bg-brand/20 px-3.5 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>새 문서 작성</span>
            </button>

            {/* 3. 기본 7대 표준문서 복원 */}
            <button
              type="button"
              onClick={handleRestoreStandard7Docs}
              className="flex items-center gap-1 px-3 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              title="대한변호사협회 7대 표준 문서로 초기화 복원합니다"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>표준양식 복원</span>
            </button>
          </div>
        </div>

        {/* 문서 목록 카드들 */}
        <div className="space-y-3">
          {sortedDocs.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
              <p className="text-sm font-bold text-slate-600">포함된 계약 문서가 없습니다.</p>
              <p className="text-xs text-slate-400">우측 상단의 [문서함에서 불러오기] 또는 [표준양식 복원] 버튼을 눌러 문서를 추가해 주세요.</p>
              <button
                type="button"
                onClick={handleRestoreStandard7Docs}
                className="px-4 py-2 bg-[#1E3A5F] text-white font-bold text-xs rounded-xl shadow-xs"
              >
                7대 표준 문서 일괄 추가
              </button>
            </div>
          ) : (
            sortedDocs.map((doc, i) => {
              const hasHighlight = doc.content?.includes('==');
              const hasConfirmation = Boolean(doc.requiredConfirmationText);
              const isExpanded = expandedDocPreviews[doc.id] ?? false;

              return (
                <div
                  key={doc.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    doc.included ? 'border-brand/30 bg-white shadow-xs' : 'border-slate-200 bg-slate-50/60 opacity-60'
                  }`}
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* 체크박스 & 타이틀 영역 */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-300 shrink-0 hidden sm:block" />
                      
                      <input
                        type="checkbox"
                        checked={doc.included}
                        onChange={e => {
                          const docs = [...c.documents];
                          const idx = docs.findIndex(d => d.id === doc.id);
                          if (idx >= 0) docs[idx] = { ...docs[idx], included: e.target.checked };
                          update({ documents: docs });
                        }}
                        className="w-4 h-4 rounded accent-brand cursor-pointer shrink-0"
                      />

                      <span className="text-xl shrink-0">
                        {CONTRACT_DOC_TYPES[doc.type]?.emoji || '📎'}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {doc.title}
                          </span>

                          {/* 서명 주체 뱃지 */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            doc.signatureRequired === 'both' ? 'bg-indigo-50 text-indigo-700' :
                            doc.signatureRequired === 'client' ? 'bg-amber-50 text-amber-700' :
                            doc.signatureRequired === 'lawyer' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {doc.signatureRequired === 'both' ? '양측 서명' :
                             doc.signatureRequired === 'client' ? '의뢰인 서명' :
                             doc.signatureRequired === 'lawyer' ? '변호사 서명' : '서명 불필요'}
                          </span>

                          {/* 형광펜 배지 */}
                          {hasHighlight && (
                            <span className="text-[10px] font-bold text-amber-800 bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-300 flex items-center gap-1">
                              <Highlighter className="w-3 h-3 text-amber-600" />
                              <span>형광펜 강조 조항 있음</span>
                            </span>
                          )}

                          {/* 필수 확약 문구 배지 */}
                          {hasConfirmation && (
                            <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-700" />
                              <span>직접확약: "{doc.requiredConfirmationText}"</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{CONTRACT_DOC_TYPES[doc.type]?.description || '사무소 자체 약정 서식'}</span>
                          <span>•</span>
                          <span>약 {(doc.content || '').length.toLocaleString()}자</span>
                        </div>
                      </div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {/* 미리보기 아코디언 토글 */}
                      <button
                        type="button"
                        onClick={() => setExpandedDocPreviews(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? '닫기' : '미리보기'}</span>
                      </button>

                      {/* 본문 상세 편집 */}
                      <button
                        type="button"
                        onClick={() => setEditingDoc(doc)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>내용 상세 편집</span>
                      </button>

                      {/* 삭제 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                        title="문서 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                  {/* 인라인 미리보기 영역 (형광펜 마킹 렌더링) */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
                      <div className="p-4 bg-white border border-slate-200 rounded-xl max-h-56 overflow-y-auto">
                        <HighlightedDocumentViewer
                          content={doc.content}
                          requiredConfirmationText={doc.requiredConfirmationText}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                        <span>실제 의뢰인 스마트폰 및 계약서 전문에 이와 동일하게 렌더링됩니다.</span>
                        <button
                          type="button"
                          onClick={() => setEditingDoc(doc)}
                          className="text-brand font-bold underline cursor-pointer"
                        >
                          조항 문구 및 형광펜 수정하기
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

        {/* 문서 상세 편집 모달 */}
        <ContractDocEditModal
          isOpen={!!editingDoc}
          doc={editingDoc}
          contractContext={{
            clientName: c.clientName,
            clientPhone: c.clientPhone,
            clientAddress: c.clientAddress,
            lawyerName: c.lawyerName,
            lawFirmName: c.lawFirmName,
            totalFee: c.totalFee,
            contractDate: c.contractDate,
          }}
          onClose={() => setEditingDoc(null)}
          onSave={(updatedDoc) => {
            const docs = [...c.documents];
            const idx = docs.findIndex(d => d.id === updatedDoc.id);
            if (idx >= 0) {
              docs[idx] = updatedDoc;
            } else {
              docs.push(updatedDoc);
            }
            update({ documents: docs });
          }}
        />

        {/* 사무소 문서함 (서식 보관함) 모달 */}
        <ContractDocLibraryModal
          isOpen={libraryModalOpen}
          onClose={() => setLibraryModalOpen(false)}
          contractContext={{
            clientName: c.clientName,
            clientPhone: c.clientPhone,
            clientAddress: c.clientAddress,
            lawyerName: c.lawyerName,
            lawFirmName: c.lawFirmName,
            totalFee: c.totalFee,
            contractDate: c.contractDate,
          }}
          lawyerName={c.lawyerName}
          lawFirmName={c.lawFirmName}
          onSelectTemplate={(tpl: LawyerContractTemplate) => {
            const newDoc = templateToContractDocument(tpl, {
              clientName: c.clientName,
              clientPhone: c.clientPhone,
              clientAddress: c.clientAddress,
              lawyerName: c.lawyerName,
              lawFirmName: c.lawFirmName,
              totalFee: c.totalFee,
              contractDate: c.contractDate,
            }, c.documents.length);

            update({ documents: [...c.documents, newDoc] });
          }}
        />
      </div>
    );
  };

  // ─── Step 4: 약관 동의 (전자서명법 4대 요건 & 상세 전문 확인) ───
  const renderTerms = () => {
    const allChecked = agreePrivacy && agreeThirdParty && agreeProcedure && agreeLegalEffect;

    const termsList: Array<{
      key: TermKey;
      checked: boolean;
      set: (val: boolean) => void;
      title: string;
      desc: string;
      badge: string;
    }> = [
      { 
        key: 'privacy', 
        checked: agreePrivacy, 
        set: setAgreePrivacy, 
        title: '개인정보 수집·이용 동의 (필수)', 
        desc: '성명, 연락처, 주민번호, 채무/소득/재산 정보 수집에 동의합니다.',
        badge: '개인정보보호법 제15조·제22조'
      },
      { 
        key: 'thirdParty', 
        checked: agreeThirdParty, 
        set: setAgreeThirdParty, 
        title: '제3자 정보제공 동의 (필수)', 
        desc: '법원, 채권 금융기관, 신용정보원 등에 정보 제공에 동의합니다.',
        badge: '개인정보보호법 제17조·제18조'
      },
      { 
        key: 'procedure', 
        checked: agreeProcedure, 
        set: setAgreeProcedure, 
        title: '사건 진행 절차 안내 확인 (필수)', 
        desc: '절차, 기간, 면책 불허가 사유 등을 충분히 이해하였습니다.',
        badge: '변호사법 광고규정 준수'
      },
      { 
        key: 'legalEffect', 
        checked: agreeLegalEffect, 
        set: setAgreeLegalEffect, 
        title: '전자서명법 제3조 법적 효력 합의 (필수)', 
        desc: '본 전자서명은 종이 계약서 자필 서명과 동일한 법적 효력을 가짐에 당사자 간 합의합니다.',
        badge: '전자서명법 제3조'
      },
    ];

    const toggleAll = (checked: boolean) => {
      setAgreePrivacy(checked);
      setAgreeThirdParty(checked);
      setAgreeProcedure(checked);
      setAgreeLegalEffect(checked);
    };

    const toggleAccordion = (key: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setExpandedTerms(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-black text-slate-800">📜 약관·동의 안내 (4대 법적 효력)</h3>
          <p className="text-xs text-slate-500 mt-1">
            법적 분쟁 시 100% 무결성을 입증하기 위해 필수 조항의 상세 내용을 확인하고 개별 동의를 완료해야 합니다.
          </p>
        </div>

        {/* 전체 동의 바 */}
        <label className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
          allChecked ? 'border-brand bg-brand/5' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/70'
        }`}>
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={allChecked} 
              onChange={e => toggleAll(e.target.checked)} 
              className="w-5 h-5 rounded accent-brand cursor-pointer shrink-0" 
            />
            <div>
              <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span>모든 필수 약관 및 법적 효력 안내에 전체 동의합니다</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  4대 조항 필수
                </span>
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                개인정보 수집이용, 제3자 제공, 사건 진행 절차, 전자서명법 효력 합의에 일괄 동의합니다.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400 hidden sm:inline-block">
            {allChecked ? '전체 동의 완료' : '1클릭 전체 동의'}
          </span>
        </label>

        {/* 개별 약관 목록 */}
        <div className="space-y-3">
          {termsList.map((item) => {
            const isExpanded = expandedTerms[item.key] ?? false;
            const termDef = LEGAL_TERMS_DATA[item.key];
            const content = termDef.getContent({
              firmName: c.lawFirmName,
              clientName: c.clientName,
              lawyerName: c.lawyerName,
            });

            return (
              <div 
                key={item.key} 
                className={`rounded-2xl border transition-all overflow-hidden ${
                  item.checked ? 'border-brand/30 bg-white shadow-xs' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  
                  {/* 체크박스 & 타이틀 영역 */}
                  <label className="flex items-start gap-3 cursor-pointer flex-1 select-none">
                    <input 
                      type="checkbox" 
                      checked={item.checked} 
                      onChange={() => item.set(!item.checked)} 
                      className="w-5 h-5 rounded accent-brand mt-0.5 cursor-pointer shrink-0" 
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{item.title}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </label>

                  {/* 전문 보기 & 펼침 액션 버튼 */}
                  <div className="flex items-center gap-2 pl-8 sm:pl-0 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTermKey(item.key)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>전문 팝업</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => toggleAccordion(item.key, e)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold rounded-lg text-xs transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {isExpanded ? (
                        <>
                          <span>접기</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>상세보기</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 인라인 아코디언 상세 전문 영역 */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-700 leading-relaxed font-sans space-y-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl max-h-56 overflow-y-auto whitespace-pre-wrap">
                      {content}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        위 법률 조항을 확인하고 숙지하신 후 동의해 주십시오.
                      </span>
                      {!item.checked && (
                        <button
                          type="button"
                          onClick={() => {
                            item.set(true);
                            toast.success(`${item.title}에 동의하였습니다.`);
                          }}
                          className="px-3.5 py-1.5 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                        >
                          확인 및 동의하기
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* 미동의 경고 */}
        {!allChecked && (
          <div className="flex items-center gap-2 p-3.5 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>모든 필수 항목(4개)에 동의해야 서명 및 발송 단계로 진행할 수 있습니다.</span>
          </div>
        )}

        {/* 정식 법률 조항 전문 모달 팝업 */}
        <LegalContractTermsModal
          isOpen={!!selectedTermKey}
          termKey={selectedTermKey}
          onClose={() => setSelectedTermKey(null)}
          onAgree={(key) => {
            if (key === 'privacy') setAgreePrivacy(true);
            if (key === 'thirdParty') setAgreeThirdParty(true);
            if (key === 'procedure') setAgreeProcedure(true);
            if (key === 'legalEffect') setAgreeLegalEffect(true);
            toast.success('약관 내용을 확인하고 동의를 완료했습니다.');
          }}
          firmName={c.lawFirmName}
          clientName={c.clientName}
          lawyerName={c.lawyerName}
        />
      </div>
    );
  };

  // ─── Step 5: 전자 서명 및 고객 발송 (변호사 서명 & 고객 모바일 발송) ───
  const renderSignature = () => {
    const lawyerSigned = c.documents.some(d => d.included && d.lawyerSignature);
    const clientSignedDoc = c.documents.find(d => d.included && d.clientSignature);
    const clientSigned = Boolean(clientSignedDoc);

    const signToken = c.remoteSignToken || `sgn-${c.id.toLowerCase()}`;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mykimlawyer.kr';
    const signUrl = `${origin}?view=sign&token=${signToken}&cid=${c.id}`;

    const handleRefreshStatus = async () => {
      setRefreshingSign(true);
      try {
        const fresh = await getContract(c.id);
        if (fresh) {
          setC(fresh);
          const isDone = fresh.documents.some(d => d.included && d.clientSignature);
          if (isDone) {
            toast.success('고객 서명이 완료된 것을 확인했습니다!');
          } else {
            toast.info('아직 고객 서명이 대기 중입니다.');
          }
        }
      } catch {
        toast.error('상태 확인 중 오류가 발생했습니다.');
      } finally {
        setRefreshingSign(false);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-black text-slate-800">✍️ 전자 서명 및 고객 발송</h3>
          <p className="text-xs text-slate-500 mt-1">
            수임인(담당 변호사) 서명을 날인하고, 위임인(의뢰인)에게는 스마트폰 서명 링크를 발송합니다.
          </p>
        </div>

        {/* 1. 변호사 (수임인) 서명 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand" />
              <span>수임인 (담당 변호사) 날인·서명</span>
            </h4>
            {lawyerSigned && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> 변호사 서명 완료
              </span>
            )}
          </div>

          {lawyerSigned ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{c.lawyerName} 변호사 서명 완료</p>
                  <p className="text-[11px] text-slate-400">
                    {c.documents.find(d => d.lawyerSignature)?.lawyerSignedAt 
                      ? new Date(c.documents.find(d => d.lawyerSignature)!.lawyerSignedAt!).toLocaleString('ko-KR')
                      : '서명 완료'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const docs = c.documents.map(d => ({ ...d, lawyerSignature: undefined, lawyerSignedAt: undefined }));
                  update({ documents: docs });
                  toast.info('변호사 서명이 초기화되었습니다. 다시 서명해 주세요.');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer"
              >
                다시 서명
              </button>
            </div>
          ) : (
            <SignatureCanvas label={`${c.lawyerName} 변호사 서명`} onComplete={(sig) => {
              const docs = c.documents.map(d => d.included ? { ...d, lawyerSignature: sig, lawyerSignedAt: new Date().toISOString() } : d);
              update({ documents: docs });
              toast.success('변호사 서명이 완료되었습니다');
            }} />
          )}
        </div>

        {/* 2. 의뢰인 (위임인) 스마트폰 안전 서명 발송 카드 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-brand" />
              <span>위임인 ({c.clientName || '대표자'}) 스마트폰 안전 서명</span>
            </h4>
            
            {clientSigned ? (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1 w-fit">
                <CheckCircle2 className="w-3.5 h-3.5" /> 의뢰인 서명 완료
              </span>
            ) : (
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1 w-fit">
                <Clock className="w-3.5 h-3.5" /> 고객 스마트폰 서명 대기
              </span>
            )}
          </div>

          {/* 법적 설명 및 안내 박스 */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand" />
              <span>본인 명의 스마트폰 직접 서명 원칙 (보안·법적 무결성)</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              전자서명법 규정에 따라 의뢰인 서명은 본인 명의 스마트폰(통신사 PASS 또는 문자 실명인증)을 통해 직접 진행됩니다.
              방문 대면 상담 시에도 변호사 관리자 화면을 건네지 않고 의뢰인의 스마트폰으로 서명 링크를 전송해 주십시오.
            </p>
          </div>

          {/* 서명 완료 상태 vs 대기 상태 */}
          {clientSigned ? (
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>스마트폰 본인인증 및 자필 서명이 정상 제출되었습니다.</span>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={refreshingSign}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingSign ? 'animate-spin' : ''}`} />
                  <span>새로고침</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-emerald-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">서명자 성명</span>
                  <span className="font-bold text-slate-800">{c.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">통신사 실명인증</span>
                  <span className="font-bold text-emerald-700">
                    {c.identityVerification?.carrier || 'PASS'} 인증 완료 ({c.identityVerification?.name || c.clientName})
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[11px]">서명 제출 일시</span>
                  <span className="font-bold text-slate-700">
                    {clientSignedDoc?.clientSignedAt ? new Date(clientSignedDoc.clientSignedAt).toLocaleString('ko-KR') : '완료'}
                  </span>
                </div>
              </div>

              {clientSignedDoc?.clientSignature && (
                <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-400 block mb-1">의뢰인 자필 서명 이미지</span>
                  <img src={clientSignedDoc.clientSignature} alt="의뢰인 자필 서명" className="h-14 object-contain" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1E3A5F] hover:bg-[#162d4a] text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors min-h-[44px]"
                >
                  <Share2 className="w-4 h-4" />
                  <span>📱 고객 스마트폰으로 카톡/문자 서명 링크 발송</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(signUrl);
                    toast.success('서명 링크가 복사되었습니다.');
                  }}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors whitespace-nowrap min-h-[44px]"
                >
                  링크 복사
                </button>

                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={refreshingSign}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-colors whitespace-nowrap min-h-[44px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title="고객이 스마트폰에서 서명을 완료했는지 새로고침하여 확인합니다"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingSign ? 'animate-spin' : ''}`} />
                  <span>서명 확인</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  의뢰인이 스마트폰에서 PASS 본인인증 후 서명을 제출하면, 위 [서명 확인] 버튼을 누르거나 화면을 새로고침하여 즉시 반영할 수 있습니다.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Step 6: 미리보기 & 감사추적 인증서 ───
  const renderPreview = () => {
    const includedDocs = c.documents.filter(d => d.included);
    const costs = calculateCourtCosts(c.courtCosts?.creditorCount || 0);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= 10) {
        setIsScrolledToEnd(true);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-800">📄 계약서 전문 및 감사인증서</h3>
            <p className="text-xs text-slate-500">전문 스크롤을 확인하신 후 최종 체결을 진행하세요.</p>
          </div>
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs whitespace-nowrap cursor-pointer shadow-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>고객 원격 서명 링크 발송</span>
          </button>
        </div>

        {/* 계약서 본문 (스크롤 감지 컨테이너) */}
        <div 
          ref={previewScrollRef}
          onScroll={handleScroll}
          className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm max-w-3xl mx-auto space-y-6 text-sm text-slate-700 leading-relaxed max-h-[600px] overflow-y-auto"
        >
          <h2 className="text-xl font-black text-center text-slate-900 border-b-2 border-slate-800 pb-3">
            개인회생/파산 사건 위임 계약서
          </h2>

          <div className="space-y-1 bg-slate-50 p-4 rounded-xl text-xs">
            <p><strong>위임인 (갑):</strong> {c.isBusiness && c.businessInfo ? `${c.businessInfo.companyName} (대표: ${c.clientName})` : c.clientName} (연락처: {c.clientPhone})</p>
            {c.isBusiness && c.businessInfo && (
              <p className="text-slate-500"><strong>사업자등록번호:</strong> {c.businessInfo.businessNumber} (국세청 확인 완료)</p>
            )}
            <p><strong>수임인 (을):</strong> {c.lawFirmName} {c.lawyerName} 변호사</p>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 mb-2">제 1 조 (수임료 및 법원비용)</h4>
            <table className="w-full text-xs border border-slate-200">
              <tbody>
                <tr className="border-b"><td className="p-2 bg-slate-50 font-bold w-1/2">총 수임료</td><td className="p-2 text-right">{(c.totalFee * 10000).toLocaleString()}원</td></tr>
                <tr><td className="p-2 bg-slate-50 font-bold">예상 법원비용</td><td className="p-2 text-right">{(costs.total + (c.courtCosts?.miscFee || 0)).toLocaleString()}원</td></tr>
              </tbody>
            </table>
          </div>

          {c.feeSchedule.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-2">제 2 조 (납부 스케줄)</h4>
              <table className="w-full text-xs border border-slate-200">
                <thead><tr className="bg-slate-50"><th className="p-2 text-left">회차</th><th className="p-2 text-left">구분</th><th className="p-2 text-left">납부기일</th><th className="p-2 text-right">금액</th></tr></thead>
                <tbody>{c.feeSchedule.map(f => (
                  <tr key={f.id} className="border-t"><td className="p-2">{f.round === 0 ? '착수금' : `${f.round}차`}</td><td className="p-2">{f.memo}</td><td className="p-2">{f.dueDate}</td><td className="p-2 text-right">{f.amount.toLocaleString()}원</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div>
            <h4 className="font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>첨부 계약 문서 및 특약 전문 ({includedDocs.length}종)</span>
              <span className="text-[11px] text-slate-400 font-normal">터치하여 형광펜 강조 및 본문 확인</span>
            </h4>
            {includedDocs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">첨부된 서류가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {includedDocs.map(d => (
                  <details key={d.id} className="group border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <summary className="p-3 bg-slate-50 flex items-center justify-between cursor-pointer font-bold text-xs text-slate-800 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{CONTRACT_DOC_TYPES[d.type]?.emoji || '📎'}</span>
                        <span>{d.title}</span>
                        {d.content?.includes('==') && (
                          <span className="text-[10px] font-bold text-amber-800 bg-yellow-100 px-1.5 py-0.2 rounded border border-yellow-300">
                            형광펜 강조
                          </span>
                        )}
                        {d.requiredConfirmationText && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                            ✍️ 직접확약: "{d.requiredConfirmationText}"
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {d.clientSignature ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            의뢰인 서명완료
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">서명 대기</span>
                        )}
                        <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                      </div>
                    </summary>
                    <div className="p-4 bg-white border-t border-slate-100 text-xs">
                      <HighlightedDocumentViewer
                        content={d.content}
                        requiredConfirmationText={d.requiredConfirmationText}
                      />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-end pt-4 border-t border-slate-200">
            <div className="text-center">
              <p className="text-xs font-bold mb-2">위임인: {c.clientName} (인)</p>
              {c.documents.find(d => d.clientSignature)?.clientSignature ? (
                <img src={c.documents.find(d => d.clientSignature)!.clientSignature} alt="의뢰인 서명" className="h-12 mx-auto" />
              ) : (
                <span className="text-xs text-slate-400 italic">서명 대기중</span>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold mb-2">수임인: {c.lawyerName} (인)</p>
              {c.documents.find(d => d.lawyerSignature)?.lawyerSignature ? (
                <img src={c.documents.find(d => d.lawyerSignature)!.lawyerSignature} alt="변호사 서명" className="h-12 mx-auto" />
              ) : (
                <span className="text-xs text-slate-400 italic">서명 대기중</span>
              )}
            </div>
          </div>

          {/* ── 공식 감사추적 인증서 (마지막 장 임베딩) ── */}
          <AuditTrailCertificate 
            contract={c} 
            onOpenVerifyModal={() => setVerifyModalOpen(true)}
          />
        </div>
      </div>
    );
  };

  const stepContent = [renderClientInfo, renderFeeSchedule, renderDocuments, renderTerms, renderSignature, renderPreview];
  const canProceed = step !== 3 || (agreePrivacy && agreeThirdParty && agreeProcedure && agreeLegalEffect);

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* 헤더 */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
            <div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-brand" />
                <span>전자 위임계약서 작성 (4대 법적 효력 완비)</span>
              </h2>
              <p className="text-sm text-slate-500 mt-1">{c.id} · {c.clientName || '신규 계약'} · {isBusiness ? '사업자 계약' : '개인 계약'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer whitespace-nowrap transition-colors">💾 임시 저장</button>
            {step === 5 && (
              <button
                type="button"
                onClick={async () => {
                  setDownloadingPdf(true);
                  try {
                    await generateCourtSubmissionPdf(c);
                  } finally {
                    setDownloadingPdf(false);
                  }
                }}
                disabled={downloadingPdf}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer whitespace-nowrap transition-colors shadow-xs"
                title="감사추적보고서 및 블록체인 각인이 포함된 법원 제출용 PDF 발급"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>{downloadingPdf ? 'PDF 생성중...' : '📄 법원제출용 PDF'}</span>
              </button>
            )}
            {step === 5 && (
              <button 
                onClick={async () => {
                  const lawyerSig = c.documents.find(d => d.lawyerSignature)?.lawyerSignature;
                  const clientSig = c.documents.find(d => d.clientSignature)?.clientSignature;

                  if (!lawyerSig) {
                    toast.error('수임인(담당 변호사) 서명이 필요합니다. 5단계에서 서명을 먼저 진행해 주세요.');
                    return;
                  }
                  if (!clientSig) {
                    toast.error('위임인(고객) 스마트폰 서명이 완료되지 않았습니다. 고객에게 서명 링크를 먼저 발송해 주세요.');
                    return;
                  }

                  setCompleting(true);
                  try {
                    const final = await finalizeContractWithIntegrity(c, clientSig, lawyerSig);
                    onSave(final);
                    toast.success('SHA-256 해시 및 3중 타임스탬프 봉인 계약이 완료되었습니다!');
                    onClose();
                  } catch (e: any) {
                    toast.error(e?.message || '체결 처리 중 오류가 발생했습니다.');
                  } finally {
                    setCompleting(false);
                  }
                }} 
                disabled={completing}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-[#1E3A5F] hover:bg-[#162d4a] rounded-xl cursor-pointer whitespace-nowrap min-h-[44px] shadow-xs transition-colors disabled:opacity-50"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>3중 타임스탬프 체결 및 완료</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 스텝 탭 */}
      <div className="flex gap-2 flex-wrap">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer border whitespace-nowrap ${
                step === i
                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}>
              <Icon className="w-4 h-4" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 컨텐츠 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs">
        {stepContent[step]()}
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between">
        <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-colors"><ArrowLeft className="w-4 h-4" /> 이전</button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-[#1E3A5F]' : i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />)}
        </div>
        {step < 5 ? (
          <button onClick={() => canProceed && setStep(step + 1)} disabled={!canProceed}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#1E3A5F] hover:bg-[#162d4a] rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shadow-xs transition-colors">다음 <ArrowRight className="w-4 h-4" /></button>
        ) : <div className="w-20" />}
      </div>

      {/* 고객 원격 서명 발송 모달 */}
      <ClientSignShareModal 
        contract={c} 
        isOpen={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
      />

      {/* 블록체인 공공 원본 검증기 모달 */}
      <ContractPublicVerifierModal
        isOpen={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        contract={c}
      />
    </div>
  );
}
