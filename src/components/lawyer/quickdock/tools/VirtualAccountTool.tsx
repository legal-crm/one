import React, { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 법원(회생위원) 변제금 입금계좌 안내문 작성기
 * - 가상계좌는 사건마다 개시결정 후 개별 부여되므로 고정 계좌를 표시하지 않는다.
 * - 입력값은 저장하지 않는다 (창을 닫으면 사라짐).
 */
export default function VirtualAccountTool() {
  const [copied, setCopied] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [caseNo, setCaseNo] = useState('');

  const canCopy = bankName.trim().length > 0 && accountNo.trim().length > 0;

  const handleCopy = () => {
    if (!canCopy) {
      toast.error('사건별로 부여된 은행명과 가상계좌번호를 입력해 주세요.');
      return;
    }
    const text = `[개인회생 변제금 납입 안내]
• 입금 계좌: ${bankName.trim()} ${accountNo.trim()}${caseNo.trim() ? `\n• 사건번호: ${caseNo.trim()}` : ''}
• 매월 정해진 납입일까지 입금해 주세요.
• 본인이 아닌 가족 명의로 입금할 때는 입금자명에 의뢰인 성명 또는 사건번호를 기재해 주세요.
• 납입이 어려우면 연체 전에 사무실로 먼저 연락해 주세요.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('변제금 납입 안내문이 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      <p className="text-slate-600 leading-relaxed">
        변제금 가상계좌는 개시결정 후 <strong>사건별로</strong> 회생위원 명의로 부여됩니다. 개시결정문·회생위원 안내문에 적힌 계좌를 입력해 안내문을 만드세요. 입력값은 저장되지 않습니다.
      </p>

      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
        <label className="block">
          <span className="text-[10px] font-bold text-amber-800 block mb-0.5">은행명</span>
          <input
            value={bankName}
            onChange={e => setBankName(e.target.value)}
            placeholder="예: 개시결정문에 기재된 은행"
            className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-amber-800 block mb-0.5">가상계좌번호</span>
          <input
            value={accountNo}
            onChange={e => setAccountNo(e.target.value)}
            placeholder="사건별 가상계좌번호"
            inputMode="numeric"
            className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-mono font-bold"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-amber-800 block mb-0.5">사건번호 (선택)</span>
          <input
            value={caseNo}
            onChange={e => setCaseNo(e.target.value)}
            placeholder="예: 2026개회○○○○○"
            className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs font-bold"
          />
        </label>
        <button
          onClick={handleCopy}
          disabled={!canCopy}
          className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '복사 완료' : '납입 안내문 복사'}</span>
        </button>
      </div>

      <div className="text-[11px] text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 text-amber-700 font-bold">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>의뢰인 안내 시 주의</span>
        </div>
        <p>• 계좌번호는 반드시 개시결정문·회생위원 안내문 원본과 대조해 주세요.</p>
        <p>• 연체가 누적되면(실무상 3개월분 이상) 변제계획 불이행으로 폐지결정(채무자회생법 제624조)이 내려질 수 있습니다.</p>
      </div>
    </div>
  );
}
