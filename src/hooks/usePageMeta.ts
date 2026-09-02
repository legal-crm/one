import { useEffect } from 'react';

/**
 * [SEO] SPA 탭 전환 시 document.title과 meta 태그를 동적으로 갱신하는 훅.
 * 구글봇이 각 탭을 독립 페이지로 인식할 수 있도록 합니다.
 */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    // title 갱신
    document.title = title;

    // meta description 갱신
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);

    // OG tags 갱신
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);

    // Twitter Card 갱신
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', title);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', description);
  }, [title, description]);
}

/** 탭별 SEO 메타 데이터 정의 */
export const TAB_META: Record<string, { title: string; description: string }> = {
  landing: {
    title: 'my김변(마이김변) — 채무 정보 정리 후 변호사를 직접 선택하세요',
    description: '채무 정보를 정리하고, 상담을 원하는 변호사를 직접 선택하세요. 익명 진단부터 변호사 선택까지, 채무상담 플랫폼 my김변.',
  },
  request: {
    title: '익명 채무 진단 | 내 상황 체크하기 | my김변',
    description: '익명으로 채무 상황을 정리하고 나에게 맞는 해결 방향을 확인합니다.',
  },
  lawyers: {
    title: '변호사 상담 & 선택 | 도산 전문 변호사 | my김변',
    description: '상담을 원하는 도산 전문 변호사를 직접 비교하고 선택하세요.',
  },
  chat: {
    title: '내 관리방 | 변호사 상담 | my김변',
    description: '선택한 변호사와 비공개 상담방에서 소통합니다.',
  },
  calculator: {
    title: '변제금 계산기 | 개인회생 시뮬레이션 | my김변',
    description: '예상 변제금과 탕감 금액을 미리 계산해볼 수 있습니다.',
  },
  reviews: {
    title: '이용 후기 | 실제 상담 경험 | my김변',
    description: '실제 이용자들의 채무 상담 경험과 후기를 확인하세요.',
  },
  qna: {
    title: '채무 고민상담 Q&A | 변호사 무료 답변 | my김변',
    description: '채무 관련 궁금한 점을 질문하고 전문 변호사 답변을 받으세요.',
  },
  news: {
    title: '채무 관련 뉴스 & 판례 | my김변',
    description: '개인회생·파산 관련 최신 뉴스와 판례 정보를 제공합니다.',
  },
  notices: {
    title: '공지사항 | my김변',
    description: 'my김변 서비스 공지사항 및 업데이트 안내.',
  },
  inquiry: {
    title: '1:1 문의 | my김변',
    description: '서비스 이용 중 궁금한 점을 1:1로 문의하세요.',
  },
  guide: {
    title: '서비스 이용안내 | my김변',
    description: 'my김변 서비스 이용 방법을 안내합니다.',
  },
  mypage: {
    title: '마이페이지 | my김변',
    description: '내 상담 내역과 계정 정보를 관리합니다.',
  },
};
