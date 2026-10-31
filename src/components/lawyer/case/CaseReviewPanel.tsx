// 사건 검토 패널 (CV-1·CV-2) — 상담 요청 상세 '사건 검토' 탭, 사건 관리 1단계에 같은 패널
// 통합 엔진 하나(estimateRehabPlan), 서버 기록(case_reviews), 사무소가 고친 값이 우선.
// 이전: 별도 'AI 사건 분석' 메뉴, 고정 문장 총평("회생 신청에 적합한 조건"·"우량 적격 사례"), 기본 탕감률 65%
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Calculator, ClipboardCheck, History, Save } from 'lucide-react';
import { applyCaseReviewRules, EMPTY_CASE_REVIEW_RULES, loadCaseReviewRules, type CaseReviewRules } from '../../../services/cases/caseReviewRules';
import {
  REVIEW_REGION_LABEL, STATUS_LABEL, emptyReviewInput, inputFromProfile, loadLatestReview, runCaseReview, saveReview,
  type CaseReviewInput, type ReviewRegion,
} from '../../../services/cases/caseReviewService';

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;
const field = 'mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm bg-white text-right tabular-nums';

function MoneyInput({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: number) => void; hint?: string }) {
  return (
    <label className="text-xs font-semibold text-slate-700">{label}
      <input inputMode="numeric" value={value ? value.toLocaleString('ko-KR') : ''} placeholder="0" onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)} className={field} />
      {hint && <span className="block mt-0.5 text-[11px] font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

export default function CaseReviewPanel({ officeId, caseKey, financialProfile, crmExt, isBankruptcy, canWrite, onUseInProposal }: {
  officeId?: string;
  caseKey: string;
  financialProfile?: any;
  crmExt?: any;
  isBankruptcy?: boolean;
  canWrite: boolean;
  /** 결과를 제안서 초안에 쓰기 */
  onUseInProposal?: (r: { monthlyPayment: number; months: number; totalRepayment: number }) => void;
}) {
  const seeded = useMemo(() => inputFromProfile(financialProfile, crmExt), [financialProfile, crmExt]);
  const [input, setInput] = useState<CaseReviewInput>(seeded.input);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!officeId);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // 사무소 '사건 검토 기준' (CV-5) — 설정 › 사무소 설정 › 사건 검토 기준
  const [rules, setRules] = useState<CaseReviewRules>(EMPTY_CASE_REVIEW_RULES);
  const [checked, setChecked] = useState<string[]>([]);
  useEffect(() => {
    let stop = false;
    if (!officeId) return;
    void loadCaseReviewRules(officeId).then(r => { if (!stop && r.ok) setRules(r.rules); });
    return () => { stop = true; };
  }, [officeId]);

  useEffect(() => {
    let stop = false;
    if (!officeId) { setLoading(false); return; }
    setLoading(true);
    void loadLatestReview(officeId, caseKey).then(r => {
      if (stop) return;
      setLoading(false);
      if (r.ok && r.data) { setInput({ ...emptyReviewInput(), ...r.data.input }); setSavedAt(r.data.createdAt); setNote(r.data.note || ''); setChecked(r.data.result?.checklistDone || []); }
      else setInput(seeded.input);
    });
    return () => { stop = true; };
  }, [officeId, caseKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const result = useMemo(() => runCaseReview(input), [input]);
  const ruleNotes = useMemo(() => applyCaseReviewRules(input, result, rules), [input, result, rules]);
  const set = <K extends keyof CaseReviewInput>(k: K) => (v: CaseReviewInput[K]) => setInput(p => ({ ...p, [k]: v }));
  const missing = [!input.monthlyIncome && '월 소득', !input.generalDebt && '총 채무'].filter(Boolean) as string[];

  const save = async () => {
    if (!officeId) { toast.error('사무소 정보를 확인하지 못해 저장하지 않았어요.'); return; }
    setBusy(true);
    const r = await saveReview(officeId, caseKey, input, { ...result, ruleNotes, checklistDone: checked.filter(c => rules.checklist.includes(c)) }, note);
    setBusy(false);
    if (r.ok === false) { toast.error(`저장하지 못했어요: ${r.message}`); return; }
    setSavedAt(r.data.createdAt);
    toast.success('검토 기록을 남겼어요.');
  };

  if (isBankruptcy) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2" aria-label="사건 검토">
        <h3 className="text-base font-black text-slate-900">사건 검토 (파산)</h3>
        <p className="text-sm text-slate-600">파산 사건은 변제금 계산 대신 지급불능 시점·재산·면책 불허가 사유를 정리해요. 4단계 '파산 서식 작성'과 5·6단계 '예납·관재인·면책' 화면에서 이어서 기록해 주세요.</p>
      </section>
    );
  }
  if (loading) {
    return <section aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"><div className="h-5 w-32 rounded-lg bg-slate-100 animate-pulse" /><div className="h-24 rounded-xl bg-slate-100 animate-pulse" /></section>;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4" aria-label="사건 검토">
      <header className="flex flex-wrap items-center gap-2">
        <Calculator className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />
        <h3 className="text-base font-black text-slate-900">사건 검토</h3>
        <span className="text-xs text-slate-500">{savedAt ? `마지막 기록 ${new Date(savedAt).toLocaleString('ko-KR')}` : '아직 기록 없음'}{seeded.missing.length && !savedAt ? ` · 의뢰인 자료에 없는 값: ${seeded.missing.join(', ')}` : ''}</span>
      </header>
      <p className="text-xs text-slate-600">의뢰인이 정리한 값으로 먼저 채웠어요. 확인한 값으로 고치면 바로 다시 계산해요. 결과는 변호사 검토용이며 의뢰인에게는 제안서로 보낸 값만 보여요.</p>

      <fieldset disabled={!canWrite} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-xs font-semibold text-slate-700">적용 연도
          <input type="number" min={2025} max={2030} value={input.year} onChange={e => set('year')(Number(e.target.value) || new Date().getFullYear())} className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-700">가구원 수(본인 포함)
          <input type="number" min={1} max={10} value={input.householdSize} onChange={e => set('householdSize')(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} className={field} />
        </label>
        <label className="text-xs font-semibold text-slate-700">거주 지역
          <select value={input.region} onChange={e => set('region')(e.target.value as ReviewRegion)} className="mt-1 w-full min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm bg-white">
            {(Object.keys(REVIEW_REGION_LABEL) as ReviewRegion[]).map(k => <option key={k} value={k}>{REVIEW_REGION_LABEL[k]}</option>)}
          </select>
        </label>
        <MoneyInput label="월 소득(실수령)" value={input.monthlyIncome} onChange={set('monthlyIncome')} />
        <MoneyInput label="월 주거비(월세 등)" value={input.housingExpense} onChange={set('housingExpense')} />
        <MoneyInput label="월 의료비" value={input.medicalExpense} onChange={set('medicalExpense')} />
        <label className="text-xs font-semibold text-slate-700">미성년 자녀 수
          <input type="number" min={0} max={9} value={input.children} onChange={e => set('children')(Math.max(0, Number(e.target.value) || 0))} className={field} />
        </label>
        <MoneyInput label="자녀 1인당 교육비(월)" value={input.educationPerChild} onChange={set('educationPerChild')} />
        <MoneyInput label="일반 채무 원금" value={input.generalDebt} onChange={set('generalDebt')} />
        <MoneyInput label="조세 등 우선채권" value={input.priorityDebt} onChange={set('priorityDebt')} />
        <MoneyInput label="예금·적금" value={input.deposit} onChange={set('deposit')} hint="압류금지 250만 원 공제는 엔진이 해요" />
        <MoneyInput label="보험 해약환급금" value={input.insurance} onChange={set('insurance')} />
        <MoneyInput label="임차보증금" value={input.housingDeposit} onChange={set('housingDeposit')} />
        <MoneyInput label="자동차(시가-담보)" value={input.car} onChange={set('car')} />
        <MoneyInput label="부동산(시가-담보)" value={input.realEstate} onChange={set('realEstate')} />
        <MoneyInput label="예상 퇴직금" value={input.retirement} onChange={set('retirement')} />
        <MoneyInput label="기타 재산" value={input.otherAssets} onChange={set('otherAssets')} />
        <MoneyInput label="청산가치 가산" value={input.additionalInclusion} onChange={set('additionalInclusion')} hint="편파변제 등 변호사 판단" />
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mt-5"><input type="checkbox" className="w-4 h-4" checked={input.allowShortPlan} onChange={e => set('allowShortPlan')(e.target.checked)} /> 3년 미만 단축 사유 있음</label>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mt-5"><input type="checkbox" className="w-4 h-4" checked={input.trusteeExternal} onChange={e => set('trusteeExternal')(e.target.checked)} /> 외부 회생위원</label>
      </fieldset>

      {missing.length > 0 ? (
        <p role="status" className="text-sm font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{missing.join('·')}을(를) 넣으면 계산해요.</p>
      ) : (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><p className="text-xs text-slate-500">월 변제금(예상)</p><p className="text-lg font-black text-slate-900 tabular-nums">{won(result.monthlyPayment)}</p></div>
            <div><p className="text-xs text-slate-500">변제 기간</p><p className="text-lg font-black text-slate-900">{result.months}개월 <span className="text-xs font-bold text-slate-600">{STATUS_LABEL[result.status] || ''}</span></p></div>
            <div><p className="text-xs text-slate-500">총 변제액(예상)</p><p className="text-lg font-black text-slate-900 tabular-nums">{won(result.totalRepayment)}</p></div>
          </div>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-700">
            <div><dt className="text-slate-500">인정 생계비(월)</dt><dd className="font-bold tabular-nums">{won(result.recognizedLivingCost)}</dd></div>
            <div><dt className="text-slate-500">기준 생계비</dt><dd className="font-bold tabular-nums">{won(result.baseLivingCost)}</dd></div>
            <div><dt className="text-slate-500">가용 소득(월)</dt><dd className="font-bold tabular-nums">{won(result.disposableIncome)}</dd></div>
            <div><dt className="text-slate-500">청산가치</dt><dd className="font-bold tabular-nums">{won(result.liquidationValue)}{result.satisfiesLiquidation ? '' : ' · 보장 미충족'}</dd></div>
          </dl>
          {result.why && <p className="text-xs text-slate-600">판단 근거: {result.why}</p>}
          {result.warnings.length > 0 && <ul className="text-xs text-amber-800 list-disc pl-4">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>}
        </div>
      )}

      {missing.length === 0 && ruleNotes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-bold text-amber-900">사무소 검토 기준에서 확인할 점</p>
          <ul className="mt-1 text-xs text-amber-900 list-disc pl-4 space-y-0.5">{ruleNotes.map(n => <li key={n}>{n}</li>)}</ul>
        </div>
      )}
      {rules.checklist.length > 0 && (
        <fieldset disabled={!canWrite} className="rounded-xl border border-slate-200 px-4 py-3">
          <legend className="px-1 text-xs font-bold text-slate-700 flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5" aria-hidden="true" /> 사무소 확인 목록</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {rules.checklist.map(item => (
              <label key={item} className="flex items-start gap-2 text-xs text-slate-700 min-h-[32px]">
                <input type="checkbox" className="w-4 h-4 mt-0.5" checked={checked.includes(item)} onChange={e => setChecked(p => e.target.checked ? [...p, item] : p.filter(x => x !== item))} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="block text-xs font-semibold text-slate-700">검토 메모 (사무소 안에서만)
        <textarea rows={2} maxLength={2000} disabled={!canWrite} value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {onUseInProposal && missing.length === 0 && (
          <button type="button" onClick={() => onUseInProposal({ monthlyPayment: result.monthlyPayment, months: result.months, totalRepayment: result.totalRepayment })} className="min-h-[44px] px-4 rounded-xl border border-[#1E3A5F]/40 text-sm font-bold text-[#1E3A5F] whitespace-nowrap active:scale-[0.98]">제안서 초안에 쓰기</button>
        )}
        {canWrite && officeId && (
          <button type="button" disabled={busy || missing.length > 0} onClick={() => void save()} className="min-h-[44px] px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">
            {savedAt ? <History className="w-4 h-4 inline mr-1" aria-hidden="true" /> : <Save className="w-4 h-4 inline mr-1" aria-hidden="true" />}{busy ? '저장 중…' : savedAt ? '새로 기록하기' : '검토 기록 남기기'}
          </button>
        )}
      </div>
    </section>
  );
}
