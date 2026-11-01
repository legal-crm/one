// 통합어드민 › SEO·GEO › 키워드 은행 (M-7)
// 키워드·묶음·의도·우선순위·월 검색량(검색광고 키워드 도구에서 옮겨 적기)·목표 페이지·다룬 여부·추세(네이버 데이터랩)
// '다음 주제 제안': 아직 다루지 않은 키워드 중 우선순위·검색량·오르는 추세·계절 메모 순, 최근 3주 안에 쓴 것은 뺌
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import {
  INTENT_LABEL, deleteKeyword, kstToday, loadKeywords, refreshTrends, relatedPages, saveKeyword, suggestTopics, trendDirection, validateKeyword,
  type KeywordInput, type KeywordIntent, type MarketingKeyword, type TrendPoint,
} from '../../../services/marketing/keywordBank';

interface PageLite { url: string; title: string; description?: string }

const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer min-h-[36px] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
const btnPrimary = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-colors cursor-pointer min-h-[36px] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
const input = 'w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

function Sparkline({ trend }: { trend?: TrendPoint[] | null }) {
  const t = trend || [];
  if (t.length < 2) return <span className="text-xs text-slate-500">추세 없음</span>;
  const max = Math.max(1, ...t.map(p => p.ratio));
  const pts = t.map((p, i) => `${(i / (t.length - 1)) * 80},${22 - (p.ratio / max) * 20}`).join(' ');
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" role="img" aria-label={`최근 ${t.length}개월 검색 추세`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cyan-400" />
    </svg>
  );
}

function Editor({ initial, onCancel, onSaved }: { initial?: MarketingKeyword; onCancel: () => void; onSaved: () => void }) {
  const [f, setF] = useState<KeywordInput>(() => ({
    keyword: initial?.keyword || '', cluster: initial?.cluster || '', intent: initial?.intent || 'info', priority: initial?.priority || 3,
    monthly_volume: initial?.monthly_volume ?? null, target_path: initial?.target_path || '', season_note: initial?.season_note || '', note: initial?.note || '',
  }));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const bad = validateKeyword(f);
    if (bad) { setErr(bad); return; }
    setBusy(true);
    const r = await saveKeyword(initial?.id || null, {
      ...f, cluster: f.cluster?.trim() || null, season_note: f.season_note?.trim() || null, note: f.note?.trim() || null,
    });
    setBusy(false);
    if (r.ok === false) { setErr(r.message); return; }
    toast.success(initial ? '키워드를 고쳤어요.' : '키워드를 더했어요.');
    onSaved();
  };
  return (
    <div className="p-3 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className={input} value={f.keyword || ''} onChange={e => setF(p => ({ ...p, keyword: e.target.value }))} placeholder="키워드 (2~40자)" aria-label="키워드" />
        <input className={input} value={f.cluster || ''} onChange={e => setF(p => ({ ...p, cluster: e.target.value }))} placeholder="묶음 (예: 변제금)" aria-label="묶음" maxLength={40} />
        <select className={input} value={f.intent} onChange={e => setF(p => ({ ...p, intent: e.target.value as KeywordIntent }))} aria-label="검색 의도">
          {(Object.keys(INTENT_LABEL) as KeywordIntent[]).map(k => <option key={k} value={k}>{INTENT_LABEL[k]}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select className={input} value={f.priority} onChange={e => setF(p => ({ ...p, priority: Number(e.target.value) }))} aria-label="우선순위">
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>우선순위 {n}</option>)}
        </select>
        <input className={input} inputMode="numeric" value={f.monthly_volume ?? ''} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); setF(p => ({ ...p, monthly_volume: v ? Number(v) : null })); }} placeholder="월 검색량 (검색광고 도구, 선택)" aria-label="월 검색량" />
        <input className={input} value={f.target_path || ''} onChange={e => setF(p => ({ ...p, target_path: e.target.value }))} placeholder="목표 페이지 (예: /guide/…)" aria-label="목표 페이지" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className={input} value={f.season_note || ''} maxLength={100} onChange={e => setF(p => ({ ...p, season_note: e.target.value }))} placeholder="계절·시기 메모 (선택)" aria-label="계절 메모" />
        <input className={input} value={f.note || ''} maxLength={200} onChange={e => setF(p => ({ ...p, note: e.target.value }))} placeholder="메모 (선택)" aria-label="메모" />
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>취소</button>
        <button type="button" className={btnPrimary} onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  );
}

