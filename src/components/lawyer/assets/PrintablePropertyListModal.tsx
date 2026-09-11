import React, { useRef } from 'react';
import { 
  Printer, Download, X, CheckCircle2, Scale, 
  Building2, Car, Shield, Briefcase, DollarSign, Home, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import type { PropertyListD5102Data } from '../../../types/propertyTypes';

interface PrintablePropertyListModalProps {
  data: PropertyListD5102Data;
  isOpen: boolean;
  onClose: () => void;
  onAttachToPackage?: () => void;
}

export default function PrintablePropertyListModal({
  data,
  isOpen,
  onClose,
  onAttachToPackage
}: PrintablePropertyListModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
    toast.info('인쇄 창에서 대상 프린터를 [PDF로 저장]으로 선택하시면 대법원 표준 D5102 서식 PDF가 저장됩니다.');
  };

  const won = (n: number) => (n || 0).toLocaleString();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* 상단 컨트롤 바 (화면 전용, 인쇄 시 숨김) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  대법원 표준 [전산양식 D5102] 개인회생 재산목록
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  법정 필수 서식
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                신청인: <strong className="text-white">{data.clientName}</strong> · 작성기준일: {data.baseDate} · 총 청산가치: <strong className="text-emerald-400">{won(data.totalLiquidationValue)}원</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onAttachToPackage && (
              <button
                onClick={onAttachToPackage}
                className="px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 rounded-xl hover:bg-emerald-900 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
                title="전자소송 14종 패키지의 R06 슬롯에 완성본 첨부"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>전자소송 R06 연결</span>
              </button>
            )}
            <button
              onClick={handleDownloadPdf}
              className="px-3.5 py-2 text-xs font-bold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF 저장</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>A4 즉시 인쇄</span>
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
          {/* 양식 식별 헤더 */}
          <div className="flex justify-between items-start text-[11px] text-slate-500 font-sans mb-4 border-b border-slate-300 pb-2">
            <span>[전산양식 D5102]</span>
            <span>개인회생절차 개시신청서 첨부서면 (법 제589조 제2항 제2호)</span>
          </div>

          {/* 제목 */}
          <div className="text-center my-6">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-slate-900 border-b-2 border-slate-900 pb-3 inline-block px-12">
              재  산  목  록
            </h1>
          </div>

          {/* 사건 정보 */}
          <div className="grid grid-cols-2 gap-4 font-sans text-xs mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="font-bold text-slate-700">사 건 : </span>
              <span>2026개회_______ 개인회생</span>
            </div>
            <div>
              <span className="font-bold text-slate-700">신청인(채무자) : </span>
              <span className="font-bold text-slate-900">{data.clientName}</span>
            </div>
          </div>

          <p className="text-xs text-slate-600 mb-6 font-sans">
            채무자 회생 및 파산에 관한 법률 제589조 제2항 제2호에 따라 신청인의 재산 목록을 아래와 같이 작성하여 제출합니다.
          </p>

          {/* 1. 현금 및 예금 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 font-sans flex items-center gap-1.5 border-b border-slate-300 pb-1">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">1·2</span>
              현금 및 예금 (압류금지 250만 원 한도 공제)
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-center font-sans text-[11px]">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 py-1.5 px-2 w-10">번호</th>
                  <th className="border border-slate-300 py-1.5 px-2">금융기관명</th>
                  <th className="border border-slate-300 py-1.5 px-2">계좌번호 / 종류</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">현재 잔액 (원)</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">압류금지공제 (원)</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28 bg-emerald-50">청산가치 (원)</th>
                </tr>
              </thead>
              <tbody>
                {data.financialAssets.filter(fa => fa.category === 'deposit' || fa.category === 'cash').length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-slate-300 py-2 text-slate-400">해당사항 없음</td>
                  </tr>
                ) : (
                  data.financialAssets.filter(fa => fa.category === 'deposit' || fa.category === 'cash').map((fa, idx) => (
                    <tr key={fa.id}>
                      <td className="border border-slate-300 py-1.5">{idx + 1}</td>
                      <td className="border border-slate-300 py-1.5">{fa.institutionName}</td>
                      <td className="border border-slate-300 py-1.5 text-left px-2">{fa.description}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2">{won(fa.marketValue)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-slate-500">-{won(fa.statutoryDeduction)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(fa.liquidationValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 3. 보험 해약환급금 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 font-sans flex items-center gap-1.5 border-b border-slate-300 pb-1">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">3</span>
              보험계약 해약환급금 (보장성 150만 원 한도 공제)
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-center font-sans text-[11px]">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 py-1.5 px-2 w-10">번호</th>
                  <th className="border border-slate-300 py-1.5 px-2">보험회사명</th>
                  <th className="border border-slate-300 py-1.5 px-2">보험상품명 (증권번호)</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24">예상해약환급금</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-20">약관대출</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24">압류금지공제</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24 bg-emerald-50">청산가치</th>
                </tr>
              </thead>
              <tbody>
                {data.insurances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-300 py-2 text-slate-400">해당사항 없음</td>
                  </tr>
                ) : (
                  data.insurances.map((ins, idx) => (
                    <tr key={ins.id}>
                      <td className="border border-slate-300 py-1.5">{idx + 1}</td>
                      <td className="border border-slate-300 py-1.5">{ins.companyName}</td>
                      <td className="border border-slate-300 py-1.5 text-left px-2">{ins.policyName} {ins.policyNumber && `(${ins.policyNumber})`}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2">{won(ins.surrenderValue)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-rose-600">-{won(ins.policyLoanBalance)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-slate-500">-{won(ins.statutoryDeduction)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(ins.liquidationValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 4. 자동차 및 이륜차 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 font-sans flex items-center gap-1.5 border-b border-slate-300 pb-1">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">4</span>
              자동차 및 이륜차 (보험개발원 가액 / 엔카·KB차차차 시세 기준)
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-center font-sans text-[11px]">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 py-1.5 px-2 w-10">번호</th>
                  <th className="border border-slate-300 py-1.5 px-2">차종 / 모델명</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">차량등록번호</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-16">연식</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">중고시세/평가액</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24">할부/저당채무</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24 bg-emerald-50">청산가치</th>
                </tr>
              </thead>
              <tbody>
                {data.vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border border-slate-300 py-2 text-slate-400">해당사항 없음</td>
                  </tr>
                ) : (
                  data.vehicles.map((v, idx) => (
                    <tr key={v.id}>
                      <td className="border border-slate-300 py-1.5">{idx + 1}</td>
                      <td className="border border-slate-300 py-1.5 text-left px-2 font-medium">{v.modelName}</td>
                      <td className="border border-slate-300 py-1.5">{v.plateNumber || '미기재'}</td>
                      <td className="border border-slate-300 py-1.5">{v.year}년</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2">{won(v.marketValue)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-rose-600">-{won(v.loanBalance)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(v.liquidationValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 5. 임차보증금 */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 font-sans flex items-center gap-1.5 border-b border-slate-300 pb-1">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">5</span>
              임차보증금 반환채권 (2026 주택임대차 소액보증금 공제 적용)
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-center font-sans text-[11px]">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 py-1.5 px-2 w-10">번호</th>
                  <th className="border border-slate-300 py-1.5 px-2">임차 주택 소재지</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">계약 보증금</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-20">연체/대출</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24">소액보증금공제</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24 bg-emerald-50">청산가치</th>
                </tr>
              </thead>
              <tbody>
                {data.leaseDeposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-slate-300 py-2 text-slate-400">해당사항 없음</td>
                  </tr>
                ) : (
                  data.leaseDeposits.map((ld, idx) => (
                    <tr key={ld.id}>
                      <td className="border border-slate-300 py-1.5">{idx + 1}</td>
                      <td className="border border-slate-300 py-1.5 text-left px-2">{ld.address}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2">{won(ld.depositAmount)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-rose-600">-{won((ld.unpaidRent || 0) + (ld.pledgeLoanAmount || 0))}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-slate-500">-{won(ld.statutoryExemption)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(ld.liquidationValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 6. 부동산 (토지 및 건물) */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-2 font-sans flex items-center gap-1.5 border-b border-slate-300 pb-1">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">6</span>
              부동산 (KB시세 일반가 또는 공시가격의 130% 기준)
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-center font-sans text-[11px]">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 py-1.5 px-2 w-10">번호</th>
                  <th className="border border-slate-300 py-1.5 px-2">부동산 표시 (소재지 및 면적)</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-20">평가기준</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">시가/평가액</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24">담보대출(근저당)</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-24 bg-emerald-50">청산가치</th>
                </tr>
              </thead>
              <tbody>
                {data.realEstates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-slate-300 py-2 text-slate-400">해당사항 없음</td>
                  </tr>
                ) : (
                  data.realEstates.map((re, idx) => (
                    <tr key={re.id}>
                      <td className="border border-slate-300 py-1.5">{idx + 1}</td>
                      <td className="border border-slate-300 py-1.5 text-left px-2">
                        <div className="font-medium">{re.address} {re.detailAddress}</div>
                        {re.areaSquareMeter && <div className="text-[10px] text-slate-500">면적: {re.areaSquareMeter}㎡</div>}
                      </td>
                      <td className="border border-slate-300 py-1.5 text-[10px]">
                        {re.valuationMethod === 'public_price_130' ? '공시가 130%' : (re.valuationMethod === 'kb_general' ? 'KB시세' : '실거래가')}
                      </td>
                      <td className="border border-slate-300 py-1.5 text-right px-2">{won(re.marketValue)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 text-rose-600">-{won(re.mortgageBalance)}</td>
                      <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(re.liquidationValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 9. 예상퇴직금 & 10. 기타 자산 */}
          <div className="mb-8">
            <h3 className="text-sm font-bold text-slate-900 mb-2 font-sans flex items-center gap-1.5 border-b border-slate-300 pb-1">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">9·10</span>
              예상퇴직금 (퇴직연금 0원 / 일반 50% 반영) 및 주식·기타
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-center font-sans text-[11px]">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="border border-slate-300 py-1.5 px-2 w-10">번호</th>
                  <th className="border border-slate-300 py-1.5 px-2">자산 분류 / 재직처</th>
                  <th className="border border-slate-300 py-1.5 px-2">세부 내역</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">총 평가액</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28">법정 공제액</th>
                  <th className="border border-slate-300 py-1.5 px-2 w-28 bg-emerald-50">청산가치</th>
                </tr>
              </thead>
              <tbody>
                {data.severances.length === 0 && data.financialAssets.filter(fa => fa.category !== 'deposit' && fa.category !== 'cash').length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border border-slate-300 py-2 text-slate-400">해당사항 없음</td>
                  </tr>
                ) : (
                  <>
                    {data.severances.map((sev, idx) => (
                      <tr key={sev.id}>
                        <td className="border border-slate-300 py-1.5">{idx + 1}</td>
                        <td className="border border-slate-300 py-1.5 font-medium">{sev.workplaceName} (퇴직금)</td>
                        <td className="border border-slate-300 py-1.5 text-left px-2">
                          {sev.isRetirementPension ? '퇴직연금(DB/DC/IRP) 압류금지 전액 면제' : '일반퇴직금 50% 공제 반영'}
                        </td>
                        <td className="border border-slate-300 py-1.5 text-right px-2">{won(sev.expectedAmount)}</td>
                        <td className="border border-slate-300 py-1.5 text-right px-2 text-slate-500">-{won(sev.statutoryDeduction)}</td>
                        <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(sev.liquidationValue)}</td>
                      </tr>
                    ))}
                    {data.financialAssets.filter(fa => fa.category !== 'deposit' && fa.category !== 'cash').map((fa, idx) => (
                      <tr key={fa.id}>
                        <td className="border border-slate-300 py-1.5">{data.severances.length + idx + 1}</td>
                        <td className="border border-slate-300 py-1.5">{fa.institutionName} ({fa.category})</td>
                        <td className="border border-slate-300 py-1.5 text-left px-2">{fa.description}</td>
                        <td className="border border-slate-300 py-1.5 text-right px-2">{won(fa.marketValue)}</td>
                        <td className="border border-slate-300 py-1.5 text-right px-2 text-slate-500">-{won(fa.statutoryDeduction)}</td>
                        <td className="border border-slate-300 py-1.5 text-right px-2 font-bold text-emerald-700 bg-emerald-50/50">{won(fa.liquidationValue)}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* 총괄 집계표 (핵심 요약) */}
          <div className="mb-10 p-4 bg-slate-100 rounded-xl border border-slate-300 font-sans">
            <h4 className="text-xs font-bold text-slate-800 mb-3 flex items-center justify-between">
              <span>■ 총 괄 표 (청산가치 산출 집계)</span>
              <span className="text-[11px] text-slate-500">단위: 원</span>
            </h4>
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">① 자산 총 평가액</div>
                <div className="text-sm font-bold text-slate-900 mt-1">{won(data.totalMarketValue)}원</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[11px] text-rose-600">② 담보채무 공제액</div>
                <div className="text-sm font-bold text-rose-700 mt-1">-{won(data.totalEncumbrance)}원</div>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-600">③ 법정 면제/공제액</div>
                <div className="text-sm font-bold text-slate-700 mt-1">-{won(data.totalStatutoryDeduction)}원</div>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-lg border-2 border-emerald-500">
                <div className="text-[11px] font-bold text-emerald-800">④ 최종 청산가치 (J)</div>
                <div className="text-base font-black text-emerald-700 mt-0.5">{won(data.totalLiquidationValue)}원</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2.5 text-right">
              * 청산가치 보장의 원칙: 개인회생 총 변제예정액의 현재가치는 위 최종 청산가치({won(data.totalLiquidationValue)}원) 이상이어야 합니다.
            </p>
          </div>

          {/* 법정 서약 및 서명란 */}
          <div className="mt-10 pt-6 border-t border-slate-300 text-center font-serif text-xs">
            <p className="mb-4 tracking-wide font-medium text-slate-800">
              위 기재 내용은 사실과 틀림없으며, 고의로 재산을 은닉하거나 누락한 사실이 없음을 서약합니다.
            </p>
            <div className="my-6 text-sm font-bold text-slate-700">
              {data.baseDate.slice(0, 4)}년 {data.baseDate.slice(5, 7)}월 {data.baseDate.slice(8, 10)}일
            </div>
            <div className="flex justify-end items-center gap-6 pr-10 text-sm">
              <span>신청인(채무자) : </span>
              <span className="font-bold text-slate-900 min-w-[80px] text-left">{data.clientName}</span>
              <span className="text-slate-400 text-xs border border-dashed border-slate-400 px-3 py-1 rounded">
                (서명 또는 날인)
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
