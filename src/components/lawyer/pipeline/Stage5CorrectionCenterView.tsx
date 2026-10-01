import React, { useState } from 'react';
import { 
  Scale, FileEdit, Clock, CheckCircle2, AlertTriangle, 
  Send, ExternalLink, ArrowRight, Table, Sparkles, FileText,
  ShieldCheck, RefreshCw, BellRing, Check, Paperclip, Eye, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';
import { parseLocalYmd } from '../../../utils/localDate';

interface Stage5CorrectionCenterViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage: () => void;
  onOpenComprehensiveCorrectionModal?: () => void;
}

export default function Stage5CorrectionCenterView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onOpenComprehensiveCorrectionModal,
}: Stage5CorrectionCenterViewProps) {
  const [caseNumber, setCaseNumber] = useState(crmExt?.courtCase?.caseNumber || clientRequest.caseNumber || '사건번호 미등록');
  const [courtName, setCourtName] = useState(crmExt?.courtCase?.courtName || clientRequest.court || '관할 법원 미입력');
  const isProhibitionGranted = crmExt?.courtCase?.prohibitionStatus === 'granted' || !!crmExt?.courtCase?.prohibitionGrantedDate;

  const clientName = clientRequest.clientName || '신청인';

  // v2.0: 사건 유형 자동 감지
  const caseType: 'rehabilitation' | 'bankruptcy' = (() => {
    const ct = (crmExt as any)?.caseType || (clientRequest as any).caseType || '';
    if (ct.includes('파산') || ct.includes('bankruptcy') || ct === 'bankruptcy') return 'bankruptcy';
    return 'rehabilitation';
  })();

  const activeCorrection = (crmExt?.correctionOrders && crmExt.correctionOrders.length > 0)
    ? crmExt.correctionOrders[0]
    : (crmExt?.corrections && crmExt.corrections.length > 0)
    ? crmExt.corrections[0]
    : null;

  // 마감일까지 남은 날짜 (로컬 자정 기준)
  const deadlineStr: string = (activeCorrection as any)?.deadline || (activeCorrection as any)?.dueDate || '';
  const deadlineDate = parseLocalYmd(deadlineStr);
  const dDayInfo = deadlineDate ? (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((deadlineDate.getTime() - today.getTime()) / 86400000);
    if (diff > 0) return { text: `제출기한 D-${diff} (${deadlineStr}까지)`, isUrgent: diff <= 3 };
    if (diff === 0) return { text: '오늘 마감 (D-Day)', isUrgent: true };
    return { text: `기한 경과 (D+${Math.abs(diff)})`, isUrgent: true };
  })() : { text: '현재 진행 중인 보정권고 없음', isUrgent: false };

  // 파산 사건 소명서 목록
  const bankruptcyTables = [
    { id: 1, title: '재산 상태 소명서', desc: '파산관재인 요구: 현재 보유 재산의 상세 소명' },
    { id: 2, title: '채무 발생 경위 소명서', desc: '각 채무별 발생 원인과 자금 사용처 소명' },
    { id: 3, title: '면책 불허가 사유 부존재 소명', desc: '도박·사치·편파변제 부존재 입증' },
    { id: 4, title: '최근 재산 처분 소명서', desc: '파산 전 2년간 재산 처분 내역 및 대금 사용처' },
    { id: 5, title: '가족 재산 형성 경위 소명', desc: '배우자·직계존비속 명의 재산의 자금 출처 소명' },
  ];

  // 7대 소명서 표 목록 — 작성 여부는 종합 보정센터에서 관리
  const sevenTables = caseType === 'bankruptcy' ? bankruptcyTables : [
    { id: 1, title: '표 1. 총 채무 및 채권자별 채무액 내역표', desc: '채권자목록 원금 및 이자 소명' },
    { id: 2, title: '표 2. 채무 발생 원인 및 변제 경위 소명서', desc: '차입 목적, 생활비·병원비 지출 증빙' },
    { id: 3, title: '표 3. 최근 1년 이내 차입금 사용처 소명표', desc: '대출금 인출 후 사용처 소명' },
    { id: 4, title: '표 4. 최근 2년 이내 재산 처분대금 사용처표', desc: '부동산/차량 매각대금 사용처' },
    { id: 5, title: '표 5. 가족 명의 재산 형성 경위 소명서', desc: '배우자/부모 명의 취득 자금 출처' },
    { id: 6, title: '표 6. 신용카드 사용 내역 및 환가 소명표', desc: '카드 사용·현금화 여부 소명' },
    { id: 7, title: '표 7. 월 평균 소득 및 필요경비 산정표', desc: '실소득 증빙 및 생계비 산정' },
  ];
  const hasDraft = !!(crmExt as any)?.correctionBriefDraft;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Next Action Hero Card ── */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#1E3A5F] text-white shadow-xs shrink-0 mt-0.5">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  Stage 05 핵심 작업
                </span>
                <span className="text-sm font-black tracking-tight">
                  {caseType === 'bankruptcy'
                    ? '파산관재인 보정권고에 대한 소명서를 작성하여 법원에 제출하세요.'
                    : '회생위원 보정권고 기한을 준수하여 7대 표 소명서를 법원에 제출하세요.'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {caseType === 'bankruptcy'
                  ? '파산·면책 심문 전에 파산관재인 보정권고 항목을 모두 소명해야 합니다.'
                  : '나의사건 진행내역을 조회하고, 보정기한 내에 대출금 사용처 및 통장 거래내역 소명서를 완비합니다.'}
              </p>
              <p className={`text-xs mt-1.5 font-bold ${dDayInfo.isUrgent ? 'text-rose-600' : 'text-slate-600'}`}>
                <Clock className="w-3.5 h-3.5 inline mr-1 -mt-0.5" aria-hidden="true" />{dDayInfo.text}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {onOpenComprehensiveCorrectionModal && (
              <button
                type="button"
                onClick={onOpenComprehensiveCorrectionModal}
                className="px-5 py-2.5 bg-[#1E3A5F] hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 press-scale cursor-pointer"
              >
                <FileEdit className="w-4 h-4 text-emerald-400" />
                <span>종합 보정센터 열기 (Major)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onAdvanceToNextStage}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 press-scale cursor-pointer"
            >
              <span>Stage 6 (개시·사후관리)로 진행</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. 법원 사건 및 금지명령 상태 카드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 font-bold">
            <span>대법원 사건번호</span>
            <span className="text-blue-600 font-mono">{courtName}</span>
          </div>
          <div className="text-base font-black text-slate-900 font-mono">{caseNumber}</div>
          <div className="text-[11px] text-slate-500">진행내역은 [법원] 탭의 나의사건검색에서 조회하세요</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 font-bold">
            <span>금지·중지명령 상태</span>
            <span className="font-mono text-emerald-600">{isProhibitionGranted ? '발령 완료' : '심리 중'}</span>
          </div>
          <div className="text-base font-black text-emerald-700">
            {isProhibitionGranted ? '🛡️ 금지명령 발령' : '⏳ 법원 심리 진행 중'}
          </div>
          <div className="text-[11px] text-slate-500">{isProhibitionGranted ? '금지명령 효력 범위 내에서 채권자의 추심·새 강제집행이 금지됩니다.' : '금지명령 결정 전입니다.'}</div>
        </div>
      </div>

      {/* ── 4. 7대 표 소명서 목록 (2단 그리드 구성) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[#1E3A5F] text-white">
              <Table className="w-3.5 h-3.5" />
            </span>
            <span className="font-black text-xs text-slate-900">
              {caseType === 'bankruptcy' ? '파산관재인 보정 소명서' : '회생위원 7대 법원 표준 소명서'}
            </span>
            <span className="text-[11px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {hasDraft ? '보정서 초안 저장됨' : '보정서 초안 없음'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-bold">
            표를 누르면 종합 보정센터가 열립니다
          </span>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sevenTables.map((tbl) => (
              <div 
                key={tbl.id} 
                onClick={onOpenComprehensiveCorrectionModal}
                className="p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs cursor-pointer bg-slate-50/70 hover:bg-blue-50/50 hover:border-blue-300 border-slate-200"
                title={`${tbl.title} 상세 작성 및 검토`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-900 block truncate">
                    {tbl.title}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {tbl.desc}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 whitespace-nowrap bg-white text-slate-600 border-slate-200">
                  센터에서 작성
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
