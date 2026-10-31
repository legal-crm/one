import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, Plus, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import {
  DEBT_PROGRAM_ORDER, DEBT_PROGRAMS_CONFIG_ID, baseDebtProgram, loadDebtProgramOverrides,
  type DebtProgram, type DebtProgramOverrides, type SolutionType,
} from '../client/debtPrograms';
import { findProhibitedExpressions } from '../../services/proposalCompliance';

/**
 * 제도 안내 (NF-1) — 고객 홈 '제도별로 보기'·제도 상세 창·정리 확인 화면·정적 /guide/debt-programs 가 같이 읽는다.
 * 원본은 코드(src/content/debtProgramsData.js). 여기서 고친 값은 platform_config 'debt_programs'에 덮어쓰기로 저장한다.
 * 판단·추천 문장 없이 일반 정보·공식 연락처·확인일만 적는다. 정적 페이지는 다음 배포(빌드) 때 반영된다.
 */
type Link = DebtProgram['links'][number];
interface Draft { summary: string; keyPoints: string[]; links: Link[]; checkedOn: string; hidden: boolean }

const toDraft = (k: SolutionType, o?: DebtProgramOverrides[SolutionType]): Draft => {
  const b = baseDebtProgram(k);
  return {
    summary: o?.summary || b.summary,
    keyPoints: o?.keyPoints?.length ? [...o.keyPoints] : [...b.keyPoints],
    links: o?.links?.length ? o.links.map(l => ({ ...l })) : b.links.map(l => ({ ...l })),
    checkedOn: o?.checkedOn || b.checkedOn,
    hidden: !!o?.hidden,
  };
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const inputCls = 'w-full min-h-[44px] rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-white';

export default function DebtProgramsPanel() {
  const [drafts, setDrafts] = useState<Record<SolutionType, Draft> | null>(null);
  const [sel, setSel] = useState<SolutionType>('rehab');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('platform_config').select('data').eq('id', DEBT_PROGRAMS_CONFIG_ID).maybeSingle();
      if (error) setErr(`저장된 값을 못 읽었어요: ${error.message}`);
      const o = ((data?.data as any)?.programs || {}) as DebtProgramOverrides;
      setDrafts(Object.fromEntries(DEBT_PROGRAM_ORDER.map(k => [k, toDraft(k, o[k])])) as Record<SolutionType, Draft>);
    })();
  }, []);

  if (!drafts) return <div className="h-40 rounded-2xl bg-white/5 animate-pulse" aria-busy="true" />;

  const d = drafts[sel];
  const base = baseDebtProgram(sel);
  const put = (patch: Partial<Draft>) => setDrafts(prev => prev && ({ ...prev, [sel]: { ...prev[sel], ...patch } }));
  const fixedVisible = sel === 'rehab' || sel === 'bankruptcy';
  const hits = findProhibitedExpressions([d.summary, ...d.keyPoints].join(' '));

  const save = async () => {
    setErr(null);
    const programs: DebtProgramOverrides = {};
    for (const k of DEBT_PROGRAM_ORDER) {
      const x = drafts[k]; const b = baseDebtProgram(k);
      const points = x.keyPoints.map(s => s.trim()).filter(Boolean);
      const links = x.links.map(l => ({ label: l.label.trim(), ...(l.url?.trim() ? { url: l.url.trim() } : {}), ...(l.phone?.trim() ? { phone: l.phone.trim() } : {}) })).filter(l => l.label);
      if (!x.summary.trim()) { setErr(`'${b.title}' 요약이 비어 있어요.`); setSel(k); return; }
      if (links.some(l => l.url && !/^https:\/\//.test(l.url))) { setErr(`'${b.title}' 연락처 주소는 https:// 로 시작해야 해요.`); setSel(k); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.checkedOn)) { setErr(`'${b.title}' 확인일을 정해 주세요.`); setSel(k); return; }
      const o: NonNullable<DebtProgramOverrides[SolutionType]> = {};
      if (x.summary.trim() !== b.summary) o.summary = x.summary.trim();
      if (!same(points, b.keyPoints)) o.keyPoints = points;
      if (!same(links, b.links)) o.links = links;
      if (x.checkedOn !== b.checkedOn) o.checkedOn = x.checkedOn;
      if (x.hidden && k !== 'rehab' && k !== 'bankruptcy') o.hidden = true;
      if (Object.keys(o).length) programs[k] = o;
    }
    setBusy(true);
    const { error } = await supabase.from('platform_config').upsert(
      { id: DEBT_PROGRAMS_CONFIG_ID, data: { programs }, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    setBusy(false);
    if (error) { setErr(`저장하지 못했어요: ${error.message}`); return; }
    await loadDebtProgramOverrides(true);
    toast.success('저장했어요. 고객 화면은 바로, 정적 안내 페이지는 다음 배포 때 바뀌어요.');
  };

  return (
    <section className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 space-y-4" aria-labelledby="debt-programs-title">
      <div>
        <h2 id="debt-programs-title" className="text-base font-extrabold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4" aria-hidden="true" /> 제도 안내
        </h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          고객 홈 '제도별로 보기'와 /guide/debt-programs 안내 페이지에 나오는 일반 정보예요. 추천·판단 문장 없이 공식 안내와 대조한 내용만 적고, 고치면 확인일도 바꿔 주세요.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="제도 고르기">
        {DEBT_PROGRAM_ORDER.map(k => (
          <button key={k} type="button" role="tab" aria-selected={sel === k} onClick={() => setSel(k)}
            className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold whitespace-nowrap active:scale-[0.98] ${sel === k ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100' : 'border-[#1E293B] text-slate-300'} ${drafts[k].hidden ? 'opacity-60' : ''}`}>
            {baseDebtProgram(k).title}{drafts[k].hidden ? ' (숨김)' : ''}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-300">요약</span>
          <textarea rows={3} value={d.summary} maxLength={400} onChange={e => put({ summary: e.target.value })}
            className={`${inputCls} py-2 leading-relaxed`} />
        </label>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-slate-300">알아 둘 점</legend>
          {d.keyPoints.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input value={p} maxLength={200} onChange={e => put({ keyPoints: d.keyPoints.map((x, j) => j === i ? e.target.value : x) })}
                className={inputCls} aria-label={`알아 둘 점 ${i + 1}`} />
              <button type="button" onClick={() => put({ keyPoints: d.keyPoints.filter((_, j) => j !== i) })}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-[#1E293B] text-slate-300 flex items-center justify-center active:scale-[0.98]" aria-label={`알아 둘 점 ${i + 1} 지우기`}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {d.keyPoints.length < 6 && (
            <button type="button" onClick={() => put({ keyPoints: [...d.keyPoints, ''] })}
              className="min-h-[44px] px-3 rounded-xl border border-dashed border-[#1E293B] text-xs font-bold text-slate-300 flex items-center gap-1 whitespace-nowrap active:scale-[0.98]">
              <Plus className="w-4 h-4" aria-hidden="true" /> 한 줄 더하기
            </button>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-bold text-slate-300">공식 연락처</legend>
          {d.links.map((l, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_1.4fr_auto] gap-2">
              <input value={l.label} placeholder="기관 이름" onChange={e => put({ links: d.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} className={inputCls} aria-label={`연락처 ${i + 1} 이름`} />
              <input value={l.phone || ''} placeholder="전화" onChange={e => put({ links: d.links.map((x, j) => j === i ? { ...x, phone: e.target.value } : x) })} className={inputCls} aria-label={`연락처 ${i + 1} 전화`} />
              <input value={l.url || ''} placeholder="https://" onChange={e => put({ links: d.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} className={inputCls} aria-label={`연락처 ${i + 1} 주소`} />
              <button type="button" onClick={() => put({ links: d.links.filter((_, j) => j !== i) })}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-[#1E293B] text-slate-300 flex items-center justify-center active:scale-[0.98]" aria-label={`연락처 ${i + 1} 지우기`}>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {d.links.length < 4 && (
            <button type="button" onClick={() => put({ links: [...d.links, { label: '' }] })}
              className="min-h-[44px] px-3 rounded-xl border border-dashed border-[#1E293B] text-xs font-bold text-slate-300 flex items-center gap-1 whitespace-nowrap active:scale-[0.98]">
              <Plus className="w-4 h-4" aria-hidden="true" /> 연락처 더하기
            </button>
          )}
        </fieldset>

        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1">
            <span className="block text-xs font-bold text-slate-300">확인일 (공식 안내와 대조한 날)</span>
            <input type="date" value={d.checkedOn} onChange={e => put({ checkedOn: e.target.value })} className={inputCls} />
          </label>
          <label className={`flex items-center gap-2 text-sm min-h-[44px] ${fixedVisible ? 'text-slate-500' : 'text-slate-200'}`}>
            <input type="checkbox" checked={d.hidden} disabled={fixedVisible} onChange={e => put({ hidden: e.target.checked })} />
            고객 화면에서 숨기기{fixedVisible ? ' (회생·파산은 늘 보여요)' : ''}
          </label>
          <button type="button" onClick={() => put({ summary: base.summary, keyPoints: [...base.keyPoints], links: base.links.map(l => ({ ...l })), checkedOn: base.checkedOn, hidden: false })}
            className="min-h-[44px] px-3 rounded-xl border border-[#1E293B] text-xs font-bold text-slate-300 flex items-center gap-1 whitespace-nowrap active:scale-[0.98]">
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> 기본 문안으로
          </button>
        </div>

        {hits.length > 0 && (
          <p role="status" className="text-xs text-amber-300">광고 규정상 피해야 할 표현이 있어요: {hits.join(', ')}</p>
        )}
      </div>

      {err && <p role="alert" className="text-sm text-rose-300">{err}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={busy}
          className="min-h-[44px] px-5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 whitespace-nowrap active:scale-[0.98] disabled:opacity-60">
          {busy ? '저장 중…' : '저장'}
        </button>
      </div>
    </section>
  );
}
