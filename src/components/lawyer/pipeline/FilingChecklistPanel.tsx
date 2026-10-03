/**
 * FilingChecklistPanel.tsx
 * 대법원 전자소송 제출목록 종합 관리 패널
 * - 로패스(LawPass) 벤치마크: 관할법원별 제출목록 체크리스트, 서식별 상태 점검, 개별 및 일괄 다운로드
 * - 13대 필수/부수 서식 및 첨부 소명자료 완결성 실시간 확인
 * - 원클릭 통합 에디터 연동 및 110~140p 완성본 번들 PDF 생성 트리거
 */

import React, { useMemo } from 'react';
import { 
  FileText, CheckCircle2, AlertCircle, Eye, Download, 
  ExternalLink, Sparkles, FolderArchive, Layers, Scale,
  Clock, Shield, ArrowUpRight, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import { 
  type CourtFilingMasterData,
  type CourtJurisdiction,
  COURT_JURISDICTIONS,
  buildCourtFilingMasterData,
  getEvidenceListForJurisdiction
} from '../../../services/documents/courtFilingEngine';
import { 
  computeFieldIssues, 
  summarizeFieldIssues,
  type CourtDocTabKey 
} from '../../../services/documents/courtFieldRegistry';

interface FilingChecklistPanelProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  activeLawyerName?: string;
  onOpenCourtDocSuite?: (formCode?: string) => void;
  onOpenBatchFilingModal?: () => void;
}

interface FilingDocItem {
  id: string;
  formCode: string;
  tabKey: CourtDocTabKey;
  title: string;
  category: '본안서식' | '부수신청' | '소명자료' | '위임/기타';
  required: boolean;
  courtSpecificNote?: string;
}

const MASTER_FILING_DOCS: FilingDocItem[] = [
  { id: 'cover', formCode: 'COVER', tabKey: 'PETITION_COVER', title: '개인회생절차 개시신청서 표지', category: '본안서식', required: true, courtSpecificNote: '서울회생법원은 최초면담·당일면담 표 자동 적용' },
  { id: 'petition', formCode: 'D5100', tabKey: 'PETITION_BODY', title: '개인회생절차 개시신청서 (본문)', category: '본안서식', required: true },
  { id: 'statement', formCode: 'D5105', tabKey: 'STATEMENT', title: '진술서 및 채무부담 경위서', category: '본안서식', required: true },
  { id: 'creditors', formCode: 'D5106', tabKey: 'CREDITOR_LIST', title: '개인회생채권자목록', category: '본안서식', required: true },
  { id: 'assets', formCode: 'D5101', tabKey: 'ASSET_LIST', title: '재산목록', category: '본안서식', required: true },
  { id: 'income', formCode: 'D5103', tabKey: 'INCOME_EXPENSE', title: '수입 및 지출에 관한 목록', category: '본안서식', required: true },
  { id: 'plan', formCode: 'D5110', tabKey: 'REPAYMENT_PLAN', title: '변제계획안 [전산양식 A5433]', category: '본안서식', required: true },
  { id: 'schedule', formCode: 'D5110', tabKey: 'REPAYMENT_SCHEDULE', title: '변제예정액표 (채권자별 분배표)', category: '본안서식', required: true },
  { id: 'prohibition', formCode: 'D5114', tabKey: 'PROHIBITION_ORDER', title: '금지명령신청서', category: '부수신청', required: false, courtSpecificNote: '개시 전 독촉/압류 금지' },
  { id: 'stay', formCode: 'D5113', tabKey: 'STAY_ORDER', title: '중지명령신청서', category: '부수신청', required: false, courtSpecificNote: '진행 중인 강제집행 중지' },
  { id: 'poa', formCode: 'POA', tabKey: 'POWER_OF_ATTORNEY', title: '소송위임장', category: '위임/기타', required: true },
  { id: 'service', formCode: 'SERVICE', tabKey: 'SERVICE_REPORT', title: '송달영수인 신고서', category: '위임/기타', required: false },
  { id: 'evidence', formCode: 'EVIDENCE', tabKey: 'EVIDENCE_LIST', title: '자료제출목록 10대 체크리스트', category: '소명자료', required: true, courtSpecificNote: '관할법원 실무준칙별 양식' },
];

