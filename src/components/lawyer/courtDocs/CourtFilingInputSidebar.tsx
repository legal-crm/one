/**
 * CourtFilingInputSidebar.tsx
 * 법원 서식 양방향 정보 입력 아코디언 사이드바
 * - 실시간 Two-Way Live Binding (입력 즉시 좌측 법원 공식 서식에 0초 동기화)
 * - 10대 아코디언 섹션 (기본정보, 진술서, 채권자, 부속서류, 재산, 수입/생계비, 변제계획안, 대리인, 송달, 자료제출)
 * - 5대 특약 문구 원클릭 삽입기
 * - 4대 관할법원별 자료제출목록 선택 및 HWP 다운로드 연동
 * - 2026년 기준중위소득 60% 원클릭 생계비 테이블
 * - 서울회생법원 실무기준 자동차 감가율 & 250만원 압류금지 공제한도 검증 가이드
 */

import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { 
  User, FileText, ListOrdered, Paperclip, Coins, 
  Calculator, Calendar, Shield, Send, Layers, 
  ChevronDown, ChevronRight, Plus, Trash2, Download, 
  AlertCircle, CheckCircle2, Info, Sparkles, HelpCircle, Keyboard
} from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../common/DialogProvider';
import { 
  type CourtFilingMasterData, 
  type CourtJurisdiction,
  COURT_JURISDICTIONS,
  STATUTORY_LIVING_COST_60_2026,
  MEDIAN_INCOMES_2026,
  getEvidenceListForJurisdiction,
  recalculateMasterData,
  DEFAULT_SPECIAL_CLAUSES
} from '../../../services/documents/courtFilingEngine';
import {
  type CourtIssueSummary,
  COURT_SECTION_ORDER,
  getFieldDef,
  getFieldValue,
  setFieldValue,
} from '../../../services/documents/courtFieldRegistry';
import { COURT_EDITOR_SHORTCUTS } from './useCourtEditorHotkeys';

export interface CourtFilingInputSidebarHandle {
  /** 필드가 있는 섹션을 열고 입력 칸으로 스크롤 (focus=true 면 포커스까지) */
  revealField: (key: string, opts?: { focus?: boolean }) => boolean;
  /** 섹션을 열고 첫 입력 칸에 포커스 */
  openSectionAt: (index: number) => void;
  /** 단축키 안내 열기/닫기 */
  toggleShortcuts: () => void;
}

interface CourtFilingInputSidebarProps {
  data: CourtFilingMasterData;
  onChangeData: (updated: CourtFilingMasterData) => void;
  activeDocTab: string;
  onSelectDocTab: (tabId: string) => void;
  /** 미입력·형식 오류 요약 (섹션 뱃지·입력 칸 표시용) */
  issueSummary?: CourtIssueSummary;
  /** 입력 칸 포커스 시 해당 필드 키 전달 (서식 강조용) */
  onActiveFieldChange?: (key: string | null) => void;
}

const FOCUSABLE_SELECTOR = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/** 섹션 헤더 옆 미입력 개수 뱃지 */
function SectionIssueBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span
      className="ml-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold"
      title={`확인이 필요한 항목 ${count}건`}
    >
      {count}
    </span>
  );
}

