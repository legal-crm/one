import React, { useState } from 'react';
import { ShieldAlert, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { recordHoneypotAttack } from '../../services/honeypotService';

/**
 * 해커 유인용 허니팟(Honeypot) 관리자 로그인 컴포넌트
 * - 뻔한 주소(?role=admin)로 유입된 공격자/봇을 가짜 로그인 창으로 유인
 * - 2.5초 인위적 지연(Tarpit)으로 자동화 무차별 대입 공격(Brute Force) 무력화
 * - 공격자 침입 정보(시도 ID, 시간, User-Agent 등)를 로컬 및 감사 로그에 기록
 */
export default function HoneypotAdminLogin() {
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword.trim()) {
      setErrorMessage('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // 인위적 지연 (Tarpit 2.5초): 공격자의 자동화 도구를 지연시키고 리소스를 소모시킴
    const startTime = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const tarpitDuration = Date.now() - startTime;

    // 허니팟 침입 로깅 (비밀번호는 원문이 아닌 길이만 기록하여 보안 준수)
    recordHoneypotAttack(loginId, loginPassword.length, tarpitDuration);
    setAttempts((prev) => prev + 1);

    setIsLoading(false);
    setLoginPassword('');
    setErrorMessage(
      '인증에 실패했습니다. (보안 경고: 비인가 관리자 경로 접근이 탐지되어 접근 IP와 세션 정보가 보안 관제 센터에 영구 기록되었습니다.)'
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-indigo-600 selection:text-white items-center justify-center p-4">
      {/* Search Crawler Disallow Notice */}
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />

      <div className="w-full max-w-md bg-[#0F121C] border border-[#1E293B]/60 shadow-2xl rounded-3xl p-6 md:p-8 space-y-6 text-center animate-fadeIn">
        {/* Logo / Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <span className="font-black text-xl tracking-tight text-white">my김변 통합 어드민</span>
          </div>
          <p className="text-slate-500 text-sm">플랫폼 통합 의뢰인 및 파트너 제어 관리 센터</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <h3 className="font-extrabold text-base text-slate-200 border-b border-[#1E293B]/50 pb-2 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>관리자 인증</span>
          </h3>

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm p-3.5 rounded-xl space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>접근 통제 경고</span>
              </div>
              <p className="leading-relaxed">{errorMessage}</p>
              {attempts >= 2 && (
                <p className="text-[11px] text-red-300/80 pt-1 border-t border-red-500/20">
                  누적 실패 {attempts}회 — 반복 시도 시 네트워크 방화벽에 의해 해당 대역이 영구 차단됩니다.
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm text-slate-400 block uppercase font-bold">어드민 ID</label>
            <input
              type="text"
              placeholder="어드민 아이디 입력"
              value={loginId}
              disabled={isLoading}
              onChange={(e) => setLoginId(e.target.value)}
              className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-slate-400 block uppercase font-bold">비밀번호</label>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={loginPassword}
              disabled={isLoading}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full bg-[#07090E] border border-[#1E293B]/80 rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100 placeholder-slate-600 disabled:opacity-50"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-extrabold py-3.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>보안 인증 토큰 검증 중...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>어드민 로그인</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="border-t border-[#1E293B]/40 pt-4 text-center">
          <p className="text-[11px] text-slate-600">
            🔒 IP 추적 및 무결성 감사 로깅 활성화됨 | KISA 2026 보안 준수
          </p>
        </div>
      </div>
    </div>
  );
}
