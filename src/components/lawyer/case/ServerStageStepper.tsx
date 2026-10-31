// 서버 사건 단계표 (CM-2) — 5단계 '법원 진행'의 절차 타임라인
// 단계 이름·순서는 서버 case_stage_definitions 하나만 쓴다 (이전: 화면마다 따로 둔 13단계 표).
// 현재 단계는 서버 사건 기록(cases.stage). 기록이 바뀌면 사건 기록 패널에서 '기록'으로 움직인다.
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import {
  CLOSE_REASON_LABELS, findCaseByWorkspaceKey, loadStageDefinitions, OFFICE_CASES_CHANGED_EVENT,
  type CaseRecord, type StageDefinition,
} from '../../../services/cases/caseCoreService';

export default function ServerStageStepper({ officeId, caseKey }: { officeId: string; caseKey: string }) {
  const [defs, setDefs] = useState<StageDefinition[] | null>(null);
  const [rec, setRec] = useState<CaseRecord | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      const [d, c] = await Promise.all([loadStageDefinitions(), findCaseByWorkspaceKey(officeId, caseKey)]);
      if (stop) return;
      if (d.ok === false) { setError(d.message); return; }
      if (c.ok === false) { setError(c.message); return; }
      setError(null);
      setDefs(d.data);
      setRec(c.data);
    };
    void load();
    const onChange = () => void load();
    window.addEventListener(OFFICE_CASES_CHANGED_EVENT, onChange);
    return () => { stop = true; window.removeEventListener(OFFICE_CASES_CHANGED_EVENT, onChange); };
  }, [officeId, caseKey]);

  if (error) return <p role="alert" className="text-sm text-rose-700">단계표를 불러오지 못했어요. {error}</p>;
  if (!defs || rec === undefined) return <div aria-busy="true" className="h-16 rounded-xl bg-slate-100 animate-pulse" />;
  if (!rec) return <p className="text-sm text-slate-600">아직 서버 사건 기록이 없어요. 사건 화면 위 '사건 기록 시작'을 누르면 단계가 보여요.</p>;

  const list = defs.filter(d => d.caseType === rec.caseType).sort((a, b) => a.sortOrder - b.sortOrder);
  const cur = list.find(d => d.code === rec.stage);
  const curOrder = cur?.sortOrder ?? -1;
  return (
    <div className="space-y-2">
      {rec.closeReason && (
        <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
          종결: {CLOSE_REASON_LABELS[rec.closeReason]}{rec.closedOn ? ` (${rec.closedOn})` : ''}
        </p>
      )}
      <ol className="flex flex-wrap gap-2" aria-label="사건 단계">
        {list.map(d => {
          const done = curOrder >= 0 && d.sortOrder < curOrder;
          const now = d.code === rec.stage;
          return (
            <li key={d.code} aria-current={now ? 'step' : undefined}
              className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-xl border text-xs font-semibold ${now ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : done ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'}`}>
              {now ? <CircleDot className="w-3.5 h-3.5" aria-hidden="true" /> : done ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Circle className="w-3.5 h-3.5" aria-hidden="true" />}
              {d.officeLabel}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
