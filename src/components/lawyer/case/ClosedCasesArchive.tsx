// 종결 보관함 (CM-9) — 종결 사유·결정일·파기 예정일. 5년이 지나면 서버가 자료를 지우고 기록을 남긴다.
import React, { useEffect, useState } from 'react';
import { Archive, ChevronDown, ChevronRight } from 'lucide-react';
import { CLOSE_REASON_LABELS, listCases, type CaseRecord } from '../../../services/cases/caseCoreService';
import { localYmd } from '../../../utils/localDate';

const daysUntil = (ymd?: string | null) => (ymd ? Math.round((new Date(`${ymd}T00:00:00`).getTime() - new Date(`${localYmd()}T00:00:00`).getTime()) / 86400000) : null);

export default function ClosedCasesArchive({ officeId, onOpen }: { officeId: string; onOpen: (workspaceKey: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CaseRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || rows) return;
    void listCases({ officeId, view: 'closed', limit: 300 }).then(r => { if (r.ok) setRows(r.data); else setError(r.message); });
  }, [open, rows, officeId]);

  return (
    <section className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full min-h-[44px] px-4 py-2 flex items-center gap-2 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        <Archive className="w-4 h-4 text-slate-500" aria-hidden="true" />
        <span className="text-sm font-bold text-slate-800">종결 보관함</span>
        <span className="text-xs text-slate-500">종결 후 5년 보관, 파기 30일 전에 알려 드려요</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
          {!rows && !error && <div className="h-16 rounded-xl bg-slate-100 animate-pulse" aria-busy="true" />}
          {rows && rows.length === 0 && <p className="text-xs text-slate-500">종결한 사건이 없어요. 사건 화면의 '사건 종결'로 사유와 결정일을 남기면 여기로 옮겨져요.</p>}
          {rows && rows.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {rows.map(c => {
                const left = daysUntil(c.purgeAfter);
                const purged = !!c.purgedAt;
                return (
                  <li key={c.id}>
                    <button type="button" disabled={purged} onClick={() => onOpen(c.consultRequestId || `case-${c.id}`)}
                      className="w-full min-h-[44px] px-3 py-2 flex flex-wrap items-center gap-2 text-left text-xs hover:bg-slate-50 disabled:cursor-default">
                      <span className="font-bold text-slate-800 min-w-[8rem]">{purged ? '(자료 파기됨)' : c.title || c.caseNumber || '사건'}</span>
                      <span className="text-slate-600">{c.closeReason ? CLOSE_REASON_LABELS[c.closeReason] : '종결'} · {c.closedOn || '–'}</span>
                      <span className={`ml-auto ${left !== null && left <= 30 && !purged ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>
                        {purged ? `파기 ${c.purgedAt?.slice(0, 10)}` : `파기 예정 ${c.purgeAfter || '–'}${left !== null && left <= 30 ? ` (D-${Math.max(0, left)})` : ''}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
