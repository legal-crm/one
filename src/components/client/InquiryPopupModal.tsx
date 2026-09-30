import React, { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, CheckCircle2, Copy, FileText, MessageSquarePlus, Paperclip, Scale, Send, X } from 'lucide-react';
import { createInquiry, toClientInquiry } from '../../services/inquiryService';
import { validateUploadFile } from '../../utils/fileSecurity';
import type { ClientInquiry, ClientInquiryCategory } from '../../types';
import TurnstileWidget from '../common/TurnstileWidget';
import { useDialog } from '../common/DialogProvider';
import { Button, Callout, FilterChips, FormField, Modal, inputClass, textareaClass } from './ui';

/**
 * 1:1 문의 창 (화면 아래 '1:1 문의' 버튼 · 1:1 문의 화면의 '비회원으로 문의하기')
 * - 키트 Modal(모바일 전체 화면, ESC·포커스 가두기), 입력란은 FormField(라벨 연결, 필드 아래 오류)
 * - 이전: 이모지 유형 버튼, 'Q&A에서 질문하기'(상담 사례는 더 이상 질문을 받지 않음), 보라 그라디언트 버튼,
 *   10px 글자·작은 삭제 버튼, 비회원 문의번호를 15초 토스트로만 알려 줌
 *   → 보낸 뒤 창 안에 문의번호·복사 버튼·확인 방법을 남긴다
 * - 작성 중에 닫으면 확인하고, 보내기 실패 사유는 창 안에 남긴다(토스트만 쓰지 않음)
 */

interface InquiryPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 호환용(사용하지 않음) */
  inquiries?: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
  isLoggedIn: boolean;
  userAlias: string;
  onNavigateToQnA: () => void;
  onNavigateToLawyers: () => void;
  /** 1:1 문의 화면(내 문의 내역·비회원 답변 확인)으로 이동 */
  onNavigateToInquiry?: () => void;
}

const CATEGORIES: { value: ClientInquiryCategory; label: string }[] = [
  { value: 'site_usage', label: '사이트 이용' },
  { value: 'account', label: '회원가입·로그인' },
  { value: 'diagnosis', label: '상황 체크 결과' },
  { value: 'lawyer_matching', label: '변호사 상담 요청' },
  { value: 'other', label: '기타' },
];

const MAX_FILES = 2;
// 서버 요청 본문 한도 때문에 파일당 1MB, 이미지·PDF만 (서버도 같은 형식만 받는다)
const MAX_FILE_BYTES = 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/;
const TITLE_MAX = 120;
const CONTENT_MAX = 4000;

type FieldKey = 'nickname' | 'password' | 'title' | 'content';
type Attachment = { file: File; dataUrl: string };
type Sent = { id: string; guest: boolean };

const SECURITY_ERROR = /봇 방지|보안 (인증|확인)|비정상적인 접속/;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

