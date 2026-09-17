import React, { useState, useMemo } from 'react';
import { 
  X, Download, CheckCircle2, ChevronRight, ChevronDown, 
  Upload, Camera, ExternalLink, ShieldCheck, AlertCircle, 
  FileText, Clock, HelpCircle, ArrowLeft, RefreshCw,
  Mail, Copy, Check, Sparkles, Send, Stamp, Truck
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ApplicationDocTemplateService, 
  type ApplicationDocMasterItem,
  type DocPhase 
} from '../../services/documents/applicationDocTemplateService';
import { CARRIER_LIST } from '../../utils/carrierTracking';
const ClientPropertyIntakeModal = React.lazy(() => import('./property/ClientPropertyIntakeModal'));

interface MobileApplicationDocHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  clientRequest?: any;
  uploadedFiles?: any[];
  onUploadFile?: (docName: string, file: File) => void;
}

export default function MobileApplicationDocHubModal({
  isOpen,
  onClose,
  clientName = '김가람',
  clientRequest,
  uploadedFiles = [],
  onUploadFile
}: MobileApplicationDocHubModalProps) {
  if (!isOpen) return null;

  // 의뢰인 맞춤 권장 서류 목록 로드 (22종 등)
  const docList = useMemo(() => {
    return ApplicationDocTemplateService.getRecommendedDocsForClient(clientRequest);
  }, [clientRequest]);

  // 채권자 수 및 인감증명서 필요 부수 계산
  const creditorCount = clientRequest?.creditorCount || 5;
  const sealCertCount = ApplicationDocTemplateService.getRequiredSealCertCount(creditorCount);

  // 로컬 제출 상태 (시뮬레이션 및 업로드 추적)
  const [submittedDocIds, setSubmittedDocIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    // 이미 업로드된 파일이 있으면 매핑
    docList.forEach(doc => {
      const match = uploadedFiles.some(f => f.name?.includes(doc.name.slice(0, 4)));
      if (match) set.add(doc.id);
    });
    return set;
  });

  // 1차 / 2차 탭 상태
  const phase1Docs = useMemo(() => docList.filter(d => (d.phase || 1) === 1), [docList]);
  const phase2Docs = useMemo(() => docList.filter(d => (d.phase || 1) === 2), [docList]);
  
  const phase1DoneCount = useMemo(() => phase1Docs.filter(d => submittedDocIds.has(d.id)).length, [phase1Docs, submittedDocIds]);
  const isPhase1FullyDone = phase1DoneCount === phase1Docs.length && phase1Docs.length > 0;

  const [activePhase, setActivePhase] = useState<DocPhase>(isPhase1FullyDone ? 2 : 1);

  // 주소 복사 완료 상태
  const [copiedAddress, setCopiedAddress] = useState(false);
  // 1차 등기 발송 통보 완료 여부
  const [isMailDispatched, setIsMailDispatched] = useState(false);
  // 배송사 및 등기/운송장 번호 (선택)
  const [selectedCarrier, setSelectedCarrier] = useState<string>('EPOST');
  const [inputTrackingNo, setInputTrackingNo] = useState<string>('');

  // 펼쳐진 아코디언 항목 ID
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  // 재산상황표(D5102) 모달 상태
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  const currentDocs = activePhase === 1 ? phase1Docs : phase2Docs;
  const completedCount = currentDocs.filter(d => submittedDocIds.has(d.id)).length;
  const totalCount = currentDocs.length;
  const progressPercent = Math.round((completedCount / (totalCount || 1)) * 100);

  const lawOfficeAddress = '서울시 서초구 서초대로 254 오퓨런스빌딩 12층 법무법인 회생파산 전담팀 (우: 06596)';

  // 모바일 발급안내문 PDF 다운로드 (리걸플로 그림 2-11 상단 버튼)
  const handleDownloadGuidePdf = () => {
    toast.success(`[${clientName} 님 맞춤 신청서류 ${activePhase}차 종합 발급안내문 PDF]가 다운로드되었습니다.`);
  };

  const handleCopyAddress = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(lawOfficeAddress);
      setCopiedAddress(true);
      toast.success('로펌 등기 수령 주소가 복사되었습니다.');
      setTimeout(() => setCopiedAddress(false), 2500);
    }
  };

  const handleNotifyDispatch = () => {
    setIsMailDispatched(true);
    // 1차 서류 일괄 제출 마킹 (시뮬레이션)
    setSubmittedDocIds(prev => {
      const next = new Set(prev);
      phase1Docs.forEach(d => next.add(d.id));
      return next;
    });

    const carrierObj = CARRIER_LIST.find(c => c.code === selectedCarrier);
    const carrierName = carrierObj ? carrierObj.name : '우체국 빠른등기';
    const trackingMsg = inputTrackingNo.trim() ? ` (송장: ${inputTrackingNo.trim()})` : '';

    toast.success(`[${carrierName}] 발송이 사무소에 통보되었습니다!${trackingMsg} 실물 도착 즉시 부채증명서 발급에 착수합니다.`, {
      duration: 4500
    });
  };

  // 파일 선택 및 업로드 처리
  const handleFileChange = (doc: ApplicationDocMasterItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onUploadFile) {
      onUploadFile(doc.name, file);
    }

    setSubmittedDocIds(prev => {
      const next = new Set(prev);
      next.add(doc.id);
      return next;
    });

    toast.success(`'${doc.name}' 서류가 안전하게 제출되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* 모바일 화면 컨테이너 (최대 480px) */}
      <div className="bg-slate-50 w-full sm:max-w-md h-full sm:h-[90vh] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* 모바일 상단 네비게이션 & 헤더 */}
        <div className="bg-linear-to-br from-slate-900 via-slate-800 to-brand text-white p-5 shrink-0 shadow-md relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Legal Flow Mobile</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-emerald-300">
                2-Step 준비 시스템
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-white">
                {clientName} 님의 신청서류
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                {activePhase === 1 ? '1차 빠른등기 실물 서류 제출' : '2차 소득·재산 간편제출 서류'}
              </p>
            </div>

            {/* 발급현황 카운터 뱃지 */}
            <div className="text-center bg-white/15 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 shadow-inner">
              <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                {activePhase}차 현황
              </div>
              <div className="text-lg font-black text-white">
                <span className="text-emerald-400">{completedCount}</span>
                <span className="text-slate-400 font-medium">/{totalCount}</span>
              </div>
            </div>
          </div>

          {/* 진행률 바 */}
          <div className="mt-4">
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1.5 font-bold">
              <span>{activePhase}차 완료율 {progressPercent}%</span>
              <span>{completedCount === totalCount ? '🎉 완료됨' : `${totalCount - completedCount}개 대기`}</span>
            </div>
          </div>

          {/* 1차 / 2차 탭 스위처 */}
          <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-black/25 rounded-2xl border border-white/10">
            <button
              onClick={() => setActivePhase(1)}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activePhase === 1 
                  ? 'bg-white text-slate-900 shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>📮 1차 서류</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activePhase === 1 ? 'bg-brand/10 text-brand' : 'bg-white/20 text-white'
              }`}>
                {phase1DoneCount}/{phase1Docs.length}
              </span>
            </button>

            <button
              onClick={() => setActivePhase(2)}
              className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activePhase === 2 
                  ? 'bg-white text-slate-900 shadow-md' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>📋 2차 서류</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activePhase === 2 ? 'bg-brand/10 text-brand' : 'bg-white/20 text-white'
              }`}>
                {phase2Docs.filter(d => submittedDocIds.has(d.id)).length}/{phase2Docs.length}
              </span>
            </button>
          </div>
        </div>

        {/* 상단 서브 액션: 안내문 PDF 다운로드 */}
        <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-600 font-bold">
            {activePhase === 1 ? '우체국 등기 발송 안내 가이드' : '소득·재산 모바일 발급 가이드'}
          </span>
          <button
            onClick={handleDownloadGuidePdf}
            className="px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>안내문 PDF</span>
          </button>
        </div>

        {/* 1차 탭 전용: 인감증명서 부수 계산 & 등기 주소 카드 */}
        {activePhase === 1 && (
          <div className="mx-4 mt-3 space-y-2.5 shrink-0">
            {/* 인감증명서 필요부수 & 인감도장 동봉 안내 배너 */}
            <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs">
              <div className="flex items-center justify-between font-black text-amber-950 mb-1">
                <span className="flex items-center gap-1.5">
                  <Stamp className="w-4 h-4 text-amber-600" />
                  <span>인감도장 & 인감증명서 필수 안내</span>
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                  채권사 {creditorCount}곳 기준
                </span>
              </div>
              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                금융기관 부채증명서 대리 발급을 위해 <strong>인감도장 실물</strong>과 <strong>인감증명서 총 {sealCertCount}부</strong>(채권사 {creditorCount}곳 + 예비 5부, 용도 미기재)가 반드시 필요합니다.
              </p>
              <div className="mt-2 text-[10px] text-amber-800 bg-white/70 p-2 rounded-xl border border-amber-200">
                🔒 <strong>안전 보장:</strong> 인감도장은 금융사 위임장 날인 직후 안전하게 보관되며, 부채증명서 발급 완료 시 원형 그대로 반환됩니다.
              </div>
            </div>

            {/* 로펌 우편등기 수령 주소 카드 */}
            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black flex items-center gap-1.5 text-slate-200">
                  <Mail className="w-3.5 h-3.5 text-brand-light" />
                  <span>우체국 빠른등기 보낼 주소</span>
                </span>
                <button
                  onClick={handleCopyAddress}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  {copiedAddress ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedAddress ? '복사완료' : '주소복사'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-300 font-mono select-all bg-black/30 p-2 rounded-xl border border-white/5 break-keep">
                {lawOfficeAddress}
              </p>

              {/* 배송사 선택 및 송장번호 입력 (선택 보조 옵션) */}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Truck className="w-3 h-3 text-slate-400" />
                    <span>발송 방법 & 송장번호 (선택사항)</span>
                  </span>
                  <span className="text-[9px] text-slate-500 font-normal">미입력 시에도 발송통보 가능</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  <select
                    value={selectedCarrier}
                    onChange={(e) => setSelectedCarrier(e.target.value)}
                    disabled={isMailDispatched}
                    className="col-span-2 text-[11px] bg-white/10 text-white rounded-lg px-2 py-1.5 border border-white/15 focus:outline-none focus:ring-1 focus:ring-brand font-medium truncate"
                  >
                    {CARRIER_LIST.map((c) => (
                      <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={inputTrackingNo}
                    onChange={(e) => setInputTrackingNo(e.target.value)}
                    placeholder="등기/운송장 번호 (선택)"
                    disabled={isMailDispatched}
                    className="col-span-3 text-[11px] bg-white/10 text-white rounded-lg px-2.5 py-1.5 border border-white/15 focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-slate-500 font-mono"
                  />
                </div>
              </div>

              {/* 빠른등기/택배 발송 통보 버튼 */}
              <button
                type="button"
                onClick={handleNotifyDispatch}
                disabled={isMailDispatched}
                className={`w-full py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isMailDispatched
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-brand hover:bg-brand-dark text-white press-scale shadow-xs'
                }`}
              >
                {isMailDispatched ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>발송 통보 완료 (사무소 수령 대기중)</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>실물 서류 발송 완료 통보</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 2차 탭 전용: 소득·재산 서류 발급 안내 배너 */}
        {activePhase === 2 && (
          <div className="mx-4 mt-3 space-y-2 shrink-0">
            <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-xs space-y-1">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>부채증명서 발급(약 7일) 기간 동안 준비</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                1차 서류를 통해 부채증명서가 발급되는 동안, 아래 2차 서류(소득·재산)를 간편하게 제출해 주세요. (온라인 업로드 또는 우편등기 가능)
              </p>
            </div>

            {/* 재산상황표 간편 작성 배너 */}
            <button
              type="button"
              onClick={() => setIsPropertyModalOpen(true)}
              className="w-full py-2.5 px-3 bg-linear-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black text-xs rounded-2xl flex items-center justify-between shadow-xs cursor-pointer press-scale transition-all"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-200" />
                <span>📋 재산상황표(D5102) 온라인 간편 작성하기</span>
              </div>
              <ChevronRight className="w-4 h-4 text-indigo-200" />
            </button>
          </div>
        )}

        {/* ⚠️ 제3자 주민번호 마스킹 준칙 배너 */}
        <div className="mx-4 mt-2.5 p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 text-xs flex items-start gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-slate-600">
            <strong>법원 개인정보보호:</strong> 가족관계·등본 발급 시 <u>본인 외 가족의 주민번호 뒷자리는 마스킹(******)</u> 처리해 주세요.
          </p>
        </div>

        {/* 서류 목록 리스트 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {currentDocs.map((doc) => {
            const isCompleted = submittedDocIds.has(doc.id);
            const isExpanded = expandedDocId === doc.id;

            return (
              <div 
                key={doc.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs ${
                  isCompleted 
                    ? 'border-emerald-200 bg-emerald-50/20' 
                    : isExpanded 
                    ? 'border-brand/40 ring-2 ring-brand/10' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* 리스트 행 헤더 */}
                <button
                  onClick={() => setExpandedDocId(isExpanded ? null : doc.id)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isCompleted 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : doc.order}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-black truncate ${isCompleted ? 'text-slate-700 line-through opacity-70' : 'text-slate-900'}`}>
                          {doc.name}
                        </span>
                        {doc.isRequired && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                            필수
                          </span>
                        )}
                        {doc.submissionMethod === 'POST_MAIL' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            우편등기
                          </span>
                        )}
                        {doc.isThirdPartyMasking && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            마스킹
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {doc.agency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isCompleted ? (
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{doc.submissionMethod === 'POST_MAIL' ? '동봉완료' : '제출완료'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {doc.submissionMethod === 'POST_MAIL' ? '동봉대기' : '미제출'}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* 클릭 시 펼쳐지는 상세 발급 가이드 & 업로드 드로어 */}
                {isExpanded && (
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                    {/* 발급 팁 */}
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-600 text-xs leading-relaxed space-y-1">
                      <div className="font-bold text-slate-800 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-brand" />
                        <span>발급 팁 및 주의사항</span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-4.5">
                        {doc.tips}
                      </p>
                    </div>

                    {/* 발급처 바로가기 링크 */}
                    {doc.agencyUrl && (
                      <a
                        href={doc.agencyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-blue-600 font-bold text-xs rounded-xl border border-blue-200 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>{doc.agency} 온라인 발급 사이트 열기</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {/* 1차 등기 서류인 경우 실물 동봉 체크 버튼 제공 */}
                    {doc.submissionMethod === 'POST_MAIL' ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSubmittedDocIds(prev => {
                              const next = new Set(prev);
                              if (next.has(doc.id)) {
                                next.delete(doc.id);
                                toast.info(`'${doc.name}' 동봉 체크를 해제했습니다.`);
                              } else {
                                next.add(doc.id);
                                toast.success(`'${doc.name}' 봉투 동봉이 확인되었습니다.`);
                              }
                              return next;
                            });
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-slate-900 hover:bg-black text-white shadow-xs'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isCompleted ? '등기 봉투 동봉 완료됨 (클릭 시 취소)' : '서류 발급 후 봉투에 넣었습니다 (동봉 확인)'}</span>
                        </button>

                        <div className="text-[10px] text-slate-400 text-center">
                          사전 확인용 사진 촬영이 필요하시면 아래 버튼으로 업로드도 가능합니다.
                        </div>
                      </div>
                    ) : null}

                    {/* 파일 첨부 / 카메라 촬영 버튼 */}
                    <div className="flex items-center gap-2">
                      <label className="flex-1 py-2.5 px-3 bg-brand hover:bg-brand-dark text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs cursor-pointer press-scale transition-all">
                        <Camera className="w-4 h-4" />
                        <span>카메라 촬영 / 파일 첨부</span>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={e => handleFileChange(doc, e)}
                        />
                      </label>

                      {isCompleted && (
                        <button
                          onClick={() => {
                            setSubmittedDocIds(prev => {
                              const next = new Set(prev);
                              next.delete(doc.id);
                              return next;
                            });
                            toast.info(`'${doc.name}' 제출 상태가 초기화되었습니다.`);
                          }}
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                          title="제출 취소"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 푸터 안내 */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0 text-center space-y-1">
          <p className="text-[11px] text-slate-500 font-medium">
            {activePhase === 1 
              ? '1차 빠른등기가 사무소에 도착하면 즉시 부채증명서 발급 절차가 진행됩니다.' 
              : '2차 소득·재산 서류 취합이 완료되면 담당 변호사가 법원 전자소송을 접수합니다.'}
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            서류 발급 관련 문의: 1544-0000 (법무법인 회생전담팀)
          </p>
        </div>

      </div>

      {/* 📋 법원 제출용 재산상황표(D5102) 기초자료 작성 모달 */}
      {isPropertyModalOpen && (
        <React.Suspense fallback={null}>
          <ClientPropertyIntakeModal
            isOpen={isPropertyModalOpen}
            onClose={() => setIsPropertyModalOpen(false)}
            clientId={clientRequest?.id || 'client-mobile'}
            clientName={clientName}
          />
        </React.Suspense>
      )}
    </div>
  );
}
