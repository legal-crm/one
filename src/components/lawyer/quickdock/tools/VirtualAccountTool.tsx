import React, { useState } from 'react';
import { CreditCard, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function VirtualAccountTool() {
  const [copied, setCopied] = useState(false);
  const mockAccountNumber = '신한은행 562-901-883921 (예금주: 서울회생법원)';

  const handleCopy = () => {
    navigator.clipboard.writeText(mockAccountNumber);
    setCopied(true);
    toast.success('법원 가상계좌가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3.5 p-4 text-slate-800 text-xs">
      <p className="text-slate-600 leading-relaxed">
        개인회생 개시결정 후 회생위원 명의 법원 가상계좌가 부여됩니다. 의뢰인에게 본 계좌로 납입을 안내하세요.
      </p>

      <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-2">
        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">법원 변제금 전용 입금계좌</span>
        <div className="p-2.5 bg-white rounded-lg border border-amber-200/80">
          <p className="text-xs font-bold text-slate-900 select-all font-mono">
            {mockAccountNumber}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '복사 완료' : '계좌정보 원클릭 복사'}</span>
        </button>
      </div>

      <div className="text-[11px] text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-1 text-amber-700 font-bold">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>의뢰인 필수 주의사항</span>
        </div>
        <p>• <strong>타인 명의 입금 시</strong>: 입금자명에 반드시 '의뢰인 성명' 또는 '사건번호'를 기재해야 처리됩니다.</p>
        <p>• <strong>연체 주의</strong>: 통상 3회 이상 미납 시 채권자 이의 및 법원 직권 폐지결정이 내려질 수 있습니다.</p>
      </div>
    </div>
  );
}