export default function InquiryPopupModal({
  isOpen,
  onClose,
  setInquiries,
  isLoggedIn,
  userAlias,
  onNavigateToQnA,
  onNavigateToLawyers,
  onNavigateToInquiry,
}: InquiryPopupModalProps) {
  const dialog = useDialog();
  const formId = useId();
  const fileHintId = `${formId}-files-hint`;

  const [category, setCategory] = useState<ClientInquiryCategory>('site_usage');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [contact, setContact] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [sent, setSent] = useState<Sent | null>(null);

  const nicknameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLButtonElement>(null);
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);
  const submitErrorRef = useRef<HTMLDivElement>(null);
  const [errorSeq, setErrorSeq] = useState(0);

  /** 보내기 실패 사유: 창 맨 아래에 남기고, 화면 밖이면 보이는 곳으로 스크롤한다(모바일은 폼이 길다) */
  const showSubmitError = (message: string) => {
    setSubmitError(message);
    setErrorSeq((n) => n + 1);
  };
  useEffect(() => {
    if (errorSeq > 0) submitErrorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [errorSeq]);

  // 보낸 뒤: 결과 제목으로 포커스를 옮겨 화면 읽기 프로그램이 바로 읽게 한다
  useEffect(() => {
    if (sent) sentHeadingRef.current?.focus();
  }, [sent]);

  const isDirty = !sent && Boolean(title.trim() || content.trim() || attachments.length > 0);

  /** 닫기 전 확인: 보내는 중에는 닫지 않고, 쓰던 내용이 있으면 묻는다 */
  const confirmLeave = async () => {
    if (isSubmitting) return false;
    if (!isDirty) return true;
    return dialog.confirm({
      title: '작성 중인 문의를 닫을까요?',
      message: '닫으면 입력한 내용이 사라져요.',
      confirmText: '닫기',
      cancelText: '계속 작성',
      variant: 'warning',
    });
  };

  const leaveTo = async (go: () => void) => {
    if (!(await confirmLeave())) return;
    onClose();
    go();
  };

  const clearError = (key: FieldKey) => setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (picked.length === 0) return;
    const room = Math.max(0, MAX_FILES - attachments.length);
    if (picked.length > room) toast.error(`파일은 ${MAX_FILES}개까지 첨부할 수 있어요.`);
    const accepted: Attachment[] = [];
    for (const file of picked.slice(0, room)) {
      const v = validateUploadFile(file, MAX_FILE_BYTES);
      if (!v.isValid) {
        toast.error(`${file.name}: ${v.error}`);
        continue;
      }
      if (!ALLOWED_TYPES.test(file.type)) {
        toast.error(`${file.name}: 이미지(PNG·JPG·GIF·WEBP) 또는 PDF만 첨부할 수 있어요.`);
        continue;
      }
      const dataUrl = await readAsDataUrl(file);
      if (!dataUrl) {
        toast.error(`${file.name}: 파일을 읽지 못했어요.`);
        continue;
      }
      accepted.push({ file, dataUrl });
    }
    if (accepted.length > 0) setAttachments((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    // 지운 버튼이 사라지므로 '파일 추가'로 포커스를 옮긴다
    window.requestAnimationFrame(() => addFileRef.current?.focus());
  };

  const validate = () => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!isLoggedIn) {
      if (!nickname.trim()) next.nickname = '닉네임을 입력해 주세요.';
      if (!/^\d{4}$/.test(password)) next.password = '숫자 4자리를 입력해 주세요.';
    }
    if (!title.trim()) next.title = '제목을 입력해 주세요.';
    if (!content.trim()) next.content = '문의 내용을 입력해 주세요.';
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const next = validate();
    setErrors(next);
    const refs: Record<FieldKey, React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>> = {
      nickname: nicknameRef,
      password: passwordRef,
      title: titleRef,
      content: contentRef,
    };
    const first = (['nickname', 'password', 'title', 'content'] as FieldKey[]).find((k) => next[k]);
    if (first) {
      refs[first].current?.focus();
      return;
    }
    if (!isLoggedIn && !turnstileToken) {
      showSubmitError('보안 확인이 아직 끝나지 않았어요. 확인 상자가 보이면 확인을 마치고, 보이지 않으면 잠시 뒤 다시 보내 주세요.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    // 서버에 저장 (비회원은 Turnstile 서버 검증, 비밀번호는 서버에서 해시 — 브라우저에 저장하지 않음)
    const result = await createInquiry({
      turnstileToken: isLoggedIn ? undefined : turnstileToken,
      category,
      nickname: isLoggedIn ? userAlias || '회원' : nickname.trim(),
      password: isLoggedIn ? undefined : password,
      contact: contact.trim() || undefined,
      title: title.trim(),
      content: content.trim(),
      source: 'popup_modal',
      attachments: attachments.map((a) => ({ fileName: a.file.name, fileSize: a.file.size, fileType: a.file.type, dataUrl: a.dataUrl })),
    });
    setIsSubmitting(false);

    if (result.ok === false) {
      showSubmitError(result.error);
      // Turnstile 토큰은 한 번만 쓸 수 있어 새로 받는다
      if (!isLoggedIn) {
        setTurnstileToken('');
        setTurnstileKey((k) => k + 1);
      }
      return;
    }
    setInquiries((prev) => [toClientInquiry(result.item, isLoggedIn ? userAlias || '의뢰인' : nickname.trim()), ...prev]);
    setSent({ id: result.id, guest: !isLoggedIn });
  };

  const copyInquiryId = async () => {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.id);
      toast.success('문의번호를 복사했어요.');
    } catch {
      toast.error('복사하지 못했어요. 문의번호를 직접 적어 두세요.');
    }
  };

  const footer = sent ? (
    <>
      <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
        닫기
      </Button>
      {onNavigateToInquiry && (
        <Button
          className="flex-1 sm:flex-none"
          onClick={() => {
            onClose();
            onNavigateToInquiry();
          }}
        >
          {sent.guest ? '답변 확인 화면으로' : '내 문의 내역 보기'}
        </Button>
      )}
    </>
  ) : (
    <Button
      type="submit"
      form={formId}
      size="lg"
      fullWidth
      loading={isSubmitting}
      leftIcon={<Send className="h-4 w-4" aria-hidden="true" />}
    >
      {isSubmitting ? '보내는 중' : '문의 보내기'}
    </Button>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      onBeforeClose={confirmLeave}
      title="1:1 문의"
      description={sent ? undefined : '사이트 이용, 계정, 기능에 대해 물어보세요. 문의 내용은 작성자 본인과 운영 관리자만 볼 수 있어요.'}
      icon={<MessageSquarePlus className="h-5 w-5" />}
      size="md"
      mobile="fullscreen"
      footer={footer}
    >
      {sent ? (
        <div className="py-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700" aria-hidden="true">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 ref={sentHeadingRef} tabIndex={-1} className="mt-4 text-lg font-bold text-slate-900 focus:outline-none">
            문의를 보냈어요
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 break-keep">운영팀이 확인한 뒤 답변드려요.</p>
          {sent.guest ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-sm font-bold text-slate-700">문의번호</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-base font-bold text-slate-900">{sent.id}</code>
                <Button variant="secondary" onClick={copyInquiryId} aria-label="문의번호 복사" leftIcon={<Copy className="h-4 w-4" aria-hidden="true" />}>
                  복사
                </Button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700 break-keep">
                답변은 1:1 문의 화면의 ‘비회원 문의 답변 확인’에서 이 문의번호와 비밀번호로 확인해요. 창을 닫으면 문의번호를 다시 볼 수 없으니 꼭
                적어 두세요.
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-700 break-keep">답변은 1:1 문의 화면의 내 문의 내역에서 확인할 수 있어요.</p>
          )}
        </div>
      ) : (
        <>
          <Callout
            tone="info"
            title="채무·회생·파산 질문이라면"
            action={
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void leaveTo(onNavigateToLawyers)} leftIcon={<Scale className="h-4 w-4" aria-hidden="true" />}>
                  변호사 찾기
                </Button>
                <Button variant="secondary" onClick={() => void leaveTo(onNavigateToQnA)} leftIcon={<BookOpen className="h-4 w-4" aria-hidden="true" />}>
                  상담 사례 보기
                </Button>
              </div>
            }
          >
            이 창은 사이트 이용 문의를 받아요. 법률 질문은 비슷한 상담 사례를 찾아보거나, 변호사를 골라 상담을 요청해 주세요.
          </Callout>

          <form id={formId} onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
            <div>
              <p className="text-sm font-bold text-slate-800" aria-hidden="true">
                문의 유형
              </p>
              <FilterChips<ClientInquiryCategory>
                options={CATEGORIES}
                value={category}
                onChange={(v) => setCategory(v)}
                label="문의 유형"
                wrap
                className="mt-2"
              />
            </div>

            {isLoggedIn ? (
              <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 break-keep">
                <strong className="font-bold text-slate-900">{userAlias || '회원'}</strong> 이름으로 보내요. 답변은 1:1 문의 화면의 내 문의 내역에서 확인해요.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="닉네임" required error={errors.nickname}>
                  {(p) => (
                    <input
                      {...p}
                      ref={nicknameRef}
                      type="text"
                      maxLength={30}
                      autoComplete="nickname"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        clearError('nickname');
                      }}
                      className={inputClass}
                    />
                  )}
                </FormField>
                <FormField label="확인용 비밀번호" required hint="숫자 4자리. 답변을 확인할 때 문의번호와 함께 입력해요." error={errors.password}>
                  {(p) => (
                    <input
                      {...p}
                      ref={passwordRef}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      autoComplete="off"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value.replace(/\D/g, '').slice(0, 4));
                        clearError('password');
                      }}
                      className={inputClass}
                    />
                  )}
                </FormField>
              </div>
            )}

            <FormField label="연락처" optional hint={isLoggedIn ? undefined : '적지 않아도 문의번호와 비밀번호로 답변을 확인할 수 있어요.'}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  maxLength={100}
                  autoComplete="email"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="이메일 또는 휴대폰 번호"
                  className={inputClass}
                />
              )}
            </FormField>

            <FormField label="제목" required error={errors.title}>
              {(p) => (
                <input
                  {...p}
                  ref={titleRef}
                  type="text"
                  maxLength={TITLE_MAX}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    clearError('title');
                  }}
                  placeholder="무엇이 궁금하신가요?"
                  className={inputClass}
                />
              )}
            </FormField>

            <FormField label="내용" required hint={`${content.length.toLocaleString('ko-KR')} / 4,000자`} error={errors.content}>
              {(p) => (
                <textarea
                  {...p}
                  ref={contentRef}
                  rows={6}
                  maxLength={CONTENT_MAX}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    clearError('content');
                  }}
                  placeholder="어느 화면에서 어떤 일이 있었는지 적어 주시면 확인하는 데 도움이 돼요."
                  className={textareaClass}
                />
              )}
            </FormField>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">
                  첨부 파일 <span className="text-xs font-medium text-slate-500">(선택)</span>
                </p>
                <Button
                  ref={addFileRef}
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= MAX_FILES}
                  aria-describedby={fileHintId}
                  leftIcon={<Paperclip className="h-4 w-4" aria-hidden="true" />}
                >
                  파일 추가
                </Button>
              </div>
              <p id={fileHintId} className="mt-1 text-xs leading-relaxed text-slate-600">
                {attachments.length >= MAX_FILES
                  ? '파일 2개를 모두 첨부했어요. 바꾸려면 하나를 빼 주세요.'
                  : '이미지(PNG·JPG·GIF·WEBP) 또는 PDF, 파일당 1MB, 최대 2개'}
              </p>
              {/* '파일 추가' 버튼으로 여는 입력(키보드는 버튼으로 접근) */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
                onChange={handleFiles}
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              {attachments.length > 0 && (
                <ul className="mt-3 space-y-2" aria-label="첨부한 파일">
                  {attachments.map((a, i) => (
                    <li key={`${a.file.name}-${a.file.size}-${i}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pl-3">
                      {a.file.type.startsWith('image/') ? (
                        <img src={a.dataUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden="true">
                          <FileText className="h-5 w-5" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-800">{a.file.name}</span>
                        <span className="block text-xs text-slate-600">{formatSize(a.file.size)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        aria-label={`${a.file.name} 첨부 빼기`}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>

          {/* 비회원만 봇 방지 확인(서버가 로그인 세션이 없을 때만 검증). 보통은 보이지 않고, 확인이 필요할 때만 상자가 나타난다 */}
          {!isLoggedIn && <TurnstileWidget key={turnstileKey} onSuccess={setTurnstileToken} action="inquiry" className="mt-4" />}

          {submitError && (
            <div ref={submitErrorRef} role="alert" className="mt-4 scroll-mb-4">
              <Callout tone="danger" title="문의를 보내지 못했어요">
                {submitError}
                {!isLoggedIn && SECURITY_ERROR.test(submitError) && (
                  <span className="mt-1 block">계속 안 되면 광고 차단 기능을 끄고 다시 시도하거나, 로그인한 뒤 보내 주세요.</span>
                )}
              </Callout>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
