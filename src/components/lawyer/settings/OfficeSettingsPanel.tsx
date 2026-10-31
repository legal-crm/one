// 설정 › 사무소 설정 (ST-1·ST-3·ST-5·ST-6)
// 사무소 정보(한 곳) · 사무소 직인 · 의뢰인 발송 문구 규칙. 모두 서버 office_settings / office_seals.
// 읽기는 같은 사무소 구성원, 고치기는 '사무소 설정 수정' 권한(기본 대표만).
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Save, Stamp, Upload } from 'lucide-react';
import { loadActiveSeals, loadOfficeSettings, registerSeal, saveOfficeSettings, type OfficeSeal } from '../../../services/office/officeSettingsService';
import { setOfficeProfileSettingsCache, type OfficeProfileSettings } from '../../../services/lawyer/officeProfile';
import { DEFAULT_PROHIBITED_EXPRESSIONS, setOfficeCopyRules, type OfficeCopyRules } from '../../../services/proposalCompliance';

type Sub = 'info' | 'seal' | 'copy';
const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const field = 'w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-800 disabled:bg-slate-50';

export default function OfficeSettingsPanel({ officeId, canEdit }: { officeId?: string; canEdit: boolean }) {
  const [sub, setSub] = useState<Sub>('info');
  if (!officeId) return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">사무소 정보를 불러오지 못했어요. 다시 로그인해 주세요.</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="사무소 설정">
        {([['info', '사무소 정보'], ['seal', '사무소 직인'], ['copy', '의뢰인 발송 문구 규칙']] as Array<[Sub, string]>).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => setSub(k)}
            className={`min-h-[40px] px-3.5 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] ${sub === k ? 'bg-brand/10 border border-brand/30 text-brand' : 'bg-white border border-slate-200 text-slate-600'}`}>
            {l}
          </button>
        ))}
      </div>
      {!canEdit && <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">사무소 설정은 '사무소 설정 수정' 권한이 있는 구성원(기본: 대표)만 고칠 수 있어요.</p>}
      {sub === 'info' && <OfficeInfo officeId={officeId} canEdit={canEdit} />}
      {sub === 'seal' && <OfficeSealCard officeId={officeId} kind="office_seal" canEdit={canEdit} />}
      {sub === 'copy' && <CopyRules officeId={officeId} canEdit={canEdit} />}
    </div>
  );
}

function useSection<T extends Record<string, unknown>>(officeId: string, section: 'profile' | 'copy_rules') {
  const [value, setValue] = useState<T | null>(null);
  const [version, setVersion] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    const r = await loadOfficeSettings<T>(officeId, section);
    if (r.ok === false) { setError(r.message); return; }
    setValue((r.data?.data || {}) as T);
    setVersion(r.data?.version);
  }, [officeId, section]);
  useEffect(() => { void load(); }, [load]);
  const save = async (next: T): Promise<boolean> => {
    const r = await saveOfficeSettings(officeId, section, next, version);
    if (r.ok === false) { toast.error(r.message); if (/다른 사람이 먼저/.test(r.message)) void load(); return false; }
    setVersion(r.data.version);
    setValue(next);
    return true;
  };
  return { value, setValue, error, reload: load, save };
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3">
      <p className="text-sm text-slate-700">{message}</p>
      <button type="button" onClick={onRetry} className={`${btn} bg-slate-900 text-white`}><RefreshCw className="w-4 h-4" /> 다시 불러오기</button>
    </div>
  );
}

