import React, { useState } from 'react';
import { ShieldAlert, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SeizureLimitsTool() {
  const [tab, setTab] = useState<'deposit' | 'housing'>('deposit');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `[민사집행법 & 주택임대차 압류금지 기준]
1. 압류금지 예금: 1인당 전 금융기관 합산 월 185만 원
2. 압류금지 급여: 월 185만 원 이하 전액 보호 (300만원 초과는 1/2 보호)
3. 최우선변제금(소액임차보증금):
  • 서울: 1억 6,500만 원 이하 중 최대 5,500만 원 보호
  • 과밀억제권역/세종/용인/화성: 1억 4,500만 원 이하 중 최대 4,800만 원 보호
  • 광역시: 8,500만 원 이하 중 최대 2,800만 원 보호
  • 기타 지역: 7,500만 원 이하 중 최대 2,500만 원 보호`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('압류금지 기준표가 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      {/* 탭 전환 */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setTab('deposit')}
          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            tab === 'deposit' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          예금·급여·보험금
        </button>
        <button
          onClick={() => setTab('housing')}
          className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            tab === 'housing' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          주택 최우선변제금
        </button>
      </div>

      {tab === 'deposit' ? (
        <div className="space-y-2">
          <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 space-y-1">
            <span className="font-bold text-slate-800 flex items-center justify-between">
              <span>💳 통장 예금 잔액</span>
              <span className="text-amber-700 font-extrabold">월 185만 원 보호</span>
            </span>
            <p className="text-[11px] text-slate-600">
              전 금융기관 합산 185만 원까지는 압류명령이 도달해도 인출 가능 (압류금지채권범위변경 신청).
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 space-y-1">
            <span className="font-bold text-slate-800 flex items-center justify-between">
              <span>💼 근로소득 (월급)</span>
              <span className="text-amber-700 font-extrabold">하한 185만 원</span>
            </span>
            <p className="text-[11px] text-slate-600">
              • 월 185만 원 이하: 전액 압류 금지<br/>
              • 월 185만 ~ 300만 원: 185만 원 제외한 나머지 압류 가능<br/>
              • 월 300만 ~ 600만 원: 급여의 1/2 압류 가능
            </p>
          </div>

          <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50/60 space-y-1">
            <span className="font-bold text-slate-800 flex items-center justify-between">
              <span>🛡️ 보험금 및 퇴직금</span>
              <span className="text-amber-700 font-extrabold">법정 보호</span>
            </span>
            <p className="text-[11px] text-slate-600">
              • 사망보험금 1,000만 원 이하 / 보장성 해약환급금 150만 원 이하<br/>
              • 퇴직금 및 퇴직연금: 퇴직금의 1/2 압류 금지 (DC형 연금은 전액 금지)
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-x-auto">
          <table className="w-full text-[11px] text-left border border-slate-200 rounded-xl overflow-hidden">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5">지역 구분</th>
                <th className="py-2 px-2.5">보증금 기준</th>
                <th className="py-2 px-2.5 text-amber-800 bg-amber-50">최우선변제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50">
                <td className="py-1.5 px-2.5 font-bold">서울특별시대</td>
                <td className="py-1.5 px-2.5">1억 6,500만 이하</td>
                <td className="py-1.5 px-2.5 font-extrabold text-amber-700 bg-amber-50/40">5,500만 원</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-1.5 px-2.5 font-bold">수도권 과밀/세종/용인/화성</td>
                <td className="py-1.5 px-2.5">1억 4,500만 이하</td>
                <td className="py-1.5 px-2.5 font-extrabold text-amber-700 bg-amber-50/40">4,800만 원</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-1.5 px-2.5 font-bold">광역시/안산/광주/파주 등</td>
                <td className="py-1.5 px-2.5">8,500만 이하</td>
                <td className="py-1.5 px-2.5 font-extrabold text-amber-700 bg-amber-50/40">2,800만 원</td>
              </tr>
              <tr className="hover:bg-slate-50">
                <td className="py-1.5 px-2.5 font-bold">그 밖의 지역</td>
                <td className="py-1.5 px-2.5">7,500만 이하</td>
                <td className="py-1.5 px-2.5 font-extrabold text-amber-700 bg-amber-50/40">2,500만 원</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 pt-1">
            * 담보물권(근저당) 설정일자 기준 규정이 적용될 수 있으므로 등기부등본 확인 필수.
          </p>
        </div>
      )}

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '압류금지 기준 복사'}</span>
      </button>
    </div>
  );
}
