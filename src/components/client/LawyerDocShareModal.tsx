import React, { useState } from 'react';
import { Send, Copy, Check, Smartphone, Scale, Briefcase, CheckCircle2, Lock, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createDocSharePackage,
  generateShareMessage,
  RecipientRoleType,
  SharedDocPackageItem
} from '../../services/lawyerDocShareService';
import { Badge, Button, Callout, FormField, Modal, buttonClassName, inputClass, textareaClass } from './ui';
import { cn } from '../../utils/cn';

interface LawyerDocShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  docPackage: SharedDocPackageItem;
}

/**
 * 변호사·사무소 직원에게 서류 초안 열람 링크 보내기 — 서류 허브 위에 뜨는 창(z-70)
 */
export default function LawyerDocShareModal({
  isOpen,
  onClose,
  clientId,
  clientName = '신청인',
  clientPhone = '',
  docPackage
}: LawyerDocShareModalProps) {
  const [recipientType, setRecipientType] = useState<RecipientRoleType>('LAWYER');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientFirmName, setRecipientFirmName] = useState('');
  const [memo, setMemo] = useState('마이김변에서 작성한 회생 진술서와 수지표 초안을 보내 드립니다. 검토 부탁드립니다.');

  // 보낼 서류(작성하지 않은 서류는 고를 수 없음)
  const [includeStatement, setIncludeStatement] = useState(true);
  const [includeIncomeExpense, setIncludeIncomeExpense] = useState(true);
  const [includeProperty, setIncludeProperty] = useState(true);
  const [includeDebtSummary, setIncludeDebtSummary] = useState(true);

  // 생성된 공유 결과 상태
  const [step, setStep] = useState<'input' | 'done'>('input');
  const [shareUrl, setShareUrl] = useState('');
  const [smsLink, setSmsLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const docOptions = [
    { key: 'statement', label: '진술서', available: !!docPackage.hasStatement, checked: includeStatement, set: setIncludeStatement },
    { key: 'income', label: '수입·지출 내역서(수지표)', available: !!docPackage.hasIncomeExpense, checked: includeIncomeExpense, set: setIncludeIncomeExpense },
    { key: 'property', label: '재산 기초자료', available: !!docPackage.hasProperty, checked: includeProperty, set: setIncludeProperty },
    { key: 'debt', label: '채무 요약과 변제 예상', available: !!docPackage.hasDebtSummary, checked: includeDebtSummary, set: setIncludeDebtSummary },
  ];
  const selectedDocCount = docOptions.filter(d => d.available && d.checked).length;

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

  const handleGenerateShare = async () => {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    if (!recipientName.trim()) {
      toast.error('받으실 변호사님 또는 사무소 직원분의 성함을 입력해 주세요.');
      return;
    }
    if (cleanPhone.length < 10) {
      toast.error('유효한 휴대폰 번호(010 포함 10~11자리)를 입력해 주세요.');
      return;
    }
    if (selectedDocCount === 0) {
      toast.error('보낼 서류가 없어요. 서류를 먼저 작성하거나 보낼 서류를 골라 주세요.');
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

    setIsCreating(true);
    const created = await createDocSharePackage({
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
    setIsCreating(false);
    if (created.ok === false) {
      toast.error(created.error);
      return;
    }
    const pkg = created.pkg;

    const url = `${window.location.origin}/?docShare=${encodeURIComponent(pkg.token)}`;
    const msg = generateShareMessage(pkg, url);

    setShareUrl(url);
    setSmsLink(msg.smsUrl);
    setStep('done');
    toast.success('열람 링크를 만들었습니다. 문자나 메신저로 보내 주세요.');
  };

  const handleCopyLink = () => {
    if (!navigator?.clipboard) {
      toast.error('이 브라우저에서는 자동 복사가 되지 않아요. 아래 링크를 길게 눌러 복사해 주세요.');
      return;
    }
    navigator.clipboard
      .writeText(shareUrl)
      .then(() => {
        setCopied(true);
        toast.success('열람 링크를 복사했습니다.');
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => toast.error('복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요.'));
  };

  const recipientLabel = recipientType === 'LAWYER' ? '변호사님' : '사무소 직원분';

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      mobile="fullscreen"
      zIndexClassName="z-[70]"
      icon={<Send className="w-5 h-5" />}
      title="담당자에게 서류 보내기"
      description="받는 분이 회원이 아니어도 휴대폰 번호를 확인하면 서류 초안을 열람할 수 있어요."
      closeLabel="서류 보내기 닫기"
      footerClassName="justify-between"
      footer={
        step === 'input' ? (
          <>
            <Button variant="ghost" onClick={onClose}>닫기</Button>
            <Button onClick={handleGenerateShare} loading={isCreating} leftIcon={<Link2 className="w-4 h-4" aria-hidden="true" />}>
              열람 링크 만들기
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep('input')}>다른 번호로 보내기</Button>
            <Button variant="secondary" onClick={onClose}>닫기</Button>
          </>
        )
      }
    >
      {step === 'input' ? (
        <div className="space-y-5">
          {/* 받는 분 */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-800">받으실 분</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'LAWYER', label: '담당 변호사', icon: <Scale className="w-4 h-4" aria-hidden="true" /> },
                { id: 'MANAGER', label: '사무소 직원', icon: <Briefcase className="w-4 h-4" aria-hidden="true" /> },
              ] as { id: RecipientRoleType; label: string; icon: React.ReactNode }[]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={recipientType === opt.id}
                  onClick={() => setRecipientType(opt.id)}
                  className={cn(
                    'min-h-12 px-3 rounded-2xl border text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors',
                    recipientType === opt.id ? 'bg-brand text-white border-brand' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="성함" required>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={recipientType === 'LAWYER' ? '예: 김민준 변호사' : '예: 박OO 직원'}
                  autoComplete="off"
                  className={inputClass}
                />
              )}
            </FormField>
            <FormField label="소속 법률사무소" optional>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  value={recipientFirmName}
                  onChange={(e) => setRecipientFirmName(e.target.value)}
                  placeholder="예: 법무법인 한빛"
                  autoComplete="off"
                  className={inputClass}
                />
              )}
            </FormField>
          </div>

          <FormField label="휴대폰 번호" required hint="링크를 받은 분이 열람할 때 이 번호를 확인합니다.">
            {(p) => (
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  {...p}
                  type="tel"
                  inputMode="numeric"
                  maxLength={13}
                  value={recipientPhone}
                  onChange={handlePhoneChange}
                  placeholder="010-1234-5678"
                  autoComplete="off"
                  className={cn(inputClass, 'pl-10 tabular-nums')}
                />
              </div>
            )}
          </FormField>

          {/* 보낼 서류 */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-800">보낼 서류</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {docOptions.map(d => (
                <label
                  key={d.key}
                  className={cn(
                    'flex items-center gap-3 min-h-11 px-3 py-2 rounded-xl border',
                    d.available ? 'bg-white border-slate-200 cursor-pointer' : 'bg-slate-50 border-slate-200 cursor-not-allowed'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={d.available && d.checked}
                    disabled={!d.available}
                    onChange={(e) => d.set(e.target.checked)}
                    className="w-5 h-5 shrink-0 accent-brand"
                  />
                  <span className={cn('flex-1 text-sm font-medium', d.available ? 'text-slate-800' : 'text-slate-500')}>{d.label}</span>
                  {!d.available && <Badge tone="neutral">작성 전</Badge>}
                </label>
              ))}
            </div>
          </fieldset>

          <FormField label="함께 보낼 메시지" hint="문자에 함께 들어갑니다.">
            {(p) => (
              <textarea
                {...p}
                rows={2}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className={cn(textareaClass, 'min-h-20 resize-none')}
              />
            )}
          </FormField>
        </div>
      ) : (
        /* 링크 만든 뒤: 보내기 */
        <div className="space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto" aria-hidden="true">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 break-keep">
              {recipientFirmName ? `${recipientFirmName} ` : ''}{recipientName} {recipientLabel}께 보낼 링크를 만들었어요
            </h3>
            <p className="text-sm text-slate-600 break-keep">링크를 받은 분은 이 휴대폰 번호를 입력해야 열람할 수 있습니다.</p>
          </div>

          <div className="space-y-2.5">
            <a href={smsLink} className={buttonClassName('primary', 'lg', 'w-full')}>
              <Send className="w-4 h-4" aria-hidden="true" />
              문자 앱에서 보내기
            </a>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              onClick={handleCopyLink}
              leftIcon={copied ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
            >
              {copied ? '링크를 복사했어요' : '카카오톡 등에 붙여 넣을 링크 복사'}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
            <p className="text-xs font-bold text-slate-600">7일 동안 열람할 수 있는 링크</p>
            <p className="text-sm font-mono text-brand break-all select-all">{shareUrl}</p>
          </div>

          <Callout tone="warning" icon={<Lock className="w-4 h-4 text-amber-700" aria-hidden="true" />} title="개인정보 안내">
            고른 서류의 내용이 그대로 공유됩니다. 링크와 휴대폰 번호를 아는 사람은 7일 동안 열람할 수 있으니 받을 분의 번호를 정확히 입력해 주세요.
          </Callout>
        </div>
      )}
    </Modal>
  );
}
