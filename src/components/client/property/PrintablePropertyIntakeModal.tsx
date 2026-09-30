import React, { useRef } from 'react';
import { Printer, FileText } from 'lucide-react';
import type { PropertyListD5102Data } from '../../../types/propertyTypes';
import { Badge, Button, Modal } from '../ui';

interface PrintablePropertyIntakeModalProps {
  data: PropertyListD5102Data;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 재산목록(D5102 양식) 미리보기 — 작성 창 위에 뜨는 창(z-70)
 * 인쇄하면 [data-print-area] 종이 영역만 인쇄된다(index.css 인쇄 규칙)
 */
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
    <Modal
      open={isOpen}
      onClose={onClose}
      size="xl"
      mobile="fullscreen"
      zIndexClassName="z-[70]"
      icon={<FileText className="w-5 h-5" />}
      title="재산목록(D5102 양식) 미리보기"
      description="입력한 내용을 법원 양식 모양으로 보여 드려요. 법원 제출본은 담당 변호사가 검토해 확정합니다."
      meta={<Badge tone="neutral">의뢰인 작성본 · 기준일 {data.baseDate}</Badge>}
      closeLabel="미리보기 닫기"
      className="sm:h-[min(56rem,92dvh)] sm:max-h-[92dvh]"
      bodyClassName="bg-slate-100 px-3 py-4 sm:p-6"
      footerClassName="justify-between"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button onClick={handlePrint} leftIcon={<Printer className="w-4 h-4" aria-hidden="true" />}>
            인쇄 · PDF 저장
          </Button>
        </>
      }
    >
        {/* 문서 본문 영역 (A4 인쇄 규격) — 인쇄 시 이 영역만 출력 */}
        <div 
          ref={printRef}
          data-print-area=""
          className="mx-auto w-full max-w-[210mm] bg-white border border-slate-200 shadow-sm p-5 sm:p-10 text-slate-900 font-serif leading-relaxed text-xs print:p-0 print:text-[11px]"
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
                <span className="font-bold underline">(접수 후 기재)</span>
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
    </Modal>
  );
}
