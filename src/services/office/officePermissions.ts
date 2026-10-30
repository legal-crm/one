// ============================================================
// 사무소 권한 목록 (RB-4) — 권한의 단일 원본
// - DB 표 office_role_permissions(마이그레이션 20261030000000)와 같은 내용이어야 한다.
//   officePermissions.test.ts 가 두 목록이 같은지 확인한다.
// - 이 목록으로 직원·권한 화면 표, 메뉴·버튼 노출, 서버 규칙을 함께 만든다.
// - 🔒 lawyerOnly 권한은 승인된 변호사 계정(대표·담당 변호사)만 가지며 조정할 수 없다(변호사법 제109조 취지).
// ============================================================

export type OfficeRole = 'owner' | 'lawyer' | 'consultant' | 'clerk' | 'accounting';
export type OfficeMemberRole = OfficeRole | 'custom';
export type PermissionScope = 'none' | 'assigned' | 'all';

export interface OfficePermissionDef {
  key: string;
  group: string;
  label: string;
  lawyerOnly: boolean;
  defaults: Record<OfficeRole, PermissionScope>;
}

const d = (owner: PermissionScope, lawyer: PermissionScope, consultant: PermissionScope, clerk: PermissionScope, accounting: PermissionScope) =>
  ({ owner, lawyer, consultant, clerk, accounting });

export const OFFICE_PERMISSIONS: OfficePermissionDef[] = [
  { key: 'consult.view', group: '상담', label: '상담 요청 보기', lawyerOnly: false, defaults: d('all', 'all', 'all', 'none', 'none') },
  { key: 'consult.chat', group: '상담', label: '상담 채팅 보기·쓰기', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'none', 'none') },
  { key: 'proposal.draft', group: '상담', label: '제안서 작성', lawyerOnly: false, defaults: d('all', 'all', 'all', 'none', 'none') },
  { key: 'proposal.send', group: '상담', label: '제안서 발송·컨펌 승인', lawyerOnly: true, defaults: d('all', 'all', 'none', 'none', 'none') },
  { key: 'case.view', group: '사건', label: '사건 보기', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'assigned', 'all') },
  { key: 'case.edit', group: '사건', label: '사건 정보 수정·기록', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'assigned', 'none') },
  { key: 'case.assign', group: '사건', label: '사건 배정·이관', lawyerOnly: false, defaults: d('all', 'assigned', 'none', 'none', 'none') },
  { key: 'case.delete', group: '사건', label: '사건 삭제(휴지통)', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'client.contact', group: '사건', label: '의뢰인 실명·연락처 보기', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'assigned', 'assigned') },
  { key: 'contract.draft', group: '계약', label: '계약서 초안', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'assigned', 'none') },
  { key: 'contract.send', group: '계약', label: '계약 발송·체결 승인', lawyerOnly: true, defaults: d('all', 'assigned', 'none', 'none', 'none') },
  { key: 'documents.manage', group: '서류·보정', label: '서류 요청·검토', lawyerOnly: false, defaults: d('all', 'assigned', 'none', 'assigned', 'none') },
  { key: 'correction.manage', group: '서류·보정', label: '보정 항목 정리·의뢰인 요청', lawyerOnly: false, defaults: d('all', 'assigned', 'none', 'assigned', 'none') },
  { key: 'correction.finalize', group: '서류·보정', label: '보정서 문장 확정·제출 기록', lawyerOnly: true, defaults: d('all', 'assigned', 'none', 'none', 'none') },
  { key: 'court_forms.manage', group: '서류·보정', label: '법원 서식 작성·묶음', lawyerOnly: false, defaults: d('all', 'assigned', 'none', 'assigned', 'none') },
  { key: 'fee.view', group: '수납', label: '수임료 보기', lawyerOnly: false, defaults: d('all', 'assigned', 'none', 'none', 'all') },
  { key: 'fee.record', group: '수납', label: '수납 기록·안내 발송', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'all') },
  { key: 'sales.view', group: '영업 DB', label: '리드 보기·통화 결과', lawyerOnly: false, defaults: d('all', 'all', 'assigned', 'assigned', 'none') },
  { key: 'sales.manage', group: '영업 DB', label: '리드 배정·가져오기·거래처', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'sales.convert', group: '영업 DB', label: '사건 관리로 이관', lawyerOnly: false, defaults: d('all', 'all', 'all', 'none', 'none') },
  { key: 'comm.view', group: '소통·증빙', label: '통화·문자 기록 보기', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'assigned', 'none') },
  { key: 'comm.recording', group: '소통·증빙', label: '녹음 재생·대화록', lawyerOnly: false, defaults: d('all', 'assigned', 'assigned', 'none', 'none') },
  { key: 'comm.export', group: '소통·증빙', label: '증빙 내보내기·파기 요청', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'qna.answer', group: '공개', label: '공개 Q&A 답변', lawyerOnly: true, defaults: d('all', 'all', 'none', 'none', 'none') },
  { key: 'ads.manage', group: '광고·결제', label: '광고 구매', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'billing.view', group: '광고·결제', label: '광고 결제·세금계산서 보기', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'all') },
  { key: 'office.staff', group: '사무소', label: '직원·권한·업무폰 기기 승인', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'office.settings.view', group: '사무소', label: '사무소 설정 보기', lawyerOnly: false, defaults: d('all', 'all', 'none', 'none', 'none') },
  { key: 'office.settings.edit', group: '사무소', label: '사무소 설정 바꾸기', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'office.audit', group: '사무소', label: '활동 기록 보기', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'data.export', group: '사무소', label: '엑셀·데이터 내보내기', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'none') },
  { key: 'fee.export', group: '사무소', label: '수납 내역 내보내기', lawyerOnly: false, defaults: d('all', 'none', 'none', 'none', 'all') },
  { key: 'vault.view', group: '사무소', label: '인증서 금고 열람(의뢰인 승인 필요)', lawyerOnly: false, defaults: d('assigned', 'assigned', 'none', 'assigned', 'none') },
];

