import React, { useState, useEffect } from 'react';
import { 
  Volume2, VolumeX, Mic, MicOff, Sparkles, ChevronRight, 
  ChevronLeft, CheckCircle2, HelpCircle, ArrowRight, RotateCcw 
} from 'lucide-react';
import { toast } from 'sonner';
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
  const [isTtsMuted, setIsTtsMuted] = useState(false);
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
      // 실시간으로 현재 질문 답변에 업데이트
      const currentVal = answers[currentQ.id] || '';
      const updated = (currentVal ? currentVal.trim() + ' ' : '') + text.trim();
      onChangeAnswers({
        ...answers,
        [currentQ.id]: updated
      });
    }
  });

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

  return (
    <div className="space-y-6 animate-fadeIn text-left">
      
      {/* 상단 안내 & TTS 음소거 토글 바 */}
      <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl text-white flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0">
            🎙️
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-sm sm:text-base text-white">
                AI 대화형 인생 질문 인터뷰 (6문 6답)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-400 text-slate-950">
                {answeredCount} / 6 완료
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              AI의 목소리를 듣고 마이크로 편하게 대답하거나, 추천 단어 칩을 클릭해 주세요.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!isTtsMuted) speechSynthesizer.stop();
            setIsTtsMuted(!isTtsMuted);
          }}
          className={`p-2.5 rounded-2xl transition-all cursor-pointer ${
            isTtsMuted ? 'bg-white/10 text-white/60' : 'bg-white text-indigo-950 shadow-sm'
          }`}
          title={isTtsMuted ? 'AI 목소리 켜기' : 'AI 목소리 끄기'}
        >
          {isTtsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 6단계 진행 인디케이터 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {QUESTIONS.map((q, idx) => {
          const isDone = !!(answers[q.id] && answers[q.id]!.trim().length > 0);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                speechSynthesizer.stop();
                if (isListening) stopListening();
                setCurrentIdx(idx);
              }}
              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center truncate ${
                currentIdx === idx
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : isDone
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span>Q{idx + 1}. {q.title.split('. ')[1]?.slice(0, 4)}</span>
            </button>
          );
        })}
      </div>

      {/* 현재 질문 인터뷰 카드 */}
      <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border-2 border-indigo-200 dark:border-indigo-900/50 rounded-3xl space-y-5 shadow-xs">
        
        {/* 질문 헤더 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
              QUESTION {currentIdx + 1} OF 6
            </span>
            <button
              type="button"
              onClick={() => speechSynthesizer.speak(currentQ.speechText)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>질문 다시 듣기</span>
            </button>
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
            {currentQ.speechText}
          </h3>
          <p className="text-xs text-slate-500">
            💡 {currentQ.description}
          </p>
        </div>

        {/* 원터치 추천 단어 칩 리스트 */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
            👇 해당되는 내용을 클릭하시면 답변에 바로 추가됩니다:
          </label>
          <div className="flex flex-wrap gap-2">
            {currentQ.chips.map(chip => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl shadow-xs transition-all cursor-pointer active:scale-98"
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* 음성 마이크 녹음 버튼 + 실시간 답변 입력창 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              신청인의 답변 (마이크로 말씀하시거나 글을 다듬으실 수 있습니다)
            </label>

            {/* 마이크 토글 버튼 */}
            <button
              type="button"
              onClick={toggleListening}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer press-scale ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse shadow-md'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
              }`}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isListening ? '듣고 있습니다 (클릭 시 멈춤)' : '마이크 켜고 말하기'}</span>
            </button>
          </div>

          <textarea
            rows={3}
            value={answers[currentQ.id] || ''}
            onChange={e => handleTextChange(e.target.value)}
            placeholder={currentQ.placeholder}
            className="w-full p-4 text-xs font-sans bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden leading-relaxed"
          />
        </div>

        {/* 질문 네비게이션 버튼 (이전 / 다음 질문) */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => {
              speechSynthesizer.stop();
              if (isListening) stopListening();
              setCurrentIdx(prev => Math.max(0, prev - 1));
            }}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>이전 질문</span>
          </button>

          {currentIdx < QUESTIONS.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                speechSynthesizer.stop();
                if (isListening) stopListening();
                setCurrentIdx(prev => Math.min(QUESTIONS.length - 1, prev + 1));
              }}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer press-scale"
            >
              <span>다음 질문 (Q{currentIdx + 2})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isAiGenerating}
              onClick={() => {
                speechSynthesizer.stop();
                if (isListening) stopListening();
                onCompleteInterview();
              }}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-2 cursor-pointer press-scale disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>✨ 6문 6답 바탕으로 법원 진술문 완성하기</span>
            </button>
          )}
        </div>

      </div>

    </div>
  );
}
