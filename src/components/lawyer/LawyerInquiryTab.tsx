import React, { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Send, Paperclip, X, FileText, Image as ImageIcon, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { LawyerInquiry, LawyerInquiryCategory, InquiryAttachment } from '../../types';

interface LawyerInquiryTabProps {
  lawyerInquiries: LawyerInquiry[];
  setLawyerInquiries: React.Dispatch<React.SetStateAction<LawyerInquiry[]>>;
  currentLawyerId: string;
  currentLawyerName: string;
}

const CATEGORIES: { id: LawyerInquiryCategory; label: string }[] = [
  { id: 'platform_usage', label: '🖥️ 플랫폼 사용법' },
  { id: 'feature_request', label: '💡 기능 개선 제안' },
  { id: 'billing_contract', label: '💰 요금·계약' },
  { id: 'ad_marketing', label: '📢 광고·마케팅' },
  { id: 'other', label: '📝 기타' }
];

export default function LawyerInquiryTab({
  lawyerInquiries,
  setLawyerInquiries,
  currentLawyerId,
  currentLawyerName
}: LawyerInquiryTabProps) {
  const [category, setCategory] = useState<LawyerInquiryCategory>('platform_usage');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<InquiryAttachment[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myInquiries = lawyerInquiries.filter(inq => inq.lawyerId === currentLawyerId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;

    if (attachments.length + files.length > 3) {
      toast.error('최대 3개의 파일만 첨부 가능합니다.');
      return;
    }

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`'${file.name}' 파일이 5MB를 초과합니다.`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setAttachments(prev => [...prev, {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            dataUrl: result
          }]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error('제목과 내용을 모두 입력해 주세요.');
      return;
    }

    const newInquiry: LawyerInquiry = {
      id: `lawyer-inq-${Date.now()}`,
      lawyerId: currentLawyerId,
      lawyerName: currentLawyerName,
      category,
      title: title.trim(),
      content: content.trim(),
      attachments,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setLawyerInquiries(prev => [newInquiry, ...prev]);
    
    setTitle('');
    setContent('');
    setCategory('platform_usage');
    setAttachments([]);
    
    toast.success('문의가 성공적으로 등록되었습니다.');
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
      {/* Left Panel - Submission Form */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <MessageSquare className="w-5 h-5 text-brand" />
            <h2 className="text-lg font-bold text-slate-800">마이김변에 문의하기</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">문의 유형</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] ${
                      category === cat.id
                        ? 'bg-brand text-white'
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="문의 제목을 입력하세요"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="상세 내용을 입력해 주세요..."
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 min-h-[200px] resize-y focus:outline-none focus:ring-2 focus:ring-brand/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">첨부 파일 (선택)</label>
              <div 
                className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 font-medium">
                  파일 첨부 (이미지, PDF · 최대 3개 · 각 5MB)
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                  multiple
                  className="hidden"
                />
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {attachments.map(att => (
                    <div key={att.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white">
                      {att.fileType.startsWith('image/') ? (
                        <div className="w-20 h-20 bg-slate-100 flex items-center justify-center">
                          <img src={att.dataUrl} alt={att.fileName} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-slate-50 flex flex-col items-center justify-center p-2">
                          <FileText className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-[10px] text-slate-500 truncate w-full text-center">PDF</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-[#1E3A5F] hover:bg-[#163152] text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Send className="w-4 h-4" />
              문의 등록하기
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel - History List */}
      <div className="lg:col-span-7">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full min-h-[600px] flex flex-col">
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
            <span className="text-xl">📋</span>
            <h2 className="text-lg font-bold text-slate-800">나의 문의 내역</h2>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {myInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 pb-20">
                <MessageSquare className="w-12 h-12 text-slate-200" />
                <p className="text-sm font-medium">등록한 문의가 없습니다</p>
              </div>
            ) : (
              myInquiries.map(inq => {
                const isExpanded = expandedId === inq.id;
                const categoryLabel = CATEGORIES.find(c => c.id === inq.category)?.label || '기타';
                
                return (
                  <div key={inq.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-white hover:border-slate-300 transition-colors">
                    <div 
                      className="p-4 sm:p-5 cursor-pointer flex items-start gap-4"
                      onClick={() => toggleExpand(inq.id)}
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                            inq.status === 'replied' 
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                              : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            {inq.status === 'replied' ? '답변 완료' : '답변 대기'}
                          </span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                            {categoryLabel}
                          </span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                          {inq.title}
                        </h3>
                        {!isExpanded && (
                          <p className="text-sm text-slate-500 line-clamp-1">
                            {inq.content}
                          </p>
                        )}
                      </div>
                      <div className="pt-1">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 space-y-4">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {inq.content}
                        </div>
                        
                        {inq.attachments && inq.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {inq.attachments.map(att => (
                              <div key={att.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-600">
                                {att.fileType.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-brand" /> : <FileText className="w-4 h-4 text-brand" />}
                                <span className="max-w-[150px] truncate">{att.fileName}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {inq.replyContent && (
                          <div className="mt-4 bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-indigo-600">
                              <span>마이김변 운영팀 답변</span>
                              {inq.repliedAt && <span className="font-normal text-indigo-400">{new Date(inq.repliedAt).toLocaleDateString()}</span>}
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {inq.replyContent}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
