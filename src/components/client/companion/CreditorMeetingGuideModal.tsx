import React from 'react';
import { X, Users, Calendar, MapPin, CheckCircle2, AlertTriangle, Clock, ShieldCheck, FileText } from 'lucide-react';

interface CreditorMeetingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  courtName?: string;
  caseNumber?: string;
  meetingDate?: string; // 예: "2026-10-24 14:00"
  meetingPlace?: string; // 예: "본관 3층 회생 1호 법정"
}

export default function CreditorMeetingGuideModal({
  isOpen,
  onClose,
  courtName = '서울회생법원',
  caseNumber = '2026개회108492',
  meetingDate = '2026-10-24 14:00',
  meetingPlace = '본관 회생법정'
}: CreditorMeetingGuideModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 상단 헤더 */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-bold border border-indigo-400/20">
              🏛️
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg text-white">채권자집회 출석 완벽 가이드</h3>
              <p className="text-xs text-indigo-200">
                {courtName} · 사건번호: <span className="font-mono font-bold text-white">{caseNumber}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-700 dark:text-slate-300">
          
          {/* 핵심 일정 안내 */}
          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                지정 집회 일시
              </span>
              <span className="font-black text-sm text-indigo-700 dark:text-indigo-400 font-mono">
                {meetingDate}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-indigo-100 dark:border-indigo-900/50">
              <span className="font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-slate-500" />
                출석 장소
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {courtName} {meetingPlace}
              </span>
            </div>
          </div>

          {/* 🚨 가장 중요한 필수 준비물 */}
          <div className="space-y-2">
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-red-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
              당일 필수 지참물
            </h4>
            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 space-y-1.5">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
                <span>신분증 원본 (주민등록증, 운전면허증, 여권 중 1개 필수)</span>
              </div>
              <p className="text-[11px] text-red-700/80 dark:text-red-300/70 pl-6 leading-relaxed">
                신분증이 없으면 법정에 입정할 수 없으며, 불출석 처리될 수 있습니다. 모바일 신분증도 가능하나 실물 신분증 지참을 권장합니다.
              </p>
            </div>
          </div>

          {/* ⏱️ 실제 진행 절차 및 소요 시간 */}
          <div className="space-y-2">
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
              실제 진행 절차 (소요시간: 약 3~5분)
            </h4>
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">지정 시간 15분 전 법정 입정</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">방청석에 앉아 계시면 판사님이 사건번호와 신청인 성함을 순서대로 호명합니다.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">호명 시 앞으로 나가 "네, 출석했습니다" 답변</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">신분증을 확인하고, 채권자 이의 유무를 확인한 뒤 이상이 없으면 바로 퇴정하게 됩니다.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 💡 채권자가 나와서 따지나요? 안심 안내 */}
          <div className="space-y-2">
            <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
              자주 묻는 질문: "채권자가 나와서 따지나요?"
            </h4>
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
              <p className="font-bold text-emerald-900 dark:text-emerald-300">
                대부분의 금융기관 채권자는 법정에 출석하지 않습니다.
              </p>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/70 leading-relaxed">
                금융기관은 서면으로 의견을 제출하므로 집회 당일에 채권자가 출석해 항의하는 경우는 99% 없습니다. 긴장하지 마시고 편안한 마음으로 출석하시면 됩니다.
              </p>
            </div>
          </div>

          {/* 주의사항 */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>불출석 시 기각 또는 폐지 사유:</strong> 정당한 사유 없이 채권자집회에 출석하지 않으면 회생절차가 폐지될 수 있습니다. 부득이한 사정으로 출석이 어려우신 경우 즉시 담당 변호사에게 연락해 기일 연기 신청을 해야 합니다.
            </p>
          </div>

        </div>

        {/* 하단 닫기 */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all cursor-pointer press-scale shadow-sm"
          >
            확인했습니다
          </button>
        </div>

      </div>
    </div>
  );
}
