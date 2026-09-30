import React from 'react';
import { Callout, Modal } from '../ui';
import { HighlightedDocumentViewer } from '../../common/HighlightedDocumentViewer';

/**
 * 계약 문서·약관 전문 리더 (모바일 전체 화면, 데스크톱 넓은 창)
 * - 이전: 계약서가 256px 상자 안에서 12px 글씨로 보였다 → 본문 15~16px, 줄 간격 넓게
 * - 공용 HighlightedDocumentViewer(변호사 화면과 공유)는 그대로 두고, 글자 크기만 바깥에서 키운다
 */
export interface SignReaderDoc {
  title: string;
  description?: string;
  content: string;
  /** contract: 형광펜·굵게 표기가 있는 계약 문서 · terms: 약관 전문(일반 글) */
  kind: 'contract' | 'terms';
  /** 이 문서에 지정된 직접 입력 확인 문구 */
  confirmationText?: string;
}

export default function SignDocReader({
  doc,
  onClose,
  footer,
}: {
  doc: SignReaderDoc | null;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={doc?.title}
      description={doc?.description}
      size="lg"
      mobile="fullscreen"
      footer={footer}
      closeLabel="문서 닫기"
    >
      {doc &&
        (doc.kind === 'contract' ? (
          <div className="text-slate-800 [&_p]:text-[15px] [&_p]:leading-7 sm:[&_p]:text-base">
            <HighlightedDocumentViewer content={doc.content} />
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-[15px] leading-7 text-slate-800 break-keep [overflow-wrap:anywhere] sm:text-base">
            {doc.content}
          </div>
        ))}
      {doc?.confirmationText && (
        <Callout tone="info" className="mt-6" title="직접 입력할 확인 문구가 있어요">
          서명하기 전에 “{doc.confirmationText}” 문구를 그대로 입력하는 단계가 있어요.
        </Callout>
      )}
    </Modal>
  );
}
