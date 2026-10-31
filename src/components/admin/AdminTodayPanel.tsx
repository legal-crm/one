import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { loadAdminTodo, loadPlatformMetrics, loadServiceHealth, type AdminTodoItem, type PlatformMetrics, type ServiceCheck } from '../../services/admin/adminOpsService';

/**
 * 대시보드 맨 위: 오늘 처리할 일 + 기간 지표 (OP-3, 서버 기준).
 * 의뢰인 상담 원문·채무액은 다루지 않고 건수만 보여 준다.
 */
const PERIODS = [
  { days: 7, label: '최근 7일' },
  { days: 30, label: '최근 30일' },
  { days: 90, label: '최근 90일' },
];

function fmtAge(iso?: string): string {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 24) return `${Math.max(h, 0)}시간 전부터`;
  return `${Math.floor(h / 24)}일 전부터`;
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');
/** 앞 기간 대비 (같은 길이) */
const delta = (cur: number, prev: number | undefined) => {
  if (prev === undefined) return '';
  const d = cur - prev;
  return d === 0 ? ' · 앞 기간과 같음' : ` · 앞 기간보다 ${d > 0 ? '+' : ''}${d.toLocaleString()}`;
};

export default function AdminTodayPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [todo, setTodo] = useState<AdminTodoItem[] | null>(null);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [prevMetrics, setPrevMetrics] = useState<PlatformMetrics | null>(null);
  const [health, setHealth] = useState<{ checkedAt: string; checks: ServiceCheck[] } | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const now = Date.now();
    const from = new Date(now - days * 86400000);
    const [t, m, p, h] = await Promise.all([
      loadAdminTodo(),
      loadPlatformMetrics(from),
      loadPlatformMetrics(new Date(now - 2 * days * 86400000), from),
      loadServiceHealth(),
    ]);
    setLoading(false);
    if (t.ok === false) { setError(t.message); return; }
    if (m.ok === false) { setError(m.message); return; }
    setError(null);
    setTodo(t.data);
    setMetrics(m.data);
    setPrevMetrics(p.ok ? p.data : null);
    if (h.ok === false) { setHealthError(h.message); } else { setHealth(h.data); setHealthError(null); }
    setUpdatedAt(new Date());
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
        <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" aria-hidden="true" />
        <p className="text-sm text-rose-100 flex-1">{error}</p>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer">다시 불러오기</button>
      </div>
    );
  }

  if (loading && !metrics) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-28 rounded-2xl bg-[#111622] border border-[#1E293B]/60 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-[#111622] border border-[#1E293B]/60 animate-pulse" />)}
        </div>
      </div>
    );
  }

  const m = metrics!;
  const pm = prevMetrics || undefined;
  const cards: Array<{ label: string; value: string; sub: string }> = [
    { label: '새 상담 요청', value: `${m.consult.created}건`, sub: `숨김 ${m.consult.hidden}건 · 정리 완료 ${m.checksCompleted}건${delta(m.consult.created, pm?.consult.created)}` },
    { label: '변호사 응답', value: pct(m.seats.responded, m.seats.requested), sub: `요청 ${m.seats.requested} · 기한 안 응답 ${pct(m.seats.respondedInTime, m.seats.requested)} · 평균 ${m.seats.avgFirstResponseHours ?? '–'}시간` },
    { label: '기한 지남·거절', value: `${m.seats.expired + m.seats.declined}건`, sub: `기한 지남 ${m.seats.expired} · 거절 ${m.seats.declined}` },
    { label: '승인 변호사', value: `${m.lawyers.approved}명`, sub: `목록 공개 ${m.lawyers.listed} · 심사 대기 ${m.lawyers.pending} · 정지 ${m.lawyers.suspended}` },
    { label: '의뢰인 계정', value: `${m.accounts.clients}명`, sub: `기간 중 새 가입 ${m.accounts.newClients}${delta(m.accounts.newClients, pm?.accounts.newClients)} · 정지 ${m.accounts.suspended}` },
    { label: '광고 입금', value: `${m.ads.paidAmount.toLocaleString()}원`, sub: `입금 대기 ${m.ads.byStatus.pending || 0} · 노출 중 ${m.ads.byStatus.active || 0}${delta(m.ads.paidAmount, pm?.ads.paidAmount)}` },
    { label: '미답변 문의', value: `${m.inquiries.clientPending + m.inquiries.lawyerPending}건`, sub: `의뢰인 ${m.inquiries.clientPending} · 변호사 ${m.inquiries.lawyerPending}` },
  ];

  return (
    <div className="space-y-4">
      <section className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 space-y-3" aria-labelledby="admin-todo-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="admin-todo-title" className="text-base font-extrabold text-white">오늘 처리할 일</h2>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="min-h-[44px] px-3 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {updatedAt ? `${updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준` : '새로 고침'}
          </button>
        </div>
        {(todo || []).length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-200">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>지금 처리할 일이 없어요.</span>
          </div>
        ) : (
          <ul className="divide-y divide-[#1E293B]/60">
            {(todo || []).map(item => (
              <li key={item.key}>
                <button type="button" onClick={() => onNavigate(item.tab)}
                  className="w-full min-h-[44px] py-2.5 flex items-center gap-3 text-left hover:bg-white/5 rounded-xl px-2 active:scale-[0.99] cursor-pointer">
                  <span className={`text-sm font-bold flex-1 ${item.overdue ? 'text-amber-200' : 'text-slate-100'}`}>{item.label}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{fmtAge(item.oldestAt)}</span>
                  {item.overdue && <span className="text-xs font-bold text-amber-200 bg-amber-500/15 border border-amber-500/30 rounded-lg px-2 py-0.5 whitespace-nowrap">2영업일 넘김</span>}
                  <span className="text-sm font-black text-white bg-white/10 rounded-lg px-2.5 py-0.5 min-w-[2.5rem] text-center">{item.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="admin-metrics-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="admin-metrics-title" className="text-base font-extrabold text-white">운영 지표</h2>
          <div className="flex gap-1.5" role="group" aria-label="기간">
            {PERIODS.map(p => (
              <button key={p.days} type="button" onClick={() => setDays(p.days)} aria-pressed={days === p.days}
                className={`min-h-[44px] px-3 rounded-xl text-xs font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer ${days === p.days ? 'bg-indigo-500/20 text-indigo-100 border border-indigo-400/40' : 'text-slate-300 border border-[#1E293B]/80 hover:bg-white/5'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map(c => (
            <div key={c.label} className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-bold text-slate-400">{c.label}</p>
              <p className="text-xl font-black text-white">{c.value}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{c.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">서버 기록 기준 · 상담 원문·채무액은 집계하지 않아요 · '앞 기간'은 바로 앞의 같은 길이 기간 · 매일 새벽 하루 지표를 따로 남겨요.</p>
      </section>

      <section className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 space-y-3" aria-labelledby="admin-health-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="admin-health-title" className="text-base font-extrabold text-white">서비스 상태</h2>
          {health && <span className="text-xs text-slate-400">{new Date(health.checkedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 확인</span>}
        </div>
        {healthError ? (
          <p className="text-sm text-rose-200" role="alert">{healthError}</p>
        ) : !health ? (
          <div className="h-16 rounded-xl bg-slate-800/60 animate-pulse" aria-busy="true" />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {health.checks.map(c => (
              <li key={c.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${c.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
                {c.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />}
                <span className="font-bold">{c.label}</span>
                <span className="text-xs opacity-80 ml-auto text-right">{c.ok ? '정상' : '확인 필요'} · {c.detail}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-400">데이터베이스는 실제로 읽어 보고, 외부 서비스는 서버에 키가 있는지만 봐요(요금이 드는 호출은 하지 않아요).</p>
      </section>
    </div>
  );
}
