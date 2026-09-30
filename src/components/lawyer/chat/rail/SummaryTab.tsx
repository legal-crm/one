import React from 'react';
import { AlertTriangle, Calculator, ClipboardList, UserRound } from 'lucide-react';
import type { ConsultRequest, FinancialProfile } from '../../../../types';
import {
  GENDER_LABELS, HARASSMENT_SHORT_LABELS, HOUSING_HOLDER_LABELS, HOUSING_SHORT_LABELS, JOB_TYPE_SHORT_LABELS,
  LEGAL_ACTION_LABELS, MARITAL_SHORT_LABELS, SPECIAL_COND_SHORT_LABELS, harassmentSeverity, lookupLabel,
} from '../../../../constants/clientProfileLabels';
import { formatManwon } from '../chatFormat';
import type { RepaymentSummary } from './useRepaymentSimulation';
import { DefinitionGrid, RailSection, ToneDot } from './railUi';

type Tone = 'default' | 'risk' | 'caution';

function KpiTile({ label, aside, value, tone = 'default' }: { label: string; aside?: string; value: string; tone?: Tone }) {
  const box = tone === 'risk' ? 'bg-rose-50 border-rose-200' : tone === 'caution' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
  const labelCls = tone === 'risk' ? 'text-rose-800' : tone === 'caution' ? 'text-amber-800' : 'text-slate-500';
  const valueCls = tone === 'risk' ? 'text-rose-700' : tone === 'caution' ? 'text-amber-800' : 'text-slate-900';
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${box}`}>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <span className={`shrink-0 text-[12px] ${labelCls}`}>{label}</span>
        {aside && <span className="truncate text-[12px] text-slate-500">{aside}</span>}
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums [overflow-wrap:anywhere] ${valueCls}`}>{value}</div>
    </div>
  );
}

export function hasFinancialData(fp: FinancialProfile | undefined | null): boolean {
  if (!fp) return false;
  return Boolean((fp.debtTotal || 0) > 0 || (fp.income || 0) > 0 || (fp.assetsTotal || 0) > 0 || (fp.debts && fp.debts.length > 0));
}

interface CheckItem { tone: 'risk' | 'caution' | 'positive'; text: string }

/** 확인 필요 사항: 법적 위험 → 확인 필요 → 유리한 조건 순 */
function buildCheckItems(fp: FinancialProfile): CheckItem[] {
  const items: CheckItem[] = [];
  const recentLoans = fp.debtTypes?.recentLoans || 0;
  const speculative = (fp.speculativeLoss || 0) + (fp.gamblingLoss || 0);
  const coin = fp.debtTypes?.coinCrypto || 0;

  if ((fp.priorityDebt || 0) > 0) {
    items.push({ tone: 'risk', text: `우선변제 채무 ${formatManwon(fp.priorityDebt)} (국세·4대보험 등 전액 변제 대상)` });
  }
  if (recentLoans > 0) items.push({ tone: 'risk', text: `최근 1년 내 신규 대출 ${formatManwon(recentLoans)}` });
  if (speculative > 0) items.push({ tone: 'risk', text: `사행성 손실 ${formatManwon(speculative)} (청산가치 반영 가능)` });
  else if (coin > 0) items.push({ tone: 'risk', text: `투자·코인 손실 ${formatManwon(coin)}` });

  const actions = (fp.legalActions || []).filter(a => a && a !== 'none');
  if (actions.length > 0) {
    const severe = actions.some(a => /seizure|court_order/i.test(a));
    items.push({
      tone: severe ? 'risk' : 'caution',
      text: `진행 중인 법적 조치: ${actions.map(a => lookupLabel(LEGAL_ACTION_LABELS, a, a)).join(', ')}`,
    });
  }

  // 위에서 금액으로 이미 보여준 항목과 겹치는 위험 태그는 뺀다
  for (const flag of fp.riskFlags || []) {
    if (!flag) continue;
    if (recentLoans > 0 && /최근.*대출/.test(flag)) continue;
    if ((speculative > 0 || coin > 0) && /사행|투자|코인|도박/.test(flag)) continue;
    items.push({ tone: 'risk', text: flag });
  }

  const notes = fp.clientNotes && fp.clientNotes.length > 0 ? fp.clientNotes : fp.clientNote ? [fp.clientNote] : [];
  notes.filter(Boolean).forEach(n => items.push({ tone: 'caution', text: `의뢰인 요청: ${n}` }));

  if (fp.specialCondition && fp.specialCondition !== 'none') {
    items.push({ tone: 'positive', text: `24개월 특례 검토 대상: ${lookupLabel(SPECIAL_COND_SHORT_LABELS, fp.specialCondition, fp.specialCondition)}` });
  }
  return items;
}

interface SummaryTabProps {
  request: ConsultRequest;
  simulation: RepaymentSummary | null;
  getDisplayPhoneNumber: (req: ConsultRequest) => string;
  onOpenCrmInfo: () => void;
}

