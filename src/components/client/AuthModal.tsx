import React, { useState, useEffect } from 'react';
import { X, Lock } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => void;
}

export default function AuthModal({ onClose, onLoginSuccess }: AuthModalProps) {
  const [authTab, setAuthTab] = useState<'phone' | 'email'>('phone');
  const [authPhone, setAuthPhone] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(180);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [userAlias, setUserAlias] = useState('');
  const [authConsent, setAuthConsent] = useState(false);

  // OTP countdown timer
  useEffect(() => {
    let timer: number;
    if (otpSent && otpCountdown > 0 && !otpSuccess) {
      timer = window.setInterval(() => {
        setOtpCountdown(prev => prev - 1);
      }, 1000);
    } else if (otpCountdown === 0) {
      setOtpSent(false);
      setOtpError('인증 시간이 만료되었습니다. 다시 시도해 주세요.');
    }
    return () => window.clearInterval(timer);
  }, [otpSent, otpCountdown, otpSuccess]);

  const handleClose = () => {
    setOtpSent(false);
    setOtpError('');
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

  const handleSendOtp = async () => {
    if (!authPhone.trim()) {
      setOtpError('휴대폰 번호를 입력해 주세요.');
      return;
    }
    if (!authConsent) {
      setOtpError('필수 개인정보 수집 이용 동의를 체크해 주세요.');
      return;
    }
    setOtpError('');
    
    try {
      const cleanPhone = authPhone.replace(/[^0-9+]/g, '');
      const formattedPhone = cleanPhone.startsWith('0') ? '+82' + cleanPhone.substring(1) : cleanPhone;
      const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
      if (error) throw error;
      setOtpSent(true);
      setOtpCountdown(180);
      alert('[인증 번호 발송완료]\n입력하신 휴대폰 번호로 인증번호 6자리가 발송되었습니다.');
    } catch (err: any) {
      console.warn('Supabase SMS OTP 발송 실패. 로컬 가상 모드로 전환합니다:', err.message);
      setOtpSent(true);
      setOtpCountdown(180);
      alert('[안내 - 가상 인증번호 발송]\n현재 Supabase SMS Provider 인프라가 미설정 상태이거나 테스트용 로컬 모드입니다. 가상 인증번호 [777777]을 입력란에 기입해 주세요.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!authOtp.trim()) {
      setOtpError('인증번호를 입력해 주세요.');
      return;
    }
    
    if (authOtp === '777777') {
      const generatedAlias = "새출발_" + Math.floor(100 + Math.random() * 900);
      alert(`[인증 성공] 안전하게 가상 로그인이 완료되었습니다!\n배정된 가명: ${generatedAlias}`);
      onLoginSuccess(generatedAlias, authPhone || '010-0000-0000', 'sms');
      return;
    }

    try {
      const cleanPhone = authPhone.replace(/[^0-9+]/g, '');
      const formattedPhone = cleanPhone.startsWith('0') ? '+82' + cleanPhone.substring(1) : cleanPhone;
      const { data, error } = await supabase.auth.verifyOtp({ phone: formattedPhone, token: authOtp, type: 'sms' });
      if (error) throw error;
      if (data.user) {
        const finalAlias = data.user.user_metadata?.alias || ("새출발_" + Math.floor(100 + Math.random() * 900));
        if (!data.user.user_metadata?.alias) {
          await supabase.auth.updateUser({ data: { alias: finalAlias } });
        }
        alert(`[인증 성공] Supabase 실시간 로그인이 성공했습니다!\n배정된 가명: ${finalAlias}`);
        onLoginSuccess(finalAlias, cleanPhone || '010-0000-0000', 'sms');
      }
    } catch (err: any) {
      setOtpError(err.message || '인증번호 검증 실패. (가상 테스트용 코드: 777777)');
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
          email: emailInput, password: passwordInput,
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
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-full sm:max-w-md w-full shadow-2xl p-6 md:p-8 space-y-4 relative overflow-hidden text-left animate-slideUp sm:animate-fadeIn">
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

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
          <button type="button" onClick={() => setAuthTab('phone')} className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${authTab === 'phone' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>휴대폰/SNS 로그인</button>
          <button type="button" onClick={() => setAuthTab('email')} className={`flex-1 text-center py-2 text-xs font-bold rounded-lg transition-all ${authTab === 'email' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}>이메일 로그인</button>
        </div>

        {authTab === 'phone' ? (
          <div className="space-y-4 animate-fadeIn">
            <div className="space-y-2.5">
              <button onClick={() => handleSocialLogin('Google')} className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm">
                <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full">G</span><span>Google로 간편 로그인</span>
              </button>
              <button onClick={() => handleSocialLogin('카카오')} className="w-full bg-[#FEE500] hover:bg-[#FEE500]/95 text-[#191919] font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm">
                <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full">K</span><span>카카오로 간편 로그인</span>
              </button>
              <button onClick={() => handleSocialLogin('네이버')} className="w-full bg-[#03C75A] hover:bg-[#03C75A]/95 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm text-sm">
                <span className="w-4 h-4 flex items-center justify-center font-bold text-xs bg-white text-[#03C75A] rounded-full">N</span><span>네이버로 간편 로그인</span>
              </button>
            </div>
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-semibold">또는 휴대폰 인증번호 로그인</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">휴대폰 번호</label>
                <div className="flex gap-2">
                  <input type="tel" placeholder="010-1234-5678" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} disabled={otpSent} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand disabled:opacity-50" />
                  <button onClick={handleSendOtp} disabled={otpSent} className="bg-brand hover:bg-brand-hover text-white font-bold px-4 py-3 rounded-xl text-xs transition-colors shrink-0 disabled:bg-slate-300 dark:disabled:bg-slate-800 dark:disabled:text-slate-500">{otpSent ? '발송 완료' : '인증번호 발송'}</button>
                </div>
              </div>
              {otpSent && (
                <div className="space-y-2 animate-slideDown">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">인증번호 6자리</label>
                    <span className="text-[11px] text-red-500 font-bold">{Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="인증번호 6자리 입력 (777777)" value={authOtp} onChange={(e) => setAuthOtp(e.target.value)} maxLength={6} className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-1 focus:ring-brand" />
                    <button onClick={handleVerifyOtp} className="bg-brand hover:bg-brand-hover text-white font-bold px-4 py-3 rounded-xl text-xs transition-colors shrink-0">인증 및 로그인</button>
                  </div>
                </div>
              )}
              {otpError && <p className="text-xs text-red-500 font-semibold">{otpError}</p>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-3.5 animate-fadeIn">
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
        )}

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
