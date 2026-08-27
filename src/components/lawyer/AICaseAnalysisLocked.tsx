import React from 'react';
import { Lock, Microscope, CheckCircle2, MessageCircle, Sparkles, TrendingUp, FileText, Scale } from 'lucide-react';

interface AICaseAnalysisLockedProps {
  onContactAdmin?: () => void;
}

/**
 * AI 사건 분석 기능이 비활성화(유료 미가입) 상태일 때 표시되는 잠금 화면.
 * 기능 소개 + 관리자 문의 CTA를 제공합니다.
 */
export default function AICaseAnalysisLocked({ onContactAdmin }: AICaseAnalysisLockedProps) {
  const features = [
    { icon: <Microscope className="w-4 h-4" />, label: '의뢰인 재무 상태 자동 분석' },
    { icon: <Scale className="w-4 h-4" />, label: '법적 쟁점 플래그 자동 검토' },
    { icon: <TrendingUp className="w-4 h-4" />, label: '변제금 시뮬레이션 및 최적 방안 산출' },
    { icon: <FileText className="w-4 h-4" />, label: '의뢰인 맞춤 제안서 자동 생성' },
    { icon: <Sparkles className="w-4 h-4" />, label: '검토 워크플로 및 감사 로그 관리' },
  ];

  return (
    <div className="animate-fadeIn flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="w-full max-w-lg text-center space-y-6">

        {/* 잠금 아이콘 */}
        <div className="flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
            <Lock className="w-9 h-9 text-slate-400" />
          </div>
        </div>

        {/* 제목 */}
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            AI 사건 분석은 유료 서비스입니다
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
            AI가 의뢰인의 재무 데이터를 분석하고, 법적 쟁점을 자동 검토하며,
            변제금 시뮬레이션까지 지원합니다.
          </p>
        </div>

        {/* 기능 목록 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-left space-y-3 shadow-xs">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">포함 기능</p>
          <div className="space-y-2.5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand/8 border border-brand/15 flex items-center justify-center text-brand shrink-0">
                  {f.icon}
                </div>
                <span className="text-sm font-semibold text-slate-700">{f.label}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            이용을 원하시면 플랫폼 관리자에게 문의해 주세요.
          </p>
          {onContactAdmin && (
            <button
              onClick={onContactAdmin}
              className="inline-flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-sm px-6 py-3 rounded-xl shadow-xs active:scale-[0.98] transition-all whitespace-nowrap cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>1:1 문의하기</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
