import { useMemo, useState } from 'react';
import { Modal, Button, Callout, inputClass } from '../ui';
import { DEBT_PROGRAMS, DEBT_PROGRAM_ORDER } from '../debtPrograms';

/** 정리 확인 화면에서 더 받는 사실 (I-3 일부) — 판정·결과 표시 없음 */
export interface IntakeExtraFacts {
  prevHistory: 'none' | 'rehab' | 'bankruptcy' | 'credit_recovery' | 'direct_adjust' | 'unknown';
  prevHistoryYear: string;
  prevHistoryResult: 'discharged' | 'dismissed' | 'in_progress' | 'unknown' | '';
  creditorCountBand: '' | '1-3' | '4-6' | '7-10' | '11+' | 'unknown';
  overdueSince: '' | 'none' | 'under3m' | '3to6m' | '6to12m' | 'over1y' | 'unknown';
  arrears: Array<'tax' | 'health' | 'pension'>;
  seizure: Array<'salary' | 'account' | 'property' | 'car'>;
  /** 출생연도 (나이는 여기서 계산, 3년 미만 단축 사유 확인용) */
  birthYear?: string;
  tenure?: '' | 'under1y' | '1to3y' | 'over3y' | 'unknown';
  socialInsurance?: '' | 'yes' | 'no' | 'unknown';
  incomeDrop?: '' | 'no' | 'yes' | 'unknown';
  /** 단축 사유 관련 사실 (판정 없음, 여러 개) */
  shortFacts?: Array<'severe_disability' | 'single_parent' | 'rent_fraud_decision' | 'low_wage_2y' | 'no_private_creditor'>;
  /** 희망 상담 방식·시간대 (NF-Q4, 예약 아님 — 변호사가 맞춰 연락) */
  consultMethod?: '' | 'chat' | 'phone' | 'visit' | 'video' | 'any';
  consultTimes?: Array<'weekday_day' | 'weekday_evening' | 'weekend'>;
}

export const EMPTY_EXTRA: IntakeExtraFacts = { prevHistory: 'none', prevHistoryYear: '', prevHistoryResult: '', creditorCountBand: '', overdueSince: '', arrears: [], seizure: [], birthYear: '', tenure: '', socialInsurance: '', incomeDrop: '', shortFacts: [], consultMethod: '', consultTimes: [] };

const man = (v?: number) => (v ? `${Math.round(v).toLocaleString('ko-KR')}만 원` : '');

/**
 * '정리 확인' 화면 (I-2) — 답한 내용을 묶음별로 보여 주고, '확인 필요' 목록과 몇 가지 사실을 더 받는다.
 * 어떤 제도가 맞는지·얼마를 갚는지는 보여 주지 않는다 (제109조).
 */
