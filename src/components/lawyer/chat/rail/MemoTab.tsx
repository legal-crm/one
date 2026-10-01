import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Lock, StickyNote } from 'lucide-react';
import type { CrmNote } from '../../../../types';
import { CRM_NOTE_CATEGORIES } from '../../../../types';
import { formatFullDateTime, formatListTime } from '../chatFormat';

/**
 * 메모 저장 결과
 * - saved: 서버까지 저장
 * - local: 서버 저장 실패, 이 기기에만 남음
 * - failed: 저장하지 않음 (서버의 최신 데이터를 읽지 못해 덮어쓰기를 막았다)
 */
export type MemoSaveResult = 'saved' | 'local' | 'failed';

interface MemoTabProps {
  /** null이면 불러오는 중 */
  notes: CrmNote[] | null;
  onSave: (content: string) => Promise<MemoSaveResult>;
  onOpenCrmNotes: () => void;
  now: Date;
}

function MemoSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {[0, 1].map(i => (
        <li key={i} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <span className="h-4 w-10 rounded bg-slate-100 animate-pulse" />
            <span className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
            <span className="ml-auto h-4 w-12 rounded bg-slate-100 animate-pulse" />
          </div>
          <div className="mt-2 h-4 w-full rounded bg-slate-100 animate-pulse" />
          <div className="mt-1.5 h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

/** 내부 메모 — 고객관리 탭 '상담 메모'와 같은 저장소(crmExt.notes)를 쓴다 */
export default function MemoTab({ notes, onSave, onOpenCrmNotes, now }: MemoTabProps) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputId = useId();

  const sorted = notes ? [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : null;

  const handleSave = async () => {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const result = await onSave(text);
      if (result === 'failed') {
        // 입력한 내용은 지우지 않는다 — 다시 저장할 수 있게
        toast.error('고객관리 데이터를 불러오지 못해 메모를 저장하지 않았습니다. 입력한 내용은 그대로 두었으니 인터넷 연결을 확인한 뒤 다시 저장해 주세요.');
        return;
      }
      setDraft('');
      if (result === 'saved') toast.success('메모를 저장했습니다.');
      else toast.error('서버 저장에 실패했습니다. 이 기기에만 임시 저장되었으니 네트워크 확인 후 다시 시도해 주세요.');
    } catch {
      toast.error('메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-1.5 text-xs text-slate-600">
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        사무소 내부 메모 · 의뢰인 화면에는 표시되지 않습니다
      </p>

      <div>
        <label htmlFor={inputId} className="sr-only">새 메모</label>
        <textarea
          id={inputId}
          rows={3}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="상담 내용이나 다음 할 일을 남겨 두세요"
          className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={!draft.trim() || saving}
            className="h-9 pointer-coarse:h-11 px-3.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-sm font-bold whitespace-nowrap transition-colors press-scale cursor-pointer disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중' : '메모 저장'}
          </button>
        </div>
      </div>

      {sorted === null ? (
        <MemoSkeleton />
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center">
          <StickyNote className="mx-auto w-7 h-7 text-slate-400" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-slate-700">아직 남긴 메모가 없습니다</p>
          <p className="mt-1 text-xs text-slate-600">위 입력창에 적으면 고객관리 상담 메모에도 함께 보입니다.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map(note => (
            <li key={note.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2 min-w-0 text-[12px] text-slate-500">
                <span className="inline-flex items-center h-5 px-1.5 rounded-lg bg-slate-100 font-semibold text-slate-600 shrink-0">
                  {CRM_NOTE_CATEGORIES[note.category]?.label || '메모'}
                </span>
                <span className="font-semibold text-slate-700 truncate">{note.authorName}</span>
                <span className="ml-auto shrink-0 tabular-nums" title={formatFullDateTime(note.createdAt)}>
                  {formatListTime(note.createdAt, now)}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-800 whitespace-pre-wrap [overflow-wrap:anywhere]">{note.content}</p>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onOpenCrmNotes}
        className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline underline-offset-2 cursor-pointer"
      >
        고객관리 상담 메모에서 수정·삭제
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
