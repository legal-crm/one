// 의뢰인 '내 사건': 직접 등록·이관 사건('case-…')의 서류 요청 확인과 제출 (DP-0)
// 상담 요청에서 시작한 사건은 기존 '필수 서류 제출' 카드가 맡는다
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Upload } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { listMySubmittedFiles, uploadCaseFile } from '../../../services/files/caseFileService';
import type { DocumentFile, DocumentRequest } from '../../../types';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const REVIEW: Record<string, { label: string; cls: string }> = {
  submitted: { label: '확인 대기', cls: 'text-amber-700' },
  under_review: { label: '확인 중', cls: 'text-sky-700' },
  approved: { label: '확인 완료', cls: 'text-emerald-700' },
  rejected: { label: '다시 내 주세요', cls: 'text-rose-700' },
};

export default function MyCaseDocsSection({ caseKey }: { caseKey: string }) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [files, setFiles] = useState<DocumentFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<DocumentRequest | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    const [v, f] = await Promise.all([
      supabase.rpc('client_case_view', { p_request_id: caseKey }),
      listMySubmittedFiles(caseKey),
    ]);
    if (v.error) { setError('서류 요청을 불러오지 못했어요.'); setFiles([]); return; }
    const reqs = ((v.data as any)?.documentRequests || []) as DocumentRequest[];
    setRequests(reqs.filter(r => r && !r.fulfilled));
    setFiles(f);
  }, [caseKey]);

  useEffect(() => { void load(); }, [load]);

  const pick = (r: DocumentRequest | null) => { setTarget(r); inputRef.current?.click(); };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (list.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const f of list) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: 20MB를 넘어요.`); continue; }
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(f); });
      const r = await uploadCaseFile({
        source: 'client', clientKey: caseKey,
        file: {
          id: '', name: f.name, category: 'other', uploadedAt: new Date().toISOString(), uploadedBy: '의뢰인', mimeType: f.type, dataUrl,
          uploadSource: 'client', reviewStatus: 'submitted', linkedDocId: target ? (target.linkedDocId || target.id) : undefined,
        } as DocumentFile,
      });
      if (r.ok) ok++; else toast.error(`${f.name}: ${r.message}`);
    }
    setUploading(false);
    if (ok > 0) toast.success(`서류 ${ok}개를 담당 사무소에 냈어요. 사무소가 확인하면 상태가 바뀌어요.`);
    setTarget(null);
    void load();
  };

  const submittedFor = (r: DocumentRequest) => (files || []).some(f => f.linkedDocId === (r.linkedDocId || r.id));

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">서류 제출</span>
        <button type="button" onClick={() => pick(null)} disabled={uploading} className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">
          <Upload className="w-4 h-4" aria-hidden="true" />{uploading ? '올리는 중…' : '서류 올리기'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onPick} />
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      {files === null && !error && <div className="h-10 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}

      {requests.length > 0 && (
        <ul className="space-y-2" aria-label="사무소가 요청한 서류">
          {requests.map(r => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              <span className="min-w-0">
                <span className="block font-bold text-slate-900">{r.documentLabel}</span>
                {r.description && <span className="block text-xs text-slate-600 break-keep">{r.description}</span>}
              </span>
              {submittedFor(r)
                ? <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">냈어요 · 확인 대기</span>
                : <button type="button" onClick={() => pick(r)} disabled={uploading} className="min-h-[44px] px-3 rounded-xl bg-brand text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 active:scale-[0.98]">이 서류 내기</button>}
            </li>
          ))}
        </ul>
      )}

      {files && files.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm" aria-label="낸 서류">
          {files.map(f => {
            const rv = REVIEW[f.reviewStatus || 'submitted'] || REVIEW.submitted;
            return (
              <li key={f.id} className="py-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0"><FileText className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" /><span className="truncate text-slate-800">{f.name}</span></span>
                  <span className={`text-xs font-bold whitespace-nowrap ${rv.cls}`}>{rv.label}</span>
                </span>
                {f.reviewStatus === 'rejected' && f.notes && <span className="mt-1 block text-xs text-rose-700">사유: {f.notes}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {files && files.length === 0 && requests.length === 0 && !error && (
        <p className="text-xs text-slate-600">아직 낸 서류가 없어요. 사무소가 요청한 서류가 생기면 여기에 보여요.</p>
      )}
      <p className="text-[11px] text-slate-500">PDF·사진만, 파일당 20MB까지. 낸 서류는 담당 사무소만 볼 수 있어요.</p>
    </div>
  );
}
