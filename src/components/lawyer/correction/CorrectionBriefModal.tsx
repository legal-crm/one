import React from 'react';
import { X, Printer, Download, Scale, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CorrectionBriefData } from '../../../types/correctionTypes';
import ModalPortal from '../../common/ModalPortal';

interface CorrectionBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CorrectionBriefData;
}

// 빈칸은 빈칸으로 출력 (이전: '홍길동'·'김변호'·'2026개회 00000호'·'2026. 00. 00.'·'서울회생법원 귀중' 같은 예시값이 법원 제출 서식에 인쇄됨)
const BLANK = '\u00A0'.repeat(12);
const fmtYmd = (ymd?: string) => (ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? ymd.slice(0, 10).replace(/-/g, '. ') + '.' : '');
/** '홍길동 변호사' / '변호사 홍길동' → '홍길동' */
const agentBareName = (n?: string) => (n || '').replace(/변호사/g, '').trim();

export default function CorrectionBriefModal({
  isOpen,
  onClose,
  data
}: CorrectionBriefModalProps) {
  if (!isOpen) return null;
  const agent = agentBareName(data.agentName) === '담당' ? '' : agentBareName(data.agentName);
  const caseNo = data.caseNumber && !data.caseNumber.includes('미입력') ? data.caseNumber : '';
  // 첨부 소명자료 목록: 실제 답변에 적힌 호증만 (이전: 소갑 제1~7호증을 고정 번호로 나열)
  const evidenceList = Array.from(new Set((data.answers || []).map(a => (a.attachedEvidence || '').trim()).filter(Boolean)));
  const hasBlanks = (data.answers || []).some(a => /\[[^\]]+\]/.test(`${a.debtorResponse} ${a.attachedEvidence || ''}`));

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    window.print();
    toast.info('인쇄 대화상자에서 "PDF로 저장"을 선택하시면 법원 제출용 정규 PDF로 저장됩니다.');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[calc(100vh-2.5rem)] flex flex-col overflow-hidden">
        {/* 상단 툴바 (인쇄 시 숨김) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              ⚖️
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">
                법원 제출용 정규 보정서 서식 인쇄 / PDF 출력
              </h3>
              <p className="text-xs text-slate-400">
                사건번호: {caseNo || '(미입력)'} · 제{data.round}차 보정권고에 대한 소명
                {hasBlanks && <span className="ml-2 text-amber-300 font-bold">· [대괄호] 빈칸이 남아 있습니다</span>}
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
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer press-scale whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF로 저장(인쇄)</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 문서 본문 (A4 규격 서울회생법원 표준 레이아웃) */}
        <div className="p-8 sm:p-12 overflow-y-auto bg-white text-slate-900 font-serif leading-relaxed text-sm flex-1 print:p-0 print:overflow-visible">
          {/* 제목 */}
          <div className="text-center space-y-2 mb-10">
            <h1 className="text-2xl font-black tracking-widest underline decoration-2 underline-offset-8">
              보 &nbsp; 정 &nbsp; 서
            </h1>
            <p className="text-xs font-sans text-slate-500 pt-1">
              (사건번호: {caseNo || BLANK})
            </p>
          </div>

          {/* 당사자 표시 */}
          <div className="space-y-2 mb-8 text-sm font-sans">
            <div className="flex">
              <span className="w-24 font-bold text-slate-700">사 &nbsp; &nbsp; &nbsp; 건 :</span>
              <span className="font-bold">{caseNo ? `${caseNo} 개인회생` : BLANK}</span>
            </div>
            <div className="flex">
              <span className="w-24 font-bold text-slate-700">신 &nbsp; 청 &nbsp; 인 :</span>
              <span>{data.debtorName || BLANK}</span>
            </div>
            <div className="flex">
              <span className="w-24 font-bold text-slate-700">대 &nbsp; 리 &nbsp; 인 :</span>
              <span>변호사 {agent || BLANK}</span>
            </div>
          </div>

          {/* 청구 및 제출 서문 */}
          <div className="mb-8 font-sans leading-relaxed text-justify">
            <p className="indent-4">
              위 사건에 관하여 채무자의 대리인은 귀원의 {fmtYmd(data.servedDate) || BLANK}자 제{data.round}차 보정권고에 대하여 다음과 같이 보정서를 제출합니다.
            </p>
          </div>

          {/* 다 음 (본문 항목별 소명) */}
          <div className="mb-10 font-sans space-y-6">
            <h2 className="text-center font-bold text-base tracking-widest mb-4">
              - &nbsp; 다 &nbsp; &nbsp; 음 &nbsp; -
            </h2>

            {data.answers && data.answers.length > 0 ? (
              data.answers.map((ans, idx) => (
                <div key={idx} className="space-y-2">
                  <h4 className="font-bold text-slate-900 flex items-start gap-2">
                    <span className="text-blue-700">{ans.pointNumber}.</span>
                    <span>{ans.courtInstruction}</span>
                  </h4>
                  <div className="pl-5 text-slate-800 whitespace-pre-line leading-relaxed text-justify text-xs sm:text-sm">
                    {ans.debtorResponse}
                  </div>
                  {ans.attachedEvidence && (
                    <div className="pl-5 text-xs text-slate-600 font-mono">
                      [소명 첨부: {ans.attachedEvidence}]
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500">
                작성된 소명 항목이 없습니다.
              </div>
            )}
          </div>

          {/* 7대 소명표 첨부 요약 */}
          <div className="mb-10 font-sans space-y-3 pt-4 border-t border-slate-200">
            <h3 className="font-bold text-sm text-slate-900">
              【 첨 부 소 명 자 료 】
            </h3>
            <ul className="text-xs space-y-1.5 pl-4 list-decimal list-inside text-slate-700">
              {evidenceList.map((ev) => (
                <li key={ev}>{ev}</li>
              ))}
              {data.recentLoans.length > 0 && !evidenceList.some(e => e.includes('대출금')) && (
                <li>[별지 1] 최근 대출금 사용처 소명표</li>
              )}
              {data.highValueTrans.length > 0 && !evidenceList.some(e => e.includes('출금')) && (
                <li>[별지 2] 금융거래 100만 원 이상 출금 사용처 소명서</li>
              )}
              {evidenceList.length === 0 && data.recentLoans.length === 0 && data.highValueTrans.length === 0 && (
                <li className="list-none text-slate-400">첨부 소명자료가 입력되지 않았습니다.</li>
              )}
            </ul>
          </div>

          {/* 작성일자 및 기명날인 */}
          <div className="text-center font-sans space-y-4 pt-8">
            <p className="text-sm font-bold">
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div className="flex justify-end pr-8">
              <div className="text-left space-y-1">
                <p className="text-sm">채무자 신청인 : &nbsp; {data.debtorName || BLANK} &nbsp; (인)</p>
                <p className="text-sm">채무자 대리인 : &nbsp; 변호사 {agent || BLANK} &nbsp; (인)</p>
              </div>
            </div>
            <div className="pt-8 text-center font-bold text-lg tracking-wider text-slate-900">
              {data.courtName ? `${data.courtName} 귀중` : `${BLANK}법원 귀중`}
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
