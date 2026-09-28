import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ClientInquiry } from '../../types';
import { createInquiry, lookupInquiry, loadMyInquiries, toClientInquiry, type InquiryPublic } from '../../services/inquiryService';

interface InquiryViewProps {
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
  isLoggedIn: boolean;
  userAlias: string;
  onShowAuthModal: () => void;
  inquiryTitle: string;
  setInquiryTitle: (v: string) => void;
  inquiryContent: string;
  setInquiryContent: (v: string) => void;
  onLogActivity: (targetId: string, targetName: string, role: string, action: string, details: string) => void;
}

function InquiryCard({ inq }: { inq: Pick<InquiryPublic, 'id' | 'title' | 'content' | 'status' | 'createdAt' | 'replyContent' | 'repliedAt'> }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
      <div className="flex justify-between items-center gap-2">
        <span className={`text-xs px-2.5 py-0.5 rounded-md border font-bold ${inq.status === 'replied' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'}`}>
          {inq.status === 'replied' ? '답변 완료' : '답변 대기'}
        </span>
        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{inq.id} · {new Date(inq.createdAt).toLocaleDateString('ko-KR')}</span>
      </div>
      <div className="space-y-1.5">
        <h4 className="font-bold text-base text-slate-900 dark:text-slate-200">Q. {inq.title}</h4>
        <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{inq.content}</p>
      </div>
      {inq.replyContent ? (
        <div className="bg-indigo-500/5 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-500/10 space-y-1.5 text-sm sm:text-base">
          <div className="flex justify-between items-center text-xs text-indigo-700 dark:text-indigo-300 font-bold mb-1">
            <span>A. 운영자 답변</span>
            {inq.repliedAt && <span className="font-mono text-slate-600 dark:text-slate-400 font-normal">{new Date(inq.repliedAt).toLocaleDateString('ko-KR')}</span>}
          </div>
          <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">{inq.replyContent}</p>
        </div>
      ) : (
        <div className="text-center py-2.5 text-xs text-slate-600 dark:text-slate-400 font-semibold bg-slate-100/60 dark:bg-slate-900/40 rounded-xl">
          아직 답변이 등록되지 않았습니다.
        </div>
      )}
    </div>
  );
}

export default function InquiryView({
  setInquiries, isLoggedIn, userAlias,
  onShowAuthModal, inquiryTitle, setInquiryTitle,
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
    toast.success('문의가 접수되었습니다. 관리자가 확인 후 답변드립니다.');
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

  const inputCls = 'w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-base text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn text-left pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="space-y-3 relative z-10">
          <span className="text-xs sm:text-sm bg-brand/20 text-brand-light px-3.5 py-1 rounded-full font-bold">사이트 이용 관련 1:1 문의</span>
          <h2 className="text-2xl md:text-3xl font-extrabold">1:1 고객 문의</h2>
          <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed">사이트 사용법, 계정, 기능 활용 등에 대해 문의하세요. 문의 내용은 작성자 본인과 운영 관리자만 볼 수 있습니다.</p>
          <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-amber-200">
            💡 채무·개인회생·파산 등 법률 관련 질문은 <strong>고민상담 Q&A</strong> 게시판이나 <strong>변호사 상담</strong>을 이용해 주세요.
          </div>
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
            <div className="text-4xl" aria-hidden="true">🔒</div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">로그인하고 문의하기</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">로그인하면 문의 내역과 답변을 이곳에서 모아 볼 수 있습니다. 비회원은 화면 하단의 [1:1 문의] 버튼으로 문의할 수 있습니다.</p>
            <button type="button" onClick={onShowAuthModal} className="bg-brand hover:bg-brand-hover text-white font-bold px-7 min-h-[44px] rounded-2xl text-base cursor-pointer">로그인</button>
          </div>

          <form onSubmit={handleLookup} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4" aria-labelledby="inq-lookup-title">
            <h3 id="inq-lookup-title" className="font-bold text-base text-slate-900 dark:text-white">비회원 문의 답변 확인</h3>
            <div className="space-y-1.5">
              <label htmlFor="inq-lookup-id" className="text-sm font-bold text-slate-700 dark:text-slate-300 block">문의번호</label>
              <input id="inq-lookup-id" value={lookupId} onChange={e => setLookupId(e.target.value)} placeholder="예: inq-20260928-1a2b3c4d" className={inputCls} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inq-lookup-pw" className="text-sm font-bold text-slate-700 dark:text-slate-300 block">비밀번호 (숫자 4자리)</label>
              <input id="inq-lookup-pw" type="password" inputMode="numeric" maxLength={4} value={lookupPw} onChange={e => setLookupPw(e.target.value.replace(/\D/g, ''))} className={inputCls} autoComplete="off" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">비밀번호를 5회 잘못 입력하면 조회가 잠깁니다.</p>
            <button type="submit" disabled={lookingUp} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold min-h-[44px] rounded-2xl text-base cursor-pointer disabled:opacity-50">
              {lookingUp ? '조회 중...' : '답변 확인하기'}
            </button>
            {lookupResult && <InquiryCard inq={lookupResult} />}
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleCreateInquiry} className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">새 문의 등록</h3>
            <div className="space-y-1.5">
              <label htmlFor="inq-title" className="text-sm text-slate-700 dark:text-slate-300 font-bold block">문의 제목</label>
              <input id="inq-title" type="text" maxLength={120} value={inquiryTitle} onChange={(e) => setInquiryTitle(e.target.value)} placeholder="문의 제목을 입력하세요" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="inq-content" className="text-sm text-slate-700 dark:text-slate-300 font-bold block">문의 내용</label>
              <textarea id="inq-content" rows={8} maxLength={4000} value={inquiryContent} onChange={(e) => setInquiryContent(e.target.value)} placeholder="문의 내용을 자세히 적어 주세요." className={`${inputCls} min-h-[180px] leading-relaxed`} />
            </div>
            <button type="submit" disabled={submitting} className="w-full bg-brand hover:bg-brand-hover text-white font-bold min-h-[44px] rounded-2xl text-base cursor-pointer disabled:opacity-50">
              {submitting ? '제출 중...' : '문의 제출하기'}
            </button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">나의 문의 내역</h3>
              <button type="button" onClick={refreshMine} className="text-sm font-bold text-brand min-h-[44px] px-2 cursor-pointer">새로고침</button>
            </div>
            <div className="space-y-4" aria-live="polite">
              {loadingMine && <p className="text-sm text-slate-600 dark:text-slate-300">불러오는 중...</p>}
              {loadError && <p className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p>}
              {!loadingMine && myItems.map(inq => <InquiryCard key={inq.id} inq={inq} />)}
              {!loadingMine && !loadError && myItems.length === 0 && (
                <div className="text-center py-12 text-slate-600 dark:text-slate-300 text-sm">등록한 문의가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
