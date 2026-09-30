import React from 'react';
import { ChevronRight, Megaphone } from 'lucide-react';
import { Badge, Button, Card, EmptyState, PageHeader } from './ui';

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

/** 공지사항 (목록 → 상세). 콘텐츠 페이지 공통 머리(PageHeader)·빈 상태를 쓴다 */
export default function NoticesView({ notices, selectedNoticeId, onSetSelectedNoticeId, onGoHome }: NoticesViewProps) {
  const selected = selectedNoticeId ? notices.find((n) => n.id === selectedNoticeId) : undefined;
  // 중요 공지를 먼저
  const sorted = [...notices].sort((a, b) => Number(!!b.isImportant) - Number(!!a.isImportant));

  const open = (id: string | null) => {
    onSetSelectedNoticeId(id);
    window.scrollTo({ top: 0 });
  };

  if (selected) {
    return (
      <div className="mx-auto max-w-3xl animate-fadeIn text-left">
        <PageHeader back={{ label: '공지 목록', onClick: () => open(null) }} title={selected.title}>
          <div className="flex flex-wrap items-center gap-2">
            {selected.isImportant && <Badge tone="danger">중요 공지</Badge>}
            <span className="text-sm text-slate-600">{selected.date}</span>
          </div>
        </PageHeader>
        <Card as="article" className="text-base leading-relaxed text-slate-800 whitespace-pre-line break-keep">
          {selected.content}
        </Card>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => open(null)}>
            목록으로
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn text-left">
      <PageHeader title="공지사항" description="my김변의 새 소식과 정책 변경을 알려 드려요." />
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title="등록된 공지가 없어요"
          description="새 소식이 생기면 이곳에 올려 드릴게요."
          action={<Button variant="secondary" onClick={onGoHome}>홈으로</Button>}
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {sorted.map((notice) => (
              <li key={notice.id}>
                <button
                  type="button"
                  onClick={() => open(notice.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  {notice.isImportant && <Badge tone="danger" className="shrink-0">중요</Badge>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-slate-900">{notice.title}</span>
                    <span className="mt-0.5 block text-sm text-slate-600">{notice.date}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
