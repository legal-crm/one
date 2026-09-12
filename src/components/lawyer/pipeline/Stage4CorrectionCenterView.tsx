import React, { useState } from 'react';
import { 
  Scale, FileEdit, Clock, CheckCircle2, AlertTriangle, 
  Send, ExternalLink, ArrowRight, Table, Sparkles, FileText,
  ShieldCheck, RefreshCw, BellRing, Check, Paperclip, Eye, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';

interface Stage4CorrectionCenterViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage: () => void;
  onOpenComprehensiveCorrectionModal?: () => void;
}

export default function Stage4CorrectionCenterView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenComprehensiveCorrectionModal,
}: Stage4CorrectionCenterViewProps) {
  const [caseNumber, setCaseNumber] = useState(crmExt?.courtCase?.caseNumber || clientRequest.caseNumber || '사건 접수 준비중');
  const [courtName, setCourtName] = useState(crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원');
  const isProhibitionGranted = crmExt?.courtCase?.prohibitionStatus === 'granted' || !!crmExt?.courtCase?.prohibitionGrantedDate;
  const prohibitionDate = crmExt?.courtCase?.prohibitionGrantedDate || '발령 완료';
  const [selectedTableTab, setSelectedTableTab] = useState<number>(3); // 최근대출금 사용처 소명

  const clientName = clientRequest.clientName || '신청인';

  const activeCorrection = (crmExt?.correctionOrders && crmExt.correctionOrders.length > 0)
    ? crmExt.correctionOrders[0]
    : (crmExt?.corrections && crmExt.corrections.length > 0)
    ? crmExt.corrections[0]
    : null;

  const dDayInfo = activeCorrection?.deadline ? (() => {
    const diff = Math.ceil((new Date(activeCorrection.deadline).getTime() - Date.now()) / 86400000);
    if (diff > 0) return { text: `제출기한 D-${diff} (${activeCorrection.deadline}까지)`, isUrgent: diff <= 3 };
    if (diff === 0) return { text: `제출기한 D-Day (오늘 마감)`, isUrgent: true };
    return { text: `기한 ${Math.abs(diff)}일 경과 (${activeCorrection.deadline})`, isUrgent: true };
  })() : { text: '제출기한 심리중', isUrgent: false };

  // 7대 표 템플릿 정의 (리걸플로 Ch 10~11 매뉴얼 기반)
  const templateTables = [
    { id: 1, title: '표 1. 금융거래내역 소명표', desc: '100만원 이상 고액 입출금 건에 대한 자금 출처 및 귀속 소명' },
    { id: 2, title: '표 2. 신용카드 사용내역 소명표', desc: '최근 1년간 카드 결제액 중 사치/유흥/실생활비 구분' },
    { id: 3, title: '표 3. 최근 1년 대출금 사용처 소명표', desc: '대출금의 기존 채무 변제, 생활비, 사업비 사용처 증빙 (핵심 승부처)' },
    { id: 4, title: '표 4. 최근 처분 재산 소명표', desc: '1,000만원 이상 부동산/자동차 매각 대금의 구체적 사용처 증빙' },
    { id: 5, title: '표 5. 수입 및 소득 변동 소명표', desc: '급여 인상/감소, 보너스, 프리랜서 사업소득 산정 근거' },
    { id: 6, title: '표 6. 추가 생계비 인정 소명표', desc: '지병 치료비, 노부모 부양, 고액 주거비 실비 증빙' },
    { id: 7, title: '표 7. 채무 증대 경위 진술서', desc: '회생위원이 납득할 수 있는 성실한 실패 및 갱생 의지 기술' },
  ];

  // 의뢰인이 업로드한 긴급 보정 소명 서류 필터링
  const correctionFiles = (crmExt?.uploadedFiles || []).filter(
    f => f.linkedDocId === 'correction_proof' || f.category === 'correction'
  );

  // 금지명령 인용 알림톡 발송
  const handleSendProhibitionNotice = () => {
    addClientNotification({
      type: 'status_change',
      title: '[금지명령 인용 결정] 채권자의 일체 독촉 전화·방문 및 급여·통장 압류가 법적으로 전면 금지되었습니다.',
      emoji: '🛡️',
      linkTab: 'diagnosis',
    });
    toast.success(`${clientName}님께 "금지명령 인용 결정 안내(채권자 독촉·압류 일체 중단)" 카카오 알림톡이 발송되었습니다.`);
  };

  // 의뢰인에게 보정 소명자료 긴급 업로드 요청 알림
  const handleRequestCorrectionDoc = () => {
    addClientNotification({
      type: 'status_change',
      title: '[보정 소명자료 긴급 요청] 회생위원 보정권고에 따른 소명서류(대출금 사용처/통장내역)를 업로드해 주세요.',
      emoji: '⚠️',
      linkTab: 'diagnosis',
    });
    toast.success(`${clientName}님께 보정 소명자료 긴급 업로드 요청 알림이 전송되었습니다.`);
  };

  // 보정서 전자 제출
  const handleSubmitCorrection = () => {
    addClientNotification({
      type: 'status_change',
      title: '[법원 보정서 제출 완료] 회생위원 보정요구에 대한 소명서가 대법원 전자소송에 정상 접수되었습니다.',
      emoji: '📋',
      linkTab: 'diagnosis',
    });
    toast.success('보정서 및 7대 표 소명서가 대법원 전자소송에 접수 완료되었습니다.');
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 사건 정보 & 대법원 나의사건 크롤링 카드 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">
              Stage 4. 대법원 사건 크롤링 & 리걸플로 보정센터
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
              보정권고 심리 진행중
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span>관할: {courtName}</span>
            <span>•</span>
            <span className="font-bold text-slate-800">사건번호: {caseNumber}</span>
            <span>•</span>
            <span>재판부: 회생단독 21부</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toast.info('대법원 나의사건검색 스크래핑을 실행하여 최신 진행상황을 동기화했습니다.')}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>대법원 동기화</span>
          </button>

          <button
            onClick={onAdvanceToNextStage}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer"
          >
            <span>개시결정 완료 (Stage 5 이동)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 금지명령 인용 결과 & 안심 알림톡 발송 배너 */}
      <div className={`p-4 rounded-2xl border text-xs shadow-xs flex items-center justify-between gap-4 ${
        isProhibitionGranted 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' 
          : 'bg-amber-50/80 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${isProhibitionGranted ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold text-sm flex items-center gap-2">
              <span>{isProhibitionGranted ? `금지명령 인용 결정 (${prohibitionDate})` : '금지명령 심리 진행중'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                isProhibitionGranted ? 'bg-emerald-200/70 text-emerald-900' : 'bg-amber-200/70 text-amber-900'
              }`}>
                {isProhibitionGranted ? '효력 발생중' : '법원 심리중'}
              </span>
            </div>
            <p className="text-slate-600 text-[11px] mt-0.5">
              {isProhibitionGranted
                ? `${courtName} 금지명령 결정 정본 송달 완료. 채권자의 일체 독촉 전화, 방문, 통장/급여 압류가 법적으로 전면 차단되었습니다.`
                : '접수 후 3~7일 이내 금지명령 결정이 내려지며 채권자의 독촉·압류가 전면 금지됩니다.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleSendProhibitionNotice}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <BellRing className="w-3.5 h-3.5" />
          <span>의뢰인 안심 알림톡 발송</span>
        </button>
      </div>

      {/* 법원 보정권고문 안내 & 기한 카운터 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900">
              {activeCorrection?.title || '회생위원 제1차 보정권고문 심리 (기한 관리)'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
              dDayInfo.isUrgent 
                ? 'bg-rose-50 text-rose-600 border-rose-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {dDayInfo.text}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            담당 회생위원: {activeCorrection?.courtOfficer || '박회생 조사관'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed font-sans">
          <span className="font-bold text-slate-900 block">주요 보정 요구 사항:</span>
          {activeCorrection?.requirements && activeCorrection.requirements.length > 0 ? (
            activeCorrection.requirements.map((req, idx) => (
              <p key={idx}>{idx + 1}. {req}</p>
            ))
          ) : activeCorrection?.details ? (
            <p className="whitespace-pre-line">{activeCorrection.details}</p>
          ) : (
            <>
              <p>1. 신청인이 2025년 하반기 대출받은 신한카드 1,850만원의 구체적인 사용처를 별지 표 3 양식으로 정리하고 계좌 이체증을 첨부할 것.</p>
              <p>2. 신청인의 최근 1년간 모든 통장 거래내역 중 100만원 이상 인출된 건에 관하여 별지 표 1에 기재하여 소명할 것.</p>
              <p>3. 부양가족 중 배우자의 소득 증빙(소득금액증명원)을 추가로 제출할 것.</p>
            </>
          )}
        </div>
      </div>

      {/* ═══ 의뢰인이 마이페이지에서 업로드한 긴급 보정 소명자료 수합함 ═══ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-amber-600" />
              의뢰인 긴급 보정 소명자료 수합함 (마이페이지 연동)
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              correctionFiles.length > 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {correctionFiles.length > 0 ? `${correctionFiles.length}건 소명자료 접수됨` : '소명자료 대기중'}
            </span>
          </div>

          <button
            onClick={handleRequestCorrectionDoc}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <BellRing className="w-3.5 h-3.5 text-amber-600" />
            <span>의뢰인 소명자료 제출 재요청 알림</span>
          </button>
        </div>

        {correctionFiles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {correctionFiles.map((file, idx) => (
              <div key={file.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 shrink-0">
                    <FileText className="w-4 h-4 text-brand" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 truncate block">{file.name}</span>
                    <span className="text-[10px] text-slate-500 block">
                      {file.uploadedAt ? new Date(file.uploadedAt).toLocaleString('ko-KR') : '최근 제출'}
                      {file.fileSize ? ` · ${(file.fileSize / 1024).toFixed(0)}KB` : ''}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {file.dataUrl && (
                    <a
                      href={file.dataUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-slate-500" />
                      보기
                    </a>
                  )}
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                    소명 증빙
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-1">
            <p className="font-medium">의뢰인이 마이페이지 긴급 소명 창구에서 제출한 통장 사본, 영수증 등이 여기에 실시간 동기화됩니다.</p>
            <p className="text-[11px] text-slate-400">의뢰인이 소명파일을 등록하면 별지 소명표에 증빙으로 자동 반영할 수 있습니다.</p>
          </div>
        )}
      </div>

      {/* ⭐ 리걸플로 벤치마킹 핵심: 7대 표 템플릿 별지 소명서 에디터 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-4 h-4 text-brand" />
            <span className="text-xs font-black text-slate-900">
              리걸플로 7대 표 템플릿 별지 소명서 에디터
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-brand/10 text-brand">
              변제금 방어 승부처
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenComprehensiveCorrectionModal && (
              <button
                onClick={onOpenComprehensiveCorrectionModal}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-600" />
                <span>종합 보정센터 전체보기</span>
              </button>
            )}
            <button
              onClick={handleSubmitCorrection}
              className="px-3 py-1.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>보정서 전자소송 제출</span>
            </button>
          </div>
        </div>

        {/* 7대 표 탭 선택기 */}
        <div className="flex border-b border-slate-200 bg-white p-2 gap-1 overflow-x-auto text-xs font-bold">
          {templateTables.map((tbl) => (
            <button
              key={tbl.id}
              onClick={() => setSelectedTableTab(tbl.id)}
              className={`px-3 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedTableTab === tbl.id
                  ? 'bg-brand text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tbl.title}</span>
            </button>
          ))}
        </div>

        {/* 표 에디터 본문 (예: 표 3 최근 1년 대출금 사용처) */}
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-900">
              {templateTables.find(t => t.id === selectedTableTab)?.desc}
            </span>
            <button
              onClick={() => toast.success('행이 추가되었습니다.')}
              className="text-brand font-bold hover:underline cursor-pointer"
            >
              + 소명 항목 추가
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">대출일자</th>
                  <th className="p-3">대출 금융기관</th>
                  <th className="p-3 text-right">대출금액</th>
                  <th className="p-3">사용처 구분</th>
                  <th className="p-3">구체적 소명 내용 및 계좌 귀속처</th>
                  <th className="p-3 text-center">증빙 첨부</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3 font-mono">2025-08-14</td>
                  <td className="p-3 font-bold text-slate-900">신한카드(주)</td>
                  <td className="p-3 font-mono text-right font-bold">18,500,000원</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                      기존 채무 변제
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">
                    국민은행 신용대출 원리금 1,200만원 상환 및 나머지 650만원 병원비 지출
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-emerald-600 font-bold text-[11px]">이체증 완료 ✓</span>
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-mono">2025-11-02</td>
                  <td className="p-3 font-bold text-slate-900">현대캐피탈(주)</td>
                  <td className="p-3 font-mono text-right font-bold">12,000,000원</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-[10px]">
                      생활비 지출
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">
                    실직 기간 3개월간의 주거지 월세(100만×3) 및 가족 생계비 충당
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-emerald-600 font-bold text-[11px]">통장내역 완료 ✓</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
