import React, { useState } from 'react';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import type { PipelineStage } from './JourneyRail';
import { ConfirmSheet, type SummaryItem } from '../../ui/admin/ConfirmSheet';
import { notifyCaseClient } from '../../../services/notifications/caseClientNotice';
import { toast } from 'sonner';

export interface StageTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromStage: PipelineStage;
  toStage: PipelineStage;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyer: User;
  onConfirm: () => void | Promise<void>;
}

interface TransitionConfig {
  title: string;
  description: string;
  summaryItems: SummaryItem[];
  /** 의뢰인 앱 안내 (이름·금액 없이 진행 사실만) */
  notifyTitle: string;
  notifyBody: string;
}

// 단계 전환 확인 시트.
// 이전: '4대 요건 검토 완료(신청 적격)'·'금지·중지명령 동시 접수 완료' 같은 확인하지 않은 요약과
//       아무 동작도 하지 않는 '자동 준비 항목' 체크, 변호사 브라우저에만 저장되는 의뢰인 알림이 있었다.
// 지금: 저장된 값만 요약하고, 의뢰인 안내는 서버(office_notify_case_client)로 보낸다.
export function StageTransitionModal({
  isOpen,
  onClose,
  fromStage,
  toStage,
  clientRequest,
  crmExt,
  onConfirm,
}: StageTransitionModalProps) {
  const [notifyClient, setNotifyClient] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getTransitionConfig = (): TransitionConfig => {
    switch (fromStage) {
      case 1:
        return {
          title: '1단계(상담·제안) 완료 → 수임 계약',
          description: '상담과 제안을 마치고 수임 계약 단계로 넘어갈까요?',
          summaryItems: [
            { label: '의뢰인', value: clientRequest.clientName || '-' },
            ...(clientRequest.financialProfile?.debtTotal
              ? [{ label: '총 채무액(의뢰인 정리)', value: `${clientRequest.financialProfile.debtTotal.toLocaleString()}만원` }]
              : []),
          ],
          notifyTitle: '상담이 다음 단계로 넘어갔어요',
          notifyBody: '담당 사무소가 수임 계약을 준비하고 있어요.',
        };
      case 2:
        return {
          title: '2단계(수임 계약) 완료 → 서류 준비',
          description: '계약을 마치고 서류 준비 단계로 넘어갈까요?',
          summaryItems: [
            ...(crmExt?.totalFee ? [{ label: '약정 수임료', value: `${crmExt.totalFee.toLocaleString()}만원` }] : []),
            ...(crmExt?.contractDate ? [{ label: '계약일', value: crmExt.contractDate }] : []),
          ],
          notifyTitle: '서류 준비를 시작해요',
          notifyBody: "필요한 서류 안내는 '내 사건'에서 확인할 수 있어요.",
        };
      case 3:
        return {
          title: '3단계(서류 준비) 완료 → 신청서 작성',
          description: '서류 준비를 마치고 신청서 작성 단계로 넘어갈까요?',
          summaryItems: [],
          notifyTitle: '신청서 작성을 시작해요',
          notifyBody: '보내 주신 서류로 법원에 낼 신청서를 준비하고 있어요.',
        };
      case 4:
        return {
          title: '4단계(신청·접수) 완료 → 보정·개시',
          description: '법원 접수를 기록하고 다음 단계로 넘어갈까요?',
          summaryItems: [
            ...(crmExt?.courtCase?.courtName ? [{ label: '법원', value: crmExt.courtCase.courtName }] : []),
            ...(crmExt?.courtCase?.caseNumber ? [{ label: '사건번호', value: crmExt.courtCase.caseNumber }] : []),
          ],
          notifyTitle: '법원에 신청서를 냈어요',
          notifyBody: "앞으로 법원 진행 상황은 '내 사건'에서 볼 수 있어요.",
        };
      case 5:
        return {
          title: '5단계(보정·개시) 완료 → 변제·면책',
          description: '법원 결정을 기록하고 다음 단계로 넘어갈까요?',
          summaryItems: [],
          notifyTitle: '법원 결정이 기록됐어요',
          notifyBody: '다음 일정과 납부 안내는 담당 사무소 안내를 확인해 주세요.',
        };
      default:
        return {
          title: `${fromStage}단계 완료 → ${toStage}단계`,
          description: '다음 단계로 넘어갈까요?',
          summaryItems: [],
          notifyTitle: '사건이 다음 단계로 넘어갔어요',
          notifyBody: "진행 상황은 '내 사건'에서 볼 수 있어요.",
        };
    }
  };

  const config = getTransitionConfig();

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // 1. 단계 변경 (상태 저장·파이프라인 이동)
      await onConfirm();
      // 2. 의뢰인 앱 안내 (서버). 실패해도 단계 변경은 이미 끝났으니 결과만 알린다
      if (notifyClient) {
        const res = await notifyCaseClient({
          caseKey: clientRequest.id,
          kind: 'office_status',
          title: config.notifyTitle,
          body: config.notifyBody,
        });
        if (!res.ok) toast.error(res.message);
        else if (!res.delivered) toast.info(res.message);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmSheet
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      description={config.description}
      tone="brand"
      summaryItems={config.summaryItems}
      notifyClient={notifyClient}
      onNotifyClientChange={setNotifyClient}
      notifyPreview={`${config.notifyTitle} — ${config.notifyBody}`}
      confirmLabel={`${toStage}단계로 진행`}
      cancelLabel="취소"
      isConfirming={isSubmitting}
      onConfirm={handleConfirm}
    />
  );
}
