// ============================================================
// '내 사건' — 직접 등록한 사건 카드 (MY-8 회생동행 흡수)
// - 다른 사무소에 맡긴 사건·직접 진행하는 사건도 사무소 사건과 같은 카드 모양·탭으로 본다
// - 대화·수임료 탭은 없다(마이김변 사무소 사건이 아님). 비용 = 법원 변제금 납부 기록
// - 기록은 내 계정에만 저장된다(client_companion_records, 본인만 읽기). 사무소에는 보이지 않는다
// ============================================================
import { useState } from 'react';
import type { MyCompanionCaseEntry } from '../../../services/companionService';
import RehabCompanionView, { type CompanionCaseSection } from '../companion/RehabCompanionView';

const SOURCE_LABEL = {
  self_litigant: '직접 진행',
  external_office: '다른 사무소',
  mykim_lawyer: '마이김변 변호사',
} as const;

const REHAB_STAGE_LABEL: Record<string, string> = {
  preparing: '신청 준비',
  submitted: '접수·서류 검토',
  correction: '보정 진행',
  started: '개시결정',
  approved: '변제계획 인가',
  completed: '변제 완료',
};

export default function MyCompanionCaseCard({ entry, userAlias }: { entry: MyCompanionCaseEntry; userAlias?: string }) {
  const isRehab = entry.kind === 'rehab';
  const tabs: Array<[CompanionCaseSection, string]> = isRehab
    ? [['todo', '할 일'], ['progress', '진행'], ['payments', '변제금'], ['help', '도움말']]
    : [['progress', '진행'], ['help', '도움말']];
  const [tab, setTab] = useState<CompanionCaseSection>(tabs[0][0]);
  const d = entry.data;
  const office = d.sourceType === 'external_office' && d.externalOfficeName ? d.externalOfficeName : SOURCE_LABEL[d.sourceType] || '직접 등록';

  let stageText = '';
  if (entry.kind === 'rehab') {
    stageText = REHAB_STAGE_LABEL[entry.data.caseStage || ''] || '진행 기록';
  } else {
    const now = entry.data.timelines.find(t => t.status === 'in_progress');
    stageText = now?.stageName || (entry.data.timelines.every(t => t.status === 'completed') && entry.data.timelines.length ? '면책 결정' : '진행 기록');
  }

  return (
    <li className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{office}</span>
        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{isRehab ? '개인회생' : '개인파산·면책'}</span>
        <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">내가 등록</span>
        {(d.courtName || d.caseNumberMasked) && (
          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{d.courtName} {d.caseNumberMasked}</span>
        )}
      </div>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{stageText}</p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="사건 화면">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`min-h-[40px] px-3.5 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] ${tab === k ? 'bg-brand text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-3">
        <RehabCompanionView
          key={tab}
          embedded
          userAlias={userAlias}
          clientId={entry.scope || undefined}
          caseKind={entry.kind}
          section={tab}
          onOpenHelp={() => setTab('help')}
        />
      </div>
    </li>
  );
}
