import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, ChevronRight, ChevronLeft, CheckCircle2, Plus } from 'lucide-react';
import { Badge, Button, textareaClass } from '../ui';
import { cn } from '../../../utils/cn';
import { speechSynthesizer } from '../../../utils/speechSynthesis';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';

export interface LifeInterviewAnswers {
  upbringing?: string;                   // Q1. 성장 환경 및 가정 배경
  healthAndMedical?: string;             // Q2. 건강 및 질병/간병 사정
  firstDebtCause?: string;               // Q3. 첫 채무 발생 계기
  debtGrowthProcess?: string;            // Q4. 채무 증대 과정
  insolvencyCrisis?: string;             // Q5. 더 이상 갚을 수 없게 된 결정적 순간
  futureResolution?: string;             // Q6. 회생/파산을 통한 재기 다짐
}

interface VoiceInterviewSectionProps {
  answers: LifeInterviewAnswers;
  onChangeAnswers: (updated: LifeInterviewAnswers) => void;
  onCompleteInterview: () => void;
  isAiGenerating?: boolean;
}

interface QuestionConfig {
  id: keyof LifeInterviewAnswers;
  title: string;
  speechText: string;
  description: string;
  placeholder: string;
  chips: string[];
}

const QUESTIONS: QuestionConfig[] = [
  {
    id: 'upbringing',
    title: '1. 성장 환경 및 가정 배경',
    speechText: '첫 번째 질문입니다. 어린 시절이나 학창 시절의 가정 형편 및 성장 환경은 어떠셨나요? 편하게 말씀해 주세요.',
    description: '법원에서 신청인의 경제적 기초와 사회 진출 배경의 불가피성을 확인하는 질문입니다.',
    placeholder: '예: 유년기부터 가정 형편이 어려워 일찍부터 아르바이트를 하며 생활비를 보태야 했습니다...',
    chips: [
      '평범하고 화목한 가정',
      '유년기부터 경제적 빈곤 누적',
      '부모님 사업 실패 및 빚 대물림',
      '한부모 또는 조손 가정에서 성장',
      '소년소녀가장으로 일찍부터 가족 부양'
    ]
  },
  {
    id: 'healthAndMedical',
    title: '2. 건강 및 질병/의료비 사정',
    speechText: '두 번째 질문입니다. 본인이나 가족 중에 질병, 부상, 우울증 등으로 거액의 병원비나 간병 부담이 있으셨나요?',
    description: '채무 발생의 불가피성과 근로능력 저하를 입증하는 핵심 참작 사유입니다.',
    placeholder: '예: 어머니가 뇌졸중으로 쓰러지셔서 수술비와 매월 200만 원 상당의 간병비가 지출되었습니다...',
    chips: [
      '건강상 큰 질병이나 문제는 없음',
      '본인 중증 질환/수술로 인한 거액 치료비',
      '가족(부모/배우자/자녀) 암·뇌질환 장기 간병',
      '심각한 우울증·공황장애로 인한 소득 중단',
      '교통사고/산업재해 부상 및 후유장애'
    ]
  },
  {
    id: 'firstDebtCause',
    title: '3. 첫 채무 발생 계기',
    speechText: '세 번째 질문입니다. 사회생활을 시작하며 처음 대출이나 카드 빚을 지게 된 계기는 무엇이었나요?',
    description: '과소비나 사치가 아닌 부득이한 생계형 채무임을 소명합니다.',
    placeholder: '예: 취업이 지연되면서 월세와 식비를 감당하기 어려워 신용카드 현금서비스를 처음 받았습니다...',
    chips: [
      '취업난 및 일상 생계비 부족',
      '창업(식당/매장) 개업 자금 및 보증금 마련',
      '전세사기 피해 또는 전세보증금 대출',
      '가족/지인 보증 채무 대위변제',
      '결혼 및 신혼집 주거비 마련'
    ]
  },
  {
    id: 'debtGrowthProcess',
    title: '4. 채무가 눈덩이처럼 불어난 과정',
    speechText: '네 번째 질문입니다. 이후 어떤 상황에서 빚이 감당할 수 없을 만큼 급격히 늘어났나요?',
    description: '이자 부담과 돌려막기 등 채무가 증대될 수밖에 없었던 과정을 설명합니다.',
    placeholder: '예: 코로나로 가게 매출이 반토막 났는데 임대료와 인건비를 메우려 카드론과 저축은행 대출로 돌려막기를 하였습니다...',
    chips: [
      '코로나/경기침체 매출 급감 및 폐업',
      '고정비 충당 카드 돌려막기 누적',
      '고금리 대부업·일수 사채 이용',
      '주식/가상자산 손실을 만회하려다 실패',
      '대출 이자 부담이 눈덩이처럼 가중'
    ]
  },
  {
    id: 'insolvencyCrisis',
    title: '5. 더 이상 갚을 수 없게 된 결정적 순간',
    speechText: '다섯 번째 질문입니다. 스스로 더 이상 빚을 갚을 수 없다고 느낀 결정적인 순간은 언제였나요?',
    description: '법률상 지급불능(파탄) 상태에 도달한 객관적 시점입니다.',
    placeholder: '예: 매월 갚아야 할 원리금이 300만 원을 넘어가며 연체가 시작되었고 급여 압류 통지서를 받았습니다...',
    chips: [
      '매월 원리금 상환액이 월 소득을 초과',
      '대출 만기 연장 거절 및 연체 개시',
      '채권추심 독촉 전화 및 압류 통지서 수령',
      '가게 폐업 신고 및 일자리 상실'
    ]
  },
  {
    id: 'futureResolution',
    title: '6. 회생/파산을 통한 갱생과 재기 다짐',
    speechText: '마지막 질문입니다. 이 절차를 통해 채무를 털어내고 어떤 삶을 살아가고 싶으신가요?',
    description: '채권자들에 대한 사죄와 성실한 변제계획 이행 의지를 강력히 표명합니다.',
    placeholder: '예: 저를 믿어준 어린 자녀들을 끝까지 책임지고, 법원의 변제계획에 따라 성실히 완납하여 당당히 재기하겠습니다...',
    chips: [
      '성실한 근로소득으로 변제금 완납 다짐',
      '가족과 어린 자녀를 끝까지 부양',
      '채권자분들께 진심으로 사죄하며 새출발',
      '신용을 회복하여 떳떳한 사회의 일원으로 복귀'
    ]
  }
];