export default function SummaryTab({ request, simulation, getDisplayPhoneNumber, onOpenCrmInfo }: SummaryTabProps) {
  const fp: FinancialProfile = request.financialProfile || ({} as FinancialProfile);
  const hasData = hasFinancialData(fp);
  const household = (fp.dependents || 0) + 1;
  const creditorCount = fp.creditorCount || fp.debts?.length || 0;
  const assets = fp.assetsTotal || fp.myAssets || 0;
  const severity = harassmentSeverity(fp.harassmentLevel);
  const checkItems = buildCheckItems(fp);

  const gender = lookupLabel(GENDER_LABELS, fp.gender, '');
  const ageGender = [fp.age ? `${fp.age}세` : '', gender].filter(Boolean).join(' · ') || '미기재';
  const householdText = `${household}인${fp.dependents ? ` (부양 ${fp.dependents}명)` : ''}${fp.minorChildren ? ` · 미성년 자녀 ${fp.minorChildren}명` : ''}`;
  const job = lookupLabel(JOB_TYPE_SHORT_LABELS, fp.jobType || fp.employmentType);
  const housing = fp.housingType
    ? `${lookupLabel(HOUSING_SHORT_LABELS, fp.housingType)}${fp.housingContractHolder ? ` (${lookupLabel(HOUSING_HOLDER_LABELS, fp.housingContractHolder)})` : ''}`
    : '미기재';

  const rate = Math.max(0, Math.min(100, Math.round(simulation?.reductionRate || 0)));

  return (
    <div className="divide-y divide-slate-100">
      {hasData ? (
        <section className="pb-4">
          <h3 className="sr-only">핵심 지표</h3>
          <div className="grid grid-cols-2 gap-2">
            <KpiTile label="총 채무" aside={creditorCount ? `채권자 ${creditorCount}곳` : undefined} value={formatManwon(fp.debtTotal || 0)} />
            <KpiTile label="월 소득" aside={`${household}인 가구`} value={formatManwon(fp.income || 0)} />
            <KpiTile
              label="재산 합계"
              aside={simulation ? `청산 ${formatManwon(simulation.liquidationValue, { unit: false })}` : undefined}
              value={formatManwon(assets)}
            />
            <KpiTile
              label="추심 단계"
              value={lookupLabel(HARASSMENT_SHORT_LABELS, fp.harassmentLevel)}
              tone={severity === 'risk' ? 'risk' : severity === 'caution' ? 'caution' : 'default'}
            />
          </div>
        </section>
      ) : (
        <section className="pb-4">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
            <ClipboardList className="mx-auto w-7 h-7 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-slate-700">자가진단 정보가 없습니다</p>
            <p className="mt-1 text-xs text-slate-600">채무·소득을 입력하면 핵심 지표와 변제 시뮬레이션이 표시됩니다.</p>
            <button
              type="button"
              onClick={onOpenCrmInfo}
              className="mt-3 h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-brand whitespace-nowrap press-scale cursor-pointer"
            >
              고객관리에서 입력
            </button>
          </div>
        </section>
      )}

      <RailSection icon={AlertTriangle} iconClassName="text-amber-600" title="확인 필요 사항" aside={checkItems.length > 0 ? `${checkItems.length}건` : undefined}>
        {checkItems.length > 0 ? (
          <ul className="space-y-2">
            {checkItems.map((item, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-5 text-slate-700 [overflow-wrap:anywhere]">
                <ToneDot tone={item.tone} />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-600">자가진단에서 확인된 위험 신호나 요청 사항이 없습니다.</p>
        )}
      </RailSection>

      {hasData && (
        <RailSection icon={Calculator} title="변제 시뮬레이션" aside="자가진단 입력 기준 추정">
          {simulation ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[12px] text-slate-500">월 변제금</div>
                  <div className="mt-0.5 flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{formatManwon(simulation.monthlyPay)}</span>
                    <span className="text-xs text-slate-600 tabular-nums">/ {simulation.months}개월</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[12px] text-slate-500">예상 탕감률</div>
                  <div className="mt-0.5 text-xl font-bold text-emerald-700 tabular-nums">{rate}%</div>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden" role="img" aria-label={`예상 탕감률 ${rate}%`}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate}%` }} />
              </div>
              <p className="mt-2.5 text-[12px] leading-5 text-slate-600 tabular-nums">
                총 변제 {formatManwon(simulation.totalRepay)} · 탕감 {formatManwon(simulation.reduction)} · 청산가치 {formatManwon(simulation.liquidationValue)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600">입력된 정보로는 시뮬레이션을 계산할 수 없습니다.</p>
          )}
        </RailSection>
      )}

      <RailSection icon={UserRound} title="인적 사항">
        <DefinitionGrid
          items={[
            { label: '나이·성별', value: ageGender },
            { label: '가구', value: householdText },
            { label: '거주지', value: fp.residenceRegion || fp.address || '미기재' },
            { label: '직업', value: `${job}${fp.companyName ? ` (${fp.companyName})` : ''}` },
            { label: '주거', value: housing },
            { label: '혼인', value: lookupLabel(MARITAL_SHORT_LABELS, fp.maritalStatus) },
            { label: '연락처', value: <span className="tabular-nums">{getDisplayPhoneNumber(request)}</span> },
          ]}
        />
      </RailSection>
    </div>
  );
}
