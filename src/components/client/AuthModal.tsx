import React, { useState } from 'react';
import { X, Lock } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => void;
}

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [userAlias, setUserAlias] = useState('');
  const [authConsent, setAuthConsent] = useState(false);

  const handleClose = () => {
    onClose();
  };

  const handleSocialLogin = async (provider: string) => {
    const supabaseProvider = provider === 'Google' ? 'google' : provider === '카카오' ? 'kakao' : 'naver';
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as any,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      alert(`${provider} 로그인 시작 실패: ${err.message || err}`);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authConsent) {
      alert('필수 개인정보 및 마이데이터 수집 이용 동의를 체크해 주세요.');
      return;
    }
    if (!emailInput.trim() || !passwordInput.trim()) {
      alert('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    try {
      if (isRegisterMode) {
        const finalAlias = userAlias.trim() || ("새출발_" + Math.floor(100 + Math.random() * 900));
        const { error } = await supabase.auth.signUp({
          email: emailInput,
          password: passwordInput,
          options: { data: { alias: finalAlias } }
        });
        if (error) throw error;
        alert(`[회원가입 완료] 스텔스 계정이 생성되었습니다! 가명: ${finalAlias}`);
        onLoginSuccess(finalAlias, emailInput, 'email');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
        if (error) throw error;
        if (data.user) {
          const finalAlias = data.user.user_metadata?.alias || ("새출발_" + Math.floor(100 + Math.random() * 900));
          alert(`[로그인 성공] 이메일로 안전 로그인 되었습니다.\n가명: ${finalAlias}`);
          onLoginSuccess(finalAlias, emailInput, 'email');
        }
      }
    } catch (err: any) {
      alert(`인증 실패: ${err.message || err}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-full sm:max-w-md w-full shadow-2xl p-6 md:p-8 space-y-4 relative text-left animate-slideUp sm:animate-fadeIn max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-2xl text-slate-900 dark:text-white mt-1">로그인 및 회원가입</h3>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Social & Quick Stealth Login Section */}
        <div className="space-y-2.5">
          <button 
            type="button"
            onClick={() => {
              const quickAlias = userAlias.trim() || ("새출발_" + Math.floor(100 + Math.random() * 900));
              onLoginSuccess(quickAlias, `${quickAlias}@stealth.mykim.kr`, 'email');
            }} 
            className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-brand/20 text-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            <Lock className="w-4 h-4" />
            <span>⚡ 3초 스텔스 가명으로 즉시 시작하기</span>
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button onClick={() => handleSocialLogin('Google')} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs text-xs cursor-pointer">
              <span className="w-4 h-4 flex items-center justify-center font-bold text-[10px] bg-red-500 text-white rounded-full">G</span><span>Google 로그인</span>
            </button>
            <button onClick={() => handleSocialLogin('카카오')} className="bg-[#FEE500] hover:bg-[#FEE500]/95 text-[#191919] font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs text-xs cursor-pointer">
              <span className="w-4 h-4 flex items-center justify-center font-bold text-[10px] bg-[#3c2a2b] text-[#FEE500] rounded-full">K</span><span>카카오 로그인</span>
            </button>
          </div>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-500 text-xs font-semibold">또는 이메일 직접 계정 사용</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">이메일 주소</label>
            <input type="email" placeholder="example@email.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">비밀번호</label>
            <input type="password" placeholder="비밀번호 입력 (6자리 이상)" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required minLength={6} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
          </div>
          {isRegisterMode && (
            <div className="animate-slideDown">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">의뢰인 가명 지정 (생략 시 자동 부여)</label>
              <input type="text" placeholder="예: 새출발_777" value={userAlias} onChange={(e) => setUserAlias(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>
          )}
          <button type="submit" className="w-full text-center py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Lock className="w-3.5 h-3.5 text-brand" /><span>{isRegisterMode ? '이메일 회원가입' : '이메일 로그인'}</span>
          </button>
          <div className="text-center pt-1">
            <button type="button" onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-xs text-slate-500 hover:text-brand transition-colors font-semibold underline cursor-pointer">
              {isRegisterMode ? '이미 계정이 있으신가요? 로그인하기' : '이메일 계정 신규 만들기'}
            </button>
          </div>
        </form>

        {/* Terms Consent */}
        <div className="flex items-start gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input type="checkbox" id="authConsent" checked={authConsent} onChange={(e) => setAuthConsent(e.target.checked)} className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-brand focus:ring-brand w-4 h-4 shrink-0" />
          <label htmlFor="authConsent" className="text-sm text-slate-600 dark:text-slate-400 select-none cursor-pointer leading-normal">
            <strong>(필수)</strong> 개인정보 제3자 제공 및 신용정보원 마이데이터 대출/연체 정보 조회 동의서에 동의합니다.
          </label>
        </div>

        {/* Lawyer Login Redirect */}
        <div className="text-center pt-1 pb-2">
          <button
            type="button"
            onClick={() => { window.location.href = '?role=lawyer'; }}
            className="text-sm text-slate-500 hover:text-indigo-500 transition-colors font-semibold cursor-pointer inline-flex items-center gap-1"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 rounded-full text-[10px] font-bold">⚖</span>
            <span>변호사이신가요? 변호사 전용 로그인 →</span>
          </button>
        </div>
      </div>
    </div>
  );
}
