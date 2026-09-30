import type { ClientQA, QAAnswer } from '../../types';

/**
 * 상담 사례(Q&A) 표시 규칙
 * - 변호사가 변호사 화면(LawyerQnAAnswerSection)에서 실제로 단 답변만 변호사 이름을 표시한다(lawyerId + 답변 시각).
 * - 그 밖(시드 데이터 등)은 '답변 예시'로 표시한다 — 가상의 변호사 명의·사진·'전문' 배지를 노출하지 않는다.
 */
export const isVerifiedQaAnswer = (qa: Pick<ClientQA, 'lawyerId' | 'answeredAt'>) => Boolean(qa.lawyerId && qa.answeredAt);

export const isVerifiedExtraAnswer = (a: Pick<QAAnswer, 'lawyerId' | 'createdAt'>) => Boolean(a.lawyerId && a.createdAt);

/** 이 기기에서 쓴 질문(게시판 질문은 변호사에게 전달되지 않는다) */
export const isLocalQuestion = (qa: ClientQA, authorId: string) => !!qa.authorId && qa.authorId === authorId;
