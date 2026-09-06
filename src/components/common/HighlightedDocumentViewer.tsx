import React from 'react';

interface Props {
  content: string;
  className?: string;
  requiredConfirmationText?: string;
}

/**
 * 형광펜 마킹(==노랑==, ==g:연두==, ==o:주황==) 및 볼드(**굵게**)를
 * 금융·보험사 수준의 정밀한 법률 문서 스타일로 렌더링하는 뷰어
 */
export const HighlightedDocumentViewer: React.FC<Props> = ({
  content,
  className = '',
  requiredConfirmationText,
}) => {
  if (!content) return null;

  // 파싱 로직: ==g:내용==, ==o:내용==, ==내용==, **볼드**
  const parseLine = (line: string, lineIdx: number) => {
    // 빈 줄인 경우 줄바꿈 유지
    if (!line.trim()) {
      return <div key={lineIdx} className="h-3" />;
    }

    // 정규식 분할: (==g:.*?==)|(==o:.*?==)|(==.*?==)|(\*\*.*?\*\*)
    const regex = /(==g:.*?==|==o:.*?==|==.*?==|\*\*.*?\*\*)/g;
    const parts = line.split(regex);

    return (
      <p key={lineIdx} className="leading-relaxed whitespace-pre-wrap">
        {parts.map((part, partIdx) => {
          if (!part) return null;

          // 연두 형광펜 ==g:텍스트==
          if (part.startsWith('==g:') && part.endsWith('==')) {
            const inner = part.slice(4, -2);
            return (
              <mark
                key={partIdx}
                className="bg-emerald-100/90 text-emerald-950 font-bold px-1 py-0.5 rounded-sm mx-0.5 border-b-2 border-emerald-400 shadow-xs select-text"
              >
                {inner}
              </mark>
            );
          }

          // 주황/적색 형광펜 ==o:텍스트==
          if (part.startsWith('==o:') && part.endsWith('==')) {
            const inner = part.slice(4, -2);
            return (
              <mark
                key={partIdx}
                className="bg-amber-100 text-amber-950 font-black px-1 py-0.5 rounded-sm mx-0.5 border-b-2 border-amber-400 shadow-xs select-text"
              >
                {inner}
              </mark>
            );
          }

          // 기본 노란 형광펜 ==텍스트==
          if (part.startsWith('==') && part.endsWith('==')) {
            const inner = part.slice(2, -2);
            return (
              <mark
                key={partIdx}
                className="bg-yellow-200/90 text-amber-950 font-bold px-1.5 py-0.5 rounded-sm mx-0.5 border-b-2 border-yellow-400 shadow-xs select-text"
              >
                {inner}
              </mark>
            );
          }

          // 볼드 **텍스트**
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            return (
              <strong key={partIdx} className="font-black text-slate-900">
                {inner}
              </strong>
            );
          }

          return <span key={partIdx}>{part}</span>;
        })}
      </p>
    );
  };

  const lines = content.split('\n');

  return (
    <div className={`text-xs sm:text-sm text-slate-800 space-y-1 font-sans ${className}`}>
      {lines.map((line, idx) => parseLine(line, idx))}

      {requiredConfirmationText && (
        <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
          <span className="font-black shrink-0 px-2 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px]">
            필수 자필확약 문구
          </span>
          <span className="leading-relaxed">
            고객 제출 시 직접 타이핑 요구: <strong className="underline decoration-amber-500 underline-offset-2">"{requiredConfirmationText}"</strong>
          </span>
        </div>
      )}
    </div>
  );
};
