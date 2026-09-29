// ============================================================
// 통합 어드민 대시보드 (PART 3-2)
// ------------------------------------------------------------
// 이전 대시보드의 고정값·가짜 지표를 제거하고 실제 데이터로만 계산한다.
//  - 제거: 일일 방문자 '248명', 서버 'ONLINE' 고정 표시, 가입자·방문자 고정 차트 배열,
//          가짜 전담 선임 목록(홍길* → 이소민 …)·가짜 취소 사유 통계·가짜 인사이트,
//          스팸 차단 건까지 '전환'으로 세던 전환율(closed/total), UTC 기준 '오늘'
//  - 추가: 계약 체결·진단 완료(서버 기록)·광고 입금액·변호사별 실적(응답률·응답 속도·체결)
// 데이터 한계(화면에 표기): 방문자 수는 분석 도구 미연동, 만족도는 수집 기능 없음
// 플랫폼 수익은 정액 광고비뿐이다. 매칭 건수 구간으로 만든 '예상 구독료' 카드는 삭제했다 (docs/feature_expansion_plan.md 0장)
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, CheckCircle2, Briefcase, UserPlus, Server, FileText, Microscope, Megaphone,
  Scale, BarChart2, TrendingUp, ShieldCheck, CreditCard, Clock,
} from 'lucide-react';
import type { ConsultRequest, User, Member, AdOrder, ConsultStatus } from '../../types';
import type { PlatformActivityLog } from '../../services/platformActivityService';
import { fetchDiagnosisSubmitCounts } from '../../services/platformActivityService';
import { localYmd } from '../../utils/localDate';

/** 관리자 '스팸 노출 차단' 처리 시 붙는 제목 접두어 (AdminRole.handleToggleBlockRequest) */
export const SPAM_BLOCKED_TITLE_PREFIX = '[노출 차단]';

/** 수임 계약 이후 단계 */
const CONTRACTED_STATUSES = new Set<ConsultStatus>(['contracted', 'document', 'filed', 'commenced', 'repaying', 'discharged']);

/** 관리자 숨김(023 admin_hidden) 또는 이전 방식(제목 치환)으로 차단된 요청 */
export const isSpamBlocked = (r: ConsultRequest) => r.adminHidden === true || String(r.title || '').startsWith(SPAM_BLOCKED_TITLE_PREFIX);
export const isContracted = (r: ConsultRequest) => CONTRACTED_STATUSES.has(r.status);

/** 요청과 관련된 변호사 ID (지정·배정·채팅 개시) */
function relatedLawyerIds(r: ConsultRequest): Set<string> {
  const ids = new Set<string>();
  (r.selectedLawyerIds || []).forEach(id => id && ids.add(id));
  if (r.selectedLawyerId) ids.add(r.selectedLawyerId);
  if (r.assignedLawyerId) ids.add(r.assignedLawyerId);
  return ids;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function formatHours(h: number | null): string {
  if (h === null) return '—';
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}분`;
  if (h < 48) return `${h.toFixed(1)}시간`;
  return `${(h / 24).toFixed(1)}일`;
}

/** 만원 단위 → 읽기 쉬운 문자열 */
function formatManwon(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}억 원`;
  return `${Math.round(v).toLocaleString()}만 원`;
}

const localDateOf = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : localYmd(d);
};

type HealthState = 'checking' | 'ok' | 'error' | 'not_configured';

function useSupabaseHealth(): HealthState {
  const [state, setState] = useState<HealthState>('checking');
  useEffect(() => {
    const url = (import.meta as any).env?.VITE_SUPABASE_URL;
    const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) { setState('not_configured'); return; }
    let cancelled = false;
    const check = async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key }, signal: ctrl.signal });
        clearTimeout(t);
        if (!cancelled) setState(res.ok ? 'ok' : 'error');
      } catch {
        if (!cancelled) setState('error');
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return state;
}

interface Props {
  requests: ConsultRequest[];
  lawyers: User[];
  members: Member[];
  logs: PlatformActivityLog[];
  logsSource: 'server' | 'local';
  adOrders: AdOrder[];
}

