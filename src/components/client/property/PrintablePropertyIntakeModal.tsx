import React, { useRef } from 'react';
import { 
  Printer, Download, X, CheckCircle2, Scale, 
  Building2, Car, Shield, Briefcase, DollarSign, Home, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import type { PropertyListD5102Data } from '../../../types/propertyTypes';

interface PrintablePropertyIntakeModalProps {
  data: PropertyListD5102Data;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrintablePropertyIntakeModal({
  data,
  isOpen,
  onClose
}: PrintablePropertyIntakeModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const won = (n: number) => (n || 0).toLocaleString();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* 상단 컨트롤 바 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  대법원 표준 [전산양식 D5102] 재산목록 미리보기
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  의뢰인 작성본
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{data.clientName}</strong> · 작성일자: {data.baseDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 인쇄 / PDF 저장</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 본문 영역 (A4 인쇄 규격) */}
        <div 
          ref={printRef}
          className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 font-serif leading-relaxed text-xs print:p-0 print:text-[11px] print:overflow-visible"
        >
          {/* 법원 표제부 */}
          <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
            <div className="text-[10px] text-slate-500 mb-1">대법원 회생·파산 전산양식 D5102</div>
            <h1 className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 mb-2">
              재 산 목 록
            </h1>
            <div className="flex justify-between items-end text-xs text-slate-700 mt-4 font-sans">
              <div>
                <span>사건번호: </span>
                <span className="font-bold underline">2026개회 (미정)</span>
              </div>
              <div>
                <span>신청인(채무자): </span>
                <span className="font-bold underline text-sm">{data.clientName}</span> (인)
              </div>
            </div>
          </div>

          {/* 총괄 요약 표 */}
          <div className="mb-6">
            <table className="w-full border-collapse border border-slate-900 text-center font-sans text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold border-b border-slate-900">
                  <th className="border border-slate-900 p-2">자산 평가 총액</th>
                  <th className="border border-slate-900 p-2 text-rose-700">담보 채무 총액 (-)</th>
                  <th className="border border-slate-900 p-2 text-slate-600">법정 공제액 (-)</th>
                  <th className="border border-slate-900 p-2 bg-indigo-50 text-indigo-950">산정 청산가치 (J)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-bold text-sm">
                  <td className="border border-slate-900 p-2.5">{won(data.totalMarketValue)}원</td>
                  <td className="border border-slate-900 p-2.5 text-rose-700">-{won(data.totalEncumbrance)}원</td>
                  <td className="border border-slate-900 p-2.5 text-slate-600">-{won(data.totalStatutoryDeduction)}원</td>
                  <td className="border border-slate-900 p-2.5 bg-indigo-50 text-indigo-900 text-base">{won(data.totalLiquidationValue)}원</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 1. 예금 및 현금 */}
          <div className="mb-5">
            <h3 className="font-bold text-xs mb-1.5 flex items-center gap-1.5">
              <span>1. 현금 및 예금 (어카운트인포 내역 기반)</span>
            </h3>
            <table className="w-full border-collapse border border-slate-400 text-center text-[11px] font-sans">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-400">
                  <th className="border border-slate-400 p-1.5 w-10">번호</th>
                  <th className="border border-slate-400 p-1.5">금융기관명</th>
                  <th className="border border-slate-400 p-1.5">계좌구분/비고</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2">현재 잔액</th>
                </tr>
              </thead>
              <tbody>
                {data.financialAssets.filter(f => f.category === 'deposit').length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-slate-400 p-2 text-slate-400">해당 없음</td>
                  </tr>
                ) : (
                  data.financialAssets.filter(f => f.category === 'deposit').map((fa, i) => (
                    <tr key={fa.id}>
                      <td className="border border-slate-400 p-1.5">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 font-bold">{fa.institutionName}</td>
                      <td className="border border-slate-400 p-1.5">{fa.description || '-'}</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2">{won(fa.marketValue)}원</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 2. 보험 해약환급금 */}
          <div className="mb-5">
            <h3 className="font-bold text-xs mb-1.5 flex items-center gap-1.5">
              <span>2. 보험 해약환급금</span>
            </h3>
            <table className="w-full border-collapse border border-slate-400 text-center text-[11px] font-sans">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-400">
                  <th className="border border-slate-400 p-1.5 w-10">번호</th>
                  <th className="border border-slate-400 p-1.5">보험회사</th>
                  <th className="border border-slate-400 p-1.5">상품명</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2">예상 해약환급금</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2">약관대출</th>
                </tr>
              </thead>
              <tbody>
                {data.insurances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-slate-400 p-2 text-slate-400">해당 없음</td>
                  </tr>
                ) : (
                  data.insurances.map((ins, i) => (
                    <tr key={ins.id}>
                      <td className="border border-slate-400 p-1.5">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 font-bold">{ins.companyName}</td>
                      <td className="border border-slate-400 p-1.5">{ins.policyName}</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2">{won(ins.surrenderValue)}원</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">-{won(ins.policyLoanBalance || 0)}원</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 3. 자동차 */}
          <div className="mb-5">
            <h3 className="font-bold text-xs mb-1.5 flex items-center gap-1.5">
              <span>3. 자동차 및 이륜차</span>
            </h3>
            <table className="w-full border-collapse border border-slate-400 text-center text-[11px] font-sans">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-400">
                  <th className="border border-slate-400 p-1.5 w-10">번호</th>
                  <th className="border border-slate-400 p-1.5">차종/연식</th>
                  <th className="border border-slate-400 p-1.5">차량번호</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2">현재 시세</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">할부/담보 잔액</th>
                </tr>
              </thead>
              <tbody>
                {data.vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border border-slate-400 p-2 text-slate-400">해당 없음</td>
                  </tr>
                ) : (
                  data.vehicles.map((v, i) => (
                    <tr key={v.id}>
                      <td className="border border-slate-400 p-1.5">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 font-bold">{v.modelName}</td>
                      <td className="border border-slate-400 p-1.5">{v.plateNumber}</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2">{won(v.marketValue)}원</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">-{won(v.loanBalance)}원</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 4. 임차보증금 */}
          <div className="mb-5">
            <h3 className="font-bold text-xs mb-1.5 flex items-center gap-1.5">
              <span>4. 임차보증금</span>
            </h3>
            <table className="w-full border-collapse border border-slate-400 text-center text-[11px] font-sans">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-400">
                  <th className="border border-slate-400 p-1.5 w-10">번호</th>
                  <th className="border border-slate-400 p-1.5">소재지</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2">보증금</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">연체차임/대출</th>
                </tr>
              </thead>
              <tbody>
                {data.leaseDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-slate-400 p-2 text-slate-400">해당 없음</td>
                  </tr>
                ) : (
                  data.leaseDeposits.map((ld, i) => (
                    <tr key={ld.id}>
                      <td className="border border-slate-400 p-1.5">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 text-left pl-2">{ld.address}</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 font-bold">{won(ld.depositAmount)}원</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">-{won((ld.unpaidRent || 0) + (ld.pledgeLoanAmount || 0))}원</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 5. 부동산 */}
          <div className="mb-5">
            <h3 className="font-bold text-xs mb-1.5 flex items-center gap-1.5">
              <span>5. 부동산 (토지 및 건물)</span>
            </h3>
            <table className="w-full border-collapse border border-slate-400 text-center text-[11px] font-sans">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-400">
                  <th className="border border-slate-400 p-1.5 w-10">번호</th>
                  <th className="border border-slate-400 p-1.5">종류 및 소재지</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2">산정 시세</th>
                  <th className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">근저당 피담보채무</th>
                </tr>
              </thead>
              <tbody>
                {data.realEstates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-slate-400 p-2 text-slate-400">해당 없음</td>
                  </tr>
                ) : (
                  data.realEstates.map((re, i) => (
                    <tr key={re.id}>
                      <td className="border border-slate-400 p-1.5">{i + 1}</td>
                      <td className="border border-slate-400 p-1.5 text-left pl-2">{re.address}</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 font-bold">{won(re.marketValue)}원</td>
                      <td className="border border-slate-400 p-1.5 text-right pr-2 text-rose-700">-{won(re.mortgageBalance)}원</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 법적 확인 문구 */}
          <div className="text-center mt-10 text-[11px] text-slate-600 font-sans border-t border-slate-300 pt-4">
            <p>위 재산목록 기초사실은 신청인이 사실대로 정확하게 기재하였음을 확인합니다.</p>
            <div className="mt-4 font-bold text-slate-800">
              작성일자: {data.baseDate} &nbsp;&nbsp;&nbsp;&nbsp; 신청인: {data.clientName} (인)
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
