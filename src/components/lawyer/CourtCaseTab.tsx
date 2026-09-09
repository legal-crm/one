import React, { useState, useEffect } from 'react';
import { 
  Scale, RefreshCw, Calendar, AlertTriangle, CheckCircle2, 
  Clock, FileText, ExternalLink, Copy, Landmark, ShieldCheck,
  ChevronRight, ArrowRight, Sparkles, Building2, User
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, CorrectionOrder } from '../../types';
import { 
  fetchCourtCase, 
  getCachedCourtCase, 
  extractCorrectionOrdersFromCourt,
  type ScourtCaseDetail 
} from '../../services/scourtService';
import { createEvent as createCalendarEvent } from '../../services/calendarEventService';

interface CourtCaseTabProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  onUpdateCrmExt: (updates: Partial<CrmClientExtension>) => Promise<void>;
  activeLawyerName?: string;
}

const COURTS = [
  '서울회생법원',
  '수원회생법원',
  '부산회생법원',
  '의정부지방법원',
  '인천지방법원',
  '대전지방법원',
  '대구지방법원',
  '광주지방법원',
  '울산지방법원',
  '창원지방법원',
  '청주지방법원',
  '춘천지방법원',
  '전주지방법원',
  '제주지방법원'
];

export default function CourtCaseTab({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  activeLawyerName = '담당 변호사'
}: CourtCaseTabProps) {
  // 기본 법원 및 사건번호 세팅 (기존 저장값 또는 신청 데이터에서 추출)
  const defaultCourt = crmExt.courtCase?.courtName || clientRequest.court || '서울회생법원';
  const defaultCaseNumber = crmExt.courtCase?.caseNumber || '';
  const clientName = clientRequest.clientName || '의뢰인';

  const [courtName, setCourtName] = useState(defaultCourt);
  const [caseNumber, setCaseNumber] = useState(defaultCaseNumber);
  const [isLoading, setIsLoading] = useState(false);
  const [courtDetail, setCourtDetail] = useState<ScourtCaseDetail | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'progress' | 'deliveries' | 'repayment'>('overview');

  // 관련사건 멀티탭 트래커 상태 (Ch 9-2)
  interface RelatedCourtCase {
    id: string;
    type: '본안' | '금지' | '중지' | '타채(압류)' | '종전';
    court: string;
    caseNo: string;
    statusBadge: string;
    statusColor: string;
  }

  const [relatedCases, setRelatedCases] = useState<RelatedCourtCase[]>([
    {
      id: 'rc-1',
      type: '본안',
      court: defaultCourt,
      caseNo: defaultCaseNumber || '2025개회108492',
      statusBadge: '접수/심리중',
      statusColor: 'bg-blue-100 text-blue-800 border-blue-200'
    },
    {
      id: 'rc-2',
      type: '금지',
      court: defaultCourt,
      caseNo: '2025개금5012',
      statusBadge: '인용결정',
      statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    },
    {
      id: 'rc-3',
      type: '타채(압류)',
      court: '서울동부지방법원',
      caseNo: '2025타채54321',
      statusBadge: '중지신청완료',
      statusColor: 'bg-amber-100 text-amber-800 border-amber-200'
    }
  ]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('rc-1');
  const [showAddCaseModal, setShowAddCaseModal] = useState(false);
  const [newCaseType, setNewCaseType] = useState<'본안' | '금지' | '중지' | '타채(압류)' | '종전'>('중지');
  const [newCaseCourt, setNewCaseCourt] = useState(defaultCourt);
  const [newCaseNo, setNewCaseNo] = useState('');

  // 마운트 또는 사건번호 변경 시 캐시 로드
  useEffect(() => {
    if (caseNumber.trim()) {
      const cached = getCachedCourtCase(caseNumber.trim());
      if (cached) {
        setCourtDetail(cached);
      }
    }
  }, [caseNumber]);

  // 대법원 사건 동기화 실행
  const handleSyncCourt = async (force: boolean = false) => {
    if (!caseNumber.trim()) {
      toast.error('사건번호를 입력해 주세요 (예: 2025개회108492)');
      return;
    }

    setIsLoading(true);
    try {
      const detail = await fetchCourtCase({
        courtName,
        caseNumber: caseNumber.trim(),
        clientName,
        forceRefresh: force
      });

      setCourtDetail(detail);

      // CRM Extension에 동기화 정보 저장
      await onUpdateCrmExt({
        courtCase: {
          caseNumber: detail.caseNumber,
          courtName: detail.courtName,
          caseType: (detail.caseType.includes('회생') ? '개인회생' : '개인파산') as any,
          filedDate: detail.filedDate,
          lastSyncedAt: detail.lastSyncedAt,
          events: detail.events
        }
      });

      toast.success(
        detail.isB2BLive
          ? '🎉 대법원 전산망 실시간 동기화 완료!'
          : '✨ 법원 사건 데이터가 성공적으로 동기화되었습니다.'
      );
    } catch (err: any) {
      toast.error(err.message || '대법원 사건 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 기일을 CRM 캘린더에 자동 등록
  const handleAddToCalendar = (dateItem: any) => {
    const cleanDate = (dateItem.date || '').split(' ')[0];
    if (!cleanDate) {
      toast.error('유효한 기일 날짜가 없습니다.');
      return;
    }

    createCalendarEvent({
      clientId,
      clientName,
      title: `[법원기일] ${clientName} - ${dateItem.type}`,
      description: `사건번호: ${caseNumber} (${courtName})\n장소: ${dateItem.place}\n결과: ${dateItem.result}`,
      date: cleanDate,
      time: dateItem.date.includes(' ') ? dateItem.date.split(' ')[1] : '14:00',
      category: 'court',
      notifyBeforeHours: 24,
      isLawyerOnly: false
    });

    toast.success(`📅 '${dateItem.type}'이 마이김변 캘린더에 등록되었습니다!`);
  };

  // 감지된 보정명령을 CRM 보정 탭에 자동 추가
  const handleAutoRegisterCorrections = async () => {
    if (!courtDetail) return;
    const detected = extractCorrectionOrdersFromCourt(courtDetail.deliveries);
    if (detected.length === 0) {
      toast.info('추가할 신규 보정명령이 없습니다.');
      return;
    }

    const existing = crmExt.corrections || crmExt.correctionOrders || [];
    const merged = [...existing];

    let addedCount = 0;
    for (const item of detected) {
      if (!merged.some(m => m.title === item.title && m.issuedDate === item.issuedDate)) {
        merged.push(item);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await onUpdateCrmExt({
        corrections: merged,
        correctionOrders: merged
      });
      toast.success(`📮 보정명령 ${addedCount}건이 CRM 보정 탭에 등록되었습니다.`);
    } else {
      toast.info('이미 등록된 보정명령입니다.');
    }
  };

  // 대법원 복사 및 이동
  const handleCopyAndGoScourt = () => {
    const text = `${courtName} ${caseNumber}`;
    navigator.clipboard.writeText(text);
    toast.success(`'${text}' 복사 완료! 대법원 공식 사이트로 이동합니다.`);
    window.open('https://m.scourt.go.kr', '_blank', 'noopener,noreferrer');
  };

  // 감지된 보정명령 목록
  const detectedCorrections = courtDetail ? extractCorrectionOrdersFromCourt(courtDetail.deliveries) : [];

  return (
    <div className="space-y-5 text-left animate-fadeIn">
      {/* ── 0. 관련사건 멀티탭 트래커 (Ch 9-2) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              📁 관련사건 멀티탭 동시 트래커 (본안 · 금지명령 · 중지명령 · 압류집행)
            </span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
              총 {relatedCases.length}건 연동
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCaseModal(true)}
            className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl border border-blue-200 cursor-pointer press-scale whitespace-nowrap"
          >
            + 관련사건 추가
          </button>
        </div>

        {/* 멀티탭 리스트 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {relatedCases.map(rc => {
            const isSelected = selectedCaseId === rc.id;
            return (
              <button
                key={rc.id}
                type="button"
                onClick={() => {
                  setSelectedCaseId(rc.id);
                  setCourtName(rc.court);
                  setCaseNumber(rc.caseNo);
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer whitespace-nowrap min-w-[180px] ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs' 
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                    {rc.type}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${rc.statusColor}`}>
                    {rc.statusBadge}
                  </span>
                </div>
                <div className="font-mono font-extrabold text-xs text-slate-900 truncate">
                  {rc.caseNo}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {rc.court}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 관련사건 추가 간이 모달 */}
      {showAddCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <span>➕ 신규 관련사건 등록 (타채/금지/중지)</span>
              </h3>
              <button 
                type="button"
                onClick={() => setShowAddCaseModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">사건 유형</label>
                <select 
                  value={newCaseType}
                  onChange={(e) => setNewCaseType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold"
                >
                  <option value="금지">금지명령 (개금)</option>
                  <option value="중지">중지명령 (개중)</option>
                  <option value="타채(압류)">강제집행 (타채/타경 압류추심)</option>
                  <option value="종전">과거 회생/파산 종전사건</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">관할 법원</label>
                <select 
                  value={newCaseCourt}
                  onChange={(e) => setNewCaseCourt(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2"
                >
                  {COURTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">사건번호</label>
                <input 
                  type="text"
                  value={newCaseNo}
                  onChange={(e) => setNewCaseNo(e.target.value)}
                  placeholder="예: 2026타채12345"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => setShowAddCaseModal(false)}
                className="px-3 py-1.5 text-xs text-slate-500 font-bold"
              >
                취소
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (!newCaseNo.trim()) return toast.error('사건번호를 입력해주세요');
                  const newEntry: RelatedCourtCase = {
                    id: `rc-${Date.now()}`,
                    type: newCaseType,
                    court: newCaseCourt,
                    caseNo: newCaseNo.trim(),
                    statusBadge: '등록완료',
                    statusColor: 'bg-indigo-100 text-indigo-800 border-indigo-200'
                  };
                  setRelatedCases(prev => [...prev, newEntry]);
                  setSelectedCaseId(newEntry.id);
                  setCourtName(newCaseCourt);
                  setCaseNumber(newCaseNo.trim());
                  setShowAddCaseModal(false);
                  setNewCaseNo('');
                  toast.success(`'${newEntry.caseNo}' 관련사건이 등록되었습니다.`);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs press-scale"
              >
                등록 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 1. 대법원 사건 연동 컨트롤 패널 ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold">
                ⚖️
              </span>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                대법원 나의사건검색 실시간 연동
              </h3>
              {courtDetail && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  courtDetail.isB2BLive 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {courtDetail.isB2BLive ? 'B2B 실시간 연결' : '스마트 검증모드'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              법원명과 사건번호를 입력하면 접수일, 재판부, 기일 및 보정명령 송달 내역이 자동 동기화됩니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAndGoScourt}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap active:scale-[0.98]"
              title="대법원 공식 모바일 웹 바로가기"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>대법원 웹</span>
            </button>

            <button
              type="button"
              onClick={() => handleSyncCourt(true)}
              disabled={isLoading || !caseNumber.trim()}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 whitespace-nowrap active:scale-[0.98]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? '법원 전산 조회중...' : '대법원 실시간 동기화'}</span>
            </button>
          </div>
        </div>

        {/* 입력 필드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              관할 법원
            </label>
            <select
              value={courtName}
              onChange={(e) => setCourtName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {COURTS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              사건번호
            </label>
            <input
              type="text"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="예: 2025개회108492"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
              당사자 성명 (채무자)
            </label>
            <input
              type="text"
              value={clientName}
              readOnly
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-xs font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* ── 2. 로딩 스켈레톤 상태 (taste-skill 규칙) ── */}
      {isLoading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
            <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
          </div>
        </div>
      )}

      {/* ── 3. 동기화 데이터 결과 화면 ── */}
      {!isLoading && courtDetail && (
        <div className="space-y-4">
          
          {/* [알림 배너] 보정명령 송달 감지 시 */}
          {detectedCorrections.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black">
                    🚨 법원 보정명령(권고) 송달 내역 {detectedCorrections.length}건 감지!
                  </h4>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                    대법원 전산망에 보정명령 송달이 확인되었습니다. 마감 기한 내 보정서 제출을 위해 CRM에 등록하세요.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAutoRegisterCorrections}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-sm active:scale-[0.98]"
              >
                보정 관리 탭에 자동 등록
              </button>
            </div>
          )}

          {/* 사건 핵심 현황 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">관할 / 사건유형</span>
              <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                {courtDetail.courtName}
              </p>
              <span className="text-[10px] text-brand font-bold">
                {courtDetail.caseType}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">재판부 / 담당판사</span>
              <p className="text-xs font-black text-slate-900 dark:text-white">
                {courtDetail.department}
              </p>
              <span className="text-[10px] text-slate-500 font-medium">
                {courtDetail.judgeName}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">접수일자</span>
              <p className="text-xs font-black text-slate-900 dark:text-white font-mono">
                {courtDetail.filedDate || '확인중'}
              </p>
              <span className="text-[10px] text-emerald-600 font-bold">
                정상 접수됨
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block">최종 진행상태</span>
              <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                {courtDetail.finalResult || '진행중'}
              </p>
              <span className="text-[10px] text-slate-400">
                {new Date(courtDetail.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 동기화
              </span>
            </div>
          </div>

          {/* 다음 주요 기일 카드 (집회, 심문 등) */}
          {courtDetail.dates.length > 0 && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-slate-50 to-purple-500/10 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      다음 기일: {courtDetail.dates[0].type}
                    </span>
                    {courtDetail.dates[0].dDay !== undefined && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        courtDetail.dates[0].dDay <= 7 
                          ? 'bg-rose-500 text-white animate-pulse' 
                          : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        D-{courtDetail.dates[0].dDay}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                    일시: <span className="font-bold text-slate-900 dark:text-white">{courtDetail.dates[0].date}</span> | 장소: {courtDetail.dates[0].place}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleAddToCalendar(courtDetail.dates[0])}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-[0.98] flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>캘린더에 일정 추가</span>
              </button>
            </div>
          )}

          {/* ── 상세 탭 네비게이션 ── */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pt-2">
            {[
              { id: 'overview', label: '진행 내역', count: courtDetail.events.length },
              { id: 'deliveries', label: '송달 내역', count: courtDetail.deliveries.length },
              { id: 'repayment', label: '변제 현황', count: courtDetail.repayments.length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`pb-2.5 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === tab.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeSubTab === tab.id ? 'bg-brand/10 text-brand' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── 4. 서브탭 콘텐츠 ── */}
          {activeSubTab === 'overview' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {courtDetail.events.map((ev, idx) => (
                <div key={ev.id || idx} className="py-2.5 flex items-start gap-3">
                  <span className="text-[11px] font-mono text-slate-400 shrink-0 w-24 pt-0.5">
                    {ev.date}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {ev.title}
                    </p>
                    {ev.detail && (
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        {ev.detail}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'deliveries' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 divide-y divide-slate-100 dark:divide-slate-800">
              {courtDetail.deliveries.map((del, idx) => (
                <div key={del.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {del.docName}
                      </p>
                      {del.isCorrectionOrder && (
                        <span className="text-[10px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                          보정명령
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">
                      송달대상: {del.target} · {del.status}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {del.deliveryDate}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'repayment' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {courtDetail.repayments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  법원에 등록된 변제금 납부 내역이 아직 없거나 개시결정 전 단계입니다.
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">회차</th>
                      <th className="p-3">납부기한</th>
                      <th className="p-3">실입금일</th>
                      <th className="p-3 text-right">납부금액</th>
                      <th className="p-3 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {courtDetail.repayments.map((rep, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold font-mono">{rep.round}회차</td>
                        <td className="p-3 font-mono text-slate-500">{rep.dueDate}</td>
                        <td className="p-3 font-mono text-slate-800 dark:text-slate-200">{rep.paidDate || '-'}</td>
                        <td className="p-3 font-bold text-right font-mono">{rep.amount.toLocaleString()}원</td>
                        <td className="p-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rep.paidDate ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {rep.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── 4. 빈 상태 (사건 미입력 또는 동기화 전) ── */}
      {!isLoading && !courtDetail && (
        <div className="p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center mx-auto">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              대법원 사건 정보 동기화 대기중
            </h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1">
              상단의 관할 법원과 사건번호를 확인하신 후 [대법원 실시간 동기화] 버튼을 클릭하시면 사건 내역이 자동으로 불러와집니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSyncCourt(false)}
            disabled={!caseNumber.trim()}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>지금 동기화 시작</span>
          </button>
        </div>
      )}
    </div>
  );
}
