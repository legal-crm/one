// ============================================================
// [RBAC] 권한 조회 커스텀 훅
// 현재 로그인한 사용자의 역할과 권한을 조회합니다.
// ============================================================

import { useMemo } from 'react';
import type { StaffMember, StaffRole, StaffPermissions } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';

// 탭 접근 권한 매트릭스
export type LawyerTab = 'dashboard' | 'open-requests' | 'cases' | 'billing' | 'client-crm' | 'staff-management' | 'settings';

const TAB_ACCESS_MATRIX: Record<LawyerTab, StaffRole[]> = {
  'dashboard':        ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'open-requests':    ['OWNER', 'LAWYER', 'CONSULTANT'],
  'cases':            ['OWNER', 'LAWYER'],
  'billing':          ['OWNER', 'LAWYER', 'ACCOUNTING'],
  'client-crm':       ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
  'staff-management': ['OWNER'],
  'settings':         ['OWNER', 'LAWYER', 'CONSULTANT', 'STAFF', 'ACCOUNTING'],
};

// 탭 라벨 (한국어)
export const TAB_LABELS: Record<LawyerTab, string> = {
  'dashboard':        '대시보드',
  'open-requests':    '상담 현황',
  'cases':            '사건 관리',
  'billing':          '수임료/회계',
  'client-crm':       '고객 CRM',
  'staff-management': '사용자 관리',
  'settings':         '설정',
};

export interface PermissionContext {
  role: StaffRole;
  permissions: StaffPermissions;
  isOwner: boolean;
  isLawyer: boolean;
  isStaffOrAccounting: boolean;
  canAccessTab: (tab: LawyerTab) => boolean;
  hasPermission: (key: keyof StaffPermissions) => boolean;
  accessibleTabs: LawyerTab[];
  getDefaultTab: () => LawyerTab;
}

/**
 * 현재 활동 직원(또는 대표 변호사)의 권한 컨텍스트를 반환합니다.
 * activeStaff가 null이면 OWNER 권한을 기본 부여합니다.
 */
export function usePermissions(activeStaff: StaffMember | null): PermissionContext {
  return useMemo(() => {
    const role: StaffRole = activeStaff?.role || 'OWNER';
    const permissions: StaffPermissions = activeStaff?.permissions || DEFAULT_PERMISSIONS['OWNER'];

    const isOwner = role === 'OWNER';
    const isLawyer = role === 'LAWYER';
    const isStaffOrAccounting = role === 'STAFF' || role === 'ACCOUNTING';

    const canAccessTab = (tab: LawyerTab): boolean => {
      const allowedRoles = TAB_ACCESS_MATRIX[tab];
      return allowedRoles ? allowedRoles.includes(role) : false;
    };

    const hasPermission = (key: keyof StaffPermissions): boolean => {
      return permissions[key] === true;
    };

    const accessibleTabs: LawyerTab[] = (Object.keys(TAB_ACCESS_MATRIX) as LawyerTab[])
      .filter(tab => canAccessTab(tab));

    const getDefaultTab = (): LawyerTab => {
      return accessibleTabs[0] || 'dashboard';
    };

    return {
      role,
      permissions,
      isOwner,
      isLawyer,
      isStaffOrAccounting,
      canAccessTab,
      hasPermission,
      accessibleTabs,
      getDefaultTab,
    };
  }, [activeStaff]);
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
