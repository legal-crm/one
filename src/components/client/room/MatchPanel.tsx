import React from 'react';
import { Check, Clock, Globe, ListChecks, MessageCircle, Scale, Sparkles, Trash2, UserCheck } from 'lucide-react';
import type { ConsultProposal, User as UserType } from '../../../types';
import { cn } from '../../../utils/cn';
import { Badge, Button, EmptyState } from '../ui';
import { authoredRemark } from '../proposalText';
import type { ConsultRoomStage } from '../consultFlow';
import { getDisplayName } from '../lawyerDirectory';
import ProposalCompareTable from './ProposalCompareTable';

/**
 * 내 관리방 '요청·제안' 영역
 * - 요청한 변호사(답변 대기)·도착한 제안서·상담 변호사를 한 목록에서 보여 준다
 * - 제안서 카드마다 [제안서 보기][상담 시작 또는 대화하기] 두 가지만 둔다
 */
interface MatchPanelProps {
  stage: ConsultRoomStage;
  proposals: ConsultProposal[];
  /** 요청했지만 아직 제안서를 보내지 않은 변호사 */
  waitingLawyers: UserType[];
  lawyers: UserType[];
  acceptedLawyerIds: string[];
  selectedLawyerId?: string;
  slotsLeft: number;
  onAddLawyers: () => void;
  onCancelRequest: (lawyer: UserType) => void;
  onViewProposal: (proposal: ConsultProposal) => void;
  onStartConsult: (proposal: ConsultProposal) => void;
  onOpenChatWith: (lawyerId: string) => void;
  onCancelConfirmed: () => void;
  onPurge?: () => void;
}

function Avatar({ src, name }: { src?: string; name: string }) {
  return src ? (
    <img src={src} alt="" className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0" />
  ) : (
    <div className="w-11 h-11 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold shrink-0" aria-hidden="true">
      {name.charAt(0)}
    </div>
  );
}

