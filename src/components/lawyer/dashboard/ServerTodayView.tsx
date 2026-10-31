// ============================================================
// 오늘의 업무 (서버 기준, HM-2~HM-8)
// - 업무함 = 서버 office_work_queue (권한 범위 안의 할 일만, 원래 일이 끝나면 저절로 사라짐)
// - 카드 4개 = 역할별 기본 구성, 숫자는 업무함과 같은 정의
// - 행 동작: 처리(해당 화면) · 미루기 · 넘기기 · 메모
// - 공지 = 통합어드민 공지(서버), 처음 쓰는 사무소 '시작하기'
// - 60초마다·창으로 돌아올 때 새로 읽고, 자정이 지나면 날짜를 바꾼다
// 이전 화면(LawyerDashboardView)은 탭 세션 사본을 읽어 새 탭·다른 기기에서 0건이었다.
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock, Hourglass, Inbox,
  Megaphone, MessageSquareText, RefreshCw, UserRoundCheck, Wallet, X,
} from 'lucide-react';
import {
  loadWorkQueue, setWorkOverride, formatDue, snoozeTarget, stageLabel,
  WORK_GROUP_LABEL, WORK_GROUP_ORDER, WORK_CARD_KINDS, type WorkGroup, type WorkItem,
} from '../../../services/office/workQueueService';
import { listOfficeMembers, type OfficeMember } from '../../../services/office/officeService';
import type { Notice } from '../../../types';
import { useDialog } from '../../common/DialogProvider';

type Role = 'owner' | 'lawyer' | 'consultant' | 'clerk' | 'accounting' | 'custom' | string;

interface CardDef { id: string; label: string; kinds: readonly string[]; groups?: WorkGroup[]; icon: React.ReactNode; tab?: string }

const CARD: Record<string, CardDef> = {
  consult: { id: 'consult', label: '응답할 상담 요청', kinds: WORK_CARD_KINDS.consult, icon: <MessageSquareText className="w-4 h-4" />, tab: 'requests' },
  deadlines: { id: 'deadlines', label: '7일 안 기한', kinds: WORK_CARD_KINDS.deadlines, groups: ['overdue', 'today', 'tomorrow', 'week'], icon: <CalendarClock className="w-4 h-4" />, tab: 'tasks-schedule' },
  waiting: { id: 'waiting', label: '의뢰인 회신 대기', kinds: WORK_CARD_KINDS.waiting, icon: <Hourglass className="w-4 h-4" /> },
  review: { id: 'review', label: '검토할 일', kinds: WORK_CARD_KINDS.review, icon: <UserRoundCheck className="w-4 h-4" /> },
  fees: { id: 'fees', label: '오늘·연체 수납', kinds: WORK_CARD_KINDS.fees, icon: <Wallet className="w-4 h-4" />, tab: 'fee-settlement' },
};
const ROLE_CARDS: Record<string, string[]> = {
  owner: ['consult', 'deadlines', 'waiting', 'fees'],
  lawyer: ['consult', 'deadlines', 'review', 'waiting'],
  consultant: ['consult', 'review', 'waiting', 'deadlines'],
  clerk: ['review', 'waiting', 'deadlines', 'fees'],
  accounting: ['fees', 'review', 'deadlines', 'waiting'],
};

export interface ServerTodayViewProps {
  officeId: string;
  officeRole: Role;
  myMemberId: string | null;
  notices: Notice[];
  onNavigateTab: (tab: string) => void;
  /** 알림 종과 같은 바로가기 (link_type, link_id) */
  onOpenLink: (linkType: string, linkId: string | null) => void;
  onNewCase: () => void;
}

