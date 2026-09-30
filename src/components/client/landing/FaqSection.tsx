import React, { useState } from 'react';
import { ArrowRight, ChevronDown, HelpCircle } from 'lucide-react';
import { Button, SectionHeader, buttonClassName } from '../ui';
import { cn } from '../../../utils/cn';

/**
 * 서비스 FAQ (라이트 배경). 전체 목록은 정적 FAQ 페이지(/faq)에서 제공한다.
 * 문구 기준: 과장·단정 표현 금지, 확인되지 않은 수치·효과 표현 금지(R4).
 */
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: '플랫폼 이용에 비용이 발생하나요?',
    a: '채무 정리부터 변호사 상담 요청까지 플랫폼 이용료는 발생하지 않습니다. 정식 선임 시 비용은 각 변호사가 개별 안내합니다.',
  },
  {
    q: '제 개인정보가 노출되지 않나요?',
    a: '스텔스 가명으로 상담이 진행되어 실명이나 연락처를 입력하지 않아도 됩니다. 변호사에게도 가명만 공개되며, 상담 데이터는 SSL/TLS 암호화로 전송됩니다.',
  },
  {
    q: '상담 내용이 가족이나 직장에 알려질 수 있나요?',
    a: '플랫폼은 가족이나 직장에 상담 사실을 알리지 않습니다. 개인정보는 본인 동의 또는 법령에 근거한 경우에만 제공됩니다. 다만 법원 절차가 시작되면 법령에 따라 채권자 등에게 송달이 이루어질 수 있으므로, 구체적인 사항은 담당 변호사와 상의해 주세요.',
  },
  {
    q: '상담을 받으면 반드시 변호사를 선임해야 하나요?',
    a: '아닙니다. 선임 여부는 의뢰인이 결정합니다. 제안을 받은 뒤 진행하지 않아도 불이익은 없습니다.',
  },
  {
    q: '채무 체크 결과는 얼마나 정확한가요?',
    a: '공개된 법원 실무 기준(인정 생계비 등)으로 계산한 참고용 추정치입니다. 실제 변제금과 절차 이용 가능 여부는 서류 확인과 법원 판단에 따라 달라지므로 변호사 상담으로 확인해 주세요.',
  },
  {
    q: '상담은 어떤 방식으로 진행되나요?',
    a: '선택한 변호사와 1:1 상담방에서 메시지로 대화합니다. 답변 시간은 변호사마다 다를 수 있습니다.',
  },
];

/** 모바일에서 보여 줄 질문 수(나머지는 전체 FAQ 페이지에서) */
const MOBILE_VISIBLE = 4;

export default function FaqSection({ onOpenInquiry }: { onOpenInquiry: () => void }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="w-full py-12 md:py-16 bg-white border-b border-slate-200" aria-labelledby="landing-faq-title">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <SectionHeader id="landing-faq-title" align="center" title="자주 묻는 질문" description="서비스 이용 전에 많이 궁금해하시는 내용입니다." />

        <ul className="divide-y divide-slate-200 border-y border-slate-200">
          {FAQ_ITEMS.map((item, idx) => {
            const open = openIdx === idx;
            const panelId = `landing-faq-${idx}`;
            return (
              <li key={item.q} className={idx >= MOBILE_VISIBLE ? 'hidden sm:block' : undefined}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => setOpenIdx(open ? null : idx)}
                    className="w-full min-h-14 py-4 flex items-center justify-between gap-4 text-left font-bold text-base md:text-lg text-slate-900 hover:text-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-xl"
                  >
                    <span className="break-keep">{item.q}</span>
                    <ChevronDown className={cn('w-5 h-5 text-slate-500 shrink-0 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
                  </button>
                </h3>
                {open && (
                  <div id={panelId} className="pb-5 pr-9 text-sm md:text-base text-slate-700 leading-relaxed break-keep animate-fadeIn">
                    {item.a}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a href="/faq" className={buttonClassName('secondary', 'md')}>
            자주 묻는 질문 전체 보기
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </a>
          <Button variant="ghost" onClick={onOpenInquiry} leftIcon={<HelpCircle className="w-4 h-4" aria-hidden="true" />}>
            1:1 문의하기
          </Button>
        </div>
      </div>
    </section>
  );
}
