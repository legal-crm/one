import { AlertTriangle, PencilLine } from 'lucide-react';
import { INTAKE_FIELDS, formatIntakeValue, type ClientIntakeV2 } from '../../../services/intake/clientIntakeV2';
const GOAL_LABEL: Record<string, string> = {
  stop_collection: '독촉·추심 연락 멈추기', lower_payment: '매달 갚는 부담 줄이기', keep_job: '직장·자격 지키기',
  keep_home: '사는 집 지키기', protect_family: '가족에게 알려지지 않기', fresh_start: '빚을 정리하고 새로 시작', compare_options: '맞는 제도를 알고 싶음',
};

const EXTRA_LABEL: Record<string, string> = {
  none: '없음', rehab: '개인회생', bankruptcy: '개인파산', credit_recovery: '신용회복 채무조정', direct_adjust: '금융회사 직접 채무조정 요청', unknown: '모름',
  discharged: '면책·완료', dismissed: '기각·폐지·중단', in_progress: '진행 중',
  '1-3': '1~3곳', '4-6': '4~6곳', '7-10': '7~10곳', '11+': '11곳 이상',
  under3m: '3개월 안', '3to6m': '3~6개월', '6to12m': '6개월~1년', over1y: '1년 넘음',
  tax: '세금', health: '건강보험료', pension: '국민연금', salary: '월급', account: '통장', property: '집·부동산', car: '자동차',
  under1y: '1년 안', '1to3y': '1~3년', over3y: '3년 넘음', yes: '예', no: '아니요',
  severe_disability: '중증 장애', single_parent: '한부모', rent_fraud_decision: '전세사기피해자 결정', low_wage_2y: '최근 2년 최저임금 수준', no_private_creditor: '개인 채권자 없음',
  chat: '채팅', phone: '전화', visit: '방문', video: '화상', any: '상관없음', weekday_day: '평일 낮', weekday_evening: '평일 저녁', weekend: '주말',
};

/**
 * 변호사 화면 '의뢰인 정리 자료' 카드 (I-4) — 의뢰인이 답한 그대로(원 단위). 계산은 '사건 검토'에서.
 * '확인 필요'는 답이 없거나 모름, '바뀜'은 의뢰인이 마지막으로 고친 칸.
 */
export default function ClientIntakeCard({ intake, updatedAt }: { intake?: ClientIntakeV2 | null; updatedAt?: string }) {
  if (!intake || intake.version !== 2) return null;
  const changed = new Set(intake.changedKeys || []);
  const groups = Array.from(new Set(INTAKE_FIELDS.map(f => f.group)));
  const x = intake.extra || {};
  const extraRows: Array<[string, string]> = [
    ['과거 회생·파산·채무조정', x.prevHistory ? `${EXTRA_LABEL[x.prevHistory] || x.prevHistory}${x.prevHistoryYear ? ` (${x.prevHistoryYear})` : ''}${x.prevHistoryResult ? ` · ${EXTRA_LABEL[x.prevHistoryResult] || ''}` : ''}` : ''],
    ['채권자 수', x.creditorCountBand ? EXTRA_LABEL[x.creditorCountBand] || x.creditorCountBand : ''],
    ['연체 시작', x.overdueSince ? (x.overdueSince === 'none' ? '연체 없음' : EXTRA_LABEL[x.overdueSince] || x.overdueSince) : ''],
    ['밀린 공과금', x.arrears?.length ? x.arrears.map(a => EXTRA_LABEL[a] || a).join(', ') : ''],
    ['압류', x.seizure?.length ? x.seizure.map(a => EXTRA_LABEL[a] || a).join(', ') : ''],
    ['출생연도', x.birthYear || ''],
    ['일한 기간 · 4대보험', [EXTRA_LABEL[x.tenure || ''], x.socialInsurance ? `4대보험 ${EXTRA_LABEL[x.socialInsurance] || ''}` : ''].filter(Boolean).join(' · ')],
    ['최근 소득 감소', EXTRA_LABEL[x.incomeDrop || ''] || ''],
    ['해당 사실 (판정 아님)', x.shortFacts?.length ? x.shortFacts.map(a => EXTRA_LABEL[a] || a).join(', ') : ''],
    ['해결하고 싶은 것', (x.goals || []).map(g => GOAL_LABEL[g] || g).join(', ')],
    ['원하는 상담 방식 · 편한 때', [EXTRA_LABEL[x.consultMethod || ''], (x.consultTimes || []).map(a => EXTRA_LABEL[a] || a).join(', ')].filter(Boolean).join(' · ')],
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" aria-label="의뢰인 정리 자료">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">의뢰인 정리 자료 <span className="text-xs font-medium text-slate-500">(답한 그대로 · 원 단위)</span></h3>
        {updatedAt && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5">
            <PencilLine className="w-3 h-3" aria-hidden="true" /> {new Date(updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 의뢰인이 고침
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {groups.map(g => (
          <div key={g} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-600 mb-1">{g}</p>
            <dl className="space-y-0.5 text-xs">
              {INTAKE_FIELDS.filter(f => f.group === g).map(f => {
                const v = formatIntakeValue(f, intake.answers[f.key]);
                if (!v && !intake.needCheck.includes(f.label)) return null;
                return (
                  <div key={f.key} className="flex justify-between gap-2">
                    <dt className="text-slate-600">{f.label}</dt>
                    <dd className="text-right font-bold text-slate-900">
                      {v || <span className="text-amber-700">확인 필요</span>}
                      {changed.has(f.key) && <span className="ml-1 rounded bg-amber-100 px-1 text-[11px] text-amber-800">바뀜</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-600 mb-1">정리 확인에서 더 답한 내용{changed.has('extra') && <span className="ml-1 rounded bg-amber-100 px-1 text-[11px] text-amber-800">바뀜</span>}</p>
          <dl className="space-y-0.5 text-xs">
            {extraRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2"><dt className="text-slate-600">{k}</dt><dd className="text-right font-bold text-slate-900">{v || <span className="text-slate-500">답 없음</span>}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      {intake.needCheck.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-900"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />확인 필요: {intake.needCheck.join(', ')}</p>
      )}
    </section>
  );
}
