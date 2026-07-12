import React from 'react';

interface Notice {
  id: string;
  title: string;
  date: string;
  content: string;
  isImportant: boolean;
}

interface NoticesViewProps {
  notices: Notice[];
  selectedNoticeId: string | null;
  onSetSelectedNoticeId: (id: string | null) => void;
  onGoHome: () => void;
}

export default function NoticesView({ notices, selectedNoticeId, onSetSelectedNoticeId, onGoHome }: NoticesViewProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-left animate-fadeIn">
      {/* Breadcrumb / Go back */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <button onClick={onGoHome} className="hover:text-brand transition-colors font-bold cursor-pointer">홈</button>
        <span>&gt;</span>
        <button onClick={() => onSetSelectedNoticeId(null)} className="hover:text-brand transition-colors font-bold cursor-pointer">공지사항</button>
        {selectedNoticeId && (
          <>
            <span>&gt;</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">상세보기</span>
          </>
        )}
      </div>

      {selectedNoticeId && notices.find(n => n.id === selectedNoticeId) ? (
        // NOTICE DETAIL VIEW
        (() => {
          const notice = notices.find(n => n.id === selectedNoticeId)!;
          return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  {notice.isImportant && (
                    <span className="bg-red-500 text-white font-bold text-[12px] px-2 py-0.5 rounded">중요 공지</span>
                  )}
                  <span className="text-xs text-slate-500 font-mono">{notice.date}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-snug">{notice.title}</h2>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed font-normal">{notice.content}</div>
              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <button onClick={() => onSetSelectedNoticeId(null)} className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-bold transition-all text-slate-600 dark:text-slate-400 cursor-pointer">목록으로 돌아가기</button>
              </div>
            </div>
          );
        })()
      ) : (
        // NOTICE LIST VIEW
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><span>📢</span> 공지사항</h2>
            <p className="text-sm text-slate-600 mt-1">my김변의 새로운 알림 및 정책 변경 사항을 안내해 드립니다.</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notices.map(notice => (
              <div key={notice.id} onClick={() => onSetSelectedNoticeId(notice.id)} className="py-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors flex items-center gap-3 text-left">
                {notice.isImportant && (
                  <span className="bg-red-500 text-white font-bold text-[12px] px-1.5 py-0.5 rounded shrink-0">중요</span>
                )}
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-200 flex-1 truncate hover:underline">{notice.title}</h3>
                <span className="text-xs text-slate-500 font-mono shrink-0">{notice.date}</span>
              </div>
            ))}
            {notices.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">등록된 공지사항이 아직 존재하지 않습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
