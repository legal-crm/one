
// ============================================================
// [RBAC] 권한 조회 커스텀 훅
// - 원본은 서버의 사무소 권한표(my_office_context, RB-1·RB-4). 화면은 그 결과로 메뉴·버튼을 정한다.
// - 서버 기록이 없으면 '대표'로 간주하지 않는다(이전: 직원 기록이 없으면 OWNER 기본값).
//   단, 서버 권한표를 아직 못 받은 개발 환경(Supabase 미설정)에서만 기존 직원 기록 기준으로 계산한다.
// ============================================================

import { useMemo } from 'react';
import type { StaffMember, StaffRole, StaffPermissions } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';
import type { OfficeContext } from '../services/office/officeService';
import { canUse, scopeOf } from '../services/office/officePermissions';

// 탭 접근 권한 매트릭스
export type LawyerTab = 'dashboard' | 'cases' | 'billing' | 'client-crm' | 'sales-leads' | 'staff-management' | 'settings' | 'case-copilot' | 'fee-settlement'
  | 'requests' | 'chat' | 'tasks-schedule' | 'contracts' | 'qna-answer' | 'inquiry-to-admin';

/** 사무소 권한표 기준: 탭마다 이 권한 중 하나라도 범위가 있으면 연다 */
const TAB_PERMISSION_MATRIX: Record<LawyerTab, string[]> = {
  'dashboard':        ['case.view', 'consult.view', 'fee.view', 'sales.view'],
  'requests':         ['consult.view'],
  'chat':             ['consult.chat'],
  'case-copilot':     ['proposal.draft'],
  'cases':            ['case.view'],
  'client-crm':       ['case.view'],
  'tasks-schedule':   ['case.view', 'consult.view', 'fee.view', 'sales.view'],
  'contracts':        ['contract.draft'],
  'fee-settlement':   ['fee.view'],
  'sales-leads':      ['sales.view'],
  'qna-answer':       ['qna.answer'],
  'billing':          ['ads.manage', 'billing.view'],
  'staff-management': ['office.staff'],
  'inquiry-to-admin': ['case.view', 'consult.view', 'fee.view', 'sales.view', 'office.settings.view'],
  'settings':         ['case.view', 'consult.view', 'fee.view', 'sales.view', 'office.settings.view'],
};

// 서버 권한표가 없는 개발 환경용 (기존 역할 표)
const LEGACY_TAB_ACCESS: Record<LawyerTab, StaffRole[]> = {
  'dashboard':        ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'requests':         ['OWNER', 'LAWYER', 'CONSULTANT'],
  'chat':             ['OWNER', 'LAWYER', 'CONSULTANT'],
  'cases':            ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'tasks-schedule':   ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'contracts':        ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF'],
  'billing':          ['OWNER', 'ACCOUNTING'],
  'fee-settlement':   ['OWNER', 'LAWYER', 'ACCOUNTING'],
  'client-crm':       ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'sales-leads':      ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF'],
  'qna-answer':       ['OWNER', 'LAWYER'],
  'staff-management': ['OWNER'],
  'inquiry-to-admin': ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'settings':         ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'case-copilot':     ['OWNER', 'LAWYER', 'CONSULTANT'],
};

// 탭 라벨 (한국어)
export const TAB_LABELS: Record<LawyerTab, string> = {
  'dashboard':        '오늘의 업무',
  'requests':         '상담 요청',
  'chat':             '상담 채팅',
  'cases':            '사건 관리',
  'tasks-schedule':   '일정·기한',
  'contracts':        '계약 현황',
  'billing':          '광고·결제',
  'fee-settlement':   '수임료 수납',
  'client-crm':       '고객관리',
  'sales-leads':      '영업 DB',
  'qna-answer':       '공개 Q&A',
  'staff-management': '직원·권한',
  'inquiry-to-admin': '마이김변 문의',
  'settings':         '설정',
  'case-copilot':     '사건 검토',
};

const OFFICE_ROLE_TO_STAFF_ROLE: Record<string, StaffRole> = {
  owner: 'OWNER', lawyer: 'LAWYER', consultant: 'CONSULTANT', clerk: 'STAFF', accounting: 'ACCOUNTING', custom: 'STAFF',
};

export interface PermissionContext {
  role: StaffRole;
  permissions: StaffPermissions;
  isOwner: boolean;
  isLawyer: boolean;
  isStaffOrAccounting: boolean;
  /** 서버 사무소 권한표 (없으면 null) */
  officeScopes: Record<string, string> | null;
  /** 🔒 권한을 가진 승인된 변호사 계정인지 */
  isVerifiedLawyer: boolean;
  canAccessTab: (tab: LawyerTab) => boolean;
  hasPermission: (key: keyof StaffPermissions) => boolean;
  /** 사무소 권한 키(officePermissions.ts) 범위가 none 이 아니면 true */
  can: (officePermission: string) => boolean;
  accessibleTabs: LawyerTab[];
  getDefaultTab: () => LawyerTab;
}

