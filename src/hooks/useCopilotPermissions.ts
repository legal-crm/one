import { useMemo } from 'react';
import type { StaffRole } from '../types';
import type { CopilotPermissions } from '../types/copilot';

export function useCopilotPermissions(role: StaffRole): CopilotPermissions {
  return useMemo(() => {
    const isOwner = role === 'OWNER';
    const isLawyer = role === 'LAWYER';
    const isOwnerOrLawyer = isOwner || isLawyer;
    const isAnyStaff = ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF'].includes(role);

    return {
      canRunFactEngine: isAnyStaff,           // 사실 계산은 모든 사무실 직원 가능
      canRunReviewRules: isAnyStaff,           // 규칙 실행도 가능
      canCreateStaffReview: isAnyStaff,        // 사무직원 확인 가능
      canRequestLawyerReview: isAnyStaff,      // 변호사 검토 요청 가능
      canEditLawyerOpinion: isOwnerOrLawyer,   // ★ 법률 의견은 변호사만
      canApproveCaseReview: isOwnerOrLawyer,   // ★ 승인은 변호사만
      canSendToClient: isOwnerOrLawyer,        // ★ 고객 발송은 변호사만
      canManageRuleSets: isOwner,              // RuleSet 관리는 대표만
      canApproveRuleSets: isOwnerOrLawyer,     // RuleSet 승인은 변호사
      canViewAuditLog: isOwner,                // 감사 로그는 대표만
      canWithdrawMessage: isOwnerOrLawyer,     // 발송 철회는 변호사만
    };
  }, [role]);
}
