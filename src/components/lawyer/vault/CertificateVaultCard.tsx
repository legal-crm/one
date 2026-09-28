import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, KeyRound, Lock, Clock, Send, 
  ExternalLink, Eye, CheckCircle2, AlertTriangle, Sparkles, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CrmClientExtension, CertificateVaultData } from '../../../types';
import { 
  loadCertificateVault, 
  saveCertificateVault, 
  computeDaysRemaining,
} from '../../../services/vault/certificateVaultService';
import CertificateVaultModal from './CertificateVaultModal';

/** 과거 버전이 자동 생성한 가짜 시연 금고 판별 */
const isMockVault = (v: CertificateVaultData) =>
  Boolean(v?.npki?.derBase64?.includes('MOCK_') || v?.npki?.keyBase64?.includes('MOCK_'));

interface CertificateVaultCardProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onUpdateCrmExt?: (updates: Partial<CrmClientExtension>) => Promise<void>;
  compact?: boolean;
  /** 열람 기록에 남길 담당자 이름/직책 */
  actorName?: string;
  actorRole?: string;
}

export default function CertificateVaultCard({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  compact = false,
  actorName,
  actorRole,
}: CertificateVaultCardProps) {
  const [vault, setVault] = useState<CertificateVaultData>(() => {
    // 1) crmExt에서 확인
    if (crmExt?.certificateVault && !isMockVault(crmExt.certificateVault)) return crmExt.certificateVault;
    // 2) 로컬스토리지에서 확인
    const loaded = loadCertificateVault(clientId);
    if (loaded) return loaded;
    // 3) 등록된 인증서가 없으면 빈 금고 (이전: 가짜 공동인증서·금융인증서·동의서명·열람기록을 생성해 저장)
    const now = new Date().toISOString();
    return {
      id: `vault_${clientId}`,
      clientId,
      clientName: clientRequest.clientName || '',
      status: 'active',
      accessLogs: [],
      createdAt: now,
      updatedAt: now,
    } as CertificateVaultData;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 동기화
  useEffect(() => {
    if (crmExt?.certificateVault && !isMockVault(crmExt.certificateVault)) {
      setVault(crmExt.certificateVault);
    }
  }, [crmExt?.certificateVault]);

  const handleUpdateVault = async (updated: CertificateVaultData) => {
    setVault(updated);
    saveCertificateVault(updated);
    if (onUpdateCrmExt) {
      await onUpdateCrmExt({ certificateVault: updated });
    }
  };

  const npki = vault.npki;
  const financial = vault.financial;
  const isShredded = vault.status === 'shredded';

  // 업로드 시점에 저장된 daysRemaining 대신 오늘 기준으로 재계산 (null = 만료일 확인 불가)
  const computedDays = npki ? computeDaysRemaining(npki.validTo) : null;
  const daysUnknown = Boolean(npki) && computedDays === null;
  const daysRemaining = computedDays ?? 0;
  const isExpiringSoon = npki && !daysUnknown ? daysRemaining <= 30 && daysRemaining > 0 : false;
  const isExpired = npki && !daysUnknown ? daysRemaining <= 0 : false;
  const daysLabel = daysUnknown ? '만료일 미확인' : isExpired ? '만료됨' : `D-${daysRemaining}`;

  // 알림톡 연동 전: 안내 문구만 복사 (이전: 아무것도 보내지 않고 '발송했습니다' 표시)
  const handleSendRenewalAlimtok = async () => {
    const text = `[${clientRequest.clientName}님] 등록하신 공동인증서가 곧 만료됩니다. 갱신 후 다시 제출해 주세요.`;
    try { await navigator.clipboard.writeText(text); toast.success('인증서 갱신 안내 문구가 복사되었습니다. 채팅·문자로 전달해 주세요.'); }
    catch { toast.error('클립보드 복사에 실패했습니다.'); }
  };

  const handleSendRequestAlimtok = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `[${clientRequest.clientName}님] 부채증명서 발급·전자소송 진행을 위해 마이페이지 > 인증서 제출에서 공동인증서를 등록해 주세요. ${origin}/?tab=mypage`;
    try { await navigator.clipboard.writeText(text); toast.success('인증서 제출 요청 문구가 복사되었습니다. 채팅·문자로 전달해 주세요.'); }
    catch { toast.error('클립보드 복사에 실패했습니다.'); }
  };
  const hasAnyCert = Boolean(vault.npki || vault.financial);

  if (compact) {
    return (
      <>
        <div className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">인증서 안전 금고</span>
                {isShredded ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold">사본 삭제됨</span>
                ) : npki ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    daysUnknown ? 'bg-slate-800 text-slate-400' :
                    isExpired ? 'bg-rose-500/20 text-rose-300' :
                    isExpiringSoon ? 'bg-amber-500/20 text-amber-300' :
                    'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    공동인증서 {daysLabel}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">미등록</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">부채증명서 발급 및 전자소송용 · 이 브라우저에만 보관</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            금고 관리
          </button>
        </div>

        {isModalOpen && (
          <CertificateVaultModal
            clientId={clientId}
            clientRequest={clientRequest}
            vault={vault}
            onUpdateVault={handleUpdateVault}
            onClose={() => setIsModalOpen(false)}
            actorName={actorName}
            actorRole={actorRole}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-2xl p-4 md:p-5 shadow-sm">
        {/* 상단 헤더 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm md:text-base font-bold text-white flex items-center gap-1.5">
                  의뢰인 인증서 안전 금고
                  <span className="text-[11px] font-normal text-slate-400">(브라우저 로컬 보관)</span>
                </h4>
                {isShredded ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
                    사본 삭제됨
                  </span>
                ) : hasAnyCert ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    보관중
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-semibold">
                    미등록
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                부채증명서 발급 대행 및 대법원 전자소송(ECFS) 진행용 보관함 · 비밀번호는 앱 내장 키로 암호화, 인증서 파일은 미암호화 상태로 이 브라우저에만 저장
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isShredded && npki && isExpiringSoon && (
              <button
                onClick={handleSendRenewalAlimtok}
                className="px-3 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                갱신 안내 문구 복사
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              금고 열람 및 관리
            </button>
          </div>
        </div>

        {/* 바디: 2개 인증서 채널 상태 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
          {/* 1. 공동인증서 (NPKI) */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span className="text-xs font-bold text-slate-200">공동인증서 (NPKI)</span>
                </div>
                {npki && !isShredded ? (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    daysUnknown ? 'bg-slate-800 text-slate-400' :
                    isExpired ? 'bg-rose-500/20 text-rose-300' :
                    isExpiringSoon ? 'bg-amber-500/20 text-amber-300' :
                    'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {daysUnknown || isExpired ? daysLabel : `D-${daysRemaining} (${daysRemaining}일 남음)`}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">미등록</span>
                )}
              </div>

              {npki && !isShredded ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>발급기관:</span>
                    <span className="text-slate-200 font-medium">{npki.issuer}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>인증서 파일:</span>
                    <span className="text-slate-300 font-mono">signCert.der / signPri.key</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>비밀번호 보안:</span>
                    <span className="text-amber-400 font-mono font-medium">앱 내장 키 암호화 (마스킹)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">
                  등록된 공동인증서가 없습니다. 아래 버튼으로 제출 요청 문구를 복사해 의뢰인에게 전달하세요.
                </p>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">부채증명서 온라인 대리발급 선호</span>
              {npki && !isShredded ? (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  비밀번호 복호화 <Eye className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={handleSendRequestAlimtok}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  제출 요청 문구 복사 <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* 2. 금융인증서 (YESKEY Cloud) */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                  <span className="text-xs font-bold text-slate-200">금융인증서 (YESKEY Cloud)</span>
                </div>
                {financial?.registered && !isShredded ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300">
                    등록 정보 있음
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">미등록</span>
                )}
              </div>

              {financial?.registered && !isShredded ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>보관 방식:</span>
                    <span className="text-slate-200 font-medium">금융결제원 클라우드</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>연동 연락처:</span>
                    <span className="text-slate-300 font-mono">{financial.relayPhone}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>원격 승인:</span>
                    <span className="text-violet-400 font-medium">의뢰인 휴대폰에서 직접 승인</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">
                  클라우드 금융인증서 연동 정보가 없습니다.
                </p>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">원격 승인 안내 문구 (자동 발송 아님)</span>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                원격 승인 안내 <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 하단 안심 안내 문구 */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>비밀번호 열람 시 목적 입력 필수 · 복사 30초 후 클립보드 소거 시도</span>
          </div>
          <span className="font-mono text-slate-400">열람 기록 {vault.accessLogs.length}건 (이 브라우저)</span>
        </div>
      </div>

      {isModalOpen && (
        <CertificateVaultModal
          clientId={clientId}
          clientRequest={clientRequest}
          vault={vault}
          onUpdateVault={handleUpdateVault}
          onClose={() => setIsModalOpen(false)}
          actorName={actorName}
          actorRole={actorRole}
        />
      )}
    </>
  );
}
