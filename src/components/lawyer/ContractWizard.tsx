import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, User, CreditCard, FileText, Shield, PenTool, Eye, Plus, Trash2, GripVertical, Check, X, ChevronDown, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ElectronicContract, ContractDocument, ContractDocType, FeeInstallment } from '../../types';
import { CONTRACT_DOC_TYPES } from '../../types';
import { calculateCourtCosts, generateFeeSchedule, saveContract, addAuditLog, updateContractStatus } from '../../services/contractService';
import { requestIdentityVerification, isPortOneConfigured } from '../../services/portoneService';
import SignatureCanvas from './SignatureCanvas';

interface Props {
  contract: ElectronicContract;
  onClose: () => void;
  onSave: (contract: ElectronicContract) => void;
}

const STEPS = [
  { key: 'client', label: '위임인 인적사항', icon: User },
  { key: 'fee', label: '수임료 및 스케줄', icon: CreditCard },
  { key: 'documents', label: '계약 문서 관리', icon: FileText },
  { key: 'terms', label: '약관·동의 안내', icon: Shield },
  { key: 'signature', label: '전자 서명', icon: PenTool },
  { key: 'preview', label: '미리보기·출력', icon: Eye },
];

export default function ContractWizard({ contract: initialContract, onClose, onSave }: Props) {
  const [step, setStep] = useState(0);
  const [c, setC] = useState<ElectronicContract>({ ...initialContract });
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(!!c.identityVerification);

  // 분납 생성기 상태
  const [downPayment, setDownPayment] = useState(50);
  const [installments, setInstallments] = useState(3);
  const [downDate, setDownDate] = useState(c.contractDate);
  const [firstDate, setFirstDate] = useState(c.contractDate);

  // 약관 동의
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeThirdParty, setAgreeThirdParty] = useState(false);
  const [agreeProcedure, setAgreeProcedure] = useState(false);

  const update = (patch: Partial<ElectronicContract>) => setC(prev => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));

  const handleSave = () => {
    const updated = addAuditLog(c, '계약서 저장', 'lawyer');
    saveContract(updated);
    onSave(updated);
    toast.success('계약서가 저장되었습니다');
  };

  // ─── Step 1: 위임인 인적사항 ───
  const renderClientInfo = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-slate-800">👤 위임인 인적사항</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">의뢰인 성명</label>
          <input value={c.clientName} onChange={e => update({ clientName: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-1 block">연락처</label>
          <input value={c.clientPhone} onChange={e => update({ clientPhone: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" placeholder="010-0000-0000" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-slate-500 mb-1 block">주소 (선택)</label>
          <input value={c.clientAddress || ''} onChange={e => update({ clientAddress: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" placeholder="서울시 강남구..." />
        </div>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-bold text-slate-700 mb-3">수임인 정보</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">법무법인명</label>
            <input value={c.lawFirmName} onChange={e => update({ lawFirmName: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">담당 변호사</label>
            <input value={c.lawyerName} onChange={e => update({ lawyerName: e.target.value })} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-slate-500 mb-1 block">계약일자</label>
        <input type="date" value={c.contractDate} onChange={e => update({ contractDate: e.target.value })} className="px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
      </div>
    </div>
  );

  // ─── Step 2: 수임료 및 스케줄 ───
  const renderFeeSchedule = () => {
    const costs = calculateCourtCosts(c.courtCosts.creditorCount);
    const totalCourt = costs.total + c.courtCosts.miscFee;
    const totalWithCourt = c.totalFee * 10000 + totalCourt;
    const scheduleTotal = c.feeSchedule.reduce((s, f) => s + f.amount, 0);

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-black text-slate-800">💰 수임료 및 스케줄</h3>

        {/* 법원 비용 */}
        <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">📋 법원 비용 산출 (자동)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400">채권자 수</label>
              <input type="number" min={0} value={c.courtCosts.creditorCount} onChange={e => update({ courtCosts: { ...c.courtCosts, creditorCount: +e.target.value } })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">송달료 (자동)</label>
              <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm mt-1 text-slate-600">{costs.deliveryFee.toLocaleString()}원</div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">인지대</label>
              <div className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm mt-1 text-slate-600">{costs.stampFee.toLocaleString()}원</div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400">기타 실비</label>
              <input type="number" min={0} value={c.courtCosts.miscFee} onChange={e => update({ courtCosts: { ...c.courtCosts, miscFee: +e.target.value } })} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm mt-1" />
            </div>
          </div>
        </div>

        {/* 수임료 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-bold text-slate-700">💵 수임료 납부 스케줄 설정</h4>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400">총 수임료 (VAT 별도)</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" min={0} value={c.totalFee} onChange={e => update({ totalFee: +e.target.value })} className="w-32 px-3 py-2.5 border border-slate-200 rounded-xl text-sm" />
                <span className="text-xs text-slate-500">만원</span>
              </div>
              <span className="text-[11px] text-emerald-500 font-bold">{(c.totalFee * 10000).toLocaleString()}원</span>
            </div>
            <div>
              <span className="text-xs text-slate-400">부대비용 포함 총액</span>
              <p className="text-lg font-black text-brand">{totalWithCourt.toLocaleString()}원</p>
            </div>
          </div>

          {/* 스케줄 자동 생성기 */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-slate-600">스케줄 자동 생성기</h5>
              <button onClick={() => {
                const schedule = generateFeeSchedule(c.totalFee * 10000, downPayment * 10000, installments, downDate, firstDate);
                update({ feeSchedule: schedule });
                toast.success('스케줄이 생성되었습니다');
              }} className="text-[11px] font-bold text-white bg-brand px-3 py-1.5 rounded-lg cursor-pointer hover:bg-brand/90 whitespace-nowrap">🔄 스케줄 적용</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400">착수금(계약금)</label>
                <div className="flex items-center gap-1 mt-1"><input type="number" value={downPayment} onChange={e => setDownPayment(+e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm" /><span className="text-[11px] text-slate-400 shrink-0">만원</span></div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">착수금 납부일</label>
                <input type="date" value={downDate} onChange={e => setDownDate(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm mt-1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">잔금 분할 횟수</label>
                <select value={installments} onChange={e => setInstallments(+e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm mt-1">
                  {[2, 3, 4, 5, 6, 9, 12].map(n => <option key={n} value={n}>{n}개월</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400">1회차 시작일</label>
                <input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} className="w-full px-2 py-2 border rounded-lg text-sm mt-1" />
              </div>
            </div>
          </div>

          {/* 상세 납부 목록 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-bold text-slate-600">상세 납부 목록</h5>
            </div>
            {c.feeSchedule.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-xl">생성된 스케줄이 없습니다.</div>
            ) : (
              <div className="space-y-1.5">
                {c.feeSchedule.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl text-xs">
                    <span className="font-bold text-slate-500 w-8">{f.round === 0 ? '착수' : `${f.round}차`}</span>
                    <span className="text-slate-600 flex-1">{f.memo}</span>
                    <span className="text-slate-500">{f.dueDate}</span>
                    <span className="font-bold text-slate-800 w-24 text-right">{f.amount.toLocaleString()}원</span>
                    <button onClick={() => update({ feeSchedule: c.feeSchedule.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-red-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
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
        <h3 className="text-lg font-black text-slate-800">📋 계약 문서 관리</h3>
        <button onClick={() => {
          const newDoc: ContractDocument = { id: `doc-${Date.now()}`, type: 'custom', title: '새 문서', content: '문서 내용을 입력하세요.', signatureRequired: 'both', order: c.documents.length, included: true };
          update({ documents: [...c.documents, newDoc] });
        }} className="flex items-center gap-1.5 text-xs font-bold text-brand bg-brand/10 px-3 py-2 rounded-xl hover:bg-brand/20 cursor-pointer whitespace-nowrap"><Plus className="w-3.5 h-3.5" /> 문서 추가</button>
      </div>
      <p className="text-xs text-slate-500">체크된 문서만 계약서에 포함됩니다. 드래그하여 순서를 변경하세요.</p>

      <div className="space-y-2">
        {c.documents.sort((a, b) => a.order - b.order).map((doc, i) => (
          <div key={doc.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${doc.included ? 'border-brand/20 bg-brand/5' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
            <GripVertical className="w-4 h-4 text-slate-300 shrink-0 cursor-grab" />
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

  // ─── Step 4: 약관 동의 ───
  const renderTerms = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-black text-slate-800">📜 약관·동의 안내</h3>
      <p className="text-xs text-slate-500">아래 항목은 법률 서비스 제공을 위해 필수적으로 동의를 받아야 하는 사항입니다.</p>

      <div className="space-y-3">
        {[
          { checked: agreePrivacy, set: setAgreePrivacy, title: '개인정보 수집·이용 동의 (필수)', desc: '성명, 연락처, 주민등록번호, 채무/소득/재산 정보 수집에 동의합니다.' },
          { checked: agreeThirdParty, set: setAgreeThirdParty, title: '제3자 정보제공 동의 (필수)', desc: '법원, 채권 금융기관, 신용정보원 등에 정보 제공에 동의합니다.' },
          { checked: agreeProcedure, set: setAgreeProcedure, title: '사건 진행 절차 안내 확인 (필수)', desc: '절차, 기간, 면책 불허가 사유 등을 충분히 이해하였습니다.' },
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

      {!(agreePrivacy && agreeThirdParty && agreeProcedure) && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold">
          <AlertTriangle className="w-4 h-4 shrink-0" /> 모든 필수 항목에 동의해야 다음 단계로 진행할 수 있습니다.
        </div>
      )}
    </div>
  );

  // ─── Step 5: 전자 서명 ───
  const renderSignature = () => {
    const lawyerSigned = c.documents.some(d => d.included && d.lawyerSignature);
    const clientSigned = c.documents.some(d => d.included && d.clientSignature);

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-black text-slate-800">✍️ 전자 서명</h3>

        {/* 본인인증 */}
        <div className="bg-slate-50 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">🔐 본인인증 {isPortOneConfigured() ? '(PortOne 간편인증)' : '(데모 모드)'}</h4>
          {verified ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold"><Check className="w-5 h-5" /> 본인인증 완료 — {c.identityVerification?.method || 'demo'}</div>
          ) : (
            <button onClick={async () => {
              setVerifying(true);
              const result = await requestIdentityVerification();
              setVerifying(false);
              if (result.success) {
                update({ identityVerification: result });
                setVerified(true);
                toast.success('본인인증이 완료되었습니다');
              } else {
                toast.error(result.error || '인증에 실패했습니다');
              }
            }} disabled={verifying} className="flex items-center gap-2 px-5 py-3 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-colors cursor-pointer whitespace-nowrap min-h-[44px] disabled:opacity-50">
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> 인증 중...</> : '📱 간편인증 시작'}
            </button>
          )}
        </div>

        {/* 변호사 서명 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">변호사 서명 (수임인)</h4>
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
          <h4 className="text-sm font-bold text-slate-700">의뢰인 서명 (위임인)</h4>
          {!verified && <p className="text-xs text-amber-600 font-bold">⚠️ 본인인증을 먼저 완료해주세요</p>}
          {clientSigned ? (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold"><Check className="w-5 h-5" /> 서명 완료</div>
          ) : verified ? (
            <SignatureCanvas label={`${c.clientName} 의뢰인 서명`} onComplete={(sig) => {
              const docs = c.documents.map(d => d.included ? { ...d, clientSignature: sig, clientSignedAt: new Date().toISOString() } : d);
              update({ documents: docs });
              toast.success('의뢰인 서명이 완료되었습니다');
            }} />
          ) : null}
        </div>
      </div>
    );
  };

  // ─── Step 6: 미리보기 ───
  const renderPreview = () => {
    const includedDocs = c.documents.filter(d => d.included);
    const costs = calculateCourtCosts(c.courtCosts.creditorCount);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800">📄 계약서 미리보기</h3>
        </div>

        {/* 계약서 본문 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm max-w-3xl mx-auto space-y-6 text-sm text-slate-700 leading-relaxed">
          <h2 className="text-xl font-black text-center text-slate-900 border-b-2 border-slate-800 pb-3">개인회생/파산 사건 위임 계약서</h2>

          <div className="space-y-1">
            <p><strong>위임인 (갑):</strong> {c.clientName} (연락처: {c.clientPhone})</p>
            <p><strong>수임인 (을):</strong> {c.lawFirmName} {c.lawyerName}</p>
          </div>
          <p className="text-xs text-slate-500 italic">위임인(이하 '갑')과 수임인(이하 '을')은 다음과 같이 위임계약을 체결한다.</p>

          <div>
            <h4 className="font-bold text-slate-800 mb-2">제 1 조 (수임료 및 비용)</h4>
            <table className="w-full text-xs border border-slate-200">
              <tbody>
                <tr className="border-b"><td className="p-2 bg-slate-50 font-bold w-1/2">총 수임료</td><td className="p-2 text-right">{(c.totalFee * 10000).toLocaleString()}원</td></tr>
                <tr><td className="p-2 bg-slate-50 font-bold">예상 법원비용</td><td className="p-2 text-right">{(costs.total + c.courtCosts.miscFee).toLocaleString()}원</td></tr>
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
              <ul className="space-y-1">{includedDocs.map(d => <li key={d.id} className="text-xs text-slate-600">• {d.title} {d.clientSignature ? '✅' : '⏳'}</li>)}</ul>
            )}
          </div>

          <div className="text-center text-xs text-slate-500 pt-4 border-t">작성일: {c.contractDate}</div>
          <div className="flex justify-between items-end pt-4">
            <div className="text-center">
              <p className="text-xs font-bold mb-2">위임인: {c.clientName} (인)</p>
              {c.documents.find(d => d.clientSignature) && <img src={c.documents.find(d => d.clientSignature)!.clientSignature} alt="의뢰인 서명" className="h-12 mx-auto" />}
            </div>
            <div className="text-center">
              <p className="text-xs font-bold mb-2">수임인: {c.lawyerName} (인)</p>
              {c.documents.find(d => d.lawyerSignature) && <img src={c.documents.find(d => d.lawyerSignature)!.lawyerSignature} alt="변호사 서명" className="h-12 mx-auto" />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const stepContent = [renderClientInfo, renderFeeSchedule, renderDocuments, renderTerms, renderSignature, renderPreview];
  const canProceed = step !== 3 || (agreePrivacy && agreeThirdParty && agreeProcedure);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <h2 className="text-xl font-black text-slate-900">✏️ 전자 계약서 작성</h2>
            <p className="text-xs text-slate-500 mt-0.5">{c.id} · {c.clientName || '신규 계약'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer whitespace-nowrap">💾 임시 저장</button>
          {step === 5 && (
            <button onClick={() => {
              const final = updateContractStatus(c, 'completed');
              saveContract(final);
              onSave(final);
              toast.success('계약이 완료되었습니다!');
              onClose();
            }} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand/90 rounded-xl cursor-pointer whitespace-nowrap min-h-[44px]">
              <Download className="w-3.5 h-3.5" /> 저장 및 완료
            </button>
          )}
        </div>
      </div>

      {/* 스텝 탭 (가로 - CRM 디테일 탭과 동일 스타일) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setStep(i)} className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap ${step === i ? 'bg-brand text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
              <Icon className="w-3.5 h-3.5" /> {s.label}
            </button>
          );
        })}
      </div>

      {/* 컨텐츠 영역 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
        {stepContent[step]()}
      </div>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between">
        <button onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"><ArrowLeft className="w-4 h-4" /> 이전</button>
        <div className="flex items-center gap-1">
          {STEPS.map((_, i) => <span key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-brand' : i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />)}
        </div>
        {step < 5 ? (
          <button onClick={() => canProceed && setStep(step + 1)} disabled={!canProceed} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-brand hover:bg-brand/90 rounded-xl cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap shadow-sm">다음 <ArrowRight className="w-4 h-4" /></button>
        ) : <div className="w-20" />}
      </div>
    </div>
  );
}

