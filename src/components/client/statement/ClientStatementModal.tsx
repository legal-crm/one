import React, { useState, useEffect } from 'react';
import { 
  X, Mic, MicOff, Sparkles, Scale, FileText, CheckCircle2, 
  AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Send, 
  Printer, ShieldCheck, HelpCircle, Plus, Trash2, Edit3, Volume2 
} from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import type { 
  CourtStatementData, 
  CourtStatementCaseType,
  JobHistoryItem
} from '../../../types/statementTypes';
import { StatementService } from '../../../services/statementService';
import { StatementAiService } from '../../../services/statementAiService';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import PrintableCourtStatementModal from './PrintableCourtStatementModal';

interface ClientStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  caseType?: CourtStatementCaseType;
  courtName?: string;
  totalDebtAmount?: number;
  monthlyIncome?: number;
  onSuccessSubmitted?: (statement: CourtStatementData) => void;
}

const CAUSE_KEYWORDS = [
  '생활비 부족',
  '사업 부진 및 폐업',
  '물가 및 금리 인상',
  '가족 의료비 및 간병',
  '갑작스러운 실직 및 소득감소',
  '타인 보증 채무',
  '전세 사기 또는 투자 사기 피해',
  '주식/가상자산 투자 손실',
  '카드 돌려막기 누적',
  '자녀 학비 및 양육비'
];

