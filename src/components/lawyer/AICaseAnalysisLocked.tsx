import React from 'react';
import { Lock, MessageCircle } from 'lucide-react';

interface AICaseAnalysisLockedProps {
  onContactAdmin?: () => void;
  /** 이용 조건 안내 (통합어드민 부가 기능 과금 모드) */
  reason?: string;
}

/**
 * 사건 검토 이용 조건 안내 (CT-15)
 * 기본은 무료로 열려 있고, 통합어드민이 '광고 혜택'·'정액 이용'으로 바꾼 뒤(30일 전 공지) 조건이 안 맞을 때만 보인다.
 * (이전: 'AI 사건 분석은 유료 서비스' 고정 잠금 — 무료 개방 결정(LA-Q1)과 맞지 않았다)
 */
export default function AICaseAnalysisLocked({ onContactAdmin, reason }: AICaseAnalysisLockedProps) {
  return (
    <div className="animate-fadeIn flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div className="w-full max-w-lg text-center space-y-5 rounded-3xl border border-slate-200 bg-white p-8">
        <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center" aria-hidden="true">
          <Lock className="w-7 h-7 text-slate-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">사건 검토 이용 조건 안내</h2>
          <p className="text-sm text-slate-600 leading-relaxed break-keep">
            {reason || '지금은 이 기능을 쓸 수 없어요.'} 상담 건수에 따라 요금을 매기지 않습니다.
          </p>
        </div>
        {onContactAdmin && (
          <button
            type="button"
            onClick={onContactAdmin}
            className="inline-flex items-center gap-2 min-h-[44px] bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-sm px-6 rounded-xl active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            마이김변 문의
          </button>
        )}
      </div>
    </div>
  );
}
