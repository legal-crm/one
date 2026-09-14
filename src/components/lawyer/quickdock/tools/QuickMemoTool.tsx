import React, { useState, useEffect } from 'react';
import { FileText, Copy, Trash2, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'legal_dock_scratchpad_memo';

const TEMPLATE_CONSULT = `[의뢰인 상담 요약]
• 성명/연락처: 
• 총 채무액: 약    만 원 (최근대출:    )
• 주 채무원인: (사업실패/생활비/사기/주식코인)
• 월 실수령액: 약    만 원 (근로/사업)
• 부양가족 수: 본인 외   명 (배우자/자녀)
• 보유 재산: (부동산/보증금/차량/퇴직금)
• 긴급 조치: (급여압류/독촉/경매 여부)`;

export default function QuickMemoTool() {
  const [memo, setMemo] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMemo(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMemo(val);
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch {
      // ignore
    }
  };

  const handleCopy = () => {
    if (!memo.trim()) {
      toast.info('복사할 메모 내용이 없습니다.');
      return;
    }
    navigator.clipboard.writeText(memo);
    setCopied(true);
    toast.success('메모 내용이 클립보드에 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    if (window.confirm('작성 중인 메모를 모두 지우시겠습니까?')) {
      setMemo('');
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      toast.info('메모가 초기화되었습니다.');
    }
  };

  const handleInsertTemplate = () => {
    const next = memo ? `${memo}\n\n${TEMPLATE_CONSULT}` : TEMPLATE_CONSULT;
    setMemo(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    toast.success('상담 요약 템플릿이 추가되었습니다.');
  };

  return (
    <div className="space-y-2.5 p-4 text-slate-800 text-xs">
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 font-bold text-slate-700">
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          실시간 상담 메모 (자동 저장됨)
        </span>
        <button
          type="button"
          onClick={handleInsertTemplate}
          className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
        >
          <Sparkles className="w-3 h-3" />
          상담 템플릿 삽입
        </button>
      </div>

      <textarea
        value={memo}
        onChange={handleChange}
        placeholder="전화 상담이나 사이트 작업 중 기억해야 할 내용, 의뢰인 요구사항 등을 자유롭게 작성하세요..."
        rows={8}
        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-sans"
      />

      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>글자수: {memo.length}자</span>
        <button
          type="button"
          onClick={handleClear}
          className="hover:text-rose-600 flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
          전체 비우기
        </button>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사 완료' : '메모 내용 전체 복사'}</span>
      </button>
    </div>
  );
}
