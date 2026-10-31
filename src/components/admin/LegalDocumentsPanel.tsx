// 통합어드민 › 플랫폼 설정: 약관·처리방침 버전 (CT-13)
// 게시본은 고칠 수 없다. 새 내용은 새 버전으로 게시하고, 중요한 변경이면 '다시 동의 받기'를 켠다.
// 운영 규칙: 시행 7일 전(이용자에게 불리한 변경은 30일 전) 공지. 약관 본문(정적 페이지)은 외부 자문 뒤 바꾼다(R6).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { rpcErrorMessage } from '../../services/office/rpcResult';

interface LegalDoc { id: string; kind: string; version: string; title: string; url: string; summary: string | null; effective_on: string; requires_reconsent: boolean; published_at: string }
interface Stat { kind: string; version: string; granted: number; withdrawn: number }

const KIND_LABEL: Record<string, string> = { terms: '이용약관', privacy: '개인정보 처리방침', third_party: '변호사 정보 제공 동의', lawyer_terms: '변호사 이용약관' };

export default function LegalDocumentsPanel() {
  const [docs, setDocs] = useState<LegalDoc[] | null>(null);
  const [stats, setStats] = useState<Stat[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ kind: 'terms', version: '', title: '', url: '/tos.html', summary: '', effectiveOn: '', reconsent: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setDocs([]); return; }
    const [d, s] = await Promise.all([
      supabase.from('legal_documents').select('*').order('published_at', { ascending: false }),
      supabase.rpc('admin_consent_stats'),
    ]);
    if (d.error) { setError('문서 목록을 불러오지 못했어요.'); setDocs([]); return; }
    setError('');
    setDocs((d.data || []) as LegalDoc[]);
    setStats(((s.data || []) as Stat[]));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const minEffective = (() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  const publish = async () => {
    setFormError('');
    if (!form.version.trim() || !form.title.trim() || !form.url.trim() || !form.effectiveOn) { setFormError('버전·제목·주소·시행일을 모두 입력해 주세요.'); return; }
    if (form.effectiveOn < minEffective) { setFormError(`시행일은 공지 기간(7일) 뒤인 ${minEffective} 이후로 정해 주세요. 불리한 변경은 30일 뒤로.`); return; }
    setSaving(true);
    const { error: e } = await supabase.rpc('admin_publish_legal_document', {
      p_kind: form.kind, p_version: form.version.trim(), p_title: form.title.trim(), p_url: form.url.trim(),
      p_summary: form.summary.trim() || null, p_effective_on: form.effectiveOn, p_requires_reconsent: form.reconsent,
    });
    setSaving(false);
    if (e) { setFormError(/already published/i.test(e.message) ? '이미 게시한 버전 이름이에요.' : rpcErrorMessage(e)); return; }
    toast.success('새 버전을 게시했어요.');
    setForm(f => ({ ...f, version: '', summary: '', effectiveOn: '', reconsent: false }));
    void load();
  };

  const statOf = (d: LegalDoc) => stats.find(s => s.kind === d.kind && s.version === d.version);

  return (
    <section className="bg-[#111622] rounded-2xl border border-[#1E293B]/60 p-5 space-y-4 text-left">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-white"><FileText className="w-4 h-4 text-indigo-400" aria-hidden="true" />약관·처리방침 버전</h3>
        <button type="button" onClick={() => void load()} aria-label="새로고침" className="min-h-9 px-3 rounded-xl bg-slate-800 text-slate-300 active:scale-[0.98]"><RefreshCw className="w-4 h-4" aria-hidden="true" /></button>
      </div>
      <p className="text-xs text-slate-400">게시한 버전은 고칠 수 없어요. 정적 페이지(약관 본문)를 먼저 바꾼 뒤 새 버전을 게시하세요. '다시 동의 받기'를 켜면 로그인한 의뢰인에게 한 번 묻습니다.</p>

      {error ? <p className="text-sm text-rose-300">{error}</p> : docs === null ? (
        <div className="h-16 rounded-xl bg-slate-800/60 animate-pulse" aria-busy="true" />
      ) : (
        <ul className="divide-y divide-[#1E293B]/50 text-sm">
          {docs.map(d => {
            const s = statOf(d);
            return (
              <li key={d.id} className="py-2 text-slate-200">
                <span className="font-bold">{KIND_LABEL[d.kind] || d.kind}</span>
                <span className="text-slate-400"> · {d.version} · {d.effective_on} 시행{d.requires_reconsent ? ' · 다시 동의' : ''}</span>
                <span className="block text-xs text-slate-500">동의 {s?.granted ?? 0}건{s?.withdrawn ? ` · 철회 ${s.withdrawn}건` : ''} · <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline">{d.url}</a></span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-[#1E293B] p-4 space-y-3">
        <p className="text-sm font-bold text-white">새 버전 게시</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value, url: e.target.value === 'privacy' ? '/privacy.html' : f.url }))} aria-label="문서 종류"
            className="min-h-11 rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-slate-200">
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} maxLength={40} placeholder="버전 (예: tos-2027-01-01)" aria-label="버전"
            className="min-h-11 rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-slate-200" />
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} maxLength={80} placeholder="제목" aria-label="제목"
            className="min-h-11 rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-slate-200" />
          <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} maxLength={200} placeholder="본문 주소 (/tos.html)" aria-label="본문 주소"
            className="min-h-11 rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-slate-200" />
          <label className="flex items-center gap-2 text-xs text-slate-300">시행일
            <input type="date" value={form.effectiveOn} min={minEffective} onChange={e => setForm(f => ({ ...f, effectiveOn: e.target.value }))}
              className="min-h-11 flex-1 rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 text-sm text-slate-200" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200 min-h-11">
            <input type="checkbox" checked={form.reconsent} onChange={e => setForm(f => ({ ...f, reconsent: e.target.checked }))} className="w-4 h-4" />다시 동의 받기 (중요한 변경)
          </label>
        </div>
        <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} maxLength={1000} rows={3} placeholder="바뀐 점 요약 (의뢰인 동의 창에 보여요)" aria-label="바뀐 점 요약"
          className="w-full rounded-xl bg-[#0B0F19] border border-[#1E293B] px-3 py-2 text-sm text-slate-200" />
        {formError && <p className="text-xs text-rose-300" role="alert">{formError}</p>}
        <div className="flex justify-end">
          <button type="button" disabled={saving} onClick={() => void publish()} className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">{saving ? '게시 중…' : '게시하기'}</button>
        </div>
      </div>
    </section>
  );
}
