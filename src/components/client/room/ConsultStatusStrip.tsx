import React from 'react';
import type { ConsultRoomStage } from '../consultFlow';
import type { Tone } from '../ui/feedback';
import { Badge } from '../ui';

/**
 * 내 관리방 맨 위 상태 줄: 지금 단계 + 다음에 할 일 + 주 버튼 1개(필요할 때만)
 */
export interface StageCopyContext {
  requestedCount: number;
  proposalCount: number;
  lawyerName?: string;
}

export function getStageCopy(stage: ConsultRoomStage, ctx: StageCopyContext): { headline: string; description: string } {
  switch (stage) {
    case 'no_check':
      return {
        headline: '내 상황 체크를 먼저 해 주세요',
        description: '약 3분, 이름·연락처 없이 채무·소득을 정리합니다. 결과를 바탕으로 변호사에게 상담을 요청할 수 있어요.',
      };
    case 'choose_lawyers':
      return {
        headline: '상담을 요청할 변호사를 골라 주세요',
        description: '최대 3명에게 요청하고 제안서를 비교할 수 있어요. 보내기 전에 받는 변호사를 확인하고 동의합니다.',
      };
    case 'open_waiting':
      return {
        headline: '공개 요청의 제안서를 기다리고 있어요',
        description: '등록·승인된 변호사가 요청을 확인하고 제안서를 보내면 알려 드릴게요.',
      };
    case 'waiting_reply':
      return {
        headline: `변호사 ${ctx.requestedCount}명의 답변을 기다리고 있어요`,
        description: '변호사가 채무 현황을 검토한 뒤 제안서를 보냅니다. 제안서가 오면 비교하고 상담을 시작할 수 있어요.',
      };
    case 'review_proposals':
      return {
        headline: `제안서 ${ctx.proposalCount}건이 도착했어요`,
        description: '조건을 비교해 보고 이야기를 나눠 볼 변호사의 상담을 시작하세요.',
      };
    case 'comparing':
      return {
        headline: '변호사와 상담하고 있어요',
        description: '대화해 보고 상담을 이어갈 변호사를 정하세요. 정하기 전까지는 여러 변호사와 대화할 수 있어요.',
      };
    case 'counseling':
      return {
        headline: ctx.lawyerName ? `${ctx.lawyerName} 변호사와 상담하고 있어요` : '상담 변호사와 상담하고 있어요',
        description: '제안서 조건으로 안전하게 수임계약을 진행합니다. (온라인 전자서명 · 방문 · 우편)',
      };
    case 'contracted':
      return {
        headline: '수임 계약을 마쳤어요',
        description: '사건 진행과 준비할 서류는 마이페이지에서 확인할 수 있어요. 변호사와의 대화는 이곳에서 이어집니다.',
      };
    case 'closed':
    default:
      return {
        headline: '상담이 종료되었어요',
        description: '새 상담이 필요하면 내 상황 체크를 다시 할 수 있어요.',
      };
  }
}

interface ConsultStatusStripProps {
  stage: ConsultRoomStage;
  status?: { label: string; tone: Tone } | null;
  copy: { headline: string; description: string };
  actions?: React.ReactNode;
  /** 상담 요청이 여러 개일 때 고르는 칸 */
  switcher?: React.ReactNode;
}

export default function ConsultStatusStrip({ status, copy, actions, switcher }: ConsultStatusStripProps) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">내 관리방</h1>
        {status && <Badge tone={status.tone} size="md">{status.label}</Badge>}
        {switcher && <div className="w-full sm:w-auto sm:ml-auto">{switcher}</div>}
      </div>
      <section
        aria-label="지금 단계"
        className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-slate-900 break-keep">{copy.headline}</p>
          <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">{copy.description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </section>
    </header>
  );
}
