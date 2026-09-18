import React, { useState } from 'react';
import { 
  X, Send, Copy, Check, ShieldCheck, Smartphone, Scale, 
  Briefcase, FileText, Sparkles, AlertCircle, CheckCircle2, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  createDocSharePackage, 
  generateShareMessage, 
  RecipientRoleType, 
  SharedDocPackageItem 
} from '../../services/lawyerDocShareService';

interface LawyerDocShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  docPackage: SharedDocPackageItem;
}

export default function LawyerDocShareModal({
  isOpen,
  onClose,
  clientId,
  clientName = '김가람',
  clientPhone = '010-9876-5432',
  docPackage
}: LawyerDocShareModalProps) {
  const [recipientType, setRecipientType] = useState<RecipientRoleType>('LAWYER');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientFirmName, setRecipientFirmName] = useState('');
  const [memo, setMemo] = useState('변호사님(사무장님), 마이김변에서 말로 작성한 회생 진술서와 수지표 패키지 공유드립니다. 검토 부탁드립니다.');

  // 체크박스 선택 서류
  const [includeStatement, setIncludeStatement] = useState(true);
  const [includeIncomeExpense, setIncludeIncomeExpense] = useState(true);
  const [includeProperty, setIncludeProperty] = useState(true);
  const [includeDebtSummary, setIncludeDebtSummary] = useState(true);

  // 생성된 공유 결과 상태
  const [step, setStep] = useState<'input' | 'done'>('input');
  const [shareUrl, setShareUrl] = useState('');
  const [smsLink, setSmsLink] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 전화번호 자동 하이픈
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = raw;
    if (raw.length > 3 && raw.length <= 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    } else if (raw.length > 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    }
    setRecipientPhone(formatted);
  };

  const handleGenerateShare = () => {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    if (!recipientName.trim()) {
      toast.error('받으실 변호사님 또는 사무장님의 성함을 입력해 주세요.');
      return;
    }
    if (cleanPhone.length < 10) {
      toast.error('유효한 휴대폰 번호(010 포함 10~11자리)를 입력해 주세요.');
      return;
    }

    const filteredDocs: SharedDocPackageItem = {
      hasStatement: includeStatement && !!docPackage.hasStatement,
      statementData: includeStatement ? docPackage.statementData : null,
      hasIncomeExpense: includeIncomeExpense && !!docPackage.hasIncomeExpense,
      incomeExpenseData: includeIncomeExpense ? docPackage.incomeExpenseData : null,
      hasProperty: includeProperty && !!docPackage.hasProperty,
      propertySummary: includeProperty ? docPackage.propertySummary : null,
      hasDebtSummary: includeDebtSummary && !!docPackage.hasDebtSummary,
      debtSummary: includeDebtSummary ? docPackage.debtSummary : null,
    };

    const pkg = createDocSharePackage({
      clientId,
      clientName,
      clientPhone,
      recipientType,
      recipientName: recipientName.trim(),
      recipientPhone: cleanPhone,
      recipientFirmName: recipientFirmName.trim() || undefined,
      memo: memo.trim(),
      docs: filteredDocs
    });

    const origin = window.location.origin + window.location.pathname;
    const url = `${origin}?docShare=${pkg.token}`;
    const msg = generateShareMessage(pkg, url);

    setShareUrl(url);
    setSmsLink(msg.smsUrl);
    setStep('done');
    toast.success('변호사·사무장 전용 보안 열람 링크가 생성되었습니다!');
  };

  const handleCopyLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('보안 열람 링크가 클립보드에 복사되었습니다.');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* 상단 헤더 */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-brand-sm">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  변호사·사무장 서류 패키지 전달
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-slate-950">
                  휴대폰 번호 즉시 전송
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                마이김변에서 준비한 진술서·수지표를 담당자 휴대폰 번호로 바로 전달합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 바디 컨텐츠 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {step === 'input' ? (
            <>
              {/* 안심 배너 */}
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 flex items-start gap-3 text-left">
                <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-indigo-950 dark:text-indigo-200">
                    변호사님 또는 사무장님이 회원이 아니어도 즉시 열람 가능
                  </div>
                  <p className="text-indigo-800/80 dark:text-indigo-300 leading-relaxed text-[11px]">
                    전달받은 휴대폰 번호로 5초 간이 가입 후 대법원 표준 규격으로 작성된 서류를 바로 확인하고 A4 인쇄/다운로드하실 수 있습니다.
                  </p>
                </div>
              </div>

              {/* 1. 수신자 직책 선택 */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>받으실 분 직책</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRecipientType('LAWYER')}
                    className={`p-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      recipientType === 'LAWYER'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Scale className="w-4 h-4" />
                    <span>⚖️ 담당 변호사님</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecipientType('MANAGER')}
                    className={`p-3 rounded-2xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                      recipientType === 'MANAGER'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>💼 로펌 사무장·실무관님</span>
                  </button>
                </div>
              </div>

              {/* 2. 성명 및 사무소명 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    성함 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={recipientType === 'LAWYER' ? '예: 김민준 변호사' : '예: 박수철 사무장'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    소속 법률사무소 <span className="text-slate-400 font-normal">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={recipientFirmName}
                    onChange={(e) => setRecipientFirmName(e.target.value)}
                    placeholder="예: 법무법인 한빛"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 3. 휴대폰 번호 */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>휴대폰 번호 <span className="text-rose-500">*</span></span>
                  <span className="text-[11px] text-slate-400 font-normal">문자/알림톡 발송용</span>
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    maxLength={13}
                    value={recipientPhone}
                    onChange={handlePhoneChange}
                    placeholder="010-1234-5678"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 4. 전달할 서류 선택 */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  전달할 서류 목록 선택
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeStatement}
                      onChange={(e) => setIncludeStatement(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">🎙️ 법원 진술서(D5104)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeIncomeExpense}
                      onChange={(e) => setIncludeIncomeExpense(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">📊 12개월 수지표(D5103)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeProperty}
                      onChange={(e) => setIncludeProperty(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">📋 재산상황표(D5102)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDebtSummary}
                      onChange={(e) => setIncludeDebtSummary(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">⚡ 채무진단 및 변제안</span>
                  </label>
                </div>
              </div>

              {/* 5. 간단한 전달 메모 */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  전달 메시지 (문자에 함께 포함)
                </label>
                <textarea
                  rows={2}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateShare}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4" />
                <span>보안 열람 링크 생성 및 전달 준비</span>
              </button>
            </>
          ) : (
            /* 전송 완료 및 링크 공유 화면 */
            <div className="space-y-5 text-center py-2 animate-fadeIn">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  {recipientFirmName ? `[${recipientFirmName}] ` : ''}{recipientName} {recipientType === 'LAWYER' ? '변호사님' : '사무장님'}께
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  서류 패키지가 안전하게 암호화 생성되었습니다. 아래 버튼으로 전송해 주세요.
                </p>
              </div>

              {/* 2대 전송 옵션 버튼 */}
              <div className="space-y-2.5">
                <a
                  href={smsLink}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>💬 문자(SMS) 앱 열고 바로 전송하기</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-black text-white font-black text-xs sm:text-sm rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? '열람 링크 복사완료!' : '📋 카카오톡 전송용 링크 복사'}</span>
                </button>
              </div>

              {/* 보안 링크 박스 */}
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-left space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  생성된 7일간 유효한 보안 링크
                </span>
                <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 break-all select-all">
                  {shareUrl}
                </p>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed text-left p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800">
                🔒 <strong>개인정보보호:</strong> 가족의 주민번호 등 민감 정보는 자동 마스킹 처리되어 법원 제출 규격으로만 전달됩니다.
              </div>

              <button
                type="button"
                onClick={() => setStep('input')}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline transition cursor-pointer"
              >
                다른 번호로 다시 보내기
              </button>
            </div>
          )}
        </div>

        {/* 하단 푸터 */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-center">
          <span className="text-[11px] text-slate-500 font-medium">
            마이김변 모바일 서류 허브 • 대법원 전자소송 표준 서식 연동
          </span>
        </div>

      </div>
    </div>
  );
}
