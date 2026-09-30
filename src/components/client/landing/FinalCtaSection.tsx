import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';

/** 마지막 행동 유도(스크롤 퍼널 앵커 CTA — R2.3 예외) */
export default function FinalCtaSection({ onStartCheck }: { onStartCheck: () => void }) {
  return (
    <section className="w-full bg-brand-deep" aria-labelledby="landing-final-cta-title">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 md:py-16 text-center">
        <h2 id="landing-final-cta-title" className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug break-keep">
          실명 없이, 내 채무 상황부터 정리해 보세요
        </h2>
        <p className="mt-3 text-base text-slate-300 break-keep">약 3분이면 끝나고, 이름과 연락처를 입력하지 않아도 시작할 수 있습니다.</p>
        <div className="mt-7 flex justify-center">
          <Button variant="inverse" size="lg" onClick={onStartCheck} rightIcon={<ArrowRight className="w-5 h-5" aria-hidden="true" />} className="px-8">
            익명으로 내 상황 체크하기
          </Button>
        </div>
      </div>
    </section>
  );
}