export default function PlatformDashboard({ requests, lawyers, members, logs, logsSource, adOrders }: Props) {
  const health = useSupabaseHealth();
  const [signupView, setSignupView] = useState<'weekly' | 'monthly'>('weekly');
  const [diagCounts, setDiagCounts] = useState<{ total: number; thisMonth: number } | null | 'loading'>('loading');

  const now = new Date();
  const todayStr = localYmd(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthPrefix = todayStr.slice(0, 7);

  useEffect(() => {
    let alive = true;
    fetchDiagnosisSubmitCounts(monthStart.toISOString()).then(r => { if (alive) setDiagCounts(r); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpi = useMemo(() => {
    const valid = requests.filter(r => !isSpamBlocked(r));
    const thisMonth = valid.filter(r => (localDateOf(r.createdAt) || '').startsWith(monthPrefix)).length;
    const responded = valid.filter(r => (r.proposals || []).length > 0 || (r.acceptedLawyerIds || []).length > 0).length;
    const contracted = valid.filter(isContracted).length;
    const totalDebt = valid.reduce((acc, r) => acc + (Number(r.financialProfile?.debtTotal) || 0), 0);
    const paidAds = adOrders.filter(o => o.status === 'paid' || o.status === 'active' || o.status === 'expired');
    const adPaidTotal = paidAds.reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
    const adPaidThisMonth = paidAds
      .filter(o => (localDateOf(o.paidAt || o.activatedAt) || '').startsWith(monthPrefix))
      .reduce((s, o) => s + (Number(o.totalPrice) || 0), 0);
    return {
      validCount: valid.length,
      spamCount: requests.length - valid.length,
      thisMonth,
      responded,
      respondedRate: valid.length ? Math.round((responded / valid.length) * 100) : 0,
      contracted,
      contractRate: valid.length ? Math.round((contracted / valid.length) * 100) : 0,
      totalDebt,
      adPaidTotal,
      adPaidThisMonth,
      pendingAds: adOrders.filter(o => o.status === 'pending').length,
    };
  }, [requests, adOrders, monthPrefix]);

  const lawyerCount = lawyers.length;
  const pendingLawyers = lawyers.filter(l => l.approved === false).length;
  const todaySignups = members.filter(m => localDateOf(m.createdAt) === todayStr).length;

  // ── 노출 중 광고 (정액 광고 주문 기준) ──
  const adStatus = useMemo(() => {
    const nowMs = Date.now();
    const active = adOrders.filter(o => o.status === 'active');
    const expiringSoon = active.filter(o => {
      const t = o.expiresAt ? new Date(o.expiresAt).getTime() : NaN;
      return !Number.isNaN(t) && t >= nowMs && t - nowMs <= 30 * 86_400_000;
    }).length;
    return { active: active.length, expiringSoon };
  }, [adOrders]);

  // ── 변호사별 실적 (실제 요청·제안서 기준) ──
  const ranking = useMemo(() => {
    const valid = requests.filter(r => !isSpamBlocked(r));
    const rows = lawyers.map(l => {
      let received = 0;
      let proposed = 0;
      let contracted = 0;
      const responseHours: number[] = [];
      valid.forEach(r => {
        const related = relatedLawyerIds(r);
        const myProposals = (r.proposals || []).filter(p => p.lawyerId === l.id);
        const isRelated = related.has(l.id) || myProposals.length > 0;
        if (!isRelated) return;
        received++;
        if (myProposals.length > 0) {
          proposed++;
          const first = myProposals
            .map(p => new Date(p.createdAt).getTime())
            .filter(t => !Number.isNaN(t))
            .sort((a, b) => a - b)[0];
          const created = new Date(r.createdAt).getTime();
          if (first !== undefined && !Number.isNaN(created) && first >= created) {
            responseHours.push((first - created) / 3_600_000);
          }
        }
        const owner = r.assignedLawyerId || r.selectedLawyerId;
        if (isContracted(r) && owner === l.id) contracted++;
      });
      return {
        id: l.id,
        name: l.name,
        firm: l.firmName || '',
        approved: l.approved !== false,
        received,
        proposed,
        responseRate: received ? Math.round((proposed / received) * 100) : null,
        medianResponse: median(responseHours),
        contracted,
      };
    });
    return rows
      .filter(r => r.received > 0)
      .sort((a, b) => b.contracted - a.contracted || b.proposed - a.proposed || (a.medianResponse ?? Infinity) - (b.medianResponse ?? Infinity))
      .slice(0, 10);
  }, [requests, lawyers]);

  // ── 가입자 추이 (회원 createdAt, 로컬 날짜 기준) ──
  const signupSeries = useMemo(() => {
    if (signupView === 'weekly') {
      return [3, 2, 1, 0].map(w => {
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - w * 7 + 1);
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
        const count = members.filter(m => {
          const t = new Date(m.createdAt).getTime();
          return t >= start.getTime() && t < end.getTime();
        }).length;
        const label = w === 0 ? '최근 7일' : `${w}주 전`;
        return { label, count };
      });
    }
    return [5, 4, 3, 2, 1, 0].map(k => {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const prefix = localYmd(d).slice(0, 7);
      const count = members.filter(m => (localDateOf(m.createdAt) || '').startsWith(prefix)).length;
      return { label: `${d.getMonth() + 1}월${k === 0 ? ' (이번 달)' : ''}`, count };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, signupView, todayStr]);
  const maxSignup = Math.max(1, ...signupSeries.map(s => s.count));

  // ── 진입 카테고리별 상담 신청·계약 ──
  const categoryRows = useMemo(() => {
    const map = new Map<string, { label: string; count: number; contracted: number }>();
    requests.filter(r => !isSpamBlocked(r)).forEach(r => {
      const label = r.entryCategory?.label || '카테고리 없음(직접 신청)';
      const row = map.get(label) || { label, count: 0, contracted: 0 };
      row.count++;
      if (isContracted(r)) row.contracted++;
      map.set(label, row);
    });
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [requests]);

  // ── 가입 채널 분포 (회원 loginChannel) ──
  const channelRows = useMemo(() => {
    const labels: Record<Member['loginChannel'], string> = { naver: '네이버', kakao: '카카오', google: '구글', sms: '휴대폰 인증', email: '이메일' };
    return (Object.keys(labels) as Member['loginChannel'][]).map(ch => ({
      key: ch,
      label: labels[ch],
      count: members.filter(m => m.loginChannel === ch).length,
    }));
  }, [members]);

  const recentLogins = logs.filter(l => l.action === 'LOGIN' && (localDateOf(l.createdAt) === todayStr)).length;

  const card = 'bg-[#111622] p-4 rounded-2xl border border-[#1E293B]/60 flex items-center justify-between';
  const label = 'text-sm text-slate-400 block font-bold';

  const healthView = {
    checking: { text: '확인 중', cls: 'text-slate-300' },
    ok: { text: '정상 응답', cls: 'text-emerald-400' },
    error: { text: '응답 없음', cls: 'text-red-400' },
    not_configured: { text: '미설정', cls: 'text-amber-300' },
  }[health];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── 핵심 지표 ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className={card}>
          <div className="space-y-1">
            <span className={label}>상담 신청 (누적)</span>
            <span className="text-2xl font-black text-indigo-300">{kpi.validCount}건</span>
            <span className="text-xs text-slate-400 block">이번 달 {kpi.thisMonth}건{kpi.spamCount > 0 ? ` · 차단 ${kpi.spamCount}건 제외` : ''}</span>
          </div>
          <Users className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>진단 완료</span>
            <span className="text-2xl font-black text-violet-300">
              {diagCounts === 'loading' ? '…' : diagCounts ? `${diagCounts.total}건` : '집계 불가'}
            </span>
            <span className="text-xs text-slate-400 block">
              {diagCounts && diagCounts !== 'loading' ? `이번 달 ${diagCounts.thisMonth}건 · 서버 기록` : '서버 감사 로그 조회 필요'}
            </span>
          </div>
          <Microscope className="w-5 h-5 text-violet-400 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>변호사 응답</span>
            <span className="text-2xl font-black text-sky-300">{kpi.responded}건</span>
            <span className="text-xs text-slate-400 block">제안서·수락 1건 이상 ({kpi.respondedRate}%)</span>
          </div>
          <FileText className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>계약 체결</span>
            <span className="text-2xl font-black text-emerald-300">{kpi.contracted}건</span>
            <span className="text-xs text-slate-400 block">체결률 {kpi.contractRate}% (계약 이후 단계)</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>신청 채무 총액</span>
            <span className="text-2xl font-black text-slate-100">{formatManwon(kpi.totalDebt)}</span>
            <span className="text-xs text-slate-400 block">의뢰인 입력 기준</span>
          </div>
          <Scale className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>광고 입금 확인액</span>
            <span className="text-2xl font-black text-amber-300">{kpi.adPaidTotal.toLocaleString()}원</span>
            <span className="text-xs text-slate-400 block">이번 달 {kpi.adPaidThisMonth.toLocaleString()}원{kpi.pendingAds > 0 ? ` · 입금 대기 ${kpi.pendingAds}건` : ''}</span>
          </div>
          <Megaphone className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>등록 변호사</span>
            <span className="text-2xl font-black text-sky-300">{lawyerCount}명</span>
            <span className={`text-xs block ${pendingLawyers > 0 ? 'text-red-300 font-bold' : 'text-slate-400'}`}>승인 대기 {pendingLawyers}명</span>
          </div>
          <Briefcase className="w-5 h-5 text-sky-400 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>오늘 신규 가입</span>
            <span className="text-2xl font-black text-indigo-300">{todaySignups}명</span>
            <span className="text-xs text-slate-400 block">오늘 로그인 기록 {recentLogins}건</span>
          </div>
          <UserPlus className="w-5 h-5 text-indigo-400 shrink-0" aria-hidden="true" />
        </div>

        {/* 이전: '예상 구독료 (추정)' — 매칭 건수 구간 추정치. 구독료를 받지 않으므로 노출 중 광고 현황으로 교체 */}
        <div className={card}>
          <div className="space-y-1">
            <span className={label}>노출 중 광고</span>
            <span className="text-2xl font-black text-slate-100">{adStatus.active}건</span>
            <span className="text-xs text-slate-400 block">30일 내 만료 {adStatus.expiringSoon}건</span>
          </div>
          <CreditCard className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
        </div>

        <div className={card}>
          <div className="space-y-1">
            <span className={label}>DB·인증 서버</span>
            <span className={`text-lg font-black ${healthView.cls}`}>{healthView.text}</span>
            <span className="text-xs text-slate-400 block">1분마다 확인 · 방문자 수는 분석 도구 미연동</span>
          </div>
          <Server className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
        </div>
      </div>

      {(logsSource === 'local' || members.length === 0) && (
        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          {logsSource === 'local' ? '활동 로그는 서버에서 불러오지 못해 이 브라우저 기록만 반영했습니다. ' : ''}
          회원 수·가입 추이는 이 브라우저에 저장된 회원 목록 기준입니다(회원 서버 동기화는 3-3에서 점검).
        </p>
      )}

      {/* ── 변호사별 실적 ── */}
      <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B]/50 pb-3">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>변호사별 실적 (상위 10명)</span>
          </h3>
          <span className="text-xs text-slate-400">계약 체결 → 제안서 수 → 응답 속도 순 · 만족도는 수집 기능이 없어 표시하지 않음</span>
        </div>
        {ranking.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <Clock className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="text-sm text-slate-300">변호사에게 연결된 상담 요청이 아직 없습니다.</p>
            <p className="text-xs text-slate-400">의뢰인이 변호사를 지정하거나 변호사가 제안서를 보내면 집계됩니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-[#1E293B]/40">
                  <th scope="col" className="py-2 pr-3">순위</th>
                  <th scope="col" className="py-2 pr-3">변호사</th>
                  <th scope="col" className="py-2 pr-3 text-right">연결 요청</th>
                  <th scope="col" className="py-2 pr-3 text-right">제안서</th>
                  <th scope="col" className="py-2 pr-3 text-right">응답률</th>
                  <th scope="col" className="py-2 pr-3 text-right">첫 제안 소요(중앙값)</th>
                  <th scope="col" className="py-2 text-right">계약 체결</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/30">
                {ranking.map((r, i) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-3 font-mono text-slate-300">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-bold text-slate-100">{r.name}</span>
                      {!r.approved && <span className="ml-1.5 text-xs text-red-300">(미승인)</span>}
                      {r.firm && <span className="block text-xs text-slate-400">{r.firm}</span>}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-slate-200">{r.received}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-200">{r.proposed}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-200">{r.responseRate === null ? '—' : `${r.responseRate}%`}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-200">{formatHours(r.medianResponse)}</td>
                    <td className="py-2.5 text-right font-bold text-emerald-300">{r.contracted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-400 mt-2">
              연결 요청 = 의뢰인 지정·배정·제안서 제출 건 · 응답률 = 제안서를 보낸 비율 · 계약 체결 = 담당 변호사로 계약 이후 단계에 들어간 건
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── 가입자 추이 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1E293B]/50 pb-3 gap-2">
            <h3 className="font-bold text-base text-slate-100 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              <span>신규 가입 추이</span>
            </h3>
            <div className="flex bg-[#0B0F19] p-0.5 rounded-lg border border-[#1E293B]/60" role="group" aria-label="집계 단위">
              {(['weekly', 'monthly'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={signupView === v}
                  onClick={() => setSignupView(v)}
                  className={`text-sm font-bold px-2.5 py-1 rounded-md whitespace-nowrap transition-colors cursor-pointer ${signupView === v ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'}`}
                >
                  {v === 'weekly' ? '주별 (4주)' : '월별 (6개월)'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {signupSeries.map(s => (
              <div key={s.label} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-slate-300">{s.label}</span>
                <div className="flex-1 bg-[#0B0F19] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.round((s.count / maxSignup) * 100)}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-slate-200">{s.count}명</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 진입 카테고리별 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-4">
          <h3 className="font-bold text-base text-slate-100 border-b border-[#1E293B]/50 pb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>진입 카테고리별 상담 신청</span>
          </h3>
          {categoryRows.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">상담 신청이 아직 없습니다.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-[#1E293B]/40">
                  <th scope="col" className="pb-2">카테고리</th>
                  <th scope="col" className="pb-2 text-right">신청</th>
                  <th scope="col" className="pb-2 text-right">계약</th>
                  <th scope="col" className="pb-2 text-right">체결률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E293B]/30">
                {categoryRows.map(c => (
                  <tr key={c.label}>
                    <td className="py-2 text-slate-200">{c.label}</td>
                    <td className="py-2 text-right text-slate-200">{c.count}</td>
                    <td className="py-2 text-right text-emerald-300">{c.contracted}</td>
                    <td className="py-2 text-right text-slate-200">{Math.round((c.contracted / c.count) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-slate-400">UTM 등 광고 유입 경로는 수집하지 않아 진입 카테고리로 대신 표시합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 회원 요약 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
          <h3 className="font-bold text-base text-slate-100 border-b border-[#1E293B]/50 pb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>회원 현황</span>
          </h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              { k: '전체', v: members.length, c: 'text-slate-100' },
              { k: '정상', v: members.filter(m => m.status === 'active').length, c: 'text-emerald-300' },
              { k: '정지', v: members.filter(m => m.status === 'suspended').length, c: 'text-red-300' },
              { k: '승인 대기', v: members.filter(m => m.status === 'pending').length, c: 'text-amber-300' },
              { k: '휴면', v: members.filter(m => m.status === 'dormant').length, c: 'text-slate-200' },
              { k: '탈퇴', v: members.filter(m => m.status === 'withdrawn').length, c: 'text-slate-200' },
            ].map(x => (
              <div key={x.k} className="bg-[#07090E]/60 p-3 rounded-xl border border-[#1E293B]/30">
                <dt className="text-slate-400 font-bold">{x.k}</dt>
                <dd className={`text-lg font-black ${x.c}`}>{x.v}명</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── 가입 채널 ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
          <h3 className="font-bold text-base text-slate-100 border-b border-[#1E293B]/50 pb-3">가입 채널</h3>
          <div className="space-y-2">
            {channelRows.map(ch => (
              <div key={ch.key} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-slate-300">{ch.label}</span>
                <div className="flex-1 bg-[#0B0F19] h-2 rounded-full overflow-hidden">
                  <div className="bg-sky-500 h-full rounded-full" style={{ width: `${members.length ? Math.round((ch.count / members.length) * 100) : 0}%` }} />
                </div>
                <span className="w-10 text-right font-mono text-slate-200">{ch.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 과금 정책 (정적 안내) ── */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B]/60 space-y-3">
          <h3 className="font-bold text-base text-slate-100 border-b border-[#1E293B]/50 pb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>과금 정책 (변호사법 제34조 관련)</span>
          </h3>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed list-disc pl-4">
            <li>사건 성사·수임 건별 소개 수수료는 받지 않습니다.</li>
            <li>수익은 변호사가 내는 정액 광고료뿐입니다. 수임료는 의뢰인이 사무소에 직접 납부합니다.</li>
            <li>의뢰인이 변호사를 직접 선택합니다.</li>
          </ul>
          <p className="text-xs text-slate-400">운영 정책 안내이며 자동 점검 결과가 아닙니다. 법적 판단은 전문가 검토가 필요합니다.</p>
        </div>
      </div>
    </div>
  );
}