function OfficeInfo({ officeId, canEdit }: { officeId: string; canEdit: boolean }) {
  const s = useSection<OfficeProfileSettings & Record<string, unknown>>(officeId, 'profile');
  const [busy, setBusy] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  if (s.error) return <ErrorRow message={s.error} onRetry={() => void s.reload()} />;
  if (!s.value) return <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;
  const v = s.value;
  const set = (k: keyof OfficeProfileSettings) => (e: React.ChangeEvent<HTMLInputElement>) => s.setValue({ ...v, [k]: e.target.value });
  const save = async () => {
    if (v.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v.email))) { setEmailErr('이메일 형식을 확인해 주세요.'); return; }
    setEmailErr('');
    setBusy(true);
    const clean: OfficeProfileSettings = {};
    (['firmName', 'representative', 'address', 'phone', 'fax', 'email', 'bizNumber'] as const).forEach(k => { const x = String(v[k] || '').trim(); if (x) clean[k] = x; });
    const ok = await s.save(clean as any);
    setBusy(false);
    if (ok) { setOfficeProfileSettingsCache(clean); toast.success('사무소 정보를 저장했어요. 법원 서식·계약서·제안서·안내 문구에 바로 쓰여요.'); }
  };
  const rows: Array<[keyof OfficeProfileSettings, string, string]> = [
    ['firmName', '사무소 이름', '예: ○○ 법률사무소'], ['representative', '대표 변호사', ''], ['address', '사무소 주소', ''],
    ['phone', '대표 전화', '예: 02-123-4567'], ['fax', '팩스', ''], ['email', '대표 이메일', ''], ['bizNumber', '사업자등록번호', '세금계산서 정보는 광고·결제 > 사업자 정보'],
  ];
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" aria-label="사무소 정보">
      <div>
        <h3 className="font-extrabold text-slate-900">사무소 정보</h3>
        <p className="text-sm text-slate-600 mt-0.5">법원 서식의 대리인 칸·계약서·제안서·알림 안내가 이 값을 써요. 비워 둔 칸은 서식에도 빈칸으로 나가요.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map(([k, label, ph]) => (
          <div key={k} className={k === 'address' ? 'md:col-span-2' : ''}>
            <label htmlFor={`oi-${k}`} className="text-sm font-bold text-slate-800">{label}</label>
            <input id={`oi-${k}`} value={String(v[k] || '')} placeholder={ph} disabled={!canEdit} onChange={set(k)} className={field}
              aria-invalid={k === 'email' && !!emailErr} aria-describedby={k === 'email' && emailErr ? 'oi-email-err' : undefined} />
            {k === 'email' && emailErr && <p id="oi-email-err" className="text-xs text-rose-700 mt-1">{emailErr}</p>}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}><Save className="w-4 h-4" /> {busy ? '저장 중…' : '저장'}</button>
        </div>
      )}
    </section>
  );
}

export function OfficeSealCard({ officeId, kind, canEdit, title }: { officeId: string; kind: 'office_seal' | 'lawyer_seal' | 'lawyer_signature'; canEdit: boolean; title?: string }) {
  const [seal, setSeal] = useState<OfficeSeal | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setError(null);
    const r = await loadActiveSeals(officeId);
    if (r.ok === false) { setError(r.message); return; }
    setSeal(r.data.find(x => x.kind === kind) || null);
  }, [officeId, kind]);
  useEffect(() => { void load(); }, [load]);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    const r = await registerSeal(officeId, kind, f, f.name.slice(0, 40));
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('도장을 저장했어요. 이전 도장은 내렸어요.');
    void load();
  };
  const label = title || (kind === 'office_seal' ? '사무소 직인' : kind === 'lawyer_seal' ? '내 도장' : '내 서명');
  if (error) return <ErrorRow message={error} onRetry={() => void load()} />;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3" aria-label={label}>
      <h3 className="font-extrabold text-slate-900 flex items-center gap-1.5"><Stamp className="w-4 h-4 text-slate-600" aria-hidden="true" /> {label}</h3>
      <p className="text-sm text-slate-600">투명 배경 PNG(2MB 이하)를 권해요. 비공개 저장소에 두고, 서식에 찍을 때마다 사무소 활동 기록에 남아요.</p>
      {seal === undefined ? <div className="h-32 w-32 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />
        : seal ? <img src={seal.imageUrl} alt={`${label} 이미지`} className="h-32 w-32 object-contain rounded-2xl border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]" />
        : <p className="text-sm text-slate-500">등록된 도장이 없어요.</p>}
      {canEdit && (
        <>
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={`${btn} bg-white border border-slate-300 text-slate-800`}><Upload className="w-4 h-4" /> {busy ? '올리는 중…' : seal ? '바꾸기' : '이미지 올리기'}</button>
          <input ref={inputRef} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </>
      )}
    </section>
  );
}

