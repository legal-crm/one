// 광고·결제 › 광고 소재 (AD-5·AD-7)
// 메인 배너(가로 이미지)·프로필 카드(본인 실사진 3:4) 소재를 올리고 심사 결과를 본다.
// 실제 노출 모양으로 미리 보고, 금지 표현은 경고만 하고(막지 않음) 마이김변이 심사한다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ImagePlus, RefreshCw, Upload } from 'lucide-react';
import {
  CREATIVE_KIND_LABEL, CREATIVE_STATUS_LABEL, creativeCopyWarnings, listOfficeCreatives, signedAdUrls, submitAdCreative, uploadAdImage,
  type AdCreative, type CreativeKind,
} from '../../../services/ads/adCreativeService';

const btn = 'min-h-[44px] px-4 rounded-xl text-sm font-bold whitespace-nowrap active:scale-[0.98] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const field = 'w-full p-3 rounded-xl border border-slate-200 text-sm text-slate-800';
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200', approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200', changes_requested: 'bg-rose-50 text-rose-700 border-rose-200', retired: 'bg-slate-50 text-slate-500 border-slate-200',
};

export function useOfficeCreatives(officeId?: string) {
  const [list, setList] = useState<AdCreative[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!officeId) return;
    setError(null);
    const r = await listOfficeCreatives(officeId);
    if (r.ok === false) { setError(r.message); return; }
    setList(r.data);
    setUrls(await signedAdUrls(r.data.map(c => c.imagePath)));
  }, [officeId]);
  useEffect(() => { void load(); }, [load]);
  return { list, urls, error, reload: load };
}

