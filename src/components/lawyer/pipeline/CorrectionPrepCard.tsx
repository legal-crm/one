import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { DocumentRequest } from '../../../types';
import { CORRECTION_PREP_BUNDLES, bundlesForCourt } from '../../../services/documents/correctionPrepBundles';

interface Props {
  courtName?: string;
  existingRequests: DocumentRequest[];
  requestedBy: string;
  /** 새 요청을 사건 기록(서버)에 더한다. 실패하면 던진다 */
  onAddRequests?: (next: DocumentRequest[]) => Promise<void>;
}

/** 3단계 '보정 때 자주 요구된 자료 미리 받기' (DP-7) — 고른 항목만 의뢰인 서류 요청에 더한다 */
export default function CorrectionPrepCard({ courtName, existingRequests, requestedBy, onAddRequests }: Props) {
  const [open, setOpen] = useState(false);
  const autoIds = useMemo(() => bundlesForCourt(courtName), [courtName]);
  const already = useMemo(() => new Set(existingRequests.filter(r => r && !r.fulfilled).map(r => r.documentLabel)), [existingRequests]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(
    CORRECTION_PREP_BUNDLES.filter(b => autoIds.includes(b.id)).flatMap(b => b.items.map(i => i.key)),
  ));
  const [saving, setSaving] = useState(false);

  const toggle = (key: string) => setPicked(prev => {
    const n = new Set(prev);
    if (n.has(key)) n.delete(key); else n.add(key);
    return n;
  });

  const send = async () => {
    if (!onAddRequests) return;
    const now = new Date().toISOString();
    const items = CORRECTION_PREP_BUNDLES.flatMap(b => b.items).filter(i => picked.has(i.key) && !already.has(i.label));
    if (items.length === 0) { toast.info('새로 요청할 항목이 없어요. 이미 요청한 항목은 다시 보내지 않아요.'); return; }
    const next: DocumentRequest[] = items.map((i, idx) => ({
      id: `prep-${i.key}-${Date.now()}-${idx}`,
      requestedBy,
      requestedAt: now,
      documentLabel: i.label,
      description: i.description,
      isCustom: true,
    }));
    setSaving(true);
    try {
      await onAddRequests([...existingRequests, ...next]);
      toast.success(`${next.length}개 자료를 의뢰인에게 요청했어요. 의뢰인 '내 사건' 서류 요청에 보여요.`);
    } catch {
      toast.error('요청을 저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between gap-3 text-left active:scale-[0.99]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <ClipboardList className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <span className="text-sm font-bold text-slate-800 whitespace-nowrap">보정 때 자주 요구된 자료 미리 받기</span>
          {courtName && <span className="text-xs text-slate-500 truncate">({courtName})</span>}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          <p className="text-xs text-slate-500">
            실제 보정권고에서 의뢰인이 다시 내야 했던 자료입니다. 접수 전에 받아 두면 보정 기간을 줄일 수 있어요. 필요한 것만 골라 요청하세요.
          </p>
          {CORRECTION_PREP_BUNDLES.map(b => (
            <div key={b.id}>
              <p className="text-xs font-bold text-slate-700 mb-1">
                {b.title}{autoIds.includes(b.id) && b.id !== 'common' ? ' · 이 사건 법원' : ''}
              </p>
              <ul className="space-y-1">
                {b.items.map(i => {
                  const sent = already.has(i.label);
                  return (
                    <li key={i.key}>
                      <label className={`flex items-start gap-2 p-2 rounded-xl border text-xs ${sent ? 'bg-slate-50 border-slate-200 text-slate-500' : 'border-slate-200 hover:bg-slate-50 cursor-pointer'}`}>
                        <input type="checkbox" className="mt-0.5" disabled={sent} checked={sent || picked.has(i.key)} onChange={() => toggle(i.key)} />
                        <span>
                          <span className="font-bold text-slate-800">{i.label}</span>
                          {sent && <span className="ml-1 text-slate-500">(요청함)</span>}
                          <span className="block text-slate-500">{i.description}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={send}
              disabled={saving || !onAddRequests}
              className="min-h-[44px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? '요청 저장 중…' : '고른 자료 요청하기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
