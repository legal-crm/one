import React, { useRef, useState } from 'react';
import {
  ShieldCheck, Zap, Users, Send, ClipboardCheck, Star, Heart, Lock,
  MessageSquare, ArrowRight, Check, CheckCircle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// my김변 이용안내 — 4단계 인터랙티브 스테퍼
// 기존 4개 좌/우 지그재그 섹션(AGENTS.md Rule 3.2 위반)을
// "스텝 탭 + 단일 Split 패널" 구조로 통합했다.
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceGuideSectionProps {
  /** 익명 채무 체크 시작 */
  onStartCheck: () => void;
  /** 변호사 목록으로 이동 */
  onBrowseLawyers: () => void;
  /** 실제 LawyersView의 동시 선택 한도 (ClientRole → LawyersView maxSelections) */
  maxLawyerSelections?: number;
}

type StepId = 0 | 1 | 2 | 3;

interface GuideStep {
  label: string;
  title: string;
  desc: string;
  chips: { icon: React.ElementType; text: string }[];
  cta: { label: string; action: 'check' | 'lawyers' };
}

export default function ServiceGuideSection({
  onStartCheck,
  onBrowseLawyers,
  maxLawyerSelections = 3,
}: ServiceGuideSectionProps) {
  const [active, setActive] = useState<StepId>(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const steps: GuideStep[] = [
    {
      label: '익명 채무 체크',
      title: '이름 없이 1분이면 충분합니다',
      desc: '실명·주민번호 없이 채무 규모와 소득 정보만 입력하면 내 상황이 정리되고, 채무 전문 변호사에게 상담을 요청할 수 있습니다.',
      chips: [
        { icon: ShieldCheck, text: '실명 불필요' },
        { icon: Zap, text: '약 1분 소요' },
      ],
      cta: { label: '지금 바로 체크하기', action: 'check' },
    },
    {
      label: '변호사 선택',
      title: '나에게 맞는 변호사를 골라 한 번에 요청하세요',
      desc: `변호사 프로필을 비교해 최대 ${maxLawyerSelections}명까지 선택하고, 한 번의 요청으로 동시에 상담을 받아볼 수 있습니다.`,
      chips: [
        { icon: Users, text: `최대 ${maxLawyerSelections}명 동시 선택` },
        { icon: Send, text: '한 번에 상담 요청' },
      ],
      cta: { label: '변호사 둘러보기', action: 'lawyers' },
    },
    {
      label: '답변 비교',
      title: '여러 변호사의 답변을 직접 비교하세요',
      desc: '선택한 변호사가 내 상황에 대한 의견을 남깁니다. 답변과 프로필을 비교한 뒤, 원하는 경우에만 상담을 이어가면 됩니다.',
      chips: [
        { icon: ClipboardCheck, text: '답변 나란히 비교' },
        { icon: Star, text: '이용 후기 확인' },
        { icon: Heart, text: '선임 강요 없음' },
      ],
      cta: { label: '변호사 프로필 보기', action: 'lawyers' },
    },
    {
      label: '1:1 가명 상담',
      title: '가명으로 안전하게 1:1 상담을 진행하세요',
      desc: '선택한 변호사와 스텔스 가명으로 보호되는 프라이빗 상담방에서 대화합니다. 계약 전까지 실명과 연락처는 공개되지 않습니다.',
      chips: [
        { icon: Lock, text: '스텔스 가명 보호' },
        { icon: ShieldCheck, text: 'SSL/TLS 암호화' },
        { icon: MessageSquare, text: '실시간 · 비실시간' },
      ],
      cta: { label: '지금 시작하기', action: 'check' },
    },
  ];

  const step = steps[active];

  // WAI-ARIA Tabs 키보드 패턴 (←/→, Home/End)
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (idx + 1) % steps.length;
    if (e.key === 'ArrowLeft') next = (idx - 1 + steps.length) % steps.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = steps.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next as StepId);
    tabRefs.current[next]?.focus();
  };

  const runCta = () => (step.cta.action === 'check' ? onStartCheck() : onBrowseLawyers());

  return (
    <section className="w-full py-16 md:py-24 bg-white border-b border-slate-200" aria-labelledby="service-guide-title">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center space-y-3 mb-10 md:mb-12">
          <h2 id="service-guide-title" className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight">
            채무 정리부터 변호사 상담까지, 4단계
          </h2>
          <p className="text-base md:text-lg text-slate-600 font-medium">
            단계를 선택하면 실제 화면 흐름을 미리 볼 수 있습니다
          </p>
        </div>

        {/* Step tabs */}
        <div
          role="tablist"
          aria-label="이용 단계"
          className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-6 md:mb-8"
        >
          {steps.map((s, idx) => {
            const isActive = idx === active;
            const isDone = idx < active;
            return (
              <button
                key={s.label}
                ref={(el) => { tabRefs.current[idx] = el; }}
                type="button"
                role="tab"
                id={`guide-tab-${idx}`}
                aria-selected={isActive}
                aria-controls="guide-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(idx as StepId)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className={`relative min-h-[44px] flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 ${
                  isActive
                    ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white shadow-md'
                    : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 ${
                    isActive ? 'bg-white text-[#1E3A5F]' : isDone ? 'bg-[#0D9488] text-white' : 'bg-white border border-slate-300 text-slate-600'
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? <Check className="w-4 h-4" /> : `0${idx + 1}`}
                </span>
                <span className="text-sm md:text-base font-bold whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div
          role="tabpanel"
          id="guide-panel"
          aria-labelledby={`guide-tab-${active}`}
          className="rounded-3xl bg-[#F8FAFC] border border-slate-200 p-6 sm:p-8 lg:p-12"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Text */}
            <div key={`text-${active}`} className="space-y-5 text-left animate-fadeIn">
              <p className="text-sm font-bold text-[#0D9488]">STEP 0{active + 1}</p>
              <h3 className="text-2xl md:text-3xl font-extrabold text-[#0f172a] tracking-tight leading-snug break-keep">
                {step.title}
              </h3>
              <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium break-keep">
                {step.desc}
              </p>
              <ul className="flex flex-wrap gap-2">
                {step.chips.map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-[#1E3A5F] text-sm font-bold px-3 py-1.5 rounded-lg"
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={runCta}
                  className="inline-flex items-center gap-2 min-h-[44px] px-7 py-4 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold rounded-xl text-base transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] shadow-md"
                >
                  {step.cta.label}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                {active < 3 && (
                  <button
                    type="button"
                    onClick={() => setActive((active + 1) as StepId)}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 text-sm font-bold text-slate-600 hover:text-[#1E3A5F] rounded-xl whitespace-nowrap cursor-pointer"
                  >
                    다음 단계 보기
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Mockup — 고정 최소 높이로 탭 전환 시 레이아웃 점프 방지 */}
            <div key={`mock-${active}`} className="flex justify-center items-center lg:min-h-[460px] animate-fadeIn" aria-hidden="true">
              {active === 0 && <MockAnonCheck />}
              {active === 1 && <MockLawyerSelect max={maxLawyerSelections} />}
              {active === 2 && <MockAnswers />}
              {active === 3 && <MockPrivateChat />}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Mockups (UI 예시 — 실제 인물·수치 아님) ──────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="w-[300px] sm:w-[340px] rounded-b-3xl rounded-t-xl border-x-[6px] border-b-[6px] border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function MockAnonCheck() {
  return (
    <PhoneFrame>
      <div className="bg-[#F8FAFC] p-3.5 space-y-3">
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#1E3A5F] rounded-lg flex items-center justify-center text-white text-xs font-bold">김</div>
            <span className="text-xs sm:text-sm font-bold text-slate-700">my김변 채무 정리</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">채무 현황을 함께 정리해 볼게요. 현재 총 채무 금액은 어느 정도인가요?</p>
        </div>
        <div className="flex justify-end">
          <div className="bg-[#1E3A5F] rounded-xl px-3.5 py-2.5 max-w-[75%]">
            <p className="text-xs sm:text-sm text-white font-medium">5,000만원 정도입니다</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">월 소득은 얼마인가요? (세후 기준)</p>
        </div>
        <div className="flex justify-end">
          <div className="bg-[#1E3A5F] rounded-xl px-3.5 py-2.5 max-w-[75%]">
            <p className="text-xs sm:text-sm text-white font-medium">230만원입니다</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3.5 shadow-sm border border-slate-100">
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">부양가족은 몇 명인가요?</p>
        </div>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-500">입력해 주세요...</div>
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center shrink-0"><ArrowRight className="w-4 h-4 text-white" /></div>
        </div>
      </div>
    </PhoneFrame>
  );
}

const MOCK_LAWYERS = [
  { name: '김도현', specialty: '개인회생', region: '서울', color: 'bg-[#1E3A5F]' },
  { name: '박서연', specialty: '파산·면책', region: '경기', color: 'bg-[#0D9488]' },
  { name: '이정훈', specialty: '채무조정', region: '부산', color: 'bg-[#3B82F6]' },
  { name: '최민지', specialty: '개인회생', region: '대전', color: 'bg-[#7C3AED]' },
];

function MockLawyerSelect({ max }: { max: number }) {
  const checked = [true, true, false, true];
  const selectedCount = checked.filter(Boolean).length;
  return (
    <div className="relative w-full max-w-[380px]">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-[#1E3A5F] px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-white" /></div>
          <div>
            <p className="text-white font-bold text-base">변호사 선택하기</p>
            <p className="text-white/80 text-xs">원하는 변호사를 골라 한 번에 요청</p>
          </div>
        </div>
        <div className="p-4 space-y-2.5">
          {MOCK_LAWYERS.map((l, idx) => (
            <div key={l.name} className={`flex items-center gap-3 p-3 rounded-xl border ${checked[idx] ? 'border-[#1E3A5F]/30 bg-[#EEF4FA]' : 'border-slate-200 bg-white'}`}>
              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 ${checked[idx] ? 'border-[#1E3A5F] bg-[#1E3A5F]' : 'border-slate-300'}`}>
                {checked[idx] && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className={`w-9 h-9 ${l.color} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>{l.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-slate-900">{l.name} 변호사</p>
                <p className="text-xs text-slate-500 font-medium">{l.region} · {l.specialty}</p>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-sm font-bold text-[#1E3A5F]"><CheckCircle className="w-4 h-4 inline mr-1" />{selectedCount}명 선택됨</span>
              <span className="text-xs text-slate-500">최대 {max}명까지 선택 가능</span>
            </div>
            <div className="bg-[#1E3A5F] text-white text-center py-3.5 rounded-xl text-base font-bold flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />선택한 변호사에게 한 번에 요청
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MOCK_ANSWERS = [
  { name: '김도현', specialty: '개인회생', time: '15분 전', color: 'bg-[#1E3A5F]', answer: '입력하신 소득과 부양가족 기준으로 개인회생 절차를 검토해 볼 수 있습니다. 예상 변제금은 서류 확인 후 안내드리겠습니다.' },
  { name: '박서연', specialty: '파산·면책', time: '32분 전', color: 'bg-[#0D9488]', answer: '소득 상황에 따라 파산·면책 절차도 함께 비교해 보시길 권합니다. 상담에서 절차와 준비 서류를 안내드리겠습니다.' },
  { name: '최민지', specialty: '개인회생', time: '1시간 전', color: 'bg-[#7C3AED]', answer: '회생 신청과 함께 금지명령을 신청하면 강제집행 중지를 요청할 수 있습니다. 요건은 상담에서 확인해 드리겠습니다.' },
];

function MockAnswers() {
  return (
    <div className="relative w-full max-w-[390px]">
      <div className="space-y-3">
        <div className="bg-[#EEF4FA] rounded-xl px-4 py-3 text-center">
          <p className="text-sm font-bold text-[#1E3A5F]">📋 내 사건에 도착한 변호사 답변 <span className="text-[#0F766E]">{MOCK_ANSWERS.length}건</span></p>
        </div>
        {MOCK_ANSWERS.map((l) => (
          <div key={l.name} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${l.color} rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0`}>{l.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-slate-900">{l.name} 변호사</p>
                <p className="text-xs text-slate-500 font-medium">{l.specialty} · {l.time}</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-3.5">{l.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPrivateChat() {
  return (
    <PhoneFrame>
      <div className="bg-white flex flex-col">
        <div className="bg-[#1E3A5F] px-4 py-3.5 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-bold">김</div>
          <div>
            <p className="text-white text-sm font-bold">김도현 변호사</p>
            <p className="text-white/80 text-xs">프라이빗 상담방</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-xs text-emerald-300 font-bold">스텔스 가명</span>
          </div>
        </div>
        <div className="p-4 space-y-3.5 bg-[#F1F5F9]">
          <div className="flex gap-2.5">
            <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">김</div>
            <div className="bg-white rounded-2xl px-4 py-3 max-w-[80%] shadow-sm">
              <p className="text-sm text-slate-800 leading-relaxed">채무 현황 확인했습니다. 입력하신 소득 기준으로 개인회생 절차를 검토해 볼 수 있을 것 같습니다.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-[#1E3A5F] rounded-2xl px-4 py-3 max-w-[75%] shadow-sm">
              <p className="text-sm text-white leading-relaxed">감사합니다. 신청 절차와 필요 서류가 궁금합니다.</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">김</div>
            <div className="bg-white rounded-2xl px-4 py-3 max-w-[80%] shadow-sm">
              <p className="text-sm text-slate-800 leading-relaxed">서류 목록을 정리해서 안내드리겠습니다. 궁금한 점은 편하게 질문해 주세요.</p>
            </div>
          </div>
        </div>
        <div className="px-3 py-2.5 bg-white border-t border-slate-200 flex gap-2">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-500">메시지 입력...</div>
          <div className="w-8 h-8 bg-[#1E3A5F] rounded-lg flex items-center justify-center shrink-0"><ArrowRight className="w-4 h-4 text-white" /></div>
        </div>
      </div>
    </PhoneFrame>
  );
}

// ─── Trust Facts Bar ─────────────────────────────────────────────────────────
// 기존 "8,400+ 누적 이용자 / 평균 47초" mock 수치를 제거하고
// 코드로 검증 가능한 서비스 사실(fact)만 표시한다.
export function TrustFactsBar({ maxLawyerSelections = 3 }: { maxLawyerSelections?: number }) {
  const facts = [
    { value: '0원', label: '상담 요청 단계 플랫폼 이용료' },
    { value: `최대 ${maxLawyerSelections}명`, label: '변호사 동시 상담 요청' },
    { value: '실명 불필요', label: '계약 전까지 스텔스 가명' },
  ];
  return (
    <section className="w-full bg-[#0F2440] border-b border-[#1E3A5F]/30" aria-label="서비스 이용 조건">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <ul className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-700/50">
          {facts.map((f) => (
            <li key={f.label} className="space-y-1 px-1">
              <p className="text-lg sm:text-2xl font-extrabold text-white tracking-tight whitespace-nowrap">{f.value}</p>
              <p className="text-xs sm:text-sm text-slate-300 font-medium break-keep">{f.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
