// ============================================================
// 의뢰인 '내 사건' — 서버 사건(공개 항목만, CM-11)
// - my_cases RPC: 내 계정에 연결된 사건의 단계 이름·주요 날짜만 돌려준다(실명·담당 직원·메모 없음)
// - 사무소가 보낸 연결 링크(?caseLink=)를 로그인 후 한 번 수락한다
// - 판단·가능성 표현 없이 진행 사실만 보여 준다(제109조)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Briefcase, FolderPlus, MessageSquare, Plus, RefreshCw } from 'lucide-react';

/** '내 사건' 카드에서 그 사건의 상담방 열기 (ClientRole이 받아 상담 탭으로 옮긴다) */
export const OPEN_CONSULT_CHAT_EVENT = 'mykim:open-consult-chat';
import { loadMyCases, type MyCaseSummary } from '../../../services/cases/caseCoreService';
import { MY_CASES_CHANGED_EVENT } from '../../../services/cases/pendingCaseLink';
import MyCaseFeeSection from './MyCaseFeeSection';
import MyCaseDocsSection from './MyCaseDocsSection';
import MyCorrectionTodo from './MyCorrectionTodo';
import MyDebtCertProgress from './MyDebtCertProgress';
import MyPlanPaymentsSection from './MyPlanPaymentsSection';
import MyCaseFormsSection from './MyCaseFormsSection';
import MyBankruptcySchedule from './MyBankruptcySchedule';
import MyCompanionCaseCard from './MyCompanionCaseCard';
import CaseRegistrationModal from '../companion/CaseRegistrationModal';
import { listMyCompanionCases, type MyCompanionCaseEntry } from '../../../services/companionService';

const CASE_TYPE_LABEL = { rehab: '개인회생', bankruptcy: '개인파산·면책' } as const;
const GROUP_LABELS = ['상담', '계약', '서류 준비', '신청·접수', '법원 심사', '변제·면책'];

interface MyServerCasesCardProps {
  isLoggedIn: boolean;
  /** 직접 등록하는 사건을 저장할 키 (지금 상담 요청 ID, 없으면 '') */
  registerScopeId?: string;
  userAlias?: string;
}

/**
 * 직접 등록한 사건 목록 — 사무소가 같은 상담 요청으로 사건 기록을 시작했고 출처가 '마이김변 변호사'면 뺀다
 * (그 사건은 사무소 기록이 원본이고, 변제금 납부는 사무소 '변제 수행 장부'로 확인한다)
 */
function visibleCompanionCases(cases: MyCaseSummary[]): MyCompanionCaseEntry[] {
  const serverKeys = new Set(cases.map(c => c.workspaceKey));
  return listMyCompanionCases().filter(e => !(e.data.sourceType === 'mykim_lawyer' && e.scope && serverKeys.has(e.scope)));
}

export default function MyServerCasesCard({ isLoggedIn, registerScopeId, userAlias }: MyServerCasesCardProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cases, setCases] = useState<MyCaseSummary[]>([]);
  const [error, setError] = useState('');
  const [companionCases, setCompanionCases] = useState<MyCompanionCaseEntry[]>([]);
  const [registerOpen, setRegisterOpen] = useState(false);

  // 회생동행 기록은 로그인 때 서버에서 한 번 읽어 메모리에 둔다 → 바뀌면 다시 센다
  useEffect(() => {
    if (!isLoggedIn) return;
    const refresh = () => setCompanionCases(visibleCompanionCases(cases));
    refresh();
    window.addEventListener('mykim:companion-changed', refresh);
    return () => window.removeEventListener('mykim:companion-changed', refresh);
  }, [isLoggedIn, cases]);

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

  const registerModal = (
    <CaseRegistrationModal
      isOpen={registerOpen}
      onClose={() => setRegisterOpen(false)}
      onSuccess={() => setCompanionCases(visibleCompanionCases(cases))}
      initialAlias={userAlias}
      clientId={registerScopeId || undefined}
    />
  );

  const registerButton = (
    <button
      type="button"
      onClick={() => setRegisterOpen(true)}
      className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap active:scale-[0.98]"
    >
      <Plus className="w-4 h-4" aria-hidden="true" />
      사건 직접 등록
    </button>
  );

  // 사무소 사건도, 직접 등록한 사건도 없으면 등록 안내만 (아래 기존 진행 화면은 그대로 보임)
  if (cases.length === 0 && companionCases.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">다른 사무소에 맡겼거나 직접 진행 중인 사건이 있나요?</p>
          <p className="mt-1 text-sm text-slate-600 break-keep">사건번호와 변제 조건을 등록하면 납부 일정·절차 진행을 여기서 함께 관리할 수 있어요. 기록은 내 계정에만 저장돼요.</p>
        </div>
        {registerButton}
        {registerModal}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      {cases.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <Briefcase className="w-5 h-5 text-brand" aria-hidden="true" />사무소가 기록한 진행 상황
          </h2>
          <ul className="space-y-3">
            {cases.map(c => <CaseCard key={c.caseId} c={c} />)}
          </ul>
        </>
      )}
      {companionCases.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <FolderPlus className="w-5 h-5 text-brand" aria-hidden="true" />직접 등록한 사건
          </h2>
          <p className="text-xs text-slate-600">다른 사무소에 맡긴 사건이나 직접 진행하는 사건이에요. 기록은 내 계정에만 저장되고 사무소에는 보이지 않아요.</p>
          <ul className="space-y-3">
            {companionCases.map(e => <MyCompanionCaseCard key={`${e.kind}|${e.scope}`} entry={e} userAlias={userAlias} />)}
          </ul>
        </>
      )}
      <div>{registerButton}</div>
      {registerModal}
    </section>
  );
}

