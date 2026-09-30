import React from 'react';
import { ArrowRight, Eye, Lock, ShieldCheck, Zap } from 'lucide-react';
import { Button, Card, PageHeader, SectionHeader } from './ui';

interface CompanyViewProps {
  onNavigate?: (tab: string) => void;
}

/**
 * 회사 소개
 * - 콘텐츠 페이지 공통 머리(PageHeader hero)와 카드 구성 (이전: 탭 컨테이너 안에서 전폭 배경 섹션이 잘려 보였음)
 * - 사실 확인이 안 되는 표현 정리: '실제 이용 후기 공개'(현재 후기는 예시), '모든 데이터 암호화'(전송 구간 암호화만 확인됨)
 */
export default function CompanyView({ onNavigate }: CompanyViewProps) {
  const facts = [
    // 검증 가능한 서비스 사실만 표시 (근거 없는 이용자/변호사 수 수치는 쓰지 않는다)
    { value: '0원', label: '상담 요청 단계 이용료' },
    { value: '최대 3명', label: '변호사 동시 상담 요청' },
    { value: '정액제', label: '변호사 광고비 (수수료 없음)' },
    { value: '100%', label: '익명 상담 (스텔스 가명)' },
  ];
  const values = [
    {
      icon: <Eye className="h-6 w-6" aria-hidden="true" />,
      title: '투명성',
      desc: '변호사 프로필과 취급 분야를 공개하고, 받은 제안서를 나란히 비교할 수 있게 해 충분한 정보로 선택하도록 돕습니다.',
    },
    {
      icon: <Lock className="h-6 w-6" aria-hidden="true" />,
      title: '익명성',
      desc: '스텔스 가명으로 실명 없이 상담을 시작할 수 있습니다. 주고받는 데이터는 SSL/TLS로 암호화해 전송합니다.',
    },
    {
      icon: <Zap className="h-6 w-6" aria-hidden="true" />,
      title: '접근성',
      desc: '약 3분 걸리는 내 상황 체크와 여러 변호사에게 한 번에 요청하는 방식으로, 누구나 쉽게 시작할 수 있게 합니다.',
    },
  ];
  const principles = [
    { title: '변호사법 준수', desc: '변호사법 제34조에 따라 알선료·수수료를 받지 않는 구조로 운영합니다.' },
    { title: '광고비 정액제', desc: '광고비는 상담 건수·수임 여부·사건 결과와 무관한 고정 금액입니다.' },
    { title: '통신판매중개자', desc: '플랫폼은 통신판매중개자로서 변호사와 의뢰인 사이의 계약에 직접 관여하지 않습니다.' },
    { title: '개인정보 보호', desc: '개인정보 처리방침에 따라 이용자의 정보를 관리합니다.' },
  ];

  return (
    <div className="animate-fadeIn space-y-10 text-left">
      <PageHeader
        variant="hero"
        title="채무 해결의 새로운 기준을 만들어 갑니다"
        description="my김변은 채무 문제로 어려움을 겪는 분들이 알맞은 변호사를 쉽고 안전하게 찾을 수 있도록 돕습니다."
      />

      <section aria-labelledby="company-mission" className="space-y-3">
        <p className="text-sm font-bold text-brand">우리가 하는 일</p>
        <h2 id="company-mission" className="text-xl font-extrabold tracking-tight text-slate-900 break-keep md:text-2xl">
          법률 서비스의 정보 비대칭을 줄여, 누구나 공정한 도움을 받을 수 있도록
        </h2>
        <p className="max-w-3xl text-base leading-relaxed text-slate-600 break-keep">
          채무 문제는 누구에게나 찾아올 수 있지만, 어디서부터 어떻게 해결해야 할지 알기 어렵습니다.
          my김변은 채무 상황을 차근차근 정리하고, 회생·파산 사건을 다루는 변호사와 안전하게 연결하는 플랫폼을 만들고 있습니다.
        </p>
      </section>

      <section aria-labelledby="company-facts">
        <SectionHeader id="company-facts" title="이용 기준 한눈에 보기" />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {facts.map((f) => (
            <Card key={f.label} padded={false} className="flex flex-col-reverse p-5 text-center">
              <dt className="mt-1 text-sm font-bold text-slate-600 break-keep">{f.label}</dt>
              <dd className="text-2xl font-extrabold tracking-tight text-brand md:text-3xl">{f.value}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section aria-labelledby="company-values">
        <SectionHeader id="company-values" title="핵심 가치" description="my김변이 지키는 3가지 원칙" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {values.map((v) => (
            <Card key={v.title} padded={false} className="space-y-3 p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand">{v.icon}</span>
              <h3 className="text-lg font-bold text-slate-900">{v.title}</h3>
              <p className="text-base leading-relaxed text-slate-600 break-keep">{v.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="company-principles">
        <SectionHeader id="company-principles" title="법령 준수 운영 원칙" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {principles.map((p) => (
            <Card key={p.title} padded={false} className="space-y-2 p-5">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <ShieldCheck className="h-5 w-5 shrink-0 text-secondary-hover" aria-hidden="true" />
                {p.title}
              </h3>
              <p className="text-base leading-relaxed text-slate-600 break-keep">{p.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {onNavigate && (
        <Card as="section" className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">내 채무 상황부터 확인해 보세요</h2>
            <p className="mt-1 text-sm text-slate-600">회원가입 없이 약 3분이면 예상 변제금을 확인할 수 있어요.</p>
          </div>
          <Button size="lg" onClick={() => onNavigate('diagnosis')} rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
            내 상황 체크하기
          </Button>
        </Card>
      )}
    </div>
  );
}
