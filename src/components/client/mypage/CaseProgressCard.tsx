import { AlertTriangle, Check, CheckCircle, Copy, FileCheck, FileText, Landmark, Scale, ShieldCheck, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui';
import { CRM_STATUS_CONFIG, LEGALFLOW_BANKRUPTCY_STAGES, LEGALFLOW_REHAB_STAGES } from '../../../types';
import { updateCrmClientExtension } from '../../../services/crmService';
import type { MyPageModel } from './useMyPageModel';
import type { MyCaseData } from './myCaseData';

/**
 * 내 사건 탭: 사건 진행 단계와 단계별 안내 카드(금지명령·보정·채권자집회·면책 신청) (MyPageView에서 분리)
 */
export default function CaseProgressCard({ vm, cd }: { vm: MyPageModel; cd: MyCaseData }) {
  const {
    activeRequest, allProposals, clientContract, isCorrectionUploadOpen, setDischargeRequestedLocal,
    setIsCorrectionUploadOpen, setIsCreditorMeetingModalOpen, setRefreshTick,
  } = vm;
  const { PROGRESS_STEPS, crmExt, currentIdx, currentStatus, handleFileUpload, isDischargeRequested, reqId } = cd;
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
        {(() => {
          const thirteenStage = crmExt?.thirteenStage;
          const isBk = activeRequest?.caseType === 'bankruptcy' || activeRequest?.category === 'individual_bankruptcy';
          const thirteenStages = isBk ? LEGALFLOW_BANKRUPTCY_STAGES : LEGALFLOW_REHAB_STAGES;
          const currentThirteenIdx = thirteenStage ? thirteenStages.findIndex(s => s.id === thirteenStage) : -1;
          const currentThirteenConfig = currentThirteenIdx >= 0 ? thirteenStages[currentThirteenIdx] : null;

          return (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="font-bold text-base text-slate-900 flex flex-wrap items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand" aria-hidden="true"><CheckCircle className="w-5 h-5" /></span>
                  내 사건 진행상황
                  {currentThirteenConfig && (
                    <Badge tone="info">
                      {currentThirteenIdx + 1}/13단계: {currentThirteenConfig.label}
                    </Badge>
                  )}
                </h3>
                <Badge tone="brand" className="self-start sm:self-auto">
                  {CRM_STATUS_CONFIG[currentStatus]?.label}
                </Badge>
              </div>

              {/* 프로그레스 바 (13단계 정밀 진행 바) */}
              <div className="relative pt-2 pb-1">
                <div className="absolute top-7 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 z-0" />
                <div 
                  className="absolute top-7 left-6 h-0.5 bg-brand z-0 transition-all duration-700" 
                  style={{ 
                    width: currentThirteenIdx >= 0 
                      ? `${(currentThirteenIdx / (thirteenStages.length - 1)) * 90}%` 
                      : `${currentIdx >= 0 ? (currentIdx / (PROGRESS_STEPS.length - 1)) * 90 : 0}%` 
                  }} 
                />

                {/* 단계 노드 (주요 마일스톤) — 이모지 대신 번호·완료 표시, 깜빡임 없음 */}
                <ol className="relative z-10 flex justify-between overflow-x-auto no-scrollbar py-1" aria-label="사건 진행 단계">
                  {PROGRESS_STEPS.map((step, i) => {
                    const cfg = CRM_STATUS_CONFIG[step];
                    const isDone = i <= currentIdx;
                    const isCurrent = i === currentIdx;
                    return (
                      <li
                        key={step}
                        aria-current={isCurrent ? 'step' : undefined}
                        className="flex flex-col items-center shrink-0 min-w-[60px]"
                        style={{ width: `${100 / PROGRESS_STEPS.length}%` }}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors duration-500 ${
                          isCurrent ? 'bg-brand border-brand text-white shadow-md shadow-brand/30' :
                          isDone ? 'bg-brand/10 border-brand text-brand' :
                          'bg-slate-100 border-slate-200 text-slate-500'
                        }`} aria-hidden="true">
                          {isDone && !isCurrent ? <Check className="w-4 h-4" /> : i + 1}
                        </div>
                        <span className={`text-xs font-bold mt-1.5 text-center leading-tight break-keep ${isCurrent ? 'text-brand' : isDone ? 'text-slate-700' : 'text-slate-500'}`}>
                          {cfg.label}
                          <span className="sr-only">{isCurrent ? ' (현재 단계)' : isDone ? ' (완료)' : ''}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* 현재 단계 상세 안내 메시지 */}
              <div className="bg-brand/5 border border-brand/10 rounded-2xl p-4 flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand" aria-hidden="true">
                  <Scale className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    현재 심리 상태: {currentThirteenConfig ? `${currentThirteenConfig.label} (${currentThirteenIdx + 1}/13단계)` : CRM_STATUS_CONFIG[currentStatus]?.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {thirteenStage === 'consult_waiting' && (
                      allProposals.length > 0 
                        ? '변호사의 제안서가 도착했습니다. 위의 제안서를 확인하고 추가 상담이나 수임 계약을 진행해 주세요.' 
                        : '상담 요청을 보냈습니다. 변호사가 채무 현황을 검토한 뒤 제안서를 보내 드립니다.'
                    )}
                    {thirteenStage === 'consult_completed' && '담당 변호사와 1:1 상담이 완료되었습니다. 맞춤 채무조정 계획을 확인해 주세요.'}
                    {thirteenStage === 'contract_done' && '정식 수임계약이 완료되었습니다. 관공서 필수 서류 및 AI 음성 진술서를 준비해 주세요.'}
                    {thirteenStage === 'doc_prep' && '법원 제출 필수 서류를 수집 중입니다. 아래 서류함에서 파일을 안전하게 업로드해 주세요.'}
                    {thirteenStage === 'petition_drafting' && '담당 변호사가 신청서와 변제계획안, 채권자목록을 작성하고 있습니다.'}
                    {thirteenStage === 'petition_submitted' && '회생법원에 개시신청서가 정식 접수되었습니다. 사건번호가 부여되어 심리가 시작되었습니다.'}
                    {thirteenStage === 'prohibition_order' && '법원이 금지명령을 내렸습니다. 개인회생채권에 대한 강제집행과 변제 독촉이 제한됩니다. 적용 범위는 담당 변호사에게 확인해 주세요.'}
                    {thirteenStage === 'correction_period' && '회생위원의 보정권고가 도착했습니다. 아래 보정 창구에서 요청받은 소명자료를 올려 주세요.'}
                    {thirteenStage === 'commencement' && '법원이 개인회생 개시결정을 내렸습니다. 인가 전까지 법원 계좌로 변제금 적립을 시작합니다.'}
                    {thirteenStage === 'creditor_meeting' && '채권자집회 기일이 정해졌습니다. 아래 채권자집회 가이드를 확인해 주세요.'}
                    {thirteenStage === 'confirmation' && '변제계획 인가결정이 내려졌습니다. 계획대로 변제금을 내면 변제를 마친 뒤 면책을 신청할 수 있습니다.'}
                    {thirteenStage === 'completed' && '변제계획에 따른 변제를 마쳤습니다. 법원에 면책신청서를 제출해 면책 결정을 받으세요.'}
                    {!thirteenStage && (
                      currentStatus === 'requested' ? (
                        allProposals.length > 0
                          ? '변호사의 제안서가 도착했습니다. 위의 제안서를 확인해 주세요.'
                          : '상담 요청을 보냈습니다. 변호사가 검토한 뒤 제안서를 보내 드립니다.'
                      ) :
                      currentStatus === 'consulting' ? '담당 변호사와 초기 상담이 진행 중입니다. 채팅방에서 문의하세요.' :
                      currentStatus === 'contracted' ? '수임 계약이 완료되었습니다. 필요 서류를 준비해 주세요.' :
                      currentStatus === 'document' ? '서류 수집 중입니다. 아래에서 서류를 업로드하실 수 있습니다.' :
                      currentStatus === 'filed' ? '법원에 신청서가 접수되었습니다. 보정 요청이 있을 수 있습니다.' :
                      currentStatus === 'commenced' ? '법원의 개시결정이 내려졌습니다. 변제 계획에 따라 진행됩니다.' :
                      currentStatus === 'repaying' ? '변제금을 매월 법원에 납부하는 단계입니다.' :
                      '면책 결정이 확정되었습니다. 비면책채권을 제외한 남은 채무의 책임이 면제됩니다.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ [기능 3] 금지명령 인용 안심 축하 & 1초 독촉방어 문자 복사 카드 ═══ */}
        {/* 담당 변호사가 '금지명령' 단계로 기록한 경우에만 표시 (이전: 사건번호만 있어도 '금지명령 인용·법적 효력 발생' 표시) */}
        {crmExt?.thirteenStage === 'prohibition_order' && (
          <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-sm space-y-3.5 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0" aria-hidden="true">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    금지명령 결정 안내
                  </h4>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {crmExt?.courtCase?.courtName || activeRequest?.court || '관할 법원 미등록'} · 사건번호 <span className="font-mono font-bold text-slate-900">{crmExt?.courtCase?.caseNumber || '미등록'}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const court = crmExt?.courtCase?.courtName || activeRequest?.court || '관할 법원';
                  const cNo = crmExt?.courtCase?.caseNumber || '사건번호 확인 중';
                  const lawFirm = clientContract?.lawFirmName || '담당 법률대리인';
                  // 사실 그대로의 안내만 담는다(이전: '송달받았습니다', '전화·방문 추심 전면 금지' 등 단정 문구)
                  const msg = `[개인회생 진행 안내]\n본인은 ${court}에 개인회생을 신청했으며(사건번호: ${cNo}), 법원의 금지명령 결정을 받았습니다.\n채무자회생법 제593조에 따라 금지명령의 범위에서 강제집행·가압류 등과 변제를 요구하는 행위가 제한됩니다.\n문의는 법률대리인(${lawFirm})에게 해 주시기 바랍니다.`;
                  try {
                    await navigator.clipboard.writeText(msg);
                    toast.success('안내 문자를 복사했습니다. 보내기 전에 사건 정보가 맞는지 확인해 주세요.');
                  } catch {
                    toast.error('복사하지 못했습니다. 문자 내용을 직접 입력해 주세요.');
                  }
                }}
                className="min-h-11 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer press-scale shrink-0 whitespace-nowrap"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>채권자 안내 문자 복사</span>
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              독촉 연락이 오면 위 안내 문자를 보낼 수 있습니다. 금지명령의 범위와 효력은 결정문에 따라 다르므로, 연락이 계속되면 담당 변호사에게 알려 주세요.
            </p>
          </div>
        )}

        {/* ═══ [기능 2] 법원 보정권고 (14일 기한) 긴급 소명자료 협업 창구 ═══ */}
        {(crmExt?.thirteenStage === 'correction_period' || (crmExt?.correctionOrders && crmExt.correctionOrders.length > 0) || (crmExt?.corrections && crmExt.corrections.length > 0)) && (() => {
          const firstOrder = crmExt?.correctionOrders?.[0] || crmExt?.corrections?.[0];
          // 기한이 기록되지 않았으면 임의 D-Day를 보여주지 않는다(이전: 'D-10' 고정)
          let dDayText = '';
          if (firstOrder?.deadline) {
            const diff = Math.ceil((new Date(firstOrder.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            dDayText = diff > 0 ? `제출 기한 D-${diff}` : (diff === 0 ? '오늘 제출 마감' : `제출 기한 ${Math.abs(diff)}일 지남`);
          }
          // 내용이 없으면 임의 요청 목록을 만들지 않는다
          const orderNotice = firstOrder?.detail || firstOrder?.content || firstOrder?.title || '담당 변호사가 보정 요청 내용을 정리해 안내할 예정입니다.';

          return (
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-amber-950">
                        보정 요청 대응 중
                      </h4>
                      {dDayText ? (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-600 text-white">
                          {dDayText}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          기한 확인 필요
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                      {orderNotice}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCorrectionUploadOpen(prev => !prev)}
                  aria-expanded={isCorrectionUploadOpen}
                  aria-controls="mypage-correction-upload"
                  className="min-h-11 px-4 bg-amber-700 hover:bg-amber-800 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer press-scale shrink-0 whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>{isCorrectionUploadOpen ? '제출 창 닫기' : '소명자료 제출'}</span>
                </button>
              </div>

              {isCorrectionUploadOpen && (
                <div id="mypage-correction-upload" className="p-4 rounded-xl bg-white border border-amber-200 space-y-3 animate-fadeIn">
                  <p className="text-sm font-bold text-slate-800">
                    변호사가 요청한 소명 자료를 올려 주세요 (영수증, 통장 사본, 메모 등)
                  </p>
                  {/* 파일 입력은 화면에서 숨기되(sr-only) 키보드로 초점을 받을 수 있게 한다 (이전: hidden이라 키보드로 열 수 없었음) */}
                  <label className="flex min-h-12 items-center justify-center gap-2 py-3 border-2 border-dashed border-amber-300 rounded-xl hover:bg-amber-50 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2">
                    <Upload className="w-4 h-4 text-amber-700" aria-hidden="true" />
                    <span className="text-sm font-bold text-amber-800">소명 파일 선택 (사진 또는 PDF)</span>
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*,.pdf"
                      multiple
                      onChange={(e) => {
                        // 성공/실패 안내는 handleFileUpload가 실제 제출 완료 후 표시
                        handleFileUpload(e.target.files, 'correction_proof');
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    올린 자료는 담당 변호사가 검토한 뒤 보정서 작성에 활용합니다.
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ [기능 5] 채권자집회 출석 안내 카드 ═══ */}
        {(crmExt?.thirteenStage === 'creditor_meeting') && (
          <div className="p-5 rounded-2xl bg-brand-light border border-brand/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-sm" aria-hidden="true">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-base text-slate-900">
                    채권자집회 기일 출석 안내
                  </h4>
                  <Badge tone="brand">신분증 지참</Badge>
                </div>
                <p className="text-sm text-slate-700 mt-0.5 break-keep">
                  {crmExt?.courtCase?.courtName || '관할 법원'} · 신청인 본인 출석 원칙 (기일·장소는 법원 통지서 확인)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsCreditorMeetingModalOpen(true)}
              className="min-h-11 px-4 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer press-scale shrink-0 whitespace-nowrap"
            >
              <Users className="w-4 h-4" aria-hidden="true" />
              <span>채권자집회 출석 가이드 보기</span>
            </button>
          </div>
        )}

        {/* ═══ [기능 5] 36회차 완납 시 채무자회생법 제624조 별도 면책신청서 원클릭 대행 요청 ═══ */}
        {(currentStatus === 'repaying' || currentStatus === 'commenced' || crmExt?.thirteenStage === 'confirmation' || crmExt?.thirteenStage === 'completed') && (
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0" aria-hidden="true">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-bold text-base text-slate-900">
                    변제를 마친 뒤 면책신청 (채무자회생법 제624조)
                  </h4>
                  <Badge tone="warning">자동 면책 아님</Badge>
                </div>
                <p className="text-sm text-slate-700 mt-0.5 leading-relaxed break-keep">
                  변제금을 모두 내도 사건이 자동으로 끝나지 않아요. 법원에 면책신청서를 따로 내야 면책결정을 받을 수 있어요.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!reqId || isDischargeRequested) return;
                try {
                  // 실제로 CRM에 요청 시각을 기록해 담당 변호사가 확인할 수 있게 한다
                  await updateCrmClientExtension(reqId, { dischargeRequestedAt: new Date().toISOString() });
                  setDischargeRequestedLocal(true);
                  setRefreshTick(t => t + 1);
                  toast.success('면책신청 요청을 담당 변호사에게 전달했습니다. 접수 일정은 변호사가 안내해 드립니다.');
                } catch {
                  toast.error('요청을 전달하지 못했습니다. 잠시 후 다시 시도해 주세요.');
                }
              }}
              disabled={isDischargeRequested}
              className={`px-4 min-h-11 text-sm font-bold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5 press-scale shrink-0 whitespace-nowrap ${
                isDischargeRequested 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default' 
                  : 'bg-brand hover:bg-brand-hover text-white cursor-pointer'
              }`}
            >
              {isDischargeRequested ? <Check className="w-4 h-4" aria-hidden="true" /> : <FileText className="w-4 h-4" aria-hidden="true" />}
              <span>{isDischargeRequested ? '면책신청 요청을 전달했어요' : '변호사에게 면책신청 요청하기'}</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