type CaseTab = 'todo' | 'progress' | 'cost' | 'chat';

/** 사건 하나 = 탭 4개 (MY-5·MY-6·MY-7): 할 일(기본) · 진행 · 비용 · 대화 */
function CaseCard({ c }: { c: MyCaseSummary }) {
  const closed = c.stage === 'closed';
  const [tab, setTab] = useState<CaseTab>(closed ? 'progress' : 'todo');
  const tabs: Array<[CaseTab, string]> = [['todo', '할 일'], ['progress', '진행'], ['cost', '비용'], ['chat', '대화']];
  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{c.officeName || '담당 사무소'}</span>
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{CASE_TYPE_LABEL[c.caseType]}</span>
        {c.caseNumber && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{c.courtName} {c.caseNumber}</span>}
      </div>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{c.clientStageLabel}</p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="사건 화면">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-[40px] px-3.5 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] ${tab === k ? 'bg-brand text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'todo' && (
        <div className="mt-3 space-y-3">
          {closed && <p className="text-sm text-slate-600">사건이 끝나 할 일이 없어요.</p>}
          {/* 법원 보정 할 일 (CR-5) · 사무소가 요청한 서식 (H-14) · 서류 요청 */}
          {!closed && <MyCorrectionTodo caseKey={c.workspaceKey} />}
          {!closed && <MyCaseFormsSection caseKey={c.workspaceKey} />}
          {!c.hasConsultRequest && !closed && <MyCaseDocsSection caseKey={c.workspaceKey} />}
          {c.hasConsultRequest && !closed && <p className="text-xs text-slate-500">사무소가 요청한 서류는 아래 '필수 서류 제출'에서도 낼 수 있어요.</p>}
        </div>
      )}

      {tab === 'progress' && (
        <div className="mt-3 space-y-3">
          <ol className="grid grid-cols-6 gap-1" aria-label="절차 단계">
            {GROUP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = n < c.groupNo || closed;
              const now = n === c.groupNo && !closed;
              return (
                <li key={label} className="text-center">
                  <span className={`block h-1.5 rounded-full ${done ? 'bg-brand' : now ? 'bg-brand/60' : 'bg-slate-200'}`} />
                  <span className={`mt-1 block text-[11px] leading-tight ${now ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{label}</span>
                </li>
              );
            })}
          </ol>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {c.filedOn && <div><dt className="inline">접수 </dt><dd className="inline font-semibold text-slate-800">{c.filedOn}</dd></div>}
            {c.commencedOn && <div><dt className="inline">{c.caseType === 'bankruptcy' ? '파산선고 ' : '개시결정 '}</dt><dd className="inline font-semibold text-slate-800">{c.commencedOn}</dd></div>}
            {c.creditorsMeetingOn && <div><dt className="inline">채권자집회 </dt><dd className="inline font-semibold text-slate-800">{c.creditorsMeetingOn}</dd></div>}
            {c.confirmedOn && <div><dt className="inline">인가결정 </dt><dd className="inline font-semibold text-slate-800">{c.confirmedOn}</dd></div>}
            {c.dischargeDecidedOn && <div><dt className="inline">면책 결정 </dt><dd className="inline font-semibold text-slate-800">{c.dischargeDecidedOn}</dd></div>}
          </dl>
          {closed && <p className="text-xs text-slate-600">사건이 끝났어요. 궁금한 점은 담당 사무소에 문의해 주세요.</p>}
          {!closed && <MyDebtCertProgress caseKey={c.workspaceKey} />}
          {c.caseType === 'bankruptcy' && c.groupNo >= 5 && <MyBankruptcySchedule caseId={c.caseId} />}
        </div>
      )}

      {tab === 'cost' && (
        <div className="mt-3 space-y-3">
          <MyCaseFeeSection caseId={c.caseId} />
          {c.caseType === 'rehab' && c.groupNo >= 5 && !closed && <MyPlanPaymentsSection caseId={c.caseId} />}
        </div>
      )}

      {tab === 'chat' && (
        <div className="mt-3 space-y-2">
          {/* 계약 뒤 대화는 같은 상담방에서 이어진다 (MY-Q3) */}
          {c.hasConsultRequest ? (
            <>
              <p className="text-sm text-slate-600">담당 변호사와 나눈 대화가 이어져요. 할 일에 대해 묻고 싶으면 이 대화방을 써 주세요.</p>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CONSULT_CHAT_EVENT, { detail: { requestId: c.workspaceKey } }))}
                className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-2 whitespace-nowrap active:scale-[0.98]"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                담당 변호사와 대화
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-600">이 사건은 사무소가 직접 등록했어요. 대화는 사무소 연락처로 해 주세요.</p>
          )}
        </div>
      )}
    </li>
  );
}
