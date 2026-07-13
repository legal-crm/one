// ============================================================
// [RBAC] 권한 기반 UI 가드 컴포넌트
// 권한이 없으면 children을 숨기거나 비활성화합니다.
// ============================================================

import React from 'react';
import type { StaffPermissions } from '../../types';
import { Lock } from 'lucide-react';

interface PermissionGateProps {
  /** 필요한 권한 키 */
  permission?: keyof StaffPermissions;
  /** 현재 사용자의 권한 객체 */
  permissions: StaffPermissions;
  /** 권한이 없을 때 동작: 'hide' = 숨김, 'disable' = 비활성화+오버레이 */
  fallback?: 'hide' | 'disable';
  /** 비활성화 시 표시할 메시지 */
  disabledMessage?: string;
  /** 커스텀 허용 조건 (permission 대신 직접 boolean 전달) */
  allowed?: boolean;
  children: React.ReactNode;
}

/**
 * 권한에 따라 하위 컴포넌트를 조건부 렌더링합니다.
 * 
 * 사용 예:
 * ```tsx
 * <PermissionGate permission="manageStaff" permissions={currentPermissions}>
 *   <StaffManagementTab />
 * </PermissionGate>
 * ```
 */
export default function PermissionGate({
  permission,
  permissions,
  fallback = 'hide',
  disabledMessage = '이 기능에 대한 접근 권한이 없습니다.',
  allowed,
  children,
}: PermissionGateProps) {
  // allowed가 명시적으로 전달되면 우선 사용
  const isAllowed = allowed !== undefined
    ? allowed
    : permission
      ? permissions[permission] === true
      : true;

  if (isAllowed) {
    return <>{children}</>;
  }

  if (fallback === 'hide') {
    return null;
  }

  // fallback === 'disable'
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-slate-900/60 backdrop-blur-[1px] rounded-xl z-10">
        <div className="flex flex-col items-center gap-2 text-center px-4 max-w-xs">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Lock className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
            {disabledMessage}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * 버튼 등 인라인 요소에 사용하는 간단한 권한 래퍼.
 * 권한이 없으면 disabled 상태로 렌더링합니다.
 */
interface PermissionButtonProps {
  /** 필요한 권한 키 */
  permission?: keyof StaffPermissions;
  /** 현재 사용자의 권한 객체 */
  permissions: StaffPermissions;
  /** 커스텀 허용 조건 */
  allowed?: boolean;
  children?: React.ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
}

export function PermissionButton({
  permission,
  permissions,
  allowed,
  children,
  className = '',
  title,
  disabled,
  ...rest
}: PermissionButtonProps) {
  const isAllowed = allowed !== undefined
    ? allowed
    : permission
      ? permissions[permission] === true
      : true;

  return (
    <button
      {...rest}
      disabled={!isAllowed || disabled}
      title={isAllowed ? title : '접근 권한이 없습니다'}
      className={`${className} ${!isAllowed ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}
