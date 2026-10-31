// 통합어드민 › 보안 & 세션: 관리자 조치 기록 (OP-15)
// 누가·언제·무엇을·어떤 값에서 어떤 값으로·왜 바꿨는지. 추가만 되고 2년 보관. 달마다 '점검 끝'을 남긴다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { useDialog } from '../common/DialogProvider';

interface ActionRow {
  id: number; actorEmail: string | null; action: string; targetType: string; targetId: string | null;
  before: unknown; after: unknown; reason: string | null; createdAt: string;
}
interface ReviewRow { month: string; reviewedEmail: string | null; note: string | null; actionCount: number; reviewedAt: string }

const PAGE = 50;
const RANGE_DAYS = [7, 30, 90, 365] as const;
const short = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
};
const maskEmail = (e: string | null) => (e && e.includes('@') ? `${e.split('@')[0].slice(0, 2)}***@${e.split('@')[1]}` : e || '');
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

export default function AdminActionsPanel() {
  const dialog = useDialog();
  const [rows, setRows] = useState<ActionRow[] | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState('');
  const [days, setDays] = useState<number>(30);
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setError('서버가 설정되지 않았어요.'); setRows([]); return; }
    const since = new Date(Date.now() - days * 86400000).toISOString();
    let q = supabase.from('admin_actions').select('id, actor_email, action, target_type, target_id, before_value, after_value, reason, created_at')
      .gte('created_at', since).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE);
    if (kind.trim()) q = q.ilike('action', `%${kind.trim()}%`);
    const [{ data, error: e1 }, { data: rv, error: e2 }] = await Promise.all([
      q,
      supabase.from('admin_audit_reviews').select('month, reviewed_email, note, action_count, reviewed_at').order('month', { ascending: false }).limit(12),
    ]);
    if (e1 || e2) { setError('관리자 조치 기록을 불러오지 못했어요. 2단계 인증을 마친 관리자만 볼 수 있어요.'); setRows([]); return; }
    setError('');
    const list = (data || []).map((r: any) => ({
      id: r.id, actorEmail: r.actor_email, action: r.action, targetType: r.target_type, targetId: r.target_id,
      before: r.before_value, after: r.after_value, reason: r.reason, createdAt: r.created_at,
    }));
    setHasMore(list.length > PAGE);
    setRows(list.slice(0, PAGE));
    setReviews((rv || []).map((r: any) => ({ month: r.month, reviewedEmail: r.reviewed_email, note: r.note, actionCount: r.action_count, reviewedAt: r.reviewed_at })));
  }, [days, kind, page]);
  useEffect(() => { void load(); }, [load]);

  const lastMonth = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return monthKey(d); }, []);
  const lastMonthReview = reviews.find(r => r.month === lastMonth);

  const markReviewed = async () => {
    const note = await dialog.prompt({ title: '지난달 기록 점검', message: '지난달 관리자 조치 기록을 확인했나요? 확인한 내용이나 특이 사항을 적어 주세요.', placeholder: '예: 이상 없음' });
    if (note === null) return;
    const { error: e } = await supabase.rpc('admin_mark_audit_reviewed', { p_month: lastMonth, p_note: note.trim() || null });
    if (e) { toast.error('점검 기록을 남기지 못했어요.'); return; }
    toast.success('지난달 점검을 기록했어요.');
    void load();
  };

  // CT-16: 지운 콘텐츠는 기록에 남은 원본으로 '초안'으로 되살린다 (공개 화면엔 게시해야 보임)
  const CONTENT_TABLES = ['news_articles', 'client_qas', 'success_reviews', 'main_banners', 'notices'];
  const restoreContent = async (r: ActionRow) => {
    const before = r.before as { data?: unknown; is_example?: boolean } | null;
    if (!before?.data || !r.targetId || !CONTENT_TABLES.includes(r.targetType)) return;
    const ok = await dialog.confirm({ title: '지운 글 되살리기', message: '기록에 남은 내용으로 글을 다시 만듭니다. 초안으로 들어가니 확인한 뒤 게시해 주세요.', confirmText: '되살리기' });
    if (!ok) return;
    const { error: e } = await supabase.from(r.targetType).insert({ id: r.targetId, data: before.data, status: 'draft', is_example: !!before.is_example });
    if (e) { toast.error(/duplicate|unique/i.test(e.message) ? '같은 글이 이미 있어요.' : '되살리지 못했어요. 잠시 후 다시 시도해 주세요.'); return; }
    toast.success('초안으로 되살렸어요. 콘텐츠 제어에서 확인 후 게시해 주세요.');
    void load();
  };

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white"><ClipboardCheck className="w-4 h-4 text-indigo-400" aria-hidden="true" />관리자 조치 기록</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select value={days} onChange={e => { setDays(Number(e.target.value)); setPage(0); }} aria-label="기간"
            className="min-h-9 rounded-xl bg-slate-900 border border-slate-700 px-2 text-xs text-slate-100">
            {RANGE_DAYS.map(d => <option key={d} value={d}>최근 {d}일</option>)}
          </select>
          <input value={kind} onChange={e => { setKind(e.target.value); setPage(0); }} placeholder="조치 종류 (예: settings, content, lawyer)" aria-label="조치 종류"
            className="min-h-9 w-44 rounded-xl bg-slate-900 border border-slate-700 px-2 text-xs text-slate-100 placeholder:text-slate-500" />
          <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {lastMonthReview ? (
          <span className="text-emerald-300">지난달({lastMonth.slice(0, 7)}) 점검 끝 · {new Date(lastMonthReview.reviewedAt).toLocaleDateString('ko-KR')} · 조치 {lastMonthReview.actionCount}건{lastMonthReview.note ? ` · ${lastMonthReview.note}` : ''}</span>
        ) : (
          <>
            <span className="text-amber-300">지난달({lastMonth.slice(0, 7)}) 기록 점검이 아직 없어요.</span>
            <button type="button" onClick={() => void markReviewed()} className="min-h-9 px-3 rounded-xl bg-indigo-600 text-white font-bold whitespace-nowrap active:scale-[0.98]">점검 끝 기록</button>
          </>
        )}
        <span className="text-slate-400">기록은 고칠 수 없고 2년 뒤 정리돼요.</span>
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : rows === null ? (
        <div className="h-24 rounded-xl bg-slate-800/60 animate-pulse" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">이 기간에 기록된 관리자 조치가 없어요.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-200">
              <thead className="text-slate-400">
                <tr className="text-left">
                  <th className="py-2 pr-3 font-bold whitespace-nowrap">시각</th>
                  <th className="py-2 pr-3 font-bold">관리자</th>
                  <th className="py-2 pr-3 font-bold">조치</th>
                  <th className="py-2 pr-3 font-bold">대상</th>
                  <th className="py-2 pr-3 font-bold">바뀐 값</th>
                  <th className="py-2 font-bold">사유</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/60">
                {rows.map(r => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{new Date(r.createdAt).toLocaleString('ko-KR')}</td>
                    <td className="py-2 pr-3">{maskEmail(r.actorEmail) || '서버 작업'}</td>
                    <td className="py-2 pr-3 font-mono">{r.action}</td>
                    <td className="py-2 pr-3 break-all">{r.targetType}{r.targetId ? ` · ${r.targetId.slice(0, 24)}` : ''}</td>
                    <td className="py-2 pr-3 break-all text-slate-300">
                      {r.before !== null && r.before !== undefined && <span className="block text-rose-300/90">이전 {short(r.before)}</span>}
                      {r.after !== null && r.after !== undefined && <span className="block text-emerald-300/90">이후 {short(r.after)}</span>}
                    </td>
                    <td className="py-2 break-words text-slate-300">
                      {r.reason || ''}
                      {r.action === 'content.delete' && !!(r.before as { data?: unknown } | null)?.data && (
                        <button type="button" onClick={() => void restoreContent(r)} className="block mt-1 min-h-9 px-3 rounded-xl bg-slate-800 text-slate-100 font-bold whitespace-nowrap active:scale-[0.98]">되살리기(초안)</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold disabled:opacity-40">이전</button>
            <span className="text-xs text-slate-400">{page + 1}쪽</span>
            <button type="button" disabled={!hasMore} onClick={() => setPage(p => p + 1)} className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold disabled:opacity-40">다음</button>
          </div>
        </>
      )}
    </section>
  );
}
