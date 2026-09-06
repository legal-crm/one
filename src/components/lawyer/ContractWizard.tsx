import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, ArrowRight, User, CreditCard, FileText, Shield, 
  PenTool, Eye, Plus, Trash2, GripVertical, Check, X, AlertTriangle, 
  Download, Loader2, Building2, Smartphone, Lock, CheckCircle2, 
  Share2, ShieldCheck, RefreshCw 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract, ContractDocument, ContractDocType, FeeInstallment } from '../../types';
import { CONTRACT_DOC_TYPES } from '../../types';
import { calculateCourtCosts, generateFeeSchedule, saveContract, addAuditLog, updateContractStatus, finalizeContractWithIntegrity } from '../../services/contractService';
import { requestIdentityVerification, isPortOneConfigured, verifyRepresentativeMatch } from '../../services/portoneService';
import { validateBusinessRegistration } from '../../services/ntsService';
import SignatureCanvas from './SignatureCanvas';
import AuditTrailCertificate from './AuditTrailCertificate';
import ClientSignShareModal from './ClientSignShareModal';

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
  { key: 'signature', label: '스마트폰 인증·서명', icon: PenTool },
  { key: 'preview', label: '미리보기·감사증서', icon: Eye },
];

export default function ContractWizard({ contract: initialContract, onClose, onSave }: Props) {
  const [step, setStep] = useState(0);
  const [c, setC] = useState<ElectronicContract>(() => ({
    ...initialContract,
    courtCosts: initialContract.courtCosts || { creditorCount: 5, deliveryFee: 0, stampFee: 0, miscFee: 0 },
    feeSchedule: initialContract.feeSchedule || [],
    documents: initialContract.documents || [],
    auditTrail: initialContract.auditTrail || [],
  }));

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

  // 본인인증 & 대표자 교차 검증 상태
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(!!c.identityVerification);
  const [repMatchMessage, setRepMatchMessage] = useState<string | null>(null);

  // 강제 스크롤 열람 검증
  const [isScrolledToEnd, setIsScrolledToEnd] = useState(false);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // 원격 서명 링크 모달
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

  // 분납 생성기 상태
  const [downPayment, setDownPayment] = useState(50);
  const [installments, setInstallments] = useState(3);
  const [downDate, setDownDate] = useState(c.contractDate || new Date().toISOString().slice(0, 10));
  const [firstDate, setFirstDate] = useState(c.contractDate || new Date().toISOString().slice(0, 10));

  // 약관 동의 (4대 효력 필수 항목)
  const [agreePrivacy, setAgreePrivacy] = useState(true);
  const [agreeThirdParty, setAgreeThirdParty] = useState(true);
  const [agreeProcedure, setAgreeProcedure] = useState(true);
  const [agreeLegalEffect, setAgreeLegalEffect] = useState(true);

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
  const renderDocuments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-slate-800">📋 계약 문서 관리</h3>
        <button onClick={() => {
          const newDoc: ContractDocument = { id: `doc-${Date.now()}`, type: 'custom', title: '새 문서', content: '문서 내용을 입력하세요.', signatureRequired: 'both', order: c.documents.length, included: true };
          update({ documents: [...c.documents, newDoc] });
        }} className="flex items-center gap-1.5 text-xs font-bold text-brand bg-brand/10 px-3 py-2 rounded-xl hover:bg-brand/20 cursor-pointer whitespace-nowrap"><Plus className="w-3.5 h-3.5" /> 문서 추가</button>
      </div>
      <p className="text-xs text-slate-500">체크된 문서만 최종 계약서에 포함됩니다.</p>

      <div className="space-y-2">
        {c.documents.sort((a, b) => a.order - b.order).map((doc, i) => (
          <div key={doc.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${doc.included ? 'border-brand/20 bg-brand/5' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
            <input type="checkbox" checked={doc.included} onChange={e => {
              const docs = [...c.documents]; docs[i] = { ...docs[i], included: e.target.checked }; update({ documents: docs });
            }} className="w-4 h-4 rounded accent-brand cursor-pointer" />
            <span className="text-lg shrink-0">{CONTRACT_DOC_TYPES[doc.type]?.emoji || '📎'}</span>
            <div className="flex-1 min-w-0">
              <input value={doc.title} onChange={e => { const docs = [...c.documents]; docs[i] = { ...docs[i], title: e.target.value }; update({ documents: docs }); }} className="text-sm font-bold text-slate-800 bg-transparent outline-none w-full" />
              <p className="text-[11px] text-slate-400 truncate">{CONTRACT_DOC_TYPES[doc.type]?.description || '사용자 정의 문서'}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${doc.signatureRequired === 'both' ? 'bg-indigo-50 text-indigo-600' : doc.signatureRequired === 'client' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {doc.signatureRequired === 'both' ? '양측 서명' : doc.signatureRequired === 'client' ? '의뢰인 서명' : '변호사 서명'}
            </span>
            {doc.clientSignature && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
            <button onClick={() => update({ documents: c.documents.filter(d => d.id !== doc.id) })} className="text-slate-400 hover:text-red-500 cursor-pointer shrink-0"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── Step 4: 약관 동의 (전자서명법 4대 요건) ───
  const renderTerms = () => (
    <div className="space-y-6">
      <h3 className="text-base font-black text-slate-800">📜 약관·동의 안내 (4대 법적 효력)</h3>
      <p className="text-xs text-slate-500">법적 분쟁 시 100% 입증력을 확보하기 위해 아래 필수 조항에 개별 동의를 완료해야 합니다.</p>

      <div className="space-y-3">
        {[
          { checked: agreePrivacy, set: setAgreePrivacy, title: '개인정보 수집·이용 동의 (필수)', desc: '성명, 연락처, 주민번호, 채무/소득/재산 정보 수집에 동의합니다.' },
          { checked: agreeThirdParty, set: setAgreeThirdParty, title: '제3자 정보제공 동의 (필수)', desc: '법원, 채권 금융기관, 신용정보원 등에 정보 제공에 동의합니다.' },
          { checked: agreeProcedure, set: setAgreeProcedure, title: '사건 진행 절차 안내 확인 (필수)', desc: '절차, 기간, 면책 불허가 사유 등을 충분히 이해하였습니다.' },
          { checked: agreeLegalEffect, set: setAgreeLegalEffect, title: '전자서명법 제3조 법적 효력 합의 (필수)', desc: '본 전자서명은 종이 계약서 자필 서명과 동일한 법적 효력을 가짐에 당사자 간 합의합니다.' },
        ].map((item, i) => (
          <label key={i} className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${item.checked ? 'border-brand/20 bg-brand/5' : 'border-slate-200 hover:bg-slate-50'}`}>
            <input type="checkbox" checked={item.checked} onChange={() => item.set(!item.checked)} className="w-5 h-5 rounded accent-brand mt-0.5 cursor-pointer shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-800">{item.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {!(agreePrivacy && agreeThirdParty && agreeProcedure && agreeLegalEffect) && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" /> 모든 필수 항목에 동의해야 서명 단계로 진행할 수 있습니다.
        </div>
      )}
    </div>
  );

  // ─── Step 5: 전자 서명 (스마트폰 본인인증 & 대표자 교차 검증) ───
  const renderSignature = () => {
    const lawyerSigned = c.documents.some(d => d.included && d.lawyerSignature);
    const clientSigned = c.documents.some(d => d.included && d.clientSignature);

    return (
      <div className="space-y-6">
        <h3 className="text-base font-black text-slate-800">✍️ 통신사 본인인증 & 전자 서명</h3>

        {/* 스마트폰 본인인증 카드 */}
        <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-brand" />
              <span>스마트폰 본인인증 (PASS / SMS 실명확인)</span>
            </h4>
            <span className="text-[10px] text-slate-500">
              {isPortOneConfigured() ? 'PortOne 통신 3사 실망' : '데모 실명 모드'}
            </span>
          </div>

          {verified ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>본인인증 완료: {c.identityVerification?.name} ({c.identityVerification?.carrier || 'SKT'})</span>
              </div>
              {repMatchMessage && (
                <p className="text-xs text-slate-600 font-medium pl-2">{repMatchMessage}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                의뢰인({c.clientName || '대표자'}) 명의의 스마트폰으로 통신사 실명 인증을 진행합니다.
              </p>
              <button 
                type="button"
                onClick={async () => {
                  setVerifying(true);
                  const expectedRep = isBusiness ? (bizRepName || c.clientName) : c.clientName;
                  const result = await requestIdentityVerification(expectedRep);
                  setVerifying(false);
                  
                  if (result.success) {
                    // 대표자 일치 교차 검증 실행
                    const match = verifyRepresentativeMatch(expectedRep, result.name);
                    setRepMatchMessage(match.message);

                    if (isBusiness && !match.matched) {
                      toast.error(match.message);
                      return;
                    }

                    update({ 
                      identityVerification: result,
                      authorityStatus: match.status,
                    });
                    setVerified(true);
                    toast.success('대표자 본인인증이 완료되었습니다.');
                  } else {
                    toast.error(result.error || '인증에 실패했습니다');
                  }
                }} 
                disabled={verifying} 
                className="flex items-center gap-2 px-5 py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-colors cursor-pointer whitespace-nowrap min-h-[44px] disabled:opacity-50 shadow-xs text-sm"
              >
                {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> 통신사 인증 진행 중...</> : '📱 스마트폰 본인인증 시작'}
              </button>
            </div>
          )}
        </div>

        {/* 변호사 서명 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">수임인 (담당 변호사) 서명</h4>
          {lawyerSigned ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold"><Check className="w-5 h-5" /> 서명 완료</div>
          ) : (
            <SignatureCanvas label={`${c.lawyerName} 변호사 서명`} onComplete={(sig) => {
              const docs = c.documents.map(d => d.included ? { ...d, lawyerSignature: sig, lawyerSignedAt: new Date().toISOString() } : d);
              update({ documents: docs });
              toast.success('변호사 서명이 완료되었습니다');
            }} />
          )}
        </div>

        {/* 의뢰인 서명 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700">위임인 ({c.clientName || '대표자'}) 자필 서명</h4>
            {!verified && <span className="text-xs text-amber-600 font-bold">⚠️ 본인인증 완료 후 서명 가능</span>}
          </div>

          {clientSigned ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold"><Check className="w-5 h-5" /> 서명 완료</div>
          ) : verified ? (
            <SignatureCanvas label={`${c.clientName} 의뢰인 자필 서명`} onComplete={(sig) => {
              const docs = c.documents.map(d => d.included ? { ...d, clientSignature: sig, clientSignedAt: new Date().toISOString() } : d);
              update({ documents: docs });
              toast.success('의뢰인 자필 서명이 완료되었습니다');
            }} />
          ) : (
            <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
              상단의 스마트폰 본인인증을 먼저 완료해 주십시오.
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
            <h4 className="font-bold text-slate-800 mb-2">첨부 서류 목록</h4>
            {includedDocs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">첨부된 서류가 없습니다.</p>
            ) : (
              <ul className="space-y-1">{includedDocs.map(d => <li key={d.id} className="text-xs text-slate-600">• {d.title} {d.clientSignature ? '✅ 자필서명 완료' : '⏳'}</li>)}</ul>
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
          <AuditTrailCertificate contract={c} />
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
                onClick={async () => {
                  setCompleting(true);
                  const clientSig = c.documents.find(d => d.clientSignature)?.clientSignature || 'CLIENT_SIGNED_DEMO';
                  const lawyerSig = c.documents.find(d => d.lawyerSignature)?.lawyerSignature || 'LAWYER_SIGNED_DEMO';
                  
                  const final = await finalizeContractWithIntegrity(c, clientSig, lawyerSig);
                  setCompleting(false);
                  onSave(final);
                  toast.success('SHA-256 해시 및 3중 타임스탬프 봉인 계약이 완료되었습니다!');
                  onClose();
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
    </div>
  );
}
