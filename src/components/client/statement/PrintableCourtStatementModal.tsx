import React from 'react';
import { X, Printer, Download, Scale, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { CourtStatementData } from '../../../types/statementTypes';

interface PrintableCourtStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  statement: CourtStatementData;
}

export default function PrintableCourtStatementModal({
  isOpen,
  onClose,
  statement
}: PrintableCourtStatementModalProps) {
  if (!isOpen) return null;

  const isRehab = statement.caseType === 'rehab';
  const s = statement.story;
  const jobs = statement.jobHistories || [];
  const residence = statement.residence;
  const screening = statement.bankruptcyScreening;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
    toast.info('인쇄 창에서 "PDF로 저장"을 선택하시면 법원 제출 규격의 정식 서식 PDF로 저장됩니다.');
  };

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn text-left">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* 상단 툴바 (인쇄 시 숨김) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ⚖️
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                대법원·회생법원 정식 규격 {isRehab ? '개인회생' : '개인파산'} 진술서 서식
              </h3>
              <p className="text-[11px] text-slate-400">
                신청인: {statement.applicantName} · 관할: {statement.courtName} · 상태: {statement.status === 'client_completed' ? '제출 완료' : '작성 중'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 cursor-pointer press-scale whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄하기</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer press-scale whitespace-nowrap"
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

        {/* 법원 정식 서식 본문 (A4 규격) */}
        <div className="p-8 sm:p-14 overflow-y-auto bg-white text-slate-900 font-serif leading-relaxed text-sm flex-1 print:p-0 print:overflow-visible space-y-8">
          
          {/* 제목 */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl sm:text-3xl font-black tracking-widest underline decoration-2 underline-offset-8">
              진 &nbsp; &nbsp; 술 &nbsp; &nbsp; 서
            </h1>
            <p className="text-xs font-sans text-slate-500 pt-1">
              {isRehab 
                ? '【채무자 회생 및 파산에 관한 법률 제589조 제1항 제3호 및 실무준칙】'
                : '【채무자 회생 및 파산에 관한 법률 제302조 및 제556조】'}
            </p>
          </div>

          {/* 사건 및 당사자 표시 */}
          <div className="space-y-1.5 text-sm font-sans border-b border-slate-300 pb-5">
            <div className="flex">
              <span className="w-28 font-bold text-slate-700">사 &nbsp; &nbsp; &nbsp; 건 :</span>
              <span>2026개회 또는 본인신청 사건 ({isRehab ? '개인회생' : '개인파산 및 면책'})</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-700">신 &nbsp; 청 &nbsp; 인 :</span>
              <span className="font-bold">{statement.applicantName} (주민등록번호: {statement.applicantRrnMasked})</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-700">연 &nbsp; 락 &nbsp; 처 :</span>
              <span>{statement.applicantPhone}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-700">주 &nbsp; &nbsp; &nbsp; 소 :</span>
              <span>{statement.applicantAddress}</span>
            </div>
          </div>

          {/* 1. 최종 학력 및 직업 경력 */}
          <div className="space-y-3 font-sans">
            <h3 className="font-bold text-base text-slate-900">
              1. 최종 학력 및 과거 경력
            </h3>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div><span className="font-bold">최종 학력:</span> {statement.finalEducation}</div>
            </div>

            <table className="w-full text-xs border border-slate-300">
              <thead className="bg-slate-100 font-bold">
                <tr>
                  <th className="border border-slate-300 p-2 w-32 text-center">기 &nbsp; 간</th>
                  <th className="border border-slate-300 p-2 text-left">직장명 / 상호</th>
                  <th className="border border-slate-300 p-2 w-28 text-center">직위 / 업종</th>
                  <th className="border border-slate-300 p-2 text-left">퇴직 / 폐업 사유</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-300 p-2 text-center font-mono">{job.period}</td>
                    <td className="border border-slate-300 p-2 font-bold">{job.companyName}</td>
                    <td className="border border-slate-300 p-2 text-center">{job.position}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">{job.reasonForLeaving}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. 과거 법적 절차 이용 이력 */}
          <div className="space-y-2 font-sans">
            <h3 className="font-bold text-base text-slate-900">
              2. 과거 개인회생·파산 및 신용회복지원 등 이용 전력
            </h3>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              {statement.pastHistory.hasPastCase ? (
                <div className="space-y-1">
                  <span className="font-bold text-amber-700">이용 경험 있음:</span>{' '}
                  {statement.pastHistory.year || ''}년경 {statement.pastHistory.courtOrAgency || '법원'}{' '}
                  (사건번호: {statement.pastHistory.caseNumber || '기억나지 않음'})
                  {statement.pastHistory.resultStatus && ` - 결과: ${statement.pastHistory.resultStatus}`}
                </div>
              ) : (
                <span className="text-slate-700 font-bold">
                  해당 없음 (과거 개인회생, 파산면책, 워크아웃 신청 이력이 전무한 최초 신청자임)
                </span>
              )}
            </div>
          </div>

          {/* 3. 현재 주거 상황 */}
          <div className="space-y-2 font-sans">
            <h3 className="font-bold text-base text-slate-900">
              3. 현재의 거주 상황
            </h3>
            <table className="w-full text-xs border border-slate-300">
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-2.5 bg-slate-100 font-bold w-28">주거 형태</td>
                  <td className="border border-slate-300 p-2.5">{residence.residenceTypeLabel}</td>
                  <td className="border border-slate-300 p-2.5 bg-slate-100 font-bold w-28">소유자 및 관계</td>
                  <td className="border border-slate-300 p-2.5">{residence.ownerName} ({residence.ownerRelation})</td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2.5 bg-slate-100 font-bold">임차 보증금</td>
                  <td className="border border-slate-300 p-2.5 font-mono">
                    {residence.deposit ? `${residence.deposit.toLocaleString()} 원` : '해당 없음'}
                  </td>
                  <td className="border border-slate-300 p-2.5 bg-slate-100 font-bold">월 차임(월세)</td>
                  <td className="border border-slate-300 p-2.5 font-mono">
                    {residence.monthlyRent ? `${residence.monthlyRent.toLocaleString()} 원` : '해당 없음'}
                  </td>
                </tr>
                {residence.freeStayReason && (
                  <tr>
                    <td className="border border-slate-300 p-2.5 bg-slate-100 font-bold">무상거주 사유</td>
                    <td colSpan={3} className="border border-slate-300 p-2.5 text-slate-700">
                      {residence.freeStayReason}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 4. 부채 발생 원인 및 채무증대, 지급불능에 이르게 된 구체적 사정 (핵심) */}
          <div className="space-y-4 font-sans">
            <h3 className="font-bold text-base text-slate-900">
              4. 지급불능에 이르게 된 구체적 사정 (채무증대 경위)
            </h3>

            {/* (1) 채무 발생 원인 */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                (1) 채무 발생의 최초 원인
              </h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-xs text-slate-800 font-serif whitespace-pre-wrap">
                {s.initialCauseDetail || '신청인은 불가피한 생계비 및 고정지출 발생으로 인하여 최초 금융거래를 시작하게 되었습니다.'}
              </div>
            </div>

            {/* (2) 채무 증대 경위 */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                (2) 채무가 점차 증대된 구체적 경위
              </h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-xs text-slate-800 font-serif whitespace-pre-wrap">
                {s.growthProcessDetail || '이후 이자 부담이 가중되고 돌려막기를 거듭하면서 채무가 지속적으로 증가하였습니다.'}
              </div>
            </div>

            {/* (3) 지급불능 사정 */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                (3) 지급불능에 이르게 된 결정적 사정
              </h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-xs text-slate-800 font-serif whitespace-pre-wrap">
                {s.insolvencyTriggerDetail || '수입 대비 원리금 상환액이 초과되어 최종적으로 지급불능 상태에 도달하였습니다.'}
              </div>
            </div>

            {/* (4) 반성과 다짐 */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                (4) 신청인의 반성과 향후 갱생 다짐
              </h4>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl leading-relaxed text-xs text-slate-800 font-serif whitespace-pre-wrap">
                {s.resolutionAndApology || '채권자분들께 사죄드리며, 법원의 결정에 따라 성실히 변제계획을 수행하겠습니다.'}
              </div>
            </div>
          </div>

          {/* 5. 개인파산 전용: 면책불허가사유 점검표 */}
          {!isRehab && screening && (
            <div className="space-y-3 font-sans pt-4 border-t border-slate-200">
              <h3 className="font-bold text-base text-slate-900">
                5. 채무자회생법 제564조 면책불허가사유 자가점검표
              </h3>
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
                    { key: 'fraudulentLoan', label: '2. 대출 직전 허위 소득/재직증빙 제출 (신용사기)' },
                    { key: 'preferentialPayment', label: '3. 파산 직전 친인척 채무만 우선 변제 (편파변제)' },
                    { key: 'concealmentOfAssets', label: '4. 재산 은닉, 타인 명의 이전, 헐값 처분' },
                    { key: 'falseCreditorList', label: '5. 채권자목록 고의 누락 (허위 작성)' },
                    { key: 'pastDischargeWithinYears', label: '6. 과거 7년(파산)/5년(회생) 이내 면책 이력' },
                    { key: 'falseReportToTrustee', label: '7. 파산관재인에 대한 허위 진술 및 거부' },
                    { key: 'creditTransactionBeforeFiling', label: '8. 파산 직전 무리한 신용카드/대출 발생' },
                  ].map(item => {
                    const isChecked = (screening as any)[item.key];
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
          )}

          {/* 서명 및 제출처 */}
          <div className="pt-10 font-sans space-y-6 text-center">
            <p className="text-xs text-slate-600 leading-relaxed">
              위 진술 사항은 사실과 틀림없으며, 만일 허위의 진술을 하였을 때에는 법령에 따라 기각되거나 불이익 처분을 받아도 이의를 제기하지 아니할 것을 엄숙히 서약합니다.
            </p>

            <div className="pt-4 text-sm font-bold text-slate-800">
              {todayStr}
            </div>

            <div className="flex items-center justify-end pr-8 gap-4 text-sm font-bold text-slate-900">
              <span>위 신청인 :</span>
              <span className="text-base font-extrabold tracking-wider underline underline-offset-4">{statement.applicantName}</span>
              <span className="w-8 h-8 rounded-full border border-red-500 text-red-500 flex items-center justify-center text-[10px] font-bold">
                (인)
              </span>
            </div>

            <div className="pt-8 font-black text-lg sm:text-xl text-slate-900 tracking-wider">
              {statement.courtName || '서울회생법원'} 귀중
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