export default function AdCreativesSection({ officeId, lawyerId, lawyerName, canManage }: { officeId?: string; lawyerId: string; lawyerName: string; canManage: boolean }) {
  const { list, urls, error, reload } = useOfficeCreatives(officeId);
  const [editing, setEditing] = useState<{ kind: CreativeKind; replaces?: AdCreative } | null>(null);

  if (!officeId) return <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">사무소 정보를 불러오지 못했습니다. 다시 로그인해 주세요.</div>;
  if (error) {
    return (
      <div role="alert" className="bg-white border border-rose-200 rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-slate-700">{error}</p>
        <button type="button" onClick={() => void reload()} className={`${btn} bg-slate-900 text-white`}><RefreshCw className="w-4 h-4" /> 다시 불러오기</button>
      </div>
    );
  }
  if (!list) return <div className="space-y-3" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-extrabold text-xl text-slate-900">광고 소재</h3>
          <p className="text-sm text-slate-600 mt-0.5">메인 배너 광고는 승인된 배너 소재가 있어야 노출이 시작돼요. 소재를 고치면 다시 심사하고, 그동안은 이전 소재로 나가요.</p>
        </div>
        {canManage && !editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing({ kind: 'banner' })} className={`${btn} bg-[#1E3A5F] text-white`}><ImagePlus className="w-4 h-4" /> 배너 소재 만들기</button>
            <button type="button" onClick={() => setEditing({ kind: 'card' })} className={`${btn} bg-white border border-slate-300 text-slate-800`}><ImagePlus className="w-4 h-4" /> 프로필 카드 소재</button>
          </div>
        )}
      </div>

      {editing && (
        <CreativeForm officeId={officeId} lawyerId={lawyerId} lawyerName={lawyerName} kind={editing.kind} replaces={editing.replaces}
          onDone={() => { setEditing(null); void reload(); }} onCancel={() => setEditing(null)} />
      )}

      {list.length === 0 && !editing ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <ImagePlus className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="text-sm text-slate-600">아직 올린 소재가 없어요.</p>
          <p className="text-xs text-slate-500">메인 배너 광고를 신청했다면 배너 소재를 먼저 만들어 주세요.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map(c => (
            <li key={c.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className={c.kind === 'banner' ? 'aspect-[4/3] bg-slate-100' : 'aspect-[3/4] max-h-64 bg-slate-100 mx-auto'}>
                {urls[c.imagePath] ? <img src={urls[c.imagePath]} alt={c.altText} className="w-full h-full object-cover" /> : null}
              </div>
              <div className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500">{CREATIVE_KIND_LABEL[c.kind]}</span>
                  <span className={`text-xs font-bold border rounded-lg px-2 py-0.5 ${STATUS_CLS[c.status]}`}>{CREATIVE_STATUS_LABEL[c.status]}</span>
                </div>
                <p className="font-bold text-slate-900">{c.headline}</p>
                {c.subline && <p className="text-sm text-slate-600">{c.subline}</p>}
                {c.reviewNote && c.status !== 'approved' && <p className="text-xs text-rose-700">심사 의견: {c.reviewNote}</p>}
                {c.warnings.length > 0 && <p className="text-xs text-amber-800 flex gap-1"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" /> 확인할 표현: {c.warnings.join(', ')}</p>}
                {canManage && (c.status === 'approved' || c.status === 'changes_requested' || c.status === 'rejected') && (
                  <button type="button" onClick={() => setEditing({ kind: c.kind, replaces: c.status === 'approved' ? c : undefined })} className="min-h-[44px] text-sm font-bold text-[#1E3A5F] underline underline-offset-2">
                    {c.status === 'approved' ? '고쳐서 다시 심사받기' : '새로 만들기'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreativeForm({ officeId, lawyerId, lawyerName, kind, replaces, onDone, onCancel }: {
  officeId: string; lawyerId: string; lawyerName: string; kind: CreativeKind; replaces?: AdCreative; onDone: () => void; onCancel: () => void;
}) {
  const [headline, setHeadline] = useState(replaces?.headline || '');
  const [subline, setSubline] = useState(replaces?.subline || '');
  const [altText, setAltText] = useState(replaces?.altText || '');
  const [tags, setTags] = useState((replaces?.tags || []).join(', '));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field: string; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const warnings = useMemo(() => creativeCopyWarnings(`${headline} ${subline} ${tags}`), [headline, subline, tags]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f?: File) => {
    if (!f) return;
    if (!['image/webp', 'image/jpeg', 'image/png'].includes(f.type)) { setErr({ field: 'image', msg: 'WebP·JPG·PNG 이미지만 올릴 수 있어요.' }); return; }
    if (f.size > 5 * 1024 * 1024) { setErr({ field: 'image', msg: '이미지는 5MB 이하만 올릴 수 있어요.' }); return; }
    setErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!headline.trim()) { setErr({ field: 'headline', msg: '제목을 입력해 주세요.' }); return; }
    if (!altText.trim()) { setErr({ field: 'alt', msg: '이미지 설명(대체 텍스트)을 입력해 주세요.' }); return; }
    if (!file) { setErr({ field: 'image', msg: '이미지를 골라 주세요.' }); return; }
    setBusy(true);
    const up = await uploadAdImage(officeId, file);
    if (up.ok === false) { setBusy(false); setErr({ field: 'image', msg: up.message }); return; }
    const r = await submitAdCreative(officeId, {
      lawyerId, kind, headline: headline.trim(), subline: subline.trim() || undefined, altText: altText.trim(),
      tags: tags.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3), imagePath: up.data, replacesId: replaces?.id,
    });
    setBusy(false);
    if (r.ok === false) { toast.error(r.message); return; }
    toast.success('소재를 올렸어요. 마이김변이 심사하면 알려 드릴게요.');
    onDone();
  };

  const errFor = (f: string) => err?.field === f ? <p className="text-xs text-rose-700 mt-1" role="alert">{err.msg}</p> : null;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4" aria-label={`${CREATIVE_KIND_LABEL[kind]} 소재 만들기`}>
      <h4 className="font-extrabold text-slate-900">{CREATIVE_KIND_LABEL[kind]} 소재 {replaces ? '고치기' : '만들기'}</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div>
            <label htmlFor="cr-headline" className="text-sm font-bold text-slate-800">제목 (40자)</label>
            <input id="cr-headline" value={headline} maxLength={40} onChange={e => setHeadline(e.target.value)} className={field} />
            {errFor('headline')}
          </div>
          <div>
            <label htmlFor="cr-sub" className="text-sm font-bold text-slate-800">한 줄 소개 (80자, 선택)</label>
            <input id="cr-sub" value={subline} maxLength={80} onChange={e => setSubline(e.target.value)} className={field} />
          </div>
          {kind === 'card' && (
            <div>
              <label htmlFor="cr-tags" className="text-sm font-bold text-slate-800">분야 태그 (쉼표로 3개까지)</label>
              <input id="cr-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="예: 개인회생, 개인파산" className={field} />
            </div>
          )}
          <div>
            <label htmlFor="cr-alt" className="text-sm font-bold text-slate-800">이미지 설명 (화면 읽기 프로그램용)</label>
            <input id="cr-alt" value={altText} maxLength={120} onChange={e => setAltText(e.target.value)} placeholder={`예: ${lawyerName} 변호사 사진과 사무소 이름`} className={field} />
            {errFor('alt')}
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800 block">이미지</span>
            <p className="text-xs text-slate-500">{kind === 'banner' ? '가로 1040×780 이상 WebP 권장 (5MB 이하).' : '본인 실사진 3:4, 600×800 이상 (5MB 이하). 실사풍 가상 인물은 쓸 수 없어요.'}</p>
            <button type="button" onClick={() => inputRef.current?.click()} className={`${btn} mt-2 bg-white border border-slate-300 text-slate-800`}><Upload className="w-4 h-4" /> 이미지 고르기</button>
            <input ref={inputRef} type="file" accept="image/webp,image/jpeg,image/png" className="hidden" onChange={e => pick(e.target.files?.[0])} />
            {errFor('image')}
          </div>
          {warnings.length > 0 && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              변호사 광고 규정상 확인이 필요한 표현이 있어요: {warnings.join(', ')}. 그대로 올리면 심사에서 수정을 요청할 수 있어요.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">실제 노출 모양</p>
          {kind === 'banner' ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative aspect-[4/3]">
              {preview && <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />}
              <span className="absolute top-3 left-3 text-xs font-bold bg-white text-slate-900 rounded-lg px-2 py-0.5">광고</span>
              <span className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-slate-950/90 to-transparent text-white">
                <span className="block text-lg font-extrabold">{headline || '제목'}</span>
                {subline && <span className="block text-sm text-slate-100 mt-0.5">{subline}</span>}
                <span className="block text-xs text-slate-300 mt-2">광고책임 변호사 {lawyerName} · 광고는 무작위 순서</span>
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden max-w-[260px]">
              <div className="aspect-[3/4] bg-slate-100">{preview && <img src={preview} alt="" className="w-full h-full object-cover" />}</div>
              <div className="p-3 space-y-1">
                <span className="text-xs font-bold bg-slate-900 text-white rounded-lg px-2 py-0.5">광고</span>
                <p className="font-bold text-slate-900">{lawyerName} 변호사</p>
                <p className="text-sm text-slate-600">{headline || '제목'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} disabled={busy} className={`${btn} bg-white border border-slate-300 text-slate-700`}>취소</button>
        <button type="button" onClick={() => void submit()} disabled={busy} className={`${btn} bg-[#1E3A5F] text-white`}>{busy ? '올리는 중…' : '심사 요청'}</button>
      </div>
    </section>
  );
}
