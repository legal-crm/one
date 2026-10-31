// 사무소 2단계 인증 화면 (ST-11·RB-7) — 대표는 늘, 직원은 사무소가 켠 경우(기본 켬) 인증 앱(TOTP)을 거쳐야 사무소 데이터가 열린다
// 서버도 같은 규칙으로 막는다(office_permission_scope, 20261101001200). 이 화면은 등록·확인만 한다.
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../../supabaseClient';
import { isValidTotpCode, startTotpEnrollment, verifyTotpCode, type TotpEnrollment } from '../../../services/adminAuthService';

type Stage = 'checking' | 'ok' | 'enroll' | 'verify' | 'error';

export function useOfficeMfa(enabled: boolean) {
  const [stage, setStage] = useState<Stage>(enabled && isSupabaseConfigured ? 'checking' : 'ok');
  const [factorId, setFactorId] = useState('');
  const check = useCallback(async () => {
    if (!enabled || !isSupabaseConfigured) { setStage('ok'); return; }
    try {
      const { data: req, error } = await supabase.rpc('my_mfa_requirement');
      if (error) { setStage('error'); return; }
      if (!(req as any)?.required) { setStage('ok'); return; }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') { setStage('ok'); return; }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors?.all ?? []).find(f => f.factor_type === 'totp' && f.status === 'verified');
      if (verified) { setFactorId(verified.id); setStage('verify'); } else setStage('enroll');
    } catch { setStage('error'); }
  }, [enabled]);
  useEffect(() => { void check(); }, [check]);
  return { stage, factorId, recheck: check };
}

export default function OfficeMfaGate({ stage, factorId, onDone, onSignOut }: { stage: Stage; factorId: string; onDone: () => void; onSignOut: () => void }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (stage !== 'enroll' || enrollment) return;
    void startTotpEnrollment().then(r => { if (r.ok === true) setEnrollment(r.enrollment); else setErr((r as { error: string }).error); });
  }, [stage, enrollment]);

  const submit = async () => {
    setErr('');
    if (!isValidTotpCode(code)) { setErr('인증 앱에 보이는 6자리 숫자를 넣어 주세요.'); return; }
    const id = stage === 'enroll' ? enrollment?.factorId : factorId;
    if (!id) { setErr('인증 앱 등록을 준비하지 못했어요. 새로 고침 해 주세요.'); return; }
    setBusy(true);
    const r = await verifyTotpCode(id, code);
    setBusy(false);
    if (!r.ok) { setErr(r.error || '확인하지 못했어요.'); return; }
    onDone();
  };

  if (stage === 'checking') {
    return <div className="min-h-[60vh] flex items-center justify-center" aria-busy="true"><div className="h-40 w-full max-w-md rounded-3xl bg-slate-100 animate-pulse" /></div>;
  }
  if (stage === 'error') {
    return (
      <div role="alert" className="max-w-md mx-auto mt-16 rounded-3xl border border-rose-200 bg-white p-6 text-center space-y-3">
        <p className="text-sm text-slate-700">보안 설정을 확인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</p>
        <button type="button" onClick={onDone} className="min-h-[44px] px-5 rounded-xl bg-slate-900 text-white text-sm font-bold">다시 확인</button>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-[#1E3A5F]" aria-hidden="true" />
        <h2 className="text-lg font-black text-slate-900">{stage === 'enroll' ? '2단계 인증 등록' : '2단계 인증'}</h2>
      </div>
      <p className="text-sm text-slate-600">의뢰인 정보를 다루는 사무소 계정이라 인증 앱(Google Authenticator·Microsoft Authenticator 등)으로 한 번 더 확인해요.</p>
      {stage === 'enroll' && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-800">1. 인증 앱으로 아래 QR을 찍어 주세요.</p>
          {enrollment ? (
            <>
              <img src={enrollment.qrCode} alt="인증 앱 등록 QR 코드" className="w-44 h-44 mx-auto rounded-xl border border-slate-200 bg-white p-2" />
              <p className="text-xs text-slate-500 break-all text-center">QR을 못 찍으면 이 키를 직접 넣어 주세요: <code className="font-mono">{enrollment.secret}</code></p>
            </>
          ) : !err && <div className="w-44 h-44 mx-auto rounded-xl bg-slate-100 animate-pulse" />}
          <p className="text-sm font-bold text-slate-800">2. 앱에 보이는 6자리 숫자를 넣어 주세요.</p>
        </div>
      )}
      <label className="block text-xs font-semibold text-slate-700">인증 코드
        <input value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(''); }} inputMode="numeric" autoComplete="one-time-code" placeholder="000000"
          onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
          className="mt-1 w-full min-h-[48px] rounded-xl border border-slate-300 px-3 text-center text-xl tracking-[0.4em] font-mono" aria-invalid={!!err} aria-describedby={err ? 'mfa-err' : undefined} />
      </label>
      {err && <p id="mfa-err" role="alert" className="text-xs font-semibold text-rose-700">{err}</p>}
      <div className="flex justify-between gap-2">
        <button type="button" onClick={onSignOut} className="min-h-[44px] px-4 rounded-xl border border-slate-300 text-sm font-bold text-slate-700 whitespace-nowrap">로그아웃</button>
        <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-[44px] px-5 rounded-xl bg-[#1E3A5F] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 active:scale-[0.98]">{busy ? '확인 중…' : '확인'}</button>
      </div>
      <p className="text-[11px] text-slate-500">휴대폰을 바꿨거나 앱을 지웠으면 사무소 대표 또는 마이김변 문의로 인증 초기화를 요청해 주세요.</p>
    </div>
  );
}
