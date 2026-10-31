// 통합어드민 › 콘텐츠: 게시 상태 (CT-3 일부)
// 초안은 공개 화면에 보이지 않는다. 검토 뒤 '게시'를 눌러야 보인다. 예시(가상) 글은 한 번에 내릴 수 있다.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useDialog } from '../../common/DialogProvider';
import {
  CONTENT_STATUS_LABEL, fetchContentStatuses, setContentStatus,
  type ContentStatus, type ContentTable,
} from '../../../services/cms/contentService';

type StatusMap = Record<string, { status: ContentStatus; isExample: boolean }>;

export function useContentStatuses(table: ContentTable, refreshKey: unknown) {
  const [map, setMap] = useState<StatusMap | null>(null);
  const reload = useCallback(async () => {
    const r = await fetchContentStatuses(table);
    if (r.ok) setMap(r.data);
  }, [table]);
  useEffect(() => { void reload(); }, [reload, refreshKey]);
  return { map, reload };
}

const TONE: Record<ContentStatus, string> = {
  draft: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  published: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  hidden: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

export function ContentStatusCell({ table, id, map, onChanged }: { table: ContentTable; id: string; map: StatusMap | null; onChanged: () => void }) {
  const cur = map?.[id]?.status;
  if (!cur) return <span className="text-xs text-slate-500">—</span>;
  return (
    <select
      aria-label="게시 상태"
      value={cur}
      onChange={async e => {
        const next = e.target.value as ContentStatus;
        const r = await setContentStatus(table, [id], next);
        if (r.ok === false) { toast.error(r.message); return; }
        toast.success(next === 'published' ? '게시했어요. 공개 화면에 보여요.' : next === 'hidden' ? '내렸어요.' : '초안으로 돌렸어요.');
        onChanged();
      }}
      className={`min-h-9 rounded-lg border px-2 text-xs font-bold ${TONE[cur]} bg-transparent`}
    >
      {(Object.keys(CONTENT_STATUS_LABEL) as ContentStatus[]).map(s => <option key={s} value={s} className="bg-slate-900 text-slate-100">{CONTENT_STATUS_LABEL[s]}</option>)}
    </select>
  );
}

/** 표 위 요약 + '예시 글 모두 내리기' */
export function ContentStatusSummary({ table, map, onChanged }: { table: ContentTable; map: StatusMap | null; onChanged: () => void }) {
  const dialog = useDialog();
  if (!map) return null;
  const rows = Object.entries(map);
  const count = (s: ContentStatus) => rows.filter(([, v]) => v.status === s).length;
  const examples = rows.filter(([, v]) => v.isExample && v.status === 'published').map(([id]) => id);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
      <span>게시 {count('published')} · 초안 {count('draft')} · 내림 {count('hidden')}</span>
      <span className="text-slate-500">초안은 공개 화면에 보이지 않아요. 검토한 뒤 '게시'로 바꿔 주세요.</span>
      {examples.length > 0 && (
        <button type="button" onClick={async () => {
          const ok = await dialog.confirm({ title: '예시 글 모두 내리기', message: `게시 중인 예시(가상) 글 ${examples.length}건을 내릴까요? 실제 후기가 생겼을 때 씁니다.`, confirmText: '내리기', variant: 'warning' });
          if (!ok) return;
          const r = await setContentStatus(table, examples, 'hidden');
          if (r.ok === false) { toast.error(r.message); return; }
          toast.success(`예시 글 ${r.data}건을 내렸어요.`);
          onChanged();
        }} className="min-h-9 px-3 rounded-lg bg-slate-800 text-slate-100 font-bold whitespace-nowrap active:scale-[0.98]">예시 글 모두 내리기</button>
      )}
    </div>
  );
}
