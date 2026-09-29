/**
 * 365일 캘린더 · 성과 분석 · AI 키 상태 — 모두 서버(DB) 실데이터만 표시한다.
 * (이전 버전의 고정 수치 124건·99.2%·조회수 12.4k 등은 제거)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, BarChart3, KeyRound, RefreshCcw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { autopilotApi, AutopilotStatus, CampaignSummary, ChannelId, ChannelPost, explainAutopilotError } from '../../../services/marketingAutopilotService';

const CH: { id: ChannelId; name: string; dot: string }[] = [
  { id: 'blog', name: '블로그', dot: 'bg-emerald-400' },
  { id: 'threads', name: '스레드', dot: 'bg-slate-200' },
  { id: 'facebook', name: '페이스북', dot: 'bg-blue-400' },
  { id: 'cardnews', name: '인스타', dot: 'bg-pink-400' },
  { id: 'shorts', name: '쇼츠', dot: 'bg-red-400' },
  { id: 'tiktok', name: '틱톡', dot: 'bg-cyan-400' },
];
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const card = 'bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6';

function ErrorCard({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className={`${card} border-red-500/30 space-y-3`} role="alert">
      <p className="text-sm text-slate-200 flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" />{msg}</p>
      <button type="button" onClick={onRetry} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold flex items-center gap-2 press-scale"><RefreshCcw size={16} />다시 시도</button>
    </div>
  );
}

const kstMonth = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7);
const kstDate = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// ─── 캘린더 ───
export function AutopilotCalendar({ onOpenDate }: { onOpenDate: (date: string) => void }) {
  const [month, setMonth] = useState(kstMonth());
  const [rows, setRows] = useState<CampaignSummary[] | null>(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setRows(null); setErr('');
    autopilotApi.list(month).then(r => { if (alive) setRows(r.campaigns); }).catch(e => { if (alive) setErr(explainAutopilotError(e)); });
    return () => { alive = false; };
  }, [month, tick]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = kstDate();
  const byDate = useMemo(() => new Map((rows || []).map(r => [r.campaign_date, r])), [rows]);
  const shift = (d: number) => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); setMonth(dt.toISOString().slice(0, 7)); };

  const published = (rows || []).reduce((n, r) => n + r.posts.filter(p => p.publish_status.startsWith('published')).length, 0);
  const approved = (rows || []).filter(r => r.status === 'approved' || r.status === 'published').length;

  if (err) return <ErrorCard msg={err} onRetry={() => setTick(t => t + 1)} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['생성된 캠페인', rows ? rows.length : null, '일'],
          ['승인', rows ? approved : null, '일'],
          ['채널 게시 기록', rows ? published : null, '건'],
          ['목표 대비', rows ? `${published}/${daysIn * 6}` : null, ''],
        ].map(([label, v, unit]) => (
          <div key={label as string} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4">
            <div className="text-slate-400 text-xs mb-1">{label}</div>
            {v === null ? <div className="h-7 w-16 rounded bg-slate-800 animate-pulse" /> : <div className="text-2xl font-bold text-white">{v}<span className="text-sm font-normal text-slate-400 ml-1">{unit}</span></div>}
          </div>
        ))}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between mb-6">
          <button type="button" onClick={() => shift(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white" aria-label="이전 달"><ChevronLeft size={20} /></button>
          <h3 className="text-xl font-bold text-white">{y}년 {m}월</h3>
          <button type="button" onClick={() => shift(1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white" aria-label="다음 달"><ChevronRight size={20} /></button>
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-800 rounded-xl overflow-hidden border border-slate-800">
          {DAYS.map(d => <div key={d} className="bg-[#111622] py-3 text-center text-xs font-medium text-slate-400">{d}</div>)}
          {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} className="bg-[#0B0F19] min-h-[96px]" />)}
          {Array.from({ length: daysIn }).map((_, i) => {
            const day = i + 1;
            const date = `${month}-${String(day).padStart(2, '0')}`;
            const r = byDate.get(date);
            const isToday = date === today;
            return (
              <button key={date} type="button" onClick={() => onOpenDate(date)} disabled={date > today && !r}
                className="bg-[#0B0F19] min-h-[96px] p-2 text-left hover:bg-[#111622] transition-colors disabled:cursor-default disabled:hover:bg-[#0B0F19] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                aria-label={`${m}월 ${day}일${r ? ` 캠페인 ${r.status}` : ''}`}>
                <span className={`text-xs font-medium w-6 h-6 inline-flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}>{day}</span>
                {rows === null && <div className="mt-2 h-2 w-12 rounded bg-slate-800 animate-pulse" />}
                {r && (
                  <div className="mt-1 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {CH.map(c => {
                        const posted = r.posts.some(p => p.channel === c.id && p.publish_status.startsWith('published'));
                        return <span key={c.id} className={`w-2 h-2 rounded-full ${posted ? c.dot : 'bg-slate-700'}`} title={`${c.name}${posted ? ' 게시됨' : ' 미게시'}`} />;
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">{r.news_title}</p>
                    <p className={`text-[10px] ${r.status === 'rejected' ? 'text-red-300' : r.status === 'ready' ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {{ ready: '검토 대기', approved: '승인', rejected: '반려', published: '게시' }[r.status]} · {r.compliance_score}점
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400 justify-end">
          {CH.map(c => <span key={c.id} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${c.dot}`} />{c.name}</span>)}
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-700" />미게시</span>
        </div>
        {rows && rows.length === 0 && (
          <p className="mt-4 text-sm text-slate-400 text-center">이 달에는 캠페인이 없습니다. 날짜를 누르면 그날 캠페인을 만들 수 있습니다 (크론 설정 시 매일 07:30 자동 생성).</p>
        )}
      </div>
    </div>
  );
}

// ─── 성과 분석 ───
export function AutopilotAnalytics() {
  const [data, setData] = useState<{ since: string; campaigns: CampaignSummary[]; posts: ChannelPost[] } | null>(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setData(null); setErr('');
    autopilotApi.stats().then(r => { if (alive) setData(r); }).catch(e => { if (alive) setErr(explainAutopilotError(e)); });
    return () => { alive = false; };
  }, [tick]);

  if (err) return <ErrorCard msg={err} onRetry={() => setTick(t => t + 1)} />;
  if (!data) {
    return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">{CH.map(c => <div key={c.id} className="h-28 rounded-2xl bg-[#111622] border border-[#1E293B]/60 animate-pulse" />)}</div>;
  }

  const ok = data.posts.filter(p => p.publish_status.startsWith('published'));
  const failed = data.posts.filter(p => p.publish_status === 'failed');
  const avg = data.campaigns.length ? Math.round(data.campaigns.reduce((s, c) => s + (c.compliance_score || 0), 0) / data.campaigns.length) : 0;
  const byTheme = data.campaigns.reduce<Record<string, number>>((m, c) => { m[c.day_theme_code] = (m[c.day_theme_code] || 0) + 1; return m; }, {});
  const maxTheme = Math.max(1, ...Object.values(byTheme));

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-400">최근 90일({data.since}~) 기준. 조회수·전환 같은 채널 성과는 각 플랫폼 통계(유튜브 스튜디오, Meta 인사이트, 네이버 블로그 통계)에서 확인하세요. 이 화면은 추정치를 만들지 않습니다.</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {CH.map(c => (
          <div key={c.id} className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-4">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} />
            <div className="text-2xl font-bold text-white mt-2">{ok.filter(p => p.channel === c.id).length}</div>
            <div className="text-xs text-slate-400">{c.name} 게시</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${card} space-y-2`}>
          <h3 className="font-bold text-white flex items-center gap-2"><BarChart3 size={18} className="text-indigo-400" />운영 지표</h3>
          <dl className="text-sm divide-y divide-slate-800">
            {[['생성된 캠페인', `${data.campaigns.length}일`], ['승인·게시된 캠페인', `${data.campaigns.filter(c => c.status === 'approved' || c.status === 'published').length}일`], ['평균 규칙 검사 점수', data.campaigns.length ? `${avg}점` : '—'], ['게시 실패', `${failed.length}건`]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2"><dt className="text-slate-400">{k}</dt><dd className="text-white font-medium">{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className={`${card} lg:col-span-2 space-y-3`}>
          <h3 className="font-bold text-white flex items-center gap-2"><CalendarDays size={18} className="text-indigo-400" />요일 테마별 캠페인 수</h3>
          {Object.keys(byTheme).length === 0 ? (
            <p className="text-sm text-slate-400">아직 캠페인이 없습니다. "오늘의 오토파일럿"에서 첫 캠페인을 만들어 보세요.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(byTheme).map(([code, n]) => (
                <li key={code} className="flex items-center gap-3 text-sm">
                  <span className="w-36 text-slate-300 truncate">{code}</span>
                  <span className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden"><span className="block h-full bg-indigo-500" style={{ width: `${(n / maxTheme) * 100}%` }} /></span>
                  <span className="w-8 text-right text-slate-200">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI 키·연동 상태 ───
export function AutopilotKeyStatus() {
  const [st, setSt] = useState<AutopilotStatus['status'] | null>(null);
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setSt(null); setErr('');
    autopilotApi.status().then(r => { if (alive) setSt(r.status); }).catch(e => { if (alive) setErr(explainAutopilotError(e)); });
    return () => { alive = false; };
  }, [tick]);

  if (err) return <ErrorCard msg={err} onRetry={() => setTick(t => t + 1)} />;
  const Yes = ({ ok }: { ok: boolean }) => ok ? <CheckCircle size={16} className="text-emerald-400" aria-label="설정됨" /> : <XCircle size={16} className="text-slate-500" aria-label="미설정" />;

  return (
    <div className={`${card} space-y-4`}>
      <h3 className="font-bold text-white flex items-center gap-2"><KeyRound size={18} className="text-indigo-400" />오토파일럿 역할별 AI 키·연동 상태</h3>
      {!st ? <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-4 rounded bg-slate-800 animate-pulse" />)}</div> : (
        <>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-400 text-xs"><th className="py-2 font-medium">역할</th><th className="font-medium">환경변수</th><th className="font-medium">상태</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {st.roles.map(r => (
                <tr key={r.role}>
                  <td className="py-2 text-slate-200">{r.label}</td>
                  <td className="font-mono text-xs text-slate-300">{r.env}</td>
                  <td className="text-xs">{r.dedicated ? <span className="text-emerald-300">전용 키</span> : r.configured ? <span className="text-slate-300">공통 키 사용</span> : <span className="text-red-300">없음</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 text-sm">
            <div className="flex justify-between py-1.5"><dt className="text-slate-400">텍스트 모델 순서</dt><dd className="text-slate-200 text-xs font-mono text-right">{st.textModels.join(' → ')}</dd></div>
            <div className="flex justify-between py-1.5"><dt className="text-slate-400">이미지 모델</dt><dd className="text-slate-200 text-xs font-mono text-right">{st.imageModels.join(' → ')}</dd></div>
            <div className="flex justify-between py-1.5"><dt className="text-slate-400">음성(TTS) 모델</dt><dd className="text-slate-200 text-xs font-mono text-right">{st.ttsModels.join(' → ')}</dd></div>
            <div className="flex justify-between items-center py-1.5"><dt className="text-slate-400">매일 아침 자동 생성 (CRON_SECRET)</dt><dd><Yes ok={st.cron} /></dd></div>
            <div className="flex justify-between items-center py-1.5"><dt className="text-slate-400">네이버 뉴스 API</dt><dd><Yes ok={st.newsProviders.naver} /></dd></div>
            <div className="flex justify-between items-center py-1.5"><dt className="text-slate-400">스레드 자동 게시</dt><dd><Yes ok={st.publishers.threads} /></dd></div>
            <div className="flex justify-between items-center py-1.5"><dt className="text-slate-400">페이스북 페이지 자동 게시</dt><dd><Yes ok={st.publishers.facebook} /></dd></div>
          </dl>
          <p className="text-xs text-slate-400 leading-relaxed">
            키 값은 브라우저로 보내지 않습니다. 역할별 전용 키는 비용·사용량을 역할별로 나눠 보기 위한 선택 사항이며, 한 키가 한도(429)에 걸리면 같은 키로 다음 모델을 시도합니다.
            여러 계정을 돌려 무료 한도를 늘리는 방식은 Gemini API 약관상 제한을 우회하는 행위로 볼 수 있어 쓰지 않습니다. 사용량이 많으면 유료 등급(결제 연결된 1개 프로젝트)을 권장합니다.
          </p>
        </>
      )}
    </div>
  );
}