/** 레지스트리 기반 입력 칸 (라벨·필수 표시·인라인 오류 문구 포함) */
function RegField({
  k, data, issueSummary, onChange, mono, type = 'text', placeholder,
}: {
  k: string;
  data: CourtFilingMasterData;
  issueSummary?: CourtIssueSummary;
  onChange: (key: string, value: unknown) => void;
  mono?: boolean;
  type?: 'text' | 'number';
  placeholder?: string;
}) {
  const def = getFieldDef(k);
  const raw = getFieldValue(data, k);
  const issue = issueSummary?.byKey.get(k);
  return (
    <div>
      <label className="text-xs text-slate-400 block mb-1">
        {def?.label ?? k}
        {def?.required && <span className="text-rose-300 ml-0.5" aria-hidden="true">*</span>}
      </label>
      <input
        data-field={k}
        type={type}
        value={raw === undefined || raw === null ? '' : String(raw)}
        placeholder={placeholder}
        aria-invalid={issue ? true : undefined}
        onChange={(e) => onChange(k, type === 'number' ? Number(e.target.value) || 0 : e.target.value)}
        className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 ${mono ? 'font-mono' : ''}`}
      />
      {issue?.kind === 'invalid' && (
        <p className="mt-1 text-[11px] text-rose-300">{issue.message}</p>
      )}
    </div>
  );
}

const CourtFilingInputSidebar = forwardRef<CourtFilingInputSidebarHandle, CourtFilingInputSidebarProps>(function CourtFilingInputSidebar({
  data,
  onChangeData,
  activeDocTab,
  onSelectDocTab,
  issueSummary,
  onActiveFieldChange,
}, ref) {
  const dialog = useDialog();
  // 열려있는 아코디언 섹션 관리
  const [openSection, setOpenSection] = useState<string>('basic');
  const [annexSubTab, setAnnexSubTab] = useState<'secured' | 'disputed' | 'assignment' | 'etc'>('secured');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  // 섹션이 열린 뒤 처리할 이동 요청 (렌더 후 DOM 이 생겨야 찾을 수 있음)
  const pendingRevealRef = useRef<{ key?: string; first?: boolean; focus?: boolean } | null>(null);
  const pendingImeMoveRef = useRef<{ target: HTMLElement; dir: 1 | -1 } | null>(null);
  const [revealTick, setRevealTick] = useState(0);

  // 활성 탭 전환 시 매칭되는 아코디언 섹션 자동 확장
  useEffect(() => {
    // 특정 필드로 이동 중이면 그 필드의 섹션을 우선한다
    if (pendingRevealRef.current) return;
    if (activeDocTab === 'PETITION_COVER' || activeDocTab === 'PETITION_BODY' || activeDocTab === 'SERVICE_REPORT') {
      setOpenSection('basic');
    } else if (activeDocTab === 'STATEMENT') {
      setOpenSection('statement');
    } else if (activeDocTab === 'CREDITOR_LIST') {
      setOpenSection('creditor');
    } else if (activeDocTab === 'ANNEX_DOCS') {
      setOpenSection('annex');
    } else if (activeDocTab === 'ASSET_LIST') {
      setOpenSection('assets');
    } else if (activeDocTab === 'INCOME_EXPENSE') {
      setOpenSection('income');
    } else if (activeDocTab === 'REPAYMENT_PLAN' || activeDocTab === 'REPAYMENT_SCHEDULE') {
      setOpenSection('plan');
    } else if (activeDocTab === 'POWER_OF_ATTORNEY') {
      setOpenSection('lawyer');
    } else if (activeDocTab === 'EVIDENCE_LIST') {
      setOpenSection('evidence');
    }
  }, [activeDocTab]);

  const updateMaster = (updater: (prev: CourtFilingMasterData) => CourtFilingMasterData) => {
    const updated = updater(data);
    onChangeData(recalculateMasterData(updated));
  };

  /** 레지스트리 경로로 값 수정 */
  const updateField = (key: string, value: unknown) => {
    updateMaster(prev => setFieldValue(prev, key, value));
  };

  const getFocusables = (): HTMLElement[] => {
    const root = asideRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(el => el.offsetParent !== null);
  };

  /** 섹션 열기 + 렌더 후 처리할 이동 요청 등록 */
  const requestReveal = (section: string, req: { key?: string; first?: boolean; focus?: boolean }) => {
    pendingRevealRef.current = req;
    setOpenSection(section);
    setRevealTick(t => t + 1);
  };

  useImperativeHandle(ref, () => ({
    revealField: (key, opts) => {
      const def = getFieldDef(key);
      if (!def) return false;
      requestReveal(def.section, { key: def.key, focus: opts?.focus });
      return true;
    },
    openSectionAt: (index) => {
      const section = COURT_SECTION_ORDER[index];
      if (section) requestReveal(section, { first: true, focus: true });
    },
    toggleShortcuts: () => setShowShortcuts(v => !v),
  }));

  // 섹션이 열린 뒤 대상 입력 칸으로 스크롤·포커스
  useEffect(() => {
    const req = pendingRevealRef.current;
    if (!req) return;
    const raf = requestAnimationFrame(() => {
      pendingRevealRef.current = null;
      const root = asideRef.current;
      if (!root) return;
      let el: HTMLElement | null = null;
      if (req.key) {
        el = root.querySelector<HTMLElement>(`[data-field="${req.key}"]`);
      } else if (req.first) {
        const section = root.querySelector<HTMLElement>(`[data-section-body="${openSection}"]`);
        el = section?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
      }
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.remove('cf-input-flash');
      void el.offsetWidth; // 애니메이션 재시작
      el.classList.add('cf-input-flash');
      window.setTimeout(() => el?.classList.remove('cf-input-flash'), 1300);
      if (req.focus) el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [revealTick, openSection]);

  // 미입력·형식 오류 입력 칸 표시 (기존 입력 칸도 data-field 로 일괄 처리)
  useEffect(() => {
    const root = asideRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-field]').forEach(el => {
      const issue = issueSummary?.byKey.get(el.dataset.field || '');
      el.classList.toggle('cf-input-missing', issue?.kind === 'missing');
      el.classList.toggle('cf-input-invalid', issue?.kind === 'invalid');
      if (issue) el.setAttribute('title', issue.message);
      else el.removeAttribute('title');
    });
  });

  /** Enter 이동: dir=1 다음, -1 이전. 섹션 끝이면 다음 섹션을 연다 */
  const moveFocus = (from: HTMLElement, dir: 1 | -1) => {
    const list = getFocusables();
    const idx = list.indexOf(from);
    const next = idx >= 0 ? list[idx + dir] : undefined;
    if (next) {
      next.focus();
      if (next instanceof HTMLInputElement && (next.type === 'text' || next.type === 'number')) next.select();
      return;
    }
    if (dir === 1) {
      const curIdx = COURT_SECTION_ORDER.indexOf(openSection as typeof COURT_SECTION_ORDER[number]);
      const nextSection = COURT_SECTION_ORDER[curIdx + 1];
      if (nextSection) requestReveal(nextSection, { first: true, focus: true });
    }
  };

  const handleAsideKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    const t = e.target as HTMLElement;
    const tag = t.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
    // textarea 는 줄바꿈이 기본, Ctrl+Enter 로 이동
    if (tag === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
    const dir: 1 | -1 = e.shiftKey ? -1 : 1;
    e.preventDefault();
    // 한글 조합 중 Enter: 조합이 끝난 뒤 이동해야 마지막 글자가 사라지지 않는다
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      pendingImeMoveRef.current = { target: t, dir };
      return;
    }
    moveFocus(t, dir);
  };

  const handleCompositionEnd = () => {
    const pending = pendingImeMoveRef.current;
    if (!pending) return;
    pendingImeMoveRef.current = null;
    window.setTimeout(() => moveFocus(pending.target, pending.dir), 0);
  };

  const handleFocusCapture = (e: React.FocusEvent<HTMLElement>) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-field]')?.dataset.field ?? null;
    onActiveFieldChange?.(key);
  };

  // 관할법원 변경 핸들러
  const handleJurisdictionChange = (jurisdiction: CourtJurisdiction) => {
    updateMaster(prev => ({
      ...prev,
      courtJurisdiction: jurisdiction,
      court: {
        ...prev.court,
        courtName: COURT_JURISDICTIONS[jurisdiction].courtNames[0]
      },
      evidenceList: getEvidenceListForJurisdiction(jurisdiction)
    }));
    toast.info(`관할 법원이 '${COURT_JURISDICTIONS[jurisdiction].title}'(으)로 변경되었습니다. 제출목록 서식이 동기화되었습니다.`);
  };

  // 5대 특약 토글
  const handleToggleSpecialClause = (clauseId: string) => {
    updateMaster(prev => ({
      ...prev,
      specialClauses: prev.specialClauses.map(c => 
        c.id === clauseId ? { ...c, isSelected: !c.isSelected } : c
      )
    }));
    const target = data.specialClauses.find(c => c.id === clauseId);
    toast.success(`'${target?.title}' 특약이 변제계획안에 ${!target?.isSelected ? '추가' : '제외'}되었습니다.`);
  };

  // 생계비 원클릭 적용
  const handleApplyLivingCost = (householdSize: number) => {
    const baseMedian = MEDIAN_INCOMES_2026[householdSize] || 2564238;
    const livingCost = STATUTORY_LIVING_COST_60_2026[householdSize] || Math.round(baseMedian * 0.6);
    
    updateMaster(prev => ({
      ...prev,
      repaymentSummary: {
        ...prev.repaymentSummary,
        householdSize,
        medianIncomeAmount: baseMedian,
        monthlyLivingCost: livingCost,
        medianIncomeRatio: 60
      }
    }));
    toast.success(`2026년 ${householdSize}인 가구 기준 생계비(${livingCost.toLocaleString()}원)가 적용되었습니다.`);
  };

  // HWP 원본 다운로드 핸들러
  const handleDownloadHwp = (jurisdiction: CourtJurisdiction) => {
    const meta = COURT_JURISDICTIONS[jurisdiction];
    const a = document.createElement('a');
    a.href = meta.downloadUrl;
    a.download = meta.hwpFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`'${meta.hwpFileName}' 대법원 공인 서식 다운로드를 시작합니다.`);
  };

  return (
    <aside
      ref={asideRef}
      onKeyDown={handleAsideKeyDown}
      onCompositionEnd={handleCompositionEnd}
      onFocusCapture={handleFocusCapture}
      className="w-[430px] shrink-0 bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden text-slate-200 select-none print:hidden">
      {/* 1. 사이드바 상단 헤더 */}
      <div className="relative px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              <span>정보 입력</span>
              <button
                type="button"
                onClick={() => setShowShortcuts(v => !v)}
                aria-expanded={showShortcuts}
                className="press-scale inline-flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-1.5 py-0.5 rounded-lg border border-slate-700 whitespace-nowrap"
                title="단축키 안내 (?)"
              >
                <Keyboard className="w-3 h-3" />
                단축키
              </button>
            </h3>
            <p className="text-xs text-slate-400">입력 칸을 누르면 왼쪽 서식에서 위치가 표시됩니다</p>
          </div>
        </div>

        {/* 관할 법원 미니 배지 */}
        <div className="text-right">
          <div className="text-xs text-slate-400">현재 관할</div>
          <div className="text-xs font-semibold text-indigo-300 truncate max-w-[120px]">
            {data.court.courtName}
          </div>
        </div>

        {showShortcuts && (
          <div className="absolute left-4 right-4 top-full mt-2 z-20 rounded-2xl border border-slate-700 bg-slate-950 shadow-xl p-4 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white">키보드 단축키</span>
              <button type="button" onClick={() => setShowShortcuts(false)} className="text-slate-400 hover:text-white px-1">닫기</button>
            </div>
            <ul className="divide-y divide-slate-800">
              {COURT_EDITOR_SHORTCUTS.map(s => (
                <li key={s.keys} className="flex items-center justify-between py-1.5">
                  <span className="text-slate-300">{s.desc}</span>
                  <kbd className="font-mono text-[11px] text-slate-200 bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-0.5 whitespace-nowrap">{s.keys}</kbd>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. 아코디언 스크롤 영역 */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-3 space-y-2">
        
        {/* ── [1] 기본 정보 ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'basic' ? '' : 'basic');
              onSelectDocTab('PETITION_COVER');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-100">기본 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.basic} />
              <span className="text-xs text-slate-500 font-mono">신청인·대리인·법원</span>
            </div>
            {openSection === 'basic' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'basic' && (
            <div data-section-body="basic" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">신청인 성명</label>
                  <input data-field="debtor.name"
                    type="text"
                    value={data.debtor.name}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      debtor: { ...prev.debtor, name: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">주민등록번호</label>
                  <input data-field="debtor.residentNumber"
                    type="text"
                    value={data.debtor.residentNumber}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      debtor: { ...prev.debtor, residentNumber: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">신청인 주민등록주소</label>
                <div className="flex gap-1.5">
                  <input data-field="debtor.residentAddress"
                    type="text"
                    value={data.debtor.residentAddress}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      debtor: { ...prev.debtor, residentAddress: e.target.value }
                    }))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <button 
                    onClick={() => toast.info('도로명주소 검색 팝업이 호출됩니다.')}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 whitespace-nowrap"
                  >
                    주소 찾기
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">신청인 현거주지 주소</label>
                <input data-field="debtor.currentAddress"
                  type="text"
                  value={data.debtor.currentAddress}
                  onChange={(e) => updateMaster(prev => ({
                    ...prev,
                    debtor: { ...prev.debtor, currentAddress: e.target.value }
                  }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">송달 영수인</label>
                  <input data-field="debtor.serviceRecipient"
                    type="text"
                    value={data.debtor.serviceRecipient}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      debtor: { ...prev.debtor, serviceRecipient: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">휴대전화 번호</label>
                  <input data-field="debtor.phone"
                    type="text"
                    value={data.debtor.phone}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      debtor: { ...prev.debtor, phone: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <RegField k="debtor.serviceAddress" data={data} issueSummary={issueSummary} onChange={updateField} placeholder="송달받을 주소" />

              <div className="grid grid-cols-2 gap-2">
                <RegField k="debtor.homePhone" data={data} issueSummary={issueSummary} onChange={updateField} mono placeholder="02-000-0000" />
                <RegField k="court.applicationDate" data={data} issueSummary={issueSummary} onChange={updateField} mono placeholder="2026. 10. 3." />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">소득 구분</label>
                <div className="flex items-center gap-4 bg-slate-800/60 p-2 rounded-lg border border-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="employmentType"
                      checked={data.debtor.employmentType === '급여소득자'}
                      onChange={() => updateMaster(prev => ({
                        ...prev,
                        debtor: { ...prev.debtor, employmentType: '급여소득자' }
                      }))}
                      className="text-blue-500"
                    />
                    <span>급여소득자</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="employmentType"
                      checked={data.debtor.employmentType === '영업소득자'}
                      onChange={() => updateMaster(prev => ({
                        ...prev,
                        debtor: { ...prev.debtor, employmentType: '영업소득자' }
                      }))}
                      className="text-blue-500"
                    />
                    <span>영업소득자</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">관할 법원</label>
                  <select
                    value={data.courtJurisdiction}
                    onChange={(e) => handleJurisdictionChange(e.target.value as CourtJurisdiction)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="NATIONWIDE">전국 공통 (서울/수원 등 12개)</option>
                    <option value="DAEJEON">대전지방법원 (2023.10.16)</option>
                    <option value="GANGNEUNG">춘천지법 강릉지원</option>
                    <option value="CHEONGJU">청주지방법원 (2022.8.30)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">사건번호</label>
                  <input data-field="court.caseNumber"
                    type="text"
                    value={data.court.caseNumber}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      court: { ...prev.court, caseNumber: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('statement');
                    onSelectDocTab('STATEMENT');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [2] 진술서 정보 ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'statement' ? '' : 'statement');
              onSelectDocTab('STATEMENT');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-100">진술서 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.statement} />
              <span className="text-xs text-slate-500 font-mono">경력·주거·채무경위</span>
            </div>
            {openSection === 'statement' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'statement' && (
            <div data-section-body="statement" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              <div>
                <label className="text-xs text-slate-400 block mb-1">현재 주거상황 구분</label>
                <div className="space-y-1.5 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 text-xs">
                  {(['신청인 소유', '사택 또는 기숙사', '임차(전월세) 주택', '친족 소유 무상거주', '친족 이외 무상거주', '기타'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer hover:text-white">
                      <input
                        type="radio"
                        name="housingType"
                        checked={data.statement.housingType === type}
                        onChange={() => updateMaster(prev => ({
                          ...prev,
                          statement: { ...prev.statement, housingType: type }
                        }))}
                        className="text-blue-500"
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">부채 상황 (소송·지급명령·압류 경험)</label>
                <div className="flex gap-3 bg-slate-800/60 p-2 rounded-lg border border-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="litigationExp"
                      checked={data.statement.hasLitigationOrSeizure}
                      onChange={() => updateMaster(prev => ({
                        ...prev,
                        statement: { ...prev.statement, hasLitigationOrSeizure: true }
                      }))}
                      className="text-blue-500"
                    />
                    <span>있음</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="litigationExp"
                      checked={!data.statement.hasLitigationOrSeizure}
                      onChange={() => updateMaster(prev => ({
                        ...prev,
                        statement: { ...prev.statement, hasLitigationOrSeizure: false }
                      }))}
                      className="text-blue-500"
                    />
                    <span>없음</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">채무 증대 사유 (복수 선택)</label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 text-xs">
                  {['생활비 부족', '병원비 과다지출', '교육비 과다지출', '점포 운영 실패', '주식·코인 손실', '사기 피해', '타인 채무 보증', '고금리 이자 누적'].map((cause) => {
                    const isChecked = data.statement.debtCauses.includes(cause);
                    return (
                      <label key={cause} className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            updateMaster(prev => ({
                              ...prev,
                              statement: {
                                ...prev.statement,
                                debtCauses: isChecked 
                                  ? prev.statement.debtCauses.filter(c => c !== cause)
                                  : [...prev.statement.debtCauses, cause]
                              }
                            }));
                          }}
                          className="rounded text-blue-500"
                        />
                        <span>{cause}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">【별지】 채무 부담 경위서 상세</label>
                <textarea data-field="statement.detailedReasonEssay"
                  rows={4}
                  value={data.statement.detailedReasonEssay}
                  onChange={(e) => updateMaster(prev => ({
                    ...prev,
                    statement: { ...prev.statement, detailedReasonEssay: e.target.value }
                  }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-white leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('creditor');
                    onSelectDocTab('CREDITOR_LIST');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [3] 채권 목록 정보 ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'creditor' ? '' : 'creditor');
              onSelectDocTab('CREDITOR_LIST');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <ListOrdered className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-100">채권 목록 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.creditor} />
              <span className="text-xs text-purple-300 font-mono bg-purple-900/40 px-1.5 py-0.5 rounded">
                {data.creditors.length}개 기관
              </span>
            </div>
            {openSection === 'creditor' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'creditor' && (
            <div data-section-body="creditor" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              <div className="space-y-1 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700">
                <label className="text-xs text-slate-400 block mb-1">변제 유형 선택</label>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="repayType"
                      checked={data.repaymentSummary.repaymentType === '원금변제'}
                      onChange={() => updateMaster(prev => ({
                        ...prev,
                        repaymentSummary: { ...prev.repaymentSummary, repaymentType: '원금변제' }
                      }))}
                      className="text-purple-500"
                    />
                    <span>원리금변제 (원금변제 완료 후 이자변제하는 순)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="repayType"
                      checked={data.repaymentSummary.repaymentType === '원리금변제'}
                      onChange={() => updateMaster(prev => ({
                        ...prev,
                        repaymentSummary: { ...prev.repaymentSummary, repaymentType: '원리금변제' }
                      }))}
                      className="text-purple-500"
                    />
                    <span>원리금합산변제 (원금과 이자를 합산 매월 동시 변제)</span>
                  </label>
                </div>
              </div>

              {/* 채권자 목록 카드들 */}
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {data.creditors.map((creditor, idx) => (
                  <div key={creditor.id} className="p-2.5 bg-slate-800 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-700 text-xs text-center leading-4 font-mono">{idx + 1}</span>
                        <span>{creditor.name}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        원금: <strong className="text-purple-300">{(creditor.currentPrincipal || 0).toLocaleString()}원</strong> / 이자: {(creditor.currentInterest || 0).toLocaleString()}원
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        const confirmed = await dialog.confirm({
                          title: '채권자 삭제',
                          message: `'${creditor.name}' 채권자를 목록에서 삭제하시겠습니까?`,
                          confirmText: '삭제',
                          cancelText: '취소',
                          variant: 'danger',
                        });
                        if (!confirmed) return;
                        updateMaster(prev => ({
                          ...prev,
                          creditors: prev.creditors.filter(c => c.id !== creditor.id)
                        }));
                        toast.info(`'${creditor.name}' 채권자가 목록에서 삭제되었습니다.`);
                      }}
                      className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={async () => {
                  // 이전: prompt() 사용 -> dialog.prompt로 교체
                  const newName = await dialog.prompt({
                    title: '채권자 추가',
                    message: '추가할 금융기관(채권자)명을 입력하세요:',
                    placeholder: '예: 현대카드 주식회사',
                    defaultValue: '현대카드 주식회사',
                    confirmText: '추가',
                    cancelText: '취소',
                  });
                  if (newName && newName.trim()) {
                    const trimmed = newName.trim();
                    updateMaster(prev => ({
                      ...prev,
                      creditors: [
                        ...prev.creditors,
                        {
                          id: `c-${Date.now()}`,
                          name: trimmed,
                          debtType: 'UNSECURED_CREDIT',
                          originalAmount: 10000000,
                          currentPrincipal: 9500000,
                          currentInterest: 120000,
                          totalDebt: 9620000,
                          principalCalculationBasis: '부채증명서 참조',
                          interestCalculationBasis: '연체이자 계산서 참조'
                        }
                      ]
                    }));
                    toast.success(`'${trimmed}' 채권자가 추가되었습니다.`);
                  }
                }}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>채권자 직접 추가</span>
              </button>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('annex');
                    onSelectDocTab('ANNEX_DOCS');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [4] 부속서류 정보 (담보·별제권 실무 팁) ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'annex' ? '' : 'annex');
              onSelectDocTab('ANNEX_DOCS');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Paperclip className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-100">부속서류 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.annex} />
              <span className="text-xs text-amber-300 font-mono">별제권·다툼·전부</span>
            </div>
            {openSection === 'annex' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'annex' && (
            <div data-section-body="annex" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              {/* 서브 탭 */}
              <div className="flex border-b border-slate-800 text-xs">
                {(['secured', 'disputed', 'assignment', 'etc'] as const).map((tab) => {
                  const labels = { secured: '별제권부채권', disputed: '다툼있는채권', assignment: '전부명령', etc: '기타' };
                  return (
                    <button
                      key={tab}
                      onClick={() => setAnnexSubTab(tab)}
                      className={`pb-1.5 px-2.5 border-b-2 font-medium transition ${
                        annexSubTab === tab ? 'border-amber-400 text-amber-300' : 'border-transparent text-slate-400 hover:text-white'
                      }`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* 서울회생법원 실무기준 안내 박스 */}
              <div className="p-2.5 bg-amber-950/40 border border-amber-600/40 rounded-lg text-amber-200 text-xs leading-relaxed">
                <div className="font-bold flex items-center gap-1 text-amber-300 mb-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>※ 자동차 담보 입력 시 실무 유의사항</span>
                </div>
                자동차는 일반 부동산 담보와 달리 별도 기준이 적용될 수 있습니다. <strong>서울회생법원 실무상 신청일 기준 차량 연식이 4년 이내인 경우 환가예상액의 70%, 4년을 초과한 경우 환가예상액의 50%</strong>를 기준으로 산정할 수 있습니다. 사건별 사정에 따라 탄력적으로 조정해 주세요.
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-300 font-semibold">
                  <span>등록된 별제권/담보 채권</span>
                  <span className="text-amber-300">1건</span>
                </div>
                <div className="p-2 bg-slate-800 rounded border border-slate-700">
                  <div className="font-medium text-white">현대캐피탈 주식회사 (차량 근저당)</div>
                  <div className="text-xs text-slate-400 mt-0.5">채권최고액 1,200만원 / 예상변제액 800만원</div>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('assets');
                    onSelectDocTab('ASSET_LIST');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [5] 재산 목록 정보 (250만원 압류금지 공제한도 검증) ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'assets' ? '' : 'assets');
              onSelectDocTab('ASSET_LIST');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-xs font-bold text-slate-100">재산 목록 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.assets} />
              <span className="text-xs text-slate-400 font-mono">
                청산가치 {data.repaymentSummary.liquidationValue.toLocaleString()}원
              </span>
            </div>
            {openSection === 'assets' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'assets' && (
            <div data-section-body="assets" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              {/* 예금 섹션 */}
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">예금 (계좌 잔고)</span>
                  <span className="text-xs text-blue-300">잔액 합계: 120만원</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>압류금지 공제금액</span>
                    <span className="text-yellow-400 font-semibold">최대 250만원</span>
                  </div>
                  <input data-field="assets.bankDeduction"
                    type="number"
                    max={2500000}
                    value={data.assets.bankDeduction}
                    onChange={(e) => {
                      const val = Math.min(2500000, Math.max(0, Number(e.target.value) || 0));
                      updateMaster(prev => ({
                        ...prev,
                        assets: { ...prev.assets, bankDeduction: val }
                      }));
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                  <p className="text-xs text-red-400 mt-1">
                    * 공제금액란에는 250만원을 초과한 금액을 기재할 수 없습니다. [민사집행법 시행령 제7조]
                  </p>
                </div>
              </div>

              {/* 보험 섹션 */}
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">보험 (예상해약환급금)</span>
                  <span className="text-xs text-blue-300">환급금 합계: 180만원</span>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>압류금지 보장성보험 공제금액</span>
                    <span className="text-yellow-400 font-semibold">최대 250만원</span>
                  </div>
                  <input data-field="assets.insuranceDeduction"
                    type="number"
                    max={2500000}
                    value={data.assets.insuranceDeduction}
                    onChange={(e) => {
                      const val = Math.min(2500000, Math.max(0, Number(e.target.value) || 0));
                      updateMaster(prev => ({
                        ...prev,
                        assets: { ...prev.assets, insuranceDeduction: val }
                      }));
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              {/* 임차보증금 */}
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700 space-y-1">
                <div className="font-bold text-white">임차보증금</div>
                <div className="text-xs text-slate-400">
                  보증금 1,000만원 / 서울 소액임차보증금(5,500만원) 전액 압류금지 대상 ➔ 청산가치 0원 자동 반영
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('income');
                    onSelectDocTab('INCOME_EXPENSE');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [6] 수입 및 지출 정보 (2026 기준중위소득 60% 원클릭 테이블) ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection('income');
              onSelectDocTab('INCOME_EXPENSE');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Calculator className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-100">수입 및 지출 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.income} />
              <span className="text-xs text-cyan-300 font-mono">생계비 2026 기준</span>
            </div>
            {openSection === 'income' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'income' && (
            <div data-section-body="income" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              <div>
                <label className="text-xs text-slate-400 block mb-1">월 평균 세후 소득</label>
                <div className="flex items-center gap-2">
                  <input data-field="repaymentSummary.monthlyNetIncome"
                    type="number"
                    step={10000}
                    value={data.repaymentSummary.monthlyNetIncome}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      repaymentSummary: {
                        ...prev.repaymentSummary,
                        monthlyNetIncome: Number(e.target.value) || 0
                      }
                    }))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-xs text-slate-400">원</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <RegField k="debtor.jobTitle" data={data} issueSummary={issueSummary} onChange={updateField} placeholder="예: 사원" />
                <RegField k="debtor.tenureYearsMonths" data={data} issueSummary={issueSummary} onChange={updateField} placeholder="예: 3년 2개월" />
              </div>

              {/* 2026년 기준중위소득 60% 원클릭 선택 버튼 그리드 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 flex justify-between items-center">
                  <span>2026년 기준중위소득 60% 생계비 (가구수 클릭)</span>
                  <span className="text-cyan-400 font-semibold">{data.repaymentSummary.householdSize}인 가구 선택됨</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((size) => {
                    const cost = STATUTORY_LIVING_COST_60_2026[size];
                    const isCurrent = data.repaymentSummary.householdSize === size;
                    return (
                      <button
                        key={size}
                        onClick={() => handleApplyLivingCost(size)}
                        className={`p-2 rounded-lg border text-left transition ${
                          isCurrent 
                            ? 'bg-cyan-600/30 border-cyan-400 text-white font-semibold' 
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                        }`}
                      >
                        <div className="text-xs text-slate-400 font-mono">{size}인 가구</div>
                        <div className="text-xs font-mono text-cyan-200">{Math.round(cost / 10000)}만원</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">적용 법정 생계비:</span>
                  <strong className="text-white font-mono">{data.repaymentSummary.monthlyLivingCost.toLocaleString()}원</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">월 가용소득 (변제금):</span>
                  <strong className="text-cyan-300 font-mono text-xs">{data.repaymentSummary.monthlyDisposableIncome.toLocaleString()}원</strong>
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('plan');
                    onSelectDocTab('REPAYMENT_PLAN');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [7] 변제계획안 정보 (5대 특약 문구 원클릭 삽입기) ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection('plan');
              onSelectDocTab('REPAYMENT_PLAN');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-100">변제계획안 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.plan} />
              <span className="text-xs text-indigo-300 font-mono">특약 원클릭 삽입</span>
            </div>
            {openSection === 'plan' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'plan' && (
            <div data-section-body="plan" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              <div className="grid grid-cols-2 gap-2">
                <RegField k="repaymentSummary.repaymentMonths" type="number" data={data} issueSummary={issueSummary} onChange={updateField} mono placeholder="36" />
                <RegField k="court.firstRepaymentDate" data={data} issueSummary={issueSummary} onChange={updateField} mono placeholder="2026. 12. 25." />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <RegField k="debtor.refundBank" data={data} issueSummary={issueSummary} onChange={updateField} placeholder="예: 국민" />
                <RegField k="debtor.refundAccount" data={data} issueSummary={issueSummary} onChange={updateField} mono placeholder="신청인 본인 계좌" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">회생위원 계좌 은행</label>
                  <input
                    type="text"
                    value={data.trusteeAccount?.bank || '신한은행'}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      trusteeAccount: { ...prev.trusteeAccount, bank: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">임치 계좌번호</label>
                  <input
                    type="text"
                    value={data.trusteeAccount?.accountNumber || ''}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      trusteeAccount: { ...prev.trusteeAccount, accountNumber: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* 5대 특약 문구 원클릭 추가 버튼 그룹 */}
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 flex items-center gap-1">
                  <span>법원 필수 특약 문구 원클릭 추가 (클릭 시 토글)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {data.specialClauses?.map((clause) => (
                    <button
                      key={clause.id}
                      onClick={() => handleToggleSpecialClause(clause.id)}
                      className={`px-2.5 py-2 rounded-lg text-left border text-xs font-medium transition ${
                        clause.isSelected
                          ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 shadow-sm'
                          : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{clause.title}</span>
                        {clause.isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 현재 변제계획안 10. 기타사항 미리보기 */}
              <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700 space-y-1">
                <div className="text-xs text-slate-400 font-semibold">변제계획안 반영 특약 ({data.specialClauses.filter(c => c.isSelected).length}건)</div>
                <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-slate-300">
                  {data.specialClauses.filter(c => c.isSelected).map(c => (
                    <div key={c.id} className="border-b border-slate-700/50 pb-1">
                      <strong>&lt;{c.title}&gt;</strong> {c.content.slice(0, 50)}...
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  onClick={() => {
                    setOpenSection('evidence');
                    onSelectDocTab('EVIDENCE_LIST');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  다음 단계 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── [8] 대리인 정보 ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'lawyer' ? '' : 'lawyer');
              onSelectDocTab('POWER_OF_ATTORNEY');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-100">대리인 정보</span>
              <SectionIssueBadge count={issueSummary?.countBySection.lawyer} />
              <span className="text-xs text-slate-400 font-mono">{data.lawyer.firmName}</span>
            </div>
            {openSection === 'lawyer' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'lawyer' && (
            <div data-section-body="lawyer" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">대리인 법률사무소</label>
                  <input data-field="lawyer.firmName"
                    type="text"
                    value={data.lawyer.firmName}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      lawyer: { ...prev.lawyer, firmName: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">담당 변호사 성명</label>
                  <input data-field="lawyer.lawyerName"
                    type="text"
                    value={data.lawyer.lawyerName}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      lawyer: { ...prev.lawyer, lawyerName: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">사무실 주소</label>
                <input data-field="lawyer.address"
                  type="text"
                  value={data.lawyer.address}
                  onChange={(e) => updateMaster(prev => ({
                    ...prev,
                    lawyer: { ...prev.lawyer, address: e.target.value }
                  }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">사무실 전화</label>
                  <input data-field="lawyer.phone"
                    type="text"
                    value={data.lawyer.phone}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      lawyer: { ...prev.lawyer, phone: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">FAX 번호</label>
                  <input data-field="lawyer.fax"
                    type="text"
                    value={data.lawyer.fax}
                    onChange={(e) => updateMaster(prev => ({
                      ...prev,
                      lawyer: { ...prev.lawyer, fax: e.target.value }
                    }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <RegField k="lawyer.email" data={data} issueSummary={issueSummary} onChange={updateField} mono placeholder="name@lawfirm.com" />
            </div>
          )}
        </div>

        {/* ── [9] 자료 제출 (4대 관할법원 목록 & HWP 다운로드) ── */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden transition">
          <button
            onClick={() => {
              setOpenSection(openSection === 'evidence' ? '' : 'evidence');
              onSelectDocTab('EVIDENCE_LIST');
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition"
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-bold text-slate-100">자료 제출 (법원별 제출목록)</span>
              <SectionIssueBadge count={issueSummary?.countBySection.evidence} />
              <span className="text-xs text-pink-300 font-mono bg-pink-900/40 px-1.5 py-0.5 rounded">
                HWP 다운로드
              </span>
            </div>
            {openSection === 'evidence' ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {openSection === 'evidence' && (
            <div data-section-body="evidence" className="p-4 pt-1 space-y-3 text-xs border-t border-slate-800/60 bg-slate-900/40">
              {/* 관할법원 4개 권역 선택 버튼 */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 block">관할 권역별 표준 서식 다운로드</label>
                {(['NATIONWIDE', 'GANGNEUNG', 'DAEJEON', 'CHEONGJU'] as CourtJurisdiction[]).map((jId) => {
                  const meta = COURT_JURISDICTIONS[jId];
                  const isCurrent = data.courtJurisdiction === jId;
                  return (
                    <div 
                      key={jId}
                      className={`p-2.5 rounded-lg border flex items-center justify-between transition ${
                        isCurrent 
                          ? 'bg-slate-800 border-indigo-500/70 shadow-sm' 
                          : 'bg-slate-850/60 border-slate-700/60'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                          <span>{meta.title}</span>
                          {isCurrent && <span className="text-xs bg-indigo-600 px-1 rounded text-white font-mono">선택됨</span>}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{meta.hwpFileName}</div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleJurisdictionChange(jId)}
                          className={`px-2 py-1 rounded text-xs font-medium transition ${
                            isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                          }`}
                        >
                          서식적용
                        </button>
                        <button
                          onClick={() => handleDownloadHwp(jId)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1 shadow-sm transition"
                          title="대법원 공인 HWP 양식 다운로드"
                        >
                          <Download className="w-3 h-3" />
                          <span>다운로드</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 서류 체크리스트 빠른 토글 */}
              <div className="space-y-1.5 pt-1">
                <div className="text-xs text-slate-400 font-semibold flex justify-between items-center">
                  <span>제출 서류 항목 체크 ({data.evidenceList.filter(e => e.isSubmitted).length} / {data.evidenceList.length})</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {data.evidenceList.map((item) => (
                    <label key={item.id} className="flex items-center justify-between p-1.5 bg-slate-800 rounded border border-slate-700/60 cursor-pointer hover:bg-slate-750">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <input
                          type="checkbox"
                          checked={item.isSubmitted}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            updateMaster(prev => ({
                              ...prev,
                              evidenceList: prev.evidenceList.map(ev => 
                                ev.id === item.id ? { ...ev, isSubmitted: checked } : ev
                              )
                            }));
                          }}
                          className="rounded text-blue-500"
                        />
                        <span className="text-xs text-slate-200 truncate">{item.name}</span>
                      </div>
                      {item.isRequired && <span className="text-xs text-red-400 shrink-0 font-semibold">필수</span>}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </aside>
  );
});

export default CourtFilingInputSidebar;
