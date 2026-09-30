import React, { useState } from 'react';
import {
  ArrowRight, BookOpen, Briefcase, Building, CheckCircle2, ChevronDown, Clock, ExternalLink, Lock, MessageSquare, Search, Shield, ShieldAlert, Users,
} from 'lucide-react';
import { Badge, Button, Callout, Card, PageHeader, SectionHeader, SegmentedTabs } from './ui';
import { cn } from '../../utils/cn';

interface GuideViewProps {
  onNavigate?: (tab: string) => void;
}

type DocTab = 'salary' | 'business';

/**
 * 서비스 이용 안내
 * - 콘텐츠 페이지 공통 머리(PageHeader hero)·카드 구성, 소득 유형 전환은 SegmentedTabs
 * - 같은 목적의 '내 상황 체크하기' 버튼이 중간·끝에 두 번 있던 것 → 끝에 하나 (끝 버튼이 홈으로 가던 것도 바로잡음)
 * - 확인되지 않은 수치·단정 표현 정리: '22종/24종 표준', '1개월 내 발급분 필수', '반드시 마스킹해야 보정명령 방지',
 *   '실제 이용 후기 확인'(현재 후기는 예시), '암호화된 채팅방'
 */
export default function GuideView({ onNavigate }: GuideViewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [docTab, setDocTab] = useState<DocTab>('salary');

  const steps = [
    {
      title: '익명으로 내 상황 체크',
      desc: '회원가입 없이 몇 가지 질문에 답하면 채무 상황이 정리돼요.',
      details: ['채무 종류·금액, 소득 등 기본 정보 입력', '스텔스 가명으로 실명 없이 진행', '약 3분, 따로 준비할 서류 없음'],
      icon: <MessageSquare className="h-6 w-6" aria-hidden="true" />,
    },
    {
      title: '변호사 제안 비교',
      desc: '회생·파산 사건을 다루는 변호사를 골라 상담을 요청하고, 받은 제안서를 비교해요.',
      details: ['최대 3명에게 한 번에 요청', '경력·취급 분야와 제안 조건 확인', '마음에 드는 변호사가 없으면 진행하지 않아도 돼요'],
      icon: <Users className="h-6 w-6" aria-hidden="true" />,
    },
    {
      title: '1:1 상담',
      desc: '고른 변호사와 상담방에서 이야기해요.',
      details: ['스텔스 가명으로 실명 없이 상담', '편한 시간에 메시지로 주고받기', '선임 여부는 상담 뒤 자유롭게 결정'],
      icon: <Lock className="h-6 w-6" aria-hidden="true" />,
    },
  ];

  const docs = [
    {
      title: '주민등록등본·초본',
      issuer: '정부24 / 주민센터',
      desc: '과거 주소 변동 사항이 모두 나온 최신 초본',
      tip: '신청일에 가까운 최근 발급본이 필요해요. 기한은 관할 법원·담당 변호사 안내를 확인해 주세요.',
      required: true,
      url: 'https://www.gov.kr',
    },
    {
      title: '가족관계증명서·혼인관계증명서',
      issuer: '대법원 전자가족관계등록시스템 / 주민센터',
      desc: '대부분의 법원이 "상세" 증명서를 요구해요. 관할 법원·담당 변호사 안내를 확인해 주세요.',
      tip: '본인을 뺀 가족의 주민등록번호 뒷자리는 가려서 발급·제출하는 경우가 많아요.',
      required: true,
      url: 'https://efamily.scourt.go.kr',
    },
    {
      title: '본인 명의 예금계좌 사본',
      issuer: '거래 은행 / 인터넷뱅킹',
      desc: '법원에서 돌려받는 돈(예납금 잔액 등)을 받을 통장 사본',
      tip: '신청인 본인 명의 계좌여야 해요. 가족이나 다른 사람 명의 계좌는 쓸 수 없어요.',
      required: true,
    },
    {
      title: '채권자별 부채증명서',
      issuer: '각 채권 금융기관',
      desc: '원금·이자·담보 여부가 적힌 법원 제출용 부채증명서',
      tip: '사무소에 따라 발급을 대행해 주기도 해요.',
      required: true,
    },
    {
      title: '재산 목록 소명 자료',
      issuer: '위택스 / K-Geo / 금융결제원 / 각 보험사',
      desc: '지방세 세목별 과세증명서, 지적전산자료(부동산 소유 확인), 계좌정보통합관리(어카운트인포), 보험 해약환급금 확인서, 자동차등록원부, 부동산 등기부 등',
      tip: '부동산이나 차량이 없어도 "소유 없음"을 확인하는 서류를 내는 경우가 많아요.',
      required: true,
      url: 'https://www.wetax.go.kr',
    },
    {
      title: docTab === 'salary' ? '수입·지출 소명 자료 (급여소득)' : '수입·지출 소명 자료 (영업소득)',
      issuer: docTab === 'salary' ? '홈택스 / 현 직장 / 건강보험공단' : '홈택스 / 세무사 / 각 은행',
      desc: docTab === 'salary'
        ? '재직증명서, 근로계약서, 근로소득 원천징수영수증(최근 1~2년), 소득금액증명원, 최근 1년 급여명세서·급여통장 거래내역, 건강보험 자격득실 확인서'
        : '사업자등록증명원(폐업 시 폐업증명), 부가가치세 과세표준증명원(최근 3년), 종합소득세 확정신고서, 사업장 임대차계약서, 최근 1년 매출·매입 통장 거래내역',
      tip: docTab === 'salary'
        ? '이직한 지 1년이 안 됐다면 전 직장 원천징수영수증과 현 직장 급여 자료를 함께 내요.'
        : '사업용 계좌와 카드 매출 입금 계좌를 대조해 현금 매출이 빠지지 않게 정리해요.',
      required: true,
      url: 'https://www.hometax.go.kr',
    },
    {
      title: '진술서 소명 자료',
      issuer: '주민센터 / 병원 / 직접 작성',
      desc: '무상거주 사실확인서(다른 사람 명의 집에 사는 경우), 기초생활수급자 증명서, 장애인 증명서, 최근 1년 진료비 영수증·진단서 등',
      tip: '진술서에 적은 채무 발생 사유(병원비, 폐업, 실직 등)를 뒷받침하는 자료예요.',
      required: false,
    },
  ];

  const faqs = [
    { q: '비용이 드나요?', a: '내 상황 체크부터 변호사 상담 요청까지 플랫폼 이용료는 없어요. 정식 선임 비용은 각 변호사가 따로 안내해요.' },
    { q: '개인정보는 안전한가요?', a: '스텔스 가명으로 상담하므로 수임 계약 전까지 변호사에게 실명이 보이지 않아요. 주고받는 데이터는 SSL/TLS로 암호화해 전송해요.' },
    { q: '상담 후 꼭 선임해야 하나요?', a: '아니에요. 상담 뒤 선임 여부는 전적으로 자유이고, 진행하지 않아도 불이익은 없어요.' },
    { q: '어떤 변호사가 등록되어 있나요?', a: '자격 심사 중이거나 승인이 보류·정지된 변호사는 공개하지 않아요. 프로필에서 경력과 취급 분야를 확인할 수 있어요.' },
  ];

  return (
    <div className="animate-fadeIn space-y-10 text-left">
      <PageHeader
        variant="hero"
        title="서비스 이용 안내"
        description="my김변 이용 순서와 개인회생에 흔히 필요한 서류를 안내해 드려요."
      >
        <ul className="flex flex-wrap gap-2 text-sm font-bold text-white">
          {[
            { icon: <Clock className="h-4 w-4" aria-hidden="true" />, label: '약 3분' },
            { icon: <Shield className="h-4 w-4" aria-hidden="true" />, label: '100% 익명' },
            { icon: <Search className="h-4 w-4" aria-hidden="true" />, label: '변호사 비교' },
          ].map((f) => (
            <li key={f.label} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2">
              {f.icon}
              {f.label}
            </li>
          ))}
        </ul>
      </PageHeader>

      {/* 이용 순서 */}
      <section aria-labelledby="guide-steps">
        <SectionHeader id="guide-steps" title="이용 순서" />
        <ol className="space-y-4">
          {steps.map((s, idx) => (
            <li key={s.title}>
              <Card padded={false} className="flex gap-4 p-5 sm:p-6">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-white">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brand">{idx + 1}단계</p>
                  <h3 className="mt-0.5 text-lg font-bold text-slate-900 break-keep">{s.title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-slate-600 break-keep">{s.desc}</p>
                  <ul className="mt-3 space-y-2">
                    {s.details.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-base text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary-hover" aria-hidden="true" />
                        <span className="break-keep">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* 서류 준비 */}
      <section aria-labelledby="guide-docs" className="space-y-4">
        <SectionHeader
          id="guide-docs"
          title="개인회생 기본 서류 준비"
          description="흔히 필요한 서류를 7가지로 묶어 발급처와 확인할 점을 정리했어요. 실제로 필요한 서류는 관할 법원과 담당 변호사 안내를 따라 주세요."
          className="mb-0"
        />
        <SegmentedTabs<DocTab>
          tabs={[
            { id: 'salary', label: '직장인·급여소득자', icon: <Briefcase className="h-4 w-4" aria-hidden="true" /> },
            { id: 'business', label: '자영업·영업소득자', icon: <Building className="h-4 w-4" aria-hidden="true" /> },
          ]}
          value={docTab}
          onChange={setDocTab}
          ariaLabel="소득 유형"
          idPrefix="guide-docs"
          className="sm:max-w-md"
        />
        <div role="tabpanel" id={`guide-docs-panel-${docTab}`} aria-labelledby={`guide-docs-tab-${docTab}`} className="space-y-3">
          <Callout tone="warning" icon={<ShieldAlert className="h-4 w-4 text-amber-700" />} title="가족 주민등록번호 가리기">
            가족관계증명서·혼인관계증명서·주민등록등본을 낼 때는 본인을 뺀 가족의 주민등록번호 뒷자리를 가리는 경우가 많아요. 관할 법원·담당 변호사 안내를 따라 주세요.
          </Callout>
          <ol className="space-y-3">
            {docs.map((d, idx) => (
              <li key={d.title}>
                <Card padded={false} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-light text-sm font-bold text-brand" aria-hidden="true">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-slate-900 break-keep">
                        <span className="sr-only">{idx + 1}. </span>
                        {d.title}
                        <Badge tone={d.required ? 'brand' : 'neutral'}>{d.required ? '필수' : '해당 시'}</Badge>
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-600 break-keep">{d.desc}</p>
                      <p className="text-sm leading-relaxed text-slate-700 break-keep">
                        <strong className="font-bold">확인할 점:</strong> {d.tip}
                      </p>
                      <p className="text-sm text-slate-600">발급처: {d.issuer}</p>
                    </div>
                  </div>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50 md:self-center whitespace-nowrap"
                    >
                      발급처 열기
                      <ExternalLink className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      <span className="sr-only">({d.title}, 새 창)</span>
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 제도 안내 연결 */}
      <Card as="section" className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-light text-brand" aria-hidden="true">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 break-keep">회생·파산·신용회복 제도가 궁금하다면</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 break-keep">개인회생, 개인파산, 신용회복, 채무자대리인 제도의 차이를 정리했어요.</p>
          </div>
        </div>
        <a
          href="/guide/debt-management"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
        >
          채무관리 가이드 보기
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </Card>

      {/* 자주 묻는 질문 */}
      <section aria-labelledby="guide-faq">
        <SectionHeader id="guide-faq" title="자주 묻는 질문" />
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            const panelId = `guide-faq-panel-${idx}`;
            return (
              <div key={faq.q} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                  >
                    <span className="text-base font-bold text-slate-900 break-keep">{faq.q}</span>
                    <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
                  </button>
                </h3>
                {isOpen && (
                  <div id={panelId} className="border-t border-slate-100 px-5 py-4 text-base leading-relaxed text-slate-700 break-keep">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {onNavigate && (
        <Card as="section" className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">지금 시작해 보세요</h2>
            <p className="mt-1 text-sm text-slate-600">약 3분 · 실명 노출 없음 · 변호사 직접 선택</p>
          </div>
          <Button size="lg" onClick={() => onNavigate('diagnosis')} rightIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}>
            내 상황 체크하기
          </Button>
        </Card>
      )}
    </div>
  );
}
