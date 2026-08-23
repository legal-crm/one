import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { X, Paperclip, Send, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { ClientInquiry, ClientInquiryCategory, InquiryAttachment } from '../../types';

interface InquiryPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  inquiries: ClientInquiry[];
  setInquiries: React.Dispatch<React.SetStateAction<ClientInquiry[]>>;
  isLoggedIn: boolean;
  userAlias: string;
  onNavigateToQnA: () => void;
  onNavigateToLawyers: () => void;
}

const CATEGORIES: { id: ClientInquiryCategory; label: string }[] = [
  { id: 'site_usage', label: '🖥️ 사이트 이용' },
  { id: 'account', label: '🔑 회원가입·로그인' },
  { id: 'diagnosis', label: '📊 진단 결과' },
  { id: 'lawyer_matching', label: '🤝 변호사 매칭' },
  { id: 'other', label: '📝 기타' }
];

export default function InquiryPopupModal({
  isOpen,
  onClose,
  inquiries,
  setInquiries,
  isLoggedIn,
  userAlias,
  onNavigateToQnA,
  onNavigateToLawyers
}: InquiryPopupModalProps) {
  const [category, setCategory] = useState<ClientInquiryCategory>('site_usage');
  const [nickname, setNickname] = useState(isLoggedIn ? userAlias : '');
  const [tempPassword, setTempPassword] = useState('');
  const [contact, setContact] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<{ file: File; dataUrl?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const newFiles: File[] = Array.from(e.target.files);
    
    if (attachments.length + newFiles.length > 2) {
      toast.error('최대 2개의 파일만 첨부할 수 있습니다');
      return;
    }

    for (const file of newFiles) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`'${file.name}' 파일이 5MB를 초과합니다`);
        continue;
      }

      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachments(prev => [...prev, { file, dataUrl: event.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments(prev => [...prev, { file }]);
      }
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error('문의 제목과 내용을 모두 입력해 주세요');
      return;
    }

    if (!isLoggedIn) {
      if (!nickname.trim()) {
        toast.error('닉네임을 입력해 주세요');
        return;
      }
      if (!tempPassword.trim() || tempPassword.length !== 4 || isNaN(Number(tempPassword))) {
        toast.error('문의 확인용 임시 비밀번호 4자리 숫자를 정확히 입력해 주세요');
        return;
      }
    }

    const clientId = isLoggedIn ? (localStorage.getItem('legal_crm_client_id') || 'client-temp') : `non-member-${Date.now()}`;

    // Generate inquiry object, casting as any to append extra properties mentioned in prompt 
    // that might not exist in the base ClientInquiry interface in types.ts.
    const newInquiry = {
      id: `inquiry-popup-${Date.now()}`,
      clientId,
      clientName: isLoggedIn ? (userAlias || '의뢰인') : nickname.trim(),
      title: title.trim(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending' as const,
      category,
      source: 'popup_modal' as const,
      contactInfo: contact.trim() || undefined,
      tempPassword: !isLoggedIn ? tempPassword : undefined,
      attachments: attachments.map((a, i) => ({
        id: `att-${Date.now()}-${i}`,
        fileName: a.file.name,
        fileSize: a.file.size,
        fileType: a.file.type,
        dataUrl: a.dataUrl || ''
      }))
    };

    setInquiries(prev => [newInquiry, ...prev]);
    toast.success('문의가 정상적으로 접수되었습니다');
    
    // Reset form
    setCategory('site_usage');
    if (!isLoggedIn) {
      setNickname('');
      setTempPassword('');
    }
    setContact('');
    setTitle('');
    setContent('');
    setAttachments([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg my-8 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>💬</span> 1:1 고객 문의
            </h2>
            <p className="text-sm text-slate-500 mt-1">사이트 사용 및 활용에 관한 문의를 남겨주세요</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800 rounded-full transition-colors active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* Guidance Banner */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 shadow-sm">
            <div className="flex gap-3">
              <div className="text-xl mt-0.5">💡</div>
              <div className="space-y-3 flex-1">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  채무 관련 제도나 법률 상담은 아래 서비스를 이용해 주세요
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button 
                    onClick={() => { onNavigateToLawyers(); onClose(); }} 
                    className="flex-1 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 hover:border-amber-300 dark:hover:border-amber-600 text-sm font-bold text-amber-900 dark:text-amber-300 py-2.5 px-3 rounded-xl transition-all text-center min-h-[44px] active:scale-[0.98]"
                  >
                    ⚖️ 전담 변호사에게 문의하기
                  </button>
                  <button 
                    onClick={() => { onNavigateToQnA(); onClose(); }} 
                    className="flex-1 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 hover:border-amber-300 dark:hover:border-amber-600 text-sm font-bold text-amber-900 dark:text-amber-300 py-2.5 px-3 rounded-xl transition-all text-center min-h-[44px] active:scale-[0.98]"
                  >
                    💬 고민상담 Q&A에서 질문하기
                  </button>
                </div>
              </div>
            </div>
          </div>

          <form id="inquiry-popup-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Category Selection */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">문의 유형</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold transition-all min-h-[44px] active:scale-[0.98] ${
                      category === cat.id 
                        ? 'bg-brand text-white shadow-md shadow-brand/20' 
                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User Info Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">닉네임</label>
                <input 
                  type="text" 
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)} 
                  disabled={isLoggedIn}
                  placeholder="닉네임 입력" 
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60 disabled:cursor-not-allowed" 
                />
              </div>

              {!isLoggedIn && (
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                    문의 확인용 임시 비밀번호 (4자리 숫자)
                  </label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={tempPassword} 
                    onChange={(e) => setTempPassword(e.target.value.replace(/[^0-9]/g, ''))} 
                    placeholder="숫자 4자리" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" 
                  />
                  <p className="text-xs text-slate-500 mt-1">비로그인 문의 시, 이 비밀번호로 문의 내역을 확인할 수 있습니다</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">연락처 (선택)</label>
              <input 
                type="text" 
                value={contact} 
                onChange={(e) => setContact(e.target.value)} 
                placeholder="이메일 또는 전화번호 (선택)" 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" 
              />
            </div>

            {/* Inquiry Content */}
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">문의 제목</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="문의 제목을 입력하세요" 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">문의 내용</label>
              <textarea 
                rows={4} 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                placeholder="사이트 이용 중 발생한 문제나 궁금한 점을 자세히 기재해 주세요." 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-700 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand min-h-[120px] resize-y custom-scrollbar" 
              />
            </div>

            {/* File Upload */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">파일 첨부 (최대 2개, 5MB)</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 bg-brand/5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                  disabled={attachments.length >= 2}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>파일 추가</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                />
              </div>

              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 group">
                      {att.dataUrl ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200">
                          <img src={att.dataUrl} alt="preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{att.file.name}</p>
                        <p className="text-[10px] text-slate-500">{(att.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors mr-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 rounded-b-3xl">
          <button 
            type="submit" 
            form="inquiry-popup-form"
            className="w-full bg-gradient-to-r from-brand to-indigo-600 hover:from-brand-hover hover:to-indigo-700 text-white font-bold py-3.5 rounded-xl text-base transition-all shadow-sm hover:shadow-brand-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Send className="w-5 h-5" />
            <span>문의 제출하기</span>
          </button>
        </div>

      </div>
    </div>
  );
}