export default function KeywordBankPanel({ pages }: { pages: PageLite[] }) {
  const dialog = useDialog();
  const [list, setList] = useState<MarketingKeyword[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'uncovered' | string>('uncovered');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const r = await loadKeywords();
    if (r.ok === false) { setError(r.message); setList([]); return; }
    setError('');
    setList(r.data);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const clusters = useMemo(() => Array.from(new Set((list || []).map(k => k.cluster).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'ko')), [list]);
  const shown = (list || []).filter(k => filter === 'all' ? true : filter === 'uncovered' ? !k.covered : k.cluster === filter);
  const suggestions = useMemo(() => suggestTopics(list || []), [list]);

  const setCovered = async (k: MarketingKeyword, covered: boolean) => {
    const r = await saveKeyword(k.id, { covered });
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };
  const markUsed = async (k: MarketingKeyword) => {
    const r = await saveKeyword(k.id, { last_used_on: kstToday() });
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('오늘 쓴 주제로 표시했어요. 3주 동안 제안에서 빠져요.');
    void reload();
  };
  const remove = async (k: MarketingKeyword) => {
    const ok = await dialog.confirm({ title: '키워드 지우기', message: `"${k.keyword}"를 지울까요?`, confirmText: '지우기', variant: 'danger' });
    if (!ok) return;
    const r = await deleteKeyword(k.id);
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };
  const copyTopic = async (k: MarketingKeyword) => {
    try {
      await navigator.clipboard.writeText(k.keyword);
      toast.success('주제를 복사했어요. 오토파일럿의 직접 주제 칸에 붙여 넣으세요.');
    } catch {
      toast.error('복사하지 못했어요. 직접 선택해 복사해 주세요.');
    }
  };
  const refresh = async () => {
    // 추세가 없거나 가장 오래된 것부터 10개
    const ids = [...(list || [])].sort((a, b) => (a.trend_at || '').localeCompare(b.trend_at || '')).slice(0, 10).map(k => k.id);
    if (!ids.length) return;
    setRefreshing(true);
    const r = await refreshTrends(ids);
    setRefreshing(false);
    if (r.ok === false) { toast.error(r.message); return; }
    if (r.data.updated === 0 && r.data.error) toast.error(r.data.error);
    else toast.success(`추세 ${r.data.updated}개를 새로 받았어요.${r.data.failed ? ` 실패 ${r.data.failed}개${r.data.error ? `: ${r.data.error}` : ''}` : ''}`);
    void reload();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-base font-bold text-white flex items-center gap-2"><KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />다음 주제 제안</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed break-keep">아직 다루지 않은 키워드 중 우선순위·월 검색량·오르는 추세·계절 메모 순이에요. 최근 3주 안에 쓴 키워드는 빠져요.</p>
          </div>
        </div>
        {list === null ? (
          <div className="h-20 rounded-xl bg-slate-800/60 animate-pulse" aria-hidden="true" />
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-slate-400">제안할 키워드가 없어요. 아래에서 키워드를 더하거나 '다룸' 표시를 확인해 주세요.</p>
        ) : (
          <ol className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={s.keyword.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col md:flex-row md:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">{i + 1}. {s.keyword.keyword}</p>
                  <p className="text-xs text-slate-400 break-keep">{s.reasons.join(' · ')}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button type="button" className={btnGhost} onClick={() => copyTopic(s.keyword)}><Copy className="w-3.5 h-3.5" aria-hidden="true" />주제 복사</button>
                  <button type="button" className={btnGhost} onClick={() => markUsed(s.keyword)}>오늘 썼어요</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-base font-bold text-white">키워드 은행 ({(list || []).length}/500)</h4>
            <p className="text-xs text-slate-400 mt-1 break-keep">월 검색량은 네이버 검색광고 키워드 도구 값을 옮겨 적어요. 추세는 네이버 데이터랩에서 최근 12개월(다 끝난 달)을 받아요. 키워드마다 따로 받아 모양만 비교해요.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" className={btnGhost} onClick={refresh} disabled={refreshing || !(list || []).length}>
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />{refreshing ? '받는 중…' : '추세 새로고침(오래된 10개)'}
            </button>
            <button type="button" className={btnPrimary} onClick={() => setEditing('new')} disabled={(list || []).length >= 500}><Plus className="w-3.5 h-3.5" aria-hidden="true" />키워드 더하기</button>
          </div>
        </div>
        {error && <p role="alert" className="text-xs font-semibold text-rose-300">{error}</p>}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="보기">
          {[['uncovered', '안 다룬 것'], ['all', '전체'], ...clusters.map(c => [c, c])].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-bold whitespace-nowrap ${filter === v ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              {l}
            </button>
          ))}
        </div>
        {editing === 'new' && <Editor onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
        {list === null ? (
          <div className="space-y-2" aria-hidden="true">{[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-slate-800/60 animate-pulse" />)}</div>
        ) : shown.length === 0 ? (
          <p className="text-xs text-slate-400">이 보기에 해당하는 키워드가 없어요.</p>
        ) : (
          <div className="space-y-2">
            {shown.map(k => {
              if (editing === k.id) return <Editor key={k.id} initial={k} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />;
              const t = trendDirection(k.trend);
              const related = pages.length ? relatedPages(k.keyword, pages) : [];
              return (
                <div key={k.id} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex flex-col lg:flex-row lg:items-center gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-bold text-white">
                      {k.keyword}
                      <span className="ml-2 text-xs font-normal text-slate-400">{k.cluster ? `${k.cluster} · ` : ''}{INTENT_LABEL[k.intent]} · 우선순위 {k.priority}{k.monthly_volume != null ? ` · 월 ${k.monthly_volume.toLocaleString('ko-KR')}회` : ''}</span>
                    </p>
                    <p className="text-slate-400 break-keep">
                      {k.target_path ? <>목표 <span className="font-mono text-slate-300">{k.target_path}</span> · </> : null}
                      {pages.length === 0 ? <span className="text-slate-500">사이트 진단을 불러오면 관련 글을 찾아요</span>
                        : related.length > 0 ? <span className="text-emerald-300">관련 글 {related.length}개 ({related.slice(0, 2).map(p => p.title).join(', ')})</span>
                        : <span className="text-amber-300">사이트에 관련 글 없음</span>}
                      {k.season_note ? ` · ${k.season_note}` : ''}
                      {k.last_used_on ? ` · 마지막 사용 ${k.last_used_on}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Sparkline trend={k.trend} />
                    <span className={`w-16 text-right font-bold ${t.dir === 'up' ? 'text-emerald-300' : t.dir === 'down' ? 'text-rose-300' : 'text-slate-400'}`}>
                      {t.dir === 'up' ? `▲${t.change ?? ''}%` : t.dir === 'down' ? `▼${Math.abs(t.change ?? 0)}%` : t.dir === 'flat' ? '비슷' : '–'}
                    </span>
                    <label className="inline-flex items-center gap-1.5 min-h-[36px] px-2 rounded-xl bg-slate-800 text-slate-200 cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={k.covered} onChange={e => setCovered(k, e.target.checked)} />다룸
                    </label>
                    <button type="button" className={btnGhost} onClick={() => setEditing(k.id)} aria-label={`${k.keyword} 고치기`}><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    <button type="button" className={btnGhost} onClick={() => remove(k)} aria-label={`${k.keyword} 지우기`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
