import React, { useState, useMemo } from 'react';
import { X, Calculator, Shield, Check, Info, AlertCircle, Building2, Car } from 'lucide-react';
import { calculateSecuredShortage } from '../../../services/repayment/repaymentCalculationEngine';

interface SecuredDebtCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditorName: string;
  initialTotalDebt: number;
  onApply: (shortage: number, info: any) => void;
}

export default function SecuredDebtCalculatorModal({
  isOpen,
  onClose,
  creditorName,
  initialTotalDebt,
  onApply,
}: SecuredDebtCalculatorModalProps) {
  const [collateralType, setCollateralType] = useState<'real_estate' | 'car' | 'other'>('car');
  const [marketValue, setMarketValue] = useState<number>(15000000); // 1,500만원
  const [seniorEncumbrance, setSeniorEncumbrance] = useState<number>(0);
  const [exemptDeposit, setExemptDeposit] = useState<number>(0); // 부동산인 경우 서울 5,500만
  const [appraisalRate, setAppraisalRate] = useState<number>(0.7); // 70%
  const [principalDebt, setPrincipalDebt] = useState<number>(initialTotalDebt || 13000000);
  const [interestDebt, setInterestDebt] = useState<number>(1000000);

  // 채권현재액 총계 (C)
  const totalDebtClaim = principalDebt + interestDebt;

  // 환가예상액 (A) = 시가 * 환가예상율
  const expectedAuctionValue = Math.round(marketValue * appraisalRate);

  // 별제권 담보평가액 (B) = 환가예상액 - 선순위 - 소액보증금
  const assessedCollateralValue = Math.max(
    0,
    expectedAuctionValue - seniorEncumbrance - (collateralType === 'real_estate' ? exemptDeposit : 0)
  );

  // ④ 별제권행사후 예정부족액 = max(0, C - B)
  const calculatedShortage = Math.max(0, totalDebtClaim - assessedCollateralValue);

  // ③ 별제권행사 변제예상액 (담보 충당)
  const securedExpectedRepayment = Math.min(totalDebtClaim, assessedCollateralValue);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(calculatedShortage, {
      collateralType,
      marketValue,
      appraisalRate,
      expectedAuctionValue,
      seniorEncumbrance,
      exemptDeposit: collateralType === 'real_estate' ? exemptDeposit : 0,
      assessedCollateralValue,
      totalDebtClaim,
      principalDebt,
      interestDebt,
      securedExpectedRepayment,
      calculatedShortage,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-fadeIn text-slate-900">
        
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 text-purple-600 flex items-center justify-center font-bold">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <span>별제권 행사 후 예정부족액 보조 계산기</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  법원 전산양식
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                대상 채권자: <strong className="text-slate-800 font-bold">{creditorName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 폼 입력 영역 */}
        <div className="p-6 space-y-4 text-xs">
          
          {/* 담보물 유형 선택 */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">담보물 유형 선택</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCollateralType('car');
                  setAppraisalRate(0.7);
                  setMarketValue(15000000);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  collateralType === 'car'
                    ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>자동차 (시가 50~70%)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCollateralType('real_estate');
                  setAppraisalRate(0.8);
                  setMarketValue(300000000);
                  setExemptDeposit(55000000);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  collateralType === 'real_estate'
                    ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>부동산/아파트 (70~80%)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCollateralType('other');
                  setAppraisalRate(0.7);
                }}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer ${
                  collateralType === 'other'
                    ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>기타 담보재산</span>
              </button>
            </div>
          </div>

          {/* 시가 및 법원 환가예상율 적용 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">
                담보물 시가 (KB시가 / 중고차가)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={marketValue}
                  onChange={(e) => setMarketValue(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 pr-8 font-mono font-bold bg-white border border-slate-200 rounded-xl focus:border-purple-600 outline-none text-right"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-bold">원</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">법원 환가예상율 적용</label>
              {collateralType === 'car' ? (
                <div className="flex items-center gap-3 pt-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="carRate"
                      checked={appraisalRate === 0.7}
                      onChange={() => setAppraisalRate(0.7)}
                      className="accent-purple-600"
                    />
                    <span className="font-bold text-slate-800">70% (4년 이내)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="carRate"
                      checked={appraisalRate === 0.5}
                      onChange={() => setAppraisalRate(0.5)}
                      className="accent-purple-600"
                    />
                    <span className="font-bold text-slate-800">50% (4년 초과)</span>
                  </label>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reRate"
                      checked={appraisalRate === 0.8}
                      onChange={() => setAppraisalRate(0.8)}
                      className="accent-purple-600"
                    />
                    <span className="font-bold text-slate-800">80% (서울/수도권)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="reRate"
                      checked={appraisalRate === 0.7}
                      onChange={() => setAppraisalRate(0.7)}
                      className="accent-purple-600"
                    />
                    <span className="font-bold text-slate-800">70% (지방/기타)</span>
                  </label>
                </div>
              )}
            </div>

            <div className="col-span-1 md:col-span-2 pt-1 border-t border-slate-200/60 flex justify-between items-center text-slate-600">
              <span className="font-bold">➔ 환가예상액 (A):</span>
              <span className="font-mono font-bold text-purple-900 text-sm">
                {expectedAuctionValue.toLocaleString()} 원
              </span>
            </div>
          </div>

          {/* 선순위 근저당 / 소액보증금 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 block">선순위 근저당권 설정액</label>
              <div className="relative">
                <input
                  type="number"
                  value={seniorEncumbrance}
                  onChange={(e) => setSeniorEncumbrance(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 pr-8 font-mono bg-white border border-slate-200 rounded-xl focus:border-purple-600 outline-none text-right"
                  placeholder="0"
                />
                <span className="absolute right-3 top-2 text-slate-400 font-bold">원</span>
              </div>
            </div>

            {collateralType === 'real_estate' && (
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">소액임차보증금 최우선변제</label>
                <div className="relative">
                  <input
                    type="number"
                    value={exemptDeposit}
                    onChange={(e) => setExemptDeposit(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 pr-8 font-mono bg-white border border-slate-200 rounded-xl focus:border-purple-600 outline-none text-right"
                  />
                  <span className="absolute right-3 top-2 text-slate-400 font-bold">원</span>
                </div>
              </div>
            )}

            <div className="col-span-1 md:col-span-2 pt-1 border-t border-slate-200/60 flex justify-between items-center text-slate-600">
              <span className="font-bold">➔ 별제권 담보평가액 (B) = A - 선순위 - 보증금:</span>
              <span className="font-mono font-bold text-purple-900 text-sm">
                {assessedCollateralValue.toLocaleString()} 원
              </span>
            </div>
          </div>

          {/* 채권자 현재 피담보채무액 */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 block">
              채권자 현재 피담보채무액 (원금 및 개시전 이자)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">원금</label>
                <input
                  type="number"
                  value={principalDebt}
                  onChange={(e) => setPrincipalDebt(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 pr-7 font-mono font-bold bg-white border border-slate-200 rounded-xl focus:border-purple-600 outline-none text-right"
                />
                <span className="absolute right-2.5 top-6 text-slate-400 text-[10px] font-bold">원</span>
              </div>
              <div className="relative">
                <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">이자</label>
                <input
                  type="number"
                  value={interestDebt}
                  onChange={(e) => setInterestDebt(Number(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 pr-7 font-mono font-bold bg-white border border-slate-200 rounded-xl focus:border-purple-600 outline-none text-right"
                />
                <span className="absolute right-2.5 top-6 text-slate-400 text-[10px] font-bold">원</span>
              </div>
            </div>
            <div className="pt-1 border-t border-slate-200/60 flex justify-between items-center text-slate-600">
              <span className="font-bold">➔ 채권현재액 총계 (C):</span>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {totalDebtClaim.toLocaleString()} 원
              </span>
            </div>
          </div>

          {/* 📊 [자동 계산 결과] */}
          <div className="p-4 rounded-2xl bg-purple-50/80 border-2 border-purple-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-purple-950 font-black text-xs pb-1.5 border-b border-purple-200">
              <span>📊 [법원 기준 자동 계산 결과]</span>
            </div>

            <div className="flex justify-between items-center text-slate-800 text-xs">
              <span>• ③ 별제권행사 변제예상액 (담보 충당):</span>
              <strong className="font-mono text-purple-900 font-bold">
                {securedExpectedRepayment.toLocaleString()} 원
              </strong>
            </div>

            <div className="flex justify-between items-center text-purple-950 text-xs pt-1 border-t border-purple-100">
              <span className="font-black text-xs text-rose-700">
                • ④ 별제권행사후 예정부족액 (일반채권 유보금 반영):
              </span>
              <strong className="font-mono text-base font-black text-rose-700">
                {calculatedShortage.toLocaleString()} 원
              </strong>
            </div>

            <div className="flex justify-between items-center text-slate-600 text-xs">
              <span>• ⑤ 담보부 회생채권액:</span>
              <span className="font-mono text-slate-700 font-bold">
                {assessedCollateralValue.toLocaleString()} 원
              </span>
            </div>

            <p className="text-[10px] text-purple-800 leading-tight pt-1">
              * 별제권 담보평가액으로 충당되지 못하는 <strong>예정부족액({calculatedShortage.toLocaleString()}원)</strong>만이 일반 개인회생채권으로 변제계획안에 편입됩니다.
            </p>
          </div>

        </div>

        {/* 푸터 버튼 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer font-black"
          >
            <Check className="w-4 h-4" />
            <span>채권자 목록 및 변제계획안 반영</span>
          </button>
        </div>

      </div>
    </div>
  );
}
