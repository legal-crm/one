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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-full sm:max-w-md w-full shadow-2xl p-6 md:p-8 space-y-4 relative overflow-hidden text-left animate-slideUp sm:animate-fadeIn max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[10px] bg-brand-light text-brand dark:bg-brand/10 dark:text-brand-light px-2 py-0.5 rounded font-semibold uppercase tracking-wider">의뢰인 스텔스 보안</span>
            <h3 className="font-bold text-xl text-slate-800 dark:text-white mt-1">로그인 및 회원가입</h3>
            <p className="text-xs text-slate-500 mt-1">채무 사실 노출을 막기 위해 가명 닉네임과 가명 발신자 알림 시스템이 자동으로 활성화됩니다.</p>
          </div>
          <button onClick={handleClose} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Social Login Section */}
        <div className="space-y-2.5">
          <button onClick={() => handleSocialLogin('Google')} className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm cursor-pointer">
            <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full">G</span><span>Google로 간편 로그인</span>
          </button>
          <button onClick={() => handleSocialLogin('카카오')} className="w-full bg-[#FEE500] hover:bg-[#FEE500]/95 text-[#191919] font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm cursor-pointer">
            <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full">K</span><span>카카오로 간편 로그인</span>
          </button>
          <button onClick={() => handleSocialLogin('네이버')} className="w-full bg-[#03C75A] hover:bg-[#03C75A]/95 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm cursor-pointer">
            <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-white text-[#03C75A] rounded-full">N</span><span>네이버로 간편 로그인</span>
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-semibold">또는 이메일로 안전 로그인</span>
          <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          <div>
            <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">이메일 주소</label>
            <input type="email" placeholder="example@email.com" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} required className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">비밀번호</label>
            <input type="password" placeholder="비밀번호 입력 (6자리 이상)" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required minLength={6} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
          </div>
          {isRegisterMode && (
            <div className="animate-slideDown">
              <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">의뢰인 가명 지정 (생략 시 자동 부여)</label>
              <input type="text" placeholder="예: 새출발_777" value={userAlias} onChange={(e) => setUserAlias(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand focus:outline-none" />
            </div>
          )}
          <button type="submit" className="w-full text-center py-3 bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white text-sm font-bold rounded-2xl transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer">
            <Lock className="w-3.5 h-3.5" /><span>{isRegisterMode ? '스텔스 회원가입 및 로그인' : '이메일 안전 로그인'}</span>
          </button>
          <div className="text-center pt-1">
            <button type="button" onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-[11px] text-slate-400 hover:text-brand transition-colors font-semibold underline cursor-pointer">
              {isRegisterMode ? '이미 계정이 있으신가요? 로그인하기' : '처음 방문하셨나요? 3초 회원가입하기'}
            </button>
          </div>
        </form>

        {/* Terms Consent */}
        <div className="flex items-start gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input type="checkbox" id="authConsent" checked={authConsent} onChange={(e) => setAuthConsent(e.target.checked)} className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-brand focus:ring-brand w-4 h-4 shrink-0" />
          <label htmlFor="authConsent" className="text-[11px] text-slate-600 dark:text-slate-400 select-none cursor-pointer leading-normal">
            <strong>(필수)</strong> 개인정보 제3자 제공 및 신용정보원 마이데이터 대출/연체 정보 조회 동의서에 동의합니다.
          </label>
        </div>
      </div>
    </div>
  );
}
