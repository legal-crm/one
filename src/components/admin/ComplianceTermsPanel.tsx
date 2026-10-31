// 통합어드민 › 플랫폼 설정: 금지어 사전 (M-9 후속)
// 공통 사전은 코드에 고정이라 여기서 뺄 수 없다. 관리자는 표현을 '더하기'만 한다.
// 의뢰인 발송 글(채팅·제안서·공개 Q&A·변호사 프로필·광고 소재)과 마케팅 글 검사에 바로 쓰인다(최대 5분 뒤 반영).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookX, Plus, Trash2 } from 'lucide-react';
import { DEFAULT_PROHIBITED_EXPRESSIONS } from '../../services/proposalCompliance';
import {
  adminSaveComplianceTerms, cleanTerms, loadPlatformComplianceTerms, type MarketingExtraTerm,
} from '../../services/compliance/platformTermsService';

const input = 'w-full min-h-[44px] rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40';

export default function ComplianceTermsPanel() {
  const [loading, setLoading] = useState(true);
  const [clientText, setClientText] = useState('');
  const [marketing, setMarketing] = useState<MarketingExtraTerm[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [showBase, setShowBase] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPlatformComplianceTerms(true).then(t => {
      setClientText(t.clientTerms.join('\n'));
      setMarketing(t.marketingTerms.length ? t.marketingTerms : []);
      setUpdatedAt(t.updatedAt);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    const c = cleanTerms(clientText.split(/[\n,]/));
    const m = cleanTerms(marketing.map(x => x.term));
    const bad = [...c.bad, ...m.bad];
    if (bad.length) { setError(`2~40자로 적어 주세요: ${bad.slice(0, 5).join(', ')}`); return; }
    if (c.terms.length > 100 || m.terms.length > 100) { setError('표현은 종류마다 100개까지 더할 수 있어요.'); return; }
    setError('');
    setSaving(true);
    const res = await adminSaveComplianceTerms(c.terms, m.terms.map(term => ({ term, reason: marketing.find(x => x.term.trim() === term)?.reason || null })));
    setSaving(false);
    if (res.ok === false) { setError(res.message); return; }
    setClientText(res.data.clientTerms.join('\n'));
    setMarketing(res.data.marketingTerms);
    setUpdatedAt(res.data.updatedAt);
    toast.success('금지어 사전을 저장했어요. 조치 기록에 남았어요.');
  };

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 space-y-4 text-left" aria-labelledby="compliance-terms-title">
      <div className="flex items-start gap-3">
        <BookX className="w-5 h-5 text-teal-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h3 id="compliance-terms-title" className="text-base font-bold text-white">금지어 사전</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed break-keep">
            기본 사전은 코드에 고정돼 있어 뺄 수 없어요. 여기서는 표현을 더하기만 해요. 의뢰인에게 보내는 글은 경고 후 사유를 받고(사무소가 엄격 모드면 막음), 마케팅 글은 검사 결과에 '관리자가 더한 확인 표현'으로 표시돼요.
            {updatedAt ? ` 마지막 저장 ${new Date(updatedAt).toLocaleString('ko-KR')}.` : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-24 rounded-xl bg-[#1E293B]/50 animate-pulse" />
          <div className="h-11 rounded-xl bg-[#1E293B]/50 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <button type="button" onClick={() => setShowBase(v => !v)} aria-expanded={showBase} className="text-xs font-bold text-teal-300 underline underline-offset-2">
              기본 사전 {DEFAULT_PROHIBITED_EXPRESSIONS.length}개 {showBase ? '접기' : '보기'}
            </button>
            {showBase && (
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_PROHIBITED_EXPRESSIONS.map(t => (
                  <span key={t} className="inline-flex items-center h-7 px-2 rounded-lg bg-[#0B0F19] border border-[#1E293B] text-xs text-slate-300">{t}</span>
                ))}
              </div>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-bold text-slate-200">의뢰인 발송 글에 더할 표현</span>
            <textarea
              className={`${input} min-h-[120px] py-2`}
              value={clientText}
              onChange={e => setClientText(e.target.value)}
              placeholder={'한 줄에 하나씩 (2~40자)\n예: 특급 해결'}
            />
            <span className="block text-xs text-slate-400">채팅·제안서·공개 Q&A 답변·변호사 프로필·광고 소재 검사에 함께 쓰여요. 마케팅 글 검사에도 들어가요.</span>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-bold text-slate-200">마케팅 글에만 더할 표현</span>
            {marketing.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input className={input} value={m.term} aria-label={`${i + 1}번째 표현`} onChange={e => setMarketing(p => p.map((x, j) => (j === i ? { ...x, term: e.target.value } : x)))} placeholder="표현" />
                <input className={input} value={m.reason || ''} aria-label={`${i + 1}번째 표현을 막는 이유`} maxLength={100} onChange={e => setMarketing(p => p.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} placeholder="이유·고칠 방향 (선택)" />
                <button type="button" onClick={() => setMarketing(p => p.filter((_, j) => j !== i))} aria-label={`${i + 1}번째 표현 지우기`} className="shrink-0 min-h-[44px] min-w-[44px] rounded-xl border border-[#1E293B] text-slate-300 hover:bg-[#1E293B] flex items-center justify-center active:scale-[0.98]">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {marketing.length < 100 && (
              <button type="button" onClick={() => setMarketing(p => [...p, { term: '', reason: '' }])} className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl border border-[#1E293B] text-xs font-bold text-slate-200 hover:bg-[#1E293B] whitespace-nowrap active:scale-[0.98]">
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />표현 더하기
              </button>
            )}
          </div>

          {error && <p role="alert" className="text-sm font-semibold text-rose-300">{error}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={save} disabled={saving} className="min-h-[44px] px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold disabled:opacity-60 whitespace-nowrap active:scale-[0.98]">
              {saving ? '저장 중…' : '사전 저장'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
