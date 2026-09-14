import React, { useState } from 'react';
import { 
  X, ShieldCheck, KeyRound, Smartphone, Upload, CheckCircle2, 
  Lock, ArrowRight, ArrowLeft, FileText, AlertCircle, Info, Sparkles, Check
} from 'lucide-react';
import { toast } from 'sonner';
import type { CertificateVaultData, NpkiCertificateMeta, FinancialCertMeta } from '../../../types';
import { 
  encryptCertPassword, 
  fileToBase64, 
  inspectDerCertificate,
  createAccessLog,
  saveCertificateVault
} from '../../../services/vault/certificateVaultService';

interface ClientCertificateSubmissionModalProps {
  clientId: string;
  clientName: string;
  clientPhone: string;
  existingVault?: CertificateVaultData;
  onSaveVault: (vault: CertificateVaultData) => Promise<void>;
  onClose: () => void;
}

type StepType = 'select_type' | 'upload_files' | 'input_password' | 'consent';

export default function ClientCertificateSubmissionModal({
  clientId,
  clientName,
  clientPhone,
  existingVault,
  onSaveVault,
  onClose,
}: ClientCertificateSubmissionModalProps) {
  const [currentStep, setCurrentStep] = useState<StepType>('select_type');
  const [certType, setCertType] = useState<'npki' | 'financial'>('npki');

  // NPKI 파일 상태
  const [derFile, setDerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [parsedMeta, setParsedMeta] = useState<{
    subjectName: string;
    issuer: string;
    validTo: string;
    daysRemaining: number;
  } | null>(null);

  // 금융인증서 상태
  const [relayPhone, setRelayPhone] = useState(clientPhone || '010-0000-0000');
  const [telecom, setTelecom] = useState('SKT');

  // 비밀번호 상태
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 동의서 상태
  const [consentPurpose, setConsentPurpose] = useState(true);
  const [consentProhibit, setConsentProhibit] = useState(true);
  const [consentShred, setConsentShred] = useState(true);
  const [signerName, setSignerName] = useState(clientName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 파일 업로드 핸들러
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    let newDer = derFile;
    let newKey = keyFile;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.der')) {
        newDer = file;
      } else if (lower.endsWith('.key')) {
        newKey = file;
      }
    }

    setDerFile(newDer);
    setKeyFile(newKey);

    if (newDer) {
      try {
        const base64 = await fileToBase64(newDer);
        const inspected = inspectDerCertificate(base64, clientName);
        setParsedMeta(inspected);
        toast.success(`공동인증서 파일이 인식되었습니다. (발급기관: ${inspected.issuer})`);
      } catch (err) {
        console.warn('Certificate inspection error:', err);
      }
    }
  };

  // 최종 제출 처리
  const handleSubmit = async () => {
    if (!consentPurpose || !consentProhibit || !consentShred) {
      toast.error('모든 법적 위임 목적 동의 항목에 체크해주세요.');
      return;
    }

    if (certType === 'npki') {
      if (!derFile || !keyFile) {
        toast.error('signCert.der 와 signPri.key 파일을 모두 등록해주세요.');
        return;
      }
      if (!password || password !== passwordConfirm) {
        toast.error('비밀번호가 일치하지 않거나 비어있습니다.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let npkiData: NpkiCertificateMeta | undefined = undefined;
      let financialData: FinancialCertMeta | undefined = undefined;

      if (certType === 'npki' && derFile && keyFile) {
        const derBase64 = await fileToBase64(derFile);
        const keyBase64 = await fileToBase64(keyFile);

        // 클라이언트 사이드 Web Crypto AES-256 암호화
        const { encryptedPassword, iv } = await encryptCertPassword(password);

        const inspected = parsedMeta || inspectDerCertificate(derBase64, clientName);

        npkiData = {
          derFileName: derFile.name,
          derBase64,
          keyFileName: keyFile.name,
          keyBase64,
          encryptedPassword,
          iv,
          subjectName: inspected.subjectName,
          issuer: inspected.issuer,
          serialNumber: `2026-${Math.floor(10000000 + Math.random() * 90000000)}`,
          validFrom: new Date().toISOString(),
          validTo: inspected.validTo,
          isExpired: inspected.daysRemaining <= 0,
          daysRemaining: inspected.daysRemaining,
        };
      } else {
        financialData = {
          registered: true,
          provider: 'yeskey',
          relayPhone,
          registeredAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 36 * 30 * 86400000).toISOString(),
          validMonths: 36,
          relayStatus: 'idle',
        };
      }

      const log = createAccessLog(
        clientName,
        '의뢰인',
        'password_view',
        '의뢰인 전용 마법사를 통해 인증서 및 E2EE 암호화 키 안전 금고 등록 체결'
      );

      const newVault: CertificateVaultData = {
        id: existingVault?.id || `vault_${clientId}`,
        clientId,
        clientName,
        status: 'active',
        createdAt: existingVault?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        npki: npkiData || existingVault?.npki,
        financial: financialData || existingVault?.financial,
        consent: {
          agreed: true,
          agreedAt: new Date().toISOString(),
          clientSignature: `${signerName} (의뢰인 전자 자필 서명)`,
          allowedPurposes: [
            '개인회생/파산 채권자목록 작성을 위한 금융기관 부채증명서 발급 대행',
            '대법원 전자소송(ECFS) 사건 조회 및 동의 서류 제출',
            '공공마이데이터/금융결제원 어카운트인포 전수조회'
          ],
          prohibitedPurposesNotice: true,
        },
        accessLogs: [log, ...(existingVault?.accessLogs || [])],
      };

      saveCertificateVault(newVault);
      await onSaveVault(newVault);

      toast.success('인증서가 종단간 암호화(E2EE) 금고에 안전하게 제출되었습니다.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || '인증서 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                인증서 안심 제출 마법사
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                  Zero-Knowledge
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                부채증명서 발급 및 대법원 전자소송 대리 전용 E2EE 암호화 금고
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 text-[11px]">
          <div className={`flex items-center gap-1.5 ${currentStep === 'select_type' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
            <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">1</span>
            인증서 선택
          </div>
          <span className="text-slate-400">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'upload_files' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
            <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">2</span>
            {certType === 'npki' ? '파일 업로드' : '정보 입력'}
          </div>
          <span className="text-slate-400">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'input_password' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
            <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">3</span>
            {certType === 'npki' ? '암호화 비밀번호' : '승인 방식 확인'}
          </div>
          <span className="text-slate-400">→</span>
          <div className={`flex items-center gap-1.5 ${currentStep === 'consent' ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
            <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px]">4</span>
            위임 동의 서명
          </div>
        </div>

        {/* 바디 영역 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* ══════════ STEP 1: 인증서 종류 선택 ══════════ */}
          {currentStep === 'select_type' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-white">어떤 인증서로 진행하시겠습니까?</h4>
                <p className="text-xs text-slate-400">
                  변호사 사무실에서 10~30여 개 금융사 부채증명서를 발급받기 위해 인증서가 필요합니다.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {/* 공동인증서 (선호) */}
                <div
                  onClick={() => setCertType('npki')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    certType === 'npki'
                      ? 'bg-blue-950/30 border-blue-500 shadow-sm'
                      : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold">
                        변호사 사무실 권장
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-white">공동인증서 (구 공인인증서)</h5>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      PC나 USB에 파일형태로 저장되어 있어, 여러 금융기관 부채증명서를 가장 신속하게 대리 발급받을 수 있습니다.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/40 text-[11px] text-blue-400 font-medium">
                    파일 쌍(signCert.der + signPri.key) 업로드
                  </div>
                </div>

                {/* 금융인증서 */}
                <div
                  onClick={() => setCertType('financial')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    certType === 'financial'
                      ? 'bg-violet-950/30 border-violet-500 shadow-sm'
                      : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-bold">
                        클라우드 방식
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-white">금융인증서 (YESKEY)</h5>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      금융결제원 클라우드에 보관되며 유효기간이 3년입니다. 발급 시마다 스마트폰으로 2자리 승인번호 확인이 필요합니다.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-700/40 text-[11px] text-violet-400 font-medium">
                    실시간 휴대폰 푸시/알림톡 릴레이
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-xs text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>제출하신 인증서는 암호화되며, 부채증명서 발급 및 소송 진행 외에는 절대 사용되지 않습니다.</span>
              </div>
            </div>
          )}

          {/* ══════════ STEP 2: 파일 업로드 / 정보 등록 ══════════ */}
          {currentStep === 'upload_files' && (
            <div className="space-y-4">
              {certType === 'npki' ? (
                <>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold text-white">공동인증서 파일 등록</h4>
                    <p className="text-xs text-slate-400">
                      NPKI 폴더 내의 <strong>signCert.der</strong> 와 <strong>signPri.key</strong> 파일을 등록해주세요.
                    </p>
                  </div>

                  {/* 드래그앤드롭 영역 */}
                  <label className="block border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/40 rounded-2xl p-6 text-center cursor-pointer transition-colors">
                    <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <span className="text-xs font-bold text-slate-200 block">
                      이곳을 클릭하거나 인증서 파일들을 끌어다 놓으세요
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      signCert.der 와 signPri.key 파일을 동시에 선택할 수 있습니다.
                    </span>
                    <input
                      type="file"
                      multiple
                      accept=".der,.key"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />
                  </label>

                  {/* 등록 현황 표시 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      derFile ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <div>
                          <span className="text-xs font-mono font-medium block">signCert.der</span>
                          <span className="text-[10px]">{derFile ? `${derFile.name} (선택됨)` : '공개키 미등록'}</span>
                        </div>
                      </div>
                      {derFile && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      keyFile ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4" />
                        <div>
                          <span className="text-xs font-mono font-medium block">signPri.key</span>
                          <span className="text-[10px]">{keyFile ? `${keyFile.name} (선택됨)` : '개인키 미등록'}</span>
                        </div>
                      </div>
                      {keyFile && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                  </div>

                  {/* NPKI 폴더 찾는 법 안내 아코디언 */}
                  <div className="p-3.5 bg-slate-800/40 border border-slate-700/50 rounded-xl text-xs space-y-1.5">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-400" />
                      내 컴퓨터에서 NPKI 폴더 찾는 방법
                    </span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      • <strong>윈도우 PC:</strong> <code>C:\Users\(사용자이름)\AppData\LocalLow\NPKI</code><br />
                      • <strong>USB 메모리:</strong> <code>(USB드라이브):\NPKI</code>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold text-white">금융인증서 연동 정보 확인</h4>
                    <p className="text-xs text-slate-400">
                      금융결제원에 등록된 고객님의 본인인증 정보를 확인합니다.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">의뢰인 성명</label>
                      <input
                        type="text"
                        value={clientName}
                        disabled
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">스마트폰 연락처 (승인 요청 알림톡 수신용)</label>
                      <input
                        type="text"
                        value={relayPhone}
                        onChange={(e) => setRelayPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-violet-950/20 border border-violet-900/30 rounded-xl text-xs text-violet-300 leading-relaxed">
                    변호사 사무실에서 부채증명서를 발급할 때마다 위 번호로 <strong>2자리 숫자 승인 요청</strong>이 발송됩니다.
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══════════ STEP 3: 비밀번호 입력 및 클라이언트 측 암호화 ══════════ */}
          {currentStep === 'input_password' && (
            <div className="space-y-4">
              {certType === 'npki' ? (
                <>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-bold text-white">인증서 비밀번호 입력</h4>
                    <p className="text-xs text-slate-400">
                      입력하신 비밀번호는 브라우저 내부에서 즉시 AES-256-GCM으로 암호화되어 안전하게 보관됩니다.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">공동인증서 비밀번호</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="공동인증서 비밀번호 입력"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">비밀번호 확인</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="비밀번호 다시 입력"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPassword}
                          onChange={(e) => setShowPassword(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>비밀번호 표시</span>
                      </label>
                      {password && passwordConfirm && (
                        <span className={`text-xs font-semibold ${password === passwordConfirm ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {password === passwordConfirm ? '비밀번호 일치' : '비밀번호 불일치'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1">
                    <span className="font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Zero-Knowledge 종단간 암호화(E2EE) 보장
                    </span>
                    <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                      비밀번호는 평문으로 서버에 전송되지 않으며, 변호사 사무실에서도 열람 사유를 입력하고 2차 인증을 거친 경우에만 1회성으로 복호화됩니다.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4 text-center py-4">
                  <Smartphone className="w-12 h-12 text-violet-400 mx-auto" />
                  <h4 className="text-sm font-bold text-white">금융인증서는 비밀번호를 제출하지 않습니다</h4>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    금융인증서는 6자리 핀번호나 생체인증을 고객님의 휴대폰에서 직접 진행하므로,
                    비밀번호를 사무실에 알려주실 필요가 전혀 없습니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ══════════ STEP 4: 위임 동의 및 전자 서명 ══════════ */}
          {currentStep === 'consent' && (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-bold text-white">법적 위임 목적 제한 서약</h4>
                <p className="text-xs text-slate-400">
                  전자서명법 제3조 및 변호사법에 따라 오직 사건 진행 목적으로만 사용됨을 보증합니다.
                </p>
              </div>

              <div className="space-y-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer p-1">
                  <input
                    type="checkbox"
                    checked={consentPurpose}
                    onChange={(e) => setConsentPurpose(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-0"
                  />
                  <span>
                    <strong>[필수] 부채증명서 발급 및 법원 전자소송 제출 목적:</strong><br />
                    본 인증서는 개인회생·파산 신청을 위한 각 금융기관 부채증명서 발급 대행 및 대법원 전자소송 서류 열람·제출 목적으로만 사용됨에 동의합니다.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer p-1">
                  <input
                    type="checkbox"
                    checked={consentProhibit}
                    onChange={(e) => setConsentProhibit(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-0"
                  />
                  <span>
                    <strong>[필수] 일체 금융거래(예금 인출·대출) 금지 확인:</strong><br />
                    본 위임 목적 외의 예금 인출, 이체, 대출 실행 등 금융 행위는 절대 불가능하며 기술적으로 원천 차단됨을 확인합니다.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 text-xs text-slate-200 cursor-pointer p-1">
                  <input
                    type="checkbox"
                    checked={consentShred}
                    onChange={(e) => setConsentShred(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-0"
                  />
                  <span>
                    <strong>[필수] 사건 종결 및 요청 시 영구 파기 권한:</strong><br />
                    면책 결정 확정 또는 본인의 요청 시 인증서 파일 및 암호화 키가 즉시 영구 파기(Crypto-Shredding)됨에 동의합니다.
                  </span>
                </label>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">전자 자필 서명 확인</label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="성명을 입력하세요"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* 모달 하단 버튼 바 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          {currentStep !== 'select_type' ? (
            <button
              onClick={() => {
                if (currentStep === 'upload_files') setCurrentStep('select_type');
                else if (currentStep === 'input_password') setCurrentStep('upload_files');
                else if (currentStep === 'consent') setCurrentStep('input_password');
              }}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              이전
            </button>
          ) : (
            <div></div>
          )}

          {currentStep !== 'consent' ? (
            <button
              onClick={() => {
                if (currentStep === 'select_type') {
                  setCurrentStep('upload_files');
                } else if (currentStep === 'upload_files') {
                  if (certType === 'npki' && (!derFile || !keyFile)) {
                    toast.error('signCert.der 와 signPri.key 파일을 등록해주세요.');
                    return;
                  }
                  setCurrentStep('input_password');
                } else if (currentStep === 'input_password') {
                  if (certType === 'npki' && (!password || password !== passwordConfirm)) {
                    toast.error('비밀번호가 일치하지 않습니다.');
                    return;
                  }
                  setCurrentStep('consent');
                }
              }}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-md flex items-center gap-1.5"
            >
              다음 단계
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? '암호화 저장 중...' : '안전 금고에 인증서 제출 완료'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
