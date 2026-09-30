import React, { useEffect, useState } from 'react';
import { LogIn, MessageSquarePlus, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { ClientInquiry } from '../../types';
import { createInquiry, lookupInquiry, loadMyInquiries, toClientInquiry, type InquiryPublic } from '../../services/inquiryService';
import { Badge, Button, Callout, Card, EmptyState, FormField, ListSkeleton, PageHeader, inputClass, textareaClass } from './ui';

interface InquiryViewProps {
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
  isLoggedIn: boolean;
  userAlias: string;
  onShowAuthModal: () => void;
  /** 비회원 문의 창 열기 (화면 아래 '1:1 문의' 버튼과 같은 창) */
  onOpenGuestInquiry?: () => void;
  inquiryTitle: string;
  setInquiryTitle: (v: string) => void;
  inquiryContent: string;
  setInquiryContent: (v: string) => void;
  onLogActivity: (targetId: string, targetName: string, role: string, action: string, details: string) => void;
}

type InquiryItem = Pick<InquiryPublic, 'id' | 'title' | 'content' | 'status' | 'createdAt' | 'replyContent' | 'repliedAt'>;

function InquiryCard({ inq }: { inq: InquiryItem }) {
  const replied = inq.status === 'replied';
  return (
    <Card as="article" padded={false} className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={replied ? 'success' : 'warning'}>{replied ? '답변 완료' : '답변 대기'}</Badge>
        <span className="text-sm text-slate-600">
          <span className="font-mono">{inq.id}</span> · {new Date(inq.createdAt).toLocaleDateString('ko-KR')}
        </span>
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900 break-keep">Q. {inq.title}</h3>
        <p className="mt-1.5 text-base leading-relaxed text-slate-700 whitespace-pre-wrap break-keep">{inq.content}</p>
      </div>
      {inq.replyContent ? (
        <div className="rounded-xl border border-brand/15 bg-brand-light p-4">
          <div className="flex items-center justify-between gap-2 text-sm font-bold text-brand">
            <span>A. 운영자 답변</span>
            {inq.repliedAt && <span className="font-normal text-slate-600">{new Date(inq.repliedAt).toLocaleDateString('ko-KR')}</span>}
          </div>
          <p className="mt-1.5 text-base leading-relaxed text-slate-800 whitespace-pre-wrap break-keep">{inq.replyContent}</p>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-center text-sm text-slate-600">아직 답변이 등록되지 않았어요.</p>
      )}
    </Card>
  );
}

/**
 * 1:1 문의 (사이트 이용 문의)
 * - 이전: 비회원에게 '화면 하단의 [1:1 문의] 버튼'을 찾으라고만 안내 → 이 화면에서 바로 비회원 문의 창을 연다
 * - 콘텐츠 페이지 공통 머리(PageHeader), 입력란은 FormField, 목록 불러오는 중·오류·빈 상태 표시
 */
export default function InquiryView({
  setInquiries, isLoggedIn, userAlias,
  onShowAuthModal, onOpenGuestInquiry, inquiryTitle, setInquiryTitle,
  inquiryContent, setInquiryContent, onLogActivity
}: InquiryViewProps) {
  const [myItems, setMyItems] = useState<InquiryPublic[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 비회원 조회
  const [lookupId, setLookupId] = useState('');
  const [lookupPw, setLookupPw] = useState('');
  const [lookupResult, setLookupResult] = useState<InquiryPublic | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const refreshMine = async () => {
    setLoadingMine(true);
    const r = await loadMyInquiries();
    setLoadingMine(false);
    if (r.ok === false) { setLoadError(r.error); return; }
    setLoadError(null);
    setMyItems(r.items);
  };

  useEffect(() => {
    if (isLoggedIn) refreshMine();
    else setMyItems([]);
  }, [isLoggedIn]);

  const handleCreateInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryTitle.trim() || !inquiryContent.trim()) {
      toast.error('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    const r = await createInquiry({ nickname: userAlias || '회원', title: inquiryTitle.trim(), content: inquiryContent.trim(), source: 'inquiry_page', category: 'other' });
    setSubmitting(false);
    if (r.ok === false) { toast.error(r.error); return; }
    setInquiryTitle('');
    setInquiryContent('');
    setMyItems(prev => [r.item, ...prev]);
    setInquiries(prev => [toClientInquiry(r.item, userAlias || '의뢰인'), ...prev]);
    onLogActivity(r.id, userAlias || '의뢰인', 'CLIENT', 'ADMIN_ACTION', `1:1 문의 등록: [${r.item.title}]`);
    toast.success('문의를 접수했어요. 운영팀이 확인한 뒤 답변드려요.');
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim() || !/^\d{4}$/.test(lookupPw)) {
      toast.error('문의번호와 비밀번호 4자리 숫자를 입력해 주세요.');
      return;
    }
    setLookingUp(true);
    const r = await lookupInquiry(lookupId.trim(), lookupPw);
    setLookingUp(false);
    if (r.ok === false) { setLookupResult(null); toast.error(r.error); return; }
    setLookupResult(r.item);
  };

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn text-left">
      <PageHeader
        title="1:1 문의"
        description="사이트 사용법, 계정, 기능에 대해 물어보세요. 문의 내용은 작성자 본인과 운영 관리자만 볼 수 있어요."
      />

      <Callout tone="info" className="mb-6">
        채무·개인회생·파산 같은 법률 질문은 <strong>상담 사례</strong>에서 비슷한 사례를 찾아보거나 <strong>변호사 상담 요청</strong>을 이용해 주세요.
      </Callout>

      {!isLoggedIn ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card as="section" className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">문의하기</h2>
            <p className="text-sm leading-relaxed text-slate-600 break-keep">
              로그인하면 문의 내역과 답변을 이곳에서 모아 볼 수 있어요. 로그인하지 않아도 문의할 수 있고, 받은 문의번호와 비밀번호로 답변을 확인해요.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={onShowAuthModal} leftIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}>
                로그인하고 문의하기
              </Button>
              {onOpenGuestInquiry && (
                <Button variant="secondary" onClick={onOpenGuestInquiry} leftIcon={<MessageSquarePlus className="h-4 w-4" aria-hidden="true" />}>
                  비회원으로 문의하기
                </Button>
              )}
            </div>
          </Card>

          <Card as="section">
            <form onSubmit={handleLookup} className="space-y-4" aria-labelledby="inq-lookup-title">
              <h2 id="inq-lookup-title" className="text-lg font-bold text-slate-900">비회원 문의 답변 확인</h2>
              <FormField label="문의번호" required>
                {(p) => <input {...p} value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="예: inq-20260928-1a2b3c4d" className={inputClass} autoComplete="off" />}
              </FormField>
              <FormField label="비밀번호 (숫자 4자리)" required hint="비밀번호를 5회 잘못 입력하면 조회가 잠겨요.">
                {(p) => (
                  <input
                    {...p}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={lookupPw}
                    onChange={e => setLookupPw(e.target.value.replace(/\D/g, ''))}
                    className={inputClass}
                    autoComplete="off"
                  />
                )}
              </FormField>
              <Button type="submit" fullWidth loading={lookingUp}>
                {lookingUp ? '확인하는 중' : '답변 확인하기'}
              </Button>
            </form>
            {lookupResult && <div className="mt-4"><InquiryCard inq={lookupResult} /></div>}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <Card as="section" className="lg:col-span-5">
            <form onSubmit={handleCreateInquiry} className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">새 문의</h2>
              <FormField label="제목" required>
                {(p) => <input {...p} type="text" maxLength={120} value={inquiryTitle} onChange={(e) => setInquiryTitle(e.target.value)} placeholder="무엇이 궁금하신가요?" className={inputClass} />}
              </FormField>
              <FormField label="내용" required hint={`${inquiryContent.length.toLocaleString()} / 4,000자`}>
                {(p) => <textarea {...p} rows={8} maxLength={4000} value={inquiryContent} onChange={(e) => setInquiryContent(e.target.value)} placeholder="문의 내용을 자세히 적어 주세요." className={textareaClass} />}
              </FormField>
              <Button type="submit" fullWidth loading={submitting}>
                {submitting ? '보내는 중' : '문의 보내기'}
              </Button>
            </form>
          </Card>

          <Card as="section" className="lg:col-span-7">
            <div className="flex items-center justify-between gap-2">
              <h2 id="inq-mine-title" className="text-lg font-bold text-slate-900">내 문의 내역</h2>
              <Button variant="ghost" onClick={refreshMine} disabled={loadingMine} leftIcon={<RotateCw className="h-4 w-4" aria-hidden="true" />}>
                새로고침
              </Button>
            </div>
            <div className="mt-4 space-y-4" aria-live="polite" aria-busy={loadingMine || undefined}>
              {loadingMine && <ListSkeleton rows={2} />}
              {!loadingMine && loadError && (
                <Callout tone="danger" title="문의 내역을 불러오지 못했어요" action={<Button variant="secondary" onClick={refreshMine}>다시 시도</Button>}>
                  {loadError}
                </Callout>
              )}
              {!loadingMine && !loadError && myItems.map(inq => <InquiryCard key={inq.id} inq={inq} />)}
              {!loadingMine && !loadError && myItems.length === 0 && (
                <EmptyState compact title="아직 보낸 문의가 없어요" description="왼쪽에서 궁금한 점을 보내 주세요." />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
