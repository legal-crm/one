import React, { useState } from 'react';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useCopyFeedback } from '../clipboard';
import CopyButton from '../ui/CopyButton';

interface Article {
  id: string;
  /** 조 번호 (국가법령정보센터 원문 링크용) */
  no: number;
  short: string;
  title: string;
  summary: string;
  details: string[];
}

/** 요약본 — 조문 전문이 아니므로 제출 전 원문(국가법령정보센터)으로 확인한다 */
const ARTICLES: Article[] = [
  {
    id: 'art579',
    no: 579,
    short: '§579 신청 자격',
    title: '제579조 (개인채무자·가용소득 정의)',
    summary: '개인회생을 신청할 수 있는 채무자와 채무 한도, 가용소득의 뜻',
    details: [
      '1. 개인채무자: 파산의 원인인 사실이 있거나 생길 염려가 있는 급여소득자·영업소득자',
      '2. 채무 한도 (신청 당시): 담보부 개인회생채권 15억 원 이하, 그 밖의 개인회생채권 10억 원 이하',
      '3. 가용소득: 모든 소득의 합계에서 세금·건강보험료 등, 채무자와 피부양자의 생계비(법원이 정하는 금액), 영업소득자의 영업 필요비용을 뺀 금액',
    ],
  },
  {
    id: 'art595',
    no: 595,
    short: '§595 기각사유',
    title: '제595조 (개인회생 기각사유)',
    summary: '법원이 개인회생절차개시신청을 기각할 수 있는 사유',
    details: [
      '1. 신청권자의 자격을 갖추지 아니한 때',
      '2. 첨부서류 미제출, 허위작성 또는 제출기한 미준수',
      '3. 절차비용(송달료·인지대 등) 미납',
      '4. 변제계획안 제출기한(신청일로부터 14일) 미준수',
      '5. 신청일 전 5년 이내에 면책(파산절차에 의한 면책 포함)을 받은 사실이 있는 때',
      '6. 개인회생절차에 의함이 채권자 일반의 이익에 적합하지 아니한 때',
      '7. 그 밖에 신청이 성실하지 아니하거나 상당한 이유 없이 절차를 지연시키는 때',
    ],
  },
  {
    id: 'art614',
    no: 614,
    short: '§614 인가요건',
    title: '제614조 (변제계획 인가요건)',
    summary: '법원이 변제계획을 인가하기 위한 요건',
    details: [
      '1. 변제계획이 법률의 규정에 적합할 것',
      '2. 변제계획이 공정하고 형평에 맞을 것',
      '3. 변제계획 인가일 기준 채권자가 받을 총 변제액이 파산 시 배당액(청산가치)보다 적지 아니할 것 (청산가치 보장의 원칙)',
      '4. 변제계획의 수행이 실현 가능할 것',
      '5. 채권자 등의 이의가 있으면 변제기간 동안 수령할 가용소득 전부가 변제에 제공될 것 (제614조 제2항)',
    ],
  },
  {
    id: 'art593',
    no: 593,
    short: '§593 중지·금지',
    title: '제593조 (중지·금지명령)',
    summary: '개시결정 전 채권자의 강제집행 등을 막는 명령',
    details: [
      '1. 채무자에 대한 회생절차 또는 파산절차의 중지',
      '2. 강제집행·가압류·가처분의 중지 또는 금지',
      '3. 담보권 설정 및 경매의 중지 또는 금지',
      '4. 변제를 요구하거나 독촉하는 일체의 행위 금지 (전화, 방문, 우편 등)',
      '* 발령 시기는 법원·사건별로 다름 (실무 참고사항, 조문 내용 아님)',
    ],
  },
  {
    id: 'art625',
    no: 625,
    short: '§625 회생 면책효력',
    title: '제625조 (개인회생 면책결정의 효력)',
    summary: '면책이 확정되어도 책임이 남는 청구권(비면책채권)',
    details: [
      '• 면책결정은 확정된 후에 효력이 생김',
      '• 변제계획에 따라 변제한 것을 제외하고 개인회생채권의 책임이 면제됨. 다만 아래 청구권은 제외',
      '  1. 개인회생채권자목록에 기재되지 아니한 청구권',
      '  2. 제583조 제1항 제2호의 조세 등의 청구권',
      '  3. 벌금·과료·형사소송비용·추징금 및 과태료',
      '  4. 고의로 가한 불법행위로 인한 손해배상',
      '  5. 중대한 과실로 타인의 생명 또는 신체를 침해한 불법행위로 인한 손해배상',
      '  6. 채무자의 근로자의 임금·퇴직금 및 재해보상금',
      '  7. 채무자의 근로자의 임치금 및 신원보증금',
      '  8. 채무자가 양육자 또는 부양의무자로서 부담하여야 하는 비용',
      '• 면책은 보증인·공동채무자에 대한 권리와 담보에 영향을 미치지 않음',
      '※ 호 목록은 요약입니다. 개정으로 추가·변경된 호가 있을 수 있으니 원문으로 확인하세요.',
    ],
  },
  {
    id: 'art564',
    no: 564,
    short: '§564 면책불허가',
    title: '제564조 (파산 면책불허가사유)',
    summary: '개인파산에서 면책을 허가하지 않을 수 있는 사유',
    details: [
      '1. 재산을 은닉·손괴하거나 채권자에게 불이익하게 처분한 때 (사기파산죄 등)',
      '2. 파산원인의 사실을 속이고 신용거래로 재산을 취득한 때',
      '3. 과다한 낭비, 도박 그 밖의 사행행위로 현저히 재산을 감소시키거나 과대한 채무를 부담한 때',
      '4. 허위의 채권자목록을 작성하거나 법원에 허위 진술을 한 때',
      '5. 파산면책 확정일로부터 7년, 개인회생 면책 확정일로부터 5년 미경과',
      '6. 의무 위반(설명의무 위반 등)',
    ],
  },
  {
    id: 'art566',
    no: 566,
    short: '§566 파산 면책효력',
    title: '제566조 (파산 면책의 효력)',
    summary: '파산 면책 후에도 책임이 남는 청구권(비면책채권)',
    details: [
      '• 파산절차에 의한 배당을 제외하고 파산채권자에 대한 채무 전부의 책임이 면제됨. 다만 아래 청구권은 제외',
      '  1. 조세',
      '  2. 벌금·과료·형사소송비용·추징금 및 과태료',
      '  3. 고의로 가한 불법행위로 인한 손해배상',
      '  4. 중대한 과실로 타인의 생명 또는 신체를 침해한 불법행위로 인한 손해배상',
      '  5. 채무자의 근로자의 임금·퇴직금 및 재해보상금',
      '  6. 채무자의 근로자의 임치금 및 신원보증금',
      '  7. 악의로 채권자목록에 기재하지 아니한 청구권 (채권자가 파산선고를 안 때는 제외)',
      '  8. 채무자가 양육자 또는 부양의무자로서 부담하여야 하는 비용',
      '※ 호 목록은 요약입니다. 개정으로 추가·변경된 호가 있을 수 있으니 원문으로 확인하세요.',
    ],
  },
];

