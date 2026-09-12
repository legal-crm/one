import React, { useState, useMemo } from 'react';
import { 
  X, Download, CheckCircle2, ChevronRight, ChevronDown, 
  Upload, Camera, ExternalLink, ShieldCheck, AlertCircle, 
  FileText, Clock, HelpCircle, ArrowLeft, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  ApplicationDocTemplateService, 
  type ApplicationDocMasterItem 
} from '../../services/documents/applicationDocTemplateService';
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

  // 펼쳐진 아코디언 항목 ID
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  // 재산상황표(D5102) 모달 상태
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);

  const completedCount = submittedDocIds.size;
  const totalCount = docList.length;
  const progressPercent = Math.round((completedCount / (totalCount || 1)) * 100);

  // 모바일 발급안내문 PDF 다운로드 (리걸플로 그림 2-11 상단 버튼)
  const handleDownloadGuidePdf = () => {
    toast.success(`[${clientName} 님 맞춤 신청서류 22종 종합 발급안내문 PDF]가 다운로드되었습니다.`);
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
        
        {/* 모바일 상단 네비게이션 & 헤더 (리걸플로 그림 2-11 벤치마킹) */}
        <div className="bg-linear-to-br from-slate-900 via-slate-800 to-brand text-white p-5 shrink-0 shadow-md relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Legal Flow Mobile</span>
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
                법원 전자소송 접수용 구비서류 원스톱 발급함
              </p>
            </div>

            {/* 발급현황 카운터 뱃지 (그림 2-11) */}
            <div className="text-center bg-white/15 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/20 shadow-inner">
              <div className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">발급현황</div>
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
              <span>준비 진행률 {progressPercent}%</span>
              <span>{completedCount === totalCount ? '🎉 모든 서류 구비 완료' : `${totalCount - completedCount}개 서류 대기중`}</span>
            </div>
          </div>
        </div>

        {/* 상단 서브 액션: 발급안내문 PDF 다운로드 (그림 2-11) */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-slate-600 font-bold">
            인쇄용 발급 안내 가이드
          </span>
          <button
            onClick={handleDownloadGuidePdf}
            className="px-3 py-1.5 bg-brand/10 hover:bg-brand/20 text-brand font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer press-scale shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>발급안내문 PDF 다운로드</span>
          </button>
        </div>

        {/* ⚠️ 제3자 주민번호 마스킹 준칙 배너 */}
        <div className="mx-4 mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 text-xs flex items-start gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            <strong>법원 개인정보보호 지침:</strong> 가족관계·혼인관계·등본 발급 시 <u>신청인 본인을 제외한 가족의 주민번호 뒷자리는 반드시 마스킹(******)</u> 처리해 주세요.
          </p>
        </div>

        {/* 서류 목록 리스트 (리걸플로 그림 2-11) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {docList.map((doc) => {
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
                        <span>제출완료</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        미제출
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

                    {/* 📋 재산목록 관련 서류일 때 온라인 간편 작성 버튼 */}
                    {(doc.name.includes('재산') || doc.id.includes('property') || doc.name.includes('D5102') || doc.name.includes('계좌') || doc.name.includes('보험')) && (
                      <button
                        type="button"
                        onClick={() => setIsPropertyModalOpen(true)}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer press-scale shadow-xs"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>📋 재산상황표(D5102) 온라인 간편 작성하기</span>
                      </button>
                    )}

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
            모든 서류가 제출되면 담당 변호사가 확인 후 법원 전자소송을 접수합니다.
          </p>
          <p className="text-[10px] text-slate-400 font-mono">
            서류 발급 관련 문의: 1544-0000 (법무법인 담당팀)
          </p>
        </div>

      </div>

      {/* 📋 법원 제출용 재산상황표(D5102) 기초자료 작성 모달 (리걸플로 7-4 벤치마킹) */}
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
