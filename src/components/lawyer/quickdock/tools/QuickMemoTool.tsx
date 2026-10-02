import React, { useState, useEffect } from 'react';
import { FileText, Trash2, Sparkles, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../../common/DialogProvider';
import { QUICK_MEMO_KEY as STORAGE_KEY, purgeLegacyDockMemos } from '../dockStorage';
import { getDockShared } from '../dockShared';
import { buildDockSummary } from '../quickCalc';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

const TEMPLATE_CONSULT = `[의뢰인 상담 요약]
• 성명/연락처: 
• 총 채무액: 약    만 원 (최근대출:    )
• 주 채무원인: (사업실패/생활비/사기/주식코인)
• 월 실수령액: 약    만 원 (근로/사업)
• 부양가족 수: 본인 외   명 (배우자/자녀)
• 보유 재산: (부동산/보증금/차량/퇴직금)
• 긴급 조치: (급여압류/독촉/경매 여부)`;

function persist(value: string) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, value);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function QuickMemoTool() {
  const [memo, setMemo] = useState('');
  const { copied, copy } = useCopyFeedback();
  const dialog = useDialog();

  useEffect(() => {
    purgeLegacyDockMemos();
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMemo(saved);
    } catch {
      // ignore
    }
  }, []);

  const updateMemo = (next: string) => {
    setMemo(next);
    persist(next);
  };

  const appendBlock = (block: string) => {
    updateMemo(memo ? `${memo}\n\n${block}` : block);
  };

  const handleCopy = () => {
    if (!memo.trim()) {
      toast.info('복사할 메모 내용이 없습니다.');
      return;
    }
    copy(memo, '메모 내용이 클립보드에 복사되었습니다.');
  };

  const handleClear = async () => {
    const ok = await dialog.confirm({ title: '메모 비우기', message: '작성 중인 메모를 모두 지우시겠습니까?', confirmText: '비우기', variant: 'warning' });
    if (ok) {
      updateMemo('');
      toast.info('메모가 초기화되었습니다.');
    }
  };

  const handleInsertTemplate = () => {
    appendBlock(TEMPLATE_CONSULT);
    toast.success('상담 요약 템플릿이 추가되었습니다.');
  };

  // 다른 계산기(중위소득·변제율·청산가치·송달료)에 입력한 값을 한 번에 요약해 붙인다
  const handleInsertSummary = () => {
    const summary = buildDockSummary(getDockShared());
    if (!summary) {
      toast.info('퀵툴 계산기에 입력된 값이 없습니다. 중위소득·변제율·청산가치 도구에 먼저 입력하세요.');
      return;
    }
    appendBlock(summary);
    toast.success('계산 결과 요약을 메모에 붙였습니다.');
  };

  return (
    <div className="space-y-2.5 p-4 text-slate-800 text-xs">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span className="flex items-center gap-1 font-bold text-slate-700">
          <FileText className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          상담 메모
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleInsertSummary}
            className="text-teal-800 hover:text-teal-950 font-bold flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
            title="중위소득·변제율·청산가치·송달료 도구의 입력값을 요약해 붙입니다"
          >
            <Calculator className="w-3 h-3" aria-hidden="true" />
            계산 결과 삽입
          </button>
          <button
            type="button"
            onClick={handleInsertTemplate}
            className="text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            상담 템플릿
          </button>
        </div>
      </div>

      <textarea
        value={memo}
        onChange={e => updateMemo(e.target.value)}
        placeholder="전화 상담이나 사이트 작업 중 기억해야 할 내용, 의뢰인 요구사항 등을 자유롭게 작성하세요..."
        aria-label="상담 메모"
        rows={9}
        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 leading-relaxed placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-sans"
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>글자수: {memo.length}자 · 이 탭에만 임시 저장, 로그아웃 시 삭제</span>
        <button
          type="button"
          onClick={handleClear}
          className="hover:text-rose-700 flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" aria-hidden="true" />
          전체 비우기
        </button>
      </div>

      <CopyButton copied={copied} onClick={handleCopy} label="메모 내용 전체 복사" copiedLabel="복사 완료" />
    </div>
  );
}