export default function FilingChecklistPanel({
  clientRequest,
  crmExt,
  activeLawyerName = '',
  onOpenCourtDocSuite,
  onOpenBatchFilingModal
}: FilingChecklistPanelProps) {
  // 마스터 데이터 및 미입력 요약 산출
  const masterData: CourtFilingMasterData = useMemo(() => {
    return buildCourtFilingMasterData(clientRequest, crmExt, activeLawyerName);
  }, [clientRequest, crmExt, activeLawyerName]);

  const issueSummary = useMemo(() => {
    return summarizeFieldIssues(computeFieldIssues(masterData));
  }, [masterData]);

  const jurisdiction = masterData.courtJurisdiction;
  const jurisdictionMeta = COURT_JURISDICTIONS[jurisdiction];

  // 총 서식 준비 상태 통계
  const stats = useMemo(() => {
    let complete = 0;
    let warning = 0;

    MASTER_FILING_DOCS.forEach(doc => {
      const issue = issueSummary.countByTab[doc.tabKey];
      if (issue && (issue.missing + issue.invalid) > 0) {
        warning++;
      } else {
        complete++;
      }
    });

    const percent = Math.round((complete / MASTER_FILING_DOCS.length) * 100);
    return { complete, warning, total: MASTER_FILING_DOCS.length, percent };
  }, [issueSummary]);

  return (
    <div className="space-y-4">
      {/* ── 1. 상단 관할법원 및 제출목록 상태 브리핑 카드 ── */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg border border-blue-500/30">
                <Scale className="w-4 h-4" />
              </span>
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <span>법원 제출목록 종합 관리</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700 font-mono">
                  {jurisdictionMeta.title}
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              대법원 전산 표준 규격에 맞춘 13대 서식 및 관할법원 제출 소명자료 일괄 점검
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onOpenCourtDocSuite && (
              <button
                type="button"
                onClick={() => onOpenCourtDocSuite('COVER')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 press-scale cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>13종 통합 에디터 열기</span>
              </button>
            )}

            {onOpenBatchFilingModal && (
              <button
                type="button"
                onClick={onOpenBatchFilingModal}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 press-scale cursor-pointer"
              >
                <FolderArchive className="w-3.5 h-3.5 text-slate-400" />
                <span>ZIP 일괄 패키징</span>
              </button>
            )}
          </div>
        </div>

        {/* 진행률 바 & 요약 배지 */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">제출 서류 완성도</span>
              <span className="font-mono text-blue-400 font-bold">{stats.percent}% ({stats.complete}/{stats.total}건 준비됨)</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500" 
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 text-xs">
            <div className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-300 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>완결 {stats.complete}</span>
            </div>
            {stats.warning > 0 && (
              <div className="px-2.5 py-1 bg-amber-950/60 border border-amber-800/80 rounded-lg text-amber-300 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>확인 필요 {stats.warning}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. 서식 목록 테이블 (체크리스트) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-700" />
            <h4 className="font-bold text-xs text-slate-900">제출 서식 목록 ({MASTER_FILING_DOCS.length}종)</h4>
          </div>
          <span className="text-xs text-slate-500">
            각 서식을 클릭하면 왼쪽 미리보기와 오른쪽 입력창이 결합된 편집기로 연결됩니다.
          </span>
        </div>

        <div className="divide-y divide-slate-100 overflow-x-auto">
          {MASTER_FILING_DOCS.map((doc, idx) => {
            const issues = issueSummary.countByTab[doc.tabKey];
            const issueCount = issues ? (issues.missing + issues.invalid) : 0;
            const isReady = issueCount === 0;

            return (
              <div 
                key={doc.id}
                className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition text-xs"
              >
                {/* 좌측: 번호, 서식명, 배지 */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-slate-400 w-5 text-right font-bold">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 truncate">
                        {doc.title}
                      </span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                        doc.category === '본안서식'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : doc.category === '부수신청'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {doc.category}
                      </span>
                      {doc.required && (
                        <span className="text-[11px] text-rose-600 font-semibold">필수</span>
                      )}
                    </div>
                    {doc.courtSpecificNote && (
                      <p className="text-[11px] text-slate-500">
                        • {doc.courtSpecificNote}
                      </p>
                    )}
                  </div>
                </div>

                {/* 우측: 준비 상태 및 액션 버튼 */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* 상태 배지 */}
                  {isReady ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>작성 완료</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>미입력 {issueCount}건</span>
                    </span>
                  )}

                  {/* 열기 / 편집 버튼 */}
                  {onOpenCourtDocSuite && (
                    <button
                      type="button"
                      onClick={() => onOpenCourtDocSuite(doc.formCode)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition flex items-center gap-1 press-scale cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                      <span>서식 열기</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
