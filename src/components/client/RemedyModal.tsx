import React from 'react';
import { ArrowRight, BookOpen, ClipboardList, Landmark } from 'lucide-react';
import { Badge, Button, Modal } from './ui';
import type { RemedyInfo } from './remedyData';

interface RemedyModalProps {
  activeRemedyCategory: string;
  remedyData: Record<string, RemedyInfo>;
  renderRemedyIcon: (iconName: string, className: string) => React.ReactNode;
  onClose: () => void;
  onApply: (categoryId: string) => void;
  onViewCases: (categoryId: string) => void;
}

/**
 * 상황별 채무 정보 모달
 * 확인할 내용 · 관련 제도(일반 정보, 추천 순서 아님) · 상담 전 준비사항을 보여 주고
 * '내 상황 체크하기' 또는 '비슷한 사례 보기'로 이어진다.
 */
export default function RemedyModal({ activeRemedyCategory, remedyData, renderRemedyIcon, onClose, onApply, onViewCases }: RemedyModalProps) {
  const data = remedyData[activeRemedyCategory];
  if (!data) return null;

  const checkPoints = data.subtitle.replace(/^확인할 내용:\s*/, '');

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      mobile="sheet"
      icon={renderRemedyIcon(data.iconName, 'w-5 h-5')}
      title={data.title}
      description={<>확인할 내용: {checkPoints}</>}
      footer={
        <>
          <Button variant="secondary" onClick={() => onViewCases(activeRemedyCategory)} leftIcon={<BookOpen className="w-4 h-4" aria-hidden="true" />} className="flex-1 sm:flex-none">
            비슷한 사례 보기
          </Button>
          <Button onClick={() => onApply(activeRemedyCategory)} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />} className="flex-1 sm:flex-none">
            내 상황 체크하기
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Badge tone="neutral">{data.badgeText}</Badge>

        <section aria-labelledby="remedy-desc-title" className="space-y-2">
          <h3 id="remedy-desc-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Landmark className="w-4 h-4 text-brand" aria-hidden="true" />
            {data.remedyTitle}
          </h3>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed break-keep">{data.remedyDesc}</p>
        </section>

        <section aria-labelledby="remedy-guide-title" className="space-y-2 rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <h3 id="remedy-guide-title" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ClipboardList className="w-4 h-4 text-brand" aria-hidden="true" />
            {data.guideTitle}
          </h3>
          <p className="text-sm sm:text-base text-slate-700 leading-relaxed break-keep">{data.guideDesc}</p>
        </section>

        <p className="text-xs text-slate-500 leading-relaxed">
          일반적인 정보이며 법률 자문이 아닙니다. 내 상황에 맞는 방법은 채무 정리 후 변호사 상담으로 확인하세요.
        </p>
      </div>
    </Modal>
  );
}
