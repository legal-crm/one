import React from 'react';

export interface PrimaryActionDef {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  loading?: boolean;
}

export interface AdminPageHeaderProps {
  /** 페이지 제목 */
  title: string;
  /** 제목 옆 보조 뱃지 또는 카운트 */
  badge?: React.ReactNode;
  /** 한 줄 설명 (20단어 이내 권장) */
  description?: string;
  /** 단일 주 버튼 (기획서 3.4: 화면마다 주 버튼은 하나) */
  primaryAction?: PrimaryActionDef;
  /** 보조 액션 버튼군 (더보기 ⋯, 필터, 엑셀 다운로드 등) */
  secondaryActions?: React.ReactNode;
  /** 하단 확장 영역 (필터바, 탭 등) */
  children?: React.ReactNode;
  /** 추가 클래스 */
  className?: string;
}

/**
 * 어드민 공통 페이지 헤더 (기획서 5.4 & Rule 2/3)
 * - 라이트 캔버스 위에 조용한 네이비 톤
 * - 단일 명확한 주 버튼(Primary CTA) 배치
 * - 모바일에서 1줄/자연스러운 래핑 지원
 */
export function AdminPageHeader({
  title,
  badge,
  description,
  primaryAction,
  secondaryActions,
  children,
  className = '',
}: AdminPageHeaderProps) {
  const Icon = primaryAction?.icon;

  return (
    <header className={`space-y-3 pb-3 border-b border-slate-200/80 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* 타이틀 및 설명 */}
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[18px] sm:text-[20px] font-bold text-slate-900 tracking-tight whitespace-nowrap">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="mt-1 text-[13px] text-slate-500 leading-relaxed truncate max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {/* 액션 버튼 그룹 */}
        {(primaryAction || secondaryActions) && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto flex-wrap">
            {secondaryActions}
            {primaryAction && (
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.loading}
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white text-[13px] font-semibold tracking-tight shadow-sm whitespace-nowrap press-scale cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/40 ${
                  primaryAction.disabled || primaryAction.loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                }`}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <span>{primaryAction.loading ? '처리 중...' : primaryAction.label}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 하단 슬롯 (필터바, 뷰탭 등) */}
      {children && <div className="pt-1">{children}</div>}
    </header>
  );
}
