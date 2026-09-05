// ============================================================
// [SECURITY] 통합 어드민 전사 실시간 세션 관제 센터 (GlobalSessionMonitor)
// 모든 변호사/직원/관리자의 세션 감시, 이상 징후 탐지 및 긴급 강제 퇴출(Kill-Switch)
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  LogOut, 
  AlertTriangle, 
  Users, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Globe, 
  Filter, 
  Lock, 
  CheckCircle2, 
  XOctagon, 
  SlidersHorizontal 
} from 'lucide-react';
import { toast } from 'sonner';
import { UserSession } from '../../types/session';
import { 
  getAllSessions, 
  revokeSession, 
  revokeAllUserSessionsByAdmin 
} from '../../services/sessionService';
import { formatRelativeTime } from '../../utils/deviceDetector';
import { useDialog } from '../common/DialogProvider';
import DeviceSessionManager from '../common/DeviceSessionManager';

interface GlobalSessionMonitorProps {
  currentAdminEmail: string;
}

export default function GlobalSessionMonitor({ currentAdminEmail }: GlobalSessionMonitorProps) {
  const dialog = useDialog();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [activeViewTab, setActiveViewTab] = useState<'global' | 'my-device'>('global');

  // 필터 상태
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'LAWYER' | 'ADMIN' | 'STAFF'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('active');
  const [onlySuspicious, setOnlySuspicious] = useState<boolean>(false);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getAllSessions();
      setSessions(list);
    } catch {
      toast.error('전사 세션 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 기기 아이콘
  const renderDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'tablet':
        return <Tablet className="w-4 h-4" />;
      default:
        return <Laptop className="w-4 h-4" />;
    }
  };

  // 단일 세션 강제 로그아웃
  const handleKillSession = async (session: UserSession) => {
    const confirmed = await dialog.confirm({
      title: '세션 강제 종료 (Kill Session)',
      message: `[${session.userName}] 사용자의 [${session.device.os} · ${session.device.browser}] 세션을 강제로 종료하시겠습니까?\n해당 기기에서 즉시 강제 로그아웃 처리됩니다.`,
      confirmLabel: '강제 종료',
      cancelLabel: '취소',
      variant: 'danger',
    });

    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const ok = await revokeSession(session.id, 'admin', '통합 관리자에 의한 긴급 강제 종료');
      if (ok) {
        toast.success(`[${session.userName}]의 세션이 강제 종료되었습니다.`);
        await fetchSessions();
      }
    } catch {
      toast.error('세션 종료 처리 중 오류가 발생했습니다.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 특정 사용자 전체 세션 즉각 차단 (Lockdown)
  const handleLockdownUser = async (session: UserSession) => {
    const confirmed = await dialog.confirm({
      title: '계정 세션 전면 차단 (Lockdown)',
      message: `[${session.userName}] 사용자의 모든 기기 세션을 즉시 강제 종료하고 접속을 차단하시겠습니까?\n해당 계정의 모든 활성 세션이 소멸됩니다.`,
      confirmLabel: '전면 차단 & 강제 로그아웃',
      cancelLabel: '취소',
      variant: 'danger',
    });

    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const count = await revokeAllUserSessionsByAdmin(
        session.userId,
        '통합 관리자 보안 명령: 계정 전면 차단'
      );
      toast.success(`[${session.userName}] 사용자의 모든 세션(${count}건)이 즉시 차단되었습니다.`);
      await fetchSessions();
    } catch {
      toast.error('사용자 전면 차단 중 오류가 발생했습니다.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 필터링 적용
  const filteredSessions = sessions.filter((s) => {
    // 상태 필터
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    // 역할 필터
    if (roleFilter !== 'all' && s.userRole !== roleFilter) return false;
    // 이상 징후 필터
    if (onlySuspicious && !s.isSuspicious) return false;
    // 검색어 필터
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase().trim();
      const matchName = s.userName.toLowerCase().includes(q);
      const matchFirm = (s.firmName || '').toLowerCase().includes(q);
      const matchIp = s.device.ipAddress.includes(q);
      const matchOs = s.device.os.toLowerCase().includes(q);
      const matchLoc = s.device.location.toLowerCase().includes(q);
      if (!matchName && !matchFirm && !matchIp && !matchOs && !matchLoc) return false;
    }
    return true;
  });

  // KPI 통계 계산
  const totalActiveCount = sessions.filter(s => s.status === 'active').length;
  const todayStr = new Date().toISOString().split('T')[0];
  const newLoginsToday = sessions.filter(s => s.createdAt.startsWith(todayStr)).length;
  const suspiciousCount = sessions.filter(s => s.isSuspicious && s.status === 'active').length;
  const revokedCount = sessions.filter(s => s.status === 'revoked').length;

  return (
    <div className="space-y-6">
      {/* ── 헤더 & 관제 모드 탭 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-5 md:p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">전사 실시간 세션 관제 & 기기 통제 센터</h2>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              슈퍼 어드민 권한
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-300">
            모든 법률사무소 변호사, 직원, 관리자의 실시간 로그인 세션을 감시하고 의심 접근을 즉각 강제 퇴출(Kill-Switch)합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => setActiveViewTab('global')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
              activeViewTab === 'global'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            플랫폼 전사 관제
          </button>
          <button
            onClick={() => setActiveViewTab('my-device')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-[0.98] ${
              activeViewTab === 'my-device'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            최고 관리자 본인 기기
          </button>
        </div>
      </div>

      {activeViewTab === 'my-device' ? (
        <DeviceSessionManager
          userId={currentAdminEmail}
          userName="대표 관리자"
          userRole="ADMIN"
          userEmail={currentAdminEmail}
          firmName="my김변 본사 관제센터"
        />
      ) : (
        <div className="space-y-6">
          {/* ── 4대 핵심 보안 KPI 카드 ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500">실시간 활성 세션</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{totalActiveCount}</span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  정상 운영
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500">오늘 신규 접속 기기</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{newLoginsToday}</span>
                <span className="text-xs font-semibold text-slate-400">대</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs space-y-1 relative overflow-hidden">
              {suspiciousCount > 0 && (
                <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-rose-500 animate-ping m-2" />
              )}
              <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                이상 징후 / 위험 세션
              </span>
              <div className="flex items-baseline justify-between">
                <span className={`text-2xl font-black ${suspiciousCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {suspiciousCount}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  suspiciousCount > 0 ? 'bg-rose-100 text-rose-700 font-extrabold' : 'bg-slate-100 text-slate-500'
                }`}>
                  {suspiciousCount > 0 ? '즉시 대응 필요' : '이상 없음'}
                </span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
              <span className="text-xs font-bold text-slate-500">강제 종료된 세션</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{revokedCount}</span>
                <span className="text-xs text-slate-400">누적 건</span>
              </div>
            </div>
          </div>

          {/* ── 필터 및 검색 바 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* 검색창 */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="이름, 소속 로펌, IP 주소, OS, 위치 검색..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* 역할 필터 & 이상 징후 토글 & 새로고침 */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none"
                >
                  <option value="all">모든 역할</option>
                  <option value="LAWYER">변호사</option>
                  <option value="STAFF">직원 / 사무원</option>
                  <option value="ADMIN">관리자</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none"
                >
                  <option value="active">활성 세션만</option>
                  <option value="revoked">종료된 세션</option>
                  <option value="all">전체 상태</option>
                </select>

                <button
                  onClick={() => setOnlySuspicious(!onlySuspicious)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] ${
                    onlySuspicious
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>이상 징후만</span>
                </button>

                <button
                  onClick={fetchSessions}
                  disabled={isLoading || isActionLoading}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
                  title="새로고침"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ── 실시간 세션 테이블 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <h3 className="text-sm font-extrabold text-slate-900">모니터링 대상 활성 세션 목록</h3>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {filteredSessions.length}건
                </span>
              </div>
              <span className="text-[11px] text-slate-400">15초마다 실시간 동기화</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold">
                    <th className="py-3 px-4">사용자 / 소속</th>
                    <th className="py-3 px-4">역할</th>
                    <th className="py-3 px-4">접속 기기 및 브라우저</th>
                    <th className="py-3 px-4">접속 IP / 위치</th>
                    <th className="py-3 px-4">최근 활동</th>
                    <th className="py-3 px-4">보안 상태</th>
                    <th className="py-3 px-4 text-right">긴급 제어 액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSessions.map((s) => (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        s.isSuspicious ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* 사용자 정보 */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{s.userName}</span>
                          {s.isCurrentSession && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.2 rounded">
                              본인
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {s.firmName || '소속 정보 없음'} {s.userEmail ? `(${s.userEmail})` : ''}
                        </div>
                      </td>

                      {/* 역할 */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                          s.userRole === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : s.userRole === 'LAWYER'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {s.userRole === 'ADMIN' ? '최고 관리자' : s.userRole === 'LAWYER' ? '변호사' : '직원'}
                        </span>
                      </td>

                      {/* 접속 기기 */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 font-medium text-slate-800">
                          <span className="p-1 bg-slate-100 rounded text-slate-600">
                            {renderDeviceIcon(s.device.deviceType)}
                          </span>
                          <span>{s.device.os} · {s.device.browser}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          로그인: {formatRelativeTime(s.createdAt)}
                        </div>
                      </td>

                      {/* 접속 IP 및 위치 */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-[11px] text-slate-700 font-semibold flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          <span>{s.device.ipAddress}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {s.device.location}
                        </div>
                      </td>

                      {/* 최근 활동 */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatRelativeTime(s.lastActiveAt)}
                      </td>

                      {/* 보안 상태 */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {s.status === 'revoked' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            <XOctagon className="w-3 h-3" />
                            강제 종료됨
                          </span>
                        ) : s.isSuspicious ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 animate-pulse" title={s.suspiciousReason}>
                            <AlertTriangle className="w-3 h-3" />
                            이상 징후 감지
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            정상 세션
                          </span>
                        )}
                      </td>

                      {/* 긴급 제어 액션 */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {s.status === 'active' && !s.isCurrentSession ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleKillSession(s)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
                              title="해당 기기만 강제 로그아웃"
                            >
                              강제 종료
                            </button>
                            <button
                              onClick={() => handleLockdownUser(s)}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-black transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50"
                              title="사용자의 모든 세션 차단"
                            >
                              계정 전면 차단
                            </button>
                          </div>
                        ) : s.isCurrentSession ? (
                          <span className="text-[11px] text-slate-400 font-medium italic">현재 제어 콘솔</span>
                        ) : (
                          <span className="text-[11px] text-slate-400">종료됨</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        조건에 일치하는 활성 세션이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
