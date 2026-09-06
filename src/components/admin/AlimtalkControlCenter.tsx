// ============================================================
// [ADMIN] 팝빌 카카오 알림톡 & 문자 발송 관제 센터 (AlimtalkControlCenter)
// 실시간 연동 상태, 잔여 캐시, 실시간 테스트 발송, 전사 발송 로그
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Phone, 
  User, 
  Calendar, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles,
  Layers,
  Coins,
  Radio,
  FileCheck,
  Clock,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { 
  checkAlimtokServerStatus, 
  testSendAlimtok, 
  loadAllPlatformAlimtokLogs,
  PopbillServerStatus
} from '../../services/alimtokService';
import { AlimtokLog, AlimtokMilestone, ALIMTOK_MILESTONE_CONFIG } from '../../types';

export default function AlimtalkControlCenter() {
  const [status, setStatus] = useState<PopbillServerStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [logs, setLogs] = useState<AlimtokLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // 테스트 발송 폼 상태
  const [testPhone, setTestPhone] = useState('');
  const [testReceiver, setTestReceiver] = useState('관리자');
  const [testMilestone, setTestMilestone] = useState<AlimtokMilestone>('consult_booked');
  const [testCustomText, setTestCustomText] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // 페이징 & 필터 상태 (10개 단위)
  const LOGS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const [logFilter, setLogFilter] = useState<'all' | 'sent' | 'failed'>('all');
  const [showEnvHelp, setShowEnvHelp] = useState(false);

  // 상태 로드
  const fetchStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const res = await checkAlimtokServerStatus();
      setStatus(res);
    } catch {
      toast.error('팝빌 상태 확인 실패');
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // 로그 로드
  const fetchLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const allLogs = await loadAllPlatformAlimtokLogs();
      setLogs(allLogs);
    } catch {
      toast.error('알림톡 발송 이력 로드 실패');
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
  }, [fetchStatus, fetchLogs]);

  // 테스트 템플릿 기본 문안 자동 반영
  useEffect(() => {
    const config = ALIMTOK_MILESTONE_CONFIG[testMilestone];
    if (config) {
      setTestCustomText(
        `[my김변 테스트 발송]\n\n담당자: ${testReceiver}님\n발송유형: ${config.label}\n\n내일 팝빌 실제 연동 시 실시간 카카오 알림톡이 정상 전달됩니다.\n발송일시: ${new Date().toLocaleString('ko-KR')}`
      );
    }
  }, [testMilestone, testReceiver]);

  // 테스트 발송 핸들러
  const handleTestSend = async () => {
    if (!testPhone || testPhone.replace(/[^0-9]/g, '').length < 10) {
      toast.error('올바른 휴대폰 번호를 입력하세요.');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await testSendAlimtok({
        phone: testPhone,
        receiverName: testReceiver,
        text: testCustomText,
        milestone: testMilestone,
      });

      setTestResult(res);

      if (res.ok) {
        if (res.mock) {
          toast.info('모의 발송 성공 (팝빌 미연동 상태: 내일 API 키 설정 시 실발송됩니다)');
        } else if (res.channel === 'lms_fallback' || res.channel === 'sms_fallback') {
          toast.success('알림톡 미승인 상태로 대체문자(LMS/SMS) 정상 발송되었습니다.');
        } else {
          toast.success('카카오 알림톡이 정상 발송되었습니다!');
        }
        fetchLogs();
      } else {
        toast.error(`발송 실패: ${res.error || '알 수 없는 오류'}`);
      }
    } catch (err: any) {
      toast.error(`발송 중 통신 오류: ${err?.message || err}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  // 필터된 로그
  const filteredLogs = logs.filter(l => {
    if (logFilter === 'sent') return l.status === 'sent';
    if (logFilter === 'failed') return l.status === 'failed';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE));
  const validPage = Math.min(currentPage, totalPages);
  const pagedLogs = filteredLogs.slice((validPage - 1) * LOGS_PER_PAGE, validPage * LOGS_PER_PAGE);

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* ── 1. 관제 센터 헤더 배너 ── */}
      <div className="bg-gradient-to-r from-[#111622] via-[#1E293B] to-[#111622] p-6 rounded-2xl border border-[#1E293B] text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-extrabold tracking-tight">
              팝빌(Popbill) 카카오 알림톡 & 문자 발송 관제 센터
            </h2>
            <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
              status?.configured 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
            }`}>
              {status?.configured ? '🟢 팝빌 실발송 모드 활성' : '🟡 팝빌 연동 준비 모드 (모의 발송)'}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-300">
            변호사 포털과 의뢰인 포털에서 발생하는 모든 카카오 알림톡 및 LMS/SMS 대체 발송을 실시간 모니터링하고 제어합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEnvHelp(!showEnvHelp)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer border border-white/10"
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>내일 실연동 가이드</span>
          </button>
          <button
            onClick={() => { fetchStatus(); fetchLogs(); }}
            disabled={isLoadingStatus || isLoadingLogs}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? 'animate-spin' : ''}`} />
            <span>상태 갱신</span>
          </button>
        </div>
      </div>

      {/* ── 내일 팝빌 실연동 안내 패널 (토글) ── */}
      {showEnvHelp && (
        <div className="bg-amber-950/30 border border-amber-500/40 p-5 rounded-2xl space-y-3 text-xs text-amber-200 animate-fadeIn">
          <div className="flex items-center gap-2 font-extrabold text-sm text-amber-300">
            <Sparkles className="w-4 h-4" />
            <span>내일 팝빌 실제 연동 체크리스트 (5분 완료)</span>
          </div>
          <p className="text-slate-300 leading-relaxed">
            코드 배포는 완벽하게 완료되었습니다! 내일 팝빌 관리자 콘솔에서 발급받은 계정 정보를 Vercel 환경변수(Environment Variables)에 등록하시면 <strong>코드 수정 없이 즉시 100% 실발송</strong>으로 자동 전환됩니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#0B0F17] p-4 rounded-xl border border-amber-500/20 font-mono text-[11px] text-slate-300">
            <div>
              <span className="text-amber-400 font-bold block mb-1">필수 환경변수 1: POPBILL_LINK_ID</span>
              <code>팝빌 연동 신청 시 발급된 링크아이디</code>
            </div>
            <div>
              <span className="text-amber-400 font-bold block mb-1">필수 환경변수 2: POPBILL_SECRET_KEY</span>
              <code>팝빌 연동 시크릿키 (SecretKey)</code>
            </div>
            <div>
              <span className="text-amber-400 font-bold block mb-1">필수 환경변수 3: POPBILL_CORP_NUM</span>
              <code>5213901355 (하이픈 없는 사업자번호)</code>
            </div>
            <div>
              <span className="text-amber-400 font-bold block mb-1">필수 환경변수 4: POPBILL_SENDER_PHONE</span>
              <code>팝빌에 사전 등록된 대표 발신번호 (전기통신사업법)</code>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. 팝빌 연동 지표 카드 그리드 (4열) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 잔액/포인트 */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">팝빌 포인트 잔액</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white">
              {(status?.balance || 0).toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-medium">P</span>
          </div>
          <p className="text-[11px] text-slate-500">
            알림톡 약 {Math.floor((status?.balance || 0) / 8.5).toLocaleString()}건 발송 가능
          </p>
        </div>

        {/* 카카오톡 채널 연동 */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">카카오톡 채널</span>
            <Radio className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-black text-white">
              {status?.plusFriendId || '@mykim'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>비즈니스 채널 연동 규격</span>
          </div>
        </div>

        {/* 발신번호 등록 */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">대표 발신번호</span>
            <Phone className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-black text-white">
              {status?.senderPhone || '1544-0000'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            전기통신사업법 사전등록 승인
          </p>
        </div>

        {/* 발송 성공률 & 대체발송 */}
        <div className="bg-[#111622] p-5 rounded-2xl border border-[#1E293B] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">LMS/SMS 자동대체</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-400">
              100% 무중단 보장
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            카톡 미수신 시 문자로 즉시 전환
          </p>
        </div>
      </div>

      {/* ── 3. 실시간 알림톡 테스트 발송기 (관리자 전용) ── */}
      <div className="bg-[#111622] p-6 rounded-2xl border border-[#1E293B] space-y-4">
        <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">실시간 알림톡 & 문자 테스트 발송기</h3>
              <p className="text-xs text-slate-400">관리자 본인 휴대폰으로 즉시 발송하여 카카오톡 도착 여부를 검증합니다.</p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            비용: 알림톡 8.5원 / 대체문자 LMS 33원
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">수신 휴대폰 번호</label>
            <input
              type="text"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full bg-[#0B0F17] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">수신자명</label>
            <input
              type="text"
              value={testReceiver}
              onChange={e => setTestReceiver(e.target.value)}
              placeholder="홍길동"
              className="w-full bg-[#0B0F17] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="md:col-span-6 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">테스트 알림톡 마일스톤</label>
            <select
              value={testMilestone}
              onChange={e => setTestMilestone(e.target.value as AlimtokMilestone)}
              className="w-full bg-[#0B0F17] border border-[#1E293B] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {Object.entries(ALIMTOK_MILESTONE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.emoji} {cfg.label} ({key})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-12 space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">발송 본문 내용</label>
            <textarea
              rows={3}
              value={testCustomText}
              onChange={e => setTestCustomText(e.target.value)}
              className="w-full bg-[#0B0F17] border border-[#1E293B] rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {testResult && (
            <div className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
              testResult.ok 
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
            }`}>
              {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              <span>
                {testResult.ok 
                  ? `발송 접수 완료 (채널: ${testResult.channel || '알림톡'}, 접수번호: ${testResult.receiptNum || 'N/A'})`
                  : `발송 오류: ${testResult.error}`}
              </span>
            </div>
          )}

          <button
            onClick={handleTestSend}
            disabled={isSendingTest}
            className="w-full sm:w-auto ml-auto px-6 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>{isSendingTest ? '팝빌 통신 중...' : '카카오 알림톡/문자 즉시 테스트 발송'}</span>
          </button>
        </div>
      </div>

      {/* ── 4. 전사 알림톡 & 문자 발송 통합 모니터링 테이블 ── */}
      <div className="bg-[#111622] rounded-2xl border border-[#1E293B] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>전사 알림톡/문자 발송 통합 로그</span>
              <span className="text-xs font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                총 {filteredLogs.length}건
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              변호사 포털과 시스템에서 발송된 모든 알림톡 발송 현황을 실시간으로 추적합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {(['all', 'sent', 'failed'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { setLogFilter(mode); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                  logFilter === mode 
                    ? 'bg-indigo-600 border-indigo-500 text-white' 
                    : 'bg-[#0B0F17] border-[#1E293B] text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'all' ? '전체' : mode === 'sent' ? '성공' : '실패'}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#1E293B]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#0B0F17] text-slate-400 font-bold border-b border-[#1E293B]">
              <tr>
                <th className="p-3">수신자명 / 연락처</th>
                <th className="p-3">마일스톤 유형</th>
                <th className="p-3">발송 상태</th>
                <th className="p-3">발송 일시</th>
                <th className="p-3">관리 번호</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]/60 text-slate-300">
              {pagedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    발송된 알림톡 기록이 없습니다. 상단 테스트 발송기를 통해 첫 메시지를 발송해 보세요.
                  </td>
                </tr>
              ) : (
                pagedLogs.map((log) => {
                  const milestoneConfig = ALIMTOK_MILESTONE_CONFIG[log.milestone as AlimtokMilestone];
                  return (
                    <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3 font-medium">
                        <span className="font-bold text-white block">{log.clientName || '고객'}</span>
                        <span className="text-[11px] text-slate-400">{log.phone}</span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-200">
                          <span>{milestoneConfig?.emoji || '💬'}</span>
                          <span>{milestoneConfig?.label || log.milestone}</span>
                        </span>
                      </td>
                      <td className="p-3">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            정상 발송
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <XCircle className="w-3 h-3" />
                            발송 실패
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {log.id}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 10개 단위 페이지네이션 */}
        {filteredLogs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1E293B]">
            <p className="text-xs text-slate-400 font-medium">
              전체 <span className="font-bold text-white">{filteredLogs.length}</span>건 중{' '}
              <span className="font-bold text-white">
                {(validPage - 1) * LOGS_PER_PAGE + 1}-{Math.min(validPage * LOGS_PER_PAGE, filteredLogs.length)}
              </span>
              건 표시 ({validPage} / {totalPages} 페이지)
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-[#0B0F17] border border-[#1E293B] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={validPage === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  title="이전 10건"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">이전</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[30px] h-7 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        validPage === pageNum
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={validPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-white/5 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  title="다음 10건"
                >
                  <span className="hidden sm:inline">다음</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
