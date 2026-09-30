import React, { useMemo } from 'react';
import { ArrowRight, BookOpen, CalendarCheck, HeartHandshake, Scale } from 'lucide-react';
import { Button, Card, PageHeader } from '../ui';
import { loadBankruptcyCase, loadRehabCompanionCase } from '../../../services/companionService';

/**
 * 최상위 '회생동행' 탭 = 소개 화면 (IA 통합안)
 * 실제 관리는 마이페이지 '회생동행' 탭에서 한다. 기록이 있으면 바로 여는 버튼을 먼저 보여 준다.
 * 기능 설명은 실제로 있는 화면(변제 대시보드·납부 기록·공적 지원센터·회복 아카데미·사건 등록)만 적는다.
 */
interface CompanionIntroViewProps {
  /** 기록을 찾을 저장 키 (상담 요청 ID, 로그인한 의뢰인 ID 등) */
  lookupIds: (string | undefined)[];
  onOpenCompanion: () => void;
  onStartCheck: () => void;
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: '변제 일정과 납부 기록',
    body: '월 변제금 납부일과 회차별 납부 기록을 한곳에서 확인하고 남길 수 있어요.',
  },
  {
    icon: Scale,
    title: '법원 절차 안내',
    body: '사건을 등록하면 채권자집회 출석 가이드처럼 절차마다 준비할 일을 확인할 수 있어요.',
  },
  {
    icon: HeartHandshake,
    title: '생활 위기 때 공적 지원',
    body: '실직·질병처럼 변제가 어려워질 때 확인할 절차와 받을 수 있는 공적 지원을 안내해요.',
  },
  {
    icon: BookOpen,
    title: '회복 아카데미',
    body: '면책 뒤 신용 회복과 돈 관리를 차근차근 익힐 수 있어요.',
  },
];

export default function CompanionIntroView({ lookupIds, onOpenCompanion, onStartCheck }: CompanionIntroViewProps) {
  const key = lookupIds.join('|');
  const hasCase = useMemo(() => {
    const ids = lookupIds.length > 0 ? lookupIds : [undefined];
    return ids.some(id => !!loadRehabCompanionCase(id) || !!loadBankruptcyCase(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader
        title="회생동행"
        description="개인회생·파산을 신청한 뒤 3~5년 동안 이어지는 변제와 법원 절차를 한곳에서 관리합니다."
        actions={
          <Button size="lg" onClick={onOpenCompanion} rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}>
            {hasCase ? '내 회생동행 열기' : '회생동행 시작하기'}
          </Button>
        }
      />

      <section aria-labelledby="companion-features" className="space-y-4">
        <h2 id="companion-features" className="text-lg font-bold text-slate-900">회생동행에서 할 수 있는 일</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map(f => (
            <li key={f.title}>
              <Card className="h-full flex items-start gap-3.5">
                <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                  <f.icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">{f.body}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="companion-start" className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6 space-y-3">
        <h2 id="companion-start" className="text-base font-bold text-slate-900">어떻게 시작하나요?</h2>
        <ul className="space-y-2 text-sm text-slate-700 leading-relaxed break-keep list-disc pl-5">
          <li>마이김변에서 변호사에게 사건을 맡기면, 담당 변호사가 입력한 사건 정보가 자동으로 표시됩니다.</li>
          <li>다른 곳에서 진행 중인 사건도 사건번호와 변제 조건(월 변제금·납부일·회차)을 직접 등록해 관리할 수 있어요.</li>
          <li>관리 화면은 마이페이지의 '회생동행' 탭에 있습니다.</li>
        </ul>
        <p className="text-sm text-slate-600 break-keep">
          아직 신청 전이라면{' '}
          <button type="button" onClick={onStartCheck} className="font-bold text-brand underline underline-offset-2 hover:text-brand-hover">
            내 상황 체크
          </button>
          로 변제금부터 가늠해 보세요.
        </p>
      </section>
    </div>
  );
}
