import React, { useRef } from 'react';
import { X, Printer, Download, FileSpreadsheet, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { AuditTransactionItem } from '../../types/bankAuditTypes';
import { exportToCourtStandardExcel } from '../../services/bankAuditService';
import ModalPortal from './ModalPortal';

interface PrintableHighValueAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string;
  caseNumber?: string;
  courtName?: string;
  items: AuditTransactionItem[];
  thresholdAmount?: number;
  isClientView?: boolean;
}

export default function PrintableHighValueAuditModal({
  isOpen,
  onClose,
  clientName = '신청인',
  caseNumber = '2026개회 108492호',
  courtName = '서울회생법원',
  items,
  thresholdAmount = 1000000,
  isClientView = false
}: PrintableHighValueAuditModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const targetItems = items.filter(i => i.amount >= thresholdAmount);
  const totalAmount = targetItems.reduce((acc, curr) => acc + curr.amount, 0);
  const resolvedCount = targetItems.filter(i => i.explanation && i.explanation.trim().length > 0).length;
  const unresolvedCount = targetItems.length - resolvedCount;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportToCourtStandardExcel(items, {
      clientName,
      caseNumber,
      courtName,
      thresholdAmount
    });
  };

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
        
        {/* 모달 윈도우 */}
        <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:w-full">
          
          {/* 상단 툴바 (화면 전용, 인쇄 시 숨김) */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 rounded-t-2xl shrink-0 print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>법원 공식 [별지: 금융거래 100만 원 이상 사용처 소명서]</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold">
                    {targetItems.length}건 소명 대상
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isClientView 
                    ? '변호사에게 제출될 소명표 미리보기입니다. 인쇄하거나 PDF로 저장해 증빙 영수증을 체크해 보세요.' 
                    : '대한민국 법원 회생위원 보정권고 제출 규격에 맞춘 A4 가로 인쇄 및 엑셀 다운로드'}
                </p>
              </div>
            </div>

            {/* 버튼군 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>법원 양식 엑셀(.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer active:scale-[0.98]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>A4 인쇄 / PDF 저장</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-2 cursor-pointer"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 소명 미완료 경고 바 (인쇄 시 숨김) */}
          {unresolvedCount > 0 && (
            <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>주의:</strong> 아직 소명 내용이 작성되지 않은 거래가 <strong>{unresolvedCount}건</strong> 있습니다. 법원 제출 전 소명을 완료해 주세요.
                </span>
              </div>
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                작성률 {Math.round((resolvedCount / targetItems.length) * 100)}%
              </span>
            </div>
          )}

          {/* 인쇄 본문 뷰어 (스크롤 영역 / 인쇄 시 A4 전체 출력) */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-100 dark:bg-slate-950 print:bg-white print:p-0 print:overflow-visible">
            
            {/* A4 용지 스타일 컨테이너 */}
            <div 
              ref={printRef}
              id="court-audit-print-area"
              className="max-w-[1000px] mx-auto bg-white text-slate-900 p-8 sm:p-12 rounded-xl shadow-lg border border-slate-300 print:shadow-none print:border-none print:p-0 print:max-w-none print:m-0"
              style={{ fontFamily: "'Batang', 'Malgun Gothic', serif" }}
            >
              
              {/* 문서 제목 */}
              <div className="text-center mb-6">
                <div className="text-xs text-slate-500 tracking-wider mb-1 font-sans">[별지]</div>
                <h1 className="text-2xl font-bold text-slate-950 tracking-tight pb-2 border-b-2 border-slate-900 inline-block">
                  금융거래내역 중 100만 원 이상 출금 사용처 소명서
                </h1>
              </div>

              {/* 사건 기본정보 표 */}
              <div className="mb-4 text-[13px] leading-relaxed border-y border-slate-300 py-2.5 px-2 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2 font-sans">
                <div>
                  <span className="font-bold text-slate-800">사건번호 : </span>
                  <span className="text-slate-900 font-semibold">{caseNumber}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">관할법원 : </span>
                  <span className="text-slate-900">{courtName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">신청인(채무자) : </span>
                  <span className="text-slate-900 font-bold">{clientName}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-800">작성일자 : </span>
                  <span className="text-slate-900">{todayStr}</span>
                </div>
              </div>

              {/* 소명 취지 안내 */}
              <p className="text-[12px] text-slate-600 mb-4 leading-relaxed font-sans">
                ※ 대법원 개인회생·파산 실무준칙 및 회생위원 보정명령에 의거하여, 신청인의 최근 금융거래 중 1회 1,000,000원 이상 출금·결제된 주요 내역의 구체적 사용처 및 관련 증빙자료를 아래와 같이 상세히 소명합니다.
              </p>

              {/* 법원 표준 테이블 */}
              <div className="border border-slate-400 overflow-hidden mb-6">
                <table className="w-full text-left border-collapse text-[12px] font-sans">
                  <thead>
                    <tr className="bg-slate-200/90 text-slate-900 border-b border-slate-400 font-bold text-center">
                      <th className="py-2.5 px-2 border-r border-slate-400 w-10">연번</th>
                      <th className="py-2.5 px-2 border-r border-slate-400 w-24">거래일자</th>
                      <th className="py-2.5 px-2 border-r border-slate-400 w-36">금융기관 및 계좌</th>
                      <th className="py-2.5 px-2 border-r border-slate-400 w-16">구분</th>
                      <th className="py-2.5 px-2 border-r border-slate-400 w-28">출금액(원)</th>
                      <th className="py-2.5 px-2 border-r border-slate-400 w-36">거래상대방(적요)</th>
                      <th className="py-2.5 px-3 border-r border-slate-400">구체적 사용처 소명내용 (법원 제출용)</th>
                      <th className="py-2.5 px-2 border-r border-slate-400 w-24">소명자료</th>
                      <th className="py-2.5 px-2 w-24">입증방법</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {targetItems.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500 font-medium">
                          100만 원 이상 출금 거래 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      targetItems.map((item, idx) => {
                        const hasExpl = item.explanation && item.explanation.trim().length > 0;
                        const isEven = idx % 2 === 1;

                        return (
                          <tr 
                            key={item.id} 
                            className={`page-break-inside-avoid ${isEven ? 'bg-slate-50/50' : 'bg-white'} hover:bg-slate-50`}
                          >
                            {/* 연번 */}
                            <td className="py-2 px-1 text-center font-medium border-r border-slate-300 text-slate-700">
                              {idx + 1}
                            </td>
                            {/* 거래일자 */}
                            <td className="py-2 px-2 text-center whitespace-nowrap border-r border-slate-300 text-slate-800">
                              {item.date}
                            </td>
                            {/* 금융기관 */}
                            <td className="py-2 px-2 border-r border-slate-300 text-slate-800 font-medium break-keep">
                              {item.bankOrCard}
                            </td>
                            {/* 구분 */}
                            <td className="py-2 px-1 text-center border-r border-slate-300 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {item.transactionType === 'WITHDRAWAL' ? '출금' : 
                                 item.transactionType === 'CARD_PAYMENT' ? '카드결제' : 
                                 item.transactionType === 'ATM_CASH' ? 'ATM현금' : '입금'}
                              </span>
                            </td>
                            {/* 출금액 */}
                            <td className="py-2 px-2 text-right font-bold border-r border-slate-300 text-slate-950 whitespace-nowrap">
                              {item.amount.toLocaleString()}원
                            </td>
                            {/* 거래상대방 */}
                            <td className="py-2 px-2 border-r border-slate-300 text-slate-900 font-medium">
                              {item.counterparty}
                            </td>
                            {/* 사용처 소명내용 */}
                            <td className="py-2 px-3 border-r border-slate-300 text-slate-800 leading-snug">
                              {hasExpl ? (
                                <span>{item.explanation}</span>
                              ) : (
                                <span className="text-amber-700 italic font-medium">
                                  (소명 대기 - 일상 필수 생활비 및 공과금 충당)
                                </span>
                              )}
                            </td>
                            {/* 소명자료 */}
                            <td className="py-2 px-2 text-center border-r border-slate-300 text-slate-700 text-[11px]">
                              {item.evidenceType || '영수증/이체증'}
                            </td>
                            {/* 입증방법 (소갑호증) */}
                            <td className="py-2 px-2 text-center text-blue-700 font-bold text-[11px] whitespace-nowrap">
                              {item.evidenceDocIndex || `소갑 제3호증의 ${idx + 1}`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* 합계 행 */}
                  <tfoot>
                    <tr className="bg-slate-100/90 font-bold border-t-2 border-slate-400 text-slate-950">
                      <td colSpan={4} className="py-2.5 px-3 text-center border-r border-slate-400">
                        합 계 (총 {targetItems.length}건)
                      </td>
                      <td className="py-2.5 px-2 text-right text-indigo-900 font-extrabold border-r border-slate-400 whitespace-nowrap">
                        {totalAmount.toLocaleString()}원
                      </td>
                      <td colSpan={4} className="py-2.5 px-3 text-slate-600 text-[11px] font-medium text-center">
                        ※ 위 금융거래 출금액은 은닉 재산이 아니며, 채무자 생계 유지 및 타 부채 정상 변제에 전액 사용되었음을 확인합니다.
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 서약 및 서명 날인란 */}
              <div className="mt-8 pt-6 border-t border-slate-300 text-center space-y-4">
                <p className="text-[13px] text-slate-800 font-medium leading-relaxed">
                  위 기재 내용은 신청인이 본인의 금융거래 사실에 기초하여 성실하게 작성한 것으로서 모두 사실과 다름없으며, <br />
                  만일 허위 진술이나 재산 은닉 사실이 있을 경우 개인회생·파산 절차 기각 또는 면책 불허가 등의 엄중한 불이익을 감수할 것을 확약합니다.
                </p>

                <div className="pt-4 text-[14px] font-bold text-slate-900">
                  {todayStr}
                </div>

                <div className="pt-2 flex items-center justify-center gap-12 text-[14px]">
                  <div>
                    <span className="text-slate-700">신청인(채무자) : </span>
                    <span className="font-bold text-slate-950 text-base">{clientName}</span>
                    <span className="text-slate-400 ml-3 font-normal border border-slate-400 rounded-full px-2 py-0.5 text-xs">
                      (서명 또는 날인)
                    </span>
                  </div>
                </div>

                <div className="pt-6 text-base font-extrabold text-slate-900 tracking-wider">
                  {courtName} 귀중
                </div>
              </div>

            </div>

          </div>

          {/* 하단 바 (인쇄 시 숨김) */}
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 rounded-b-2xl flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0 print:hidden">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>개인회생·파산 실무 지침 준수 • 전자소송 제출 규격 호환</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl cursor-pointer"
            >
              닫기
            </button>
          </div>

        </div>

      </div>

      {/* 인쇄 전용 CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #court-audit-print-area, #court-audit-print-area * {
            visibility: visible;
          }
          #court-audit-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 10mm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </ModalPortal>
  );
}
