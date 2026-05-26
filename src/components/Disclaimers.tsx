import React from 'react';
import { ShieldAlert, AlertCircle, Info } from 'lucide-react';

export function RequestDisclaimer() {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 text-amber-800 dark:text-amber-200 text-xs leading-relaxed space-y-1">
      <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100 text-sm">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span>변호사법 제34조 준수 알림 및 동의</span>
      </div>
      <p>
        본 플랫폼은 의뢰인과 변호사를 보수 수임과 매칭 수수료 기반으로 연결하지 않는 <strong>법률 상담 요청 기반 SaaS 플랫폼</strong>입니다.
        의뢰인의 채무 분석 결과와 의뢰인의 직접 선택 혹은 오픈형 요청 제한 설정에 따라 자발적으로 생성된 상담 요청 건에 대해, 가입 변호사 회원이 자율적으로 상담에 참여하는 안전한 도구만을 제공합니다.
      </p>
      <div className="mt-2 font-medium bg-amber-100/50 dark:bg-amber-950/50 p-2 rounded border border-amber-200/50 dark:border-amber-900/30 text-[11px]">
        ✔️ “본인은 직접 선택 또는 설정을 통해 상담을 요청하며, 법적 권해의 한계를 인지하고 동의합니다.”
      </div>
    </div>
  );
}

export function ChatDisclaimer() {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-600 dark:text-slate-400 text-xs">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">상담 책임 및 플랫폼 중립 의무 고지</span>
          <p className="leading-relaxed">
            “본 상담은 해당 변호사가 제공하는 독립적인 법률 대리 서비스이며, 플랫폼은 일체의 법적 구속을 유도하거나 상담 업무 및 사건 수임 수수료 정산에 개입하지 않습니다.”
          </p>
        </div>
      </div>
    </div>
  );
}

export function BannedNotice() {
  return (
    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-lg text-red-700 dark:text-red-300 text-xs leading-normal">
      <div className="flex items-center gap-1.5 font-semibold mb-1">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>변호사법 위반 소지 원천 차단 정책 (금지 사항 안내)</span>
      </div>
      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-red-600/90 dark:text-red-400/90">
        <li>특정 변호사 인위적 추천 및 추천 알고리즘 전면 부정</li>
        <li>변호사 수임률 순위, 평점 순 세우기, 최저가 사건 수임 유도 전면 불가</li>
        <li>성공 보증 및 무조건 탕감 확약 등 허위·과장 광고 배제</li>
        <li>변호사 자격 미보유 스태프의 독자적인 1:1 법률 가이드 원천 한계 설정</li>
      </ul>
    </div>
  );
}
