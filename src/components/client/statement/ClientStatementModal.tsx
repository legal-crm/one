import React, { useState, useEffect } from 'react';
import { 
  Mic, MicOff, Sparkles, Scale, FileText, CheckCircle2, 
  AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Send, 
  Printer, ShieldCheck, Plus, Trash2, Volume2,
  Building2, MessageSquare, Save, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Callout, DocModal, ErrorState, FormField, MoneyInput, SegmentedTabs, Skeleton, SkeletonText, buildSubmitConfirm, inputClass, textareaClass, useDocAutosave } from '../ui';
import { useDialog } from '../../common/DialogProvider';
import { cn } from '../../../utils/cn';
import type { 
  CourtStatementData, 
  CourtStatementCaseType,
  JobHistoryItem
} from '../../../types/statementTypes';
import { StatementService } from '../../../services/statementService';
import { StatementAiService } from '../../../services/statementAiService';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import PrintableCourtStatementModal from './PrintableCourtStatementModal';
import JobHistoryImportModal from './JobHistoryImportModal';
import VoiceInterviewSection from './VoiceInterviewSection';

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

const STEPS: { step: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { step: 1, label: '학력·경력' },
  { step: 2, label: '과거 이력·주거' },
  { step: 3, label: '사연 입력' },
  { step: 4, label: 'AI 초안 검토' },
  { step: 5, label: '확인·제출' },
];

// 변경 감지용 직렬화(저장할 때마다 바뀌는 updatedAt은 제외)
const serializeStatement = (s: CourtStatementData | null, transcript: string) =>
  s ? JSON.stringify([{ ...s, updatedAt: '' }, transcript]) : '';

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

