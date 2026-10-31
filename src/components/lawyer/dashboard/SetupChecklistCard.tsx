import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ListChecks, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';

/**
 * 처음 쓰는 사무소 '시작하기' (HM-7)
 * 완료 여부는 서버가 실제 데이터로 판정한다(office_setup_checklist) — 사람이 체크하지 않는다.
 * 꼭 필요한 항목을 다 하면 저절로 사라지고, 닫으면 이 기기에서 7일 동안 숨긴다(화면 설정).
 */
interface Item { key: string; label: string; done: boolean; optional?: boolean; link: string; detail?: string[] }

const HIDE_KEY = 'mykim_setup_checklist_hidden_until';
const MISSING_LABEL: Record<string, string> = {
  name: '실명', firm: '사무소명', region: '시·도', photo: '본인 사진', fields: '분야', bio: '소개 50자',
};

export default function SetupChecklistCard({ officeId, onOpen }: { officeId: string; onOpen: (key: string) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [hidden, setHidden] = useState(() => {
    try { return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now(); } catch { return false; }
  });

  useEffect(() => {
    if (!isSupabaseConfigured || hidden) return;
    let cancelled = false;
    void supabase.rpc('office_setup_checklist', { p_office_id: officeId }).then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data)) return;
      setItems(data as Item[]);
    });
    return () => { cancelled = true; };
  }, [officeId, hidden]);

  if (hidden || !items) return null;
  const required = items.filter(i => !i.optional);
  if (required.every(i => i.done)) return null;
  const doneCount = items.filter(i => i.done).length;

  const hide = () => {
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + 7 * 86400000)); } catch { /* 화면 설정 */ }
    setHidden(true);
  };

  return (
    <section aria-labelledby="setup-title" className="rounded-2xl border border-brand/20 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="setup-title" className="text-base font-black text-slate-900 flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-brand" aria-hidden="true" /> 시작하기 ({doneCount}/{items.length})
          </h3>
          <p className="text-sm text-slate-600 mt-1">의뢰인을 받기 전에 아래를 채워 주세요. 저장하면 자동으로 완료로 바뀌어요.</p>
        </div>
        <button type="button" onClick={hide} aria-label="시작하기 7일 동안 숨기기" className="min-h-11 min-w-11 rounded-xl text-slate-400 hover:text-slate-700">
          <X className="w-4 h-4 mx-auto" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map(i => (
          <li key={i.key}>
            <button type="button" onClick={() => onOpen(i.link)}
              className={`w-full min-h-12 px-3 rounded-xl border text-left flex items-center gap-3 active:scale-[0.99] ${i.done ? 'border-slate-100 bg-slate-50 text-slate-500' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'}`}>
              {i.done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
                : <Circle className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />}
              <span className="flex-1 min-w-0 text-sm font-bold">
                {i.label}
                {!i.done && i.key === 'profile' && i.detail && i.detail.length > 0 && (
                  <span className="block text-xs font-medium text-amber-700">남은 칸: {i.detail.map(d => MISSING_LABEL[d] || d).join(' · ')}</span>
                )}
              </span>
              <span className="sr-only">{i.done ? '완료' : '할 일'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
