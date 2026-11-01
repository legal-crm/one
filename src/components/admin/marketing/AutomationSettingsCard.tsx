// 마케팅 오토파일럿 › 자동화 설정 (M-1)
// 자동화 수준(L1/L2)·규정 검사 모드(엄격/권고)·자동 승인 점수·자동 게시 채널, 긴급 정지(L1로 바꾸기)
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Gauge, OctagonX, RefreshCcw } from 'lucide-react';
import {
  loadMarketingAutomation, saveMarketingAutomation,
  type AutoChannel, type AutomationLevel, type CheckMode, type MarketingAutomation,
} from '../../../services/marketing/automationService';

const CHANNEL_INFO: { id: AutoChannel; label: string; time: string }[] = [
  { id: 'threads', label: '스레드', time: '12:30' },
  { id: 'facebook', label: '페이스북 페이지', time: '14:00' },
];

const radioCard = (on: boolean) =>
  `flex-1 min-h-[44px] text-left rounded-xl border px-4 py-3 transition-colors cursor-pointer active:scale-[0.98] ${on ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-[#0B0F19] hover:bg-white/5'}`;

export default function AutomationSettingsCard({ publishers }: { publishers?: Partial<Record<AutoChannel, boolean>> }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState<MarketingAutomation | null>(null);
  const [form, setForm] = useState<MarketingAutomation | null>(null);
  const [scoreText, setScoreText] = useState('90');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setState('loading');
    const r = await loadMarketingAutomation();
    if (r.ok === false) { setLoadError(r.message); setState('error'); return; }
    setSaved(r.data); setForm(r.data); setScoreText(String(r.data.minScore)); setState('ready');
  };
  useEffect(() => { void load(); }, []);

  const persist = async (next: MarketingAutomation, done: string) => {
    setBusy(true);
    setError('');
    const r = await saveMarketingAutomation(next);
    setBusy(false);
    if (r.ok === false) { setError(r.message); return; }
    setSaved(r.data); setForm(r.data); setScoreText(String(r.data.minScore));
    toast.success(done);
  };

  if (state === 'loading') {
    return (
      <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 space-y-3" aria-busy="true">
        <div className="h-5 w-40 rounded bg-slate-800 animate-pulse" />
        <div className="h-16 rounded-xl bg-slate-800 animate-pulse" />
        <div className="h-16 rounded-xl bg-slate-800 animate-pulse" />
      </section>
    );
  }
  if (state === 'error' || !form || !saved) {
    return (
      <section className="bg-[#111622] rounded-2xl border border-red-500/30 p-6 space-y-3" role="alert">
        <h3 className="text-white font-bold flex items-center gap-2"><AlertTriangle size={18} className="text-red-400" />자동화 설정을 읽지 못했어요</h3>
        <p className="text-sm text-slate-300">{loadError || '잠시 후 다시 시도해 주세요.'} 설정을 읽지 못하는 동안 서버는 자동 승인·자동 게시를 하지 않아요(L1처럼 동작).</p>
        <button type="button" onClick={() => void load()} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap active:scale-[0.98]">
          <RefreshCcw size={16} />다시 불러오기
        </button>
      </section>
    );
  }

  const set = <K extends keyof MarketingAutomation>(k: K, v: MarketingAutomation[K]) => setForm(f => (f ? { ...f, [k]: v } : f));
  // 순서를 서버 정리 순서(스레드 → 페이스북)와 같게 유지해 '바뀐 내용' 판단이 흔들리지 않게 한다
  const toggleChannel = (ch: AutoChannel) =>
    set('autoChannels', CHANNEL_INFO.map(c => c.id).filter(id => (id === ch ? !form.autoChannels.includes(ch) : form.autoChannels.includes(id))));
  const dirty = JSON.stringify({ ...form, minScore: Number(scoreText) }) !== JSON.stringify(saved);

  const save = () => {
    const n = Number(scoreText);
    if (!/^\d{2,3}$/.test(scoreText.trim()) || n < 70 || n > 100) { setError('자동 승인 점수는 70~100점으로 정해 주세요.'); return; }
    void persist({ ...form, minScore: n }, '자동화 설정을 저장했어요. 조치 기록에 남았어요.');
  };
  const emergencyStop = () => void persist({ ...saved, level: 'L1' }, '긴급 정지했어요. 자동 승인·자동 게시를 멈췄어요(L1).');

  const LEVELS: { id: AutomationLevel; title: string; desc: string }[] = [
    { id: 'L1', title: 'L1 초안만', desc: '매일 아침 초안만 만들어요. 승인·게시는 사람이 해요.' },
    { id: 'L2', title: 'L2 검사 통과분 자동 (기본)', desc: `고위험·수정 권고 표시가 없고 점수가 기준 이상인 아침 초안은 자동 승인하고, 표시 없는 API 채널은 시간표에 맞춰 자동 게시해요.` },
  ];
  const MODES: { id: CheckMode; title: string; desc: string }[] = [
    { id: 'strict', title: '엄격 (기본)', desc: '고위험 표현이 남아 있으면 승인할 수 없어요.' },
    { id: 'advisory', title: '권고', desc: '고위험 표현이 남아도 사유를 적으면 승인할 수 있어요. 사유는 조치 기록에 남아요. 고위험 채널은 자동 게시하지 않아요.' },
  ];

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-6 space-y-5" aria-labelledby="mk-automation-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="mk-automation-title" className="text-lg font-bold text-white flex items-center gap-2"><Gauge size={18} className="text-indigo-400" />자동화 수준</h3>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed break-keep">
            아침 07시대 초안 생성 → (L2) 검사 통과분 자동 승인 → 12:35 스레드 · 14:05 페이스북 자동 게시. 반려한 캠페인, 고친 뒤 다시 승인하지 않은 캠페인, 표시가 남은 채널은 올리지 않아요.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            지금 저장된 값: {saved.level} · {saved.checkMode === 'strict' ? '엄격' : '권고'} · {saved.minScore}점
            {saved.updatedAt ? ` · 마지막 저장 ${new Date(saved.updatedAt).toLocaleString('ko-KR')}` : ' · 아직 저장한 적 없음(기본값)'}
          </p>
        </div>
        <button
          type="button"
          onClick={emergencyStop}
          disabled={busy || saved.level === 'L1'}
          className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          <OctagonX size={16} />{saved.level === 'L1' ? '자동 동작 꺼짐' : '긴급 정지'}
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-200 mb-2">자동화 수준</legend>
        <div className="flex flex-col md:flex-row gap-2">
          {LEVELS.map(l => (
            <label key={l.id} className={radioCard(form.level === l.id)}>
              <input type="radio" name="mk-level" className="sr-only" checked={form.level === l.id} onChange={() => set('level', l.id)} />
              <span className="block text-sm font-bold text-white">{l.title}</span>
              <span className="block text-xs text-slate-300 mt-1 leading-relaxed break-keep">{l.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-200 mb-2">규정 검사 모드</legend>
        <div className="flex flex-col md:flex-row gap-2">
          {MODES.map(m => (
            <label key={m.id} className={radioCard(form.checkMode === m.id)}>
              <input type="radio" name="mk-mode" className="sr-only" checked={form.checkMode === m.id} onChange={() => set('checkMode', m.id)} />
              <span className="block text-sm font-bold text-white">{m.title}</span>
              <span className="block text-xs text-slate-300 mt-1 leading-relaxed break-keep">{m.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-bold text-slate-200">자동 승인 최소 점수 (70~100)</span>
          <input
            type="text"
            inputMode="numeric"
            value={scoreText}
            onChange={e => setScoreText(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
            aria-describedby="mk-score-help"
            className="w-full min-h-[44px] bg-[#0B0F19] border border-slate-700 rounded-xl px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span id="mk-score-help" className="block text-xs text-slate-400">점수는 100점에서 고위험 20·수정 권고 8·참고 3점씩 빼요. 수정 권고가 1건이라도 있으면 점수와 상관없이 자동 승인하지 않아요.</span>
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-slate-200 mb-1.5">자동 게시 채널</legend>
          {CHANNEL_INFO.map(c => {
            const connected = publishers?.[c.id];
            return (
              <label key={c.id} className="flex items-center gap-3 min-h-[44px] rounded-xl border border-slate-700 bg-[#0B0F19] px-3 cursor-pointer hover:bg-white/5">
                <input type="checkbox" className="w-4 h-4 accent-indigo-500" checked={form.autoChannels.includes(c.id)} onChange={() => toggleChannel(c.id)} />
                <span className="flex-1 text-sm text-slate-100">{c.label} <span className="text-slate-400">· {c.time}</span></span>
                {connected === undefined ? null : connected
                  ? <span className="text-xs text-emerald-300">연결됨</span>
                  : <span className="text-xs text-amber-200">서버 키 없음 · 켜 두어도 올리지 않아요</span>}
              </label>
            );
          })}
          <p className="text-xs text-slate-400">네이버 블로그·인스타그램·쇼츠·틱톡은 공식 게시 방법이 정해지기 전까지 직접 게시 후 주소를 기록해요.</p>
        </fieldset>
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-300">{error}</p>}
      <div className="flex justify-end gap-2">
        {dirty && (
          <button type="button" onClick={() => { setForm(saved); setScoreText(String(saved.minScore)); setError(''); }} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-bold whitespace-nowrap active:scale-[0.98]">
            되돌리기
          </button>
        )}
        <button type="button" onClick={save} disabled={busy || !dirty} className="min-h-[44px] px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
          {busy ? '저장 중…' : '설정 저장'}
        </button>
      </div>
    </section>
  );
}
