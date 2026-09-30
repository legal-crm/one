import React, { useState } from 'react';
import { Landmark, AlertTriangle, ExternalLink } from 'lucide-react';
import { courtAllows24Months } from '../../../../services/repayment/rehabLegalCore';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

/**
 * 관할 법원별 실무 확인 메모 (참고용 · 비공식)
 * - 이전 버전은 법원별 '관대/엄격', 금지명령 소요일, 인가율·기각률 같은 근거 없는 평가를
 *   사실처럼 표시·복사했음 → 제거. 확인된 공개 준칙만 남기고 나머지는 '확인 필요'로 표시.
 * - 24개월 단축 특례 운영 여부는 플랫폼 산식 기준(rehabLegalCore.COURTS_ALLOWING_24_MONTHS)과 같게 표시한다.
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

const QUICK_LINKS: { label: string; desc: string; url: string }[] = [
  { label: '전자소송', desc: '신청서·보정서 제출', url: 'https://ecfs.scourt.go.kr' },
  { label: '나의 사건검색', desc: '진행 내역·기일 확인', url: 'https://safind.scourt.go.kr' },
  { label: '대한민국 법원', desc: '법원별 공고·안내', url: 'https://www.scourt.go.kr' },
];

function special24Text(courtName: string): string {
  return courtAllows24Months(courtName)
    ? '운영 (플랫폼 기준) — 만 30세 미만·고령자·기초수급·중증장애·한부모·전세사기 피해 등 요건 확인'
    : '플랫폼 기준 미운영 — 관할 법원 확인 필요';
}

export default function CourtGuidelinesTool() {
  const [selectedCourt, setSelectedCourt] = useState<CourtInfo>(COURTS[0]);
  const { copied, copy } = useCopyFeedback();

  const handleCopy = () => {
    const text = `[${selectedCourt.name} 실무 참고]
• 주식·코인 투자손실금: ${selectedCourt.cryptoRule}
• 24개월 단축 특례: ${special24Text(selectedCourt.name)}
※ 참고용 정리이며 법원의 공식 안내가 아닙니다. 사건 진행 전 관할 법원 공고와 재판부 기준을 확인하세요.`;
    copy(text, `${selectedCourt.name} 실무 참고가 복사되었습니다.`);
  };

  const allows24 = courtAllows24Months(selectedCourt.name);

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      <div className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <span>참고용·비공식 정리입니다. 법원별 준칙은 수시로 개정되므로 관할 법원 공고를 직접 확인하세요.</span>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-700 block" id="court-select-label">관할 법원 선택</span>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-labelledby="court-select-label">
          {COURTS.map(c => (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={selectedCourt.name === c.name}
              onClick={() => setSelectedCourt(c)}
              className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate press-scale ${
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

      <div className="bg-violet-50/70 border border-violet-200 rounded-2xl p-3 space-y-2">
        <span className="font-extrabold text-sm text-violet-950 flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-violet-700" aria-hidden="true" />
          {selectedCourt.name}
        </span>
        <div className="text-[11px]">
          <span className="text-slate-600 block text-[10px]">주식·코인 투자손실금 처리</span>
          <span className="font-bold text-slate-900">{selectedCourt.cryptoRule}</span>
        </div>
        <div className="text-[11px]">
          <span className="text-slate-600 block text-[10px]">24개월 단축 특례</span>
          <span className={`font-bold ${allows24 ? 'text-emerald-800' : 'text-slate-700'}`}>{special24Text(selectedCourt.name)}</span>
        </div>
        <a
          href={selectedCourt.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-800 hover:underline"
        >
          법원 누리집에서 공고 확인
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
      </div>

      {/* 자주 쓰는 법원 사이트 */}
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_LINKS.map(link => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-violet-300 transition-colors press-scale"
          >
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
              {link.label}
              <ExternalLink className="w-3 h-3 text-slate-500" aria-hidden="true" />
            </span>
            <span className="block text-[10px] text-slate-600 leading-tight mt-0.5">{link.desc}</span>
            <span className="sr-only">(새 창)</span>
          </a>
        ))}
      </div>

      <CopyButton copied={copied} onClick={handleCopy} label="법원 실무 참고 복사" />
    </div>
  );
}
