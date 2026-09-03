import React, { useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => void;
}

export default function AuthModal({ onClose, onLoginSuccess: _onLoginSuccess }: AuthModalProps) {
  const [authConsent, setAuthConsent] = useState(true);
  const [isLoadingProvider, setIsLoadingProvider] = useState<string | null>(null);

  const handleClose = () => {
    onClose();
  };

  const handleSocialLogin = async (provider: string) => {
    if (!authConsent) {
      alert('필수 개인정보 및 마이데이터 수집 이용 동의를 체크해 주세요.');
      return;
    }
    const supabaseProvider = provider === 'Google' ? 'google' : 'kakao';
    try {
      setIsLoadingProvider(provider);
      // OAuth 리다이렉트 전 플래그 저장 (돌아왔을 때 OAuth 로그인 감지용)
      localStorage.setItem('pending_oauth_login', Date.now().toString());
      const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as any,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        localStorage.removeItem('pending_oauth_login');
        throw error;
      }
    } catch (err: any) {
      setIsLoadingProvider(null);
      localStorage.removeItem('pending_oauth_login');
      alert(`${provider} 로그인 시작 실패: ${err.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-full sm:max-w-md w-full shadow-2xl p-6 md:p-8 space-y-5 relative text-left animate-slideUp sm:animate-fadeIn max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-2xl text-slate-900 dark:text-white mt-1">로그인 및 시작하기</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">비밀번호 없는 1초 안심 간편 로그인</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors shrink-0 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 100% Stealth Anonymity Guarantee Banner */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-4 text-left space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>100% 스텔스 가명 안심 보증</span>
          </div>
          <p className="text-[12px] text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">
            카카오/Google 계정으로 로그인하더라도, 상담 대화방 및 변호사에게는 <strong>임의의 스텔스 가명(예: 신중한 사자)</strong>으로 철저히 보호되어 실명이 일체 노출되지 않습니다.
          </p>
        </div>

        {/* Social Login Buttons */}
        <div className="space-y-3 pt-1">
          {/* Kakao Button */}
          <button
            type="button"
            disabled={!!isLoadingProvider}
            onClick={() => handleSocialLogin('카카오')}
            className="w-full bg-[#FEE500] hover:bg-[#FEE500]/90 text-[#191919] font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm text-sm sm:text-base cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <span className="w-6 h-6 flex items-center justify-center font-black text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full shrink-0">K</span>
            <span>{isLoadingProvider === '카카오' ? '카카오 로그인 연결 중...' : '카카오 1초 간편 로그인'}</span>
          </button>

          {/* Google Button */}
          <button
            type="button"
            disabled={!!isLoadingProvider}
            onClick={() => handleSocialLogin('Google')}
            className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm text-sm sm:text-base cursor-pointer active:scale-[0.98] disabled:opacity-50"
          >
            <span className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full shrink-0">G</span>
            <span>{isLoadingProvider === 'Google' ? 'Google 로그인 연결 중...' : 'Google 계정으로 로그인'}</span>
          </button>
        </div>

        {/* Terms Consent */}
        <div className="flex items-start gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            type="checkbox"
            id="authConsent"
            checked={authConsent}
            onChange={(e) => setAuthConsent(e.target.checked)}
            className="mt-1 rounded border-slate-300 dark:border-slate-700 text-brand focus:ring-brand w-4 h-4 shrink-0 cursor-pointer"
          />
          <label htmlFor="authConsent" className="text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer leading-relaxed">
            <strong>(필수)</strong> 개인정보 제3자 제공 및 신용정보원 마이데이터 대출/연체 정보 조회 동의서에 동의합니다.
          </label>
        </div>

        {/* Security assurance note */}
        <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
          🔒 비밀번호 저장 없는 OAuth 2.0 보안 인증 및 256bit 암호화 적용
        </p>

        {/* Lawyer Login Redirect */}
        <div className="text-center pt-1 pb-1 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => { window.location.href = '?role=lawyer'; }}
            className="text-xs sm:text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            <span className="w-4 h-4 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 rounded-full text-xs font-bold">⚖</span>
            <span>변호사이신가요? 변호사 전용 로그인 →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
