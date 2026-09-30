import React from 'react';
import { CheckCircle2, Clock, EyeOff, RotateCcw, Send } from 'lucide-react';
import type { RehabChatProgressSnapshot } from '../../rehab-chatbot-package/components/rehab/AIRehabChatbotV2';
import { formatKoreanWon } from './ui';

/* ─────────────────────────────────────────────
   내 상황 체크 · 데스크톱 옆 패널
   대화로 답한 내용을 한눈에 보여 주고(입력 요약), 진행 방식과 다음 단계를 안내한다.
   계산에는 관여하지 않는다(표시 전용).
   ───────────────────────────────────────────── */

const EMPLOYMENT_LABEL: Record<string, string> = {
  salary: '급여 소득',
  business: '사업 소득',
  freelancer: '프리랜서',
  both: '급여 + 사업 소득',
  none: '소득 없음',
  daily: '일용직',
  basic_recipient: '기초생활수급',
};

const HOUSING_LABEL: Record<string, string> = {
  rent: '월세',
  jeonse: '전세',
  owned: '자가',
  free: '무상 거주',
  dormitory: '기숙사',
};

const MARITAL_LABEL: Record<string, string> = {
  single: '미혼',
  married: '기혼',
  divorced: '이혼',
  widowed: '사별',
  other: '기타',
};

const won = (v?: number) => (typeof v === 'number' && v > 0 ? formatKoreanWon(v) : '');

function buildRows(input: RehabChatProgressSnapshot['input']): Array<{ label: string; value: string }> {
  const housing = input.housingType
    ? [HOUSING_LABEL[input.housingType] || '', won(input.deposit) && `보증금 ${won(input.deposit)}`, won(input.rentCost) && `월 ${won(input.rentCost)}`]
        .filter(Boolean)
        .join(' · ')
    : '';
  const family = [
    input.maritalStatus ? MARITAL_LABEL[input.maritalStatus] : '',
    typeof input.minorChildren === 'number' && input.minorChildren > 0 ? `미성년 자녀 ${input.minorChildren}명` : '',
  ].filter(Boolean).join(' · ');
  return [
    { label: '거주 지역', value: input.address || '' },
    { label: '나이', value: typeof input.age === 'number' && input.age > 0 ? `${input.age}세` : '' },
    { label: '소득 형태', value: input.employmentType ? EMPLOYMENT_LABEL[input.employmentType] || '' : '' },
    { label: '월 소득(세후)', value: won(input.monthlyIncome) },
    { label: '가족', value: family },
    { label: '주거', value: housing },
    { label: '내 재산', value: won(input.myAssets) },
    { label: '채무 총액', value: won(input.totalDebt) },
  ];
}

export default function ChatbotSidePanel({ snapshot }: { snapshot: RehabChatProgressSnapshot | null }) {
  const rows = buildRows(snapshot?.input || {});
  const filled = rows.filter(r => r.value).length;
  const progress = Math.round(snapshot?.progress || 0);

  return (
    <aside aria-label="내 상황 체크 진행 안내" className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">입력한 내용</h2>
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{filled}/{rows.length}개 항목</span>
        </div>
        <div
          className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-label="정리 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        <dl className="mt-3 divide-y divide-slate-100 text-sm">
          {rows.map(row => (
            <div key={row.label} className="flex items-start justify-between gap-3 py-2">
              <dt className="text-slate-600 shrink-0">{row.label}</dt>
              <dd className={row.value ? 'text-right font-semibold text-slate-900 break-keep' : 'text-right text-slate-400'}>
                {row.value || '—'}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500 leading-relaxed break-keep">
          '—'는 아직 답하지 않았거나 해당 없는 항목입니다. 계산에는 대화에서 답한 값이 쓰입니다.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-base font-bold text-slate-900">진행 방식</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
          <li className="flex items-start gap-2.5">
            <Clock className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span className="break-keep">질문에 답하면 약 3분 안에 예상 변제금을 계산해 드립니다.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <EyeOff className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span className="break-keep">이름과 연락처는 묻지 않습니다.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <RotateCcw className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span className="break-keep">입력창 왼쪽의 ‹ 버튼(이전 질문으로)을 누르면 앞 답변을 고칠 수 있습니다.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Send className="w-4 h-4 mt-0.5 shrink-0 text-brand" aria-hidden="true" />
            <span className="break-keep">결과는 변호사에게 자동으로 보내지지 않습니다. 상담을 요청할 때 받는 변호사를 확인하고 동의한 뒤 전달됩니다.</span>
          </li>
        </ul>
        {snapshot?.isComplete && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            정리를 마쳤습니다. 결과 화면을 확인해 주세요.
          </p>
        )}
      </section>
    </aside>
  );
}
