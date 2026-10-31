// 통합어드민 › SEO·GEO › GEO: AI 검색 인용 점검 (M-5)
// 목표 질문(최대 50개) · 질문별 최근 결과(인용 여부·출처 순위·함께 인용된 도메인) · 최근 8주 인용률 · 지금 점검
// 정기 점검은 서버가 매주 월요일 아침(06~09시)에 Gemini 구글 검색 근거 모드로 한다. 네이버·Copilot 등은 수동 링크로 확인
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Pencil, Play, Plus, RefreshCw, Trash2, TrendingUp, XCircle } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import {
  citationRate, deleteGeoQuestion, loadGeoOverview, runGeoCheckNow, saveGeoQuestion, validateQuestion,
  type GeoOverview, type GeoQuestion,
} from '../../../services/marketing/geoCitationService';

const SITE_ORIGIN = 'https://mykim.kr';
const btnGhost = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer min-h-[36px] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
const btnPrimary = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-colors cursor-pointer min-h-[36px] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
const input = 'w-full min-h-[40px] rounded-xl bg-slate-950 border border-slate-700 px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40';

function QuestionEditor({ initial, onCancel, onSaved }: { initial?: GeoQuestion; onCancel: () => void; onSaved: () => void }) {
  const [q, setQ] = useState(initial?.question || '');
  const [path, setPath] = useState(initial?.target_path || '');
  const [note, setNote] = useState(initial?.note || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const bad = validateQuestion(q, path);
    if (bad) { setErr(bad); return; }
    setBusy(true);
    const r = await saveGeoQuestion({ id: initial?.id, question: q, targetPath: path, note, active: initial?.active ?? true });
    setBusy(false);
    if (r.ok === false) { setErr(r.message); return; }
    toast.success(initial ? '질문을 고쳤어요.' : '질문을 더했어요. 다음 정기 점검에 들어가요.');
    onSaved();
  };
  return (
    <div className="p-3 rounded-xl bg-slate-950/70 border border-indigo-500/30 space-y-2">
      <input className={input} value={q} onChange={e => setQ(e.target.value)} placeholder="AI 검색에 물어볼 질문 (5~200자)" aria-label="점검 질문" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className={input} value={path} onChange={e => setPath(e.target.value)} placeholder="인용 목표 페이지 예: /guide/rehabilitation-cost.html" aria-label="인용 목표 페이지" />
        <input className={input} value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="핵심 내용 메모 (선택)" aria-label="메모" />
      </div>
      {err && <p role="alert" className="text-xs font-semibold text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btnGhost} onClick={onCancel}>취소</button>
        <button type="button" className={btnPrimary} onClick={save} disabled={busy}>{busy ? '저장 중…' : '저장'}</button>
      </div>
    </div>
  );
}

export default function GeoCitationPanel({ pageExists }: { pageExists?: (path: string) => boolean | undefined }) {
  const dialog = useDialog();
  const [data, setData] = useState<GeoOverview | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [running, setRunning] = useState<string | 'due' | null>(null);

  const reload = useCallback(async () => {
    const r = await loadGeoOverview();
    if (r.ok === false) { setError(r.message); setData({ questions: [], weekly: [] }); return; }
    setError('');
    setData(r.data);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const run = async (id?: string) => {
    setRunning(id || 'due');
    const r = await runGeoCheckNow(id);
    setRunning(null);
    if (r.ok === false) { toast.error(r.message); return; }
    if (r.data.checked === 0) toast.info('지금 점검할 질문이 없어요. 6일 안에 모두 점검했어요.');
    else toast.success(`${r.data.checked}개 점검: 인용 ${r.data.cited}개${r.data.failed ? ` · 실패 ${r.data.failed}개` : ''}`);
    void reload();
  };

  const toggle = async (q: GeoQuestion) => {
    const r = await saveGeoQuestion({ id: q.id, question: q.question, targetPath: q.target_path || '', note: q.note || '', active: !q.active });
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };

  const remove = async (q: GeoQuestion) => {
    const ok = await dialog.confirm({ title: '질문 지우기', message: `"${q.question}" 질문과 점검 기록을 지울까요?`, confirmText: '지우기', variant: 'danger' });
    if (!ok) return;
    const r = await deleteGeoQuestion(q.id);
    if (r.ok === false) { toast.error(r.message); return; }
    void reload();
  };

  const active = (data?.questions || []).filter(q => q.active);
  const weekly = data?.weekly || [];
  const totalChecked = weekly.reduce((s, w) => s + w.checked, 0);
  const totalCited = weekly.reduce((s, w) => s + w.cited, 0);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" aria-hidden="true" /> AI 검색 인용 점검
          </h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed break-keep">
            매주 월요일 아침 서버가 질문마다 Gemini(구글 검색 근거)에게 물어 답변 출처에 mykim.kr이 있는지 기록해요. 근거 링크는 도메인만 확인할 수 있어 목표 페이지 일치는 알 수 없어요. 네이버 AI 브리핑·Copilot은 공식 API가 없어 아래 링크로 직접 확인해요.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className={btnGhost} onClick={() => void reload()} aria-label="새로고침"><RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />새로고침</button>
          <button type="button" className={btnPrimary} onClick={() => run()} disabled={running !== null || active.length === 0}>
            <Play className="w-3.5 h-3.5" aria-hidden="true" />{running === 'due' ? '점검 중…' : '밀린 질문 지금 점검'}
          </button>
        </div>
      </div>

      {data === null ? (
        <div className="space-y-2" aria-hidden="true">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-800/60 animate-pulse" />)}
        </div>
      ) : (
        <>
          {error && <p role="alert" className="text-xs font-semibold text-rose-300">{error}</p>}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800"><p className="text-xs text-slate-400">켜 둔 질문</p><p className="text-lg font-black text-white tabular-nums">{active.length}<span className="text-xs text-slate-500"> / 50</span></p></div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800"><p className="text-xs text-slate-400">최근 8주 점검</p><p className="text-lg font-black text-white tabular-nums">{totalChecked}회</p></div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800"><p className="text-xs text-slate-400">인용률</p><p className="text-lg font-black text-cyan-300 tabular-nums">{totalChecked ? `${Math.round((totalCited / totalChecked) * 100)}%` : '–'}</p></div>
          </div>
          {weekly.length > 0 && (
            <div className="flex items-end gap-1.5 h-16" aria-label="주별 인용률">
              {weekly.map(w => {
                const rate = w.checked ? w.cited / w.checked : 0;
                return (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1" title={`${w.week} 주: ${w.cited}/${w.checked}`}>
                    <div className="w-full rounded-lg bg-cyan-500/70" style={{ height: `${Math.max(4, Math.round(rate * 48))}px` }} />
                    <span className="text-xs text-slate-500 tabular-nums">{w.week.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            {(data.questions || []).map(q => {
              if (editing === q.id) return <QuestionEditor key={q.id} initial={q} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />;
              const enc = encodeURIComponent(q.question);
              const rate = citationRate(q);
              const exists = q.target_path && pageExists ? pageExists(q.target_path) : undefined;
              const last = q.last;
              return (
                <div key={q.id} className={`p-3 rounded-xl border text-xs space-y-2 ${q.active ? 'bg-slate-950/70 border-slate-800' : 'bg-slate-950/30 border-slate-800/60 opacity-70'}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <span className="font-bold text-indigo-300 break-keep">Q. "{q.question}"{!q.active && <span className="ml-2 text-slate-500">(꺼 둠)</span>}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" className={btnGhost} onClick={() => run(q.id)} disabled={running !== null || !q.active}>{running === q.id ? '점검 중…' : '이 질문 점검'}</button>
                      <button type="button" className={btnGhost} onClick={() => toggle(q)}>{q.active ? '끄기' : '켜기'}</button>
                      <button type="button" className={btnGhost} onClick={() => setEditing(q.id)} aria-label="질문 고치기"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /></button>
                      <button type="button" className={btnGhost} onClick={() => remove(q)} aria-label="질문 지우기"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {last ? (
                      last.ok ? (
                        last.cited
                          ? <span className="inline-flex items-center gap-1 font-bold text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />인용됨 · 출처 {last.cited_rank}번째 / {last.source_count}곳</span>
                          : <span className="inline-flex items-center gap-1 font-bold text-amber-300"><XCircle className="w-3.5 h-3.5" aria-hidden="true" />인용 안 됨 · 출처 {last.source_count}곳</span>
                      ) : <span className="font-bold text-rose-300">점검 실패: {last.error || '알 수 없음'}</span>
                    ) : <span className="text-slate-500">아직 점검 전</span>}
                    {last && <span className="text-slate-500">{new Date(last.checked_at).toLocaleString('ko-KR')}{last.trigger_kind === 'manual' ? ' · 수동' : ''}</span>}
                    {rate !== null && <span className="text-slate-400">8주 인용률 {rate}% ({q.cited_8w}/{q.checked_8w})</span>}
                  </div>
                  {last?.ok && last.sources.length > 0 && (
                    <p className="text-slate-400 break-all">함께 인용: {last.sources.filter(s => s.domain !== 'mykim.kr').slice(0, 8).map(s => s.domain).join(', ') || '없음'}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {q.target_path && (
                      <>
                        <span className="text-slate-500">인용 목표</span>
                        <a href={`${SITE_ORIGIN}${q.target_path}`} target="_blank" rel="noopener noreferrer" className="font-mono text-slate-300 hover:underline break-all">{q.target_path}</a>
                        {exists === true && <span className="text-emerald-300">페이지 있음</span>}
                        {exists === false && <span className="text-rose-300">페이지 없음</span>}
                      </>
                    )}
                    {q.note && <span className="text-slate-500">· {q.note}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <a className={btnGhost} href={`https://search.naver.com/search.naver?query=${enc}`} target="_blank" rel="noopener noreferrer">네이버</a>
                    <a className={btnGhost} href={`https://www.bing.com/search?q=${enc}`} target="_blank" rel="noopener noreferrer">Bing·Copilot</a>
                    <a className={btnGhost} href={`https://chatgpt.com/?q=${enc}&hints=search`} target="_blank" rel="noopener noreferrer">ChatGPT</a>
                    <a className={btnGhost} href={`https://www.perplexity.ai/search?q=${enc}`} target="_blank" rel="noopener noreferrer">Perplexity</a>
                    <a className={btnGhost} href={`https://www.google.com/search?q=${enc}`} target="_blank" rel="noopener noreferrer">Google</a>
                  </div>
                </div>
              );
            })}
            {editing === 'new'
              ? <QuestionEditor onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />
              : (
                <button type="button" className={btnGhost} onClick={() => setEditing('new')} disabled={active.length >= 50}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />질문 더하기
                </button>
              )}
          </div>
        </>
      )}
    </div>
  );
}
