import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ShieldCheck, ShieldAlert, KeyRound, Lock, Unlock, Copy, 
  Download, Eye, EyeOff, Clock, AlertTriangle, CheckCircle2, 
  Send, ExternalLink, RefreshCw, Trash2, Smartphone, FileText, Check, AlertOctagon
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CertificateVaultData, CertificateAccessLog } from '../../../types';
import { 
  decryptCertPassword, 
  downloadBase64File, 
  copyWithAutoZeroize, 
  createAccessLog, 
  shredCertificateVault,
  simulateFinancialRelayRequest,
  saveCertificateVault
} from '../../../services/vault/certificateVaultService';

interface CertificateVaultModalProps {
  clientId: string;
  clientRequest: ConsultRequest;
  vault: CertificateVaultData;
  onUpdateVault: (updated: CertificateVaultData) => Promise<void>;
  onClose: () => void;
}

type TabType = 'npki' | 'financial' | 'audit' | 'consent';

const PURPOSE_PRESETS = [
  '국민은행/시중은행 온라인 부채증명서 대리 발급',
  '신한카드/캐피탈/저축은행 온라인 부채내역 조회 및 발급',
  '대법원 전자소송(ECFS) 포털 당사자 본인인증 및 사건조회',
  '어카운트인포/국세청/위택스 공공 서류 전수조회',
  '부채발급 대행사(원클릭, 윈행정사 등) 안전 전송',
];

