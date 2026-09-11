import React, { useState } from 'react';
import { 
  X, Printer, Download, Copy, Check, FileText, 
  Landmark, ShieldAlert, Sparkles, Scale, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension } from '../../../types';
import type { RepealDefensePetitionType } from '../../../types/courtPetitionTypes';

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

export default function RepealDefensePetitionModal({
  isOpen,
  onClose,
  petitionType,
  clientRequest,
  crmExt,
  activeLawyerName = '김변호',
  overdueCount = 3,
  totalOverdueAmount = 1440000
}: RepealDefensePetitionModalProps) {
  if (!isOpen) return null;

  const [copied, setCopied] = useState(false);
  const clientName = clientRequest.clientName || '신청인';
  const courtName = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const caseNumber = crmExt.courtCase?.caseNumber || '2026개회 108492호';
  const monthlyPayment = crmExt.repaymentPlan?.monthlyRepaymentTotal || 480000;
  const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. 변제계획 변경신청서 초안
  const planModDraft = `[변제계획 변경신청서]

사   건 : ${caseNumber} 개인회생
신 청 인(채무자) : ${clientName}
주   소 : ${clientRequest.region || '서울특별시'}
연 락 처 : ${clientRequest.phone || '010-0000-0000'}
대 리 인 : 변호사 ${activeLawyerName}

신  청  취  지

신청인에 대하여 ${courtName}이 인가한 변제계획을 별지 '수정 변제계획안'과 같이 변경한다.
라는 결정을 구합니다.

신  청  이  유

1. 변제계획 인가의 경위
신청인은 귀원으로부터 변제계획인가 결정을 받고 인가된 계획에 따라 월 ${monthlyPayment.toLocaleString()}원씩 성실히 변제금을 납부해 왔습니다.

2. 사정변경의 발생 (채무자회생법 제619조)
신청인은 최근 예상치 못한 급여 삭감(또는 권고사직·폐업·중증 질환 발생)으로 인하여 기존 월 소득이 현저히 감소하여, 기존의 변제계획을 그대로 수행하는 것이 불가능한 사정변경이 발생하였습니다.
- 기존 인정 소득: 월 ${(monthlyPayment + 1500000).toLocaleString()}원
- 현재 실수령 소득: 월 ${(monthlyPayment * 0.6 + 1300000).toLocaleString()}원 (급여 감소 및 고정 의료비 지출)

3. 변경 변제계획안의 타당성 (청산가치 보장의 원칙 충족)
신청인은 월 변제금을 기존 ${monthlyPayment.toLocaleString()}원에서 ${(monthlyPayment * 0.65).toLocaleString()}원으로 감액하고 변제기간을 연장하더라도, 본 사건 개시 당시 확정된 채무자의 청산가치를 여전히 충분히 초과하여 변제할 수 있으므로 채권자들의 이익을 침해하지 아니합니다.

4. 결 어
따라서 채무자회생 및 파산에 관한 법률 제619조에 의하여 변제계획의 변경을 신청하오니 인가하여 주시기 바랍니다.

첨  부  서  류
1. 소득감소 소명자료(원천징수영수증/급여명세서/퇴직증명서) 각 1부
2. 수정 변제계획안 1부
3. 수입 및 지출에 관한 목록 1부

${todayStr}

위 신청인(채무자) : ${clientName} (인)
신청인의 대리인 변호사 : ${activeLawyerName} (인)

${courtName} 귀중`;

  // 2. 특별면책 신청서 초안 (채무자회생법 제624조 제2항)
  const specialDischargeDraft = `[특별면책 신청서]

사   건 : ${caseNumber} 개인회생
신 청 인(채무자) : ${clientName}
주   소 : ${clientRequest.region || '서울특별시'}
연 락 처 : ${clientRequest.phone || '010-0000-0000'}
대 리 인 : 변호사 ${activeLawyerName}

신  청  취  지

채무자를 면책한다.
라는 결정을 구합니다.

신  청  이  유

1. 채무자회생 및 파산에 관한 법률 제624조 제2항의 규정
법원은 채무자가 변제계획에 따른 변제를 완료하지 못하였다 하더라도, 다음 각호의 요건이 모두 충족되는 때에는 이해관계인의 의견을 들은 후 면책의 결정을 할 수 있습니다.
① 채무자가 책임질 수 없는 사유로 인하여 변제를 완료하지 못하였을 것
② 회생채권자가 변제계획에 따라 변제받은 총액이 파산절차를 통하여 배당받을 수 있었던 금액(청산가치)보다 적지 아니할 것
③ 변제계획의 변경이 불가능할 것

2. 각 요건의 구비 여부 소명
가. 채무자의 책임 없는 사유 (제1호)
신청인은 변제 수행 도중 중증 난치성 질환(암 진단 및 지속적 입원 치료)으로 인하여 경제활동을 영위할 수 있는 근로능력을 완전히 상실하여 변제를 지속할 수 없게 되었습니다.

나. 청산가치 보장 원칙 충족 (제2호)
본 사건 변제계획인가 당시 확정된 채무자의 청산가치(보유재산 평가액)는 약 1,500만 원이었던 반면, 신청인이 귀원 회생위원 가상계좌로 기납부한 누적 변제금 총액은 1,920만 원에 달하여 청산가치를 초과 변제 완료하였습니다.

다. 변제계획 변경의 불가능 (제3호)
신청인은 근로능력 완전 상실로 향후 추가적인 가용소득 창출이 불가능하므로 최저 생계비 수준의 소액 변제계획 변경조차 불가능한 상황입니다.

3. 결 어
위와 같이 법 제624조 제2항 각호의 요건을 모두 충족하였으므로, 채무자에게 면책 결정을 내려주시기 바랍니다.

첨  부  서  류
1. 진단서 및 의사소견서(근로능력 상실 확인) 1부
2. 법원 변제금 납부확인서(청산가치 초과 입증) 1부
3. 재산상태 진술서 1부

${todayStr}

위 신청인(채무자) : ${clientName} (인)
신청인의 대리인 변호사 : ${activeLawyerName} (인)

${courtName} 귀중`;

  // 3. 개인회생절차 폐지결정에 대한 즉시항고장
  const immediateAppealDraft = `[즉시항고장]

사   건 : ${caseNumber} 개인회생
항 고 인(채무자) : ${clientName}
주   소 : ${clientRequest.region || '서울특별시'}
연 락 처 : ${clientRequest.phone || '010-0000-0000'}
대 리 인 : 변호사 ${activeLawyerName}

원 결 정 : ${courtName} 2026. OO. OO.자 개인회생절차폐지결정

항  고  취  지

원 결정을 취소한다.
라는 결정을 구합니다.

항  고  이  유

1. 즉시항고의 적법성 (불변기간 준수)
원심 법원은 2026. OO. OO. 대법원 전자공고를 통하여 본 사건 개인회생절차 폐지 결정을 공고하였습니다. 항고인은 채무자회생법 제13조 제2항이 규정한 14일의 불변기간 내에 본 즉시항고장을 적법하게 제출합니다.

2. 원결정 취소의 정당성 (미납 변제금 전액 완납)
원심 법원은 항고인이 변제금을 ${overdueCount}회 연체하였다는 이유로 절차 폐지 결정을 내렸으나, 항고인은 폐지 공고 직후 지인 및 친족의 긴급 지원을 통하여 미납된 변제금 전액(금 ${totalOverdueAmount.toLocaleString()}원)을 귀원 회생위원 공식 가상계좌로 일시불 완납하였습니다(별첨 이체확인증 참조).

3. 회생절차 유지의 필요성
항고인은 성실하고 지속적인 갱생 의지를 가지고 있으며, 이번 일시적 연체는 가족의 긴급 의료비 지출로 인한 일시적 지연이었을 뿐 고의적인 납부 해태가 아닙니다. 미납 변제금 전액이 완전히 보전되었으므로 회생절차를 폐지할 실익이 소멸하였습니다.

4. 결 어
따라서 원 결정을 취소하고, 본 사건 개인회생절차를 원래대로 속행하여 주시기 바랍니다.

첨  부  서  류
1. 법원 가상계좌 변제금 전액 납부확인서(이체증) 1부
2. 납부 계획 소명서 1부

${todayStr}

위 항고인(채무자) : ${clientName} (인)
항고인의 대리인 변호사 : ${activeLawyerName} (인)

${courtName} 귀중`;

  const getDocTitle = () => {
    switch (petitionType) {
      case 'REPAYMENT_PLAN_MODIFICATION':
        return '변제계획 변경신청서 (채무자회생법 제619조)';
      case 'SPECIAL_DISCHARGE':
        return '특별면책 신청서 (채무자회생법 제624조 제2항)';
      case 'IMMEDIATE_APPEAL':
        return '개인회생절차 폐지결정에 대한 즉시항고장 (14일 골든타임)';
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

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDraft);
    setCopied(true);
    toast.success('📋 법원 제출용 서식 전문이 클립보드에 복사되었습니다. (전자소송 바로 붙여넣기 가능)');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const blob = new Blob([activeDraft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clientName}_${petitionType}_법원제출서식.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('📄 서식 텍스트 파일이 다운로드되었습니다.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-left">
        
        {/* 상단 툴바 */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  대법원 표준 서식 규격
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  {courtName} • 사건번호: {caseNumber}
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
  );
}
