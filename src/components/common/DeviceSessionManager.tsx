// ============================================================
// [SECURITY] 로그인 기기 & 세션 관리 컴포넌트 (DeviceSessionManager)
// 구글, 깃허브, 토스 등 유수 보안 표준 벤치마킹 적용
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Laptop, 
  Smartphone, 
  Tablet, 
  ShieldCheck, 
  LogOut, 
  Globe, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Info,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { UserSession, LoginAuditEntry } from '../../types/session';
import { 
  getActiveSessions, 
  revokeSession, 
  revokeAllOtherSessions, 
  getLoginAuditHistory,
  getCurrentSessionId
} from '../../services/sessionService';
import { formatRelativeTime } from '../../utils/deviceDetector';
import { useDialog } from './DialogProvider';

interface DeviceSessionManagerProps {
  userId: string;
  userName: string;
  userRole: 'LAWYER' | 'ADMIN' | 'STAFF';
  userEmail?: string;
  firmName?: string;
}

export default function DeviceSessionManager({
  userId,
  userName,
  userRole,
  userEmail,
  firmName,
}: DeviceSessionManagerProps) {
  const dialog = useDialog();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'devices' | 'history'>('devices');

  const fetchSessionData = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeList = await getActiveSessions(userId);
      const historyList = getLoginAuditHistory(userId);
      setSessions(activeList);
      setLoginHistory(historyList);
    } catch (err) {
      toast.error('세션 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  // 현재 기기와 다른 기기 분리
  const currentSession = sessions.find(s => s.isCurrentSession);
  const otherSessions = sessions.filter(s => !s.isCurrentSession);

  // 기기 형태별 아이콘 렌더링
  const renderDeviceIcon = (type: string, className = 'w-5 h-5') => {
    switch (type) {
      case 'mobile':
        return <Smartphone className={className} />;
      case 'tablet':
        return <Tablet className={className} />;
      default:
        return <Laptop className={className} />;
    }
  };

  // 단일 기기 원격 로그아웃
  const handleRevokeSingle = async (session: UserSession) => {
    const confirmed = await dialog.confirm({
      title: '원격 로그아웃 확인',
      message: `[${session.device.os} · ${session.device.browser}] 기기에서 원격으로 로그아웃하시겠습니까?\n해당 기기의 모든 작업이 즉시 종료됩니다.`,
      confirmLabel: '원격 로그아웃',
      cancelLabel: '취소',
      variant: 'danger',
    });

    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const ok = await revokeSession(session.id, 'user', '사용자가 기기 관리에서 원격 로그아웃');
      if (ok) {
        toast.success(`[${session.device.os}] 기기에서 원격 로그아웃되었습니다.`);
        await fetchSessionData();
      } else {
        toast.error('원격 로그아웃 처리에 실패했습니다.');
      }
    } catch {
      toast.error('원격 로그아웃 중 통신 오류가 발생했습니다.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // 다른 모든 기기 일괄 로그아웃
  const handleRevokeAllOthers = async () => {
    if (otherSessions.length === 0) {
      toast.info('종료할 다른 활성 기기가 없습니다.');
      return;
    }

    const confirmed = await dialog.confirm({
      title: '모든 다른 기기에서 로그아웃',
      message: `현재 접속 중인 이 기기를 제외한 다른 모든 기기(${otherSessions.length}대)에서 일괄 로그아웃하시겠습니까?\n사무실, 모바일 등 모든 원격 세션이 즉시 폐기됩니다.`,
      confirmLabel: '다른 모든 기기 로그아웃',
      cancelLabel: '취소',
      variant: 'danger',
    });

    if (!confirmed) return;

    setIsActionLoading(true);
    try {
      const currentId = getCurrentSessionId() || undefined;
      const count = await revokeAllOtherSessions(userId, currentId);
      toast.success(`다른 모든 기기(${count}대)에서 안전하게 로그아웃되었습니다.`);
      await fetchSessionData();
    } catch {
      toast.error('일괄 로그아웃 처리 중 오류가 발생했습니다.');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── 보안 헤더 요약 ── */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1E3A5F] to-slate-900 rounded-2xl p-5 md:p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/10">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">로그인 기기 & 세션 보안 센터</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              보안 암호화 적용 중
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed">
            {userName} ({userRole === 'ADMIN' ? '통합 관리자' : `${firmName || '법률사무소'} 변호사`}) 계정으로 접속 중인 모든 기기를 실시간 모니터링하고 원격으로 안전하게 제어합니다.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={fetchSessionData}
            disabled={isLoading || isActionLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 border border-white/10"
            title="새로고침"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>상태 갱신</span>
          </button>
          <button
            onClick={handleRevokeAllOthers}
            disabled={isLoading || isActionLoading || otherSessions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-rose-900/30 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>다른 모든 기기 로그아웃</span>
          </button>
        </div>
      </div>

      {/* ── 탭 네비게이션 ── */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveSubTab('devices')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-2 ${
            activeSubTab === 'devices'
              ? 'bg-[#1E3A5F] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>접속 중인 기기 목록</span>
          <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-extrabold ${
            activeSubTab === 'devices' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {sessions.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-[0.98] flex items-center gap-2 ${
            activeSubTab === 'history'
              ? 'bg-[#1E3A5F] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>최근 로그인 보안 이력</span>
        </button>
      </div>

      {/* ── 기기 목록 탭 콘텐츠 ── */}
      {activeSubTab === 'devices' && (
        <div className="space-y-6">
          {/* 1. 현재 접속 기기 카드 (강조) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>현재 사용 중인 기기</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">이 브라우저에서 작업 중입니다</span>
            </div>

            {currentSession ? (
              <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl tracking-wider uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Current Device</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                      {renderDeviceIcon(currentSession.device.deviceType, 'w-6 h-6')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-base">
                          {currentSession.device.os} · {currentSession.device.browser}
                        </span>
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                          이 기기
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span>{currentSession.device.location} ({currentSession.device.ipAddress})</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>로그인: {formatRelativeTime(currentSession.createdAt)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      실시간 세션 활성 중
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm">
                현재 세션 정보를 식별하는 중입니다...
              </div>
            )}
          </div>

          {/* 2. 다른 활성 기기 카드 목록 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <span>다른 활성 기기</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {otherSessions.length}대 접속 중
                </span>
              </h3>
              {otherSessions.length > 0 && (
                <span className="text-xs text-slate-500">본인이 사용하지 않는 기기는 즉시 로그아웃하세요</span>
              )}
            </div>

            {otherSessions.length > 0 ? (
              <div className="space-y-3">
                {otherSessions.map((s) => (
                  <div 
                    key={s.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start sm:items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                        {renderDeviceIcon(s.device.deviceType, 'w-5 h-5')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {s.device.os} · {s.device.browser}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {s.device.deviceType.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Globe className="w-3.5 h-3.5 text-slate-400" />
                            <span>{s.device.location} ({s.device.ipAddress})</span>
                          </span>
                          <span>•</span>
                          <span>최근 활동: {formatRelativeTime(s.lastActiveAt)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRevokeSingle(s)}
                      disabled={isActionLoading}
                      className="self-end sm:self-center flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer active:scale-[0.98] whitespace-nowrap"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>원격 로그아웃</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-800">다른 기기에서 로그인된 세션이 없습니다</p>
                <p className="text-xs text-slate-500">
                  현재 사용 중인 이 기기만 단독 접속되어 있어 계정이 안전하게 보호되고 있습니다.
                </p>
              </div>
            )}
          </div>

          {/* 3. 보안 권고사항 안내 */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-950">보안 관리자 주의사항</p>
              <p className="mt-0.5 text-amber-800">
                공용 PC나 카페 등 외부 환경에서 접속 후 로그아웃하지 않은 세션이 있다면 반드시 <b>[원격 로그아웃]</b>을 실행해 주세요.
                의뢰인의 회생·파산 개인정보 및 법률 상담 내역을 보호하기 위해 30분 동안 활동이 없으면 자동 잠금 처리됩니다.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 최근 로그인 이력 탭 ── */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">최근 30일 접속 이력 (보안 감사)</h3>
              <p className="text-xs text-slate-500 mt-0.5">계정에 로그인된 일시와 위치, 기기 정보를 기록합니다.</p>
            </div>
            <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
              총 {loginHistory.length}건 기록
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-2.5 px-3">접속 일시</th>
                  <th className="py-2.5 px-3">접속 결과</th>
                  <th className="py-2.5 px-3">운영체제 / 브라우저</th>
                  <th className="py-2.5 px-3">접속 IP</th>
                  <th className="py-2.5 px-3">추정 위치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loginHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3">
                      {item.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          로그인 성공
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          {item.status === 'LOCKED' ? '계정 잠금' : '실패'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium whitespace-nowrap">
                      {item.device.os} · {item.device.browser}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                      {item.device.ipAddress}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {item.device.location}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
