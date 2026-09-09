import React, { useState, useEffect } from 'react';
import { 
  X, Scale, RefreshCw, Calendar, CheckCircle2, 
  ExternalLink, Copy, Clock, ShieldCheck, AlertCircle, Sparkles 
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchCourtCase, getCachedCourtCase, type ScourtCaseDetail } from '../../../services/scourtService';

interface CourtCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  courtName: string;
  caseNumber: string;
  clientName: string;
}

export default function CourtCaseModal({
  isOpen,
  onClose,
  courtName,
  caseNumber,
  clientName
}: CourtCaseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<ScourtCaseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'dates' | 'deliveries' | 'repayment'>('status');

  const loadData = async (force: boolean = false) => {
    if (!caseNumber) return;
    setIsLoading(true);
    try {
      const res = await fetchCourtCase({
        courtName,
        caseNumber,
        clientName,
        forceRefresh: force
      });
      setData(res);
    } catch (err: any) {
      toast.error(err.message || '법원 사건 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && caseNumber) {
      const cached = getCachedCourtCase(caseNumber);
      if (cached) {
        setData(cached);
      } else {
        loadData(false);
      }
    }
  }, [isOpen, caseNumber, courtName]);

  if (!isOpen) return null;

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label}이 클립보드에 복사되었습니다.`);
  };

  const handleOpenScourtMobile = () => {
    const copyText = `${courtName} ${caseNumber}`;
    navigator.clipboard.writeText(copyText);
    toast.success(`'${copyText}' 복사 완료! 대법원 모바일 사이트로 이동합니다.`);
    window.open('https://m.scourt.go.kr', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* 헤더 */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand/10 dark:bg-brand/20 text-brand flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  대법원 사건 실시간 조회
                </h3>
                {data && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    전산망 연동
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {courtName} · {caseNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-brand' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            <div className="h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          </div>
        )}

        {/* 메인 바디 */}
        {!isLoading && data && (
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            
            {/* 사건 기본 요약 카드 */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">사건 기본정보</span>
                <span className="text-[11px] font-black text-brand bg-brand/10 px-2 py-0.5 rounded-md">
                  {data.finalResult || '진행중'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">담당 재판부</span>
                  <span className="font-bold text-slate-900 dark:text-white">{data.department} ({data.judgeName})</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">법원 접수일</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{data.filedDate || '-'}</span>
                </div>
              </div>
            </div>

            {/* 다음 기일 안내 배너 (있을 때만) */}
            {data.dates.length > 0 && (
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      다음 법원 일정: {data.dates[0].type}
                    </h4>
                    {data.dates[0].dDay !== undefined && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                        D-{data.dates[0].dDay}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    일시: {data.dates[0].date} · 장소: {data.dates[0].place}
                  </p>
                </div>
              </div>
            )}

            {/* 서브탭 */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 pt-1">
              {[
                { id: 'status', label: '진행 타임라인' },
                { id: 'deliveries', label: '법원 서류 송달' },
                { id: 'repayment', label: '변제금 납부 내역' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === t.id
                      ? 'border-brand text-brand'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 탭 1: 진행 내역 */}
            {activeTab === 'status' && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.events.map((ev, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-start gap-2.5">
                    <span className="text-[11px] font-mono text-slate-400 shrink-0 w-20">
                      {ev.date}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {ev.title}
                      </p>
                      {ev.detail && <span className="text-[10px] text-slate-400">{ev.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 탭 2: 송달 내역 */}
            {activeTab === 'deliveries' && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.deliveries.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">송달 내역이 없습니다.</p>
                ) : (
                  data.deliveries.map((del, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {del.docName}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {del.target} · {del.status}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {del.deliveryDate}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 탭 3: 변제금 납부 내역 */}
            {activeTab === 'repayment' && (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {data.repayments.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">
                    법원에 등록된 변제금 납부 내역이 아직 없거나 인가 전 단계입니다.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {data.repayments.map((rep, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                            {rep.round}회차
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            기한: {rep.dueDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-slate-900 dark:text-white">
                            {rep.amount.toLocaleString()}원
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rep.paidDate ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {rep.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* 푸터 */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleOpenScourtMobile}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>대법원 공식 사이트 직접 열기</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-[0.98]"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
}
