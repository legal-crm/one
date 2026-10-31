// ============================================================
// 오늘의 업무함 (HM-3, 20261031003500)
// 서버 office_work_queue가 원래 데이터에서 할 일을 계산한다. 화면은 그대로 보여 주고,
// 사람이 누른 미루기·넘기기·메모만 서버에 저장한다.
// ============================================================
import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { NOT_CONFIGURED, toRpcError, type RpcResult } from './rpcResult';

export type WorkGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'waiting' | 'review';

export interface WorkItem {
  key: string;
  kind: string;
  title: string;
  count: number;
  caseKey: string | null;
  leadId: string | null;
  alias: string | null;
  stage: string | null;
  dueAt: string | null;
  dueBasis: string | null;
  assigneeMemberId: string | null;
  memo: string | null;
  group: WorkGroup;
  linkType: string;
  linkId: string | null;
  priority: number;
}

export const WORK_GROUP_LABEL: Record<WorkGroup, string> = {
  overdue: '기한 지남',
  today: '오늘',
  tomorrow: '내일',
  week: '이번 주',
  later: '다음 주 이후',
  waiting: '기다리는 중 (의뢰인 차례)',
  review: '검토 요청',
};
export const WORK_GROUP_ORDER: WorkGroup[] = ['overdue', 'today', 'review', 'tomorrow', 'week', 'waiting', 'later'];

/** 카드 정의 (사이드바 배지도 같은 정의를 쓴다, HM-4) */
export const WORK_CARD_KINDS = {
  consult: ['consult_response'],
  deadlines: ['correction_due', 'correction_extension', 'schedule', 'task'],
  waiting: ['contract_waiting', 'form_waiting', 'correction_waiting'],
  review: ['proposal_review', 'client_documents', 'form_review', 'correction_reply', 'fee_report', 'device_pending'],
  fees: ['fee_overdue', 'fee_due', 'fee_report'],
} as const;

// case_stage_definitions.office_label과 같은 이름
const STAGE_LABEL: Record<string, string> = {
  consult: '상담', proposal_sent: '제안서 발송', contracting: '계약 진행', documents: '서류 준비', drafting: '신청서 작성',
  filed: '접수', correction: '보정', commenced: '개시결정', declared: '파산선고', trustee: '관재인 절차',
  creditors_meeting: '채권자집회', repaying: '인가·변제', discharge_hearing: '면책심문', discharge: '면책', closed: '종결',
};
export const stageLabel = (s: string | null) => (s ? STAGE_LABEL[s] || s : '');

export async function loadWorkQueue(officeId: string): Promise<RpcResult<WorkItem[]>> {
  if (!isSupabaseConfigured || !officeId) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc('office_work_queue', { p_office_id: officeId });
  if (error) return toRpcError(error);
  const rows = (Array.isArray(data) ? data : []) as any[];
  return {
    ok: true,
    data: rows.map(r => ({
      key: r.key, kind: r.kind, title: r.title, count: Number(r.count || 1), caseKey: r.case_key ?? null, leadId: r.lead_id ?? null,
      alias: r.alias ?? null, stage: r.stage ?? null, dueAt: r.due_at ?? null, dueBasis: r.due_basis ?? null,
      assigneeMemberId: r.assignee_member_id ?? null, memo: r.memo ?? null, group: r.group as WorkGroup,
      linkType: r.link_type, linkId: r.link_id ?? null, priority: Number(r.priority || 3),
    })),
  };
}

export async function setWorkOverride(officeId: string, itemKey: string, p: { snoozeUntil?: string | null; snoozeReason?: string; assigneeMemberId?: string | null; memo?: string | null }): Promise<RpcResult<null>> {
  if (!isSupabaseConfigured) return NOT_CONFIGURED;
  const { error } = await supabase.rpc('set_work_queue_override', {
    p_office_id: officeId, p_item_key: itemKey, p_snooze_until: p.snoozeUntil ?? null, p_snooze_reason: p.snoozeReason ?? null,
    p_assignee_member_id: p.assigneeMemberId ?? null, p_memo: p.memo ?? null,
  });
  if (error) return toRpcError(error);
  return { ok: true, data: null };
}

/** 기한 표시: '3시간 남음' / '2일 지남' / '10.31 (금)' */
export function formatDue(dueAt: string | null, now = new Date()): string {
  if (!dueAt) return '기한 없음';
  const d = new Date(dueAt);
  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.floor(abs / 86_400_000);
  if (diffMs < 0) return days >= 1 ? `${days}일 지남` : `${Math.max(1, hours)}시간 지남`;
  if (hours < 24) return `${Math.max(1, hours)}시간 남음`;
  const dows = ['일', '월', '화', '수', '목', '금', '토'];
  const shown = new Date(d.getTime() - 1000); // 날짜 끝(다음 날 0시)으로 저장된 기한은 그 날짜로 보이게
  return `${String(shown.getMonth() + 1).padStart(2, '0')}.${String(shown.getDate()).padStart(2, '0')} (${dows[shown.getDay()]})`;
}

/** 미루기 선택지 */
export function snoozeTarget(kind: '1h' | 'tomorrow' | '3d', now = new Date()): Date {
  if (kind === '1h') return new Date(now.getTime() + 3_600_000);
  const d = new Date(now);
  d.setDate(d.getDate() + (kind === 'tomorrow' ? 1 : 3));
  d.setHours(9, 0, 0, 0);
  return d;
}