export default function IntakeReviewModal({
  open, profile, onClose, onRestart, onConfirm, onLearn,
}: {
  open: boolean;
  /** 상담 요청에 들어갈 financialProfile (만 원 단위) */
  profile: any;
  onClose: () => void;
  onRestart: () => void;
  onConfirm: (extra: IntakeExtraFacts) => void;
  onLearn: () => void;
}) {
  const [x, setX] = useState<IntakeExtraFacts>(EMPTY_EXTRA);
  const fp = profile || {};
  const groups = useMemo(() => [
    { title: '가족', rows: [
      ['가구원 수', fp.dependents != null ? `${Number(fp.dependents) + 1}인` : ''],
      ['미성년 자녀', fp.minorChildren != null ? `${fp.minorChildren}명` : ''],
      ['혼인 상태', fp.maritalStatus === 'MARRIED' ? '기혼' : fp.maritalStatus === 'SINGLE' ? '미혼' : fp.maritalStatus ? '이혼·사별' : ''],
    ] },
    { title: '소득·일', rows: [
      ['일하는 형태', ({ SALARIED: '급여 소득자', BUSINESS: '자영업', DAILY: '일용직', FREELANCER: '프리랜서', UNEMPLOYED: '지금 소득 없음' } as any)[fp.jobType] || ''],
      ['월 실수령액', man(fp.income)],
      ['배우자 월 소득', fp.maritalStatus === 'MARRIED' ? (fp.spouseIncome ? man(fp.spouseIncome) : '0원 또는 모름') : '해당 없음'],
    ] },
    { title: '사는 곳·재산', rows: [
      ['주거 형태', ({ rent: '월세', jeonse: '전세', owned: '자가', free: '무상 거주' } as any)[fp.housingType] || ''],
      ['보증금', man(fp.rentalDeposit) || (fp.housingType === 'rent' || fp.housingType === 'jeonse' ? '' : '해당 없음')],
      ['월세', man(fp.rentCost) || (fp.housingType === 'rent' ? '' : '해당 없음')],
      ['입력한 재산 합계', man(fp.assetsTotal) || '0원'],
      ['퇴직금', fp.retirementPensionType === 'unknown' ? '' : (man(fp.retirementPay) || '없음')],
    ] },
    { title: '채무', rows: [
      ['총 채무', man(fp.debtTotal)],
      ['세금·4대보험 체납', man(fp.priorityDebt) || '없음'],
      ['투자·도박 손실', man(fp.speculativeLoss || fp.gamblingLoss) || '없음'],
    ] },
  ], [fp]);
  const needCheck = groups.flatMap(g => g.rows.filter(r => !r[1]).map(r => `${g.title} · ${r[0]}`));

  const toggle = (k: 'arrears' | 'seizure' | 'shortFacts' | 'consultTimes', v: string) =>
    setX(p => { const cur = ((p as any)[k] || []) as string[]; return { ...p, [k]: cur.includes(v) ? cur.filter(a => a !== v) : [...cur, v] }; });
  const thisYear = new Date().getFullYear();
  const birthBad = !!x.birthYear && (x.birthYear.length !== 4 || Number(x.birthYear) < thisYear - 100 || Number(x.birthYear) > thisYear - 18);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="정리한 내용을 확인해 주세요"
      description="어떤 제도가 맞는지, 얼마를 갚게 되는지는 변호사가 서류를 보고 판단해요."
      size="lg"
      mobile="fullscreen"
      footer={
        <div className="flex w-full flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onRestart}>처음부터 다시 정리</Button>
            <Button variant="ghost" onClick={onLearn}>제도 알아보기</Button>
          </div>
          <Button onClick={() => onConfirm(birthBad ? { ...x, birthYear: '' } : x)}>이대로 변호사 찾기</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groups.map(g => (
            <section key={g.title} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">{g.title}</h3>
              <dl className="space-y-1 text-sm">
                {g.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-slate-600">{k}</dt>
                    <dd className={v ? 'font-bold text-slate-900 text-right' : 'font-bold text-amber-700'}>{v || '확인 필요'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        {needCheck.length > 0 && (
          <Callout tone="warning" title="확인 필요">
            답하지 않았거나 '모름'인 항목이에요. 상담하는 변호사가 다시 물어볼 수 있어요: {needCheck.join(', ')}
          </Callout>
        )}

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">몇 가지만 더 알려 주세요 <span className="font-medium text-slate-500">(모르면 비워 두세요)</span></h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="font-bold text-slate-700">예전에 회생·파산·신용회복을 한 적</span>
              <select className={inputClass} value={x.prevHistory} onChange={e => setX(p => ({ ...p, prevHistory: e.target.value as any }))}>
                <option value="none">없어요</option><option value="rehab">개인회생</option><option value="bankruptcy">개인파산</option>
                <option value="credit_recovery">신용회복위원회 채무조정</option><option value="direct_adjust">금융회사에 직접 채무조정 요청</option><option value="unknown">모르겠어요</option>
              </select>
            </label>
            {x.prevHistory !== 'none' && x.prevHistory !== 'unknown' && (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1"><span className="font-bold text-slate-700">연도</span>
                  <input className={inputClass} inputMode="numeric" value={x.prevHistoryYear} onChange={e => setX(p => ({ ...p, prevHistoryYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="예: 2019" />
                </label>
                <label className="space-y-1"><span className="font-bold text-slate-700">결과</span>
                  <select className={inputClass} value={x.prevHistoryResult} onChange={e => setX(p => ({ ...p, prevHistoryResult: e.target.value as any }))}>
                    <option value="">선택</option><option value="discharged">면책·완료</option><option value="dismissed">기각·폐지·중단</option>
                    <option value="in_progress">아직 진행 중</option><option value="unknown">모르겠어요</option>
                  </select>
                </label>
              </div>
            )}
            <label className="space-y-1">
              <span className="font-bold text-slate-700">빚진 곳(채권자) 수</span>
              <select className={inputClass} value={x.creditorCountBand} onChange={e => setX(p => ({ ...p, creditorCountBand: e.target.value as any }))}>
                <option value="">선택</option><option value="1-3">1~3곳</option><option value="4-6">4~6곳</option><option value="7-10">7~10곳</option><option value="11+">11곳 이상</option><option value="unknown">모르겠어요</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-700">연체가 시작된 때</span>
              <select className={inputClass} value={x.overdueSince} onChange={e => setX(p => ({ ...p, overdueSince: e.target.value as any }))}>
                <option value="">선택</option><option value="none">아직 연체 없음</option><option value="under3m">3개월 안</option><option value="3to6m">3~6개월</option>
                <option value="6to12m">6개월~1년</option><option value="over1y">1년 넘음</option><option value="unknown">모르겠어요</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="font-bold text-slate-700">출생연도</span>
              <input className={inputClass} inputMode="numeric" value={x.birthYear || ''} onChange={e => setX(p => ({ ...p, birthYear: e.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="예: 1985" aria-invalid={birthBad || undefined} />
              {birthBad && <span className="block text-xs font-bold text-red-600">출생연도 네 자리를 다시 확인해 주세요.</span>}
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-700">지금 일한 기간</span>
              <select className={inputClass} value={x.tenure || ''} onChange={e => setX(p => ({ ...p, tenure: e.target.value as any }))}>
                <option value="">선택</option><option value="under1y">1년 안</option><option value="1to3y">1~3년</option><option value="over3y">3년 넘음</option><option value="unknown">모르겠어요</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-700">4대보험 가입</span>
              <select className={inputClass} value={x.socialInsurance || ''} onChange={e => setX(p => ({ ...p, socialInsurance: e.target.value as any }))}>
                <option value="">선택</option><option value="yes">가입돼 있어요</option><option value="no">안 돼 있어요</option><option value="unknown">모르겠어요</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-700">원하는 상담 방식</span>
              <select className={inputClass} value={x.consultMethod || ''} onChange={e => setX(p => ({ ...p, consultMethod: e.target.value as any }))}>
                <option value="">선택</option><option value="chat">채팅</option><option value="phone">전화</option><option value="visit">사무소 방문</option><option value="video">화상</option><option value="any">상관없어요</option>
              </select>
            </label>
            <fieldset className="space-y-1">
              <legend className="font-bold text-slate-700">연락받기 편한 때 (여러 개)</legend>
              <div className="flex flex-wrap gap-2">
                {([['weekday_day', '평일 낮'], ['weekday_evening', '평일 저녁'], ['weekend', '주말']] as const).map(([v, l]) => (
                  <label key={v} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm"><input type="checkbox" checked={(x.consultTimes || []).includes(v)} onChange={() => toggle('consultTimes', v)} />{l}</label>
                ))}
              </div>
            </fieldset>
            <label className="space-y-1">
              <span className="font-bold text-slate-700">최근 1년 안에 소득이 줄었나요</span>
              <select className={inputClass} value={x.incomeDrop || ''} onChange={e => setX(p => ({ ...p, incomeDrop: e.target.value as any }))}>
                <option value="">선택</option><option value="no">아니요</option><option value="yes">줄었어요</option><option value="unknown">모르겠어요</option>
              </select>
            </label>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-bold text-slate-700">해당하는 것 (여러 개, 없으면 비워 두세요)</legend>
            <div className="flex flex-wrap gap-2">
              {([['severe_disability', '중증 장애'], ['single_parent', '한부모'], ['rent_fraud_decision', '전세사기피해자 결정을 받음'], ['low_wage_2y', '최근 2년 급여가 최저임금 수준'], ['no_private_creditor', '빌린 곳이 모두 금융회사(개인 빚 없음)']] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm"><input type="checkbox" checked={(x.shortFacts || []).includes(v)} onChange={() => toggle('shortFacts', v)} />{l}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-bold text-slate-700">밀린 공과금 (여러 개)</legend>
            <div className="flex flex-wrap gap-2">
              {([['tax', '세금'], ['health', '건강보험료'], ['pension', '국민연금']] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm"><input type="checkbox" checked={x.arrears.includes(v)} onChange={() => toggle('arrears', v)} />{l}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-bold text-slate-700">압류된 것 (여러 개)</legend>
            <div className="flex flex-wrap gap-2">
              {([['salary', '월급'], ['account', '통장'], ['property', '집·부동산'], ['car', '자동차']] as const).map(([v, l]) => (
                <label key={v} className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm"><input type="checkbox" checked={x.seizure.includes(v)} onChange={() => toggle('seizure', v)} />{l}</label>
              ))}
            </div>
          </fieldset>
        </section>
        {/* 다른 제도 일반 안내 (NF-1) — 판단 없이 이름·공식 연락처만, 추천 순서 아님 */}
        <details className="rounded-2xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-900 min-h-10 flex items-center">회생·파산 말고 다른 제도도 있어요</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {DEBT_PROGRAM_ORDER.filter(k => k !== 'rehab' && k !== 'bankruptcy').map(k => {
              const p = DEBT_PROGRAMS[k];
              const link = p.links[0];
              return (
                <li key={k} className="leading-relaxed">
                  <span className="font-bold text-slate-900">{p.title}</span>
                  <span className="text-slate-700"> · {p.summary}</span>
                  {link && (
                    <span className="block text-slate-600">
                      {link.label}{link.phone ? ` ${link.phone}` : ''}
                      {link.url && <> · <a href={link.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">누리집</a></>}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-slate-500">일반 정보이며 추천 순서가 아니에요. 어떤 제도가 맞는지는 상담에서 확인해요.</p>
        </details>
      </div>
    </Modal>
  );
}

/** 상담 요청 본문에 덧붙일 줄 (변호사 화면용 사실 목록) */
export function extraFactsText(x: IntakeExtraFacts): string {
  const L: Record<string, string> = {
    none: '없음', rehab: '개인회생', bankruptcy: '개인파산', credit_recovery: '신용회복위원회 채무조정', direct_adjust: '금융회사 직접 채무조정 요청', unknown: '모름',
    discharged: '면책·완료', dismissed: '기각·폐지·중단', in_progress: '진행 중',
    '1-3': '1~3곳', '4-6': '4~6곳', '7-10': '7~10곳', '11+': '11곳 이상',
    under3m: '3개월 안', '3to6m': '3~6개월', '6to12m': '6개월~1년', over1y: '1년 넘음',
    tax: '세금', health: '건강보험료', pension: '국민연금', salary: '월급', account: '통장', property: '집·부동산', car: '자동차',
    under1y: '1년 안', '1to3y': '1~3년', over3y: '3년 넘음', yes: '예', no: '아니요',
    severe_disability: '중증 장애', single_parent: '한부모', rent_fraud_decision: '전세사기피해자 결정', low_wage_2y: '최근 2년 최저임금 수준 급여', no_private_creditor: '개인 채권자 없음',
    chat: '채팅', phone: '전화', visit: '방문', video: '화상', any: '상관없음',
    weekday_day: '평일 낮', weekday_evening: '평일 저녁', weekend: '주말',
  };
  const lines = [
    `• 과거 회생·파산·채무조정: ${L[x.prevHistory] || '없음'}${x.prevHistory !== 'none' && x.prevHistory !== 'unknown' ? ` (${x.prevHistoryYear || '연도 모름'}, ${L[x.prevHistoryResult] || '결과 모름'})` : ''}`,
    `• 채권자 수: ${L[x.creditorCountBand] || '답 없음'}`,
    `• 연체 시작: ${x.overdueSince === 'none' ? '연체 없음' : L[x.overdueSince] || '답 없음'}`,
    `• 밀린 공과금: ${x.arrears.length ? x.arrears.map(a => L[a]).join(', ') : '없음 또는 답 없음'}`,
    `• 압류: ${x.seizure.length ? x.seizure.map(a => L[a]).join(', ') : '없음 또는 답 없음'}`,
    `• 출생연도: ${x.birthYear || '답 없음'} · 일한 기간: ${L[x.tenure || ''] || '답 없음'} · 4대보험: ${L[x.socialInsurance || ''] || '답 없음'} · 최근 소득 감소: ${L[x.incomeDrop || ''] || '답 없음'}`,
    `• 해당 사실(판정 아님): ${(x.shortFacts || []).length ? (x.shortFacts || []).map(a => L[a]).join(', ') : '없음 또는 답 없음'}`,
    `• 원하는 상담 방식: ${L[x.consultMethod || ''] || '답 없음'} · 편한 때: ${(x.consultTimes || []).length ? (x.consultTimes || []).map(a => L[a]).join(', ') : '답 없음'}`,
  ];
  return `\n[5. 정리 확인 화면에서 더 답한 내용]\n${lines.join('\n')}`;
}
