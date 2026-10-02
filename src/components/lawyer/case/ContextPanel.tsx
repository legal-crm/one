import React, { useState, useMemo } from 'react';
import { 
  User as UserIcon, MessageSquare, StickyNote, X, 
  Phone, PhoneCall, PhoneForwarded, PhoneOff, CheckCircle2, 
  AlertCircle, ChevronRight, Copy, ExternalLink, Calendar, 
  Coins, Sparkles, Shield, Clock, Send, Check, AlertTriangle,
  FileText, CornerDownRight, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, User, CrmNote } from '../../../types';
import type { CommunicationLog } from '../../../types/leadTypes';
import { getDisplayClientName, getDisplayPhoneNumber, isClientContactDisclosed } from '../../../utils/clientDisplay';
import { feeTotalWon, feeAmountWon } from '../../../utils/feeUnits';
import { detectClientIncomeType } from '../../../utils/incomeTypeHelper';

export interface ContextPanelProps {
  clientRequest: ConsultRequest;
  crmExt: CrmClientExtension;
  activeLawyer: User;
  lawyers?: User[];
  staffMembers?: any[];
  isOpen?: boolean;
  mode?: 'docked' | 'drawer';
  activeTab?: 'client' | 'comm' | 'notes';
  onTabChange?: (tab: 'client' | 'comm' | 'notes') => void;
  onClose?: () => void;
  onOpenChat?: () => void;
  onAddNote?: (content: string, type: 'note' | 'thread' | 'task') => Promise<void> | void;
  onUpdateExt?: (updated: Partial<CrmClientExtension>) => Promise<void> | void;
  onOpenFeeTab?: () => void;
  className?: string;
}

/**
 * 사건 컨텍스트 패널 (기획서 4.3 & 5.4 ContextPanel)
 * - [의뢰인] 재무/수임료 팩트시트
 * - [소통] 통화기록/알림톡/메시지
 * - [메모] 상담 메모/내부 스레드/업무 지시 통합
 * - 1280px 미만: 서랍(Drawer), 1280px 이상: 우측 고정(Docked)
 */
