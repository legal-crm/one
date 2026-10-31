// 통합어드민 › SEO·GEO › 'SNS 채널·유입' (M0-a·M-6)
// 운영 중인 SNS 채널만 켜 두면 다음 배포 때 index.html·about.html의 sameAs에 들어간다(빌드가 서버 설정을 읽음).
// 채널별 상담 요청 수는 상담 요청의 첫 유입 경로(UTM·참조 도메인)로 센다. 건수만, 개인정보 없음.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Share2, BarChart3, RefreshCw } from 'lucide-react';
import {
  SOCIAL_CHANNELS, SOCIAL_URL_RULES, loadChannelInflow, loadSocialChannels, saveSocialChannels,
  type ChannelInflowRow, type SocialChannel, type SocialChannelId,
} from '../../../services/marketing/seoAdminService';

const card = 'bg-[#111622] rounded-2xl border border-slate-800 p-5 md:p-6';
const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export default function SocialChannelsPanel() {
  const [rows, setRows] = useState<Record<SocialChannelId, SocialChannel> | null>(null);
  const [errors, setErrors] = useState<Partial<Record<SocialChannelId, string>>>({});
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [inflow, setInflow] = useState<ChannelInflowRow[] | null>(null);
  const [inflowError, setInflowError] = useState('');

  const load = useCallback(async () => {
    const r = await loadSocialChannels();
    if (!r.ok) { setLoadError(r.message); return; }
    setLoadError('');
    const base = Object.fromEntries(SOCIAL_CHANNELS.map(c => [c.channel, { channel: c.channel, url: '', active: false }])) as Record<SocialChannelId, SocialChannel>;
    for (const s of r.data) if (base[s.channel]) base[s.channel] = { ...base[s.channel], ...s };
    setRows(base);
  }, []);

  const loadInflow = useCallback(async () => {
    const r = await loadChannelInflow(from, to);
    if (!r.ok) { setInflowError(r.message); setInflow([]); return; }
    setInflowError('');
    setInflow(r.data);
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadInflow(); }, [loadInflow]);

  const save = async () => {
    if (!rows) return;
    const errs: Partial<Record<SocialChannelId, string>> = {};
    for (const c of Object.values(rows)) {
      const url = c.url.trim();
      if (c.active && !url) errs[c.channel] = '운영 중으로 켜려면 주소가 필요해요.';
      else if (url && !SOCIAL_URL_RULES[c.channel].test(url)) errs[c.channel] = '이 채널의 https 주소 형식이 아니에요.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    const res = await saveSocialChannels(Object.values(rows).map(c => ({ ...c, url: c.url.trim() })));
    setSaving(false);
    if (!res.ok) { toast.error(res.message); return; }
    toast.success('저장했어요. 다음 배포 때 sameAs에 반영돼요.');
  };

  const total = (inflow || []).reduce((s, r) => s + r.requests, 0);

  return (
    <div className="space-y-6">
      <section className={card}>
        <h3 className="flex items-center gap-2 text-base font-bold text-white"><Share2 className="w-4 h-4 text-indigo-400" aria-hidden="true" />운영 중인 SNS 채널</h3>
        <p className="mt-1 text-xs text-slate-400">실제로 개설해 운영하는 채널만 켜 주세요. 켠 채널 주소는 검색엔진·AI가 같은 회사로 묶어 보도록 사이트 구조화 데이터(sameAs)에 들어가요. 핸들은 @mykim.kr(안 되면 @mykim_kr)로 맞춰요.</p>
        {loadError ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button type="button" onClick={() => void load()} className="min-h-10 px-4 rounded-xl bg-slate-800 text-slate-100 text-xs font-bold whitespace-nowrap active:scale-[0.98]">다시 불러오기</button>
          </div>
        ) : !rows ? (
          <div className="mt-4 space-y-2" aria-busy="true">{[0, 1, 2, 3].map(i => <div key={i} className="h-11 rounded-xl bg-slate-800/70 animate-pulse" />)}</div>
        ) : (
          <div className="mt-4 space-y-2">
            {SOCIAL_CHANNELS.map(def => {
              const r = rows[def.channel];
              return (
                <div key={def.channel} className="grid grid-cols-1 md:grid-cols-[150px_1fr_auto] gap-2 items-center">
                  <span className="text-sm font-bold text-slate-200">{def.label}</span>
                  <div>
                    <input
                      value={r.url}
                      onChange={e => setRows(prev => (prev ? { ...prev, [def.channel]: { ...prev[def.channel], url: e.target.value } } : prev))}
                      placeholder={def.hint}
                      aria-label={`${def.label} 주소`}
                      className="w-full min-h-10 rounded-xl bg-[#0B0F19] border border-slate-700 px-3 text-sm text-slate-200"
                    />
                    {errors[def.channel] && <p className="mt-1 text-xs text-rose-300">{errors[def.channel]}</p>}
                  </div>
                  <label className="flex items-center gap-2 min-h-10 text-xs font-bold text-slate-300 whitespace-nowrap">
                    <input type="checkbox" checked={r.active} onChange={e => setRows(prev => (prev ? { ...prev, [def.channel]: { ...prev[def.channel], active: e.target.checked } } : prev))} className="w-4 h-4" />
                    운영 중
                  </label>
                </div>
              );
            })}
            <div className="pt-2 flex justify-end">
              <button type="button" disabled={saving} onClick={() => void save()} className="min-h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-60 whitespace-nowrap active:scale-[0.98]">채널 저장</button>
            </div>
          </div>
        )}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-white"><BarChart3 className="w-4 h-4 text-indigo-400" aria-hidden="true" />채널별 상담 요청 수</h3>
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="시작일" className="min-h-10 rounded-xl bg-[#0B0F19] border border-slate-700 px-2" />
            <span>~</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="끝날" className="min-h-10 rounded-xl bg-[#0B0F19] border border-slate-700 px-2" />
            <button type="button" onClick={() => void loadInflow()} aria-label="새로고침" className="min-h-10 px-3 rounded-xl bg-slate-800 text-slate-200 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">상담 요청을 만든 의뢰인이 처음 들어온 경로(게시물 링크의 UTM, 또는 참조 사이트)로 셉니다. 2026-11 이후 요청부터 기록돼요.</p>
        {inflowError ? (
          <p className="mt-3 text-sm text-rose-300">{inflowError}</p>
        ) : inflow === null ? (
          <div className="mt-3 h-24 rounded-xl bg-slate-800/70 animate-pulse" aria-busy="true" />
        ) : inflow.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">이 기간에 상담 요청이 없어요.</p>
        ) : (
          <table className="mt-3 w-full text-sm text-left">
            <thead><tr className="text-xs text-slate-400 border-b border-slate-800"><th className="py-2">출처</th><th className="py-2">매체</th><th className="py-2 text-right">상담 요청</th><th className="py-2 text-right">비율</th></tr></thead>
            <tbody>
              {inflow.map(r => (
                <tr key={`${r.source}|${r.medium}`} className="border-b border-slate-800/60 text-slate-200">
                  <td className="py-2">{r.source}</td>
                  <td className="py-2 text-slate-400">{r.medium || '-'}</td>
                  <td className="py-2 text-right font-mono">{r.requests}</td>
                  <td className="py-2 text-right font-mono text-slate-400">{total ? Math.round((r.requests / total) * 100) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
