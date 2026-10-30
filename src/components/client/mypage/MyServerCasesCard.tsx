// ============================================================
// 의뢰인 '내 사건' — 서버 사건(공개 항목만, CM-11)
// - my_cases RPC: 내 계정에 연결된 사건의 단계 이름·주요 날짜만 돌려준다(실명·담당 직원·메모 없음)
// - 사무소가 보낸 연결 링크(?caseLink=)를 로그인 후 한 번 수락한다
// - 판단·가능성 표현 없이 진행 사실만 보여 준다(제109조)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Briefcase, RefreshCw } from 'lucide-react';
import { loadMyCases, type MyCaseSummary } from '../../../services/cases/caseCoreService';
import { MY_CASES_CHANGED_EVENT } from '../../../services/cases/pendingCaseLink';
import MyCaseFeeSection from './MyCaseFeeSection';
import MyCaseDocsSection from './MyCaseDocsSection';
import MyCorrectionTodo from './MyCorrectionTodo';
import MyDebtCertProgress from './MyDebtCertProgress';
import MyPlanPaymentsSection from './MyPlanPaymentsSection';
import MyCaseFormsSection from './MyCaseFormsSection';

const CASE_TYPE_LABEL = { rehab: '개인회생', bankruptcy: '개인파산·면책' } as const;
const GROUP_LABELS = ['상담', '계약', '서류 준비', '신청·접수', '법원 심사', '변제·면책'];

export default function MyServerCasesCard({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cases, setCases] = useState<MyCaseSummary[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    const res = await loadMyCases();
    if (!res.ok) { setError(res.message); setState('error'); return; }
    setCases(res.data);
    setState('ready');
  }, []);

  // 연결 링크 수락은 PendingCaseLinkBanner가 한다 (로그인 전후 모두). 여기서는 목록만 다시 읽는다
  useEffect(() => {
    if (!isLoggedIn) return;
    void load();
    const onChange = () => { void load(); };
    window.addEventListener(MY_CASES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MY_CASES_CHANGED_EVENT, onChange);
  }, [isLoggedIn, load]);

  if (!isLoggedIn) return null;

  if (state === 'loading') {
    return (
      <section aria-busy="true" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="h-5 w-28 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-14 w-full rounded-xl bg-slate-50 animate-pulse" />
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
        <div className="flex-1 text-sm text-rose-800">
          <p className="font-bold">사건 진행 정보를 불러오지 못했어요.</p>
          <p className="mt-1">{error}</p>
        </div>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-3 rounded-xl border border-rose-300 bg-white text-sm font-bold text-rose-700 whitespace-nowrap active:scale-[0.98]">
          <RefreshCw className="w-4 h-4 inline mr-1" aria-hidden="true" />다시 시도
        </button>
      </section>
    );
  }

  // 사무소가 아직 사건 기록을 시작하지 않았으면 이 카드는 숨긴다(아래 기존 진행 화면이 보임)
  if (cases.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
        <Briefcase className="w-5 h-5 text-brand" aria-hidden="true" />사무소가 기록한 진행 상황
      </h2>
      <ul className="space-y-3">
        {cases.map(c => (
          <li key={c.caseId} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900">{c.officeName || '담당 사무소'}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{CASE_TYPE_LABEL[c.caseType]}</span>
              {c.caseNumber && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{c.courtName} {c.caseNumber}</span>}
            </div>
            <p className="mt-2 text-lg font-extrabold text-slate-900">{c.clientStageLabel}</p>
            <ol className="mt-3 grid grid-cols-6 gap-1" aria-label="절차 단계">
              {GROUP_LABELS.map((label, i) => {
                const n = i + 1;
                const done = n < c.groupNo || c.stage === 'closed';
                const now = n === c.groupNo && c.stage !== 'closed';
                return (
                  <li key={label} className="text-center">
                    <span className={`block h-1.5 rounded-full ${done ? 'bg-brand' : now ? 'bg-brand/60' : 'bg-slate-200'}`} />
                    <span className={`mt-1 block text-[11px] leading-tight ${now ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{label}</span>
                  </li>
                );
              })}
            </ol>
            <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {c.filedOn && <div><dt className="inline">접수 </dt><dd className="inline font-semibold text-slate-800">{c.filedOn}</dd></div>}
              {c.commencedOn && <div><dt className="inline">{c.caseType === 'bankruptcy' ? '파산선고 ' : '개시결정 '}</dt><dd className="inline font-semibold text-slate-800">{c.commencedOn}</dd></div>}
              {c.creditorsMeetingOn && <div><dt className="inline">채권자집회 </dt><dd className="inline font-semibold text-slate-800">{c.creditorsMeetingOn}</dd></div>}
              {c.confirmedOn && <div><dt className="inline">인가결정 </dt><dd className="inline font-semibold text-slate-800">{c.confirmedOn}</dd></div>}
              {c.dischargeDecidedOn && <div><dt className="inline">면책 결정 </dt><dd className="inline font-semibold text-slate-800">{c.dischargeDecidedOn}</dd></div>}
            </dl>
            {c.stage === 'closed' && <p className="mt-2 text-xs text-slate-600">사건이 끝났어요. 궁금한 점은 담당 사무소에 문의해 주세요.</p>}
            {/* 법원 보정 할 일 (CR-5): 진행 중 회차가 있으면 맨 위에 */}
            {c.stage !== 'closed' && <MyCorrectionTodo caseKey={c.workspaceKey} />}
            {/* 사무소가 작성을 요청한 서식 (H-14) */}
            {c.stage !== 'closed' && <MyCaseFormsSection caseKey={c.workspaceKey} />}
            {/* 부채증명서 진행 (DC-10): 받은 곳 수와 발급 중 주의사항 */}
            {c.stage !== 'closed' && <MyDebtCertProgress caseKey={c.workspaceKey} />}
            {/* 법원 변제금 회차 (CM-8): 개시결정 뒤 사무소가 회차표를 만들면 보인다 */}
            {c.stage !== 'closed' && c.caseType === 'rehab' && c.groupNo >= 5 && <MyPlanPaymentsSection caseId={c.caseId} />}
            <MyCaseFeeSection caseId={c.caseId} />
            {/* 상담 요청에서 시작한 사건은 아래 '필수 서류 제출' 카드에서 받는다 */}
            {!c.hasConsultRequest && c.stage !== 'closed' && <MyCaseDocsSection caseKey={c.workspaceKey} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