function CopyRules({ officeId, canEdit }: { officeId: string; canEdit: boolean }) {
  const s = useSection<Partial<OfficeCopyRules> & Record<string, unknown>>(officeId, 'copy_rules');
  const [termsText, setTermsText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (s.error) return <ErrorRow message={s.error} onRetry={() => void s.reload()} />;
  if (!s.value) return <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" />;
  const v = s.value;
  const terms = termsText ?? (Array.isArray(v.extraTerms) ? (v.extraTerms as string[]).join('\n') : '');
  const save = async () => {
    const next: OfficeCopyRules = {
      mode: v.mode === 'strict' ? 'strict' : 'advisory',
      extraTerms: terms.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 100),
      requiredNotice: String(v.requiredNotice || '').trim() || undefined,
    };
    setBusy(true);
    const ok = await s.save(next as any);
    setBusy(false);
    if (ok) { setOfficeCopyRules(next); setTermsText(null); toast.success('발송 문구 규칙을 저장했어요. 제안서·채팅 보내기 전에 바로 적용돼요.'); }
  };
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" aria-label="의뢰인 발송 문구 규칙">
      <div>
        <h3 className="font-extrabold text-slate-900">의뢰인 발송 문구 규칙</h3>
        <p className="text-sm text-slate-600 mt-0.5">제안서·채팅을 보내기 전에 아래 표현이 있는지 확인해요. 공통 표현은 사무소가 뺄 수 없어요.</p>
      </div>
      <fieldset className="space-y-2" disabled={!canEdit}>
        <legend className="text-sm font-bold text-slate-800">검사 방식</legend>
        {([['advisory', '권고 (기본): 경고하고, 사유를 적으면 그대로 보낼 수 있어요. 사유는 기록돼요.'], ['strict', '엄격: 걸린 표현을 고쳐야 보낼 수 있어요.']] as const).map(([m, d]) => (
          <label key={m} className="flex items-start gap-2 text-sm text-slate-700 min-h-[44px]">
            <input type="radio" name="copy-mode" checked={(v.mode || 'advisory') === m} onChange={() => s.setValue({ ...v, mode: m })} className="mt-1 w-4 h-4" />
            <span>{d}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="cr-terms" className="text-sm font-bold text-slate-800">사무소 추가 표현 (한 줄에 하나)</label>
        <textarea id="cr-terms" rows={5} disabled={!canEdit} value={terms} onChange={e => setTermsText(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="cr-notice" className="text-sm font-bold text-slate-800">제안서 끝에 붙일 사무소 고지 (선택)</label>
        <textarea id="cr-notice" rows={3} disabled={!canEdit} value={String(v.requiredNotice || '')} onChange={e => s.setValue({ ...v, requiredNotice: e.target.value.slice(0, 1000) })} className={field} />
      </div>
      <details className="text-sm text-slate-600">
        <summary className="cursor-pointer min-h-[44px] font-bold">공통 표현 보기 ({DEFAULT_PROHIBITED_EXPRESSIONS.length}개)</summary>
        <p className="mt-1 leading-relaxed">{DEFAULT_PROHIBITED_EXPRESSIONS.join(' · ')}</p>
      </details>
      {canEdit && (
        <div className="flex justify-end">
          <button type="button" disabled={busy} onClick={() => void save()} className={`${btn} bg-[#1E3A5F] text-white`}><Save className="w-4 h-4" /> {busy ? '저장 중…' : '저장'}</button>
        </div>
      )}
    </section>
  );
}
