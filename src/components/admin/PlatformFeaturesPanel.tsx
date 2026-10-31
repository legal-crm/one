import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SlidersHorizontal } from 'lucide-react';
import {
  BILLING_MODE_LABEL, DEFAULT_FEATURE_CONFIG, loadFeatureConfig, saveFeatureConfig,
  type AddonBillingMode, type PlatformFeatureConfig,
} from '../../services/platform/featureConfigService';

/**
 * 기능 표시 · 부가 기능 과금 모드 (CT-15)
 * - 사건 검토는 무료로 시작(LA-Q1). 광고 혜택·정액 이용으로 바꾸려면 시작일이 30일 뒤 이후여야 하고, 저장하면 사무소 공지가 자동으로 올라간다
 * - 상담 건수에 따른 요금은 두지 않는다
 * - 변호사별 예외(정액 이용 승인)는 변호사 심사 화면의 '사건 검토 이용' 토글
 */
export default function PlatformFeaturesPanel() {
  const [cfg, setCfg] = useState<PlatformFeatureConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void loadFeatureConfig(true).then(setCfg); }, []);

  const minDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const save = async () => {
    if (!cfg) return;
    setErr(null);
    if (cfg.caseReviewBilling.mode !== 'free' && (!cfg.caseReviewBilling.effectiveFrom || cfg.caseReviewBilling.effectiveFrom < minDate)) {
      setErr(`시작일은 ${minDate} 이후로 정해 주세요 (사무소에 30일 전 공지).`);
      return;
    }
    setBusy(true);
    const r = await saveFeatureConfig(cfg);
    setBusy(false);
    if (r.ok === false) { setErr(r.message); return; }
    setCfg(r.data);
    toast.success(r.data.caseReviewBilling.noticeId && r.data.caseReviewBilling.mode !== 'free'
      ? '저장했어요. 사무소 공지를 함께 올렸어요.' : '저장했어요.');
  };

  if (!cfg) {
    return <div className="h-40 rounded-2xl bg-white/5 animate-pulse" aria-busy="true" />;
  }
  const set = (patch: Partial<PlatformFeatureConfig>) => setCfg(prev => ({ ...(prev || DEFAULT_FEATURE_CONFIG), ...patch }));

  return (
    <section className="bg-[#111622] border border-[#1E293B]/60 rounded-2xl p-5 space-y-5" aria-labelledby="platform-features-title">
      <h2 id="platform-features-title" className="text-base font-extrabold text-white flex items-center gap-2">
        <SlidersHorizontal className="w-4 h-4" aria-hidden="true" /> 기능 표시 · 부가 기능 과금 모드
      </h2>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-200">사건 검토 이용 조건</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {(Object.keys(BILLING_MODE_LABEL) as AddonBillingMode[]).map(mode => (
            <label key={mode} className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${cfg.caseReviewBilling.mode === mode ? 'border-indigo-400/60 bg-indigo-500/15 text-indigo-100' : 'border-[#1E293B] text-slate-300'}`}>
              <input type="radio" name="billing-mode" checked={cfg.caseReviewBilling.mode === mode}
                onChange={() => set({ caseReviewBilling: { ...cfg.caseReviewBilling, mode } })} />
              {BILLING_MODE_LABEL[mode]}
            </label>
          ))}
        </div>
        {cfg.caseReviewBilling.mode !== 'free' && (
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-300">시작일 (오늘부터 30일 뒤 이후)</span>
            <input type="date" min={minDate} value={cfg.caseReviewBilling.effectiveFrom || ''}
              onChange={e => set({ caseReviewBilling: { ...cfg.caseReviewBilling, effectiveFrom: e.target.value } })}
              className="min-h-[44px] rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-white" />
          </label>
        )}
        <p className="text-xs text-slate-400 leading-relaxed">
          시작일 전까지는 모든 사무소가 무료로 써요. 상담 건수에 따른 요금은 둘 수 없어요(변호사법 제34조). 정액 이용을 승인한 변호사는 변호사 심사 화면에서 켭니다.
        </p>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold text-slate-200">고객 사이트 기능 표시</legend>
        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input type="checkbox" className="mt-1" checked={cfg.features.calculatorVisible}
            onChange={e => set({ features: { ...cfg.features, calculatorVisible: e.target.checked } })} />
          <span>변제금 계산기 공개 <span className="block text-xs text-slate-400">제도 이해용으로 다시 만들고(B-7) 외부 변호사 검토를 마친 뒤 켜세요.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-200">
          <input type="checkbox" className="mt-1" checked={cfg.features.companionVisible}
            onChange={e => set({ features: { ...cfg.features, companionVisible: e.target.checked } })} />
          <span>회생동행 소개 메뉴</span>
        </label>
      </fieldset>

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
