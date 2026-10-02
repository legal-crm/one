import React, { useState } from 'react';
import type { ConsultRequest, CrmClientExtension, User } from '../../../types';
import type { PipelineStage } from './JourneyRail';
import { ConfirmSheet, type SummaryItem, type AutoActionItem } from '../../ui/admin/ConfirmSheet';
import { addClientNotification } from '../../../services/clientNotificationService';

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

export function StageTransitionModal({
  isOpen,
  onClose,
  fromStage,
  toStage,
  clientRequest,
  crmExt,
  activeLawyer,
  onConfirm,
}: StageTransitionModalProps) {
  const [notifyClient, setNotifyClient] = useState(true);
  const [actionChecks, setActionChecks] = useState<Record<string, boolean>>({
    action1: true,
    action2: true,
    action3: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 단계별 전환 컨피그
  const getTransitionConfig = () => {
    switch (fromStage) {
      case 1:
        return {
          title: '1단계(상담·제안) 완료 및 수임계약 진행',
          description: '의뢰인과의 초기 상담 및 솔루션 제안이 완료되었습니다. 정식 사건 위임계약 단계로 전진하시겠습니까?',
          summaryItems: [
            { label: '의뢰인', value: `${clientRequest.clientName} (${clientRequest.category === 'business' ? '영업소득자' : '급여소득자'})` },
            { label: '총 채무액', value: `${(clientRequest.financialProfile?.debtTotal || 0).toLocaleString()}만원` },
            { label: '적격성 판정', value: '4대 요건 검토 완료 (신청 적격)' },
          ],
          notifyPreview: `[상담 완료 안내] ${clientRequest.clientName}님과의 초기 상담 및 솔루션 제안이 완료되어 정식 사건 위임계약 단계로 진행합니다.`,
          autoActions: [
            { id: 'action1', label: '상담 핵심 쟁점 및 채무 리포트 CRM 영구 보관' },
            { id: 'action2', label: '미응답 시 48시간 자동 리마인드 큐 등록' },
          ],
        };
      case 2:
        return {
          title: '2단계(수임 계약) 체결 완료 및 서류 준비 진행',
          description: '정식 사건 위임계약이 확정되었습니다. 필수 서류 수합 및 부채증명서 발급 단계로 전진하시겠습니까?',
          summaryItems: [
            { label: '체결 상태', value: '위임계약 체결 확정' },
            { label: '약정 수임료', value: crmExt?.totalFee ? `${crmExt.totalFee.toLocaleString()}만원` : '확정 완료' },
            { label: '계약 일자', value: crmExt?.contractDate || new Date().toISOString().slice(0, 10) },
          ],
          notifyPreview: `[계약 체결 안내] ${clientRequest.clientName}님의 개인회생 사건 위임계약이 정식 체결되었습니다. 신청에 필요한 필수 발급 서류 안내를 확인해 주세요.`,
          autoActions: [
            { id: 'action1', label: '약정된 분납 일정(수임료) 수납 캘린더에 자동 등록' },
            { id: 'action2', label: '발급처별 필수 서류 요청 묶음 초안 자동 준비' },
          ],
        };
      case 3:
        return {
          title: '3단계(서류 준비) 완료 및 신청서 작성 진행',
          description: '법원 접수에 필요한 핵심 서류 및 부채증명서가 확보되었습니다. 신청서·변제계획안 작성 단계로 전진하시겠습니까?',
          summaryItems: [
            { label: '서류 수합도', value: '필수 서류 승인 기준 충족' },
            { label: '부채증명서', value: '채권자별 부채증명서 수령 완료' },
            { label: '소득/재산 증빙', value: '소득금액증명 및 재산목록 대조 완료' },
          ],
          notifyPreview: `[서류 수합 완료] 법원 접수를 위한 모든 필수 서류가 확인되었습니다. 신청서 및 변제계획안 최종 검토를 시작합니다.`,
          autoActions: [
            { id: 'action1', label: '8대 필수 신청서식 초안 자동 생성 (수입지출/재산/채권자목록)' },
            { id: 'action2', label: '전자소송 제출용 서류 묶음 생성' },
          ],
        };
      case 4:
        return {
          title: '4단계(신청·접수) 법원 접수 완료 및 사건 추적 시작',
          description: '신청서 작성이 완료되어 법원에 정식 전자접수되었습니다. 보정·개시결정 단계로 전진하시겠습니까?',
          summaryItems: [
            { label: '접수 관할법원', value: crmExt?.courtCase?.courtName || '관할 회생법원' },
            { label: '사건번호', value: crmExt?.courtCase?.caseNumber || '접수 완료 (사건번호 대기)' },
            { label: '부수 신청', value: '금지·중지명령 동시 접수 완료' },
          ],
          notifyPreview: `[법원 접수 완료] ${clientRequest.clientName}님의 개인회생 사건이 법원에 정식 접수되었습니다.`,
          autoActions: [
            { id: 'action1', label: '대법원 나의사건검색 자동 추적 등록' },
            { id: 'action2', label: '금지명령 결정 대기 기한(접수 후 7일) 일정 등록' },
          ],
        };
      case 5:
        return {
          title: '5단계(보정·개시) 개시결정 등록 및 변제 수행 시작',
          description: '법원 보정 절차를 거쳐 정식 개시결정이 내려졌습니다. 최종 변제·면책 단계로 전진하시겠습니까?',
          summaryItems: [
            { label: '법원 진행', value: '개시결정 확정' },
            { label: '변제 기간', value: '36개월 (월 변제 수행)' },
            { label: '채권자집회', value: '기일 확인 및 안내 예정' },
          ],
          notifyPreview: `🎉 [개시결정 축하] ${clientRequest.clientName}님의 개인회생 개시결정이 내려졌습니다! 법원 가상계좌와 변제 일정을 확인해 주세요.`,
          autoActions: [
            { id: 'action1', label: '법원 가상계좌 및 월 적립금 납부 일정 등록' },
            { id: 'action2', label: '채권자집회 기일 캘린더 등록 및 D-7 알림 예약' },
          ],
        };
      default:
        return {
          title: `${fromStage}단계 완료 및 ${toStage}단계 진행`,
          description: '다음 단계로 전진하시겠습니까?',
          summaryItems: [],
          notifyPreview: `[진행 안내] 사건이 다음 단계(${toStage}단계)로 진행되었습니다.`,
          autoActions: [],
        };
    }
  };

  const config = getTransitionConfig();

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // 1. 의뢰인 알림 발송 옵션이 켜져 있으면 알림 등록
      if (notifyClient && config.notifyPreview) {
        addClientNotification({
          type: 'status_change',
          title: config.notifyPreview,
          emoji: '📋',
          linkTab: 'diagnosis',
        });
      }

      // 2. 콜백 실행 (상태 변경 및 파이프라인 단계 이동)
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoActionItems: AutoActionItem[] = config.autoActions.map((act) => ({
    id: act.id,
    label: act.label,
    checked: actionChecks[act.id] ?? true,
    onChange: (checked) => setActionChecks((prev) => ({ ...prev, [act.id]: checked })),
  }));

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
      notifyPreview={config.notifyPreview}
      autoActions={autoActionItems}
      confirmLabel={`${toStage}단계로 진행`}
      cancelLabel="취소"
      isConfirming={isSubmitting}
      onConfirm={handleConfirm}
    />
  );
}
