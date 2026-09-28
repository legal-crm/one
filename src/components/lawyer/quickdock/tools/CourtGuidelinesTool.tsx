import React, { useState } from 'react';
import { Landmark, Copy, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 관할 법원별 실무 확인 메모 (참고용 · 비공식)
 * - 이전 버전은 법원별 '관대/엄격', 금지명령 소요일, 인가율·기각률 같은 근거 없는 평가를
 *   사실처럼 표시·복사했음 → 제거. 확인된 공개 준칙만 남기고 나머지는 '확인 필요'로 표시.
 * - 준칙은 개정되므로 사건 진행 전 해당 법원 공고를 직접 확인해야 한다.
 */
interface CourtInfo {
  name: string;
  /** 주식·가상자산 투자손실금 처리 (공개 준칙이 확인된 경우만 기재) */
  cryptoRule: string;
  /** 공식 안내 페이지 */
  url: string;
}

const CHECK_NEEDED = '공개 준칙 미확인 — 관할 법원 공고·재판부 확인 필요';

const COURTS: CourtInfo[] = [
  {
    name: '서울회생법원',
    cryptoRule: '주식·가상자산 투자손실금을 원칙적으로 청산가치에 반영하지 않는 실무준칙 운영 (2022년 7월 시행, 개정 여부 확인)',
    url: 'https://slb.scourt.go.kr',
  },
  { name: '수원회생법원', cryptoRule: CHECK_NEEDED, url: 'https://www.scourt.go.kr' },
  { name: '부산회생법원', cryptoRule: CHECK_NEEDED, url: 'https://www.scourt.go.kr' },
  { name: '대전회생법원', cryptoRule: CHECK_NEEDED, url: 'https://www.scourt.go.kr' },
  { name: '대구회생법원', cryptoRule: CHECK_NEEDED, url: 'https://www.scourt.go.kr' },
  { name: '광주회생법원', cryptoRule: CHECK_NEEDED, url: 'https://www.scourt.go.kr' },
  { name: '그 밖의 지방법원', cryptoRule: CHECK_NEEDED, url: 'https://www.scourt.go.kr' },
];

export default function CourtGuidelinesTool() {
  const [selectedCourt, setSelectedCourt] = useState<CourtInfo>(COURTS[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `[${selectedCourt.name} 실무 참고]
• 주식·코인 투자손실금: ${selectedCourt.cryptoRule}
※ 참고용 정리이며 법원의 공식 안내가 아닙니다. 사건 진행 전 관할 법원 공고와 재판부 기준을 확인하세요.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${selectedCourt.name} 실무 참고가 복사되었습니다.`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      <div className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>참고용·비공식 정리입니다. 법원별 준칙은 수시로 개정되므로 관할 법원 공고를 직접 확인하세요.</span>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-700 block">관할 법원 선택</span>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="관할 법원">
          {COURTS.map(c => (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={selectedCourt.name === c.name}
              onClick={() => setSelectedCourt(c)}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                selectedCourt.name === c.name
                  ? 'bg-violet-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.name.replace('회생법원', '')}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-3 space-y-2">
        <span className="font-extrabold text-sm text-violet-950 flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-violet-700" aria-hidden="true" />
          {selectedCourt.name}
        </span>
        <div className="text-[11px]">
          <span className="text-slate-500 block text-[10px]">주식·코인 투자손실금 처리</span>
          <span className="font-bold text-slate-900">{selectedCourt.cryptoRule}</span>
        </div>
        <a
          href={selectedCourt.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[11px] font-bold text-violet-700 hover:underline"
        >
          법원 누리집에서 공고 확인 ↗
        </a>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '법원 실무 참고 복사'}</span>
      </button>
    </div>
  );
}
