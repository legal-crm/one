import React, { useState, useMemo } from 'react';
import { X, UserPlus, AlertTriangle, Check, Phone, DollarSign, Home, Briefcase, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { SalesLead } from '../../../types/leadTypes';
import type { ConsultRequest } from '../../../types';
import { ChipSelect } from './ChipSelect';
import { formatPhone, normalizeBirthYear, checkLeadPhoneDuplicate } from '../../../services/leadService';
import { loadInboundPaths, loadSecondaryStatuses } from '../../../services/settingsService';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister: (lead: SalesLead) => void;
  existingLeads: SalesLead[];
  existingRequests: ConsultRequest[];
}

export default function NewLeadModal({
  isOpen,
  onClose,
  onRegister,
  existingLeads,
  existingRequests,
}: NewLeadModalProps) {
  const inboundPaths = useMemo(() => loadInboundPaths(), [isOpen]);
  const secondaryStatuses = useMemo(() => loadSecondaryStatuses(), [isOpen]);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<'남' | '여'>('남');
  const [region, setRegion] = useState('');
  const [inboundPath, setInboundPath] = useState('타사DB구매');
  const [batchName, setBatchName] = useState('');
  const [caseType, setCaseType] = useState<'개인회생' | '개인파산'>('개인회생');
  const [secondaryStatus, setSecondaryStatus] = useState('');

  // 직업 및 소득
  const [jobTypes, setJobTypes] = useState<string[]>(['급여소득']);
  const [insurance4, setInsurance4] = useState<'가입' | '미가입'>('가입');
  const [maritalStatus, setMaritalStatus] = useState<'미혼' | '기혼' | '이혼'>('미혼');
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [incomeNet, setIncomeNet] = useState<number>(0);
  const [loanMonthlyPay, setLoanMonthlyPay] = useState<number>(0);

  // 주거 및 자산
  const [housingType, setHousingType] = useState<'자가' | '전세' | '월세' | '무상거주'>('월세');
  const [housingDetail, setHousingDetail] = useState('');
  const [deposit, setDeposit] = useState<number>(0);
  const [rent, setRent] = useState<number>(0);
  const [ownHousePrice, setOwnHousePrice] = useState<number>(0);
  const [ownHouseLoan, setOwnHouseLoan] = useState<number>(0);

  // 채무 및 대출
  const [debtTotal, setDebtTotal] = useState<number>(0);
  const [creditCardUse, setCreditCardUse] = useState<'사용' | '미사용'>('사용');
  const [collateralLoanDesc, setCollateralLoanDesc] = useState('');
  const [historyDetail, setHistoryDetail] = useState('');
  const [specialMemo, setSpecialMemo] = useState('');

  // 실시간 중복 체크
  const duplicateCheck = useMemo(() => {
    return checkLeadPhoneDuplicate(phone, existingLeads, existingRequests);
  }, [phone, existingLeads, existingRequests]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error('고객명을 입력해주세요.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      toast.error('유효한 10~11자리 연락처를 입력해주세요.');
      return;
    }

    const newLead: SalesLead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: customerName.trim(),
      phone: formatPhone(phone),
      status: 'new',
      secondaryStatus: secondaryStatus || '신규인입',
      birth: normalizeBirthYear(birth),
      gender,
      region: region.trim(),
      inboundPath,
      batchName: batchName.trim() || undefined,
      caseType,
      jobTypes,
      insurance4,
      maritalStatus,
      childrenCount,
      incomeNet,
      loanMonthlyPay,
      housingType,
      housingDetail: housingDetail.trim() || undefined,
      deposit,
      rent,
      ownHousePrice: housingType === '자가' ? ownHousePrice : undefined,
      ownHouseLoan: housingType === '자가' ? ownHouseLoan : undefined,
      assets: [],
      debtTotal,
      creditCardUse,
      collateralLoanDesc: collateralLoanDesc.trim() || undefined,
      historyDetail: historyDetail.trim() || undefined,
      specialMemo: specialMemo.trim(),
      callCount: 0,
      reminders: [],
      callLogs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onRegister(newLead);
    toast.success(`${customerName} 영업 DB가 등록되었습니다.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-500/20">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">단건 신규 영업 DB 등록</h2>
              <p className="text-xs text-slate-500">초고속 칩 선택 폼을 통해 영업 리드를 빠르게 등록합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body - Single Scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 중복 경고 배너 */}
          {duplicateCheck.isDuplicate && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800 animate-pulse">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>
                <strong>중복 번호 감지:</strong> 이미 {duplicateCheck.matchType === 'client' ? '고객 관리(CRM)' : '영업 DB'}에 등록된 번호입니다. ({duplicateCheck.matchedName})
              </span>
            </div>
          )}

          {/* 1. BLUE: 기본 인적사항 및 접수 */}
          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50/40 px-4 py-2.5 border-b border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">1</span>
                <h3 className="font-extrabold text-slate-900 text-sm">기본 인적사항 및 접수</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">고객명 *</label>
                  <input
                    type="text"
                    required
                    placeholder="홍길동"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">연락처 *</label>
                  <input
                    type="text"
                    required
                    placeholder="010-0000-0000"
                    value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">출생년도 (4자리)</label>
                  <input
                    type="text"
                    placeholder="1985"
                    value={birth}
                    onChange={e => setBirth(e.target.value)}
                    onBlur={e => setBirth(normalizeBirthYear(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <ChipSelect
                  label="성별"
                  options={['남', '여']}
                  value={gender}
                  onChange={setGender}
                />
                <ChipSelect
                  label="사건 구분"
                  options={['개인회생', '개인파산']}
                  value={caseType}
                  onChange={setCaseType}
                />
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">거주 지역</label>
                  <input
                    type="text"
                    placeholder="서울 강남구"
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                <ChipSelect
                  label="유입 경로"
                  options={inboundPaths.slice(0, 6)}
                  value={inboundPath}
                  onChange={setInboundPath}
                />
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">DB 배치명 / 출처 상세</label>
                  <input
                    type="text"
                    placeholder="예: 2026-09 타사동의DB 500건"
                    value={batchName}
                    onChange={e => setBatchName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. EMERALD: 소득 및 직업 / 부양가족 */}
          <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50/40 px-4 py-2.5 border-b border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">2</span>
                <h3 className="font-extrabold text-slate-900 text-sm">소득 및 직업 / 부양가족</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <ChipSelect
                label="직업군 (다중 선택 가능)"
                options={['급여소득', '영업소득', '프리랜서', '일용직', '무직']}
                value={jobTypes}
                onChange={setJobTypes}
                isMulti
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChipSelect
                  label="4대보험"
                  options={['가입', '미가입']}
                  value={insurance4}
                  onChange={setInsurance4}
                />
                <ChipSelect
                  label="혼인 여부"
                  options={['미혼', '기혼', '이혼']}
                  value={maritalStatus}
                  onChange={setMaritalStatus}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">월 실급여 (만원)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="250"
                    value={incomeNet || ''}
                    onChange={e => setIncomeNet(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">월 대출 상환액 (만원)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="120"
                    value={loanMonthlyPay || ''}
                    onChange={e => setLoanMonthlyPay(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">미성년 자녀 수 (명)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={childrenCount || ''}
                    onChange={e => setChildrenCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-hidden bg-slate-50/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. AMBER: 주거 형태 및 주요 자산 */}
          <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 px-4 py-2.5 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center">3</span>
                <h3 className="font-extrabold text-slate-900 text-sm">주거 형태 및 주요 자산</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <ChipSelect
                label="주거 형태"
                options={['자가', '전세', '월세', '무상거주']}
                value={housingType}
                onChange={setHousingType}
              />

              {housingType === '월세' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">보증금 (만원)</label>
                    <input
                      type="number"
                      placeholder="1000"
                      value={deposit || ''}
                      onChange={e => setDeposit(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">월세 (만원)</label>
                    <input
                      type="number"
                      placeholder="60"
                      value={rent || ''}
                      onChange={e => setRent(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                    />
                  </div>
                </div>
              )}

              {housingType === '전세' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">전세 보증금 (만원)</label>
                  <input
                    type="number"
                    placeholder="8000"
                    value={deposit || ''}
                    onChange={e => setDeposit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                  />
                </div>
              )}

              {housingType === '자가' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">부동산 시세 (만원)</label>
                    <input
                      type="number"
                      placeholder="35000"
                      value={ownHousePrice || ''}
                      onChange={e => setOwnHousePrice(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">담보 대출액 (만원)</label>
                    <input
                      type="number"
                      placeholder="20000"
                      value={ownHouseLoan || ''}
                      onChange={e => setOwnHouseLoan(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 4. ROSE: 채무 및 대출 상환 내역 */}
          <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-rose-50 to-pink-50/40 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center">4</span>
                <h3 className="font-extrabold text-slate-900 text-sm">채무 및 대출 내역</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">총 채무액 (만원) *</label>
                  <input
                    type="number"
                    required
                    placeholder="5000"
                    value={debtTotal || ''}
                    onChange={e => setDebtTotal(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-black text-rose-600 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-hidden bg-slate-50/50"
                  />
                </div>
                <ChipSelect
                  label="신용카드 사용 여부"
                  options={['사용', '미사용']}
                  value={creditCardUse}
                  onChange={setCreditCardUse}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">담보대출 상세 (차량, 부동산 등)</label>
                <input
                  type="text"
                  placeholder="예: 쏘렌토 할부잔액 1,500만원"
                  value={collateralLoanDesc}
                  onChange={e => setCollateralLoanDesc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                />
              </div>
            </div>
          </div>

          {/* 5. VIOLET: 과거 채무조정 이력 및 특이사항 */}
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xs overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-indigo-50/40 px-4 py-2.5 border-b border-purple-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center">5</span>
                <h3 className="font-extrabold text-slate-900 text-sm">과거 이력 및 특이사항</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">개인회생/파산/신복위 과거 이력</label>
                <input
                  type="text"
                  placeholder="예: 2021년 신용회복 신청 후 6개월 납부하다 실효"
                  value={historyDetail}
                  onChange={e => setHistoryDetail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">상담 특이사항 및 사전 수집 메모</label>
                <textarea
                  rows={3}
                  placeholder="통화 전 사전 수집된 메모나 특이사항을 기재하세요."
                  value={specialMemo}
                  onChange={e => setSpecialMemo(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/50 resize-none"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-sm shadow-blue-500/20 transition-all cursor-pointer press-scale active:scale-[0.98]"
          >
            영업 DB 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}
