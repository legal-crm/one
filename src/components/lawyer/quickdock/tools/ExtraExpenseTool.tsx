import React, { useState } from 'react';
import { Scale, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function ExtraExpenseTool() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `[회생법원 추가생계비 인정 기준 요약]
1. 주거비(제402호): 서울 기준 1~2인가구 월 최대 38만~45만원, 3~4인가구 월 최대 55만~68만원 임차료 추가인정 가능
2. 의료비(제403호): 만성질환/암 등 정기 발생 본인부담금 1년치 영수증 소명 시 전액 가산
3. 교육/양육비: 판결문·양육비부담조서 상 양육비 전액, 특수교육/발달치료비 의사소견서 제출 시 인정`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('추가생계비 실무준칙 요약이 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      {/* 1. 주거비 한도 */}
      <div className="border border-slate-200 rounded-xl p-3 space-y-1.5 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 flex items-center gap-1">
            🏠 주거비 추가 인정 (제402호)
          </span>
          <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
            월세 한도
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          실제 월세가 기준생계비 내 기본주거비를 초과할 경우 법원 심사를 거쳐 추가 생계비로 인정됩니다.
        </p>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[10px]">서울 1~2인 가구</span>
            <span className="font-bold text-slate-800 text-[11px]">최대 월 38~45만 원</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="text-slate-400 block text-[10px]">서울 3~4인 가구</span>
            <span className="font-bold text-slate-800 text-[11px]">최대 월 55~68만 원</span>
          </div>
        </div>
      </div>

      {/* 2. 의료비 */}
      <div className="border border-slate-200 rounded-xl p-3 space-y-1 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 flex items-center gap-1">
            💊 지속적 의료비 (제403호)
          </span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
            진단서 필수
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          본인·가족 만성질환으로 매월 발생하는 본인부담금은 최근 1년치 영수증 제출 시 원칙상 전액 인정.
        </p>
      </div>

      {/* 3. 양육비/교육비 */}
      <div className="border border-slate-200 rounded-xl p-3 space-y-1 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900 flex items-center gap-1">
            🎓 법정 양육비 & 공교육비
          </span>
          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
            판결문 첨부
          </span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          • <strong>양육비</strong>: 가정법원 부담조서/판결문 기재 금액 전액 생계비 가산.<br/>
          • <strong>사교육비</strong>: 일반 학원비는 불인정, 발달치료/특수치료는 의사소견서 시 인정.
        </p>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '준칙 가이드 복사'}</span>
      </button>
    </div>
  );
}
