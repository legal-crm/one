import React, { useState } from 'react';
import { 
  X, Check, Building2, UserCheck, ShieldCheck, Upload, FileText, 
  Sparkles, AlertCircle, HelpCircle, ExternalLink, Copy, CheckCircle2,
  Search, ShieldAlert, ArrowRight, AlertTriangle, ChevronRight, Lightbulb
} from 'lucide-react';
import { CompanionSourceType, CaseStageType, CaseOcrParseResult } from '../../../types';
import { 
  registerNewCompanionCase, 
  parseCaseDocumentOcr, 
  getCourtSearchDeepLink 
} from '../../../services/companionService';
import { toast } from 'sonner';

interface CaseRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialAlias?: string;
}

const COURTS = [
  '서울회생법원', '수원회생법원', '부산회생법원',
  '의정부지방법원', '인천지방법원', '춘천지방법원',
  '대전지방법원', '청주지방법원', '대구지방법원',
  '부산지방법원', '울산지방법원', '창원지방법원',
  '광주지방법원', '전주지방법원', '제주지방법원'
];

export default function CaseRegistrationModal({
  isOpen,
  onClose,
  onSuccess,
  initialAlias = '회원'
}: CaseRegistrationModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sourceType, setSourceType] = useState<CompanionSourceType>('external_office');
  const [externalOfficeName, setExternalOfficeName] = useState('');
  const [caseType, setCaseType] = useState<'individual_rehab' | 'bankruptcy'>('individual_rehab');
  const [caseStage, setCaseStage] = useState<CaseStageType>('approved');
  
  // 사건 정보
  const [courtName, setCourtName] = useState('서울회생법원');
  const [caseNumber, setCaseNumber] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrHighlights, setOcrHighlights] = useState<string[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);

  // OCR 검증 및 경고/실패 팝업 상태
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [ocrFailureReason, setOcrFailureReason] = useState<string>('');
  const [ocrFailureHighlights, setOcrFailureHighlights] = useState<string[]>([]);
  const [showOcrAlertModal, setShowOcrAlertModal] = useState<boolean>(false);
  
  // 변제 조건
  const [monthlyRepaymentAmount, setMonthlyRepaymentAmount] = useState<number>(480000);
  const [repaymentDay, setRepaymentDay] = useState<number>(10);
  const [totalRounds, setTotalRounds] = useState<number>(36);
  const [completedRounds, setCompletedRounds] = useState<number>(14);
  const [startRepaymentDate, setStartRepaymentDate] = useState<string>('2025-07');
  const [courtVirtualAccount, setCourtVirtualAccount] = useState<string>('');
  
  // 소득/생계비
  const [monthlyIncome, setMonthlyIncome] = useState<number>(2800000);
  const [essentialLivingCost, setEssentialLivingCost] = useState<number>(1750000);
  const [otherFixedExpenses, setOtherFixedExpenses] = useState<number>(320000);

  if (!isOpen) return null;

  // 스마트 문서 OCR 비동기 파싱
  const handleOcrUpload = async (file: File) => {
    setIsOcrProcessing(true);
    setOcrStatus('idle');
    setOcrFailureReason('');
    setOcrFailureHighlights([]);
    toast.info('Gemini AI가 서류에서 사건번호와 변제계획을 정밀 분석하고 있습니다...');
    
    try {
      const result: CaseOcrParseResult = await parseCaseDocumentOcr(file);
      setIsOcrProcessing(false);

      // 공식 법원 서류가 아니거나 사건번호를 찾을 수 없는 경우 엄격한 실패 판정
      const isFailed = result.isValidCourtDoc === false || 
                       !result.caseNumber || 
                       result.recognitionStatus === 'invalid_document' || 
                       result.detectedDocType === 'invalid_or_unrelated' ||
                       (result.confidenceScore !== undefined && result.confidenceScore < 0.4);

      if (isFailed) {
        setOcrStatus('failed');
        const reason = result.failureReason || '법원 공식 회생·파산 서류(결정문, 접수증 등)로 확인되지 않았거나 사건번호를 찾을 수 없습니다.';
        setOcrFailureReason(reason);
        setOcrFailureHighlights(result.extractedHighlights || []);
        setOcrConfidence(result.confidenceScore || 0);
        setShowOcrAlertModal(true);
        toast.error('⚠️ 서류 인식 실패: 법원 서류가 아니거나 사건번호를 식별하지 못했습니다.');
        return;
      }

      // 회생/파산 법원 공식 서류로 확인되고 사건번호가 추출된 경우
      setOcrStatus('success');
      if (result.courtName) setCourtName(result.courtName);
      if (result.caseNumber) setCaseNumber(result.caseNumber);
      if (result.caseStage) setCaseStage(result.caseStage);
      if (result.monthlyRepaymentAmount) setMonthlyRepaymentAmount(result.monthlyRepaymentAmount);
      if (result.repaymentDay) setRepaymentDay(result.repaymentDay);
      if (result.totalRounds) setTotalRounds(result.totalRounds);
      if (result.startRepaymentDate) setStartRepaymentDate(result.startRepaymentDate);
      if (result.courtVirtualAccount) setCourtVirtualAccount(result.courtVirtualAccount);
      
      setOcrHighlights(result.extractedHighlights);
      setOcrConfidence(result.confidenceScore);
      toast.success('🎉 법원 결정문에서 핵심 사건정보가 자동 추출되었습니다!');
    } catch (err) {
      setIsOcrProcessing(false);
      setOcrStatus('failed');
      setOcrFailureReason('문서 분석 중 통신 오류가 발생했습니다. 직접 입력하시거나 선명한 사진으로 다시 시도해 주세요.');
      setShowOcrAlertModal(true);
      toast.error('문서 분석 중 오류가 발생했습니다. 직접 입력해 주세요.');
    }
  };

  // 대법원 사건검색 딥링크 정보
  const courtDeepLink = getCourtSearchDeepLink(courtName, caseNumber);

  const handleCopyCourtInfo = () => {
    navigator.clipboard.writeText(courtDeepLink.copySummaryText);
    toast.success(`'${courtDeepLink.copySummaryText}'가 클립보드에 복사되었습니다. 대법원 사이트에서 붙여넣기 하세요.`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim()) {
      toast.error('사건번호를 입력해 주세요 (예: 2024개회123456)');
      return;
    }

    try {
      registerNewCompanionCase({
        alias: initialAlias,
        sourceType,
        externalOfficeName: sourceType === 'external_office' ? externalOfficeName : undefined,
        caseType,
        caseStage,
        courtName,
        caseNumber: caseNumber.trim(),
        monthlyRepaymentAmount: Number(monthlyRepaymentAmount) || 0,
        repaymentDay: Number(repaymentDay) || 10,
        totalRounds: Number(totalRounds) || 36,
        completedRounds: Number(completedRounds) || 0,
        startRepaymentDate,
        courtVirtualAccount: courtVirtualAccount.trim(),
        monthlyIncome: Number(monthlyIncome) || 0,
        essentialLivingCost: Number(essentialLivingCost) || 0,
        otherFixedExpenses: Number(otherFixedExpenses) || 0,
      });

      toast.success('🎉 회생동행 사건이 성공적으로 등록되었습니다!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('사건 등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* 모달 헤더 */}
        <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div>
            <span className="text-[11px] font-bold text-brand bg-brand/10 dark:bg-brand/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              전국 모든 회생·파산인 무료 지원
            </span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
              마이김변 2.0 회생동행 간편 등록
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 스텝 바 */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
          {[
            { num: 1, label: '진행 방식' },
            { num: 2, label: '사건 정보' },
            { num: 3, label: '변제 & 생계' }
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step === s.num ? 'bg-brand text-white shadow-sm' :
                step > s.num ? 'bg-emerald-500 text-white' :
                'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}>
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className={`text-xs font-bold ${step === s.num ? 'text-brand dark:text-brand-light' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {s.num < 3 && <div className="flex-1 h-0.5 bg-slate-100 dark:bg-slate-800 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* 모달 폼 본문 */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          
          {/* STEP 1: 진행 방식 선택 */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  현재 어떤 방식으로 사건을 진행하고 계신가요?
                </h4>
                <p className="text-xs text-slate-500">
                  타 법무법인/법무사 또는 나홀로 전자소송으로 진행 중이셔도 모든 일정을 무료로 관리해 드립니다.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSourceType('external_office')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    sourceType === 'external_office'
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20 dark:bg-brand/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 w-fit">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">타 법률사무소 / 법무사</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">외부 사무소에서 수임 진행 중</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('self_litigant')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    sourceType === 'self_litigant'
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20 dark:bg-brand/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 w-fit">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">나홀로 전자소송</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">본인이 직접 법원에 접수·진행</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSourceType('mykim_lawyer')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    sourceType === 'mykim_lawyer'
                      ? 'border-brand bg-brand/5 ring-2 ring-brand/20 dark:bg-brand/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 w-fit">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">마이김변 전담 변호사</span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block">마이김변 플랫폼 매칭 수임</span>
                  </div>
                </button>
              </div>

              {sourceType === 'external_office' && (
                <div className="space-y-1.5 pt-2 animate-fadeIn">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    진행 중인 법무법인 / 법무사 상호명 (선택)
                  </label>
                  <input
                    type="text"
                    value={externalOfficeName}
                    onChange={(e) => setExternalOfficeName(e.target.value)}
                    placeholder="예: 법무법인 율*, 서초 종합법률사무소 등"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    * 입력하신 상호명은 본인 캘린더 메모용으로만 활용되며 외부에 노출되지 않습니다.
                  </p>
                </div>
              )}

              {/* 사건 구분 */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">사건 유형</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCaseType('individual_rehab')}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      caseType === 'individual_rehab'
                        ? 'bg-brand text-white border-brand shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🌱 개인회생 (3~5년 월 분할변제)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaseType('bankruptcy')}
                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      caseType === 'bankruptcy'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    🕊️ 개인파산·면책 (서류/기일 관리)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 3-Track 사건 연동 및 정보 입력 */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Track 1: 스마트 문서 OCR 파싱 배너 */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-brand/10 via-brand/5 to-indigo-50/50 dark:to-slate-800/50 border border-brand/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-brand text-white shrink-0 mt-0.5 shadow-sm">
                    {isOcrProcessing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-brand/15 text-brand dark:text-brand-light">
                        Track 1: 스마트 OCR
                      </span>
                      {ocrConfidence && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                          인식 신뢰도 {(ocrConfidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white mt-1">
                      결정문·접수증 사진으로 1초 자동 완성
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      인가결정문, 개시결정문 또는 법원 사건접수증을 업로드하시면 사건번호와 일정이 자동 추출됩니다.
                    </p>
                  </div>
                </div>

                <label className="px-4 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer shrink-0 flex items-center gap-2 active:scale-[0.98]">
                  <Upload className="w-4 h-4" />
                  <span>{isOcrProcessing ? '분석 중...' : '문서 사진 올리기'}</span>
                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    className="hidden" 
                    disabled={isOcrProcessing}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleOcrUpload(e.target.files[0]);
                    }} 
                  />
                </label>
              </div>

              {/* OCR 인식 결과: 성공 시 초록색 박스 */}
              {ocrStatus === 'success' && ocrHighlights.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>문서 정밀 분석 완료: 아래 정보가 자동 채워졌습니다</span>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    {ocrHighlights.map((hl, idx) => (
                      <li key={idx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* OCR 인식 결과: 실패/무관문서 시 주황색 경고 배너 */}
              {ocrStatus === 'failed' && (
                <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/70 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>서류 인식 실패: 사건번호를 찾지 못했습니다</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowOcrAlertModal(true)}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>경고 팝업 다시보기</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                    {ocrFailureReason || '업로드된 파일에서 공식 법원 회생·파산 사건번호를 식별하지 못했습니다.'}
                  </p>
                  {ocrFailureHighlights.length > 0 && (
                    <ul className="text-[11px] text-amber-800/90 dark:text-amber-300/90 space-y-1 bg-amber-100/60 dark:bg-amber-900/40 p-2.5 rounded-xl">
                      {ocrFailureHighlights.map((hl, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('case-number-input');
                        if (input) {
                          input.focus();
                          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                    >
                      아래 입력란에서 직접 입력하기 ➔
                    </button>
                  </div>
                </div>
              )}

              {/* Track 2: 대법원 공식 사건검색 딥링크 카드 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      Track 2: 대법원 공식 연계
                    </span>
                    <h5 className="text-xs font-black text-slate-800 dark:text-slate-200">
                      대한민국 법원 실시간 사건조회
                    </h5>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCourtInfo}
                      className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 border border-slate-200 dark:border-slate-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>사건정보 복사</span>
                    </button>
                    <a
                      href={courtDeepLink.mobileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand dark:hover:bg-brand-light text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>대법원 조회 바로가기</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  * 대법원 대국민서비스는 보안상 자동입력방지문자(숫자 6자리)가 적용되어 있습니다. 위 버튼으로 공식 사이트 연결 후 사건번호를 붙여넣어 최신 송달·기일을 확인하세요.
                </p>
              </div>

              {/* 사건 단계 선택 (회생 라이프사이클) */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>🌱 현재 사건 진행 단계</span>
                  <span className="text-[11px] text-slate-400 font-normal">(단계별 맞춤 혜택 추천의 기준이 됩니다)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { key: 'preparing', label: '1. 신청 준비', desc: '서류준비/상담' },
                    { key: 'submitted', label: '2. 접수/보정', desc: '사건번호 부여' },
                    { key: 'started', label: '3. 개시 결정', desc: '집회/변제안' },
                    { key: 'approved', label: '4. 인가/변제', desc: '월납부 수행' },
                    { key: 'completed', label: '5. 완주/면책', desc: '면책결정 확정' },
                  ].map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setCaseStage(st.key as CaseStageType)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        caseStage === st.key
                          ? 'border-brand bg-brand/10 text-brand dark:text-brand-light ring-2 ring-brand/20 font-bold'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-xs font-bold block truncate">{st.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{st.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 관할 법원 및 사건 번호 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">관할 법원</label>
                  <select
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    {COURTS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>사건번호 <span className="text-red-500">*</span></span>
                    {ocrStatus === 'failed' && (
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 animate-pulse">
                        직접 입력 필요
                      </span>
                    )}
                  </label>
                  <input
                    id="case-number-input"
                    type="text"
                    value={caseNumber}
                    onChange={(e) => {
                      setCaseNumber(e.target.value);
                      if (ocrStatus === 'failed' && e.target.value.trim().length > 3) {
                        setOcrStatus('idle');
                      }
                    }}
                    placeholder="예: 2024개회108492"
                    required
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all focus:outline-none ${
                      ocrStatus === 'failed'
                        ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/30 ring-2 ring-amber-400/60 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-1 focus:ring-brand'
                    }`}
                  />
                </div>
              </div>

              {/* 법원 가상계좌 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  법원 변제금 전용 가상계좌 (선택)
                </label>
                <input
                  type="text"
                  value={courtVirtualAccount}
                  onChange={(e) => setCourtVirtualAccount(e.target.value)}
                  placeholder="예: 신한은행 110-***-849201 (서울회생법원)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                />
                <p className="text-[11px] text-slate-400">
                  * 가상계좌를 등록해 두시면 변제일마다 앱에서 바로 계좌번호를 복사해 송금하실 수 있습니다.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800 flex items-start gap-2 text-slate-500">
                <ShieldCheck className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  마이김변은 대법원 시스템을 무단 크롤링하지 않으며, 입력하신 사건정보는 안전하게 보호됩니다.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: 변제 일정 및 생계 밸런서 설정 */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">매월 변제금 (원)</label>
                  <input
                    type="number"
                    value={monthlyRepaymentAmount}
                    onChange={(e) => setMonthlyRepaymentAmount(Number(e.target.value))}
                    step={10000}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                  <span className="text-[11px] text-brand font-bold block">
                    {(monthlyRepaymentAmount || 0).toLocaleString()}원 / 월
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">매월 납부일</label>
                  <select
                    value={repaymentDay}
                    onChange={(e) => setRepaymentDay(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>매월 {day}일</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">총 변제 회차</label>
                  <select
                    value={totalRounds}
                    onChange={(e) => setTotalRounds(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  >
                    <option value={24}>24회 (청년/취약 특례 2년)</option>
                    <option value={36}>36회 (기본 3년)</option>
                    <option value={48}>48회 (4년)</option>
                    <option value={60}>60회 (최대 5년)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">현재까지 납부 완료 회차</label>
                  <input
                    type="number"
                    value={completedRounds}
                    onChange={(e) => setCompletedRounds(Number(e.target.value))}
                    min={0}
                    max={totalRounds}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    진행률: {totalRounds > 0 ? ((completedRounds / totalRounds) * 100).toFixed(1) : 0}%
                  </span>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">변제 시작 년월</label>
                  <input
                    type="month"
                    value={startRepaymentDate}
                    onChange={(e) => setStartRepaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-white focus:ring-1 focus:ring-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* 월 생계 밸런서 설정 */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h5 className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <span>💡 30일 생계 밸런서 기준값 (선택)</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">월 실수령 소득</label>
                    <input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                      step={100000}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">필수 생계비</label>
                    <input
                      type="number"
                      value={essentialLivingCost}
                      onChange={(e) => setEssentialLivingCost(Number(e.target.value))}
                      step={50000}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500 font-medium">기타 고정지출</label>
                    <input
                      type="number"
                      value={otherFixedExpenses}
                      onChange={(e) => setOtherFixedExpenses(Number(e.target.value))}
                      step={10000}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* 모달 하단 액션 버튼 */}
          <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                이전 단계
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as any)}
                className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-md cursor-pointer active:scale-[0.98]"
              >
                다음 단계로 ➔
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Check className="w-4 h-4" />
                <span>회생동행 시작하기</span>
              </button>
            )}
          </div>

        </form>

      </div>

      {/* ═══ 서류 인식 실패 및 다음 프로세스 안내 팝업 모달 ═══ */}
      {showOcrAlertModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700/60 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scaleUp text-left">
            
            {/* 팝업 헤더 */}
            <div className="p-5 border-b border-amber-100 dark:border-amber-900/40 bg-amber-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>법원 서류 인식 실패 경고</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      인식 불가
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    업로드하신 파일에서 회생·파산 공식 사건번호를 확인할 수 없습니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOcrAlertModal(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 팝업 내용 */}
            <div className="p-6 space-y-4">
              {/* AI 판독 결과 박스 */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  🔍 AI 이미지 판독 내용
                </span>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                  {ocrFailureReason || '회생·파산 공식 법원 결정문 또는 접수증이 아닌 이미지입니다.'}
                </p>
                {ocrFailureHighlights.length > 0 && (
                  <ul className="space-y-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    {ocrFailureHighlights.map((hl, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 다음 진행 방법 안내 */}
              <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 space-y-2">
                <span className="text-xs font-black text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  다음 프로세스 진행 방법
                </span>
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  회생동행 서비스를 정상적으로 이용하시려면 아래 2가지 방법 중 하나를 선택해 주세요:
                </p>
                <div className="space-y-2 text-[11px] text-blue-800 dark:text-blue-300">
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">① 직접 입력:</span>
                    <span>사건번호(예: 2024개회108492)만 알고 계시다면 아래 입력란에 직접 입력하시고 바로 사건을 등록할 수 있습니다.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">② 다시 올리기:</span>
                    <span>법원에서 송달받은 <strong>변제계획인가결정문, 개시결정문, 전자소송 사건접수증</strong> 원본을 선명하게 다시 촬영하여 올려주세요.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 팝업 액션 버튼 */}
            <div className="p-5 border-t border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <label className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]">
                <Upload className="w-4 h-4" />
                <span>다른 서류 사진 다시 올리기</span>
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  className="hidden" 
                  onChange={(e) => {
                    setShowOcrAlertModal(false);
                    if (e.target.files?.[0]) handleOcrUpload(e.target.files[0]);
                  }} 
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setShowOcrAlertModal(false);
                  setStep(2);
                  setTimeout(() => {
                    const input = document.getElementById('case-number-input');
                    if (input) {
                      input.focus();
                      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }, 120);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                <span>사건번호 직접 입력하기</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
