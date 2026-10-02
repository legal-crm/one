import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronLeft, ChevronRight, MessageSquare, MoreHorizontal, 
  Scale, FileText, Trash2, ArrowRightLeft, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { getDisplayClientName } from '../../../utils/clientDisplay';

export interface CaseWorkspaceHeaderProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  assignedLawyerName?: string;
  onBackToList: () => void;
  onPrevCase?: () => void;
  onNextCase?: () => void;
  hasPrevCase?: boolean;
  hasNextCase?: boolean;
  onOpenChat: () => void;
  primaryAction: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    subtext?: string;
  };
  onSwitchCaseType?: (type: 'individual_rehab' | 'bankruptcy') => void;
  onOpenFormsHub?: () => void;
  onOpenIntakeDetail?: () => void;
  onToggleContextPanel?: () => void;
  isContextPanelOpen?: boolean;
  onDeleteCase?: () => void;
}

/**
 * 사건 워크스페이스 상단 라이트 헤더 (기획서 4.3 & 2-1)
 * - 기존 다크 배너와 다크 툴바를 통합한 깔끔한 라이트 헤더
 * - 핵심 4개 정보(사건 유형·관할 법원·사건번호·담당자)만 컴팩트하게 노출
 * - 화면의 유일한 주 버튼(Primary CTA: '다음: ...') 배치
 */
export function CaseWorkspaceHeader({
  clientRequest,
  crmExt,
  assignedLawyerName,
  onBackToList,
  onPrevCase,
  onNextCase,
  hasPrevCase = false,
  hasNextCase = false,
  onOpenChat,
  primaryAction,
  onSwitchCaseType,
  onOpenFormsHub,
  onOpenIntakeDetail,
  onToggleContextPanel,
  isContextPanelOpen,
  onDeleteCase,
}: CaseWorkspaceHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = getDisplayClientName(clientRequest);
  const isBankruptcy = crmExt.caseType === 'bankruptcy' || crmExt.caseType === 'individual_bankruptcy';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '법원 미입력';
  const caseNumber = crmExt.courtCase?.caseNumber || '사건번호 미입력';
  const lawyerName = assignedLawyerName || '담당 미배정';

  return (
    <header className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-3.5 shadow-2xs select-none">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* 좌측: Breadcrumbs & 핵심 메타 4개 */}
        <div className="min-w-0 space-y-1">
          {/* Breadcrumb + 이전/다음 사건 탐색기 */}
          <div className="flex items-center gap-2 text-[12px] text-slate-500 font-medium">
            <button
              type="button"
              onClick={onBackToList}
              className="inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>사건 관리</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-800 truncate">{displayName}</span>

            {/* 이전/다음 사건 빠른 이동 */}
            {(onPrevCase || onNextCase) && (
              <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={onPrevCase}
                  disabled={!hasPrevCase}
                  className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                    hasPrevCase ? 'text-slate-600 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title="이전 사건"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onNextCase}
                  disabled={!hasNextCase}
                  className={`p-1 rounded hover:bg-slate-100 transition-colors ${
                    hasNextCase ? 'text-slate-600 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
                  }`}
                  title="다음 사건"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 사건 식별 타이틀 및 핵심 메타 4개 */}
          <div className="flex items-center gap-2 flex-wrap text-[13px]">
            <h1 className="text-[17px] font-bold text-slate-900 tracking-tight">
              {displayName}
            </h1>
            <span className="text-slate-300 font-light">|</span>

            {/* 1. 사건 유형 */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${
                isBankruptcy
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {isBankruptcy ? '개인파산' : '개인회생'}
            </span>

            {/* 2. 관할 법원 */}
            <span className="text-slate-600 font-medium">{courtName}</span>
            <span className="text-slate-300">·</span>

            {/* 3. 사건번호 */}
            <span className="font-mono text-slate-600">{caseNumber}</span>
            <span className="text-slate-300">·</span>

            {/* 4. 담당자 */}
            <span className="text-slate-600 font-medium">담당 {lawyerName}</span>
          </div>
        </div>

        {/* 우측: 보조 액션(채팅, 더보기) + 단일 주 버튼(Primary CTA) */}
        <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
          {/* 상담 채팅 바로가기 */}
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-[13px] shadow-2xs press-scale cursor-pointer transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-slate-500" />
            <span>상담 채팅</span>
          </button>

          {/* 컨텍스트 패널 토글 버튼 */}
          {onToggleContextPanel && (
            <button
              type="button"
              onClick={onToggleContextPanel}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-xl border font-semibold text-[13px] shadow-2xs press-scale cursor-pointer transition-colors ${
                isContextPanelOpen
                  ? 'border-[#1E3A5F]/30 bg-[#1E3A5F]/10 text-[#1E3A5F]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title={isContextPanelOpen ? "사건 정보 및 소통 패널 접기" : "사건 정보 및 소통 패널 열기"}
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">사건 정보</span>
            </button>
          )}

          {/* 더보기 ⋯ 드롭다운 */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs press-scale cursor-pointer"
              title="추가 작업"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50 text-[13px] animate-in fade-in duration-100 divide-y divide-slate-100">
                {onOpenIntakeDetail && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenIntakeDetail();
                    }}
                    className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>의뢰인 상세 설문 보기</span>
                  </button>
                )}

                {onOpenFormsHub && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenFormsHub();
                    }}
                    className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span>실무 서식 보관함</span>
                  </button>
                )}

                {onSwitchCaseType && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSwitchCaseType(isBankruptcy ? 'individual_rehab' : 'bankruptcy');
                    }}
                    className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                    <span>{isBankruptcy ? '개인회생으로 전환' : '개인파산으로 전환'}</span>
                  </button>
                )}

                {onDeleteCase && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onDeleteCase();
                    }}
                    className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>사건 삭제 / 휴지통</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 단일 주 버튼 (Primary CTA) */}
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[38px] rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-[13px] shadow-sm tracking-tight whitespace-nowrap press-scale transition-colors ${
              primaryAction.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{primaryAction.label}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
