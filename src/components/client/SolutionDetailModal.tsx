import React from 'react';
import {
  X, ArrowRight, Scale, FileCheck2, HeartHandshake, UserCheck, Receipt, Handshake, Sprout, LifeBuoy, Wallet, Phone, ExternalLink,
} from 'lucide-react';
import { DEBT_PROGRAMS, type SolutionType } from './debtPrograms';

// 제도 데이터는 debtPrograms.ts 한 곳 (NF-1: 공식 연락처·확인일, 판단 없음)
export type { SolutionType } from './debtPrograms';

interface SolutionDetailModalProps {
  solutionType: SolutionType;
  onClose: () => void;
  onStartDiagnosis: () => void;
  onApplyConsult: (title: string, content: string) => void;
}

export const SOLUTION_ICON: Record<SolutionType, React.ElementType> = {
  rehab: Scale, bankruptcy: FileCheck2, credit: HeartHandshake, representation: UserCheck, tax: Receipt,
  direct_adjust: Handshake, new_leap: Sprout, legal_aid: LifeBuoy, living_account: Wallet,
};

const fmtDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-');
  return `${y}. ${Number(m)}. ${Number(d)}.`;
};

export default function SolutionDetailModal({
  solutionType,
  onClose,
  onStartDiagnosis,
}: SolutionDetailModalProps) {
  const data = DEBT_PROGRAMS[solutionType];
  const Icon = SOLUTION_ICON[solutionType];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="solution-title"
        className="relative max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-5 bg-brand-deep text-white">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 pr-12">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" aria-hidden="true" />
            </div>
            <h3 id="solution-title" className="text-xl font-extrabold tracking-tight">{data.title}</h3>
          </div>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-left flex-1">
          <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{data.summary}</p>
          <ul className="space-y-2.5">
            {data.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-secondary-hover mt-2 shrink-0" aria-hidden="true" />
                <span className="text-sm sm:text-base text-slate-800 dark:text-slate-200 font-semibold">{point}</span>
              </li>
            ))}
          </ul>
          {data.links.length > 0 && (
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">공식 안내·상담</p>
              {data.links.map(l => (
                <div key={l.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">{l.label}</span>
                  {l.phone && <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 underline underline-offset-2"><Phone className="w-3.5 h-3.5" aria-hidden="true" />{l.phone}</a>}
                  {l.url && <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2"><ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />누리집</a>}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">내용 확인일 {fmtDate(data.checkedOn)} · 제도 기준은 바뀔 수 있어요. 공식 안내를 함께 확인해 주세요.</p>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
          >
            닫기
          </button>
          <button
            onClick={() => { onClose(); onStartDiagnosis(); }}
            className="flex-1 min-h-[48px] px-5 bg-brand hover:bg-brand-hover text-white rounded-xl text-base font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2 whitespace-nowrap shadow-sm cursor-pointer"
          >
            내 상황 체크하기
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center pb-3 px-4">
          이 화면은 일반 정보 안내이며, 이용 가능 여부를 판단하지 않습니다.
        </p>
      </div>
    </div>
  );
}
