import React, { useState } from 'react';
import { SectionHeader, SegmentedTabs } from '../ui';
import { cn } from '../../../utils/cn';
import type { SolutionType } from '../SolutionDetailModal';
import { SOLUTION_ITEMS, SOLUTION_LABELS, renderRemedyIcon, type RemedyInfo } from '../remedyData';

/**
 * 상황별·제도별 채무 정보 (기존 '상황별 채무관리' + '채무조정 방법' 두 섹션을 탭 하나로 통합)
 * - 상황 선택 → RemedyModal(확인할 내용·관련 제도·상담 전 준비사항)
 * - 제도 선택 → SolutionDetailModal
 */
interface SituationSectionProps {
  remedies: RemedyInfo[];
  onSelectRemedy: (remedyId: string) => void;
  onSelectSolution: (type: SolutionType) => void;
}

type Mode = 'situation' | 'solution';

const itemClass =
  'group flex flex-col items-center gap-2.5 rounded-2xl px-1.5 py-3 sm:py-4 text-center transition-colors hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const iconWrap =
  'w-14 h-14 md:w-16 md:h-16 rounded-full bg-brand-light text-brand flex items-center justify-center transition-colors group-hover:bg-brand group-hover:text-white';

export default function SituationSection({ remedies, onSelectRemedy, onSelectSolution }: SituationSectionProps) {
  const [mode, setMode] = useState<Mode>('situation');

  return (
    <section className="w-full py-12 md:py-16 bg-white border-b border-slate-200" aria-labelledby="landing-situation-title">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeader
          id="landing-situation-title"
          align="center"
          title="내 상황에 맞는 정보부터 확인하세요"
          description="상황이나 제도를 고르면 확인할 내용과 관련 제도의 일반 정보를 볼 수 있습니다."
        />

        <SegmentedTabs<Mode>
          ariaLabel="정보 보기 방식"
          idPrefix="landing-situation"
          value={mode}
          onChange={setMode}
          tabs={[
            { id: 'situation', label: '상황별로 보기' },
            { id: 'solution', label: '제도별로 보기' },
          ]}
          className="max-w-sm mx-auto mb-8"
        />

        {mode === 'situation' ? (
          <div role="tabpanel" id="landing-situation-panel-situation" aria-labelledby="landing-situation-tab-situation">
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:gap-x-4">
              {remedies.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelectRemedy(item.id)} className={cn(itemClass, 'w-full')}>
                    <span className={iconWrap} aria-hidden="true">
                      {renderRemedyIcon(item.iconName, 'w-6 h-6 md:w-7 md:h-7')}
                    </span>
                    <span className="text-xs sm:text-sm md:text-base font-bold text-slate-800 leading-snug break-keep">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div role="tabpanel" id="landing-situation-panel-solution" aria-labelledby="landing-situation-tab-solution">
            <ul className="grid grid-cols-3 sm:grid-cols-5 gap-x-2 gap-y-3 sm:gap-x-4 max-w-4xl mx-auto">
              {SOLUTION_ITEMS.map(({ type, icon: Icon }) => (
                <li key={type}>
                  <button type="button" onClick={() => onSelectSolution(type)} className={cn(itemClass, 'w-full')}>
                    <span className={iconWrap} aria-hidden="true">
                      <Icon className="w-6 h-6 md:w-7 md:h-7" />
                    </span>
                    <span className="text-sm md:text-base font-bold text-slate-800 leading-snug break-keep">{SOLUTION_LABELS[type]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-slate-500 break-keep">
          일반 정보이며 추천 순서가 아닙니다. 이용 가능 여부는 소득·재산·채무 사정에 따라 달라집니다.
        </p>
      </div>
    </section>
  );
}