export type OfficePermissionKey = (typeof OFFICE_PERMISSIONS)[number]['key'];

export const OFFICE_ROLE_LABELS: Record<OfficeMemberRole, string> = {
  owner: '대표',
  lawyer: '담당 변호사',
  consultant: '상담',
  clerk: '사무',
  accounting: '경리',
  custom: '맞춤 역할',
};

export const PERMISSION_SCOPE_LABELS: Record<PermissionScope, string> = {
  none: '없음',
  assigned: '배정된 것만',
  all: '사무소 전체',
};

const BY_KEY = new Map(OFFICE_PERMISSIONS.map(p => [p.key, p]));

export function getPermissionDef(key: string): OfficePermissionDef | undefined {
  return BY_KEY.get(key);
}

/** 서버가 돌려준 권한표(my_office_context.permissions)에서 범위를 읽는다. 모르면 none. */
export function scopeOf(permissions: Record<string, string> | null | undefined, key: string): PermissionScope {
  const v = permissions?.[key];
  return v === 'all' || v === 'assigned' ? v : 'none';
}

/** 범위가 none 이 아니면 메뉴·버튼을 보여 준다(실제 대상 확인은 서버가 한다). */
export function canUse(permissions: Record<string, string> | null | undefined, key: string): boolean {
  return scopeOf(permissions, key) !== 'none';
}

/** 화면 묶음별 권한 목록 (직원·권한 화면 표) */
export function permissionGroups(): Array<{ group: string; items: OfficePermissionDef[] }> {
  const groups: Array<{ group: string; items: OfficePermissionDef[] }> = [];
  for (const p of OFFICE_PERMISSIONS) {
    let g = groups.find(x => x.group === p.group);
    if (!g) { g = { group: p.group, items: [] }; groups.push(g); }
    g.items.push(p);
  }
  return groups;
}
