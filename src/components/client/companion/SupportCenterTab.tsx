import React, { useState } from 'react';
import { Shield, ExternalLink, Phone, HeartHandshake, Landmark, DollarSign, AlertTriangle, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { OFFICIAL_SUPPORT_PROGRAMS } from '../../../services/companionService';
import { SupportProgram } from '../../../types';

export default function SupportCenterTab() {
  const [selectedPriority, setSelectedPriority] = useState<number | 'all'>('all');

  const filteredPrograms = selectedPriority === 'all'
    ? OFFICIAL_SUPPORT_PROGRAMS
    : OFFICIAL_SUPPORT_PROGRAMS.filter(p => p.priority === selectedPriority);

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      {/* 지원센터 안내 배너 */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl">
          <span className="text-[11px] font-bold bg-brand-light/20 text-brand-light border border-brand-light/30 px-3 py-1 rounded-full uppercase tracking-wider">
            안심 공적 지원 센터
          </span>
          <h2 className="text-xl md:text-2xl font-black leading-tight">
            생활 안정과 재기를 돕는 <br className="hidden sm:block" />
            <span className="text-brand-light">국가 공적 복지 및 금융 제도</span>를 확인하세요
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            마이김변은 무분별한 고금리 대출을 추천하지 않습니다. 정부 및 공공기관의 무상 긴급복지와 성실상환자 정책금융 제도를 우선순위별로 투명하게 안내합니다.
          </p>
        </div>
      </div>

      {/* 우선순위 필터 탭 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedPriority('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            selectedPriority === 'all'
              ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          전체 지원 제도 ({OFFICIAL_SUPPORT_PROGRAMS.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedPriority(1)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedPriority === 1
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-emerald-600 border border-emerald-200 dark:border-emerald-800/60'
          }`}
        >
          <span>🥇 1순위: 무상·긴급 복지지원</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedPriority(2)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedPriority === 2
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-blue-600 border border-blue-200 dark:border-blue-800/60'
          }`}
        >
          <span>🥈 2순위: 공적 채무·신용지원</span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedPriority(3)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedPriority === 3
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-purple-600 border border-purple-200 dark:border-purple-800/60'
          }`}
        >
          <span>🥉 3순위: 성실상환자 공적금융</span>
        </button>
      </div>

      {/* 프로그램 카드 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPrograms.map((prog) => (
          <div
            key={prog.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between gap-5"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  prog.priority === 1 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                  prog.priority === 2 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                  'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                }`}>
                  {prog.priority === 1 ? '🥇 1순위 무상복지' : prog.priority === 2 ? '🥈 2순위 공적채무' : '🥉 3순위 공적금융'}
                </span>
                <span className="text-xs text-slate-500 font-semibold">{prog.organization}</span>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
                  {prog.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {prog.subtitle}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                    🎯 지원 대상 및 요건
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {prog.eligibility}
                  </p>
                </div>

                <div className="bg-brand/5 dark:bg-brand/10 p-3 rounded-2xl space-y-1 border border-brand/10">
                  <span className="text-[11px] font-bold text-brand dark:text-brand-light block">
                    🎁 주요 혜택 내용
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {prog.benefit}
                  </p>
                </div>
              </div>
            </div>

            {/* 하단 공식 링크 & 전화 */}
            <div className="pt-3 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3">
              <a
                href={`tel:${prog.contactNumber.replace(/[^0-9]/g, '')}`}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-brand transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{prog.contactNumber}</span>
              </a>

              <a
                href={prog.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand dark:hover:bg-brand-light text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <span>공식 안내 확인하기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* 규제 및 안전 고지문 */}
      <div className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>공적 지원 및 금융제도 안내에 관한 고지</span>
        </div>
        <p>
          마이김변에 안내된 공적 지원제도는 각 주관기관(보건복지부, 고용노동부, 신용회복위원회, 서민금융진흥원 등)의 공식 기준을 바탕으로 제공되는 일반 정보입니다.
          실제 지원 자격 및 대출 승인 여부는 주관기관 및 취급 금융기관의 내부 심사를 통해 결정되며, 마이김변은 대출을 보장하거나 중개 수수료를 수취하지 않습니다.
        </p>
      </div>

    </div>
  );
}
