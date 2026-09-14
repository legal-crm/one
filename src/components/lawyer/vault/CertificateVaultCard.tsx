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
  generateSeedVaultData 
} from '../../../services/vault/certificateVaultService';
import CertificateVaultModal from './CertificateVaultModal';

interface CertificateVaultCardProps {
  clientId: string;
  clientRequest: ConsultRequest;
  crmExt?: CrmClientExtension;
  onUpdateCrmExt?: (updates: Partial<CrmClientExtension>) => Promise<void>;
  compact?: boolean;
}

export default function CertificateVaultCard({
  clientId,
  clientRequest,
  crmExt,
  onUpdateCrmExt,
  compact = false,
}: CertificateVaultCardProps) {
  const [vault, setVault] = useState<CertificateVaultData>(() => {
    // 1) crmExt에서 확인
    if (crmExt?.certificateVault) return crmExt.certificateVault;
    // 2) 로컬스토리지에서 확인
    const loaded = loadCertificateVault(clientId);
    if (loaded) return loaded;
    // 3) 초기 시드 생성
    const seeded = generateSeedVaultData(
      clientId, 
      clientRequest.clientName || '의뢰인',
      clientRequest.phone || '010-0000-0000'
    );
    saveCertificateVault(seeded);
    return seeded;
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 동기화
  useEffect(() => {
    if (crmExt?.certificateVault) {
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

  const daysRemaining = npki ? npki.daysRemaining : 0;
  const isExpiringSoon = npki ? daysRemaining <= 30 && daysRemaining > 0 : false;
  const isExpired = npki ? npki.isExpired || daysRemaining <= 0 : false;

  const handleSendRenewalAlimtok = () => {
    toast.success(`${clientRequest.clientName} 님께 [공동인증서 만료 갱신 안내 알림톡]을 즉시 발송했습니다.`);
  };

  const handleSendRequestAlimtok = () => {
    toast.success(`${clientRequest.clientName} 님께 [인증서 안전 금고 제출 마법사 링크]가 알림톡으로 전송되었습니다.`);
  };

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
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold">영구 파기됨</span>
                ) : npki ? (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                    isExpired ? 'bg-rose-500/20 text-rose-300' :
                    isExpiringSoon ? 'bg-amber-500/20 text-amber-300' :
                    'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    공동인증서 D-{daysRemaining}
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">미등록</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">부채증명서 발급 및 전자소송용 E2EE 암호화 보관</p>
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
                  <span className="text-[11px] font-normal text-slate-400">(AES-256 E2EE)</span>
                </h4>
                {isShredded ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold">
                    영구 파기 완료
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    안전 보관중
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                부채증명서 발급 대행 및 대법원 전자소송(ECFS) 진행 전용 종단간 암호화 금고
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
                만료 갱신 알림톡
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
                    isExpired ? 'bg-rose-500/20 text-rose-300' :
                    isExpiringSoon ? 'bg-amber-500/20 text-amber-300' :
                    'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {isExpired ? '만료됨' : `D-${daysRemaining} (${daysRemaining}일 남음)`}
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
                    <span className="text-emerald-400 font-mono font-medium">AES-256 암호화 (마스킹)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">
                  등록된 공동인증서가 없습니다. 의뢰인에게 안전 제출 링크를 발송하세요.
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
                  제출 요청 발송 <Send className="w-3 h-3" />
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
                    클라우드 연동 완료
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">미등록</span>
                )}
              </div>

              {financial?.registered && !isShredded ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>보관 방식:</span>
                    <span className="text-slate-200 font-medium">금융결제원 클라우드 (유효 3년)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>연동 연락처:</span>
                    <span className="text-slate-300 font-mono">{financial.relayPhone}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>원격 승인:</span>
                    <span className="text-violet-400 font-medium">실시간 2자리 승인 릴레이 대기</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">
                  클라우드 금융인증서 연동 정보가 없습니다.
                </p>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">실시간 원격 승인(2자리) 지원</span>
              <button
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-violet-400 hover:text-violet-300 flex items-center gap-1"
              >
                원격 승인 요청 <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 하단 안심 안내 문구 */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>비밀번호 열람 시 목적 입력 필수 & 30초 후 클립보드 자동 소거(Zeroize)</span>
          </div>
          <span className="font-mono text-slate-400">최근 감사로그 {vault.accessLogs.length}건 기록</span>
        </div>
      </div>

      {isModalOpen && (
        <CertificateVaultModal
          clientId={clientId}
          clientRequest={clientRequest}
          vault={vault}
          onUpdateVault={handleUpdateVault}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
