/**
 * 상담 채팅 '자주 쓰는 답변' 기본 문구
 *
 * 누르면 입력창에 넣기만 하고 바로 보내지 않는다 (변호사가 검토 후 전송).
 * 결과를 단정하거나 보장하는 표현은 쓰지 않는다 (변호사법 광고 규정, AGENTS Rule 4).
 */
export interface ChatReplyTemplate {
  id: string;
  label: string;
  text: string;
}

export const DEFAULT_CHAT_REPLY_TEMPLATES: ChatReplyTemplate[] = [
  {
    id: 'documents',
    label: '준비서류 안내',
    text: [
      '상담을 이어가려면 아래 서류가 필요합니다.',
      '1) 신분증 사본',
      '2) 최근 3개월 급여명세서 또는 소득 증빙',
      '3) 채권사별 부채증명서',
      '발급이 어려운 서류는 말씀해 주시면 방법을 안내드리겠습니다.',
    ].join('\n'),
  },
  {
    id: 'schedule',
    label: '일정 조율',
    text: '전화 상담이 가능한 시간을 2~3개 알려 주시면 일정을 맞춰 연락드리겠습니다.',
  },
  {
    id: 'fee',
    label: '수임료 안내',
    text: '수임료와 분납 조건은 보내드린 제안서에 정리되어 있습니다. 궁금한 항목을 말씀해 주시면 설명드리겠습니다.',
  },
];