export default function ServerTodayView({ officeId, officeRole, myMemberId, notices, onNavigateTab, onOpenLink, onNewCase }: ServerTodayViewProps) {
  const dialog = useDialog();
  const [items, setItems] = useState<WorkItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'mine' | 'all'>(officeRole === 'owner' ? 'all' : 'mine');
  const [filterCard, setFilterCard] = useState<string | null>(null);
  const [closed, setClosed] = useState<Record<string, boolean>>({ later: true });
  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [today, setToday] = useState(() => new Date().toDateString());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await loadWorkQueue(officeId);
    setLoading(false);
    if (r.ok === false) { setError(r.message); return; }
    setError(null);
    setItems(r.data);
  }, [officeId]);

  useEffect(() => { void load(); }, [load, today]);
  useEffect(() => {
    void listOfficeMembers(officeId).then(r => { if (r.ok) setMembers(r.data.filter(m => m.status === 'active')); });
  }, [officeId]);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const d = new Date().toDateString();
      if (d !== today) setToday(d); else void load();
    };
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [load, today]);

  const scoped = useMemo(() => {
    const list = items || [];
    if (scope === 'all' || !myMemberId) return list;
    // 내 담당: 나에게 배정된 일 + 담당자가 정해지지 않은 일
    return list.filter(i => !i.assigneeMemberId || i.assigneeMemberId === myMemberId);
  }, [items, scope, myMemberId]);

  const cardIds = ROLE_CARDS[officeRole] || ROLE_CARDS.lawyer;
  const countOf = (c: CardDef) => scoped.filter(i => c.kinds.includes(i.kind) && (!c.groups || c.groups.includes(i.group)))
    .reduce((s, i) => s + (i.count || 1), 0);

  const visible = useMemo(() => {
    if (!filterCard) return scoped;
    const c = CARD[filterCard];
    return scoped.filter(i => c.kinds.includes(i.kind) && (!c.groups || c.groups.includes(i.group)));
  }, [scoped, filterCard]);

  const grouped = useMemo(() => {
    const m = new Map<WorkGroup, WorkItem[]>();
    for (const g of WORK_GROUP_ORDER) m.set(g, []);
    for (const i of visible) m.get(i.group)?.push(i);
    return m;
  }, [visible]);

  const urgentCount = (grouped.get('overdue')?.length || 0) + (grouped.get('today')?.length || 0);
  const memberName = (id: string | null) => (id ? members.find(m => m.id === id)?.displayName || '구성원' : '담당 미정');

  const snooze = async (item: WorkItem, kind: '1h' | 'tomorrow' | '3d') => {
    setBusyKey(item.key);
    const r = await setWorkOverride(officeId, item.key, { snoozeUntil: snoozeTarget(kind).toISOString(), snoozeReason: kind, assigneeMemberId: item.assigneeMemberId, memo: item.memo });
    setBusyKey(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(kind === '1h' ? '1시간 뒤 다시 보여 드려요.' : kind === 'tomorrow' ? '내일 아침 다시 보여 드려요.' : '3일 뒤 아침 다시 보여 드려요.');
    void load();
  };
  const handover = async (item: WorkItem, memberId: string) => {
    setBusyKey(item.key);
    const r = await setWorkOverride(officeId, item.key, { assigneeMemberId: memberId || null, memo: item.memo });
    setBusyKey(null);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success(memberId ? `${memberName(memberId)}님에게 넘겼어요.` : '담당자 지정을 지웠어요.');
    void load();
  };
  const editMemo = async (item: WorkItem) => {
    const v = await dialog.prompt({ title: '메모', message: '이 일에 남길 메모 (300자까지, 의뢰인 실명·연락처는 적지 마세요)', defaultValue: item.memo || '', placeholder: '예: 오후 3시 통화 약속' });
    if (v === null) return;
    const r = await setWorkOverride(officeId, item.key, { assigneeMemberId: item.assigneeMemberId, memo: v.trim() || null });
    if (r.ok === false) { toast.error(r.message); return; }
    void load();
  };

  const recentNotices = useMemo(() => [...(notices || [])]
    .sort((a, b) => Number(b.isImportant) - Number(a.isImportant) || (b.date || '').localeCompare(a.date || ''))
    .slice(0, 3), [notices]);
  const [hiddenNotices, setHiddenNotices] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('mykim_dismissed_office_notices') || '[]'); } catch { return []; }
  });
  const dismissNotice = (id: string) => {
    const next = [...hiddenNotices, id].slice(-50);
    setHiddenNotices(next);
    try { localStorage.setItem('mykim_dismissed_office_notices', JSON.stringify(next)); } catch { /* 화면 설정 */ }
  };

  const todayLabel = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="space-y-6 pb-12">
      {/* 머리: 날짜·오늘 처리할 일·범위 */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">{todayLabel} · 오늘의 업무</h2>
          <p className="text-sm text-slate-600 mt-1">
            {items === null ? '할 일을 불러오는 중이에요.' : urgentCount > 0 ? `기한 지남·오늘 할 일 ${urgentCount}건이 있어요.` : '기한 지난 일이나 오늘 기한인 일이 없어요.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50" role="group" aria-label="보기 범위">
            {(['mine', 'all'] as const).map(s => (
              <button key={s} type="button" onClick={() => setScope(s)} aria-pressed={scope === s}
                className={`min-h-10 px-3 rounded-lg text-sm font-bold whitespace-nowrap ${scope === s ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                {s === 'mine' ? '내 담당' : '권한 안 전체'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="새로고침"
            className="min-h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-600 active:scale-[0.98] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* 공지 (통합어드민) */}
      {recentNotices.filter(n => !hiddenNotices.includes(n.id)).map(n => (
        <div key={n.id} className={`flex items-start gap-3 p-4 rounded-2xl border ${n.isImportant ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <Megaphone className={`w-5 h-5 shrink-0 mt-0.5 ${n.isImportant ? 'text-amber-600' : 'text-slate-500'}`} aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">{n.title}</p>
            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 whitespace-pre-line">{n.content}</p>
          </div>
          <button type="button" onClick={() => dismissNotice(n.id)} aria-label="공지 닫기" className="min-h-9 min-w-9 rounded-lg text-slate-400 hover:text-slate-700"><X className="w-4 h-4 mx-auto" aria-hidden="true" /></button>
        </div>
      ))}

      {/* 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cardIds.map(id => {
          const c = CARD[id];
          const active = filterCard === id;
          const n = items === null ? null : countOf(c);
          return (
            <button key={id} type="button" onClick={() => setFilterCard(active ? null : id)} aria-pressed={active}
              className={`text-left p-4 rounded-2xl border shadow-sm transition-all active:scale-[0.98] ${active ? 'border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20 bg-blue-50/40' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <span className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5">{c.icon}{c.label}</span>
                {c.tab && <ArrowUpRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}
              </span>
              <span className="block text-2xl md:text-3xl font-black text-slate-900 mt-2 tabular-nums">
                {n === null ? <span className="inline-block h-8 w-10 rounded-lg bg-slate-100 animate-pulse" /> : n}
              </span>
              <span className="block text-xs text-slate-500 mt-1">{active ? '업무함을 이 조건으로 보는 중' : '누르면 업무함을 걸러 봐요'}</span>
            </button>
          );
        })}
      </div>

      {/* 업무함 */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" aria-labelledby="work-queue-title">
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-slate-100">
          <h3 id="work-queue-title" className="text-base font-black text-slate-900 flex items-center gap-2"><Inbox className="w-5 h-5 text-[#1E3A5F]" aria-hidden="true" />업무함</h3>
          {filterCard && (
            <button type="button" onClick={() => setFilterCard(null)} className="min-h-10 px-3 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 whitespace-nowrap">거르기 풀기 · {CARD[filterCard].label}</button>
          )}
        </div>

        {error ? (
          <div className="p-6 text-center space-y-3">
            <AlertTriangle className="w-6 h-6 text-rose-500 mx-auto" aria-hidden="true" />
            <p className="text-sm text-slate-700">{error}</p>
            <button type="button" onClick={() => void load()} className="min-h-11 px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold">다시 시도</button>
          </div>
        ) : items === null ? (
          <div className="p-5 space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-800">지금 처리할 일이 없어요</p>
            <p className="text-xs text-slate-500">새 상담 요청·의뢰인 제출 서류·보정 마감이 생기면 여기에 모여요.</p>
            <div className="flex justify-center gap-2 flex-wrap">
              <button type="button" onClick={() => onNavigateTab('tasks-schedule')} className="min-h-11 px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 whitespace-nowrap">일정 보기</button>
              <button type="button" onClick={onNewCase} className="min-h-11 px-4 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap">사건 직접 등록</button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {WORK_GROUP_ORDER.map(g => {
              const list = grouped.get(g) || [];
              if (list.length === 0) return null;
              const isClosed = closed[g];
              return (
                <div key={g}>
                  <button type="button" onClick={() => setClosed(c => ({ ...c, [g]: !c[g] }))} aria-expanded={!isClosed}
                    className="w-full flex items-center justify-between px-5 py-3 bg-slate-50/70 text-sm font-bold text-slate-700 min-h-11">
                    <span className={g === 'overdue' ? 'text-rose-700' : ''}>{WORK_GROUP_LABEL[g]} · {list.length}</span>
                    {isClosed ? <ChevronDown className="w-4 h-4" aria-hidden="true" /> : <ChevronUp className="w-4 h-4" aria-hidden="true" />}
                  </button>
                  {!isClosed && (
                    <ul className="divide-y divide-slate-100">
                      {list.map(item => (
                        <li key={item.key} className="px-5 py-3 flex flex-col md:flex-row md:items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900">
                              {item.title}{item.count > 1 ? ` (${item.count}건)` : ''}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                              {item.alias && <span>{item.alias}</span>}
                              {item.stage && <span>· {stageLabel(item.stage)}</span>}
                              <span className={`flex items-center gap-1 ${g === 'overdue' ? 'text-rose-600 font-bold' : ''}`}><Clock className="w-3 h-3" aria-hidden="true" />{formatDue(item.dueAt)}{item.dueBasis ? ` · ${item.dueBasis}` : ''}</span>
                              <span>· {memberName(item.assigneeMemberId)}</span>
                            </p>
                            {item.memo && <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-lg px-2 py-1">메모: {item.memo}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button type="button" onClick={() => onOpenLink(item.linkType, item.linkId)}
                              className="min-h-11 px-4 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold whitespace-nowrap active:scale-[0.98]">처리하기</button>
                            <select aria-label="미루기" value="" disabled={busyKey === item.key}
                              onChange={e => { const v = e.target.value as '1h' | 'tomorrow' | '3d'; if (v) void snooze(item, v); }}
                              className="min-h-11 rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700">
                              <option value="">미루기</option>
                              <option value="1h">1시간 뒤</option>
                              <option value="tomorrow">내일 아침</option>
                              <option value="3d">3일 뒤</option>
                            </select>
                            {members.length > 1 && (
                              <select aria-label="넘기기" value={item.assigneeMemberId || ''} disabled={busyKey === item.key}
                                onChange={e => void handover(item, e.target.value)}
                                className="min-h-11 max-w-[9rem] rounded-xl border border-slate-300 bg-white px-2 text-xs font-bold text-slate-700">
                                <option value="">넘기기…</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                              </select>
                            )}
                            <button type="button" onClick={() => void editMemo(item)} className="min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 whitespace-nowrap">메모</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500">업무함은 상담 요청·계약·수납·서류·작성 요청·보정·일정·할 일·업무폰·광고 기록에서 서버가 모아요. 원래 일을 끝내면 저절로 사라지고, 미루기·넘기기·메모만 따로 저장돼요.</p>
    </div>
  );
}
