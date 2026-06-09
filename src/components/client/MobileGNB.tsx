import React from 'react';
import { Home, PlusCircle, MessageSquare, BookOpen } from 'lucide-react';
import { Activity } from 'lucide-react';

interface MobileGNBProps {
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  onRequestConsult: () => void;
}

export default function MobileGNB({ activeTab, onSetActiveTab, onRequestConsult }: MobileGNBProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex items-center justify-around py-2.5 pb-safe-bottom shadow-lg">
      {/* 홈 */}
      <button
        onClick={() => onSetActiveTab('landing')}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors ${
          activeTab === 'landing' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] tracking-tight">홈</span>
      </button>



      {/* 성공후기 */}
      <button
        onClick={() => onSetActiveTab('reviews')}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
          activeTab === 'reviews' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
        }`}
      >
        <BookOpen className="w-5 h-5" />
        <span className="text-[10px] tracking-tight">성공 후기</span>
      </button>

      {/* 상담신청 */}
      <button
        onClick={onRequestConsult}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors ${
          activeTab === 'request' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
        }`}
      >
        <PlusCircle className="w-5 h-5" />
        <span className="text-[10px] tracking-tight">상담 신청</span>
      </button>

      {/* 내상담 */}
      <button
        onClick={() => onSetActiveTab('chat')}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
          activeTab === 'chat' ? 'text-brand font-extrabold' : 'text-[#7e7e8f] dark:text-slate-500 hover:text-[#484760]'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] tracking-tight">내 상담방</span>
        <span className="absolute top-1.5 right-4.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
        </span>
      </button>
    </nav>
  );
}