/** 국가법령정보센터 조문 바로가기 */
function lawUrl(no: number): string {
  return encodeURI(`https://www.law.go.kr/법령/채무자회생및파산에관한법률/제${no}조`);
}

export default function LegalArticlesTool() {
  const [selectedArt, setSelectedArt] = useState<Article>(ARTICLES[0]);
  const { copied, copy } = useCopyFeedback();

  const handleCopy = () => {
    const text = `[채무자회생법 ${selectedArt.title} — 요약]
${selectedArt.summary}
${selectedArt.details.join('\n')}
원문: ${lawUrl(selectedArt.no)}`;
    copy(text, '법률 조문 요약이 복사되었습니다.');
  };

  return (
    <div className="space-y-3 p-4 text-slate-800 text-xs">
      {/* 조문 탭 */}
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="조문 선택">
        {ARTICLES.map(art => (
          <button
            key={art.id}
            type="button"
            role="radio"
            aria-checked={selectedArt.id === art.id}
            onClick={() => setSelectedArt(art)}
            className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left truncate press-scale ${
              selectedArt.id === art.id
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {art.short}
          </button>
        ))}
      </div>

      {/* 조문 내용 */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-blue-950 font-extrabold text-sm border-b border-slate-200 pb-1.5">
          <BookOpen className="w-4 h-4 text-blue-700" aria-hidden="true" />
          <span>{selectedArt.title}</span>
        </div>
        <p className="text-xs text-blue-900 font-semibold">{selectedArt.summary}</p>

        <div className="space-y-1 pt-1 max-h-56 overflow-y-auto pr-1">
          {selectedArt.details.map((line, idx) => (
            <p key={idx} className="text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>

        <a
          href={lawUrl(selectedArt.no)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline"
        >
          국가법령정보센터에서 원문 보기
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
          <span className="sr-only">(새 창)</span>
        </a>
      </div>

      <p className="text-xs text-slate-500">조문 요약본입니다. 서면 작성·제출 전에는 원문과 최신 개정 여부를 확인하세요.</p>

      <CopyButton copied={copied} onClick={handleCopy} label="조문 요약 복사" />
    </div>
  );
}
