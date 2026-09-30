import { AlertTriangle, Calculator, Camera, CheckCircle2, ChevronRight, CreditCard, FileText, Home, Info, MessageSquare, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DOC_REVIEW_STATUS_CONFIG } from '../../../types';
import type { DocumentFile } from '../../../types';
import MobileScanner from '../../lawyer/MobileScanner';
import { submitClientDocument } from '../../../services/crmService';
import type { MyPageModel } from './useMyPageModel';
import type { MyCaseData } from './myCaseData';

/**
 * 내 사건 탭: 서류 제출(요청 서류·필수 서류·작성 도구·자율 업로드) (MyPageView에서 분리)
 */
export default function DocumentSubmissionCard({ vm, cd }: { vm: MyPageModel; cd: MyCaseData }) {
  const {
    activeRequest, docPhaseTab, setDocPhaseTab, setIsBankAuditModalOpen, setIsFastDocHubOpen,
    setIsIncomeExpenseModalOpen, setIsPropertyIntakeModalOpen, setIsStatementModalOpen, setRefreshTick,
    setShowScanner, showScanner, userAlias,
  } = vm;
  const { checklist, docRequests, handleFileUpload, reqId, submittedCount, uploadedFiles } = cd;
  return (
    <>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">

        {/* 법원 제출 서류 발급기한 안내 (보정 요청 가능성은 단정하지 않는다) */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-amber-900 break-keep">
            <strong className="font-bold">발급일 확인:</strong> 주민센터·세무서·공단 등에서 떼는 서류는 보통 <strong>신청일 기준 최근 2개월 이내</strong> 발급본을 냅니다. 기한이 지난 서류는 법원에서 보정 요청을 받을 수 있어요.
          </p>
        </div>

        {/* 변호사가 요청한 서류 — 할 일 우선: 아직 내지 않은 요청이 먼저 */}
        {docRequests.length > 0 && (
          <section aria-labelledby="doc-requests-title" className="space-y-3">
            <h4 id="doc-requests-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>
              변호사가 요청한 서류
              {docRequests.some(r => !r.fulfilled) && (
                <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">{docRequests.filter(r => !r.fulfilled).length}건 제출 필요</span>
              )}
            </h4>
            <ul className="space-y-2.5">
              {[...docRequests].sort((x, y) => Number(!!x.fulfilled) - Number(!!y.fulfilled)).map(req => (
                <li key={req.id} className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${req.fulfilled ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">{req.documentLabel}</p>
                    {req.description && <p className="text-xs text-slate-600 mt-0.5 break-keep">{req.description}</p>}
                    {req.requestedBy && <p className="text-xs text-slate-500 mt-1">요청: {req.requestedBy}{req.requestedAt ? ` · ${new Date(req.requestedAt).toLocaleDateString('ko-KR')}` : ''}</p>}
                  </div>
                  {!req.fulfilled ? (
                    <label className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-hover transition-colors cursor-pointer shrink-0 whitespace-nowrap focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      제출하기
                      <input type="file" className="sr-only" accept="image/*,.pdf" multiple onChange={(e) => handleFileUpload(e.target.files, req.linkedDocId || req.id)} />
                    </label>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      제출 완료
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 서류함 헤더 및 1차/2차 단계 필터 탭 */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-950/40"><FileText className="w-5 h-5" /></div>
              관공서 필수 서류 발급 제출
            </h3>
            {/* 요청받은 서류가 없으면 임의 총수(15)를 보여주지 않는다 */}
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              {checklist.length > 0
                ? `${submittedCount} / ${checklist.length} 제출 완료 (${Math.round((submittedCount / checklist.length) * 100)}%)`
                : '요청받은 서류 없음'}
            </span>
          </div>

          {/* 1차 착수 등기 서류 vs 2차 소득·재산 서류 단계 탭 */}
          {(() => {
            const phase1Count = checklist.filter(d => d.phase === 1).length;
            const phase2Count = checklist.filter(d => d.phase === 2 || !d.phase).length;

            return (
              <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="서류 단계">
                <button
                  type="button"
                  aria-pressed={docPhaseTab === 'all'}
                  onClick={() => setDocPhaseTab('all')}
                  className={`min-h-11 px-3.5 rounded-xl text-sm font-bold transition-colors border whitespace-nowrap ${
                    docPhaseTab === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  전체 ({checklist.length})
                </button>
                <button
                  type="button"
                  aria-pressed={docPhaseTab === 'phase1'}
                  onClick={() => setDocPhaseTab('phase1')}
                  className={`min-h-11 px-3.5 rounded-xl text-sm font-bold transition-colors border whitespace-nowrap ${
                    docPhaseTab === 'phase1'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  1차 착수 서류 ({phase1Count})
                </button>
                <button
                  type="button"
                  aria-pressed={docPhaseTab === 'phase2'}
                  onClick={() => setDocPhaseTab('phase2')}
                  className={`min-h-11 px-3.5 rounded-xl text-sm font-bold transition-colors border whitespace-nowrap ${
                    docPhaseTab === 'phase2'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  2차 소득·재산 서류 ({phase2Count})
                </button>
              </div>
            );
          })()}

          {/* Progress bar */}
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${checklist.length > 0 ? (submittedCount / checklist.length) * 100 : 0}%` }} 
            />
          </div>
        </div>

        {/* 필수 서류 목록 (1차/2차 필터 적용 및 수지표 원클릭 작성 연동) */}
        {(() => {
          // 할 일 우선 정렬: 반려 → 미제출 → 제출(확인 대기) → 확인 완료
          const DOC_ORDER: Record<string, number> = { rejected: 0, not_submitted: 1, submitted: 2 };
          const filteredList = checklist.filter(item => {
            if (docPhaseTab === 'phase1') return item.phase === 1;
            if (docPhaseTab === 'phase2') return item.phase === 2 || !item.phase;
            return true;
          }).sort((x, y) => (DOC_ORDER[x.reviewStatus || 'not_submitted'] ?? 3) - (DOC_ORDER[y.reviewStatus || 'not_submitted'] ?? 3));

          return (
            <div className="space-y-3">
              {filteredList.map(item => {
                const status = item.reviewStatus || 'not_submitted';
                const config = DOC_REVIEW_STATUS_CONFIG[status] || DOC_REVIEW_STATUS_CONFIG.not_submitted;
                const isIncomeExpenseDoc = item.linkedFormCode === 'D5103' || item.label.includes('수지표') || item.label.includes('수입지출');

                return (
                  <div key={item.id} className={`flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border ${status === 'rejected' ? 'border-red-200 bg-red-50/50' : status === 'not_submitted' ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.label}</span>

                        {item.phase === 1 ? (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                            1차 착수
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            2차 소득재산
                          </span>
                        )}

                        {item.validityNote && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            {item.validityNote}
                          </span>
                        )}

                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${config.bgColor} ${config.color} ${config.borderColor}`}>
                          {config.label}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {item.description}
                        </p>
                      )}

                      {status === 'rejected' && (
                        <div className="mt-2 rounded-xl bg-white border border-red-200 px-3 py-2.5 text-xs leading-relaxed">
                          <p className="font-bold text-red-800">다시 제출해 주세요</p>
                          <p className="text-red-900 break-keep">{item.rejectionReason ? `반려 사유: ${item.rejectionReason}` : '담당 사무소가 사유를 적지 않았어요. 상담방에서 무엇을 고치면 되는지 물어보세요.'}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* 수지표 항목인 경우 원클릭 간편 작성 버튼 추가 */}
                      {isIncomeExpenseDoc && (
                        <button
                          type="button"
                          onClick={() => setIsIncomeExpenseModalOpen(true)}
                          className="flex items-center gap-1.5 min-h-11 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                          <span>수지표 간편작성</span>
                        </button>
                      )}

                      {['not_submitted', 'rejected'].includes(status) && (
                        <label className="flex items-center gap-1.5 min-h-11 px-3.5 bg-white border border-slate-300 hover:border-brand rounded-xl text-sm font-bold text-slate-700 hover:text-brand transition-colors cursor-pointer whitespace-nowrap focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
                          <Upload className="w-3.5 h-3.5" />
                          업로드
                          <input type="file" className="sr-only" accept="image/*,.pdf" multiple onChange={(e) => handleFileUpload(e.target.files, item.id)} />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* 서류 작성 도구 (다크 배너 5개 → 타일) */}
        <section aria-labelledby="doc-tools-title" className="space-y-3">
          <h4 id="doc-tools-title" className="text-sm font-bold text-slate-900">서류 작성 도구</h4>
          <p className="text-xs text-slate-600 break-keep">다른 사무소에서 진행 중이어도 쓸 수 있어요. 작성한 내용은 확인한 뒤 담당 변호사에게 보냅니다.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              { key: 'hub', title: '서류 초안 만들기', body: '진술서·수지표를 질문에 답하며 초안으로 만들고 담당 변호사에게 보내요.', icon: Sparkles, onClick: () => setIsFastDocHubOpen(true) },
              { key: 'statement', title: '진술서 작성', body: '채무가 생긴 경위와 지금 사정을 말로 답하면 초안을 정리해요.', icon: MessageSquare, onClick: () => setIsStatementModalOpen(true) },
              { key: 'property', title: '재산상황표(D5102)', body: '예금·자동차·임차보증금 같은 재산 정보를 정리해요.', icon: Home, onClick: () => setIsPropertyIntakeModalOpen(true) },
              { key: 'income', title: '수지표(D5103)', body: '월평균 수입과 지출로 12개월 수지표 초안을 만들어요.', icon: Calculator, onClick: () => setIsIncomeExpenseModalOpen(true) },
              { key: 'audit', title: '100만 원 이상 사용처 소명표', body: '큰 금액 출금의 사용처를 생활비·월세 같은 항목으로 정리해요.', icon: CreditCard, onClick: () => setIsBankAuditModalOpen(true) },
            ] as const).map(tool => (
              <button
                key={tool.key}
                type="button"
                onClick={tool.onClick}
                className="group text-left rounded-2xl border border-slate-200 bg-white p-4 min-h-11 flex items-start gap-3 hover:border-brand/40 hover:bg-brand-light/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                  <tool.icon className="w-5 h-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-bold text-slate-900">{tool.title}<ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand" aria-hidden="true" /></span>
                  <span className="mt-0.5 block text-xs text-slate-600 leading-relaxed break-keep">{tool.body}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 자율 업로드 영역 */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">기타 서류 제출</h4>
          <div className="grid grid-cols-2 gap-3">
            {/* 파일 입력은 sr-only로 두어 키보드 초점을 받는다 (이전: hidden이라 키보드로 열 수 없었음) */}
            <label className="flex min-h-12 items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-300 rounded-2xl hover:border-brand hover:bg-brand/5 transition-colors cursor-pointer group active:scale-[0.98] focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
              <Upload className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-700 group-hover:text-brand">파일 선택</span>
              <input
                type="file"
                className="sr-only"
                accept="image/*,.pdf,.doc,.docx"
                multiple
                onChange={(e) => {
                  handleFileUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex min-h-12 items-center justify-center gap-2 py-4 border-2 border-dashed border-slate-300 rounded-2xl hover:border-brand hover:bg-brand/5 transition-colors cursor-pointer group active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              <Camera className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-700 group-hover:text-brand">서류 스캔</span>
            </button>
          </div>
          {uploadedFiles.length > 0 && (
            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
              {uploadedFiles.filter(f => !f.linkedDocId).map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <FileText className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{f.name}</p>
                    <p className="text-xs text-slate-500">{new Date(f.uploadedAt).toLocaleDateString('ko')}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 shrink-0">제출됨</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 이전: '암호화되어 안전하게 보호됩니다'(확인되지 않은 보장 문구) → 사실만 안내 */}
        <p className="text-xs text-slate-600 flex items-start gap-1.5 mt-2">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
          <span>제출한 서류는 담당 변호사 사무소가 확인해요.</span>
        </p>

        {/* MobileScanner 모달 */}
        <MobileScanner
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          clientName={userAlias || activeRequest?.name || '신청인'}
          requestId={reqId}
          onCapture={async (scanned) => {
            const docFile: DocumentFile = {
              id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: scanned.name,
              category: 'other',
              uploadedAt: new Date().toISOString(),
              uploadedBy: '의뢰인',
              fileSize: scanned.fileSize,
              mimeType: scanned.mimeType,
              dataUrl: scanned.dataUrl,
              uploadSource: 'client',
              reviewStatus: 'submitted',
            };
            try {
              await submitClientDocument(reqId!, docFile);
              toast.success(`${scanned.name} 스캔본을 제출했습니다.`);
            } catch {
              toast.error('스캔본을 서버에 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            }
            setRefreshTick(t => t + 1);
          }}
        />
      </div>
    </>
  );
}