function ClientStatementModalInner({
  isOpen,
  onClose,
  clientId,
  clientName = '신청인',
  caseType: initialCaseType = 'rehab',
  // 모르는 값은 비워 둔다(이전: 서울회생법원·채무 5,000만·소득 250만 가짜 기본값이 AI 초안에 들어감)
  courtName = '',
  totalDebtAmount = 0,
  monthlyIncome = 0,
  onSuccessSubmitted
}: ClientStatementModalProps) {

  // 단계 상태 (1: 학력/경력, 2: 주거/과거이력, 3: 음성/사연입력, 4: AI 생성 및 검토, 5: 법원양식 미리보기/제출)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(3); // 3단계(사연입력)를 첫 진입으로 유도하거나 1단계부터
  const [caseType, setCaseType] = useState<CourtStatementCaseType>(initialCaseType);
  const [statement, setStatement] = useState<CourtStatementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 불러오기 실패 시 무한 로딩 대신 오류 카드와 다시 시도 버튼을 보여 준다
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialog = useDialog();
  
  // AI 옵션
  const [selectedTone, setSelectedTone] = useState<'formal' | 'emotional' | 'concise'>('formal');
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);

  // 신규: 공단 경력 불러오기 모달 및 대화형 인터뷰 탭 상태
  const [isJobImportOpen, setIsJobImportOpen] = useState(false);
  const [storyInputTab, setStoryInputTab] = useState<'interview' | 'free'>('interview');

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
      setLoadFailed(false);
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
        if (mounted) setLoadFailed(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [clientId, caseType, clientName, courtName, setTranscript, reloadKey]);

  // 음성·메모 입력(transcript)을 사연 칸에 합친 저장용 사본
  const withTranscript = (s: CourtStatementData): CourtStatementData => ({
    ...s,
    story: {
      ...s.story,
      voiceTranscript: transcript,
      rawCustomerNotes: transcript || s.story.rawCustomerNotes
    }
  });

  // 저장 상태: 임시 저장 버튼·닫을 때 저장(저장하면 사건 기록에도 동기화되므로 입력마다 자동 저장하지는 않음)
  const { saveState, isDirty, saveNow, markSaved } = useDocAutosave({
    snapshot: serializeStatement(statement, transcript),
    ready: !isLoading && !!statement,
    save: async () => {
      if (statement) await StatementService.saveStatement(withTranscript(statement));
    },
    // 방금 새로 만든 진술서(저장한 적 없음)는 '저장됨'으로 표시하지 않는다
    initialSavedAt:
      statement && Date.parse(statement.updatedAt) - Date.parse(statement.createdAt) > 1000 ? statement.updatedAt : null,
  });

  // 임시 저장
  const handleSaveDraft = async () => {
    if (!statement) return;
    if (!isDirty) {
      toast.info('바뀐 내용이 없어요. 이미 저장된 상태입니다.');
      return;
    }
    const ok = await saveNow();
    if (ok) toast.success('진술서를 임시 저장했어요.');
    else toast.error('저장하지 못했어요. 입력한 내용은 화면에 그대로 있으니 잠시 후 다시 시도해 주세요.');
  };

  // 닫기(X·ESC·배경): 작성 중인 내용을 먼저 저장(입력 유실 방지). AI 초안 작성·제출 중에는 닫지 않는다
  const handleBeforeClose = async (): Promise<boolean> => {
    if (isAiGenerating) {
      toast.info('AI 초안을 만드는 중이에요. 끝난 뒤에 닫아 주세요.');
      return false;
    }
    if (isSubmitting) return false;
    if (isListening) stopListening();
    if (!statement || !isDirty) return true;
    const ok = await saveNow();
    if (ok) return true;
    return dialog.confirm({
      title: '진술서를 저장하지 못했어요',
      message: '지금 닫으면 마지막 저장 이후에 입력한 내용이 사라집니다.',
      confirmText: '저장하지 않고 닫기',
      cancelText: '계속 작성',
      variant: 'danger',
    });
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

  // 공단 경력 일괄 추가 핸들러
  const handleImportJobs = (importedItems: JobHistoryItem[]) => {
    if (!statement) return;
    const existingNonEmpty = statement.jobHistories.filter(j => j.companyName && j.companyName.trim().length > 0);
    const merged = [...existingNonEmpty, ...importedItems];
    const updatedStatement: CourtStatementData = {
      ...statement,
      jobHistories: merged.length > 0 ? merged : importedItems
    };
    setStatement(updatedStatement);
    void StatementService.saveStatement(withTranscript(updatedStatement))
      .then(() => markSaved(undefined, serializeStatement(updatedStatement, transcript)))
      .catch(() => {});
    toast.success(`직장 경력 ${importedItems.length}건을 추가했어요. 내용이 맞는지 확인해 주세요.`);
  };

  // Gemini AI 진술서 자동 생성 실행
  const handleGenerateAiStatement = async () => {
    if (!statement) return;
    const rawInput = transcript || statement.story.rawCustomerNotes || '';
    const interviewAnswers = statement.story.lifeInterviewAnswers;
    const hasInterviewAnswers = interviewAnswers && Object.values(interviewAnswers).some(
      v => typeof v === 'string' && v.trim().length > 0
    );

    if (!rawInput && statement.story.initialCauseKeywords.length === 0 && !hasInterviewAnswers) {
      toast.error('음성 인터뷰 질문에 답변하시거나, 키워드/사연을 입력해 주세요.');
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
        courtName: statement.courtName,
        interviewAnswers: statement.story.lifeInterviewAnswers
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
        await StatementService.saveStatement({ ...updatedStatement });
        markSaved(undefined, serializeStatement(updatedStatement, transcript));
        setCurrentStep(4); // 검토 단계로 자동 이동
        if (res.source === 'gemini_ai') {
          toast.success('AI가 진술서 초안을 작성했습니다. 사실과 다른 부분이 없는지 꼭 확인해 주세요.');
        } else {
          toast.info('AI 연결이 되지 않아 입력 내용을 바탕으로 기본 초안을 만들었습니다. 내용을 직접 다듬어 주세요.');
        }
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

  // 변호사에게 최종 제출(제출 전 요약 확인)
  const handleSubmitToLawyer = async () => {
    if (!statement || isSubmitting) return;
    const s = statement.story;
    const hasStory = [s.initialCauseDetail, s.growthProcessDetail, s.insolvencyTriggerDetail, s.resolutionAndApology]
      .some(v => (v || '').trim().length > 0);
    const jobCount = (statement.jobHistories || []).filter(j => (j.companyName || '').trim().length > 0).length;
    const ok = await dialog.confirm(
      buildSubmitConfirm({
        title: '진술서를 변호사에게 제출할까요?',
        lines: [
          `${statement.caseType === 'rehab' ? '개인회생' : '개인파산'} 진술서`,
          `채무가 생긴 이유: ${(s.initialCauseKeywords || []).join(', ') || '선택 안 함'}`,
          `직장 경력 ${jobCount}건`,
        ],
        note: [
          hasStory ? '' : '진술 내용(채무 발생 원인 등)이 아직 비어 있어요. 그래도 제출하면 담당 변호사가 상담하며 함께 채웁니다.',
          '제출하면 담당 변호사 사건 기록에 저장되고, 변호사가 검토·보완한 뒤 법원 제출용으로 확정합니다.',
        ].filter(Boolean).join('\n'),
      })
    );
    if (!ok) return;

    setIsSubmitting(true);
    try {
      if (isListening) stopListening();
      const toSubmit = withTranscript(statement);
      const res = await StatementService.deliverStatementToLawyer(toSubmit);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      markSaved(toSubmit.updatedAt, serializeStatement(toSubmit, transcript));
      toast.success(res.message);
      if (onSuccessSubmitted) {
        onSuccessSubmitted(toSubmit);
      }
      onClose();
    } catch {
      toast.error('제출 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadingOrFailed = isLoading || !statement;
  const failed = loadFailed || (!isLoading && !statement);
  const isRehab = (statement?.caseType || caseType) === 'rehab';
  const isDelivered = !!statement && (statement.status === 'client_completed' || !!statement.deliveredToLawyerAt);

  const headerBadges = statement ? (
    <>
      {statement.status === 'lawyer_reviewed' ? (
        <Badge tone="info">변호사 검토 완료</Badge>
      ) : isDelivered ? (
        <Badge tone="success">변호사에게 제출함</Badge>
      ) : null}
    </>
  ) : null;

  const stepNav = (
    <nav aria-label="진술서 작성 단계" className="bg-white px-3 sm:px-6 py-2.5">
      <ol className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
        {STEPS.map(s => {
          const active = currentStep === s.step;
          const done = currentStep > s.step;
          return (
            <li key={s.step} className="shrink-0">
              <button
                type="button"
                onClick={() => setCurrentStep(s.step)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'min-h-11 min-w-11 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 text-sm font-bold whitespace-nowrap transition-colors',
                  active ? 'bg-brand text-white' : done ? 'text-emerald-700 hover:bg-slate-100' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <span className={cn('w-5 h-5 rounded-full text-xs flex items-center justify-center', active ? 'bg-white/20' : 'bg-slate-100')} aria-hidden="true">
                    {s.step}
                  </span>
                )}
                <span className={cn(!active && 'sr-only sm:not-sr-only')}>
                  <span className="sr-only">{s.step}단계 </span>
                  {s.label}
                </span>
                {done && <span className="sr-only">(완료)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const footer = !loadingOrFailed && statement ? (
    <>
      <div className="flex items-center gap-2">
        {currentStep > 1 && (
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4 | 5)}
            leftIcon={<ArrowLeft className="w-4 h-4" aria-hidden="true" />}
          >
            이전
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={saveState.status === 'saving' || isSubmitting}
          leftIcon={<Save className="w-4 h-4" aria-hidden="true" />}
        >
          임시 저장
        </Button>
      </div>
      {currentStep < 5 ? (
        // 하단 바는 단계 이동만 맡는다(AI 초안 만들기는 3·4단계 본문의 버튼 — 같은 뜻의 버튼을 두 곳에 두지 않음)
        <Button
          onClick={() => setCurrentStep((currentStep + 1) as 1 | 2 | 3 | 4 | 5)}
          disabled={isAiGenerating}
          rightIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
        >
          다음 단계
        </Button>
      ) : (
        <Button onClick={handleSubmitToLawyer} loading={isSubmitting} leftIcon={<Send className="w-4 h-4" aria-hidden="true" />}>
          {isDelivered ? '다시 제출하기' : '변호사에게 제출'}
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <>
    <DocModal
      open={isOpen}
      onClose={onClose}
      onBeforeClose={handleBeforeClose}
      closeLabel="진술서 작성 닫기"
      icon={<Scale className="w-5 h-5" />}
      title={`법원 제출용 ${isRehab ? '개인회생' : '개인파산'} 진술서 작성`}
      description="말로 이야기하거나 메모하면 AI가 진술서 초안을 정리해요. 입력 내용은 초안 작성을 위해 AI 서비스(Google Gemini)로 전송되며, 최종본은 담당 변호사가 검토합니다."
      badges={headerBadges}
      saveState={loadingOrFailed ? undefined : saveState}
      saveTarget="server"
      dirtyLabel="저장 전 변경이 있어요 · 닫으면 자동 저장돼요"
      idleLabel="닫으면 자동 저장돼요"
      subHeader={loadingOrFailed ? undefined : stepNav}
      footer={footer}
      bodyClassName="bg-white px-4 py-5 sm:px-8 sm:py-7"
    >
      {loadingOrFailed ? (
        failed ? (
          <ErrorState
            title="진술서를 불러오지 못했습니다"
            description="네트워크 상태를 확인한 뒤 다시 시도해 주세요. 문제가 계속되면 1:1 문의로 알려 주세요."
            onRetry={() => setReloadKey(k => k + 1)}
            secondaryAction={<Button variant="secondary" onClick={onClose}>닫기</Button>}
          />
        ) : (
          <div className="space-y-5" role="status" aria-live="polite">
            <span className="sr-only">진술서를 불러오는 중입니다</span>
            <Skeleton className="h-6 w-2/3" />
            <SkeletonText lines={4} />
            <Skeleton className="h-40 w-full" />
          </div>
        )
      ) : (
        <div className="space-y-6">

          {/* ────────────────────────────────────────
              STEP 1: 학력 및 직업 경력
          ──────────────────────────────────────── */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 break-keep">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center" aria-hidden="true">1</span>
                  최종 학력 및 직업 경력을 선택해 주세요
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed break-keep">
                  법원에서 신청인의 생계 유지 능력과 과거 경제활동 배경을 확인하는 기본 항목입니다.
                </p>
              </div>

              {/* 최종 학력(하나만 선택) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <h4 id="stmt-edu-title" className="text-base font-bold text-slate-900">최종 학력</h4>
                <div role="group" aria-labelledby="stmt-edu-title" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['고등학교 졸업', '전문대학 졸업', '대학교 졸업', '대학원 졸업 / 기타'].map(edu => {
                    const selected = statement.finalEducation === edu;
                    return (
                      <button
                        key={edu}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setStatement({ ...statement, finalEducation: edu })}
                        className={cn(
                          'min-h-11 px-3 py-2 rounded-xl border text-sm font-bold text-center break-keep inline-flex items-center justify-center gap-1.5 transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                          selected
                            ? 'border-brand bg-brand-light text-brand'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                        )}
                      >
                        {selected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        {edu}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 직업 경력 목록 */}
              <section aria-labelledby="stmt-jobs-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h4 id="stmt-jobs-title" className="text-base font-bold text-slate-900 break-keep">
                      과거 및 현재 직업 경력 (최근 2~3개)
                    </h4>
                    <p className="mt-1 text-sm text-slate-600 leading-relaxed break-keep">
                      기억이 잘 안 나면 건강보험 자격득실확인서나 국민연금 가입증명서 사진으로 과거 경력을 불러올 수 있습니다.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Button
                      variant="subtle"
                      onClick={() => setIsJobImportOpen(true)}
                      leftIcon={<Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />}
                      className="w-full sm:w-auto whitespace-normal sm:whitespace-nowrap"
                    >
                      자격득실확인서로 경력 불러오기
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const updated = [
                          ...statement.jobHistories,
                          { period: '', companyName: '', position: '', reasonForLeaving: '' }
                        ];
                        setStatement({ ...statement, jobHistories: updated });
                      }}
                      leftIcon={<Plus className="w-4 h-4" aria-hidden="true" />}
                      className="w-full sm:w-auto"
                    >
                      직접 추가
                    </Button>
                  </div>
                </div>

                <ul className="space-y-3">
                  {statement.jobHistories.map((job, idx) => {
                    const jobName = (job.companyName || '').trim();
                    return (
                      <li key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 min-h-11">
                          <h5 className="text-sm font-bold text-slate-800">경력 {idx + 1}</h5>
                          {statement.jobHistories.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = statement.jobHistories.filter((_, i) => i !== idx);
                                setStatement({ ...statement, jobHistories: updated });
                              }}
                              aria-label={jobName ? `${jobName} 경력 삭제` : `경력 ${idx + 1} 삭제`}
                              className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FormField label="기간">
                            {(p) => (
                              <input
                                {...p}
                                type="text"
                                placeholder="예: 2021.03 ~ 현재"
                                value={job.period}
                                onChange={e => {
                                  const updated = [...statement.jobHistories];
                                  updated[idx] = { ...updated[idx], period: e.target.value };
                                  setStatement({ ...statement, jobHistories: updated });
                                }}
                                className={inputClass}
                              />
                            )}
                          </FormField>
                          <FormField label="직장명 또는 상호">
                            {(p) => (
                              <input
                                {...p}
                                type="text"
                                value={job.companyName}
                                onChange={e => {
                                  const updated = [...statement.jobHistories];
                                  updated[idx] = { ...updated[idx], companyName: e.target.value };
                                  setStatement({ ...statement, jobHistories: updated });
                                }}
                                className={inputClass}
                              />
                            )}
                          </FormField>
                          <FormField label="직위/업종">
                            {(p) => (
                              <input
                                {...p}
                                type="text"
                                placeholder="예: 사원, 음식점 운영"
                                value={job.position}
                                onChange={e => {
                                  const updated = [...statement.jobHistories];
                                  updated[idx] = { ...updated[idx], position: e.target.value };
                                  setStatement({ ...statement, jobHistories: updated });
                                }}
                                className={inputClass}
                              />
                            )}
                          </FormField>
                          <FormField label="퇴직/폐업 사유">
                            {(p) => (
                              <input
                                {...p}
                                type="text"
                                placeholder="예: 계약 만료, 매출 감소로 폐업"
                                value={job.reasonForLeaving}
                                onChange={e => {
                                  const updated = [...statement.jobHistories];
                                  updated[idx] = { ...updated[idx], reasonForLeaving: e.target.value };
                                  setStatement({ ...statement, jobHistories: updated });
                                }}
                                className={inputClass}
                              />
                            )}
                          </FormField>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 2: 과거 법적 이력 & 주거 상황
          ──────────────────────────────────────── */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 break-keep">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center" aria-hidden="true">2</span>
                  과거 면책 이력 및 현재 주거 상황을 확인합니다
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed break-keep">
                  과거 5년/7년 이내 면책 여부와 현재 임차보증금 등 재산 상태를 소명하기 위한 법원 필수 서식입니다.
                </p>
              </div>

              {/* 과거 이력 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
                <fieldset>
                  <legend className="text-base font-bold text-slate-900 break-keep">
                    과거 개인회생, 파산면책, 신용회복(워크아웃)을 신청하신 적이 있습니까?
                  </legend>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label
                      className={cn(
                        'flex items-center gap-3 min-h-11 rounded-xl border px-3 py-2 cursor-pointer transition-colors',
                        !statement.pastHistory.hasPastCase ? 'border-brand bg-brand-light' : 'border-slate-300 bg-white hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="hasPastCase"
                        checked={!statement.pastHistory.hasPastCase}
                        onChange={() => setStatement({
                          ...statement,
                          pastHistory: { ...statement.pastHistory, hasPastCase: false }
                        })}
                        className="w-5 h-5 shrink-0 accent-brand"
                      />
                      <span className="text-sm font-bold text-slate-800 break-keep">아니요 (최초 신청입니다)</span>
                    </label>
                    <label
                      className={cn(
                        'flex items-center gap-3 min-h-11 rounded-xl border px-3 py-2 cursor-pointer transition-colors',
                        statement.pastHistory.hasPastCase ? 'border-brand bg-brand-light' : 'border-slate-300 bg-white hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="hasPastCase"
                        checked={statement.pastHistory.hasPastCase}
                        onChange={() => setStatement({
                          ...statement,
                          pastHistory: { ...statement.pastHistory, hasPastCase: true }
                        })}
                        className="w-5 h-5 shrink-0 accent-brand"
                      />
                      <span className="text-sm font-bold text-slate-800 break-keep">예 (과거 신청 경험이 있습니다)</span>
                    </label>
                  </div>
                </fieldset>

                {statement.pastHistory.hasPastCase && (
                  <div className="mt-4 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100">
                    <FormField label="신청 연도">
                      {(p) => (
                        <input
                          {...p}
                          type="text"
                          placeholder="예: 2018년"
                          value={statement.pastHistory.year || ''}
                          onChange={e => setStatement({
                            ...statement,
                            pastHistory: { ...statement.pastHistory, year: e.target.value }
                          })}
                          className={inputClass}
                        />
                      )}
                    </FormField>
                    <FormField label="법원/기관명">
                      {(p) => (
                        <input
                          {...p}
                          type="text"
                          placeholder="예: 수원지방법원"
                          value={statement.pastHistory.courtOrAgency || ''}
                          onChange={e => setStatement({
                            ...statement,
                            pastHistory: { ...statement.pastHistory, courtOrAgency: e.target.value }
                          })}
                          className={inputClass}
                        />
                      )}
                    </FormField>
                    <FormField label="사건번호 또는 결과">
                      {(p) => (
                        <input
                          {...p}
                          type="text"
                          placeholder="예: 면책완료"
                          value={statement.pastHistory.caseNumber || ''}
                          onChange={e => setStatement({
                            ...statement,
                            pastHistory: { ...statement.pastHistory, caseNumber: e.target.value }
                          })}
                          className={inputClass}
                        />
                      )}
                    </FormField>
                  </div>
                )}
              </div>

              {/* 현재 주거 상황 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="space-y-3">
                  <h4 id="stmt-res-title" className="text-base font-bold text-slate-900 break-keep">
                    현재 주거 형태를 선택해 주세요
                  </h4>
                  <div role="group" aria-labelledby="stmt-res-title" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { type: 'RENT_LEASE', label: '임차(월세/전세)' },
                      { type: 'RELATIVE_FREE', label: '친족 주택 무상거주' },
                      { type: 'NON_RELATIVE_FREE', label: '타인 주택 무상거주' },
                      { type: 'OWNED', label: '신청인 소유(자가)' },
                    ].map(res => {
                      const selected = statement.residence.residenceType === res.type;
                      return (
                        <button
                          key={res.type}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setStatement({
                            ...statement,
                            residence: {
                              ...statement.residence,
                              residenceType: res.type as any,
                              residenceTypeLabel: res.label
                            }
                          })}
                          className={cn(
                            'min-h-11 px-3 py-2 rounded-xl border text-sm font-bold text-center break-keep inline-flex items-center justify-center gap-1.5 transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                            selected
                              ? 'border-brand bg-brand-light text-brand'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                          )}
                        >
                          {selected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                          {res.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <FormField label="보증금">
                    {(p) => (
                      <MoneyInput
                        {...p}
                        value={statement.residence.deposit || null}
                        onChange={(v) => setStatement({
                          ...statement,
                          residence: { ...statement.residence, deposit: v ?? 0 }
                        })}
                      />
                    )}
                  </FormField>
                  <FormField label="월세">
                    {(p) => (
                      <MoneyInput
                        {...p}
                        value={statement.residence.monthlyRent || null}
                        onChange={(v) => setStatement({
                          ...statement,
                          residence: { ...statement.residence, monthlyRent: v ?? 0 }
                        })}
                      />
                    )}
                  </FormField>
                </div>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 3: 말로 사연 입력 (AI 음성 인터뷰 또는 자유 음성·메모)
          ──────────────────────────────────────── */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 break-keep">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center" aria-hidden="true">3</span>
                  어떻게 빚이 생기셨나요? 편하게 말씀해 주세요
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed break-keep">
                  글쓰기 부담 없이 질문에 답하시면 AI가 진술서에 흔히 쓰이는 4단 구성(발생원인·증대경위·지급불능·반성과 다짐)으로 초안을 정리해 드립니다.
                </p>
              </div>

              {/* 입력 방식 전환: AI 대화형 음성 인터뷰(6문 6답·추천) / 자유 음성녹음·직접 메모 (좁은 화면은 짧은 이름) */}
              <SegmentedTabs<'interview' | 'free'>
                tabs={[
                  {
                    id: 'interview',
                    icon: <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />,
                    label: (
                      <>
                        <span className="md:hidden">AI 인터뷰 (추천)</span>
                        <span className="hidden md:inline">AI 대화형 음성 인터뷰 (6문 6답 · 추천)</span>
                      </>
                    ),
                  },
                  {
                    id: 'free',
                    icon: <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />,
                    label: (
                      <>
                        <span className="md:hidden">자유 녹음·메모</span>
                        <span className="hidden md:inline">자유 음성녹음 / 직접 메모 입력</span>
                      </>
                    ),
                  },
                ]}
                value={storyInputTab}
                onChange={setStoryInputTab}
                ariaLabel="사연 입력 방식"
                idPrefix="stmt-story"
              />

              <div
                role="tabpanel"
                id={`stmt-story-panel-${storyInputTab}`}
                aria-labelledby={`stmt-story-tab-${storyInputTab}`}
              >
                {/* 모드 1: 대화형 인터뷰 */}
                {storyInputTab === 'interview' ? (
                  <div className="space-y-5">
                    <VoiceInterviewSection
                      answers={statement.story.lifeInterviewAnswers || {}}
                      onChangeAnswers={(updated) => {
                        setStatement({
                          ...statement,
                          story: {
                            ...statement.story,
                            lifeInterviewAnswers: updated
                          }
                        });
                      }}
                      onCompleteInterview={handleGenerateAiStatement}
                      isAiGenerating={isAiGenerating}
                    />

                    {/* 문체 선택 및 AI 초안 만들기 */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-light p-4 sm:p-5">
                      <div role="group" aria-labelledby="stmt-tone-interview" className="flex flex-wrap items-center gap-2">
                        <span id="stmt-tone-interview" className="text-sm font-bold text-slate-800 whitespace-nowrap">진술서 문체</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: 'formal', label: '정중·격식' },
                            { id: 'emotional', label: '진솔·호소력' },
                            { id: 'concise', label: '간결·명확' }
                          ].map(t => (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={selectedTone === t.id}
                              onClick={() => setSelectedTone(t.id as any)}
                              className={cn(
                                'min-h-11 px-3.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                                selectedTone === t.id
                                  ? 'bg-brand border-brand text-white'
                                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleGenerateAiStatement}
                        disabled={isAiGenerating}
                        loading={isAiGenerating}
                        leftIcon={<Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        className="w-full lg:w-auto whitespace-normal sm:whitespace-nowrap"
                      >
                        {isAiGenerating ? 'AI가 인터뷰 답변으로 초안을 만드는 중…' : '인터뷰 답변으로 진술서 초안 만들기'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* 모드 2: 자유 음성 녹음 및 키워드·메모 입력 */
                  <div className="space-y-6">
                    {/* 1) 채무 사유 키워드(여러 개 선택) */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3">
                      <h4 id="stmt-cause-title" className="text-base font-bold text-slate-900 break-keep">
                        해당되는 사유를 선택해 주세요
                        <span className="ml-1.5 inline-block text-sm font-medium text-slate-600">(여러 개 선택 가능)</span>
                      </h4>
                      <div role="group" aria-labelledby="stmt-cause-title" className="flex flex-wrap gap-2">
                        {CAUSE_KEYWORDS.map(kw => {
                          const isSelected = statement.story.initialCauseKeywords?.includes(kw);
                          return (
                            <button
                              key={kw}
                              type="button"
                              aria-pressed={!!isSelected}
                              onClick={() => toggleKeyword(kw)}
                              className={cn(
                                'min-h-11 px-3.5 rounded-xl border text-sm font-bold text-left break-keep inline-flex items-center gap-1.5 transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                                isSelected
                                  ? 'bg-brand border-brand text-white hover:bg-brand-hover'
                                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                              )}
                            >
                              {isSelected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                              {kw}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2) 음성 마이크 녹음 컨트롤러 */}
                    <div
                      className={cn(
                        'rounded-2xl border p-5 sm:p-6 flex flex-col items-center justify-center text-center gap-4 transition-colors',
                        isListening ? 'border-red-300 bg-red-50/60' : 'border-slate-200 bg-white'
                      )}
                    >
                      <button
                        type="button"
                        onClick={toggleListening}
                        aria-pressed={isListening}
                        aria-label="음성 녹음"
                        className={cn(
                          'relative w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-colors active:scale-[0.98]',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                          isListening
                            ? 'bg-red-600 hover:bg-red-700 ring-8 ring-red-100'
                            : 'bg-brand hover:bg-brand-hover ring-4 ring-brand/15'
                        )}
                      >
                        {isListening ? (
                          <>
                            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75" aria-hidden="true"></span>
                            <MicOff className="w-8 h-8 relative z-10" aria-hidden="true" />
                          </>
                        ) : (
                          <Mic className="w-8 h-8" aria-hidden="true" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <p aria-live="polite" className="flex items-center justify-center gap-1.5 text-sm font-bold text-slate-900 break-keep">
                          {isListening ? (
                            <>
                              <span className="w-2 h-2 shrink-0 rounded-full bg-red-600" aria-hidden="true" />
                              듣고 있습니다. 편안하게 말씀해 주세요.
                            </>
                          ) : (
                            '마이크 버튼을 누르고 말씀하세요'
                          )}
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed break-keep">
                          예: "2021년에 식당을 열었는데 코로나 때문에 손님이 줄어서 월세 내려고 카드 돌려막기 하다가 빚이 7천만 원까지 늘어났고 결국 작년에 폐업했습니다..."
                        </p>
                      </div>

                      {speechError && (
                        <p role="alert" className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-left text-sm font-bold text-red-700 break-keep">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                          <span>{speechError}</span>
                        </p>
                      )}
                    </div>

                    {/* 3) 실시간 음성 자막 / 텍스트 편집 영역 */}
                    <FormField
                      label={
                        <>
                          <Volume2 className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />
                          음성 인식 결과 및 메모
                          <span className="text-xs font-medium text-slate-600">(키보드로 직접 수정하실 수 있습니다)</span>
                        </>
                      }
                    >
                      {(p) => (
                        <>
                          <textarea
                            {...p}
                            rows={4}
                            value={transcript + (interimTranscript ? ` (${interimTranscript})` : '')}
                            onChange={e => setTranscript(e.target.value)}
                            placeholder="마이크로 말씀하시거나, 직접 글을 입력하셔도 좋습니다. 문맥이 매끄럽지 않아도 AI가 초안으로 다듬어 드립니다. 사실과 다른 내용은 쓰지 말아 주세요."
                            className={cn(textareaClass, 'min-h-40')}
                          />
                          {transcript && (
                            <div className="flex justify-end">
                              <Button variant="ghost" onClick={() => setTranscript('')}>
                                내용 지우기
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </FormField>

                    {/* 4) 문체 선택 및 AI 초안 만들기 */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand-light p-4 sm:p-5">
                      <div role="group" aria-labelledby="stmt-tone-free" className="flex flex-wrap items-center gap-2">
                        <span id="stmt-tone-free" className="text-sm font-bold text-slate-800 whitespace-nowrap">진술서 문체</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: 'formal', label: '정중·격식' },
                            { id: 'emotional', label: '진솔·호소력' },
                            { id: 'concise', label: '간결·명확' }
                          ].map(t => (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={selectedTone === t.id}
                              onClick={() => setSelectedTone(t.id as any)}
                              className={cn(
                                'min-h-11 px-3.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-colors',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
                                selectedTone === t.id
                                  ? 'bg-brand border-brand text-white'
                                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                              )}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        onClick={handleGenerateAiStatement}
                        disabled={isAiGenerating}
                        loading={isAiGenerating}
                        leftIcon={<Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />}
                        className="w-full lg:w-auto whitespace-normal sm:whitespace-nowrap"
                      >
                        {isAiGenerating ? 'AI가 초안을 만드는 중…' : 'AI로 진술서 초안 만들기'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 4: AI 생성 결과 및 4단 섹션 검토
          ──────────────────────────────────────── */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 break-keep">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center" aria-hidden="true">4</span>
                    AI가 만든 진술서 초안을 검토해 주세요
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed break-keep">
                    4단 구성 초안으로 정리했습니다. 사실과 다르거나 과장된 부분이 없는지 읽어보고 직접 수정해 주세요.
                  </p>
                </div>

                <Button
                  variant="secondary"
                  onClick={handleGenerateAiStatement}
                  disabled={isAiGenerating}
                  loading={isAiGenerating}
                  leftIcon={<RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  className="w-full sm:w-auto shrink-0"
                >
                  {isAiGenerating ? 'AI가 초안을 만드는 중…' : 'AI 초안 다시 만들기'}
                </Button>
              </div>

              {/* 표현 점검 결과(키워드 검사): 변호사 확인 권고 */}
              {safetyWarnings.length > 0 && (
                <Callout tone="warning" title="변호사 확인이 필요한 내용이 있어요">
                  <ul className="mt-1 space-y-1 pl-5 list-disc">
                    {safetyWarnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </Callout>
              )}

              {/* 4단 구조 편집 섹션 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5">
                {/* 1. 발생 원인 */}
                <FormField label="1. 채무 발생의 최초 원인">
                  {(p) => (
                    <textarea
                      {...p}
                      rows={3}
                      value={statement.story.initialCauseDetail}
                      onChange={e => setStatement({
                        ...statement,
                        story: { ...statement.story, initialCauseDetail: e.target.value }
                      })}
                      className={cn(textareaClass, 'min-h-36')}
                    />
                  )}
                </FormField>

                {/* 2. 증대 경위 */}
                <FormField label="2. 채무가 점차 증대된 구체적 경위 (돌려막기, 고금리 등)">
                  {(p) => (
                    <textarea
                      {...p}
                      rows={4}
                      value={statement.story.growthProcessDetail}
                      onChange={e => setStatement({
                        ...statement,
                        story: { ...statement.story, growthProcessDetail: e.target.value }
                      })}
                      className={cn(textareaClass, 'min-h-36')}
                    />
                  )}
                </FormField>

                {/* 3. 지급불능 사정 */}
                <FormField label="3. 지급불능에 이르게 된 결정적 사정 및 시점">
                  {(p) => (
                    <textarea
                      {...p}
                      rows={3}
                      value={statement.story.insolvencyTriggerDetail}
                      onChange={e => setStatement({
                        ...statement,
                        story: { ...statement.story, insolvencyTriggerDetail: e.target.value }
                      })}
                      className={cn(textareaClass, 'min-h-36')}
                    />
                  )}
                </FormField>

                {/* 4. 반성과 다짐 */}
                <FormField label="4. 신청인의 반성과 향후 성실한 갱생/변제 다짐">
                  {(p) => (
                    <textarea
                      {...p}
                      rows={3}
                      value={statement.story.resolutionAndApology}
                      onChange={e => setStatement({
                        ...statement,
                        story: { ...statement.story, resolutionAndApology: e.target.value }
                      })}
                      className={cn(textareaClass, 'min-h-36')}
                    />
                  )}
                </FormField>
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────
              STEP 5: 법원 양식 모양 미리보기 · 제출 안내
          ──────────────────────────────────────── */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 break-keep">
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-light text-brand text-xs font-bold flex items-center justify-center" aria-hidden="true">5</span>
                  법원 양식 모양으로 정리했어요
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed break-keep">
                  입력한 내용을 법원 제출 양식 모양으로 보여 드려요. 담당 변호사가 검토·보완한 뒤 법원 제출본을 확정합니다.
                </p>
              </div>

              {/* 미리보기 카드 */}
              <section aria-labelledby="stmt-preview-title" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <h4 id="stmt-preview-title" className="flex items-center gap-2 text-base font-bold text-slate-900 break-keep">
                    <FileText className="w-5 h-5 shrink-0 text-brand" aria-hidden="true" />
                    {isRehab ? '개인회생' : '개인파산'} 진술서 제출 양식 미리보기
                  </h4>
                  <Button
                    variant="secondary"
                    onClick={() => setIsPrintModalOpen(true)}
                    leftIcon={<Printer className="w-4 h-4" aria-hidden="true" />}
                    className="w-full sm:w-auto shrink-0"
                  >
                    양식 크게 보기·인쇄
                  </Button>
                </div>

                {/* 스크롤되는 미리보기: 키보드로도 스크롤할 수 있게 포커스 가능 영역으로 둔다 */}
                <div
                  role="region"
                  aria-label="진술서 미리보기 내용"
                  tabIndex={0}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 text-sm font-serif leading-relaxed text-slate-800 max-h-72 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <p className="text-center font-bold text-base tracking-widest pb-2 border-b border-slate-200">
                    <span aria-hidden="true">진 &nbsp; &nbsp; 술 &nbsp; &nbsp; 서</span>
                    <span className="sr-only">진술서</span>
                  </p>
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
              </section>

              {/* 제출 안내: 제출 버튼은 하단 바에만 둔다 */}
              <Callout
                tone="success"
                icon={<ShieldCheck className="w-4 h-4 text-emerald-700" />}
                title="제출하면 담당 변호사 사건 기록에 저장됩니다"
              >
                화면 아래의 ‘{isDelivered ? '다시 제출하기' : '변호사에게 제출'}’ 버튼을 눌러 주세요. 담당 변호사가 진술서 내용을 검토·보완한 뒤 법원 제출용으로 확정합니다. 제출 후에도 변호사 요청에 따라 수정될 수 있습니다.
              </Callout>
            </div>
          )}

        </div>

      )}
    </DocModal>

      {/* 과거 직장 경력 불러오기 — 작성 창 위에 뜨는 창 */}
      {statement && (
        <JobHistoryImportModal
          isOpen={isJobImportOpen}
          onClose={() => setIsJobImportOpen(false)}
          clientName={statement.applicantName}
          onConfirmImport={handleImportJobs}
        />
      )}

      {/* 법원 양식 미리보기·인쇄 — 작성 창 위에 뜨는 창 */}
      {statement && (
        <PrintableCourtStatementModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          statement={withTranscript(statement)}
        />
      )}
    </>
  );
}

// Rules of Hooks: isOpen 가드는 훅을 쓰는 본문 바깥에서 처리 (열고 닫을 때 훅 개수 불일치 크래시 방지)
export default function ClientStatementModal(props: ClientStatementModalProps) {
  if (!props.isOpen) return null;
  return <ClientStatementModalInner {...props} />;
}
