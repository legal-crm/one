import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useDialog } from '../common/DialogProvider';
import { listImportJobs, undoImportJob, type ImportJob } from '../../services/cases/caseImportService';

/** 최근 가져오기 기록과 되돌리기 (NF-10) */
export default function RecentImportsList({ officeId }: { officeId: string }) {
  const dialog = useDialog();
  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = () => { void listImportJobs(officeId).then(setJobs); };
  useEffect(load, [officeId]);
  if (!jobs || jobs.length === 0) return null;
  const undo = async (j: ImportJob) => {
    const ok = await dialog.confirm({
      title: '가져오기 되돌리기',
      message: `이 파일로 만든 사건 ${j.createdCount}건을 휴지통으로 옮깁니다. 30일 안에는 휴지통에서 하나씩 되돌릴 수 있어요.`,
      confirmText: '휴지통으로 옮기기', variant: 'warning',
    });
    if (!ok) return;
    setBusyId(j.id);
    const r = await undoImportJob(j);
    setBusyId(null);
    if (r.ok) toast.success(`${r.trashed}건을 휴지통으로 옮겼어요.`); else toast.error(r.message || '되돌리지 못했어요.');
    load();
  };
  return (
    <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
      <p className="text-sm font-bold text-slate-800">최근 가져오기</p>
      <ul className="divide-y divide-slate-100 text-sm">
        {jobs.slice(0, 5).map(j => (
          <li key={j.id} className="py-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-slate-700">
              {new Date(j.createdAt).toLocaleDateString('ko-KR')} · {j.fileName || '파일'} · 사건 {j.createdCount}건
              {j.status === 'undone' && <span className="ml-1 text-slate-500">(되돌림)</span>}
            </span>
            {j.status === 'done' && (
              <button type="button" disabled={busyId === j.id} onClick={() => void undo(j)} className="min-h-[36px] px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 whitespace-nowrap active:scale-[0.98] disabled:opacity-60">되돌리기</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