/** 사무소 권한표 → 기존 화면 토글 (기존 코드가 읽는 12개 값) */
function permissionsFromScopes(s: Record<string, string>): StaffPermissions {
  const all = (k: string) => scopeOf(s, k) === 'all';
  const any = (k: string) => scopeOf(s, k) !== 'none';
  return {
    viewAllClients: all('case.view'),
    editClientInfo: any('case.edit'),
    changeStatus: any('case.edit'),
    assignCases: any('case.assign'),
    manageStaff: any('office.staff'),
    writeNotes: any('case.edit') || any('consult.chat'),
    manageBilling: any('fee.record'),
    deleteClients: any('case.delete'),
    manageCalendar: all('case.view'),
    canAssignTasks: any('case.assign'),
    canManageAllTasks: all('case.assign'),
    canApproveTasks: any('proposal.send') || any('contract.send'),
  };
}

/**
 * 현재 사용자의 권한 컨텍스트.
 * @param activeStaff 기존 직원 기록 (서버 권한표가 없을 때만 사용)
 * @param office 서버 사무소 권한표(useOfficeContext). 주어지면 이것이 우선한다.
 * @param legacyFallback 서버 권한표를 쓸 수 없는 환경(Supabase 미설정)에서만 true
 */
export function usePermissions(activeStaff: StaffMember | null, office?: OfficeContext | null, legacyFallback = false): PermissionContext {
  return useMemo(() => {
    const scopes = office?.permissions ?? null;

    let role: StaffRole;
    let permissions: StaffPermissions;
    if (office) {
      role = OFFICE_ROLE_TO_STAFF_ROLE[office.role] || 'STAFF';
      permissions = permissionsFromScopes(office.permissions);
    } else if (legacyFallback) {
      role = activeStaff?.role || 'OWNER';
      permissions = activeStaff?.permissions || DEFAULT_PERMISSIONS[role];
    } else {
      // 서버 판정 전·사무소 없음: 아무 권한도 주지 않는다
      role = activeStaff?.role || 'STAFF';
      permissions = Object.fromEntries(
        Object.keys(DEFAULT_PERMISSIONS['OWNER']).map(k => [k, false]),
      ) as unknown as StaffPermissions;
    }

    const isOwner = role === 'OWNER';
    const isLawyer = role === 'LAWYER';
    const isStaffOrAccounting = role === 'STAFF' || role === 'ACCOUNTING';

    const can = (key: string) => (scopes ? canUse(scopes, key) : legacyFallback);

    const canAccessTab = (tab: LawyerTab): boolean => {
      if (scopes) return (TAB_PERMISSION_MATRIX[tab] || []).some(k => canUse(scopes, k));
      if (legacyFallback) return (LEGACY_TAB_ACCESS[tab] || []).includes(role);
      return tab === 'dashboard' || tab === 'settings';
    };

    const hasPermission = (key: keyof StaffPermissions): boolean => permissions[key] === true;

    const accessibleTabs: LawyerTab[] = (Object.keys(TAB_PERMISSION_MATRIX) as LawyerTab[]).filter(canAccessTab);

    return {
      role,
      permissions,
      isOwner,
      isLawyer,
      isStaffOrAccounting,
      officeScopes: scopes,
      isVerifiedLawyer: office?.isVerifiedLawyer === true,
      canAccessTab,
      hasPermission,
      can,
      accessibleTabs,
      getDefaultTab: () => accessibleTabs[0] || 'dashboard',
    };
  }, [activeStaff, office, legacyFallback]);
}

/**
 * CRM 내에서 특정 고객에 대한 세부 접근 권한을 반환합니다.
 * 역할별로 볼 수 있는 데이터 범위가 다릅니다.
 */
export function useCrmPermissions(role: StaffRole): {
  canViewAllClients: boolean;
  canEditClientInfo: boolean;
  canChangeStatus: boolean;
  canAssignCases: boolean;
  canWriteNotes: boolean;
  canManageBilling: boolean;
  canDeleteClients: boolean;
  crmViewMode: 'full' | 'assigned-only' | 'read-only' | 'documents-only' | 'billing-only';
} {
  return useMemo(() => {
    const perms = DEFAULT_PERMISSIONS[role];

    let crmViewMode: 'full' | 'assigned-only' | 'read-only' | 'documents-only' | 'billing-only' = 'read-only';
    if (role === 'OWNER') crmViewMode = 'full';
    else if (role === 'LAWYER') crmViewMode = 'assigned-only';
    else if (role === 'CONSULTANT') crmViewMode = 'read-only';
    else if (role === 'STAFF') crmViewMode = 'documents-only';
    else if (role === 'ACCOUNTING') crmViewMode = 'billing-only';

    return {
      canViewAllClients: perms.viewAllClients,
      canEditClientInfo: perms.editClientInfo,
      canChangeStatus: perms.changeStatus,
      canAssignCases: perms.assignCases,
      canWriteNotes: perms.writeNotes,
      canManageBilling: perms.manageBilling,
      canDeleteClients: perms.deleteClients,
      crmViewMode,
    };
  }, [role]);
}
