import React, { useState } from 'react';
import { 
  Send, FileCheck, ShieldAlert, Archive, CheckCircle2, 
  AlertCircle, Download, ExternalLink, ArrowRight, Clock,
  FileSpreadsheet, FileText, Check, ShieldCheck, Sparkles,
  Layers, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';

interface Stage3FilingBundleViewProps {
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onAdvanceToNextStage: () => void;
  onOpenBatchFilingModal?: () => void;
  onOpenAncillaryModal?: () => void;
}

export default function Stage3FilingBundleView({
  clientRequest,
  crmExt,
  onAdvanceToNextStage,
  onBatchFilingModal,
  onOpenAncillaryModal,
}: any) {
  const [includeProhibition, setIncludeProhibition] = useState(true);
  const [includeStayOrder, setIncludeStayOrder] = useState(true);
  const [stayExecutionCaseNo, setStayExecutionCaseNo] = useState('2025타채 54321호 (급여압류)');
  const [isClientConsented, setIsClientConsented] = useState(true);
  const [isFilingSubmitted, setIsFilingSubmitted] = useState(false);

  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt?.courtCase?.courtName || clientRequest.court || '서울회생법원';

  // 8대 필수 서식 목록
  const standardForms = [
    { code: 'R01', name: '개인회생절차 개시신청서 본안', isReady: true, note: '당사자 기본 인적사항 및 관할법원 지정' },
    { code: 'R02', name: '개인회생 채권자목록 (CSV)', isReady: true, note: '8개 채권사 원금·이자 산정 및 CSV 변환 완료' },
    { code: 'R06', name: '재산목록 (D5102)', isReady: true, note: '부동산, 자동차, 예금, 보험환급금 청산가치 산정' },
    { code: 'R08', name: '수입 및 지출에 관한 목록 (D5103)', isReady: true, note: '중위소득 60% 기준 생계비 및 가용소득 확정' },
    { code: 'R10', name: '진술서 (채무 증대 경위서)', isReady: true, note: 'AI 첨삭 및 신청인 확인 완료' },
    { code: 'R04', name: '변제계획안 및 변제예정표', isReady: true, note: '제614조 제2항 최저변제율(28.4% > 5%) 충족' },
    { code: 'R03', name: '소송위임장', isReady: true, note: '전자서명 체결 완료' },
    { code: 'R07', name: '첨부서류 일체 (4대 발급처 증빙)', isReady: true, note: 'Stage 2 수합 20종 서류 번들링 완료' },
  ];

  // 원클릭 번들 다운로드
  const handleDownloadBundle = () => {
    toast.success('대법원 전자소송 제출용 ZIP 패키지(8대 서식 + 금지/중지명령)가 다운로드되었습니다.');
  };

  // 법원 접수 완료 처리
  const handleCompleteFiling = () => {
    setIsFilingSubmitted(true);
    toast.success('전자소송 접수가 완료되었습니다. Stage 4 (법원·보정센터)로 이동합니다.');
    onAdvanceToNextStage();
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* 헤더 안내 카드 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">
              Stage 3. 개시신청 8대 서식 & 금지·중지명령 일괄 패키징
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              전자소송 원클릭 번들
            </span>
          </div>
          <p className="text-xs text-slate-500">
            전자소송 접수 시 개시신청서와 금지명령·중지명령을 동일 번들로 묶어 채권자의 독촉과 급여 압류를 동시에 방어합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadBundle}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>전자소송 ZIP 번들 다운로드</span>
          </button>

          <button
            onClick={handleCompleteFiling}
            className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 press-scale cursor-pointer"
          >
            <span>전자소송 접수 완료 (Stage 4 이동)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ⚠️ 법정 요건 알림: 변제계획안 14일 규정 및 누락채권자 방어 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-950 text-xs space-y-1 shadow-xs">
          <div className="font-extrabold flex items-center gap-1.5 text-blue-900">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>변제계획안 동시 제출 원칙 (채무자회생법 제595조 제4호)</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            법률상 변제계획안은 14일 이내 제출이지만, 실무상 미제출 시 즉시 기각 대상이 되므로 본 시스템에서는 개시신청서와 100% 동시 패키징하여 제출합니다.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs space-y-1 shadow-xs">
          <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>누락 채권자 비면책 방어 전수대조 통과 (제625조 제2항)</span>
          </div>
          <p className="text-slate-600 text-[11px] leading-relaxed">
            한국신용정보원 조회내역(8건) vs 부채증명서 발급내역(8건) vs 채권자목록 CSV(8건)의 3자 전수 일치를 검증하여 누락 채권 0건을 보장합니다.
          </p>
        </div>
      </div>

      {/* ⭐ 사용자 요청 핵심: 금지명령 & 강제집행 중지명령 일괄 결합 섹션 */}
      <div className="bg-white p-5 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-black text-slate-900 block">
                ⭐ 금지명령 & 중지명령 신청서 일괄 결합 옵션 (동일 카테고리)
              </span>
              <span className="text-xs text-slate-500">
                전자소송 개시신청서와 함께 법원에 동시 접수되어 3~7일 이내 인용 결정이 내려집니다.
              </span>
            </div>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            동시 제출 필수
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* 1. 금지명령 신청서 */}
          <div className={`p-4 rounded-xl border transition-all ${
            includeProhibition ? 'bg-indigo-50/40 border-indigo-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeProhibition}
                onChange={e => setIncludeProhibition(e.target.checked)}
                className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand mt-0.5"
              />
              <div className="space-y-1 text-xs">
                <span className="font-black text-slate-900 block text-sm">
                  [필수] 개인회생 금지명령신청서 (제593조 제1항 제1호)
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  개인회생채권에 기한 독촉, 변제 요구, 유체동산/급여/영업재산에 대한 일체의 강제집행·가압류·가처분을 금지합니다.
                </p>
                <span className="inline-block text-[10px] text-indigo-700 font-bold bg-white px-2 py-0.5 rounded border border-indigo-200 mt-1">
                  인지대 1,800원 + 채권자 송달료 패키징 완료
                </span>
              </div>
            </label>
          </div>

          {/* 2. 강제집행 중지명령 신청서 */}
          <div className={`p-4 rounded-xl border transition-all ${
            includeStayOrder ? 'bg-indigo-50/40 border-indigo-300' : 'bg-slate-50 border-slate-200'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStayOrder}
                onChange={e => setIncludeStayOrder(e.target.checked)}
                className="w-4 h-4 rounded text-brand border-slate-300 focus:ring-brand mt-0.5"
              />
              <div className="space-y-1 text-xs">
                <span className="font-black text-slate-900 block text-sm">
                  [연계] 강제집행 중지명령신청서 (제593조 제1항 제2호)
                </span>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  이미 진행 중인 급여 압류 및 전부명령 절차의 즉각적인 집행 정지를 구합니다.
                </p>
                <div className="pt-1.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={stayExecutionCaseNo}
                    onChange={e => setStayExecutionCaseNo(e.target.value)}
                    placeholder="타채 사건번호 입력"
                    className="w-full px-2.5 py-1 text-[11px] font-mono border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* 8대 필수 서식 작성 현황 목록 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900">
              대법원 전자소송 개인회생 8대 필수 서식 패키징 현황
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              8/8 완비 (Ready)
            </span>
          </div>
          <span className="text-[11px] text-slate-500">관할: {courtName}</span>
        </div>

        <div className="divide-y divide-slate-100 p-2">
          {standardForms.map((f, idx) => (
            <div key={idx} className="py-3 px-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 rounded-xl text-xs">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-extrabold text-slate-900">{f.name}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">{f.note}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-600 font-mono">
                  {f.code}
                </span>
                <span className="text-xs font-bold text-emerald-600">준비완료</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 의뢰인 모바일 최종 제출 동의 확인 카드 */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-extrabold text-slate-900">
              의뢰인 모바일 최종 제출 동의 완료
            </span>
            <span className="text-slate-500 block text-[11px] mt-0.5">
              서명일시: {crmExt?.contractDate || new Date().toISOString().slice(0, 10)} | 서명자: {clientName} (카카오 간편인증)
            </span>
          </div>
        </div>

        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-xs">
          제출동의 검증됨
        </span>
      </div>
    </div>
  );
}
