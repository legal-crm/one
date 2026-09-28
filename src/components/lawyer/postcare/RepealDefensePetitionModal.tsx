import React, { useState } from 'react';
import { 
  X, Printer, Download, Copy, Check, FileText, 
  Landmark, ShieldAlert, Sparkles, Scale, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { RepealDefensePetitionType } from '../../../types/courtPetitionTypes';
import ModalPortal from '../../common/ModalPortal';
import { escapeHtml } from '../../../services/court/CourtFormHtmlBuilder';

interface RepealDefensePetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  petitionType: RepealDefensePetitionType;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyerName?: string;
  overdueCount?: number;
  totalOverdueAmount?: number;
}

function RepealDefensePetitionModalInner({
  isOpen,
  onClose,
  petitionType,
  clientRequest,
  crmExt,
  activeLawyerName = '',
  overdueCount = 0,
  totalOverdueAmount = 0
}: RepealDefensePetitionModalProps) {

  // ⚠️ 서면 초안 원칙: 사실관계는 지어내지 않는다. [대괄호]는 증빙을 보고 담당자가 채울 빈칸이다.
  // (이전: '암 진단·입원', '청산가치 1,500만 원 / 기납부 1,920만 원', '지인·친족 지원으로 완납', '가족 의료비', 소득 추산식,
  //  '서울회생법원'·'2026개회 (접수 준비중)'·'서울특별시'·'김변호' 기본값을 넣어 그대로 제출될 위험)
  const [copied, setCopied] = useState(false);
  const BL = '[          ]';
  const clientName = clientRequest.clientName || BL;
  const cc: any = crmExt.courtCase || {};
  const courtName = cc.courtName || crmExt.decisionSummary?.courtName || clientRequest.court || '';
  const courtLabel = courtName || '[관할 법원]';
  const caseNumber = cc.caseNumber || crmExt.decisionSummary?.caseNumber || (clientRequest as any).caseNumber || BL;
  const monthlyPayment = Math.round(crmExt.repaymentPlan?.monthlyRepaymentTotal || 0);
  const won = (n: number) => (n > 0 ? `${Math.round(n).toLocaleString()}원` : '[금액]원');
  const address = (clientRequest as any).address || BL;
  const lawyer = activeLawyerName || BL;
  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. 변제계획 변경신청서 초안 (채무자회생법 제619조)
  const planModDraft = `[변제계획 변경신청서]

사   건 : ${caseNumber} 개인회생
신 청 인(채무자) : ${clientName}
주   소 : ${address}
연 락 처 : ${clientRequest.phone || BL}
대 리 인 : 변호사 ${lawyer}

신  청  취  지

신청인에 대하여 ${courtLabel}이 인가한 변제계획을 별지 '변경 변제계획안'과 같이 변경한다.
라는 결정을 구합니다.

신  청  이  유

1. 변제계획 인가의 경위
신청인은 [인가결정일] 변제계획인가결정을 받고, 인가된 계획에 따라 월 ${won(monthlyPayment)}씩 변제금을 납부하여 왔습니다. (현재까지 [  ]회 납부)

2. 사정변경의 발생 (채무자회생법 제619조)
신청인에게 [사정변경 내용 — 예: 급여 삭감 / 권고사직 / 폐업 / 질병 등, 발생 일자]이 생겨 기존 변제계획을 그대로 수행하기 어렵게 되었습니다.
- 인가 당시 월 소득: [금액]원
- 현재 월 소득: [금액]원 (증빙: [급여명세서 등])

3. 변경 변제계획안의 내용 및 타당성
변경안은 월 변제금을 ${won(monthlyPayment)}에서 [금액]원으로 조정하고 [변제기간 조정 내용]합니다. 변경 후에도 청산가치 보장 원칙을 충족합니다(청산가치 [금액]원, 변경안 총변제액의 현재가치 [금액]원). 변제기간은 법이 정한 상한(제611조 제5항)을 넘지 않습니다.

4. 결 어
따라서 채무자 회생 및 파산에 관한 법률 제619조에 따라 변제계획의 변경을 신청합니다.

첨  부  서  류
1. 소득 변동 소명자료 [ ]부
2. 변경 변제계획안 1부
3. 수입 및 지출에 관한 목록 1부

${todayStr}

위 신청인(채무자) : ${clientName} (인)
신청인의 대리인 변호사 : ${lawyer} (인)

${courtLabel} 귀중`;

  // 2. 특별면책 신청서 초안 (채무자회생법 제624조 제2항)
  const specialDischargeDraft = `[면책신청서 (채무자회생법 제624조 제2항)]

사   건 : ${caseNumber} 개인회생
신 청 인(채무자) : ${clientName}
주   소 : ${address}
연 락 처 : ${clientRequest.phone || BL}
대 리 인 : 변호사 ${lawyer}

신  청  취  지

채무자를 면책한다.
라는 결정을 구합니다.

신  청  이  유

1. 채무자 회생 및 파산에 관한 법률 제624조 제2항
법원은 채무자가 변제계획에 따른 변제를 완료하지 못한 경우에도 다음 요건이 모두 충족되는 때에는 이해관계인의 의견을 들은 후 면책의 결정을 할 수 있습니다.
① 채무자가 책임질 수 없는 사유로 인하여 변제를 완료하지 못하였을 것
② 개인회생채권자가 면책결정일까지 변제받은 금액이 채무자가 파산절차를 신청한 경우 파산절차에서 배당받을 금액보다 적지 아니할 것
③ 변제계획의 변경이 불가능할 것

2. 각 요건의 소명
가. 책임질 수 없는 사유 (제1호)
[사유와 발생 경위 — 예: 진단명·진단일, 근로 불능 기간 등. 증빙 기재]

나. 변제받은 금액 (제2호)
인가 당시 청산가치는 [금액]원이고, 신청인이 현재까지 변제한 총액은 [금액]원입니다(변제금 납부확인서 참조).

다. 변제계획 변경의 불가능 (제3호)
[변경이 불가능한 사정 — 예: 향후 소득 전망 등]

3. 결 어
위와 같이 제624조 제2항의 요건을 갖추었으므로 면책결정을 하여 주시기 바랍니다. (면책되지 않는 채권은 제625조 제2항에 따릅니다)

첨  부  서  류
1. [사유 소명자료 — 진단서 등] 1부
2. 변제금 납부확인서 1부
3. [기타 소명자료]

${todayStr}

위 신청인(채무자) : ${clientName} (인)
신청인의 대리인 변호사 : ${lawyer} (인)

${courtLabel} 귀중`;

  // 3. 개인회생절차 폐지결정에 대한 즉시항고장
  const immediateAppealDraft = `[즉시항고장]

사   건 : ${caseNumber} 개인회생
항 고 인(채무자) : ${clientName}
주   소 : ${address}
연 락 처 : ${clientRequest.phone || BL}
대 리 인 : 변호사 ${lawyer}

원 결 정 : ${courtLabel} [결정일자]자 개인회생절차폐지결정

항  고  취  지

원 결정을 취소한다.
라는 결정을 구합니다.

항  고  이  유

1. 즉시항고의 적법성
원 결정은 [공고일자]에 공고되었고, 항고인은 공고일부터 14일 이내(채무자회생법 제13조 제2항)에 이 즉시항고장을 제출합니다.

2. 원 결정의 경위
원심은 항고인이 변제금을 ${overdueCount > 0 ? `${overdueCount}회` : '[  ]회'} 납부하지 않았다는 등의 이유로 절차폐지결정을 하였습니다.

3. 원 결정을 취소하여야 할 사유
가. 미납 변제금의 납부: 항고인은 [납부일자]에 미납 변제금 ${won(totalOverdueAmount)}을 회생위원 계좌로 납부하였습니다(이체확인증 참조). [해당 없으면 삭제]
나. 미납 경위: [미납 사유와 경위]
다. 향후 변제계획 수행 가능성: [소득·지출 현황 및 수행 계획]

4. 결 어
따라서 원 결정을 취소하여 주시기 바랍니다.

첨  부  서  류
1. [변제금 납부확인서(이체확인증)] 1부
2. [수행 가능성 소명자료] 1부

${todayStr}

위 항고인(채무자) : ${clientName} (인)
항고인의 대리인 변호사 : ${lawyer} (인)

${courtLabel} 귀중`;

  const getDocTitle = () => {
    switch (petitionType) {
      case 'REPAYMENT_PLAN_MODIFICATION':
        return '변제계획 변경신청서 (채무자회생법 제619조)';
      case 'SPECIAL_DISCHARGE':
        return '특별면책 신청서 (채무자회생법 제624조 제2항)';
      case 'IMMEDIATE_APPEAL':
        return '개인회생절차 폐지결정에 대한 즉시항고장 (공고일부터 14일)';
      default:
        return '법원 서식';
    }
  };

  const getActiveDraft = () => {
    switch (petitionType) {
      case 'REPAYMENT_PLAN_MODIFICATION':
        return planModDraft;
      case 'SPECIAL_DISCHARGE':
        return specialDischargeDraft;
      case 'IMMEDIATE_APPEAL':
        return immediateAppealDraft;
      default:
        return planModDraft;
    }
  };

  const activeDraft = getActiveDraft();

  const hasBlanks = /\[[^\]]*\]/.test(activeDraft);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeDraft);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
      return;
    }
    setCopied(true);
    toast.success(hasBlanks
      ? '초안을 복사했습니다. [대괄호] 빈칸을 모두 채우고 사실관계를 확인한 뒤 제출하세요.'
      : '초안을 복사했습니다. 제출 전 내용을 다시 확인하세요.');
    setTimeout(() => setCopied(false), 2000);
  };

  // 문서만 A4로 인쇄 (이전: window.print()로 앱 화면 전체가 인쇄됨)
  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) { toast.error('팝업이 차단되어 인쇄 창을 열 수 없습니다.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(getDocTitle())}</title>
<style>@page{size:A4;margin:20mm}body{font-family:'Batang','Nanum Myeongjo',serif;font-size:12pt;line-height:1.8;color:#111}pre{white-space:pre-wrap;font-family:inherit;margin:0}</style>
</head><body><pre>${escapeHtml(activeDraft)}</pre><script>window.onload=function(){window.print();}</script></body></html>`);
    w.document.close();
  };

  const handleDownload = () => {
    const blob = new Blob([activeDraft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clientName}_${petitionType}_법원제출서식.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('초안 텍스트 파일을 내려받았습니다. [대괄호] 빈칸을 채운 뒤 사용하세요.');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden text-left">
        
        {/* 상단 툴바 */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  초안 · 빈칸 작성 필요
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {courtLabel} • 사건번호: {caseNumber}
                </span>
              </div>
              <h3 className="text-base md:text-lg font-black mt-0.5 text-white">
                {getDocTitle()}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '복사됨' : '전문 복사'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>다운로드</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 인쇄</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 본문 미리보기 (A4 용지 느낌) */}
        <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          <div className="bg-white shadow-xl rounded-xl border border-slate-200 p-8 md:p-12 w-full max-w-2xl font-serif text-slate-900 whitespace-pre-wrap leading-relaxed text-sm">
            {activeDraft}
          </div>
        </div>

        {/* 푸터 */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            신청인: <strong className="text-slate-800">{clientName}</strong> | 전담 변호사: <strong className="text-slate-800">{activeLawyerName}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
          >
            창 닫기
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

/** 닫힌 상태에서는 내부 훅을 실행하지 않도록 바깥에서 먼저 분기 (Rules of Hooks: 조건부 return을 훅보다 앞에 두지 않음) */
export default function RepealDefensePetitionModal(props: React.ComponentProps<typeof RepealDefensePetitionModalInner>) {
  if (!props.isOpen) return null;
  return <RepealDefensePetitionModalInner {...props} />;
}
