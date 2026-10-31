// 홈 중요 공지 한 줄 (CT-6) — 의뢰인 대상(모두·의뢰인) 중요 공지 중 가장 최근 1건. 닫으면 그 공지는 다시 안 보임
import { useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import type { Notice } from '../../../types';

const KEY = 'mykim_home_notice_closed';

export default function HomeNoticeStrip({ notices, onOpen }: { notices: Notice[]; onOpen: (id: string) => void }) {
  const [closed, setClosed] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } });
  const n = [...notices].filter(x => x.isImportant && !closed.includes(x.id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  if (!n) return null;
  const close = () => {
    const next = [...closed, n.id].slice(-30);
    setClosed(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* 화면 설정이라 실패해도 됨 */ }
  };
  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-2 min-h-[48px]">
        <Megaphone className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
        <button type="button" onClick={() => onOpen(n.id)} className="flex-1 min-w-0 text-left text-sm font-bold text-amber-900 truncate hover:underline min-h-[44px]">
          <span className="sr-only">중요 공지: </span>{n.title}
        </button>
        <button type="button" onClick={close} aria-label="이 공지 닫기" className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-xl text-amber-800 hover:bg-amber-100 active:scale-[0.98]">
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
