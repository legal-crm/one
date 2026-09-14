import React, { useState } from 'react';
import { Landmark, Search, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface CourtInfo {
  name: string;
  cryptoRule: string; // 주식/가상자산 준칙
  prohibitionDays: string; // 금지명령 소요 기간
  prohibitionStrictness: '관대' | '보통' | '엄격';
  extraExpenseFlexibility: '상' | '중' | '하';
  notes: string;
}

const COURTS: CourtInfo[] = [
  {
    name: '서울회생법원',
    cryptoRule: '실무준칙 제401호 적용 (손실금 청산가치 미반영)',
    prohibitionDays: '영업일 기준 3~5일',
    prohibitionStrictness: '관대',
    extraExpenseFlexibility: '상',
    notes: '전국에서 가장 채무자 친화적. 주거비 추가인정 적극적.',
  },
  {
    name: '수원회생법원',
    cryptoRule: '서울 준칙 준용 (단, 최근 대출 집중투자는 정밀소명)',
    prohibitionDays: '영업일 기준 5~7일',
    prohibitionStrictness: '보통',
    extraExpenseFlexibility: '중',
    notes: '경기 남부 관할. 최근 1년 대출금 사용처 철저 심사.',
  },
  {
    name: '부산회생법원',
    cryptoRule: '서울 준칙 준용 (부울경 통합 관할)',
    prohibitionDays: '영업일 기준 5~7일',
    prohibitionStrictness: '관대',
    extraExpenseFlexibility: '중',
    notes: '부울경 채무자 인가율 높음. 금지명령 신속 발령.',
  },
  {
    name: '인천지방법원',
    cryptoRule: '원칙상 청산가치 일부 반영 요구 경향',
    prohibitionDays: '영업일 기준 7~14일',
    prohibitionStrictness: '엄격',
    extraExpenseFlexibility: '하',
    notes: '금지명령 기각률 상대적 높음. 최근 채무 소명 강도 높음.',
  },
  {
    name: '대전지방법원',
    cryptoRule: '재량 심사 (사행성 여부 면밀 검토)',
    prohibitionDays: '영업일 기준 7~10일',
    prohibitionStrictness: '보통',
    extraExpenseFlexibility: '중',
    notes: '충청권 관할. 보정권고 2~3회 기본 진행.',
  },
  {
    name: '대구지방법원',
    cryptoRule: '보수적 심사 (투자금 원금 일부 변제계획 반영 유도)',
    prohibitionDays: '영업일 기준 7~14일',
    prohibitionStrictness: '엄격',
    extraExpenseFlexibility: '하',
    notes: '생계비 추가인정 보수적. 변제율 상향 권고 빈번.',
  },
  {
    name: '광주지방법원',
    cryptoRule: '사안별 판단 (실제 남은 잔액만 반영 원칙)',
    prohibitionDays: '영업일 기준 5~8일',
    prohibitionStrictness: '보통',
    extraExpenseFlexibility: '중',
    notes: '호남권 관할. 서류 충실 시 금지명령 무난히 인용.',
  },
];

export default function CourtGuidelinesTool() {
  const [selectedCourt, setSelectedCourt] = useState<CourtInfo>(COURTS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredCourts = COURTS.filter(c => c.name.includes(searchTerm));

  const handleCopy = () => {
    const text = `[${selectedCourt.name} 실무성향 안내]
• 주식/코인 투자금: ${selectedCourt.cryptoRule}
• 금지명령 소요기간: ${selectedCourt.prohibitionDays} (심사강도: ${selectedCourt.prohibitionStrictness})
• 추가생계비 관대도: ${selectedCourt.extraExpenseFlexibility}
• 실무 특징: ${selectedCourt.notes}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${selectedCourt.name} 실무성향이 복사되었습니다.`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      {/* 법원 선택 */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-700 block">관할 법원 선택</label>
        <div className="grid grid-cols-3 gap-1.5">
          {COURTS.map(c => (
            <button
              key={c.name}
              type="button"
              onClick={() => setSelectedCourt(c)}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center truncate ${
                selectedCourt.name === c.name
                  ? 'bg-violet-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c.name.replace('지방법원', '').replace('회생법원', '')}
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 법원 세부 정보 */}
      <div className="bg-violet-50/70 border border-violet-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-extrabold text-sm text-violet-950 flex items-center gap-1.5">
            <Landmark className="w-4 h-4 text-violet-700" />
            {selectedCourt.name}
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            selectedCourt.prohibitionStrictness === '관대'
              ? 'bg-emerald-100 text-emerald-800'
              : selectedCourt.prohibitionStrictness === '보통'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800'
          }`}>
            금지명령 {selectedCourt.prohibitionStrictness}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div>
            <span className="text-slate-500 block text-[10px]">주식·코인 투자손실금 준칙</span>
            <span className="font-bold text-slate-900">{selectedCourt.cryptoRule}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-white p-2 rounded-lg border border-violet-100">
              <span className="text-slate-500 block text-[10px]">금지명령 소요</span>
              <span className="font-bold text-slate-800">{selectedCourt.prohibitionDays}</span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-violet-100">
              <span className="text-slate-500 block text-[10px]">추가생계비 인정도</span>
              <span className="font-bold text-slate-800">관대도: {selectedCourt.extraExpenseFlexibility}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-violet-100/80 leading-relaxed">
            💡 {selectedCourt.notes}
          </p>
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '법원 실무 브리핑 복사'}</span>
      </button>
    </div>
  );
}
