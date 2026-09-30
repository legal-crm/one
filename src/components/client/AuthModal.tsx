import React, { useRef, useState } from 'react';
import { ExternalLink, Scale, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../supabaseClient';
import { stashLoginConsent } from '../../services/clientConsentService';
import { Modal } from './ui';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (alias: string, emailOrPhone: string, channel: 'email' | 'google' | 'kakao' | 'naver' | 'sms') => void;
}

type Provider = '카카오' | 'Google';

/**
 * 의뢰인 로그인 (카카오 · Google OAuth)
 * 필수 동의는 서비스 이용약관 · 개인정보 수집·이용 두 가지만 받는다.
 * 변호사에게 상담 정보를 보내는 동의(제3자 제공)는 상담을 요청할 때 받는 변호사를 보여 주고 따로 받는다.
 */
export default function AuthModal({ onClose, onLoginSuccess: _onLoginSuccess }: AuthModalProps) {
  // 필수 동의는 직접 체크 (미리 체크 금지)
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [isLoadingProvider, setIsLoadingProvider] = useState<Provider | null>(null);
  const termsRef = useRef<HTMLInputElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);

  const allAgreed = agreeTerms && agreePrivacy;

  const toggleAll = (next: boolean) => {
    setAgreeTerms(next);
    setAgreePrivacy(next);
    if (next) setConsentError(false);
  };

  const handleSocialLogin = async (provider: Provider) => {
    if (!allAgreed) {
      setConsentError(true);
      (agreeTerms ? privacyRef : termsRef).current?.focus();
      return;
    }
    const supabaseProvider = provider === 'Google' ? 'google' : 'kakao';
    try {
      setIsLoadingProvider(provider);
      // 동의 기록은 로그인 후 계정에 저장한다 (OAuth 이동 전에는 계정이 없음)
      stashLoginConsent();
      // OAuth 리다이렉트 전 플래그 저장 (돌아왔을 때 OAuth 로그인 감지용)
      const nowStr = Date.now().toString();
      localStorage.setItem('pending_oauth_login', nowStr);
      sessionStorage.setItem('pending_oauth_login', nowStr);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as any,
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) {
        localStorage.removeItem('pending_oauth_login');
        sessionStorage.removeItem('pending_oauth_login');
        throw error;
      }
    } catch (err: any) {
      setIsLoadingProvider(null);
      localStorage.removeItem('pending_oauth_login');
      sessionStorage.removeItem('pending_oauth_login');
      toast.error(`${provider} 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.${err?.message ? ` (${err.message})` : ''}`);
    }
  };

  const consentItems: Array<{ id: string; label: string; href: string; checked: boolean; onChange: (v: boolean) => void; ref: React.RefObject<HTMLInputElement | null> }> = [
    { id: 'auth-consent-terms', label: '서비스 이용약관 동의', href: '/tos.html', checked: agreeTerms, onChange: setAgreeTerms, ref: termsRef },
    { id: 'auth-consent-privacy', label: '개인정보 수집·이용 동의', href: '/privacy.html', checked: agreePrivacy, onChange: setAgreePrivacy, ref: privacyRef },
  ];

  // z-70: 결과 리포트 등 다른 모달(60) 위에서 로그인을 요청할 수 있다
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      zIndexClassName="z-[70]"
      title="로그인"
      description="카카오 또는 Google 계정으로 로그인합니다. 마이김변은 비밀번호를 저장하지 않습니다."
      dismissible={!isLoadingProvider}
    >
      <div className="space-y-5">
        {/* 스텔스 가명 안내 */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-1.5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            스텔스 가명으로 상담합니다
          </p>
          <p className="text-sm text-emerald-900/90 leading-relaxed break-keep">
            상담 대화방과 변호사에게는 임의로 만든 스텔스 가명(예: 신중한 사자)으로 표시됩니다. 실명은 수임 계약 때 본인인증을 거쳐서만 사용합니다.
          </p>
        </div>

        {/* 필수 동의 (로그인 버튼보다 먼저 보이게) */}
        <fieldset className="space-y-2" aria-describedby={consentError ? 'auth-consent-error' : undefined}>
          <legend className="sr-only">로그인 필수 동의</legend>
          <label className="flex items-center gap-3 min-h-11 rounded-xl border border-slate-300 bg-white px-3.5 cursor-pointer has-[:checked]:border-brand has-[:checked]:bg-brand-light/60">
            <input
              type="checkbox"
              checked={allAgreed}
              onChange={e => toggleAll(e.target.checked)}
              className="w-5 h-5 shrink-0 rounded border-slate-400 text-brand focus:ring-brand cursor-pointer"
            />
            <span className="text-sm font-bold text-slate-900">전체 동의</span>
          </label>
          <ul className="space-y-1 pl-1">
            {consentItems.map(item => (
              <li key={item.id} className="flex items-center gap-2">
                <label htmlFor={item.id} className="flex flex-1 items-center gap-3 min-h-11 px-2.5 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    ref={item.ref}
                    id={item.id}
                    type="checkbox"
                    checked={item.checked}
                    onChange={e => {
                      item.onChange(e.target.checked);
                      if (e.target.checked) setConsentError(false);
                    }}
                    aria-invalid={consentError && !item.checked ? true : undefined}
                    className="w-5 h-5 shrink-0 rounded border-slate-400 text-brand focus:ring-brand cursor-pointer"
                  />
                  <span className="text-sm text-slate-800">
                    <span className="font-bold text-brand">(필수)</span> {item.label}
                  </span>
                </label>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 min-h-11 px-2 text-sm font-semibold text-slate-600 underline underline-offset-2 hover:text-brand whitespace-nowrap"
                >
                  보기
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="sr-only">{item.label} 전문 (새 창)</span>
                </a>
              </li>
            ))}
          </ul>
          {consentError && (
            <p id="auth-consent-error" role="alert" className="text-sm font-semibold text-red-700 px-1">
              필수 항목에 동의해야 로그인할 수 있습니다.
            </p>
          )}
          <p className="text-xs text-slate-500 leading-relaxed px-1 break-keep">
            변호사에게 상담 정보를 보낼 때는 받는 변호사를 확인하고 그때 따로 동의합니다.
          </p>
        </fieldset>

        {/* 소셜 로그인 */}
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={!!isLoadingProvider}
            onClick={() => handleSocialLogin('카카오')}
            className="w-full min-h-12 bg-[#FEE500] hover:bg-[#F5DC00] text-[#191919] font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-base cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span className="w-6 h-6 flex items-center justify-center font-black text-xs bg-[#3c2a2b] text-[#FEE500] rounded-full shrink-0" aria-hidden="true">K</span>
            <span>{isLoadingProvider === '카카오' ? '카카오로 이동 중…' : '카카오로 계속하기'}</span>
          </button>
          <button
            type="button"
            disabled={!!isLoadingProvider}
            onClick={() => handleSocialLogin('Google')}
            className="w-full min-h-12 bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 font-bold rounded-xl flex items-center justify-center gap-3 transition-colors text-base cursor-pointer active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <span className="w-6 h-6 flex items-center justify-center font-bold text-xs bg-red-500 text-white rounded-full shrink-0" aria-hidden="true">G</span>
            <span>{isLoadingProvider === 'Google' ? 'Google로 이동 중…' : 'Google로 계속하기'}</span>
          </button>
        </div>

        {/* 변호사 로그인 */}
        <div className="pt-3 border-t border-slate-100 text-center">
          <a
            href="?role=lawyer"
            className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm font-bold text-slate-600 hover:text-brand"
          >
            <Scale className="w-4 h-4" aria-hidden="true" />
            변호사이신가요? 변호사 로그인
          </a>
        </div>
      </div>
    </Modal>
  );
}
