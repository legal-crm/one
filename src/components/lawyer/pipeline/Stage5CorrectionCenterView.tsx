import React, { useState } from 'react';
import { 
  Scale, FileEdit, Clock, CheckCircle2, AlertTriangle, 
  Send, ExternalLink, ArrowRight, Table, Sparkles, FileText,
  ShieldCheck, RefreshCw, BellRing, Check, Paperclip, Eye, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { addClientNotification } from '../../../services/clientNotificationService';

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
  const [caseNumber, setCaseNumber] = useState(crmExt?.courtCase?.caseNumber || clientRequest.caseNumber || '사건 접수 준비중');
  const [courtName, setCourtName] = useState(crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원');
  const isProhibitionGranted = crmExt?.courtCase?.prohibitionStatus === 'granted' || !!crmExt?.courtCase?.prohibitionGrantedDate;
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
    if (diff === 0) return { text: '오늘 마감 (D-Day)', isUrgent: true };
    return { text: `기한 경과 (D+${Math.abs(diff)})`, isUrgent: true };
  })() : { text: '현재 진행 중인 보정권고 없음', isUrgent: false };

  // 7대 법원 표준 소명서 표 목록
  const sevenTables = [
    { id: 1, title: '표 1. 총 채무 및 채권자별 채무액 내역표', desc: '채권자목록 원금 및 이자 소명', isReady: true },
    { id: 2, title: '표 2. 채무 발생 원인 및 변제 경위 소명서', desc: '차입 목적, 생활비·병원비 지출 증빙', isReady: true },
    { id: 3, title: '표 3. 최근 1년 이내 차입금 사용처 소명표', desc: '대출금 인출 후 송금처 100% 매칭', isReady: true },
    { id: 4, title: '표 4. 최근 2년 이내 재산 처분대금 사용처표', desc: '부동산/차량 매각대금 은닉 방어', isReady: false },
    { id: 5, title: '표 5. 가족 명의 재산 형성 경위 소명서', desc: '배우자/부모 명의 취득 자금 출처', isReady: true },
    { id: 6, title: '표 6. 신용카드 사용 내역 및 환가 소명표', desc: '카드깡/상품권 현금화 의심 차단', isReady: true },
    { id: 7, title: '표 7. 월 평균 소득 및 필요경비 산정표', desc: '실소득 증빙 및 객관적 생계비 방어', isReady: true },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── 1. 단계 목표 & 진행률 바 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
            Stage 05 목표
          </span>
          <span className="text-xs font-bold text-slate-800">
            회생위원 보정권고 7대 표 소명서 작성 및 전자소송 제출
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">소명서 준비:</span>
          <span className="font-mono font-bold text-[#1E3A5F]">6 / 7종 완성</span>
        </div>
      </div>

      {/* ── 2. Next Action Hero Card ── */}
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
                  회생위원 보정권고 기한을 준수하여 7대 표 소명서를 법원에 제출하세요.
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                나의사건 진행내역을 조회하고, 보정기한 내에 대출금 사용처 및 통장 거래내역 소명서를 완비합니다.
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
          <div className="text-[11px] text-slate-500">대법원 나의사건검색 실시간 연동 중</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 font-bold">
            <span>금지·중지명령 상태</span>
            <span className="font-mono text-emerald-600">{isProhibitionGranted ? '발령 완료' : '심리 중'}</span>
          </div>
          <div className="text-base font-black text-emerald-700">
            {isProhibitionGranted ? '🛡️ 채권자 추심 전면 금지 발효' : '⏳ 법원 심리 진행 중'}
          </div>
          <div className="text-[11px] text-slate-500">모든 채권사의 독촉 전화 및 압류가 중단됩니다.</div>
        </div>
      </div>

      {/* ── 4. 7대 표 소명서 목록 ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-black text-xs text-slate-900 flex items-center gap-1.5">
            <Table className="w-4 h-4 text-[#1E3A5F]" />
            회생위원 7대 법원 표준 소명서
          </span>
          <span className="text-[11px] text-slate-500 font-bold">원클릭 AI 초안 완성</span>
        </div>

        <div className="divide-y divide-slate-100">
          {sevenTables.map((tbl) => (
            <div key={tbl.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs">
              <div>
                <span className="font-bold text-slate-900">{tbl.title}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{tbl.desc}</p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                tbl.isReady 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {tbl.isReady ? '작성 완료' : '자료 보완필요'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