export function ContextPanel({
  clientRequest,
  crmExt,
  activeLawyer,
  lawyers = [],
  staffMembers = [],
  isOpen = true,
  mode = 'docked',
  activeTab: controlledTab,
  onTabChange,
  onClose,
  onOpenChat,
  onAddNote,
  onUpdateExt,
  onOpenFeeTab,
  className = '',
}: ContextPanelProps) {
  const [internalTab, setInternalTab] = useState<'client' | 'comm' | 'notes'>('client');
  const activeTab = controlledTab || internalTab;

  const handleSelectTab = (tab: 'client' | 'comm' | 'notes') => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  // 메모 탭 상태
  const [noteFilter, setNoteFilter] = useState<'all' | 'note' | 'task' | 'thread'>('all');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<'note' | 'task' | 'thread'>('note');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // 의뢰인 표시 헬퍼
  const displayName = getDisplayClientName(clientRequest, crmExt);
  const displayPhone = getDisplayPhoneNumber(clientRequest, crmExt);
  const isDisclosed = isClientContactDisclosed(clientRequest, crmExt);

  // 재무 프로필 계산
  const fp = clientRequest.financialProfile || {
    income: 0,
    debtTotal: 0,
    assetsTotal: 0,
    dependents: 0,
    age: undefined,
    specialCondition: 'none',
  };
  const income = fp.income || 0;
  const debtTotal = fp.debtTotal || 0;
  const depCount = fp.dependents || 0;
  const minLivingCost = depCount === 0 ? 133 : depCount === 1 ? 220 : depCount === 2 ? 282 : 343;
  const monthlyDisposable = Math.max(0, income - minLivingCost);
  const isYouthSpecial = Boolean((fp.age && fp.age < 30) || (fp.specialCondition && fp.specialCondition !== 'none'));
  const termMonths = isYouthSpecial ? 24 : 36;
  const estimatedTotalRepay = monthlyDisposable * termMonths;
  const estimatedDischargeRate = debtTotal > 0 ? Math.max(0, Math.min(95, Math.round(((debtTotal - estimatedTotalRepay) / debtTotal) * 100))) : 0;
  const dtiRatio = income > 0 ? (debtTotal / income).toFixed(1) : '-';

  // 소득 유형 정보
  const incomeTypeInfo = detectClientIncomeType(fp, crmExt?.incomeExpenseD5103, clientRequest);

  // 수임료 계산
  const feeSchedule = crmExt?.feeSchedule || [];
  const rawTotalFee = crmExt?.totalFee || crmExt?.contractAmount || 0;
  const totalFeeWon = rawTotalFee > 0 ? feeTotalWon(rawTotalFee) : feeSchedule.reduce((sum, f) => sum + feeAmountWon(f), 0);
  const paidSchedule = feeSchedule.filter(f => f.status === 'paid');
  const overdueSchedule = feeSchedule.filter(f => f.status === 'overdue');
  const pendingSchedule = feeSchedule.filter(f => f.status === 'pending');
  const totalPaidWon = feeSchedule.length > 0
    ? paidSchedule.reduce((sum, f) => sum + feeAmountWon(f), 0)
    : feeTotalWon(crmExt?.totalPaid);
  const unpaidWon = Math.max(0, totalFeeWon - totalPaidWon);
  const paymentRate = totalFeeWon > 0 ? Math.min(100, Math.round((totalPaidWon / totalFeeWon) * 100)) : 0;
  const isFullyPaid = totalFeeWon > 0 && unpaidWon === 0;
  const isOverdue = overdueSchedule.length > 0;
  const nextInst = overdueSchedule[0] || pendingSchedule[0] || null;

  // 메모 / 스레드 / 지시 통합 목록
  const notesList = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'note' | 'task' | 'thread';
      author: string;
      content: string;
      createdAt: string;
      completed?: boolean;
    }> = [];

    // 일반 메모
    (crmExt?.notes || []).forEach(n => {
      list.push({
        id: n.id,
        type: (n.category === 'assignment' || n.category === 'urgent' ? 'task' : 'note'),
        author: n.authorName || '작성자 미상',
        content: n.content,
        createdAt: n.createdAt,
      });
    });

    // 업무 지시
    (crmExt?.assignmentDirectives || []).forEach(d => {
      list.push({
        id: d.id,
        type: 'task',
        author: d.assignedByName || '지시자',
        content: d.memo || '업무 지시',
        createdAt: d.createdAt,
        completed: Boolean(d.acknowledgedAt),
      });
    });

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [crmExt?.notes, crmExt?.assignmentDirectives]);

  const filteredNotes = useMemo(() => {
    if (noteFilter === 'all') return notesList;
    return notesList.filter(n => n.type === noteFilter);
  }, [notesList, noteFilter]);

  // 통화 로그 및 알림톡 로그 통합
  const commHistory = useMemo(() => {
    const logs: Array<{
      id: string;
      type: 'call' | 'alimtalk' | 'sms';
      title: string;
      content?: string;
      timestamp: string;
      status?: string;
    }> = [];

    (crmExt?.communicationLogs || []).forEach(l => {
      const isCall = l.type === 'CALL_IN' || l.type === 'CALL_OUT' || l.type === 'CALL_MISSED';
      logs.push({
        id: l.id,
        type: isCall ? 'call' : 'sms',
        title: isCall ? '통화 기록' : '문자 발송',
        content: l.content,
        timestamp: l.timestamp || l.createdAt,
      });
    });

    (crmExt?.alimtokLogs || []).forEach(a => {
      logs.push({
        id: a.id,
        type: 'alimtalk',
        title: `알림톡 발송 (${a.milestone})`,
        content: a.status === 'sent' ? '발송 완료' : a.errorMessage || a.status,
        timestamp: a.sentAt,
        status: a.status,
      });
    });

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [crmExt?.communicationLogs, crmExt?.alimtokLogs]);

  // 메모 등록
  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setIsSubmittingNote(true);
    try {
      if (onAddNote) {
        await onAddNote(newNoteText.trim(), newNoteType);
      } else if (onUpdateExt) {
        const newNote: CrmNote = {
          id: `note-${Date.now()}`,
          authorId: activeLawyer.id,
          authorName: activeLawyer.name,
          category: newNoteType === 'task' ? 'assignment' : 'consult',
          content: newNoteText.trim(),
          createdAt: new Date().toISOString(),
        };
        await onUpdateExt({
          notes: [newNote, ...(crmExt.notes || [])],
          lastActivityAt: new Date().toISOString(),
        });
      }
      setNewNoteText('');
      toast.success(newNoteType === 'task' ? '업무 지시가 등록되었습니다.' : '메모가 저장되었습니다.');
    } catch {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // 통화 결과 빠른 기록
  const handleQuickCallLog = async (result: 'connected' | 'no_answer' | 'reschedule' | 'rejected' | 'invalid_number') => {
    const labels: Record<string, string> = {
      connected: '통화 완료 (상담 성공)',
      no_answer: '부재중 (미연결)',
      reschedule: '재통화 예약 요청',
      rejected: '상담 거절',
      invalid_number: '결번/오류 번호',
    };

    const newLog: CommunicationLog = {
      id: `comm-${Date.now()}`,
      phoneNumber: clientRequest.phone || '',
      type: result === 'no_answer' ? 'CALL_MISSED' : 'CALL_OUT',
      duration: result === 'connected' ? 180 : 0,
      content: `[통화 기록] ${labels[result]} (기록: ${activeLawyer.name})`,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    if (onUpdateExt) {
      await onUpdateExt({
        communicationLogs: [newLog, ...(crmExt.communicationLogs || [])],
        lastActivityAt: new Date().toISOString(),
      });
      toast.success(`통화 결과: '${labels[result]}' 기록 완료`);
    }
  };

  if (!isOpen) return null;

  const panelContent = (
    <div className="flex flex-col h-full bg-white select-none">
      {/* ── 1. 패널 헤더 (3대 탭 & 닫기 버튼) ── */}
      <div className="px-4 py-3 border-b border-slate-200/90 bg-slate-50/70 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-[#1E3A5F]" />
            <span>사건 컨텍스트</span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="패널 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3대 탭 버튼 */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => handleSelectTab('client')}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'client'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>의뢰인</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('comm')}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'comm'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-emerald-600" />
            <span>소통</span>
            {commHistory.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                {commHistory.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('notes')}
            className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'notes'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-600" />
            <span>메모</span>
            {notesList.length > 0 && (
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-mono">
                {notesList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── 2. 탭별 스크롤 본문 ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs divide-y divide-slate-100">

        {/* ══════════ TAB 1: [의뢰인] 팩트시트 ══════════ */}
        {activeTab === 'client' && (
          <div className="space-y-4">
            {/* 기본 프로필 카드 */}
            <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm truncate">{displayName}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${incomeTypeInfo.badgeClass}`}>
                  {incomeTypeInfo.badgeLabel}
                </span>
              </div>

              {/* 연락처 & 안심번호 */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-slate-600">
                <span className="font-mono text-slate-800">{displayPhone}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (isDisclosed && clientRequest.phone) {
                      navigator.clipboard.writeText(clientRequest.phone);
                      toast.success('전화번호가 복사되었습니다.');
                    } else {
                      toast.info('연락처 공개 승인 후 복사 가능합니다.');
                    }
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
                  title="번호 복사"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 거주지 및 법원 */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60 text-slate-500">
                <div>
                  <span>관할: </span>
                  <span className="font-semibold text-slate-800">{crmExt.courtCase?.courtName || clientRequest.court || '미입력'}</span>
                </div>
                <div>
                  <span>지역: </span>
                  <span className="font-semibold text-slate-800">{crmExt.region || '미입력'}</span>
                </div>
              </div>
            </div>

            {/* 재무 팩트시트 */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-blue-600" />
                  <span>재무 요약 계기판</span>
                </span>
                {isYouthSpecial && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    청년특례 24개월
                  </span>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">총 채무액</span>
                  <span className="font-mono font-bold text-slate-900">{debtTotal.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">월 순소득</span>
                  <span className="font-mono font-bold text-slate-900">{income.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>생계비 ({depCount + 1}인)</span>
                  <span className="font-mono text-slate-700">{minLivingCost}만원</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                  <span className="font-semibold text-slate-700">월 가용소득</span>
                  <span className="font-mono font-bold text-blue-600">{monthlyDisposable.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">채무 배율 (DTI)</span>
                  <span className="font-mono font-bold text-slate-800">{dtiRatio}배</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 font-bold text-slate-900">
                  <span>{termMonths}개월 총 변제금</span>
                  <span className="font-mono text-emerald-600">{estimatedTotalRepay.toLocaleString()}만원</span>
                </div>
                {estimatedDischargeRate > 0 && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>예상 탕감률</span>
                    <span className="font-mono font-bold text-emerald-600">약 {estimatedDischargeRate}%</span>
                  </div>
                )}
              </div>
            </div>

            {/* 수임료 및 분납 현황 */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  <span>수임료 수납 현황</span>
                </span>
                {onOpenFeeTab && (
                  <button
                    type="button"
                    onClick={onOpenFeeTab}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer inline-flex items-center gap-0.5"
                  >
                    <span>상세</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 block">약정 총액</span>
                    <span className="font-mono font-bold text-slate-900">
                      {totalFeeWon > 0 ? `${(totalFeeWon / 10000).toLocaleString()}만원` : '미약정'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 block">수납 완료</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {totalPaidWon > 0 ? `${(totalPaidWon / 10000).toLocaleString()}만원` : '0원'}
                    </span>
                  </div>
                </div>

                {/* 진행 바 */}
                {totalFeeWon > 0 && (
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isFullyPaid ? 'bg-emerald-500' : isOverdue ? 'bg-rose-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${paymentRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{isFullyPaid ? '완납 완료' : `잔액 ${(unpaidWon / 10000).toLocaleString()}만원`}</span>
                      <span className="font-mono font-semibold">{paymentRate}%</span>
                    </div>
                  </div>
                )}

                {nextInst && (
                  <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-500">다음 납부 예정</span>
                    <span className="font-mono font-bold text-slate-800">
                      {nextInst.dueDate} ({(feeAmountWon(nextInst) / 10000).toLocaleString()}만)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB 2: [소통] 통화기록 & 알림톡 ══════════ */}
        {activeTab === 'comm' && (
          <div className="space-y-4">
            {/* 빠른 통화 결과 기록 버튼 5종 */}
            <div className="space-y-2">
              <span className="font-bold text-slate-800 text-xs block">
                빠른 통화 결과 기록
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickCallLog('connected')}
                  className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-lg text-center cursor-pointer transition-colors"
                >
                  상담 완료 (연결)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCallLog('no_answer')}
                  className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold rounded-lg text-center cursor-pointer transition-colors"
                >
                  부재중 (미연결)
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCallLog('reschedule')}
                  className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold rounded-lg text-center cursor-pointer transition-colors"
                >
                  재통화 예약
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickCallLog('rejected')}
                  className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold rounded-lg text-center cursor-pointer transition-colors"
                >
                  상담 거절
                </button>
              </div>
            </div>

            {/* 1:1 상담 채팅 바로가기 버튼 */}
            {onOpenChat && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="w-full py-2 px-3 rounded-xl bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>1:1 실시간 상담 채팅 열기</span>
                </button>
              </div>
            )}

            {/* 소통 이력 타임라인 */}
            <div className="space-y-2 pt-2">
              <span className="font-bold text-slate-800 text-xs block">
                최근 소통 이력 ({commHistory.length}건)
              </span>

              {commHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <PhoneOff className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                  <p>기록된 소통 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {commHistory.slice(0, 10).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 truncate">
                          {log.title}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      {log.content && (
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {log.content}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ TAB 3: [메모] 메모 · 스레드 · 지시 ══════════ */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            {/* 새 메모 / 지시 등록 폼 */}
            <form onSubmit={handleSubmitNote} className="space-y-2">
              <div className="flex items-center gap-1">
                {(['note', 'task', 'thread'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewNoteType(t)}
                    className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer transition-colors ${
                      newNoteType === t
                        ? 'bg-[#1E3A5F] text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'note' ? '일반 메모' : t === 'task' ? '업무 지시' : '내부 스레드'}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder={
                    newNoteType === 'task'
                      ? '사무원/담당자에게 전달할 업무 지시를 입력하세요...'
                      : newNoteType === 'thread'
                      ? '내부 의견 교환 스레드를 입력하세요...'
                      : '상담 메모를 입력하세요...'
                  }
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newNoteText.trim() || isSubmittingNote}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    !newNoteText.trim() || isSubmittingNote
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-[#1E3A5F] hover:bg-[#163152] text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>등록</span>
                </button>
              </div>
            </form>

            {/* 필터 칩 4종 */}
            <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
              {(['all', 'note', 'task', 'thread'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setNoteFilter(f)}
                  className={`px-2 py-0.5 rounded text-xs font-bold cursor-pointer transition-colors ${
                    noteFilter === f
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {f === 'all' ? '전체' : f === 'note' ? '메모' : f === 'task' ? '지시' : '스레드'}
                </button>
              ))}
            </div>

            {/* 목록 */}
            <div className="space-y-2.5">
              {filteredNotes.length === 0 ? (
                <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <StickyNote className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                  <p>등록된 메모가 없습니다.</p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span
                          className={`px-1.5 py-0.2 rounded text-xs ${
                            note.type === 'task'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : note.type === 'thread'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {note.type === 'task' ? '지시' : note.type === 'thread' ? '스레드' : '메모'}
                        </span>
                        <span className="text-slate-800">{note.author}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-xs">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {note.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 드로어 모드 (1280px 미만 또는 슬라이드오버 시트)
  if (mode === 'drawer') {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn">
        <div
          className="absolute inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
          <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 pointer-events-auto flex flex-col animate-slideLeft">
            {panelContent}
          </div>
        </div>
      </div>
    );
  }

  // 닥 모드 (데스크톱 우측 인라인 패널)
  return (
    <aside
      className={`w-full xl:w-[320px] shrink-0 border-l border-slate-200/90 bg-white flex flex-col ${className}`}
    >
      {panelContent}
    </aside>
  );
}

export default ContextPanel;
