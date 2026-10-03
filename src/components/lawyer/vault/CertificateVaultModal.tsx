import React, { useState, useEffect, useRef } from 'react';
import { 
  X, ShieldCheck, ShieldAlert, KeyRound, Lock, Unlock, Copy, 
  Download, Eye, EyeOff, Clock, AlertTriangle, CheckCircle2, 
  Send, ExternalLink, RefreshCw, Trash2, Smartphone, FileText, Check, AlertOctagon, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import type { ConsultRequest, CertificateVaultData, CertificateAccessLog } from '../../../types';
import { 
  openNpkiSecrets,
  isLegacyNpki,
  downloadBase64File, 
  copyWithAutoZeroize, 
  safeCopyToClipboard,
  createAccessLog, 
  shredCertificateVault,
  buildFinancialRelayGuide,
  recordFinancialRelayGuide,
  computeDaysRemaining,
  formatLocalDate,
} from '../../../services/vault/certificateVaultService';
import ClientCertificateSubmissionModal from '../../client/vault/ClientCertificateSubmissionModal';

interface CertificateVaultModalProps {
  clientId: string;
  clientRequest: ConsultRequest;
  vault: CertificateVaultData;
  onUpdateVault: (updated: CertificateVaultData) => Promise<void>;
  onClose: () => void;
  /** 열람 기록에 남길 담당자 이름 (이전: '김수현 (수임사무장)'·'이진우 대표변호사' 하드코딩) */
  actorName?: string;
  actorRole?: string;
}

/** Base64 길이로 실제 파일 크기 표시 (이전: 2.1 KB / 1.8 KB 고정) */
const formatB64Size = (b64?: string) => {
  if (!b64) return '크기 확인 불가';
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  const bytes = Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`;
};

type TabType = 'npki' | 'financial' | 'audit' | 'consent';

const PURPOSE_PRESETS = [
  '국민은행/시중은행 온라인 부채증명서 대리 발급',
  '신한카드/캐피탈/저축은행 온라인 부채내역 조회 및 발급',
  '대법원 전자소송(ECFS) 포털 당사자 본인인증 및 사건조회',
  '어카운트인포/국세청/위택스 공공 서류 전수조회',
  // (삭제) '부채발급 대행사(…) 안전 전송' — 의뢰인 인증서를 제3자에게 넘기는 목적은 위임 범위 밖일 수 있어 기본 선택지에서 제외
];

export default function CertificateVaultModal({
  clientId,
  clientRequest,
  vault,
  onUpdateVault,
  onClose,
  actorName = '담당자(이름 미확인)',
  actorRole = '담당자',
}: CertificateVaultModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('npki');
  
  // NPKI 복호화 상태
  const [showDecryptGate, setShowDecryptGate] = useState(false);
  const [selectedPurpose, setSelectedPurpose] = useState(PURPOSE_PRESETS[0]);
  const [customPurpose, setCustomPurpose] = useState('');
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  // 의뢰인이 별도로 알려 준 보관 PIN (저장하지 않음). 연 개인키 파일은 이 모달이 열려 있는 동안만 메모리에 둔다.
  const [vaultPin, setVaultPin] = useState('');
  const [openedKeyBase64, setOpenedKeyBase64] = useState<string | null>(null);

  // 클립보드 30초 자동 소거 상태
  const [zeroizeRemaining, setZeroizeRemaining] = useState<number | null>(null);
  const cancelZeroizeRef = useRef<((clearNow?: boolean) => void) | null>(null);

  // 금융인증서 원격 승인 안내 (자동 발송·번호 생성 없음)
  const [relayTargetCreditor, setRelayTargetCreditor] = useState('국민은행');

  // 신규 수합 인증서 직접 등록 모달
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  // 버튼 클릭 시각 피드백
  const [copiedType, setCopiedType] = useState<'financial' | 'submit_request' | null>(null);

  // 영구 파기(Shredding) 확인 모달
  const [showShredConfirm, setShowShredConfirm] = useState(false);
  const [shredReason, setShredReason] = useState('사건 면책 결정 확정에 따른 고객 정보 영구 파기');

  const npki = vault.npki;
  const financial = vault.financial;
  const isShredded = vault.status === 'shredded';
  // 저장된 daysRemaining은 업로드 시점 값이라 매번 재계산
  const npkiDays = npki ? computeDaysRemaining(npki.validTo) : null;

  // 언마운트(모달 닫기) 시 타이머 해제 + 클립보드 즉시 소거 시도
  useEffect(() => {
    return () => {
      if (cancelZeroizeRef.current) {
        cancelZeroizeRef.current(true);
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
      if (!vaultPin) {
        toast.error('의뢰인에게 받은 보관 PIN을 입력해 주세요.');
        return;
      }
      // [PART 4] 의뢰인 보관 PIN으로만 열린다 (이전: 앱 내장 고정 키로 누구나 복호화)
      const opened = await openNpkiSecrets(npki, vaultPin);

      setDecryptedPassword(opened.password);
      setOpenedKeyBase64(opened.keyBase64);
      setVaultPin('');
      setShowDecryptGate(false);

      // 감사 로그 기록
      const log = createAccessLog(actorName, actorRole, 'password_view', finalPurpose);

      const updatedVault: CertificateVaultData = {
        ...vault,
        accessLogs: [log, ...vault.accessLogs],
      };

      await onUpdateVault(updatedVault);
      toast.success('인증서 비밀번호가 복호화되었습니다. 열람 기록이 이 브라우저에 저장되었습니다.');
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
      (ok) => {
        setZeroizeRemaining(null);
        if (ok) toast.info('클립보드를 비웠습니다.');
        else toast.error('클립보드 자동 소거에 실패했습니다 (브라우저 권한/포커스). 다른 텍스트를 복사해 직접 덮어써 주세요.', { duration: 8000 });
      },
      (ok) => {
        if (ok) toast.success('비밀번호가 복사되었습니다. 30초 후 클립보드 소거를 시도합니다.');
        else toast.error('클립보드 복사에 실패했습니다. 화면의 비밀번호를 직접 입력해 주세요.');
      }
    );

    cancelZeroizeRef.current = cancel;
  };

  // 3. 파일 다운로드
  const handleDownloadDer = () => {
    if (!npki?.derBase64) return;
    downloadBase64File(npki.derBase64, npki.derFileName || 'signCert.der');

    const log = createAccessLog(actorName, actorRole, 'file_download', 'signCert.der 공개키 인증서 다운로드');
    onUpdateVault({ ...vault, accessLogs: [log, ...vault.accessLogs] });
    toast.success('signCert.der 파일이 다운로드되었습니다.');
  };

  const handleDownloadKey = () => {
    // 개인키는 보관 PIN으로 연 뒤에만 내려받을 수 있다
    if (!openedKeyBase64) {
      toast.error('개인키 파일은 보관 PIN으로 먼저 열어야 내려받을 수 있습니다.');
      return;
    }
    downloadBase64File(openedKeyBase64, npki?.keyFileName || 'signPri.key');

    const log = createAccessLog(actorName, actorRole, 'file_download', 'signPri.key 개인키 파일 다운로드');
    onUpdateVault({ ...vault, accessLogs: [log, ...vault.accessLogs] });
    toast.success('signPri.key 개인키 파일이 다운로드되었습니다. 사용 후 PC에서 삭제해 주세요.');
  };

  // 4. 금융인증서 원격 승인 안내 문구 복사
  const handleCopyFinancialRelayGuide = async () => {
    if (isShredded) return;
    const text = buildFinancialRelayGuide(clientRequest.clientName || '', relayTargetCreditor);
    const ok = await safeCopyToClipboard(text);
    if (!ok) {
      toast.error('클립보드 복사에 실패했습니다.');
      return;
    }
    setCopiedType('financial');
    setTimeout(() => setCopiedType(null), 2000);
    await onUpdateVault(recordFinancialRelayGuide(vault, actorName, actorRole, relayTargetCreditor));
    toast.success(`[${relayTargetCreditor}] 원격 승인 안내 문구가 복사되었습니다. 통화 또는 카카오톡으로 전달해 주세요.`, { duration: 5000 });
  };

  // 5. 이 브라우저 사본 삭제
  const handleExecuteShred = async () => {
    const shredded = shredCertificateVault(vault, actorName, shredReason);
    await onUpdateVault(shredded);
    setShowShredConfirm(false);
    setDecryptedPassword(null);
    setOpenedKeyBase64(null);
    toast.success('이 브라우저에 저장된 인증서 파일과 암호화된 비밀번호를 삭제했습니다. 내려받은 파일·다른 기기 사본은 따로 삭제해야 합니다.', { duration: 8000 });
  };

  // 6. 미등록 시 제출 요청 문구 복사
  const handleCopySubmitRequest = async () => {
    const text = `[${clientRequest.clientName || '의뢰인'}님] 부채증명서 발급 대행을 위해 공동인증서(NPKI) 또는 금융인증서 협조가 필요합니다.\n` +
      `1. 금융인증서: PC 파일 없이 전화 통화 중 휴대폰으로 원격 승인\n` +
      `2. 공동인증서: PC의 인증서 파일(signCert.der, signPri.key)을 사무소 카카오톡/이메일로 전송\n` +
      `편하신 방법으로 담당자에게 알려주시면 신속히 안내해 드리겠습니다.`;
    const ok = await safeCopyToClipboard(text);
    if (!ok) {
      toast.error('클립보드 복사에 실패했습니다.');
      return;
    }
    setCopiedType('submit_request');
    setTimeout(() => setCopiedType(null), 2000);
    toast.success('인증서 협조 안내 문구가 복사되었습니다. 카카오톡이나 문자로 전달해 주세요.', { duration: 5000 });
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold">
                    사본 삭제됨
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    이 브라우저에만 보관
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
              <span className="text-xs px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300">
                {npkiDays === null ? '만료일 미확인' : npkiDays <= 0 ? '만료' : `D-${npkiDays}`}
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
              <span className="text-xs px-1.5 py-0.2 rounded bg-violet-500/20 text-violet-300">
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
            열람 기록
            <span className="text-xs px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
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
            위임 동의 및 사본 삭제
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
                  <h4 className="text-sm font-bold text-rose-300">이 브라우저의 인증서 사본이 삭제되었습니다</h4>
                  <p className="text-xs text-rose-400/80">
                    이 브라우저에 저장된 인증서 파일과 암호화된 비밀번호를 비웠습니다. 이전에 내려받은 파일이나 다른 기기의 사본은 이 기능으로 삭제되지 않습니다.
                  </p>
                  <p className="text-xs text-slate-400">
                    삭제 일시: {vault.shreddedAt ? new Date(vault.shreddedAt).toLocaleString('ko-KR') : '-'} | 담당: {vault.shreddedBy || '-'}
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
                        <span className="text-slate-400 block text-xs">일련번호</span>
                        <span className="font-mono text-slate-200 break-all">{npki.serialNumber || '확인 불가'}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-xs">유효기간 만료일</span>
                        <span className="font-mono text-slate-200">{formatLocalDate(npki.validTo)}</span>
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-xs">잔여 유효기간</span>
                        {npkiDays === null ? (
                          <span className="font-bold text-slate-400">확인 불가</span>
                        ) : npkiDays <= 0 ? (
                          <span className="font-bold text-rose-400">만료됨</span>
                        ) : (
                          <span className={`font-bold ${npkiDays <= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {npkiDays}일 남음
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-xs">보안 수준</span>
                        <span className="text-amber-400 font-semibold">비밀번호만 AES-GCM (앱 내장 키) · 인증서 파일은 미암호화 — 서버 KMS 전환 필요</span>
                      </div>
                    </div>
                  </div>

                  {/* NPKI 파일 다운로드 섹션 */}
                  <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <h5 className="text-xs font-bold text-slate-200">
                        NPKI 인증서 파일 쌍
                        <span className="text-xs text-slate-400 font-normal ml-2">PC의 AppData/LocalLow/NPKI 구조와 동일</span>
                      </h5>
                      <button
                        onClick={() => setIsSubmissionModalOpen(true)}
                        className="px-2.5 py-1 text-xs font-semibold text-blue-300 hover:text-white bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/50 rounded-lg transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <Upload className="w-3 h-3" />
                        인증서 재등록/교체
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <div>
                            <span className="text-xs font-mono font-medium text-slate-200">signCert.der</span>
                            <span className="block text-xs text-slate-400">공개키 인증서 ({formatB64Size(npki.derBase64)})</span>
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
                            <span className="block text-xs text-slate-400">개인키 파일 ({openedKeyBase64 ? formatB64Size(openedKeyBase64) : isLegacyNpki(npki) ? '재등록 필요' : '보관 PIN으로 잠김'})</span>
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
                        <p className="text-xs text-slate-400 mt-0.5">
                          의뢰인이 정한 보관 PIN으로만 열립니다(앱·서버에 키 없음). 열람 목적이 이 브라우저 기록에 남고, 클립보드 복사 시 30초 후 소거를 시도합니다.
                        </p>
                      </div>
                    </div>

                    {isLegacyNpki(npki) && (
                      <div className="p-3 bg-amber-950/30 border border-amber-700/40 rounded-xl text-xs text-amber-200 leading-relaxed">
                        이전 방식(앱 내장 키)으로 저장된 인증서라 열 수 없습니다. 이 기기의 평문 개인키는 삭제했습니다. 의뢰인에게 보관 PIN을 정해 다시 등록해 달라고 요청해 주세요.
                      </div>
                    )}

                    {!decryptedPassword && !showDecryptGate && !isLegacyNpki(npki) && (
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
                            열람 목적 선택 (의뢰인이 동의한 위임 범위 안에서만 사용)
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

                        <div>
                          <label htmlFor="vault-open-pin" className="text-xs text-slate-300 block mb-1">의뢰인 보관 PIN (전화 등 별도 경로로 받은 값)</label>
                          <input
                            id="vault-open-pin"
                            type="password"
                            autoComplete="off"
                            value={vaultPin}
                            onChange={(e) => setVaultPin(e.target.value)}
                            placeholder="보관 PIN 입력"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                          />
                        </div>

                        <button
                          onClick={handleExecuteDecrypt}
                          disabled={isDecrypting}
                          className="w-full py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {isDecrypting ? '여는 중...' : '사유 확인 후 PIN으로 열기 (열람 기록 남김)'}
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
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                30초 후 클립보드 소거 시도 예정
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
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed break-keep">
                    고객과 통화하여 PC에 다운로드받으셨거나 카카오톡/이메일로 수합한 인증서 파일(signCert.der, signPri.key)을 금고에 직접 등록하세요.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => setIsSubmissionModalOpen(true)}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-md inline-flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      인증서 파일 직접 등록 (사무소 수합분)
                    </button>
                    <button
                      onClick={handleCopySubmitRequest}
                      className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap ${
                        copiedType === 'submit_request'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95'
                      }`}
                    >
                      {copiedType === 'submit_request' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'submit_request' ? '안내 문구 복사 완료!' : '의뢰인 안내 문구 복사'}
                    </button>
                  </div>
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
                  금융인증서는 금융결제원 클라우드에 보관되므로 파일(`.der`, `.key`)로 내려받을 수 없습니다.
                  발급기관 사이트에서 금융인증서 로그인을 시작하면 의뢰인 휴대폰에 인증 요청이 가고, 의뢰인이 직접 승인해야 합니다.
                  이 앱은 금융결제원과 연동되어 있지 않아 요청을 보내거나 승인 여부를 확인하지 못합니다. 아래 버튼은 의뢰인에게 보낼 안내 문구만 복사합니다.
                </p>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-slate-200">연동 정보</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-xs">의뢰인 휴대폰</span>
                    <span className="font-mono text-slate-200">{financial?.relayPhone || clientRequest.phone}</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-xs">인증서 보관소</span>
                    <span className="text-violet-300 font-medium">금융결제원 (YESKEY) 클라우드</span>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-xs">유효기간 만료일</span>
                    <span className="text-slate-200 font-mono">{formatLocalDate(financial?.expiresAt)}</span>
                  </div>
                </div>
              </div>

              {/* 실시간 승인번호 릴레이 실행 박스 */}
              <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4 space-y-3">
                <h5 className="text-xs font-bold text-slate-200">원격 승인 안내 문구</h5>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-xs text-slate-400 block mb-1">발급 대상 기관/은행 선택</label>
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
                      onClick={handleCopyFinancialRelayGuide}
                      disabled={isShredded}
                      className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                        copiedType === 'financial'
                          ? 'bg-emerald-600 hover:bg-emerald-500'
                          : 'bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed'
                      }`}
                    >
                      {copiedType === 'financial' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedType === 'financial' ? '원격 승인 문구 복사 완료!' : '안내 문구 복사 (통화·카톡 전달)'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed break-keep">
                  💡 발급기관 화면에 표시된 2자리 번호를 고객과 통화 또는 카카오톡으로 알려주세요. 의뢰인이 스마트폰 금융인증서 앱에서 해당 번호를 승인하면 발급이 완료됩니다.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════ TAB 3: 사법 감사추적 로그 (Audit Trail) ═══════════ */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h5 className="text-xs font-bold text-slate-200">열람 기록 (이 브라우저)</h5>
                  <p className="text-xs text-slate-400">
                    비밀번호 열람, 파일 다운로드, 안내 문구 복사 일시와 목적을 이 브라우저에 기록합니다. 서버에 저장되지 않으며 위변조 방지 기능은 없습니다.
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
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                            log.targetItem === 'password_view' ? 'bg-blue-500/20 text-blue-300' :
                            log.targetItem === 'file_download' ? 'bg-amber-500/20 text-amber-300' :
                            log.targetItem === 'auto_shred' ? 'bg-rose-500/20 text-rose-300' :
                            'bg-violet-500/20 text-violet-300'
                          }`}>
                            {log.targetItem === 'password_view' ? '비밀번호 열람' :
                             log.targetItem === 'file_download' ? '파일 다운로드' :
                             log.targetItem === 'auto_shred' ? '사본 삭제' :
                             log.targetItem === 'register' ? '등록' :
                             log.targetItem === 'revocation' ? '철회' : '원격 승인 안내'}
                          </span>
                          <span className="font-bold text-slate-200">{log.actorName}</span>
                          <span className="text-slate-400 text-xs">({log.actorRole})</span>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                          {new Date(log.timestamp).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs pl-0.5">{log.purpose}</p>
                      {log.ipAddress && (
                        <div className="text-xs text-slate-400 font-mono pl-0.5">
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
                  {vault.consent?.agreed ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      의뢰인 동의함
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                      동의 기록 없음
                    </span>
                  )}
                </div>

                <div className="p-3 bg-slate-900 rounded-xl text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    <strong>1. 위임 목적의 한정:</strong> 본 인증서는 개인회생/파산 신청을 위한 각 금융기관 부채증명서 발급 대행 및 대법원 전자소송 서류 열람·제출 목적으로만 사용됩니다.
                  </p>
                  <p>
                    <strong>2. 금융거래 금지:</strong> 예금 인출, 이체, 대출 실행 등 위임 목적 외의 금융 행위에 사용하지 않습니다. (동의서상 약정이며, 이 앱이 기술적으로 차단하지는 않습니다)
                  </p>
                  <p>
                    <strong>3. 삭제:</strong> 사건 종결 또는 의뢰인 요청 시 사무소에 보관된 사본(이 브라우저·내려받은 파일 포함)을 삭제합니다.
                  </p>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
                  <span>동의 일시: {vault.consent?.agreedAt ? new Date(vault.consent.agreedAt).toLocaleString('ko-KR') : '-'}</span>
                  <span className="font-semibold text-slate-200">서명: {vault.consent?.clientSignature || '-'}</span>
                </div>
              </div>

              {/* 영구 파기 섹션 */}
              <div className="p-4 bg-rose-950/20 border border-rose-900/30 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <div>
                    <h5 className="text-xs font-bold text-rose-300">이 브라우저의 인증서 사본 삭제</h5>
                    <p className="text-xs text-rose-400/80 mt-0.5">
                      이 브라우저에 저장된 인증서 파일과 암호화된 비밀번호를 비웁니다. 내려받은 파일, 다른 기기·브라우저의 사본은 남으므로 따로 삭제해야 합니다.
                    </p>
                  </div>
                </div>

                {!isShredded ? (
                  <button
                    onClick={() => setShowShredConfirm(true)}
                    className="px-4 py-2 text-xs font-bold text-rose-200 bg-rose-900/50 hover:bg-rose-900 border border-rose-700/60 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    이 브라우저 사본 삭제
                  </button>
                ) : (
                  <div className="text-xs text-rose-300 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-rose-400" />
                    이 브라우저의 사본은 이미 삭제되었습니다.
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
            <span>이 브라우저에만 저장 · 인증서 파일 미암호화 · 서버 KMS 전환 전 운영 사용 주의</span>
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
                이 브라우저 사본 삭제 확인
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>이 브라우저에 저장된 공동인증서 파일(.der, .key)과 암호화된 비밀번호를 비웁니다.</strong> 이 브라우저에서는 다시 열람할 수 없습니다.
                이미 내려받은 파일, 다른 기기·브라우저의 사본은 삭제되지 않습니다. 계속하시겠습니까?
              </p>

              <div>
                <label className="text-xs text-slate-400 block mb-1">파기 사유</label>
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
                  사본 삭제 실행
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 신규 수합 인증서 직접 등록 모달 */}
        {isSubmissionModalOpen && (
          <ClientCertificateSubmissionModal
            clientId={clientId}
            clientName={clientRequest.clientName || '의뢰인'}
            clientPhone={clientRequest.phone || ''}
            existingVault={vault}
            mode="lawyer"
            actorName={actorName}
            actorRole={actorRole}
            onSaveVault={async (updated) => {
              await onUpdateVault(updated);
              setIsSubmissionModalOpen(false);
            }}
            onClose={() => setIsSubmissionModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
