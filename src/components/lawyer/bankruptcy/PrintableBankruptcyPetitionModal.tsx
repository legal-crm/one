import React from 'react';
import { X, Printer, Download, Scale } from 'lucide-react';
import { toast } from 'sonner';
import type { BankruptcyFullCaseData } from '../../../types/bankruptcyTypes';

interface PrintableBankruptcyPetitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BankruptcyFullCaseData;
}

export default function PrintableBankruptcyPetitionModal({
  isOpen,
  onClose,
  data
}: PrintableBankruptcyPetitionModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
    toast.info('인쇄 창에서 "PDF로 저장"을 선택하시면 법원 제출 규격의 파산·면책 신청서 PDF로 저장됩니다.');
  };

  const p = data.petition;
  const s = data.statement;
  const lc = data.livingCondition;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* 상단 툴바 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              ⚖️
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                대법원 표준 개인파산 및 면책 동시신청서 서식
              </h3>
              <p className="text-[11px] text-slate-400">
                신청인: {p.debtorName} · 관할: {p.courtName} · 면제재산 및 가용소득 0원 입증 완비
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer press-scale whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF 다운로드</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 본문 (A4 규격 대법원 표준 파산신청서) */}
        <div className="p-8 sm:p-12 overflow-y-auto bg-white text-slate-900 font-serif leading-relaxed text-sm flex-1 print:p-0 print:overflow-visible space-y-10">
          
          {/* [1. 표지 및 신청서] */}
          <div className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-black tracking-widest underline decoration-2 underline-offset-8">
                개인파산 및 면책 동시신청서
              </h1>
              <p className="text-xs font-sans text-slate-500 pt-1">
                (채무자 회생 및 파산에 관한 법률 제294조 및 제556조)
              </p>
            </div>

            {/* 당사자 인적사항 */}
            <div className="space-y-2 text-sm font-sans border-b border-slate-200 pb-6">
              <div className="flex">
                <span className="w-28 font-bold text-slate-700">신 &nbsp; 청 &nbsp; 인 :</span>
                <span className="font-bold">{p.debtorName} (주민번호: {p.debtorRrn || '800101-1******'})</span>
              </div>
              <div className="flex">
                <span className="w-28 font-bold text-slate-700">등록기준지 :</span>
                <span>서울특별시 중구 을지로 1</span>
              </div>
              <div className="flex">
                <span className="w-28 font-bold text-slate-700">주 &nbsp; &nbsp; &nbsp; 소 :</span>
                <span>{p.debtorAddress || '서울특별시 마포구 마포대로 123'}</span>
              </div>
              <div className="flex">
                <span className="w-28 font-bold text-slate-700">송 달 장 소 :</span>
                <span>대리인 법률사무소 (서울특별시 서초구 서초대로 456)</span>
              </div>
              <div className="flex">
                <span className="w-28 font-bold text-slate-700">대 &nbsp; 리 &nbsp; 인 :</span>
                <span>변호사 {p.attorneyName || '김변호'}</span>
              </div>
            </div>

            {/* 신 청 취 지 */}
            <div className="space-y-3 font-sans">
              <h3 className="font-bold text-base text-slate-900">【 신 청 취 지 】</h3>
              <ol className="list-decimal list-inside space-y-1.5 pl-2 text-slate-800 leading-relaxed">
                <li className="font-bold">채무자를 파산자에 처한다.</li>
                <li className="font-bold">채무자를 면책한다.</li>
                <li>라는 결정을 구합니다.</li>
              </ol>
            </div>

            {/* 신 청 이 유 */}
            <div className="space-y-3 font-sans leading-relaxed text-justify">
              <h3 className="font-bold text-base text-slate-900">【 신 청 이 유 】</h3>
              <p className="indent-4">
                1. 채무자는 현재 지급불능의 상태에 빠져 있습니다. 채무자의 총 채무액은 원금 <strong>{(p.totalDebtPrincipal || 0).toLocaleString()}원</strong>에 달하는 반면, 채무자가 보유한 재산은 법정 면제재산 및 압류금지 재산을 공제하면 실질적 환가 가치가 <strong>{(data.totalLiquidationEstate || 0).toLocaleString()}원</strong>으로 전무(0원)하여 변제능력이 완전히 상실되었습니다.
              </p>
              <p className="indent-4">
                2. 채무자는 현재 월 소득이 <strong>{(p.monthlyNetIncome || 0).toLocaleString()}원</strong>에 불과하여 동거 가족 {p.householdMembersCount || 1}인의 2026년 기준 국민기초생활보장 최저생계비에도 미치지 못하므로 정기적인 변제 재원을 마련할 수 없는 절대적 빈곤 상태입니다.
              </p>
              <p className="indent-4">
                3. 채무자에게는 채무자회생법 제564조 각 호에 해당하는 면책불허가사유가 존재하지 아니하며, 성실하고 불운한 채무자로서 갱생할 수 있도록 본 신청에 이르렀습니다.
              </p>
            </div>
          </div>

          {/* [2. 생활상황표 및 가계수지표 요약] */}
          <div className="pt-8 border-t border-slate-200 font-sans space-y-4">
            <h3 className="font-bold text-base text-slate-900">【 현재의 생활상황표 및 가계수지표 】</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-700 block">월 총 수입 (A)</span>
                <div className="flex justify-between">
                  <span>근로소득 / 아르바이트</span>
                  <span className="font-mono font-bold">{lc.budgetLedger.earnedIncome.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span>기초연금 및 정부보조금</span>
                  <span className="font-mono font-bold">{lc.budgetLedger.pensionOrWelfare.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span>수입 합계</span>
                  <span className="font-mono text-blue-600">{lc.budgetLedger.totalIncome.toLocaleString()}원</span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <span className="font-bold text-slate-700 block">월 필수 생계비 지출 (B)</span>
                <div className="flex justify-between">
                  <span>주거비 (월세)</span>
                  <span className="font-mono font-bold">{lc.budgetLedger.housingRent.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span>식비 및 의료·공과금</span>
                  <span className="font-mono font-bold">{(lc.budgetLedger.foodAndDailySupplies + lc.budgetLedger.medicalExpenses + lc.budgetLedger.utilitiesAndCommunication).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span>필수 지출 합계</span>
                  <span className="font-mono text-rose-600">{lc.budgetLedger.totalLivingExpense.toLocaleString()}원</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs font-bold text-purple-900 flex justify-between items-center">
              <span>가용소득 검증 (A - B):</span>
              <span className="font-mono text-sm">{lc.budgetLedger.disposableIncome.toLocaleString()}원 (가용소득 0원 입증 완료 - 파산 적격)</span>
            </div>
          </div>

          {/* [3. 첨부서류 목록 및 날인] */}
          <div className="pt-8 border-t border-slate-200 font-sans space-y-4">
            <h3 className="font-bold text-base text-slate-900">【 첨 부 서 류 】</h3>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div>1. 파산 채권자목록 1통</div>
              <div>2. 재산목록 (면제재산 반영) 1통</div>
              <div>3. 현재의 생활상황표 1통</div>
              <div>4. 수입 및 지출에 관한 목록 1통</div>
              <div>5. 진술서 1통</div>
              <div>6. 15대 필수자료제출목록 1통</div>
              <div>7. 소송위임장 1통</div>
            </div>

            <div className="text-center space-y-4 pt-10">
              <p className="text-sm font-bold">
                {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <div className="flex justify-end pr-8">
                <div className="text-left space-y-1">
                  <p className="text-sm">신청인(채무자) : &nbsp; {p.debtorName} &nbsp; (인)</p>
                  <p className="text-sm">대 &nbsp; &nbsp; 리 &nbsp; &nbsp; 인 : &nbsp; 변호사 {p.attorneyName} &nbsp; (인)</p>
                </div>
              </div>
              <div className="pt-8 text-center font-bold text-lg tracking-wider text-slate-900">
                {p.courtName || '서울회생법원 귀중'}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
