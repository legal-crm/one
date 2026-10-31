import React, { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

/**
 * 사건 휴지통 목록 (CM-6) — 삭제한 사건을 보고 되돌린다.
 * (이전: 휴지통 버튼이 일반 사건 목록 화면을 그대로 써서 '복구할 수 있다'는 안내만 있고 복구 버튼이 없었다)
 */
export interface TrashCaseItem {
  id: string;
  name: string;
  deletedAt: string;
}

export default function TrashCaseList({ items, retentionDays, onRestore, onOpen }: {
  items: TrashCaseItem[];
  retentionDays: number;
  onRestore: (id: string) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (items.length === 0) {
    return (
      <div className="mx-4 my-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <Trash2 className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
        <p className="mt-3 text-sm font-bold text-slate-800">휴지통이 비어 있어요</p>
        <p className="mt-1 text-sm text-slate-600">사건 목록에서 지운 사건이 {retentionDays}일 동안 여기에 남아요.</p>
      </div>
    );
  }
  const daysLeft = (iso: string) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, retentionDays - Math.floor((Date.now() - t) / 86400000));
  };
  return (
    <ul className="mx-4 my-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
      {items.map(it => {
        const left = daysLeft(it.deletedAt);
        return (
          <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <button type="button" onClick={() => onOpen(it.id)} className="min-w-0 text-left">
              <p className="text-sm font-bold text-slate-900 truncate">{it.name}</p>
              <p className="text-xs text-slate-600">
                {new Date(it.deletedAt).toLocaleDateString('ko-KR')} 삭제{left !== null ? ` · ${left}일 뒤 영구 삭제` : ''}
              </p>
            </button>
            <button
              type="button"
              disabled={busyId === it.id}
              onClick={async () => { setBusyId(it.id); try { await onRestore(it.id); } finally { setBusyId(null); } }}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 whitespace-nowrap flex items-center gap-1.5 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              되돌리기
            </button>
          </li>
        );
      })}
    </ul>
  );
}
