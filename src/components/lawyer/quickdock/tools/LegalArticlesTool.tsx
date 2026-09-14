import React, { useState } from 'react';
import { BookOpen, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const ARTICLES = [
  {
    id: 'art595',
    title: '제595조 (개인회생 기각사유)',
    summary: '법원이 신청을 기각해야 하는 필수 7가지 사유',
    details: [
      '1. 신청권자의 자격을 갖추지 아니한 때',
      '2. 첨부서류 미제출, 허위작성 또는 제출기한 미준수',
      '3. 절차비용(송달료·인지대 등) 미납',
      '4. 변제계획안 제출기한(신청일로부터 14일) 미준수',
      '5. 신청 전 5년 내 면책(파산/회생) 받은 사실이 있는 때',
      '6. 개인회생절차에 의함이 채권자 일반의 이익에 적합하지 아니한 때',
      '7. 그 밖에 신청이 성실하지 아니하거나 상당한 이유 없이 지연시킨 때',
    ],
  },
  {
    id: 'art614',
    title: '제614조 (변제계획 인가요건)',
    summary: '법원이 변제계획을 최종 인가하기 위한 핵심 요건',
    details: [
      '1. 변제계획이 법률의 규정에 적합할 것',
      '2. 변제계획이 공정하고 형평에 맞을 것',
      '3. 변제계획 인가일 기준 채권자가 총 변제받을 금액이 파산 시 배당받을 금액(청산가치)보다 적지 아니할 것 (청산가치 보장의 원칙)',
      '4. 변제계획의 수행이 실현 가능할 것',
      '5. 가용소득 전부투입 요건 충족 (이의신청 시 36개월간 가용소득 전액 변제 투입)',
    ],
  },
  {
    id: 'art564',
    title: '제564조 (파산 면책불허가사유)',
    summary: '개인파산 시 면책을 받을 수 없는 법정 불허가 사유',
    details: [
      '1. 재산을 은닉·손괴하거나 채권자에게 불이익하게 처분한 때 (사기파산죄)',
      '2. 파산원인의 사실을 속이고 신용거래로 재산을 취득한 때',
      '3. 과다한 낭비, 도박 그 밖의 사행행위로 현저히 재산을 감소시키거나 과대한 채무를 부담한 때',
      '4. 허위의 채권자목록을 작성하거나 법원에 허위 진술을 한 때',
      '5. 파산면책 확정일로부터 7년, 개인회생 면책 확정일로부터 5년 미경과',
      '6. 의무 위반(설명의무 위반 등)',
    ],
  },
  {
    id: 'art593',
    title: '제593조 (중지·금지명령)',
    summary: '개시결정 전 채권자의 강제집행 및 독촉을 금지하는 명령',
    details: [
      '1. 채무자에 대한 파산절차 또는 화의절차의 중지',
      '2. 강제집행·가압류·가처분의 중지 또는 금지',
      '3. 담보권 설정 및 경매의 중지 또는 금지',
      '4. 변제를 요구하거나 독촉하는 일체의 행위 금지 (전화, 방문, 우편 등)',
      '* 통상 신청서 접수 후 3~7일 내 발령',
    ],
  },
];

export default function LegalArticlesTool() {
  const [selectedArt, setSelectedArt] = useState(ARTICLES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `[채무자회생법 ${selectedArt.title}]
${selectedArt.summary}
${selectedArt.details.join('\n')}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('법률 조문 요약이 복사되었습니다.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      {/* 조문 탭 */}
      <div className="grid grid-cols-2 gap-1.5">
        {ARTICLES.map(art => (
          <button
            key={art.id}
            onClick={() => setSelectedArt(art)}
            className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-left truncate ${
              selectedArt.id === art.id
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {art.title.split(' ')[0]} {art.title.split(' ')[1]?.replace('(', '')}
          </button>
        ))}
      </div>

      {/* 조문 내용 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-blue-900 font-extrabold text-sm border-b border-slate-200 pb-1.5">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>{selectedArt.title}</span>
        </div>
        <p className="text-[11px] text-blue-800 font-semibold">{selectedArt.summary}</p>

        <div className="space-y-1 pt-1 max-h-48 overflow-y-auto pr-1">
          {selectedArt.details.map((line, idx) => (
            <p key={idx} className="text-[11px] text-slate-700 leading-relaxed font-sans">
              {line}
            </p>
          ))}
        </div>
      </div>

      <button
        onClick={handleCopy}
        className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer press-scale active:scale-[0.98]"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        <span>{copied ? '복사되었습니다' : '조문 내용 복사하기'}</span>
      </button>
    </div>
  );
}
