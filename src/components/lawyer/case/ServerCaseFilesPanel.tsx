// ============================================================
// 사건 화면 '서류 자료함 (서버)' (DP-0): 저장소에 있는 파일 보기·올리기·검토
// 의뢰인 제출 파일과 사무소가 올린 파일을 한 목록에서 연다 (5분짜리 임시 주소)
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ChevronDown, ChevronUp, FileText, FolderOpen, RefreshCw, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useDialog } from '../../common/DialogProvider';
import { supabase } from '../../../supabaseClient';
import { getCaseFileUrl, restoreCaseFile, trashCaseFile, uploadCaseFile } from '../../../services/files/caseFileService';
import { getCrmExt, updateCrmExt } from '../../../services/crmService';
import { writeAuditLog } from '../../../services/auditService';

const TRASH_DAYS = 30;

interface Row {
  id: string;
  name: string;
  category: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadSource: 'office' | 'client';
  reviewStatus: string;
  storagePath: string;
  createdAt: string;
  note?: string;
  deletedAt?: string;
  deleteReason?: string;
  purgedAt?: string;
}

const REVIEW_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: '확인 대기', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  under_review: { label: '검토 중', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  approved: { label: '확인 완료', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: '다시 요청', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const kb = (n?: number) => (typeof n === 'number' ? (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`) : '');

export default function ServerCaseFilesPanel({ officeId, clientKey, canManage, viewerName }: { officeId: string; clientKey: string; canManage: boolean; viewerName: string }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(true);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trash, setTrash] = useState<Row[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.from('case_files').select('*')
      .eq('office_id', officeId).eq('client_key', clientKey).order('created_at', { ascending: false });
    if (e) { setError(/permission|row-level/i.test(e.message) ? '이 사건 서류를 볼 권한이 없습니다.' : '서류 목록을 불러오지 못했습니다.'); return; }
    const all: Row[] = (data || []).map((r: any) => ({
      id: r.id, name: r.name, category: r.category, mimeType: r.mime_type || undefined, sizeBytes: r.size_bytes ?? undefined,
      uploadSource: r.upload_source, reviewStatus: r.review_status, storagePath: r.storage_path, createdAt: r.created_at, note: r.note || undefined,
      deletedAt: r.deleted_at || undefined, deleteReason: r.delete_reason || undefined, purgedAt: r.purged_at || undefined,
    }));
    setRows(all.filter(r => !r.deletedAt));
    setTrash(all.filter(r => r.deletedAt && !r.purgedAt));
  }, [officeId, clientKey]);

  const moveToTrash = async (r: Row) => {
    const reason = await dialog.prompt({
      title: '휴지통으로 옮기기',
      message: `'${r.name}'을(를) 휴지통으로 옮깁니다. ${TRASH_DAYS}일 안에는 되돌릴 수 있고, 그 뒤에는 파일이 서버에서 지워집니다.${r.uploadSource === 'client' ? ' 의뢰인 화면에서도 사라집니다.' : ''} 사유를 적어 주세요. (선택)`,
      placeholder: '예: 잘못 올림, 같은 파일 중복',
    });
    if (reason === null || reason === undefined) return;
    setBusyId(r.id);
    const res = await trashCaseFile(r.id, reason.trim() || undefined);
    if (res.ok) {
      // 이 탭의 사건 자료함 사본에서도 뺀다
      const ext = getCrmExt(clientKey);
      if ((ext.uploadedFiles || []).some(f => f.id === r.id)) {
        void updateCrmExt(clientKey, { uploadedFiles: (ext.uploadedFiles || []).filter(f => f.id !== r.id) });
      }
      toast.success(`휴지통으로 옮겼습니다. ${TRASH_DAYS}일 안에 되돌릴 수 있습니다.`);
    } else toast.error(res.message || '휴지통으로 옮기지 못했습니다.');
    setBusyId(null);
    void load();
  };

  const restore = async (r: Row) => {
    setBusyId(r.id);
    const res = await restoreCaseFile(r.id);
    setBusyId(null);
    if (res.ok) toast.success('서류를 되돌렸습니다. 사건 자료함에는 새로 불러올 때 다시 보입니다.');
    else toast.error(res.message || '되돌리지 못했습니다.');
    void load();
  };

  const daysLeft = (iso?: string) => {
    if (!iso) return TRASH_DAYS;
    const left = TRASH_DAYS - Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return Math.max(0, left);
  };

  useEffect(() => { void load(); }, [load]);

  const openFile = async (r: Row) => {
    const url = await getCaseFileUrl({ storagePath: r.storagePath });
    if (!url) { toast.error('파일을 열지 못했습니다. 권한이나 연결을 확인해 주세요.'); return; }
    // 민감 서류 열람 기록
    void writeAuditLog({ actor_id: viewerName, actor_role: 'lawyer', action: 'view_client_detail', target_type: 'case_file', target_id: r.id, detail: { name: r.name } });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const setReview = async (r: Row, status: 'approved' | 'rejected') => {
    let note: string | undefined;
    if (status === 'rejected') {
      const reason = await dialog.prompt({ title: '다시 요청', message: '의뢰인에게 알릴 사유를 적어 주세요. (예: 발급일이 2개월 지남, 일부 쪽 누락)', placeholder: '사유' });
      if (!reason || !reason.trim()) return;
      note = reason.trim().slice(0, 500);
    }
    const { error: e } = await supabase.from('case_files').update({ review_status: status, ...(note ? { note } : {}) }).eq('id', r.id);
    if (e) { toast.error('검토 상태를 저장하지 못했습니다.'); return; }
    toast.success(status === 'approved' ? '확인 완료로 표시했습니다.' : '다시 요청으로 표시했습니다.');
    void load();
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { toast.error(`${f.name}: 20MB를 넘습니다.`); continue; }
      const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(f); });
      const r = await uploadCaseFile({
        source: 'office', clientKey, officeId,
        file: { id: '', name: f.name, category: 'other', uploadedAt: new Date().toISOString(), uploadedBy: viewerName, mimeType: f.type, dataUrl, uploadSource: 'lawyer', reviewStatus: 'approved' },
      });
      if (r.ok) ok++; else toast.error(`${f.name}: ${r.message}`);
    }
    setUploading(false);
    if (ok > 0) toast.success(`서류 ${ok}개를 올렸습니다.`);
    void load();
  };

  const pending = (rows || []).filter(r => r.uploadSource === 'client' && r.reviewStatus === 'submitted').length;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-xs" aria-label="서류 자료함">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer">
        <span className="flex items-center gap-2 font-extrabold text-slate-900"><FolderOpen className="w-5 h-5 text-slate-700" />서류 자료함 (서버)</span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {rows && <span>{rows.length}개</span>}
          {pending > 0 && <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold">의뢰인 제출 확인 대기 {pending}</span>}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {error && (
            <div role="alert" className="flex items-center justify-between gap-2 p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-800">
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
              <button onClick={() => void load()} className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 font-bold whitespace-nowrap cursor-pointer"><RefreshCw className="w-3.5 h-3.5 inline mr-1" />다시</button>
            </div>
          )}
          {!error && rows === null && <div className="h-16 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
          {!error && rows && rows.length === 0 && (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">서버에 저장된 서류가 없습니다. 의뢰인이 '내 사건'에서 제출하거나 아래 버튼으로 올리면 여기에 모입니다.</p>
          )}
          {!error && rows && rows.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {rows.map(r => {
                const rv = REVIEW_LABEL[r.reviewStatus] || REVIEW_LABEL.submitted;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                    <button onClick={() => openFile(r)} className="flex items-center gap-2 min-w-0 text-left hover:underline cursor-pointer">
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="truncate font-bold text-slate-900">{r.name}</span>
                      <span className="text-xs text-slate-500 shrink-0">{r.uploadSource === 'client' ? '의뢰인 제출' : '사무소'} · {new Date(r.createdAt).toLocaleDateString('ko-KR')} {kb(r.sizeBytes)}</span>
                    </button>
                    <span className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border whitespace-nowrap ${rv.cls}`}>{rv.label}</span>
                      {canManage && r.uploadSource === 'client' && r.reviewStatus !== 'approved' && (
                        <button onClick={() => setReview(r, 'approved')} className="text-xs font-bold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer">확인</button>
                      )}
                      {canManage && r.uploadSource === 'client' && r.reviewStatus !== 'rejected' && (
                        <button onClick={() => setReview(r, 'rejected')} className="text-xs font-bold text-rose-600 hover:underline whitespace-nowrap cursor-pointer">다시 요청</button>
                      )}
                      {canManage && (
                        <button onClick={() => moveToTrash(r)} disabled={busyId === r.id} aria-label={`${r.name} 휴지통으로`} title="휴지통으로" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </span>
                    {r.reviewStatus === 'rejected' && r.note && <p className="w-full text-xs text-rose-700">사유: {r.note}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          {canManage && (
            <>
              <input ref={inputRef} type="file" accept={ACCEPT} multiple className="hidden" onChange={onPick} />
              <button onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-slate-900 text-white text-sm font-bold whitespace-nowrap disabled:opacity-50 cursor-pointer active:scale-[0.98]">
                <Upload className="w-4 h-4" />{uploading ? '올리는 중…' : '서류 올리기'}
              </button>
              <p className="text-xs text-slate-500">PDF·사진만, 파일당 20MB까지. 서류를 열면 열람 기록이 남습니다.</p>
            </>
          )}
          {!error && trash.length > 0 && (
            <div className="pt-1">
              <button type="button" onClick={() => setShowTrash(v => !v)} aria-expanded={showTrash} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />휴지통 {trash.length}개 {showTrash ? '접기' : '보기'}
              </button>
              {showTrash && (
                <ul className="mt-2 divide-y divide-slate-100 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                  {trash.map(r => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-slate-700">{r.name}</span>
                        <span className="block text-xs text-slate-500">
                          {r.uploadSource === 'client' ? '의뢰인 제출' : '사무소'} · {daysLeft(r.deletedAt)}일 뒤 파기{r.deleteReason ? ` · 사유: ${r.deleteReason}` : ''}
                        </span>
                      </span>
                      {canManage && (
                        <button onClick={() => restore(r)} disabled={busyId === r.id} className="inline-flex items-center gap-1 px-3 min-h-[36px] rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-700 whitespace-nowrap disabled:opacity-40 cursor-pointer active:scale-[0.98]">
                          <RotateCcw className="w-3.5 h-3.5" />되돌리기
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