export default function ClientStatementModal({
  isOpen,
  onClose,
  clientId,
  clientName = '신청인',
  caseType: initialCaseType = 'rehab',
  courtName = '서울회생법원',
  totalDebtAmount = 5000,
  monthlyIncome = 250,
  onSuccessSubmitted
}: ClientStatementModalProps) {
  if (!isOpen) return null;

  // 단계 상태 (1: 학력/경력, 2: 주거/과거이력, 3: 음성/사연입력, 4: AI 생성 및 검토, 5: 법원양식 미리보기/제출)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(3); // 3단계(사연입력)를 첫 진입으로 유도하거나 1단계부터
  const [caseType, setCaseType] = useState<CourtStatementCaseType>(initialCaseType);
  const [statement, setStatement] = useState<CourtStatementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // AI 옵션
  const [selectedTone, setSelectedTone] = useState<'formal' | 'emotional' | 'concise'>('formal');
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);

  // 음성 인식 STT 훅
  const {
    isSupported: isSpeechSupported,
    isListening,
    transcript,
    interimTranscript,
    errorMessage: speechError,
    startListening,
    stopListening,
    toggleListening,
    setTranscript
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true
  });

  // 데이터 로드
  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const loaded = await StatementService.loadStatement(clientId, caseType, clientName, {
          courtName,
          applicantName: clientName
        });
        if (mounted) {
          setStatement(loaded);
          // 기존에 음성이나 메모가 있으면 트랜스크립트에 반영
          if (loaded.story.rawCustomerNotes || loaded.story.voiceTranscript) {
            setTranscript(loaded.story.voiceTranscript || loaded.story.rawCustomerNotes || '');
          }
        }
      } catch (e) {
        console.warn('[ClientStatementModal] Load error', e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clientId, caseType, clientName, courtName, setTranscript]);

  // 임시 저장
  const handleSaveDraft = async () => {
    if (!statement) return;
    try {
      const toSave = {
        ...statement,
        story: {
          ...statement.story,
          voiceTranscript: transcript,
          rawCustomerNotes: transcript || statement.story.rawCustomerNotes
        }
      };
      await StatementService.saveStatement(toSave);
      setStatement(toSave);
      toast.success('진술서가 임시 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    }
  };

  // 키워드 토글
  const toggleKeyword = (kw: string) => {
    if (!statement) return;
    const current = statement.story.initialCauseKeywords || [];
    const updated = current.includes(kw)
      ? current.filter(k => k !== kw)
      : [...current, kw];

    setStatement({
      ...statement,
      story: {
        ...statement.story,
        initialCauseKeywords: updated
      }
    });
  };

  // Gemini AI 진술서 자동 생성 실행
  const handleGenerateAiStatement = async () => {
    if (!statement) return;
    const rawInput = transcript || statement.story.rawCustomerNotes || '';
    if (!rawInput && statement.story.initialCauseKeywords.length === 0) {
      toast.error('마이크로 말씀하시거나, 사유 키워드를 1개 이상 선택해 주세요.');
      return;
    }

    setIsAiGenerating(true);
    // 듣고 있던 마이크 끄기
    if (isListening) stopListening();

    try {
      const res = await StatementAiService.generateCourtStatement({
        caseType: statement.caseType,
        applicantName: statement.applicantName,
        rawVoiceOrText: rawInput,
        selectedKeywords: statement.story.initialCauseKeywords,
        totalDebtAmount,
        monthlyIncome,
        tone: selectedTone,
        courtName: statement.courtName
      });

      if (res && res.ok) {
        setSafetyWarnings(res.safetyWarnings || []);
        const updatedStatement: CourtStatementData = {
          ...statement,
          story: {
            ...statement.story,
            voiceTranscript: transcript,
            rawCustomerNotes: rawInput,
            initialCauseDetail: res.sections.initialCause,
            growthProcessDetail: res.sections.growthProcess,
            insolvencyTriggerDetail: res.sections.insolvencyTrigger,
            resolutionAndApology: res.sections.resolution,
            aiDraftStatement: res.fullFormattedText,
            aiPolishedAt: new Date().toISOString(),
            aiToneUsed: selectedTone,
            aiSafetyCheckFlags: res.safetyWarnings
          }
        };

        setStatement(updatedStatement);
        await StatementService.saveStatement(updatedStatement);
        setCurrentStep(4); // 검토 단계로 자동 이동
        toast.success('✨ 제미나이가 법원 표준 진술문을 성공적으로 완성했습니다!');
      } else {
        toast.error('AI 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
    } catch (err) {
      console.warn('[AI Generate failed]', err);
      toast.error('AI 생성에 실패했습니다.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  // 변호사에게 최종 제출
  const handleSubmitToLawyer = async () => {
    if (!statement) return;
    try {
      const res = await StatementService.deliverStatementToLawyer(statement);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
      toast.success(res.message);
      if (onSuccessSubmitted) {
        onSuccessSubmitted(statement);
      }
      onClose();
    } catch {
      toast.error('제출 중 문제가 발생했습니다.');
    }
  };

  if (isLoading || !statement) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">법원 진술서 시스템을 준비 중입니다...</p>
        </div>
      </div>
    );
  }

  const isRehab = statement.caseType === 'rehab';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* ═══ 상단 헤더 ═══ */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg font-bold">
              ⚖️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  법원 제출용 {isRehab ? '개인회생' : '개인파산'} 진술서 간편 작성기
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                  Gemini 2.5 AI 스마트 도우미
                </span>
              </div>
              <p className="text-xs text-slate-400">
                신청인: {statement.applicantName} · 말로 편하게 이야기하면 제미나이가 법원 양식으로 완성해 드립니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer press-scale whitespace-nowrap"
            >
              임시저장
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══ 단계 네비게이션 프로그레스 바 ═══ */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold overflow-x-auto">
          {[
            { step: 1, label: '1. 학력 & 경력' },
            { step: 2, label: '2. 과거이력 & 주거' },
            { step: 3, label: '3. 말로 사연 입력 (음성/메모)' },
            { step: 4, label: '4. AI 생성 & 검토' },
            { step: 5, label: '5. 법원양식 확인 & 제출' },
          ].map(s => (
            <button
              key={s.step}
              onClick={() => setCurrentStep(s.step as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                currentStep === s.step
                  ? 'bg-brand text-white shadow-xs'
                  : currentStep > s.step
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-slate-200/50'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {currentStep > s.step ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{s.step}.</span>}
              <span>{s.label.split('. ')[1]}</span>
            </button>
          ))}
        </div>

        {/* ═══ 본문 영역 ═══ */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">

          {/* ────────────────────────────────────────
              STEP 1: 학력 및 직업 경력
          ──────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs">1</span>
                  최종 학력 및 직업 경력을 선택해 주세요
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  법원에서 신청인의 생계 유지 능력과 과거 경제활동 배경을 확인하는 기본 항목입니다.
                </p>
              </div>

              {/* 최종 학력 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">최종 학력</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['고등학교 졸업', '전문대학 졸업', '대학교 졸업', '대학원 졸업 / 기타'].map(edu => (
                    <button
                      key={edu}
                      type="button"
                      onClick={() => setStatement({ ...statement, finalEducation: edu })}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                        statement.finalEducation === edu
                          ? 'border-brand bg-brand/5 text-brand shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {edu}
                    </button>
                  ))}
                </div>
              </div>

              {/* 직업 경력 목록 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    과거 및 현재 직업 경력 (최근 2~3개)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [
                        ...statement.jobHistories,
                        { period: '2019.01 ~ 2021.02', companyName: '', position: '직원', reasonForLeaving: '퇴직' }
                      ];
                      setStatement({ ...statement, jobHistories: updated });
                    }}
                    className="text-xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>경력 추가</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {statement.jobHistories.map((job, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                      <input
                        type="text"
                        placeholder="기간 (예: 2021.03 ~ 현재)"
                        value={job.period}
                        onChange={e => {
                          const updated = [...statement.jobHistories];
                          updated[idx].period = e.target.value;
                          setStatement({ ...statement, jobHistories: updated });
                        }}
                        className="w-full sm:w-36 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                      <input
                        type="text"
                        placeholder="직장명 또는 상호"
                        value={job.companyName}
                        onChange={e => {
                          const updated = [...statement.jobHistories];
                          updated[idx].companyName = e.target.value;
                          setStatement({ ...statement, jobHistories: updated });
                        }}
                        className="w-full sm:flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                      <input
                        type="text"
                        placeholder="직위/업종"
                        value={job.position}
                        onChange={e => {
                          const updated = [...statement.jobHistories];
                          updated[idx].position = e.target.value;
                          setStatement({ ...statement, jobHistories: updated });
                        }}
                        className="w-full sm:w-28 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                      <input
                        type="text"
                        placeholder="퇴직/폐업 사유"
                        value={job.reasonForLeaving}
                        onChange={e => {
                          const updated = [...statement.jobHistories];
                          updated[idx].reasonForLeaving = e.target.value;
                          setStatement({ ...statement, jobHistories: updated });
                        }}
                        className="w-full sm:w-40 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                      />
                      {statement.jobHistories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = statement.jobHistories.filter((_, i) => i !== idx);
                            setStatement({ ...statement, jobHistories: updated });
                          }}
                          className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 2: 과거 법적 이력 & 주거 상황
          ──────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs">2</span>
                  과거 면책 이력 및 현재 주거 상황을 확인합니다
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  과거 5년/7년 이내 면책 여부와 현재 임차보증금 등 재산 상태를 소명하기 위한 법원 필수 서식입니다.
                </p>
              </div>

              {/* 과거 이력 */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  과거 개인회생, 파산면책, 신용회복(워크아웃)을 신청하신 적이 있습니까?
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="hasPastCase"
                      checked={!statement.pastHistory.hasPastCase}
                      onChange={() => setStatement({
                        ...statement,
                        pastHistory: { ...statement.pastHistory, hasPastCase: false }
                      })}
                      className="accent-brand"
                    />
                    <span>아니오 (최초 신청입니다)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="hasPastCase"
                      checked={statement.pastHistory.hasPastCase}
                      onChange={() => setStatement({
                        ...statement,
                        pastHistory: { ...statement.pastHistory, hasPastCase: true }
                      })}
                      className="accent-brand"
                    />
                    <span>예 (과거 신청 경험이 있습니다)</span>
                  </label>
                </div>

                {statement.pastHistory.hasPastCase && (
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="신청 연도 (예: 2018년)"
                      value={statement.pastHistory.year || ''}
                      onChange={e => setStatement({
                        ...statement,
                        pastHistory: { ...statement.pastHistory, year: e.target.value }
                      })}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="법원/기관명 (예: 수원지방법원)"
                      value={statement.pastHistory.courtOrAgency || ''}
                      onChange={e => setStatement({
                        ...statement,
                        pastHistory: { ...statement.pastHistory, courtOrAgency: e.target.value }
                      })}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                    <input
                      type="text"
                      placeholder="사건번호 또는 결과 (예: 면책완료)"
                      value={statement.pastHistory.caseNumber || ''}
                      onChange={e => setStatement({
                        ...statement,
                        pastHistory: { ...statement.pastHistory, caseNumber: e.target.value }
                      })}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* 현재 주거 상황 */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  현재 주거 형태를 선택해 주세요
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { type: 'RENT_LEASE', label: '임차(월세/전세)' },
                    { type: 'RELATIVE_FREE', label: '친족 주택 무상거주' },
                    { type: 'NON_RELATIVE_FREE', label: '타인 주택 무상거주' },
                    { type: 'OWNED', label: '신청인 소유(자가)' },
                  ].map(res => (
                    <button
                      key={res.type}
                      type="button"
                      onClick={() => setStatement({
                        ...statement,
                        residence: {
                          ...statement.residence,
                          residenceType: res.type as any,
                          residenceTypeLabel: res.label
                        }
                      })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        statement.residence.residenceType === res.type
                          ? 'border-brand bg-brand/5 text-brand shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {res.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">보증금 (원)</label>
                    <input
                      type="number"
                      value={statement.residence.deposit || 0}
                      onChange={e => setStatement({
                        ...statement,
                        residence: { ...statement.residence, deposit: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400">월세 (원)</label>
                    <input
                      type="number"
                      value={statement.residence.monthlyRent || 0}
                      onChange={e => setStatement({
                        ...statement,
                        residence: { ...statement.residence, monthlyRent: Number(e.target.value) }
                      })}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 3: 말로 사연 입력 (음성 STT + 키워드) - 핵심!
          ──────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs">3</span>
                  마이크를 켜고 편하게 말씀해 주세요 (말로 입력하기)
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  타자를 칠 필요 없이, 어떻게 빚이 생겼고 왜 갚기 어려워졌는지 편한 말투로 이야기하시면 제미나이가 법원 양식으로 정리해 드립니다.
                </p>
              </div>

              {/* 1) 채무 사유 키워드 칩 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>해당되는 사유를 선택해 주세요 (다중 선택 가능)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CAUSE_KEYWORDS.map(kw => {
                    const isSelected = statement.story.initialCauseKeywords?.includes(kw);
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => toggleKeyword(kw)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-brand text-white shadow-xs scale-102'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {isSelected && <span>✓</span>}
                        <span>{kw}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2) 음성 마이크 녹음 컨트롤러 */}
              <div className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center justify-center text-center gap-4 ${
                isListening 
                  ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20' 
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30'
              }`}>
                {/* 마이크 버튼 */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all shadow-xl cursor-pointer press-scale relative ${
                    isListening
                      ? 'bg-rose-500 hover:bg-rose-600 ring-8 ring-rose-200 dark:ring-rose-950/60'
                      : 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-100 dark:ring-indigo-950/40'
                  }`}
                  title={isListening ? '음성 녹음 중지' : '음성 녹음 시작'}
                >
                  {isListening ? (
                    <>
                      <span className="absolute inset-0 rounded-full bg-rose-400 animate-ping opacity-75"></span>
                      <MicOff className="w-8 h-8 relative z-10" />
                    </>
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>

                <div className="space-y-1">
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {isListening 
                      ? '🔴 듣고 있습니다. 편안하게 말씀해 주세요...' 
                      : '마이크 버튼을 누르고 말씀하세요 (모바일/PC 지원)'}
                  </p>
                  <p className="text-xs text-slate-500">
                    예: "2021년에 식당을 열었는데 코로나 때문에 손님이 줄어서 월세 내려고 카드 돌려막기 하다가 빚이 7천만 원까지 늘어났고 결국 작년에 폐업했습니다..."
                  </p>
                </div>

                {speechError && (
                  <p className="text-xs text-rose-500 font-bold bg-rose-100 dark:bg-rose-900/30 px-3 py-1.5 rounded-xl">
                    ⚠️ {speechError}
                  </p>
                )}
              </div>

              {/* 3) 실시간 음성 자막 / 텍스트 편집 영역 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-indigo-500" />
                    <span>음성 인식 결과 및 메모 (키보드로 직접 수정하실 수 있습니다)</span>
                  </label>
                  {transcript && (
                    <button
                      type="button"
                      onClick={() => setTranscript('')}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      내용 지우기
                    </button>
                  )}
                </div>

                <textarea
                  rows={4}
                  value={transcript + (interimTranscript ? ` (${interimTranscript})` : '')}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder="마이크로 말씀하시거나, 직접 글을 입력하셔도 좋습니다. 문맥이 매끄럽지 않아도 제미나이가 법원 양식에 맞춰 완벽하게 다듬어 드립니다."
                  className="w-full p-4 text-xs font-sans bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand focus:outline-hidden leading-relaxed"
                />
              </div>

              {/* 4) AI 문체 톤 선택 및 생성 실행 버튼 */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 whitespace-nowrap">문체 톤:</span>
                  <div className="flex gap-1">
                    {[
                      { id: 'formal', label: '정중·격식' },
                      { id: 'emotional', label: '진솔·호소력' },
                      { id: 'concise', label: '간결·명확' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTone(t.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          selectedTone === t.id
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiStatement}
                  disabled={isAiGenerating}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer press-scale disabled:opacity-50 whitespace-nowrap"
                >
                  {isAiGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>제미나이가 법원 문장으로 다듬는 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                      <span>✨ 제미나이로 법원 진술서 완성하기</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 4: AI 생성 결과 및 4단 섹션 검토
          ──────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs">4</span>
                    제미나이가 완성한 법원 제출용 진술문 검토
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    대법원 표준 4단 구성으로 정리되었습니다. 내용을 읽어보시고 필요한 부분을 직접 수정하실 수 있습니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiStatement}
                  disabled={isAiGenerating}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
                  <span>다시 생성하기</span>
                </button>
              </div>

              {/* 법률 안전 검증 경고 배너 (Safety Check) */}
              {safetyWarnings.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>법률 안전 사전 검토 안내 (변호사 확인 권고)</span>
                  </div>
                  <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 pl-5 list-disc">
                    {safetyWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 4단 구조 편집 섹션 */}
              <div className="space-y-4">
                {/* 1. 발생 원인 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    1. 채무 발생의 최초 원인
                  </label>
                  <textarea
                    rows={3}
                    value={statement.story.initialCauseDetail}
                    onChange={e => setStatement({
                      ...statement,
                      story: { ...statement.story, initialCauseDetail: e.target.value }
                    })}
                    className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl leading-relaxed font-sans"
                  />
                </div>

                {/* 2. 증대 경위 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    2. 채무가 점차 증대된 구체적 경위 (돌려막기, 고금리 등)
                  </label>
                  <textarea
                    rows={4}
                    value={statement.story.growthProcessDetail}
                    onChange={e => setStatement({
                      ...statement,
                      story: { ...statement.story, growthProcessDetail: e.target.value }
                    })}
                    className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl leading-relaxed font-sans"
                  />
                </div>

                {/* 3. 지급불능 사정 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    3. 지급불능에 이르게 된 결정적 사정 및 시점
                  </label>
                  <textarea
                    rows={3}
                    value={statement.story.insolvencyTriggerDetail}
                    onChange={e => setStatement({
                      ...statement,
                      story: { ...statement.story, insolvencyTriggerDetail: e.target.value }
                    })}
                    className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl leading-relaxed font-sans"
                  />
                </div>

                {/* 4. 반성과 다짐 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    4. 신청인의 반성과 향후 성실한 갱생/변제 다짐
                  </label>
                  <textarea
                    rows={3}
                    value={statement.story.resolutionAndApology}
                    onChange={e => setStatement({
                      ...statement,
                      story: { ...statement.story, resolutionAndApology: e.target.value }
                    })}
                    className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl leading-relaxed font-sans"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 5: 법원 정식 양식 확인 & 제출
          ──────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h4 className="font-black text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand flex items-center justify-center text-xs">5</span>
                  법원 정식 서식으로 완성되었습니다
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  작성하신 내용이 대법원·회생법원 표준 규격 A4 양식에 맞추어 정렬되었습니다. 담당 변호사에게 전달하여 사건 서류철에 첨부할 수 있습니다.
                </p>
              </div>

              {/* 미리보기 카드 */}
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-3xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>대법원 표준 {isRehab ? '개인회생' : '개인파산'} 진술서 서식 완비</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>정식 양식 크게보기 & PDF 저장</span>
                  </button>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs font-serif leading-relaxed text-slate-800 dark:text-slate-200 max-h-72 overflow-y-auto">
                  <div className="text-center font-bold text-base tracking-widest pb-2 border-b border-slate-200 dark:border-slate-800">
                    진 &nbsp; &nbsp; 술 &nbsp; &nbsp; 서
                  </div>
                  <div>
                    <span className="font-bold font-sans">1. 채무 발생 원인: </span>
                    {statement.story.initialCauseDetail}
                  </div>
                  <div>
                    <span className="font-bold font-sans">2. 채무 증대 경위: </span>
                    {statement.story.growthProcessDetail}
                  </div>
                  <div>
                    <span className="font-bold font-sans">3. 지급불능 사정: </span>
                    {statement.story.insolvencyTriggerDetail}
                  </div>
                  <div>
                    <span className="font-bold font-sans">4. 반성과 다짐: </span>
                    {statement.story.resolutionAndApology}
                  </div>
                </div>
              </div>

              {/* 변호사 자동 전달 안내 배너 */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-emerald-900 dark:text-emerald-300">
                    제출 시 담당 변호사에게 실시간 자동 전송됩니다
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400">
                    변호사 사무소 CRM의 전자소송 서류철({isRehab ? '10번 진술서 슬롯' : '02번 파산 진술서 슬롯'})에 바로 첨부되어, 법원 전자소송 접수 시 즉시 사용됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ═══ 하단 네비게이션 툴바 ═══ */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep - 1) as any)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>이전 단계</span>
              </button>
            ) : (
              <span className="text-xs text-slate-400">1단계입니다</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 3 && !statement.story.initialCauseDetail) {
                    // 3단계에서 아직 AI 생성을 안 누르고 다음을 누르면 AI 생성 권장
                    handleGenerateAiStatement();
                    return;
                  }
                  setCurrentStep((currentStep + 1) as any);
                }}
                className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer press-scale shadow-sm"
              >
                <span>다음 단계</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitToLawyer}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-2 cursor-pointer press-scale shadow-lg"
              >
                <Send className="w-4 h-4" />
                <span>변호사에게 자동 전달 & 서류 첨부하기</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 대법원 정식 서식 인쇄/PDF 저장 모달 */}
      <PrintableCourtStatementModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        statement={statement}
      />
    </div>
  );
}
