import React, { useEffect, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEPOSIT_EXEMPTION_KRW,
  EXEMPT_INSURANCE_REFUND_LIMIT,
  HOUSING_EXEMPT_DEPOSIT_LIMITS,
  REGION_CONFIG_2026,
  RegionType,
  WAGE_EXEMPTION_CAP_BASE_KRW,
  WAGE_EXEMPTION_MIN_KRW,
  wageExemptAmount,
} from '../../../../services/repayment/repaymentConstants2026';
import { setDockLiquidation, setDockShared, useDockShared } from '../dockShared';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';
import MoneyInput from '../ui/MoneyInput';
import RegionSelect from '../ui/RegionSelect';
import { formatWonKorean, won } from '../ui/money';

const REGION_KEYS = Object.keys(HOUSING_EXEMPT_DEPOSIT_LIMITS) as RegionType[];

// 급여 압류금지 구간 경계 (단일 출처 상수에서 계산)
const WAGE_MIN = WAGE_EXEMPTION_MIN_KRW;            // 185만
const WAGE_HALF_FROM = WAGE_EXEMPTION_MIN_KRW * 2;  // 370만
const WAGE_CAP_FROM = WAGE_EXEMPTION_CAP_BASE_KRW * 2; // 600만

export default function SeizureLimitsTool() {
  const shared = useDockShared();
  const sharedLease = shared.liquidation.leaseDeposit;
  const [tab, setTab] = useState<'deposit' | 'housing'>('deposit');
  const [wage, setWage] = useState<number>(0);
  /**
   * 이 도구에서 입력했지만 아직 청산가치 점검기에 반영하지 않은 임차보증금.
   * undefined면 공유값(청산가치 점검기 등 다른 도구에서 넣은 값)을 그대로 보여 준다.
   * 이전: 처음 열 때만 공유값을 복사해, 다른 도구에서 바꾼 값이 보이지 않고 '반영'이 옛 값으로 덮어썼음
   */
  const [leaseDraft, setLeaseDraft] = useState<number | undefined>(undefined);
  const leaseDeposit = leaseDraft ?? sharedLease;
  const { copied, copy } = useCopyFeedback();

  // 공유값이 바뀌면(다른 도구에서 입력·새 상담) 이 도구의 미반영 입력을 버리고 최신 공유값을 보여 준다
  useEffect(() => {
    setLeaseDraft(undefined);
  }, [sharedLease]);

  const wageExempt = wageExemptAmount(wage);
  const lease = HOUSING_EXEMPT_DEPOSIT_LIMITS[shared.region];
  const isSmallTenant = leaseDeposit > 0 && leaseDeposit <= lease.maxDeposit;
  const protectedAmount = isSmallTenant ? Math.min(leaseDeposit, lease.exemptAmount) : 0;

  const handleApplyLease = () => {
    setDockLiquidation({ leaseDeposit });
    setLeaseDraft(undefined); // 반영 후에는 공유값을 그대로 표시
    toast.success(`임차보증금 ${formatWonKorean(leaseDeposit)}을 청산가치 점검기에 반영했습니다.`);
  };

  const handleCopy = () => {
    const housingLines = REGION_KEYS.map(k => {
      const l = HOUSING_EXEMPT_DEPOSIT_LIMITS[k];
      return `  • ${REGION_CONFIG_2026[k].label}: 보증금 ${formatWonKorean(l.maxDeposit)} 이하 중 최대 ${formatWonKorean(l.exemptAmount)}`;
    }).join('\n');
    const text = `[민사집행법 & 주택임대차 압류금지 기준 (참고)]
1. 압류금지 예금: 개인별 전 금융기관 잔액 합계 ${formatWonKorean(DEPOSIT_EXEMPTION_KRW)}
2. 압류금지 급여: 급여의 1/2 (최저 ${formatWonKorean(WAGE_MIN)} 보장, 급여 ${formatWonKorean(WAGE_MIN)} 이하는 전액)
   · 급여 ${formatWonKorean(WAGE_CAP_FROM)} 초과 시: ${formatWonKorean(WAGE_EXEMPTION_CAP_BASE_KRW)} + (급여/2 − ${formatWonKorean(WAGE_EXEMPTION_CAP_BASE_KRW)})/2 보호${wage > 0 ? `\n   · 세후 월급 ${won(wage)} → 압류금지 ${won(wageExempt)}, 압류 가능 ${won(Math.max(0, wage - wageExempt))}` : ''}
3. 보장성보험 해약환급금: ${formatWonKorean(EXEMPT_INSURANCE_REFUND_LIMIT)} 이하 압류 금지
4. 최우선변제금(소액임차보증금):
${housingLines}
※ 담보물권 설정일 기준으로 적용 기준이 달라질 수 있으니 등기사항증명서를 확인하세요.`;
    copy(text, '압류금지 기준표가 복사되었습니다.');
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      {/* 탭 전환 */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl" role="tablist" aria-label="압류금지 기준 구분">
        {([
          ['deposit', '예금·급여·보험금'],
          ['housing', '주택 최우선변제금'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              tab === value ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'deposit' ? (
        <div className="space-y-2">
          <div className="border border-slate-200 rounded-2xl p-2.5 bg-slate-50/60 space-y-1">
            <span className="font-bold text-slate-800 flex items-center justify-between">
              <span>통장 예금 잔액</span>
              <span className="text-amber-800 font-extrabold">{formatWonKorean(DEPOSIT_EXEMPTION_KRW)} 보호</span>
            </span>
            <p className="text-[11px] text-slate-600">
              개인별 전 금융기관 예금 잔액 합계 {formatWonKorean(DEPOSIT_EXEMPTION_KRW)}까지 압류 금지 (민사집행법 시행령 제7조). 금융기관이 지급을 막으면 압류금지채권 범위변경 신청을 검토하세요.
            </p>
          </div>

          <div className="border border-slate-200 rounded-2xl p-2.5 bg-slate-50/60 space-y-1.5">
            <span className="font-bold text-slate-800 flex items-center justify-between">
              <span>근로소득 (월급)</span>
              <span className="text-amber-800 font-extrabold">1/2 보호 (최저 {formatWonKorean(WAGE_MIN)})</span>
            </span>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              • 월 {formatWonKorean(WAGE_MIN)} 이하: 전액 압류 금지<br />
              • 월 {formatWonKorean(WAGE_MIN)} ~ {formatWonKorean(WAGE_HALF_FROM)}: {formatWonKorean(WAGE_MIN)} 보호<br />
              • 월 {formatWonKorean(WAGE_HALF_FROM)} ~ {formatWonKorean(WAGE_CAP_FROM)}: 급여의 1/2 보호<br />
              • 월 {formatWonKorean(WAGE_CAP_FROM)} 초과: {formatWonKorean(WAGE_EXEMPTION_CAP_BASE_KRW)} + (급여/2 − {formatWonKorean(WAGE_EXEMPTION_CAP_BASE_KRW)})/2 보호
            </p>
            <div>
              <label htmlFor="seizure-wage" className="text-[10px] text-slate-600 font-semibold block mb-0.5">세후 월급</label>
              <MoneyInput id="seizure-wage" value={wage} onChange={setWage} placeholder="예: 420만" />
            </div>
            {wage > 0 && (
              <p className="text-[11px] font-bold text-amber-900 tabular-nums" aria-live="polite">
                압류금지 {won(wageExempt)} · 압류 가능 {won(Math.max(0, wage - wageExempt))}
              </p>
            )}
          </div>

          <div className="border border-slate-200 rounded-2xl p-2.5 bg-slate-50/60 space-y-1">
            <span className="font-bold text-slate-800 flex items-center justify-between">
              <span>보험금 및 퇴직금</span>
              <span className="text-amber-800 font-extrabold">법정 보호</span>
            </span>
            <p className="text-[11px] text-slate-600">
              • 사망보험금 1,000만 원 이하 / 보장성보험 해약환급금 {formatWonKorean(EXEMPT_INSURANCE_REFUND_LIMIT)} 이하<br />
              • 퇴직금: 1/2 압류 금지 / 퇴직연금 수급권: 원칙적으로 압류 금지 (근로자퇴직급여보장법 제7조)
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-[11px] text-left">
              <caption className="sr-only">지역별 소액임차보증금 최우선변제 기준</caption>
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th scope="col" className="py-2 px-2.5">지역 구분</th>
                  <th scope="col" className="py-2 px-2.5">보증금 기준</th>
                  <th scope="col" className="py-2 px-2.5 text-amber-900 bg-amber-50">최우선변제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {REGION_KEYS.map(k => {
                  const l = HOUSING_EXEMPT_DEPOSIT_LIMITS[k];
                  const selected = shared.region === k;
                  return (
                    <tr key={k} className={selected ? 'bg-amber-50/60' : 'hover:bg-slate-50'}>
                      <td className="py-1.5 px-2.5 font-bold">{REGION_CONFIG_2026[k].label}</td>
                      <td className="py-1.5 px-2.5 tabular-nums">{formatWonKorean(l.maxDeposit)} 이하</td>
                      <td className="py-1.5 px-2.5 font-extrabold text-amber-800 bg-amber-50/40 tabular-nums">{formatWonKorean(l.exemptAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 소액임차인 해당 여부 계산 */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 space-y-2">
            <span className="font-bold text-amber-950 block">내 보증금 확인</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="seizure-region" className="text-[10px] text-slate-600 font-semibold block mb-0.5">거주 지역</label>
                <RegionSelect id="seizure-region" value={shared.region} onChange={region => setDockShared({ region })} />
              </div>
              <div>
                <label htmlFor="seizure-lease" className="text-[10px] text-slate-600 font-semibold block mb-0.5">임차보증금</label>
                <MoneyInput id="seizure-lease" value={leaseDeposit} onChange={setLeaseDraft} placeholder="예: 5000만" />
              </div>
            </div>
            {leaseDeposit > 0 && (
              <div className="text-[11px] space-y-0.5" aria-live="polite">
                {isSmallTenant ? (
                  <>
                    <p className="font-bold text-amber-900">소액임차인 기준 해당 → 최대 {formatWonKorean(protectedAmount)} 보호</p>
                    <p className="text-slate-700">청산가치 반영 예상: {formatWonKorean(Math.max(0, leaseDeposit - protectedAmount))} (보증금 대출은 청산가치 점검기에서 차감)</p>
                  </>
                ) : (
                  <p className="font-bold text-slate-800">
                    보증금이 기준({formatWonKorean(lease.maxDeposit)} 이하)을 넘어 소액임차 보호 대상이 아닙니다. 보증금 전액(대출 차감)이 청산가치에 반영됩니다.
                  </p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleApplyLease}
              disabled={leaseDeposit <= 0}
              className="w-full min-h-[36px] py-1.5 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer press-scale flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" aria-hidden="true" />
              청산가치 점검기에 반영
            </button>
          </div>
          <p className="text-[10px] text-slate-600">
            * 담보물권(근저당) 설정일자 기준 규정이 적용될 수 있으므로 등기사항증명서 확인이 필요합니다.
          </p>
        </div>
      )}

      <CopyButton copied={copied} onClick={handleCopy} label="압류금지 기준 복사" />
    </div>
  );
}