export default function MatchPanel({
  stage,
  proposals,
  waitingLawyers,
  lawyers,
  acceptedLawyerIds,
  selectedLawyerId,
  slotsLeft,
  onAddLawyers,
  onCancelRequest,
  onViewProposal,
  onStartConsult,
  onOpenChatWith,
  onCancelConfirmed,
  onPurge,
}: MatchPanelProps) {
  const canAddMore = slotsLeft > 0 && (stage === 'waiting_reply' || stage === 'review_proposals' || stage === 'comparing');

  const renderEmpty = () => {
    if (stage === 'no_check') {
      return (
        <EmptyState
          compact
          icon={<ListChecks className="w-6 h-6" />}
          title="내 상황 체크를 마치면 변호사에게 요청할 수 있어요"
          description="체크 결과를 받는 변호사를 확인하고 동의한 뒤 보냅니다."
        />
      );
    }
    if (stage === 'open_waiting') {
      return (
        <div className="rounded-2xl border border-brand/20 bg-brand-light/60 p-4 flex items-start gap-3">
          <Globe className="w-5 h-5 text-brand mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm leading-relaxed break-keep">
            <p className="font-bold text-slate-900">공개 요청을 올렸어요</p>
            <p className="text-slate-700">등록·승인된 변호사가 요청을 확인하고 제안서를 보내면 이곳에 표시됩니다. 실명과 연락처는 공개되지 않습니다.</p>
          </div>
        </div>
      );
    }
    return (
      <EmptyState
        compact
        icon={<Scale className="w-6 h-6" />}
        title="아직 상담을 요청한 변호사가 없어요"
        description="변호사를 최대 3명까지 골라 요청하면, 변호사가 채무 현황을 검토한 뒤 제안서를 보냅니다."
      />
    );
  };

  const hasContent = proposals.length > 0 || waitingLawyers.length > 0;

  return (
    // 넓은 칸(주 영역)에서는 제안서를 2열로, 좁은 옆 칸에서는 1열로 (컨테이너 너비 기준)
    <div className="@container space-y-5">
      {!hasContent && renderEmpty()}

      <ProposalCompareTable proposals={proposals} />

      {proposals.length > 0 && (
        <section aria-labelledby="room-proposals-title" className="space-y-3">
          <h3 id="room-proposals-title" className="text-sm font-bold text-slate-900">
            도착한 제안서 <span className="text-slate-500">{proposals.length}건</span>
          </h3>
          <ul className="grid grid-cols-1 @2xl:grid-cols-2 gap-3">
            {proposals.map((p) => {
              const isAI = !!(
                p.proposalData?.aiInsights?.isAIPremium ||
                (p as any).aiInsights?.isAIPremium ||
                lawyers.find((l) => l.id === p.lawyerId)?.aiCaseAnalysisEnabled
              );
              const accepted = acceptedLawyerIds.includes(p.lawyerId) || selectedLawyerId === p.lawyerId;
              const isChosen = stage === 'counseling' && selectedLawyerId === p.lawyerId;
              const isOther = (stage === 'counseling' || stage === 'contracted') && !!selectedLawyerId && selectedLawyerId !== p.lawyerId;
              const remark = authoredRemark(p.remark);
              return (
                <li key={p.id} className={cn('rounded-2xl border bg-white p-4 space-y-3', isChosen ? 'border-brand ring-2 ring-brand/15' : 'border-slate-200')}>
                  <div className="flex items-start gap-3">
                    <Avatar src={p.lawyerAvatar} name={p.lawyerName} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{p.lawyerName} 변호사</p>
                      {p.firmName && <p className="text-xs text-slate-600 truncate">{p.firmName}</p>}
                    </div>
                    {isChosen ? (
                      <Badge tone="brand" icon={<UserCheck className="w-3 h-3" aria-hidden="true" />}>상담 변호사</Badge>
                    ) : isOther ? (
                      <Badge tone="neutral">상담 종료</Badge>
                    ) : accepted ? (
                      <Badge tone="info" icon={<MessageCircle className="w-3 h-3" aria-hidden="true" />}>상담 중</Badge>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <dt className="text-xs font-bold text-slate-600">월 변제금</dt>
                      <dd className="text-sm font-extrabold text-slate-900 tabular-nums">{p.monthlyPayment}만원</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <dt className="text-xs font-bold text-slate-600">감면율</dt>
                      <dd className="text-sm font-extrabold text-slate-900 tabular-nums">{p.reductionRate}%</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                      <dt className="text-xs font-bold text-slate-600">수임료</dt>
                      <dd className="text-sm font-extrabold text-slate-900 tabular-nums">{p.fee ? `${p.fee}만원` : '제안서 참고'}</dd>
                    </div>
                  </dl>
                  {p.installment && <p className="text-xs text-slate-600">분납: {p.installment}</p>}
                  <p className={cn('rounded-xl px-3 py-2.5 text-sm leading-relaxed break-keep', remark ? 'bg-brand-light text-slate-800' : 'bg-slate-50 text-slate-600')}>
                    {remark ? `“${remark}”` : '변호사가 아직 소견을 작성하지 않았습니다.'}
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                    {isAI ? <Sparkles className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" /> : <Scale className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
                    {isAI ? 'AI 분석 리포트 포함' : '변호사가 직접 작성한 제안서'}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="md" onClick={() => onViewProposal(p)} className="flex-1">
                      제안서 보기
                    </Button>
                    {!isOther && (accepted ? (
                      <Button size="md" onClick={() => onOpenChatWith(p.lawyerId)} leftIcon={<MessageCircle className="w-4 h-4" aria-hidden="true" />} className="flex-1">
                        대화하기
                      </Button>
                    ) : (
                      <Button size="md" onClick={() => onStartConsult(p)} className="flex-1">
                        상담 시작
                      </Button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {waitingLawyers.length > 0 && (
        <section aria-labelledby="room-waiting-title" className="space-y-3">
          <h3 id="room-waiting-title" className="text-sm font-bold text-slate-900">
            답변을 기다리는 변호사 <span className="text-slate-500">{waitingLawyers.length}명</span>
          </h3>
          <ul className="space-y-2">
            {waitingLawyers.map((l) => {
              const name = getDisplayName(l);
              return (
                <li key={l.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                  <Avatar src={l.avatarData || l.avatar} name={name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{name} 변호사</p>
                    <div className="mt-1 flex items-center gap-2 min-w-0">
                      <Badge tone="warning" icon={<Clock className="w-3 h-3" aria-hidden="true" />}>확인 대기</Badge>
                      <span className="text-xs text-slate-600 truncate">{[l.firmName, l.region].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancelRequest(l)}
                    className="shrink-0 min-h-11 px-2.5 -mr-1 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 whitespace-nowrap"
                  >
                    요청 취소
                    <span className="sr-only">: {name} 변호사</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-slate-600 break-keep">변호사가 채무 현황을 검토한 뒤 제안서를 보내면 알림으로 알려 드려요.</p>
        </section>
      )}

      {canAddMore && (
        <Button variant="secondary" fullWidth onClick={onAddLawyers} leftIcon={<ListChecks className="w-4 h-4" aria-hidden="true" />}>
          변호사 더 고르기 ({slotsLeft}명 더 가능)
        </Button>
      )}

      {stage === 'counseling' && selectedLawyerId && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
          <p className="flex-1 text-sm text-slate-700 break-keep">
            상담 변호사를 정했어요. 다른 변호사와 다시 비교하려면 확정을 취소하세요.
          </p>
          <button
            type="button"
            onClick={onCancelConfirmed}
            className="shrink-0 min-h-11 px-3 rounded-xl text-sm font-bold text-red-700 hover:bg-red-50 whitespace-nowrap"
          >
            확정 취소
          </button>
        </div>
      )}

      {onPurge && (
        <div className="pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onPurge}
            className="min-h-11 inline-flex items-center gap-1.5 px-2 -ml-2 rounded-xl text-sm font-bold text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            이 상담 기록 삭제
          </button>
          <p className="text-xs text-slate-500 break-keep">대화·제안서·체크 정보가 서버와 이 기기에서 삭제되며 되돌릴 수 없습니다.</p>
        </div>
      )}
    </div>
  );
}
