import React from 'react';
import { ClientInquiry } from '../../types';

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

export default function InquiryView({
  inquiries, setInquiries, isLoggedIn, userAlias,
  onShowAuthModal, inquiryTitle, setInquiryTitle,
  inquiryContent, setInquiryContent, onLogActivity
}: InquiryViewProps) {
  const clientId = localStorage.getItem('legal_crm_client_id') || 'client-temp';
  const myInquiries = inquiries.filter(inq => inq.clientId === clientId);

  const handleCreateInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryTitle.trim() || !inquiryContent.trim()) {
      alert('제목과 내용을 모두 입력해 주세요.');
      return;
    }
    const newInq: ClientInquiry = {
      id: `inquiry-${Date.now()}`,
      clientId,
      clientName: userAlias || '의뢰인',
      title: inquiryTitle.trim(),
      content: inquiryContent.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    setInquiries(prev => [newInq, ...prev]);
    setInquiryTitle('');
    setInquiryContent('');
    onLogActivity(clientId, userAlias || '의뢰인', 'CLIENT', 'ADMIN_ACTION', `1:1 문의 등록 완료: 제목 [${newInq.title}]`);
    alert('1:1 문의가 정상적으로 등록되었습니다. 관리자 확인 후 빠른 시일 내에 답변드리겠습니다.');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn text-left pb-12">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="space-y-3 relative z-10">
          <span className="text-xs sm:text-sm bg-brand/20 text-brand-light px-3.5 py-1 rounded-full font-bold uppercase tracking-wider">사이트 이용 관련 1:1 문의</span>
          <h2 className="text-2xl md:text-3xl font-extrabold">1:1 고객 문의</h2>
          <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed font-medium">사이트 사용법, 계정, 기능 활용 등에 대해 궁금한 점을 문의하세요. 문의 내용은 본인과 관리자만 확인할 수 있습니다.</p>
          <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-amber-300 font-medium">
            💡 채무·개인회생·파산 등 법률 관련 질문은 <strong>고민상담 Q&A</strong> 게시판을 이용하시거나, <strong>전담 변호사</strong>에게 직접 문의하시기 바랍니다.
          </div>
        </div>
      </div>

      {!isLoggedIn ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-white">1:1 문의를 이용하려면 로그인이 필요합니다</h3>
          <p className="text-sm sm:text-base text-slate-600">가명 계정 로그인을 진행하여 질문을 등록하고 실시간 관리자 답변을 받아보실 수 있습니다.</p>
          <button onClick={onShowAuthModal} className="bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold px-7 py-3 rounded-2xl text-base transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] cursor-pointer">간편 가명 로그인 진행하기</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={handleCreateInquiry} className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800"><span>🙋</span><span>새로운 문의 등록하기</span></h3>
            <div className="space-y-1.5 text-sm">
              <label className="text-xs sm:text-sm text-slate-700 font-bold block">문의 제목</label>
              <input type="text" value={inquiryTitle} onChange={(e) => setInquiryTitle(e.target.value)} placeholder="문의 제목을 입력하세요" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-base text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand font-medium" />
            </div>
            <div className="space-y-1.5 text-sm">
              <label className="text-xs sm:text-sm text-slate-700 font-bold block">상세 문의 본문</label>
              <textarea rows={8} value={inquiryContent} onChange={(e) => setInquiryContent(e.target.value)} placeholder="질문 내용을 자세히 기재해 주시면 관리자가 성심성의껏 답변드리겠습니다." className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 font-normal leading-relaxed text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-brand min-h-[180px]" />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold py-3.5 rounded-2xl text-base transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] cursor-pointer text-center">문의 제출하기 (Stealth 전송)</button>
          </form>

          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800"><span>📋</span><span>나의 문의 내역 및 관리자 답변</span></h3>
            <div className="space-y-4">
              {myInquiries.map(inq => (
                <div key={inq.id} className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className={`text-xs px-2.5 py-0.5 rounded-md border font-bold ${inq.status === 'replied' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>{inq.status === 'replied' ? '답변 완료' : '답변 대기'}</span>
                    <span className="text-xs text-slate-500 font-mono">{new Date(inq.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-base text-slate-900 dark:text-slate-200">Q. {inq.title}</h4>
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-normal whitespace-pre-wrap">{inq.content}</p>
                  </div>
                  {inq.replyContent ? (
                    <div className="bg-indigo-500/5 dark:bg-indigo-950/10 p-4.5 rounded-xl border border-indigo-500/10 space-y-1.5 text-sm sm:text-base">
                      <div className="flex justify-between items-center text-xs text-indigo-400 font-bold mb-1">
                        <span>A. 운영자 공식 답변</span>
                        {inq.repliedAt && <span className="font-mono text-slate-500 font-normal">{new Date(inq.repliedAt).toLocaleDateString()}</span>}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold whitespace-pre-wrap">{inq.replyContent}</p>
                    </div>
                  ) : (
                    <div className="text-center py-2.5 text-xs text-slate-500 font-semibold bg-slate-100/50 dark:bg-slate-900/30 rounded-xl">⏰ 관리자가 질문을 확인하고 답변을 작성 중입니다. 잠시만 기다려 주세요.</div>
                  )}
                </div>
              ))}
              {myInquiries.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm sm:text-base">등록한 1:1 문의 내역이 없습니다. 왼쪽 양식을 통해 질문을 등록해 보십시오.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
