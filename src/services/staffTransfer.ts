// ============================================================
// 퇴사·정지 직원의 담당 사건 일괄 이관 계산 (순수 함수)
// ============================================================

import type { CrmClientExtension } from '../types';

/** 담당자로 쓰이는 필드 — 하나라도 떠나는 직원이면 이관 대상 */
export const ASSIGNEE_FIELDS = ['assigneeId', 'assignedLawyerId', 'assignedConsultantId', 'assignedStaffId'] as const;

/** 이 사건에서 해당 직원이 맡은 담당 필드가 있는지 */
export function isAssignedTo(ext: Partial<CrmClientExtension> | undefined, staffId: string): boolean {
  if (!ext || !staffId) return false;
  return ASSIGNEE_FIELDS.some(f => (ext as any)[f] === staffId);
}

/**
 * fromId가 들어 있는 모든 담당 필드를 toId로 바꾼 새 데이터와 바뀐 사건 ID 목록
 * - 열려 있는 배정 지시서(assignmentDirectives)의 수신자도 새 담당자로 바꾼다
 */
export function computeBulkTransfer(
  data: Record<string, CrmClientExtension>,
  clientIds: string[],
  fromId: string,
  toId: string,
  toName?: string
): { next: Record<string, CrmClientExtension>; changedIds: string[] } {
  const next: Record<string, CrmClientExtension> = { ...data };
  const changedIds: string[] = [];
  if (!fromId || !toId || fromId === toId) return { next, changedIds };

  for (const id of clientIds) {
    const ext = data[id];
    if (!ext || !isAssignedTo(ext, fromId)) continue;
    const updated: any = { ...ext };
    for (const f of ASSIGNEE_FIELDS) {
      if (updated[f] === fromId) updated[f] = toId;
    }
    const directives = (ext as any).assignmentDirectives;
    if (Array.isArray(directives)) {
      updated.assignmentDirectives = directives.map((d: any) =>
        d && d.assigneeId === fromId && !d.acknowledgedAt ? { ...d, assigneeId: toId, assigneeName: toName ?? d.assigneeName } : d
      );
    }
    next[id] = updated;
    changedIds.push(id);
  }
  return { next, changedIds };
}
