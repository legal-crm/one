import React from 'react';
import { Home, PlusCircle, MessageSquare, Activity } from 'lucide-react';

interface MobileGNBProps {
  activeTab: string;
  onSetActiveTab: (tab: string) => void;
  onRequestConsult: () => void;
  onStartDiagnosis: () => void;
}

export default function MobileGNB({ activeTab, onSetActiveTab, onRequestConsult, onStartDiagnosis }: MobileGNBProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-3 pb-safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {/* 홈 */}
      <button
        onClick={() => onSetActiveTab('landing')}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
          activeTab === 'landing' ? 'text-brand font-bold' : 'text-slate-500 dark:text-slate-500 hover:text-slate-600'
        }`}
      >
        {activeTab === 'landing' && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-brand/10 rounded-full" />}
        <Home className="w-5 h-5 relative z-10" />
        <span className="text-[12px] tracking-tight relative z-10">홈</span>
      </button>

      {/* 채무관리 시작 */}
      <button
        onClick={onStartDiagnosis}
        className="flex flex-col items-center gap-1 flex-1 text-center transition-colors relative text-slate-500 dark:text-slate-500 hover:text-slate-600"
      >
        <Activity className="w-5 h-5" />
        <span className="text-[12px] tracking-tight">채무관리 시작</span>
      </button>

      {/* 무료 전담배정 */}
      <button
        onClick={onRequestConsult}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
          activeTab === 'request' ? 'text-brand font-bold' : 'text-slate-500 dark:text-slate-500 hover:text-slate-600'
        }`}
      >
        {activeTab === 'request' && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-brand/10 rounded-full" />}
        <PlusCircle className="w-5 h-5 relative z-10" />
        <span className="text-[12px] tracking-tight relative z-10">무료 전담배정</span>
      </button>

      {/* 내 관리방 */}
      <button
        onClick={() => onSetActiveTab('chat')}
        className={`flex flex-col items-center gap-1 flex-1 text-center transition-colors relative ${
          activeTab === 'chat' ? 'text-brand font-bold' : 'text-slate-500 dark:text-slate-500 hover:text-slate-600'
        }`}
      >
        {activeTab === 'chat' && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-10 bg-brand/10 rounded-full" />}
        <MessageSquare className="w-5 h-5 relative z-10" />
        <span className="text-[12px] tracking-tight relative z-10">내 관리방</span>
        <span className="absolute top-1.5 right-4.5 flex h-2 w-2 z-20">
          <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand"></span>
        </span>
      </button>
    </nav>
  );
}
