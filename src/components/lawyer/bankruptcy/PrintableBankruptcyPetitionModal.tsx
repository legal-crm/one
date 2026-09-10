import React, { useState } from 'react';
import { X, Printer, Download, Scale, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
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

  const [activeSection, setActiveSection] = useState<'all' | 'petition' | 'statement' | 'creditors' | 'assets' | 'living' | 'docs' | 'power'>('all');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
    toast.info('인쇄 창에서 "PDF로 저장"을 선택하시면 법원 제출 규격의 파산·면책 정식 서식 PDF로 저장됩니다.');
  };

  const p = data.petition;
  const s = data.statement;
  const c = data.creditors || [];
  const ia = data.investigationAssets;
  const lc = data.livingCondition;
  const r = lc.residence;
  const t = lc.taxArrears;
  const docs = data.requiredDocs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* 상단 툴바 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              ⚖️
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                대법원·회생법원 표준 개인파산 및 면책 8대 정식 서식 출력 패키지
              </h3>
              <p className="text-[11px] text-slate-400">
                신청인: {p.debtorName} · 관할: {p.courtName} · 관재인 5대 조사재산 & 미제출 사유서 완비
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>전체 인쇄</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer press-scale whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF 저장</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 네비게이션 (화면용) */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs font-bold print:hidden">
          {[
            { id: 'all', label: '전체 문서 일괄' },
            { id: 'petition', label: '1. 신청서' },
            { id: 'statement', label: '2. 진술서' },
            { id: 'creditors', label: '3. 채권자목록' },
            { id: 'assets', label: '4. 재산목록(5대조사)' },
            { id: 'living', label: '5. 생활상황·체납표' },
            { id: 'docs', label: '6. 자료제출목록' },
            { id: 'power', label: '7. 소송위임장' },
          ].map(sec => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              className={`px-3 py-1 rounded-lg cursor-pointer transition-all whitespace-nowrap ${
                activeSection === sec.id 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* 법원 정식 문서 본문 (A4 규격) */}
        <div className="p-8 sm:p-12 overflow-y-auto bg-white text-slate-900 font-serif leading-relaxed text-sm flex-1 print:p-0 print:overflow-visible space-y-12">
          
          {/* ══════════ 1. 표지 및 파산·면책 동시신청서 ══════════ */}
          {(activeSection === 'all' || activeSection === 'petition') && (
            <div className="space-y-6 break-after-page">
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
                  <span>{p.registeredDomicile || '서울특별시 중구 세종대로 110'}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">주 &nbsp; &nbsp; &nbsp; 소 :</span>
                  <span>{p.debtorAddress || '서울특별시 마포구 마포대로 123'}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">송 달 장 소 :</span>
                  <span>{p.serviceAddress || '대리인 법률사무소 (서울특별시 서초구 서초대로 456, 501호)'}</span>
                </div>
                <div className="flex">
                  <span className="w-28 font-bold text-slate-700">대 &nbsp; 리 &nbsp; 인 :</span>
                  <span>변호사 {p.attorneyName || '담당변호사'}</span>
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
                  2. 채무자는 현재 월 소득이 <strong>{(p.monthlyNetIncome || 0).toLocaleString()}원</strong>에 불과하여 2026년 기준 국민기초생활보장 최저생계비에도 미치지 못하므로 정기적인 변제 재원을 마련할 수 없는 절대적 빈곤 상태입니다.
                </p>
                <p className="indent-4">
                  3. 채무자에게는 채무자회생법 제564조 각 호에 해당하는 면책불허가사유가 존재하지 아니하며, 성실하고 불운한 채무자로서 갱생할 수 있도록 본 신청에 이르렀습니다.
                </p>
              </div>

              <div className="pt-8 text-center space-y-3 font-sans">
                <p className="text-sm font-bold">
                  {p.filingDate || new Date().toISOString().split('T')[0]}
                </p>
                <div className="flex justify-end pr-8">
                  <div className="text-left space-y-1">
                    <p className="text-sm">신청인(채무자) : &nbsp; {p.debtorName} &nbsp; (인)</p>
                    <p className="text-sm">대 &nbsp; &nbsp; 리 &nbsp; &nbsp; 인 : &nbsp; 변호사 {p.attorneyName} &nbsp; (인)</p>
                  </div>
                </div>
                <div className="pt-6 font-bold text-lg text-slate-900">
                  {p.courtName || '서울회생법원 귀중'}
                </div>
              </div>
            </div>
          )}

          {/* ══════════ 2. 파산 진술서 (변호사 감수문 & 8대 점검) ══════════ */}
          {(activeSection === 'all' || activeSection === 'statement') && (
            <div className="space-y-6 pt-10 border-t-2 border-slate-300 break-after-page font-sans">
              <div className="text-center space-y-1 mb-6">
                <h2 className="text-xl font-bold tracking-wider">진 &nbsp; 술 &nbsp; 서</h2>
                <p className="text-xs text-slate-500">(채무 증대 경위 및 면책불허가사유 점검)</p>
              </div>

              {/* 채무증대 경위 (변호사 감수 완성문) */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">1. 지급불능에 이르게 된 구체적 사정</h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-xs text-slate-800 font-serif whitespace-pre-wrap">
                  {s.debtorStoryPolished || s.livingHistory}
                </div>
              </div>

              {/* 과거 법적 이력 */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">2. 과거 법적 절차 및 전력 확인</h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold block">과거 면책 이력:</span>
                    <span>{s.pastDischargeHistory?.hasPastDischarge ? '면책 이력 있음' : '해당 없음 (최초 신청)'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold block">가족 동시 파산:</span>
                    <span>{s.concurrentFamilyBankruptcy?.hasConcurrent ? '동시 진행자 있음' : '해당 없음'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <span className="font-bold block">형사 처벌 전력:</span>
                    <span>{s.criminalRecordForFraud?.hasRecord ? '처벌 전력 있음' : '전력 없음'}</span>
                  </div>
                </div>
              </div>

              {/* 8대 면책불허가사유 점검표 */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">3. 채무자회생법 제564조 면책불허가사유 점검</h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">법정 불허가 사유 항목</th>
                      <th className="border border-slate-300 p-2 w-24 text-center">해당 여부</th>
                      <th className="border border-slate-300 p-2 text-left">비고 및 소명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'gamblingOrSpeculation', label: '1. 도박, 사행성 게임, 가상자산/주식 과다 낭비' },
                      { key: 'fraudulentLoan', label: '2. 대출 직전 허위 소득/재직증명 제출 (신용사기)' },
                      { key: 'preferentialPayment', label: '3. 파산 직전 친인척 채무만 우선 변제 (편파변제)' },
                      { key: 'concealmentOfAssets', label: '4. 재산 은닉, 타인 명의 이전, 헐값 처분' },
                      { key: 'falseCreditorList', label: '5. 채권자목록 고의 누락 (허위 작성)' },
                      { key: 'pastDischargeWithinYears', label: '6. 과거 7년(파산)/5년(회생) 이내 면책 이력' },
                      { key: 'falseReportToTrustee', label: '7. 파산관재인에 대한 허위 진술 및 거부' },
                      { key: 'creditTransactionBeforeFiling', label: '8. 파산 직전 무리한 신용카드/대출 발생' },
                    ].map(item => {
                      const isChecked = (s.disallowanceScreening as any)[item.key];
                      return (
                        <tr key={item.key}>
                          <td className="border border-slate-300 p-2">{item.label}</td>
                          <td className="border border-slate-300 p-2 text-center font-bold">
                            {isChecked ? <span className="text-rose-600">해당</span> : <span className="text-emerald-700">해당없음</span>}
                          </td>
                          <td className="border border-slate-300 p-2 text-slate-500">
                            {isChecked ? '별도 소명서 첨부' : '법정 요건 부합'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══════════ 3. 파산 채권자목록 & 소송/가압류 이력 ══════════ */}
          {(activeSection === 'all' || activeSection === 'creditors') && (
            <div className="space-y-6 pt-10 border-t-2 border-slate-300 break-after-page font-sans">
              <div className="text-center space-y-1 mb-6">
                <h2 className="text-xl font-bold tracking-wider">채 &nbsp; 권 &nbsp; 자 &nbsp; 목 &nbsp; 록</h2>
                <p className="text-xs text-slate-500">(비면책채권 및 관련 법원 소송·압류 사건 명시)</p>
              </div>

              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-2 w-10 text-center">순번</th>
                    <th className="border border-slate-300 p-2 text-left">채권자명</th>
                    <th className="border border-slate-300 p-2 text-left">채무발생원인 / 일자</th>
                    <th className="border border-slate-300 p-2 text-right">원금(원)</th>
                    <th className="border border-slate-300 p-2 text-right">이자(원)</th>
                    <th className="border border-slate-300 p-2 text-center">면책구분</th>
                    <th className="border border-slate-300 p-2 text-left">관련소송 / 강제집행</th>
                  </tr>
                </thead>
                <tbody>
                  {c.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-bold">{item.creditorName}</td>
                      <td className="border border-slate-300 p-2">
                        {item.debtCauseDetail} <br />
                        <span className="text-slate-500 text-[10px] font-mono">({item.borrowedDate})</span>
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-mono font-bold">
                        {item.principal.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 p-2 text-right font-mono">
                        {item.interest.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 p-2 text-center">
                        {item.isNonDischargeable ? (
                          <span className="text-rose-600 font-bold">비면책(조세)</span>
                        ) : (
                          <span className="text-emerald-700">면책대상</span>
                        )}
                      </td>
                      <td className="border border-slate-300 p-2 text-[11px]">
                        {item.lawsuitInfo?.hasLawsuit ? (
                          <span>
                            [{item.lawsuitInfo.lawsuitType}] {item.lawsuitInfo.courtName} {item.lawsuitInfo.caseNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={3} className="border border-slate-300 p-2 text-center">합 &nbsp; &nbsp; 계</td>
                    <td className="border border-slate-300 p-2 text-right font-mono text-blue-700">
                      {c.reduce((sum, x) => sum + x.principal, 0).toLocaleString()}
                    </td>
                    <td className="border border-slate-300 p-2 text-right font-mono text-purple-700">
                      {c.reduce((sum, x) => sum + x.interest, 0).toLocaleString()}
                    </td>
                    <td colSpan={2} className="border border-slate-300 p-2 text-center">
                      총 채무: {(c.reduce((sum, x) => sum + x.principal + x.interest, 0)).toLocaleString()}원
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ══════════ 4. 재산목록 & 🌟 파산관재인 5대 심층 조사재산 ══════════ */}
          {(activeSection === 'all' || activeSection === 'assets') && (
            <div className="space-y-6 pt-10 border-t-2 border-slate-300 break-after-page font-sans">
              <div className="text-center space-y-1 mb-6">
                <h2 className="text-xl font-bold tracking-wider">재 &nbsp; 산 &nbsp; 목 &nbsp; 록</h2>
                <p className="text-xs text-slate-500">(1,110만 원 면제재산 및 파산관재인 5대 특수 조사재산 표기)</p>
              </div>

              {/* 기본 재산 */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">1. 신청인 기본 재산 (압류금지 및 면제재산 공제)</h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2 text-left">재산의 종류</th>
                      <th className="border border-slate-300 p-2 text-right">평가액(원)</th>
                      <th className="border border-slate-300 p-2 text-right">법정면제·공제액(원)</th>
                      <th className="border border-slate-300 p-2 text-center">공제 유형</th>
                      <th className="border border-slate-300 p-2 text-right">파산재단 환가액(원)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assets.map(ast => (
                      <tr key={ast.id}>
                        <td className="border border-slate-300 p-2 font-bold">{ast.assetName}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{ast.marketValue.toLocaleString()}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono text-emerald-700">{ast.statutoryExemption.toLocaleString()}</td>
                        <td className="border border-slate-300 p-2 text-center text-slate-600">{ast.appliedExemptionType}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold">{ast.liquidationValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 파산관재인 5대 특수조사재산 소명표 */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-sm text-slate-900">2. 파산관재인 5대 필수 조사재산 소명 내역</h4>

                {/* (1) 1년 내 처분재산 */}
                <div className="space-y-1">
                  <span className="font-bold text-xs text-slate-800">① 지급불능 1년 전부터 현재까지 처분한 재산:</span>
                  {ia?.disposedAssets1Year && ia.disposedAssets1Year.length > 0 ? (
                    <table className="w-full text-xs border border-slate-300">
                      <thead className="bg-slate-50 font-bold">
                        <tr>
                          <th className="border border-slate-300 p-1.5 text-left">품목</th>
                          <th className="border border-slate-300 p-1.5 text-center">처분일자</th>
                          <th className="border border-slate-300 p-1.5 text-right">처분가액</th>
                          <th className="border border-slate-300 p-1.5 text-left">상대방</th>
                          <th className="border border-slate-300 p-1.5 text-left">대금 사용처 소명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ia.disposedAssets1Year.map(x => (
                          <tr key={x.id}>
                            <td className="border border-slate-300 p-1.5 font-bold">{x.itemTitle}</td>
                            <td className="border border-slate-300 p-1.5 text-center font-mono">{x.disposedDate}</td>
                            <td className="border border-slate-300 p-1.5 text-right font-mono">{x.disposedAmount.toLocaleString()}원</td>
                            <td className="border border-slate-300 p-1.5">{x.counterparty}</td>
                            <td className="border border-slate-300 p-1.5">{x.usageDetail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-slate-500 pl-2">해당 기간 내 처분한 부동산, 자동차 등 고가 재산 일체 없음.</p>
                  )}
                </div>

                {/* (2) 2년 내 반환받은 임차보증금 */}
                <div className="space-y-1">
                  <span className="font-bold text-xs text-slate-800">② 최근 2년간 종료된 임대차계약의 반환 보증금:</span>
                  {ia?.returnedDeposits2Years && ia.returnedDeposits2Years.length > 0 ? (
                    <table className="w-full text-xs border border-slate-300">
                      <thead className="bg-slate-50 font-bold">
                        <tr>
                          <th className="border border-slate-300 p-1.5 text-left">종전 임차지</th>
                          <th className="border border-slate-300 p-1.5 text-center">반환일자</th>
                          <th className="border border-slate-300 p-1.5 text-right">반환금액</th>
                          <th className="border border-slate-300 p-1.5 text-left">반환금 사용처 소명</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ia.returnedDeposits2Years.map(x => (
                          <tr key={x.id}>
                            <td className="border border-slate-300 p-1.5 font-bold">{x.housingAddress}</td>
                            <td className="border border-slate-300 p-1.5 text-center font-mono">{x.returnedDate}</td>
                            <td className="border border-slate-300 p-1.5 text-right font-mono">{x.returnedAmount.toLocaleString()}원</td>
                            <td className="border border-slate-300 p-1.5">{x.usageDetail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-slate-500 pl-2">최근 2년간 반환받은 종전 임차보증금 없음.</p>
                  )}
                </div>

                {/* (3) 2년 내 이혼 및 재산분할 */}
                <div className="space-y-1">
                  <span className="font-bold text-xs text-slate-800">③ 최근 2년 이내 이혼에 따른 재산분할 내역:</span>
                  <p className="text-xs text-slate-600 pl-2">
                    {ia?.divorceProperty2Years?.hasDivorceWithin2Years 
                      ? `[${ia.divorceProperty2Years.divorceType}] 재산분할금 ${(ia.divorceProperty2Years.propertyDivisionAmount || 0).toLocaleString()}원, 위자료 ${(ia.divorceProperty2Years.alimonyAmount || 0).toLocaleString()}원 수령.`
                      : '최근 2년 이내 이혼 및 재산분할 사실 없음.'}
                  </p>
                </div>

                {/* (4) 친족 상속재산 */}
                <div className="space-y-1">
                  <span className="font-bold text-xs text-slate-800">④ 친족 사망에 따른 상속재산:</span>
                  <p className="text-xs text-slate-600 pl-2">
                    {ia?.inheritanceProperty?.hasInheritance
                      ? `망인과의 관계: ${ia.inheritanceProperty.decedentRelation}, 상속처리: [${ia.inheritanceProperty.divisionStatus}], ${ia.inheritanceProperty.waiverCourtAndDate || ''}`
                      : '최근 친족 사망으로 인한 상속재산 발생 사실 없음.'}
                  </p>
                </div>

                {/* (5) 예상 퇴직금 */}
                <div className="space-y-1">
                  <span className="font-bold text-xs text-slate-800">⑤ 예상 퇴직금 및 1/2 압류금지 공제:</span>
                  <p className="text-xs text-slate-600 pl-2">
                    {ia?.severancePay?.hasSeverance
                      ? `총 예상액 ${(ia.severancePay.expectedTotalAmount || 0).toLocaleString()}원 중 1/2 법정 압류금지액 ${(ia.severancePay.exemptAmount || 0).toLocaleString()}원 제외, 파산재단 환가액 ${(ia.severancePay.liquidationAmount || 0).toLocaleString()}원 산정.`
                      : '퇴직금 수령 예정 직장 재직 사실 없음 (해당사항 없음).'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ 5. 현재의 생활상황표 & 비면책 조세 체납표 ══════════ */}
          {(activeSection === 'all' || activeSection === 'living') && (
            <div className="space-y-6 pt-10 border-t-2 border-slate-300 break-after-page font-sans">
              <div className="text-center space-y-1 mb-6">
                <h2 className="text-xl font-bold tracking-wider">현재의 생활상황표</h2>
                <p className="text-xs text-slate-500">(주거 6분류 상태, 비면책 조세 체납표 및 가계수지표)</p>
              </div>

              {/* 주거 6분류 현황 */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">1. 주거의 상황</h4>
                <table className="w-full text-xs border border-slate-300">
                  <tbody>
                    <tr>
                      <td className="border border-slate-300 p-2 bg-slate-100 font-bold w-32">주거 형태</td>
                      <td className="border border-slate-300 p-2 font-bold text-purple-900">
                        {r?.residenceType === 'RENT_LEASE' && '임차(전·월세) 주택'}
                        {r?.residenceType === 'APPLICANT_OWNED' && '신청인 소유 부동산'}
                        {r?.residenceType === 'DORMITORY' && '사택 또는 기숙사'}
                        {r?.residenceType === 'RELATIVE_FREE' && '친족 소유 주택에 무상거주'}
                        {r?.residenceType === 'NON_RELATIVE_FREE' && '친족 외 소유 주택에 무상거주'}
                        {r?.residenceType === 'OTHER' && '기타 거주'}
                      </td>
                      <td className="border border-slate-300 p-2 bg-slate-100 font-bold w-32">거주시작 시점</td>
                      <td className="border border-slate-300 p-2 font-mono">{r?.startDate || '2022-03-01'}</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-300 p-2 bg-slate-100 font-bold">임차보증금 / 월세</td>
                      <td className="border border-slate-300 p-2 font-mono">
                        보증금 {(r?.deposit || 0).toLocaleString()}원 / 월세 {(r?.monthlyRent || 0).toLocaleString()}원
                      </td>
                      <td className="border border-slate-300 p-2 bg-slate-100 font-bold">명의인 / 관계</td>
                      <td className="border border-slate-300 p-2">
                        {r?.ownerName || '임대인'} ({r?.ownerRelation || '소유자'})
                      </td>
                    </tr>
                    {(r?.freeStayReason) && (
                      <tr>
                        <td className="border border-slate-300 p-2 bg-slate-100 font-bold">무상거주 사유</td>
                        <td colSpan={3} className="border border-slate-300 p-2">{r.freeStayReason}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 비면책 조세 체납표 */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">2. 비면책 조세 및 공과금 체납 현황</h4>
                <table className="w-full text-xs border border-slate-300">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="border border-slate-300 p-2 text-right">국세(소득세/부가세)</th>
                      <th className="border border-slate-300 p-2 text-right">지방세(주민세 등)</th>
                      <th className="border border-slate-300 p-2 text-right">건강보험료</th>
                      <th className="border border-slate-300 p-2 text-right">국민연금</th>
                      <th className="border border-slate-300 p-2 text-right">재산세/기타</th>
                      <th className="border border-slate-300 p-2 text-right bg-rose-50 text-rose-900">체납 총액</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-mono">
                      <td className="border border-slate-300 p-2 text-right">{(t?.incomeTax || 0).toLocaleString()}원</td>
                      <td className="border border-slate-300 p-2 text-right">{(t?.localIncomeTax || 0).toLocaleString()}원</td>
                      <td className="border border-slate-300 p-2 text-right">{(t?.healthInsurance || 0).toLocaleString()}원</td>
                      <td className="border border-slate-300 p-2 text-right">{(t?.nationalPension || 0).toLocaleString()}원</td>
                      <td className="border border-slate-300 p-2 text-right">{((t?.propertyTax || 0) + (t?.otherTax || 0)).toLocaleString()}원</td>
                      <td className="border border-slate-300 p-2 text-right font-bold text-rose-700 bg-rose-50">
                        {(t?.totalArrears || 0).toLocaleString()}원
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[11px] text-slate-500 pt-1">
                  * 채무자회생법 제566조 제1호에 따라 조세 등 채권은 면책결정에도 불구하고 변제 책임이 유지됨을 확인합니다.
                </p>
              </div>

              {/* 가계수지표 (월 가용소득 0원 입증) */}
              <div className="space-y-2">
                <h4 className="font-bold text-sm text-slate-900">3. 가계수지표 (월 가용소득 0원 입증)</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <table className="w-full border border-slate-300">
                    <thead className="bg-slate-100 font-bold">
                      <tr>
                        <th className="border border-slate-300 p-2 text-left">월 수입 항목</th>
                        <th className="border border-slate-300 p-2 text-right">금액(원)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2">근로/알바 소득</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{(lc.budgetLedger.earnedIncome || 0).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2">기초연금/생계급여</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{(lc.budgetLedger.pensionOrWelfare || 0).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="border border-slate-300 p-2">월 총수입 (A)</td>
                        <td className="border border-slate-300 p-2 text-right font-mono text-blue-700">{(lc.budgetLedger.totalIncome || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  <table className="w-full border border-slate-300">
                    <thead className="bg-slate-100 font-bold">
                      <tr>
                        <th className="border border-slate-300 p-2 text-left">필수 생계비 항목</th>
                        <th className="border border-slate-300 p-2 text-right">금액(원)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2">주거비 (월세)</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{(lc.budgetLedger.housingRent || 0).toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2">식비 및 의료·공과금</td>
                        <td className="border border-slate-300 p-2 text-right font-mono">{((lc.budgetLedger.foodAndDailySupplies || 0) + (lc.budgetLedger.medicalExpenses || 0) + (lc.budgetLedger.utilitiesAndCommunication || 0)).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="border border-slate-300 p-2">필수 지출계 (B)</td>
                        <td className="border border-slate-300 p-2 text-right font-mono text-rose-700">{(lc.budgetLedger.totalLivingExpense || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex justify-between items-center text-xs font-bold text-emerald-950">
                  <span>월 잉여 가용소득 (A - B):</span>
                  <span className="font-mono text-sm">{(lc.budgetLedger.disposableIncome || 0).toLocaleString()}원 (개인회생 변제계획 수립 불가 · 파산 적격 완벽 입증)</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ 6. 서울회생법원 실무준칙 15대 자료제출목록 & 미제출 사유서 ══════════ */}
          {(activeSection === 'all' || activeSection === 'docs') && (
            <div className="space-y-6 pt-10 border-t-2 border-slate-300 break-after-page font-sans">
              <div className="text-center space-y-1 mb-6">
                <h2 className="text-xl font-bold tracking-wider">자 &nbsp; 료 &nbsp; 제 &nbsp; 출 &nbsp; 목 &nbsp; 록</h2>
                <p className="text-xs text-slate-500">(서울회생법원 실무준칙 개인파산 필수 소명자료 및 미제출 사유서)</p>
              </div>

              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-300 p-2 w-12 text-center">연번</th>
                    <th className="border border-slate-300 p-2 text-left">제출하여야 하는 자료명</th>
                    <th className="border border-slate-300 p-2 w-20 text-center">제출여부</th>
                    <th className="border border-slate-300 p-2 text-left">제출 못하거나 일부만 제출한 사유</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(doc => {
                    const isSubmitted = doc.status === 'SUBMITTED';
                    return (
                      <tr key={doc.id}>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">#{doc.itemNumber}</td>
                        <td className="border border-slate-300 p-2">
                          <span className="font-bold text-slate-900">{doc.title}</span>
                          <span className="text-slate-500 text-[11px] block">{doc.detailDescription}</span>
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-bold">
                          {isSubmitted ? (
                            <span className="text-emerald-700">제출</span>
                          ) : (
                            <span className="text-amber-700">미제출</span>
                          )}
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-700">
                          {isSubmitted ? (
                            <span className="text-slate-400 font-mono">첨부 완료</span>
                          ) : (
                            <span className="font-bold text-amber-900">{doc.unobtainableReason || '해당 사유 없음'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">※ 파산관재인 및 법원 안내사항:</p>
                <p>위 미제출 자료는 채무자에게 해당 재산이 부존재하거나 객관적 발급 불가 사유로 인해 부득이하게 제출하지 못한 것이며, 추후 법원 또는 파산관재인의 보정요구 시 사실조회 촉탁 등을 통하여 성실히 소명하겠습니다.</p>
              </div>
            </div>
          )}

          {/* ══════════ 7. 소송위임장 ══════════ */}
          {(activeSection === 'all' || activeSection === 'power') && (
            <div className="space-y-6 pt-10 border-t-2 border-slate-300 font-sans">
              <div className="text-center space-y-1 mb-8">
                <h2 className="text-2xl font-bold tracking-widest">소 &nbsp; 송 &nbsp; 위 &nbsp; 임 &nbsp; 장</h2>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs leading-relaxed">
                <div className="flex">
                  <span className="w-24 font-bold text-slate-700">사 &nbsp; &nbsp; &nbsp; 건 :</span>
                  <span>개인파산 및 면책신청</span>
                </div>
                <div className="flex">
                  <span className="w-24 font-bold text-slate-700">위 &nbsp; 임 &nbsp; 인 :</span>
                  <span>{p.debtorName} (주민등록번호: {p.debtorRrn || '800101-1******'})</span>
                </div>
                <div className="flex">
                  <span className="w-24 font-bold text-slate-700">수 &nbsp; 임 &nbsp; 인 :</span>
                  <span>변호사 {p.attorneyName}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-justify leading-relaxed">
                <h4 className="font-bold text-slate-900">【 수 권 사 항 】</h4>
                <p>
                  위임인은 수임인에게 위 사건에 관하여 다음 행위를 할 수 있는 권한을 위임합니다.
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-700">
                  <li>일체의 소송행위, 신청, 취하 및 복대리인의 선임</li>
                  <li>파산관재인과의 면담 및 소명자료의 제출, 수령</li>
                  <li>공탁물의 납부 및 환급 청구, 변제의 수령</li>
                  <li>기타 본건 파산 및 면책 신청 절차 일체에 부수하는 행위</li>
                </ol>
              </div>

              <div className="pt-12 text-center space-y-4">
                <p className="text-sm font-bold">
                  {p.filingDate || new Date().toISOString().split('T')[0]}
                </p>
                <div className="flex justify-end pr-12">
                  <div className="text-left space-y-2 text-sm">
                    <p>위 &nbsp; 임 &nbsp; 인(채무자) : &nbsp; {p.debtorName} &nbsp; &nbsp; (인)</p>
                    <p>수 &nbsp; 임 &nbsp; 인(대리인) : &nbsp; 변호사 {p.attorneyName} &nbsp; &nbsp; (인)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
