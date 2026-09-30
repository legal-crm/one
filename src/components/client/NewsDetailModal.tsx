import React from 'react';
import { ArrowRight } from 'lucide-react';
import { NewsArticle } from '../../types';
import { Badge, Button, Modal } from './ui';

interface NewsDetailModalProps {
  article: NewsArticle;
  lawyers: { id: string; name: string; avatar: string; bio: string; matchedCount?: number; fields?: string[] }[];
  onClose: () => void;
  onConsultWithLawyer: (lawyerId: string, lawyerName: string, articleTitle: string) => void;
}

/**
 * 법률 정보 글 상세 (키트 Modal: 모바일 전체 화면, ESC·포커스 관리)
 * - 글쓴 변호사를 목록에서 찾은 경우에만 상담 요청 버튼을 보인다(다른 변호사로 대체하지 않는다)
 * - 이전: '📞 ○○ 변호사에게 1:1 상담 예약' — 예약이 아니라 상담 요청이므로 문구를 바로잡음. 근거 없는 조회수 표시 제거
 */
export default function NewsDetailModal({ article, lawyers, onClose, onConsultWithLawyer }: NewsDetailModalProps) {
  const author = article.authorId ? lawyers.find((l) => l.id === article.authorId) : undefined;
  const authorName = String(author?.name || article.authorName || '').replace(/\s*변호사$/, '');

  return (
    <Modal
      open
      onClose={onClose}
      title={article.title}
      size="lg"
      mobile="fullscreen"
      closeLabel="글 닫기"
      meta={
        <>
          <Badge tone="brand">{article.category}</Badge>
          {article.date && <span className="text-sm text-slate-600">{article.date}</span>}
        </>
      }
      footer={
        author ? (
          <>
            <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
              닫기
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => onConsultWithLawyer(author.id, author.name, article.title)}
              rightIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
            >
              {authorName} 변호사에게 상담 요청
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
            닫기
          </Button>
        )
      }
    >
      {article.imageUrl && (
        <div className="-mx-5 -mt-5 mb-5 aspect-video overflow-hidden bg-slate-100 sm:-mx-6 sm:rounded-none">
          <img src={article.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {article.excerpt && (
        <p className="rounded-xl border-l-4 border-brand bg-slate-50 px-4 py-3 text-base font-bold leading-relaxed text-slate-800 break-keep">
          {article.excerpt}
        </p>
      )}
      <div className="mt-5 text-base leading-relaxed text-slate-800 whitespace-pre-wrap break-keep">{article.content}</div>

      {authorName && (
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          {author?.avatar || article.authorAvatar ? (
            <img src={author?.avatar || article.authorAvatar} alt="" className="h-12 w-12 shrink-0 rounded-full border border-slate-200 bg-white object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white" aria-hidden="true">
              {authorName.charAt(0)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm text-slate-600">글쓴이</p>
            <p className="text-base font-bold text-slate-900">{authorName} {author ? '변호사' : ''}</p>
            {author?.fields && author.fields.length > 0 && <p className="text-sm text-slate-600">{author.fields.join(' · ')}</p>}
          </div>
        </div>
      )}

      <p className="mt-6 text-sm leading-relaxed text-slate-600 break-keep">
        일반적인 법률 정보이며 개별 사건에 대한 법률 자문이 아니에요. 내 상황은 변호사 상담으로 확인하세요.
      </p>
    </Modal>
  );
}