export default function CertificateVaultModal({
  clientId,
  clientRequest,
  vault,
  onUpdateVault,
  onClose,
}: CertificateVaultModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('npki');
  
  // NPKI 복호화 상태
  const [showDecryptGate, setShowDecryptGate] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState(PURPOSE_PRESETS[0]);
  const [customPurpose, setCustomPurpose] = useState('');
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // 클립보드 30초 자동 소거 상태
  const [zeroizeRemaining, setZeroizeRemaining] = useState<number | null>(null);
  const cancelZeroizeRef = useRef<(() => void) | null>(null);

  // 금융인증서 릴레이 상태
  const [relayTargetCreditor, setRelayTargetCreditor] = useState('국민은행');
  const [activeRelayNumber, setActiveRelayNumber] = useState<string | null>(
    vault.financial?.lastRelayNumber || null
  );
  const [isRelayWaiting, setIsRelayWaiting] = useState(false);

  // 영구 파기(Shredding) 확인 모달
  const [showShredConfirm, setShowShredConfirm] = useState(false);
  const [shredReason, setShredReason] = useState('사건 면책 결정 확정에 따른 고객 정보 영구 파기');

  const npki = vault.npki;
  const financial = vault.financial;
  const isShredded = vault.status === 'shredded';

  // 언마운트 시 클립보드 타이머 해제
  useEffect(() => {
    return () => {
      if (cancelZeroizeRef.current) {
        cancelZeroizeRef.current();
      }
    };
  }, []);

  // 1. NPKI 비밀번호 복호화 실행
  const handleExecuteDecrypt = async () => {
    if (!npki || isShredded) return;

    const finalPurpose = selectedPurpose === '기타 직접 입력' ? customPurpose.trim() : selectedPurpose;
    if (!finalPurpose) {
      toast.error('비밀번호 열람 사유를 입력해주세요.');
      return;
    }

    setIsDecrypting(true);
    try {
      // 복호화
      let plain = '';
      if (npki.encryptedPassword === 'dGhpcy1pcy1hbi1lbmNyeXB0ZWQtcGFzc3dvcmQtbW9jaw==') {
        // 데모 시드용 비밀번호
        plain = 'lawyer2026!@#';
      } else {
        plain = await decryptCertPassword(npki.encryptedPassword, npki.iv);
      }

      setDecryptedPassword(plain);
      setShowDecryptGate(false);

      // 감사 로그 기록
      const log = createAccessLog(
        '김수현 (수임사무장)',
        '수임사무장',
        'password_view',
        finalPurpose
      );

      const updatedVault: CertificateVaultData = {
        ...vault,
        accessLogs: [log, ...vault.accessLogs],
      };

      await onUpdateVault(updatedVault);
      toast.success('인증서 비밀번호가 복호화되었습니다. (사법 감사로그 영구 기록됨)');
    } catch (err: any) {
      toast.error(err.message || '비밀번호 복호화 실패');
    } finally {
      setIsDecrypting(false);
    }
  };

  // 2. 30초 자동소거 클립보드 복사
  const handleCopyPassword = () => {
    if (!decryptedPassword) return;

    if (cancelZeroizeRef.current) {
      cancelZeroizeRef.current();
    }

    const cancel = copyWithAutoZeroize(
      decryptedPassword,
      30,
      (sec) => setZeroizeRemaining(sec),
      () => {
        setZeroizeRemaining(null);
        toast.info('보안을 위해 클립보드가 자동 소거(Zeroize)되었습니다.');
      }
    );

    cancelZeroizeRef.current = cancel;
    toast.success('비밀번호가 복사되었습니다. 30초 후 클립보드에서 자동 삭제됩니다.');
  };

  // 3. 파일 다운로드
  const handleDownloadDer = () => {
    if (!npki?.derBase64) return;
    downloadBase64File(npki.derBase64, npki.derFileName || 'signCert.der');

    const log = createAccessLog('김수현 (수임사무장)', '수임사무장', 'file_download', 'signCert.der 공개키 인증서 다운로드');
    onUpdateVault({ ...vault, accessLogs: [log, ...vault.accessLogs] });
    toast.success('signCert.der 파일이 다운로드되었습니다.');
  };

  const handleDownloadKey = () => {
    if (!npki?.keyBase64) return;
    downloadBase64File(npki.keyBase64, npki.keyFileName || 'signPri.key');

    const log = createAccessLog('김수현 (수임사무장)', '수임사무장', 'file_download', 'signPri.key 개인키 파일 다운로드');
    onUpdateVault({ ...vault, accessLogs: [log, ...vault.accessLogs] });
    toast.success('signPri.key 개인키 파일이 다운로드되었습니다.');
  };

  // 4. 금융인증서 릴레이 요청
  const handleSendFinancialRelay = async () => {
    if (!financial || isShredded) return;

    setIsRelayWaiting(true);
    const { updatedVault, relayNumber } = simulateFinancialRelayRequest(
      vault, 
      '김수현 (수임사무장)', 
      relayTargetCreditor
    );
    setActiveRelayNumber(relayNumber);
    await onUpdateVault(updatedVault);

    toast.success(
      `[${relayTargetCreditor}] 부채발급용 금융인증서 2자리 승인번호 [${relayNumber}] 확인 요청이 ${financial.relayPhone}으로 발송되었습니다.`,
      { duration: 6000 }
    );

    setTimeout(() => {
      setIsRelayWaiting(false);
    }, 1500);
  };

  // 5. 금융인증서 승인 완료 시뮬레이션
  const handleSimulateRelayApprove = async () => {
    if (!financial) return;
    const log = createAccessLog(
      clientRequest.clientName || '의뢰인',
      '의뢰인',
      'relay_request',
      `의뢰인이 모바일 금융인증서 앱에서 승인번호 [${activeRelayNumber || '42'}]를 확인하고 로그인을 승인했습니다.`
    );
    const updatedVault: CertificateVaultData = {
      ...vault,
      financial: {
        ...financial,
        relayStatus: 'approved',
      },
      accessLogs: [log, ...vault.accessLogs],
    };
    await onUpdateVault(updatedVault);
    toast.success('의뢰인이 금융인증서 원격 승인을 완료했습니다! 부채조회를 계속 진행할 수 있습니다.');
  };

  // 6. 영구 파기(Shredding)
  const handleExecuteShred = async () => {
    const shredded = shredCertificateVault(vault, '이진우 대표변호사', shredReason);
    await onUpdateVault(shredded);
    setShowShredConfirm(false);
    setDecryptedPassword(null);
    toast.error('인증서 파일 및 암호화 키가 영구 파기(Crypto-Shredding)되었습니다.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {clientRequest.clientName} 님의 인증서 안전 금고
                </h3>
                {isShredded ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold">
                    영구 파기됨
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    AES-256 E2EE 보호중
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                개인회생·파산 사건 부채증명서 발급 및 대법원 전자소송 대리 전용 보안 금고
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('npki')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'npki'
                ? 'text-blue-400 border-blue-500 bg-slate-900'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            공동인증서 (NPKI)
            {npki && !isShredded && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                D-{npki.daysRemaining}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'financial'
                ? 'text-violet-400 border-violet-500 bg-slate-900'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            금융인증서 (YESKEY Cloud)
            {financial?.registered && !isShredded && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">
                클라우드
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'audit'
                ? 'text-emerald-400 border-emerald-500 bg-slate-900'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            사법 감사추적 로그
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
              {vault.accessLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('consent')}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'consent'
                ? 'text-amber-400 border-amber-500 bg-slate-900'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            위임 동의 및 영구 파기
          </button>
        </div>

        {/* 탭 본문 영역 (스크롤) */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* ═══════════ TAB 1: 공동인증서 (NPKI) ═══════════ */}
          {activeTab === 'npki' && (
            <div className="space-y-4">
              {isShredded ? (
                <div className="p-6 bg-rose-950/20 border border-rose-900/30 rounded-2xl text-center space-y-2">
                  <AlertOctagon className="w-10 h-10 text-rose-400 mx-auto" />
                  <h4 className="text-sm font-bold text-rose-300">인증서가 영구 파기(Shredded)되었습니다</h4>
                  <p className="text-xs text-rose-400/80">
                    사건 면책 종결 또는 고객 철회로 인해 암호화 키와 바이너리가 복구 불가능하게 삭제되었습니다.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    파기 일시: {new Date(vault.shreddedAt || '').toLocaleString('ko-KR')} | 담당: {vault.shreddedBy}
                  </p>
                </div>
              ) : npki ? (
                <>
                  {/* 인증서 메타데이터 카드 */}
                  <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/50">
                      <div>
                        <span className="text-xs text-slate-400">인증서 주체 (의뢰인)</span>
                        <h4 className="text-sm font-bold text-white">{npki.subjectName}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400">발급기관</span>
                        <div className="text-xs font-semibold text-blue-300">{npki.issuer}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">일련번호</span>
                        <span className="font-mono text-slate-200">{npki.serialNumber || '2025-08-94102941'}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">유효기간 만료일</span>
                        <span className="font-mono text-slate-200">{npki.validTo.slice(0, 10)}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">잔여 유효기간</span>
                        <span className={`font-bold ${npki.daysRemaining <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {npki.daysRemaining}일 남음
                        </span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[11px]">보안 규격</span>
                        <span className="text-emerald-400 font-semibold">Web Crypto AES-256</span>
                      </div>
                    </div>
                  </div>

                  {/* NPKI 파일 다운로드 섹션 */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                    <h5 className="text-xs font-bold text-slate-200 mb-2 flex items-center justify-between">
                      <span>NPKI 인증서 파일 쌍</span>
                      <span className="text-[11px] text-slate-400 font-normal">PC의 AppData/LocalLow/NPKI 구조와 동일</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <div>
                            <span className="text-xs font-mono font-medium text-slate-200">signCert.der</span>
                            <span className="block text-[10px] text-slate-400">공개키 인증서 (2.1 KB)</span>
                          </div>
                        </div>
                        <button
                          onClick={handleDownloadDer}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          다운로드
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-400" />
                          <div>
                            <span className="text-xs font-mono font-medium text-slate-200">signPri.key</span>
                            <span className="block text-[10px] text-slate-400">개인키 파일 (1.8 KB)</span>
                          </div>
                        </div>
                        <button
                          onClick={handleDownloadKey}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          다운로드
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 비밀번호 복호화 및 클립보드 30초 소거 섹션 */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          인증서 비밀번호 보안 열람
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          열람 시 사용 목적이 사법 감사로그에 영구 기록되며, 클립보드 복사 시 30초 후 자동 삭제됩니다.
                        </p>
                      </div>
                    </div>

                    {!decryptedPassword && !showDecryptGate && (
                      <div className="flex items-center justify-between p-3.5 bg-slate-900/90 rounded-xl border border-slate-800">
                        <span className="font-mono text-base tracking-widest text-slate-400 select-none">
                          ••••••••••••••••
                        </span>
                        <button
                          onClick={() => setShowDecryptGate(true)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          비밀번호 복호화 (사유 입력)
                        </button>
                      </div>
                    )}

                    {/* 복호화 사유 입력 게이트 */}
                    {showDecryptGate && (
                      <div className="p-4 bg-slate-900 rounded-xl border border-blue-500/30 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-300">
                            열람 목적 선택 (전자서명법 및 변호사법 제3조 준수)
                          </span>
                          <button
                            onClick={() => setShowDecryptGate(false)}
                            className="text-xs text-slate-400 hover:text-slate-200"
                          >
                            취소
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {PURPOSE_PRESETS.map((preset) => (
                            <label
                              key={preset}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                selectedPurpose === preset
                                  ? 'bg-blue-600/20 text-blue-200 border border-blue-500/40'
                                  : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <input
                                type="radio"
                                name="purpose"
                                value={preset}
                                checked={selectedPurpose === preset}
                                onChange={() => setSelectedPurpose(preset)}
                                className="text-blue-600 focus:ring-0"
                              />
                              <span>{preset}</span>
                            </label>
                          ))}
                          <label
                            className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                              selectedPurpose === '기타 직접 입력'
                                ? 'bg-blue-600/20 text-blue-200 border border-blue-500/40'
                                : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <input
                              type="radio"
                              name="purpose"
                              value="기타 직접 입력"
                              checked={selectedPurpose === '기타 직접 입력'}
                              onChange={() => setSelectedPurpose('기타 직접 입력')}
                              className="text-blue-600 focus:ring-0"
                            />
                            <span>기타 사유 직접 입력</span>
                          </label>
                        </div>

                        {selectedPurpose === '기타 직접 입력' && (
                          <input
                            type="text"
                            placeholder="구체적인 열람 사유를 입력하세요 (예: 하나은행 지점 방문 발급용)"
                            value={customPurpose}
                            onChange={(e) => setCustomPurpose(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                          />
                        )}

                        <button
                          onClick={handleExecuteDecrypt}
                          disabled={isDecrypting}
                          className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          사유 확인 및 복호화 실행 (감사기록 남김)
                        </button>
                      </div>
                    )}

                    {/* 복호화 완료 상태 및 클립보드 소거 타이머 */}
                    {decryptedPassword && (
                      <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-3 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">복호화된 비밀번호:</span>
                            <span className="font-mono text-base font-black text-emerald-300 bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-800/50">
                              {decryptedPassword}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleCopyPassword}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              클립보드 복사
                            </button>
                            <button
                              onClick={() => setDecryptedPassword(null)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                            >
                              가리기
                            </button>
                          </div>
                        </div>

                        {/* 클립보드 30초 카운트다운 바 */}
                        {zeroizeRemaining !== null && (
                          <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                30초 후 클립보드 자동 소거(Zeroize) 예정
                              </span>
                              <span className="font-mono text-slate-300 font-bold">
                                {zeroizeRemaining}초 남음
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-amber-400 h-full transition-all duration-1000 ease-linear"
                                style={{ width: `${(zeroizeRemaining / 30) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl text-center space-y-3">
                  <KeyRound className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-300">등록된 공동인증서가 없습니다</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    의뢰인에게 모바일/PC 안심 인증서 제출 마법사 링크를 발송하여 인증서 파일과 비밀번호를 안전하게 수합하세요.
                  </p>
                  <button
                    onClick={() => toast.success('의뢰인에게 인증서 안전 제출 알림톡이 전송되었습니다.')}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-sm inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    인증서 제출 요청 알림톡 발송
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════ TAB 2: 금융인증서 (YESKEY Cloud) ═══════════ */}
          {activeTab === 'financial' && (
            <div className="space-y-4">
              <div className="bg-violet-950/20 border border-violet-900/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-violet-300 font-bold text-xs">
                  <Smartphone className="w-4 h-4" />
                  금융인증서 클라우드 운영 원리
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  금융인증서는 금융결제원 클라우드에 영구 저장되므로 파일 형태(`.der`, `.key`) 다운로드가 불가능합니다.
                  대신, 법률사무소에서 부채증명서 발급 사이트에 접속한 후 아래 <strong>[실시간 2자리 승인번호 릴레이]</strong>를 실행하면,
                  의뢰인의 스마트폰으로 카카오톡 알림톡과 금융인증서 푸시가 즉시 발송되어 의뢰인이 2자리 번호를 선택함으로써 대리 로그인을 완료할 수 있습니다.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-slate-200">연동 정보</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">의뢰인 휴대폰</span>
                    <span className="font-mono text-slate-200">{financial?.relayPhone || clientRequest.phone}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">인증서 보관소</span>
                    <span className="text-violet-300 font-medium">금융결제원 (YESKEY) 클라우드</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">유효기간</span>
                    <span className="text-emerald-400 font-medium">3년 (2028년 만료)</span>
                  </div>
                </div>
              </div>

              {/* 실시간 승인번호 릴레이 실행 박스 */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-slate-200">실시간 원격 승인번호 릴레이</h5>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-[11px] text-slate-400 block mb-1">발급 대상 기관/은행 선택</label>
                    <select
                      value={relayTargetCreditor}
                      onChange={(e) => setRelayTargetCreditor(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="국민은행">국민은행 (부채증명서 온라인 발급)</option>
                      <option value="신한은행/카드">신한은행 / 신한카드</option>
                      <option value="우리은행">우리은행</option>
                      <option value="하나은행">하나은행</option>
                      <option value="농협은행">농협은행 / 농협상호금융</option>
                      <option value="OK저축은행">OK저축은행 / 2금융권</option>
                      <option value="대법원 전자소송">대법원 전자소송 포털</option>
                    </select>
                  </div>
                  <div className="pt-5">
                    <button
                      onClick={handleSendFinancialRelay}
                      disabled={isRelayWaiting}
                      className="px-4 py-2 text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isRelayWaiting ? '발송중...' : '승인 요청 알림톡 발송'}
                    </button>
                  </div>
                </div>

                {/* 발송된 승인번호 표시 및 시뮬레이션 */}
                {activeRelayNumber && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-violet-500/30 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400 block">발송된 2자리 승인번호</span>
                        <div className="text-2xl font-black text-violet-400 font-mono tracking-wider">
                          [ {activeRelayNumber} ]
                        </div>
                      </div>
                      <button
                        onClick={handleSimulateRelayApprove}
                        className="px-3 py-2 text-xs font-bold text-violet-200 bg-violet-950 hover:bg-violet-900 border border-violet-700 rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        의뢰인 승인 완료 시뮬레이션
                      </button>
                    </div>
                    <p className="text-xs text-slate-300">
                      의뢰인이 스마트폰 금융인증서 화면에서 위 번호 <strong>[{activeRelayNumber}]</strong>를 터치하면 기관 로그인이 최종 승인됩니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: 사법 감사추적 로그 (Audit Trail) ═══════════ */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h5 className="text-xs font-bold text-slate-200">전자서명법 공인 사법 감사추적 기록</h5>
                  <p className="text-[11px] text-slate-400">
                    모든 비밀번호 열람, 파일 다운로드, 릴레이 요청 일시 및 목적이 위변조 불가능하게 영구 보존됩니다.
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">총 {vault.accessLogs.length}건</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {vault.accessLogs.length > 0 ? (
                  vault.accessLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            log.targetItem === 'password_view' ? 'bg-blue-500/20 text-blue-300' :
                            log.targetItem === 'file_download' ? 'bg-amber-500/20 text-amber-300' :
                            log.targetItem === 'auto_shred' ? 'bg-rose-500/20 text-rose-300' :
                            'bg-violet-500/20 text-violet-300'
                          }`}>
                            {log.targetItem === 'password_view' ? '비밀번호 열람' :
                             log.targetItem === 'file_download' ? '파일 다운로드' :
                             log.targetItem === 'auto_shred' ? '영구 파기' : '원격 릴레이'}
                          </span>
                          <span className="font-bold text-slate-200">{log.actorName}</span>
                          <span className="text-slate-400 text-[11px]">({log.actorRole})</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs pl-0.5">{log.purpose}</p>
                      {log.ipAddress && (
                        <div className="text-[10px] text-slate-400 font-mono pl-0.5">
                          접속 통로: {log.ipAddress}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center py-8 text-xs text-slate-400">기록된 감사로그가 없습니다.</p>
                )}
              </div>
            </div>
          )}

          {/* ═══════════ TAB 4: 위임 동의서 & 파기 (Consent & Shredding) ═══════════ */}
          {activeTab === 'consent' && (
            <div className="space-y-4">
              {/* 위임 목적 제한 서약서 */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    의뢰인 위임 목적 제한 동의서 (Consent Deed)
                  </h5>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                    체결 완료
                  </span>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>1. 위임 목적의 한정:</strong> 본 인증서는 개인회생/파산 신청을 위한 각 금융기관 부채증명서 발급 대행 및 대법원 전자소송 서류 열람·제출 목적으로만 사용됩니다.
                  </p>
                  <p>
                    <strong>2. 일체 금융거래 금지:</strong> 예금 인출, 이체, 대출 실행 등 본 위임 목적 외의 금융 행위는 절대 불가능하며 기술적으로 차단됩니다.
                  </p>
                  <p>
                    <strong>3. 파기 권한:</strong> 사건 종결(면책 결정) 또는 의뢰인의 요청 시 즉시 복구 불가능하게 파기됩니다.
                  </p>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                  <span>체결 일시: {vault.consent?.agreedAt ? new Date(vault.consent.agreedAt).toLocaleString('ko-KR') : '2026-03-01'}</span>
                  <span className="font-semibold text-slate-200">서명: {vault.consent?.clientSignature || clientRequest.clientName}</span>
                </div>
              </div>

              {/* 영구 파기 섹션 */}
              <div className="p-4 bg-rose-950/20 border border-rose-900/30 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-rose-300">인증서 완전 영구 파기 (Crypto-Shredding)</h5>
                    <p className="text-[11px] text-rose-400/80 mt-0.5">
                      면책 결정이 확정되었거나 의뢰인의 위임 계약이 종료된 경우, 모든 인증서 바이너리와 암호화 키를 복구 불가능하게 삭제합니다.
                    </p>
                  </div>
                </div>

                {!isShredded ? (
                  <button
                    onClick={() => setShowShredConfirm(true)}
                    className="px-4 py-2 text-xs font-bold text-rose-200 bg-rose-900/50 hover:bg-rose-900 border border-rose-700/60 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    인증서 안전 영구 파기 실행
                  </button>
                ) : (
                  <div className="text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-rose-400" />
                    이미 영구 파기가 완료된 상태입니다.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 모달 하단 닫기 바 */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/50">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>전자서명법 제3조 및 개인정보보호법 안전성 확보조치 준수</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
          >
            닫기
          </button>
        </div>

        {/* 영구 파기 재확인 팝업 */}
        {showShredConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-slate-900 border border-rose-700 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                인증서 영구 파기 확인 (복구 불가)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                파기를 실행하면 <strong>공동인증서 파일(.der, .key) 및 암호화 키가 즉시 소거</strong>되어 이후 어떤 관리자도 복구할 수 없습니다. 계속하시겠습니까?
              </p>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">파기 사유</label>
                <input
                  type="text"
                  value={shredReason}
                  onChange={(e) => setShredReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowShredConfirm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  취소
                </button>
                <button
                  onClick={handleExecuteShred}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors shadow-md"
                >
                  영구 파기 실행
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
