// ============================================================
// 의뢰인·사건 옮겨오기 (NF-10, 20261101002100_import_jobs)
// 엑셀 줄마다 서버 사건(create_case, source 'import')을 만들고 상담 정보는 사건 관리 데이터에 저장한다.
// 가져온 기록(import_jobs)에 만든 사건 번호를 남겨 '되돌리기'(휴지통, 30일 복구)를 할 수 있다.
// 이전: 화면 메모리 사건('ext-')만 만들어 새로 고치면 사라졌다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { createCase, trashCase, workspaceKeyForCase, notifyOfficeCasesChanged } from './caseCoreService';
import { createDefaultCrmExtension, saveCrmClient } from '../crmService';
import { emptyFinancialProfile } from '../../hooks/useOfficeWorkspaceCases';
import type { ImportedCase } from '../../components/lawyer/ImportCasesModal';

export interface ImportJob {
  id: string;
  fileName: string;
  rowCount: number;
  createdCount: number;
  caseIds: string[];
  status: 'done' | 'undone';
  createdAt: string;
  undoneAt: string | null;
}

const fromRow = (r: any): ImportJob => ({
  id: r.id, fileName: r.file_name || '', rowCount: r.row_count || 0, createdCount: r.created_count || 0,
  caseIds: r.case_ids || [], status: r.status, createdAt: r.created_at, undoneAt: r.undone_at ?? null,
});

export async function listImportJobs(officeId: string): Promise<ImportJob[]> {
  if (!isSupabaseConfigured || !officeId) return [];
  const { data } = await supabase.from('import_jobs').select('*').eq('office_id', officeId).order('created_at', { ascending: false }).limit(20);
  return (data || []).map(fromRow);
}

/** 같은 파일(지문)을 이미 가져왔는지 */
export async function findImportedFile(officeId: string, fileHash: string | null): Promise<ImportJob | null> {
  if (!isSupabaseConfigured || !fileHash) return null;
  const { data } = await supabase.from('import_jobs').select('*').eq('office_id', officeId).eq('file_hash', fileHash).eq('status', 'done').limit(1);
  return data && data[0] ? fromRow(data[0]) : null;
}

const caseTypeOf = (v?: string): 'rehab' | 'bankruptcy' => ((v || '').includes('파산') ? 'bankruptcy' : 'rehab');

export interface ImportResult { created: number; failed: Array<{ name: string; message: string }>; job: ImportJob | null }

export async function importCasesToServer(officeId: string, rows: ImportedCase[], meta?: { fileName: string; fileHash: string | null }, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const caseIds: string[] = [];
  const failed: ImportResult['failed'] = [];
  let i = 0;
  for (const c of rows) {
    i++;
    const created = await createCase(officeId, {
      caseType: caseTypeOf(c.caseType), source: 'import', displayName: c.clientName, realName: c.clientName, phone: c.phone || undefined,
    });
    if (created.ok === false) { failed.push({ name: c.clientName, message: created.message }); onProgress?.(i, rows.length); continue; }
    caseIds.push(created.data.id);
    const key = workspaceKeyForCase(created.data);
    const ext = createDefaultCrmExtension(key);
    ext.crmStatus = 'consulting';
    ext.intakeChannel = c.intakeChannel;
    ext.isExternalClient = true;
    ext.caseType = caseTypeOf(c.caseType) === 'bankruptcy' ? 'bankruptcy' as any : 'individual_rehab' as any;
    ext.region = c.region;
    if (c.specialMemo) ext.preInfo = c.specialMemo;
    (ext as any).externalProfile = {
      ...emptyFinancialProfile(c.clientName),
      gender: (c.gender === '여' ? 'female' : c.gender === '남' ? 'male' : undefined) as any,
      income: c.income || 0, debtTotal: c.debtTotal || 0, residenceRegion: c.region || '',
    };
    const saved = await saveCrmClient(key, ext);
    if (!saved) failed.push({ name: c.clientName, message: '사건은 만들었지만 상담 정보를 저장하지 못했어요.' });
    onProgress?.(i, rows.length);
  }
  let job: ImportJob | null = null;
  if (caseIds.length > 0 && isSupabaseConfigured) {
    const { data } = await supabase.from('import_jobs').insert({
      office_id: officeId, kind: 'cases', file_name: (meta?.fileName || '').slice(0, 200), file_hash: meta?.fileHash || null,
      row_count: rows.length, created_count: caseIds.length, case_ids: caseIds,
    }).select('*').single();
    job = data ? fromRow(data) : null;
  }
  notifyOfficeCasesChanged();
  return { created: caseIds.length, failed, job };
}

/** 가져온 사건을 모두 휴지통으로 (30일 안에 복구 가능) */
export async function undoImportJob(job: ImportJob): Promise<{ ok: boolean; trashed: number; message?: string }> {
  let trashed = 0;
  for (const id of job.caseIds) {
    const r = await trashCase(id);
    if (r.ok) trashed++;
  }
  const { error } = await supabase.from('import_jobs').update({ status: 'undone' }).eq('id', job.id);
  notifyOfficeCasesChanged();
  if (error) return { ok: false, trashed, message: '되돌린 기록을 저장하지 못했어요.' };
  return { ok: true, trashed };
}