export default function VoiceInterviewSection({
  answers,
  onChangeAnswers,
  onCompleteInterview,
  isAiGenerating = false
}: VoiceInterviewSectionProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isTtsMuted, setIsTtsMuted] = useState(true);
  const currentQ = QUESTIONS[currentIdx];

  // 음성 STT 훅
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    toggleListening,
    setTranscript
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    onResult: (text) => {
      // text는 이번 녹음을 시작한 뒤 인식된 전체 문장(누적값)이다.
      // 녹음 시작 시점의 답변(base) 뒤에 붙여야 한다 — 매번 현재 답변에 누적값을 덧붙이면 같은 말이 반복 저장됨
      const base = dictationBaseRef.current;
      const updated = (base ? base.trim() + ' ' : '') + text.trim();
      onChangeAnswersRef.current({
        ...answersRef.current,
        [dictationQuestionIdRef.current]: updated
      });
    }
  });

  // 녹음 시작 시점의 답변·질문과 최신 answers/onChange를 보관
  const dictationBaseRef = React.useRef('');
  const dictationQuestionIdRef = React.useRef(currentQ.id);
  const answersRef = React.useRef(answers);
  answersRef.current = answers;
  const onChangeAnswersRef = React.useRef(onChangeAnswers);
  onChangeAnswersRef.current = onChangeAnswers;

  const handleToggleDictation = () => {
    if (!isListening) {
      dictationBaseRef.current = answers[currentQ.id] || '';
      dictationQuestionIdRef.current = currentQ.id;
      setTranscript('');
    }
    toggleListening();
  };

  // 질문이 바뀔 때마다 AI가 음성으로 읽어주기 (TTS)
  useEffect(() => {
    if (!isTtsMuted) {
      speechSynthesizer.speak(currentQ.speechText, { rate: 0.95 });
    }
    return () => {
      speechSynthesizer.stop();
    };
  }, [currentIdx, isTtsMuted, currentQ.speechText]);

  // 추천 칩 클릭 시 텍스트 추가
  const handleChipClick = (chip: string) => {
    const current = answers[currentQ.id] || '';
    const updated = current 
      ? `${current.trim()}, ${chip}` 
      : chip;
    onChangeAnswers({
      ...answers,
      [currentQ.id]: updated
    });
  };

  // 텍스트 직접 입력 핸들러
  const handleTextChange = (val: string) => {
    onChangeAnswers({
      ...answers,
      [currentQ.id]: val
    });
  };

  const answeredCount = Object.values(answers).filter(v => typeof v === 'string' && v.trim().length > 0).length;
  const answerId = `voice-answer-${currentQ.id}`;

  return (
    <div className="space-y-5 text-left">

      {/* 안내 + 질문 읽어 주기(기본 꺼짐 — 열자마자 소리가 나지 않게) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
            <Mic className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-slate-900">질문 6개에 답하며 사연 정리하기</h4>
              <Badge tone={answeredCount === QUESTIONS.length ? 'success' : 'neutral'}>
                {answeredCount}/{QUESTIONS.length} 답함
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-600 leading-relaxed break-keep">
              마이크로 말하거나 예시를 눌러 답을 채워 주세요. 원하면 질문을 소리로 읽어 드려요.
            </p>
          </div>
        </div>

        <Button
          variant="secondary"
          aria-pressed={!isTtsMuted}
          onClick={() => {
            if (!isTtsMuted) speechSynthesizer.stop();
            setIsTtsMuted(!isTtsMuted);
          }}
          leftIcon={isTtsMuted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          className="w-full sm:w-auto shrink-0"
        >
          {isTtsMuted ? '질문 읽어 주기 켜기' : '질문 읽어 주기 끄기'}
        </Button>
      </div>

      {/* 6개 질문 이동 */}
      <nav aria-label="인터뷰 질문">
        <ol className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {QUESTIONS.map((q, idx) => {
            const isDone = !!(answers[q.id] && answers[q.id]!.trim().length > 0);
            const active = currentIdx === idx;
            return (
              <li key={q.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    speechSynthesizer.stop();
                    if (isListening) stopListening();
                    setCurrentIdx(idx);
                  }}
                  aria-current={active ? 'step' : undefined}
                  aria-label={`질문 ${idx + 1}: ${q.title.split('. ')[1] || q.title}${isDone ? ' (답함)' : ''}`}
                  className={cn(
                    'min-h-11 min-w-11 px-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1 transition-colors',
                    active
                      ? 'bg-brand text-white'
                      : isDone
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400'
                  )}
                >
                  {isDone && !active && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                  Q{idx + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 현재 질문 카드 */}
      <section aria-labelledby={`${answerId}-q`} className="rounded-2xl border-2 border-brand/20 bg-white p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-brand">
              질문 {currentIdx + 1} / {QUESTIONS.length} · {currentQ.title.split('. ')[1] || currentQ.title}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => speechSynthesizer.speak(currentQ.speechText)}
              leftIcon={<Volume2 className="w-4 h-4" aria-hidden="true" />}
              className="min-h-11"
            >
              질문 듣기
            </Button>
          </div>
          <h3 id={`${answerId}-q`} className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-keep">
            {currentQ.speechText}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed break-keep">{currentQ.description}</p>
        </div>

        {/* 예시 답변(누르면 답변 칸에 추가) */}
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">해당하는 내용을 누르면 답변에 더해져요</p>
          <div className="flex flex-wrap gap-2">
            {currentQ.chips.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="min-h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-brand hover:text-brand transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* 답변(마이크 또는 직접 입력) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={answerId} className="text-sm font-bold text-slate-800">
              내 답변 <span className="font-medium text-slate-600">(말로 하거나 글로 다듬어 주세요)</span>
            </label>
            <Button
              variant={isListening ? 'danger' : 'subtle'}
              onClick={handleToggleDictation}
              aria-pressed={isListening}
              leftIcon={isListening ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
            >
              {isListening ? '듣는 중 · 누르면 멈춤' : '마이크 켜고 말하기'}
            </Button>
          </div>
          {isListening && (
            <p className="sr-only" role="status">
              듣고 있습니다
            </p>
          )}
          <textarea
            id={answerId}
            rows={3}
            value={answers[currentQ.id] || ''}
            onChange={e => handleTextChange(e.target.value)}
            placeholder={currentQ.placeholder}
            className={cn(textareaClass, 'min-h-28')}
          />
        </div>

        {/* 이전 / 다음 질문 (초안 만들기는 인터뷰 아래 버튼 하나로) */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <Button
            variant="ghost"
            disabled={currentIdx === 0}
            onClick={() => {
              speechSynthesizer.stop();
              if (isListening) stopListening();
              setCurrentIdx(prev => Math.max(0, prev - 1));
            }}
            leftIcon={<ChevronLeft className="w-4 h-4" aria-hidden="true" />}
          >
            이전 질문
          </Button>

          {currentIdx < QUESTIONS.length - 1 ? (
            <Button
              variant="secondary"
              onClick={() => {
                speechSynthesizer.stop();
                if (isListening) stopListening();
                setCurrentIdx(prev => Math.min(QUESTIONS.length - 1, prev + 1));
              }}
              rightIcon={<ChevronRight className="w-4 h-4" aria-hidden="true" />}
            >
              다음 질문
            </Button>
          ) : (
            <p className="text-sm font-bold text-slate-700 text-right break-keep">
              마지막 질문이에요. 아래에서 초안을 만들어 주세요.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
