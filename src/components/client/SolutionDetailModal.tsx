import React, { useState } from 'react';
import {
  X, Check, AlertTriangle, Scale, Shield, Clock, Users,
  ArrowRight, HelpCircle, ChevronDown, Landmark, RefreshCw,
  FileText, Zap, BookOpen, Target
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
export type SolutionType = 'rehab' | 'bankruptcy' | 'credit' | 'representation' | 'tax';

interface SolutionDetailModalProps {
  solutionType: SolutionType;
  onClose: () => void;
  onStartDiagnosis: () => void;
  onApplyConsult: (title: string, content: string) => void;
}

interface SolutionData {
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  legalBasis: string;
  qualifications: string[];
  timeline: { title: string; desc: string }[];
  pros: string[];
  cautions: string[];
  faqs: { q: string; a: string }[];
  ctaTitle: string;
  ctaContent: string;
}

// ─── Theme Config ────────────────────────────────────────────────────────────
const themes: Record<SolutionType, {
  gradient: string;
  iconBg: string;
  iconText: string;
  highlight: string;
  border: string;
}> = {
  rehab: {
    gradient: 'from-indigo-600 to-blue-600',
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    highlight: 'bg-indigo-50 dark:bg-indigo-950/20',
    border: 'border-indigo-200 dark:border-indigo-800/50',
  },
  bankruptcy: {
    gradient: 'from-rose-600 to-pink-600',
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconText: 'text-rose-600 dark:text-rose-400',
    highlight: 'bg-rose-50 dark:bg-rose-950/20',
    border: 'border-rose-200 dark:border-rose-800/50',
  },
  credit: {
    gradient: 'from-emerald-600 to-teal-600',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    highlight: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800/50',
  },
  representation: {
    gradient: 'from-purple-600 to-violet-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconText: 'text-purple-600 dark:text-purple-400',
    highlight: 'bg-purple-50 dark:bg-purple-950/20',
    border: 'border-purple-200 dark:border-purple-800/50',
  },
  tax: {
    gradient: 'from-amber-600 to-orange-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconText: 'text-amber-600 dark:text-amber-400',
    highlight: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800/50',
  },
};

// ─── Icon Resolver ───────────────────────────────────────────────────────────
const getIcon = (type: SolutionType, className: string) => {
  switch (type) {
    case 'rehab': return <Scale className={className} />;
    case 'bankruptcy': return <AlertTriangle className={className} />;
    case 'credit': return <RefreshCw className={className} />;
    case 'representation': return <Shield className={className} />;
    case 'tax': return <Landmark className={className} />;
  }
};

// ─── Solution Data ───────────────────────────────────────────────────────────
const solutions: Record<SolutionType, SolutionData> = {
  rehab: {
    title: '개인회생',
    subtitle: '매달 소득이 있는 분들을 위해 법원이 빚을 깎아주는 제도',
    badge: '원금 최대 90% 감면',
    description: '수입이 있는 직장인이나 자영업자가 최소한의 생계비를 빼고 남은 돈을 3~5년 동안 성실히 갚아 나가면, 법원에서 남은 원금의 최대 90%와 이자를 전부 면제해 주는 든든한 법적 제도입니다. 신청서가 접수되는 즉시 법원의 금지명령을 통해 빚 독촉이나 월급 압류에서 안전하게 보호받을 수 있습니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제579조~제624조',
    qualifications: [
      '매달 일정하게 들어오는 수입(월급, 알바, 연금, 사업 수입 등)이 있으신 분',
      '담보가 없는 빚은 10억 원 이하, 담보가 있는 빚은 15억 원 이하이신 분',
      '가진 재산보다 진 빚이 더 많으신 분',
      '최근 5년 동안 개인회생으로 빚을 면제받은 적이 없으신 분',
    ],
    timeline: [
      { title: '전문가와 꼼꼼한 서류 준비', desc: '나에게 가장 유리한 상환 계획을 세웁니다. (2~4주)' },
      { title: '법원에 신청서 접수', desc: '서류를 제출하고 사건 번호를 받습니다.' },
      { title: '빚 독촉 및 압류 금지 발령', desc: '접수 후 1~2주 내에 모든 독촉과 압류가 즉시 멈춥니다.' },
      { title: '개시 결정 (심사 통과)', desc: '법원에서 매달 갚아 나갈 변제금을 최종 확인합니다.' },
      { title: '인가 결정 (최종 승인)', desc: '계획대로 상환을 시작할 수 있게 법원이 확정합니다.' },
      { title: '변제 완료 및 남은 빚 탕감', desc: '3~5년간 성실히 상환을 끝마치면 남은 빚은 전부 사라집니다.' },
    ],
    pros: [
      '원금의 최대 90%까지 법적 탕감, 이자는 100% 전액 면제됩니다.',
      '전화, 문자, 가택 방문 등 모든 빚 독촉과 압류를 법적으로 차단합니다.',
      '집이나 차 등 소중한 재산을 빼앗기지 않고 그대로 보유할 수 있습니다.',
    ],
    cautions: [
      '3~5년 동안 매달 상환금을 밀리지 않고 성실하게 납부해야 합니다.',
      '숨긴 재산이나 소득이 없도록 투명하게 신고해야 합니다.',
      '최근 6개월 사이에 갑자기 많이 빌린 대출이 있으면 탕감 비율이 낮아질 수 있습니다.',
    ],
    faqs: [
      {
        q: '회사를 다니고 있는데, 신청 사실을 회사에서 알게 되나요?',
        a: '아닙니다. 법원에서 직장으로 따로 알리지 않습니다. 압류가 진행되기 전에 미리 신청하시면 회사에서 전혀 모르게 안심하고 비공개로 진행하실 수 있습니다.',
      },
      {
        q: '신청하면 제가 살고 있는 집이나 자동차를 처분해야 하나요?',
        a: '그렇지 않습니다. 개인파산과 다르게 집이나 차 등의 재산을 유지하면서 채무를 줄일 수 있습니다. 다만, 본인이 보유한 재산의 총 가치보다는 많은 금액을 변제 기간 동안 나누어 갚아야 합니다.',
      },
      {
        q: '매달 갚아야 하는 금액(변제금)은 어떻게 정해지나요?',
        a: '월 평균 소득에서 기본 생활비(법적으로 보장되는 생계비)를 뺀 나머지 금액으로 결정됩니다. 예를 들어, 월 소득이 250만 원이고 1인 생계비가 약 130만 원이라면, 매달 약 120만 원씩 갚아 나가게 됩니다.',
      },
    ],
    ctaTitle: '개인회생 제도 상세 상담 신청',
    ctaContent: '개인회생 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n현재 정기 소득이 있으며, 채무 부담으로 인해 개인회생을 통한 법적 채무 감면을 희망합니다. 금지명령을 통한 압류 방어와 최대 탕감률을 달성할 수 있는 맞춤 변제계획 수립을 요청합니다.',
  },

  bankruptcy: {
    title: '개인파산',
    subtitle: '도저히 빚을 갚을 수 없는 상황일 때 법원이 빚을 100% 지워주는 제도',
    badge: '채무 100% 전액 탕감',
    description: '상환 능력이 완전히 없는 채무자의 재산을 공정하게 청산한 후, 남은 채무 전액을 법적으로 면책해주는 최종적 구제 제도입니다. 무직, 고령, 질병 등으로 소득 활동이 불가능하여 최저생계비 미만의 생활을 영위하는 경우, 매달 갚아 나가는 회생 대신 채무를 한 번에 전부 소멸시키는 가장 확실한 해결책입니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제305조~제566조',
    qualifications: [
      '현재 소득이 아예 없거나, 소득이 있더라도 최저 생활비 이하로 매우 적으신 분',
      '고령, 중대한 질병, 장애 등으로 인해 앞으로도 소득 활동이 불가능하신 분',
      '가진 재산이 빚보다 훨씬 적어 재산을 다 팔아도 채무를 갚기 어려운 분',
      '최근 7년 동안 파산 면책을 받은 적이 없으신 분',
    ],
    timeline: [
      { title: '서류 준비 및 심사 신청', desc: '상황을 증명할 서류를 꼼꼼하게 준비하여 제출합니다. (2~4주)' },
      { title: '법원의 파산 선고', desc: '법원에서 채무자의 지급 불능 상태를 공식 선고합니다.' },
      { title: '파산관재인(심사관) 조사', desc: '선임된 담당자가 재산과 소득 상황을 정밀하게 확인합니다.' },
      { title: '재산 정리 및 배당', desc: '보유 재산 중 법적으로 인정되는 생활 필수금을 뺀 나머지를 정리합니다.' },
      { title: '최종 면책 결정', desc: '법원 승인을 얻어 모든 채무와 이자가 100% 전액 탕감됩니다.' },
    ],
    pros: [
      '채무 원금과 이자 전체(100%)를 한 푼도 갚지 않고 전액 탕감받습니다.',
      '매달 상환해야 하는 월 변제금에 대한 스트레스가 전혀 없습니다.',
      '면책을 받은 후에는 눈치 보지 않고 자유롭게 일하고 재산을 모을 수 있습니다.',
    ],
    cautions: [
      '도박, 무리한 투기, 낭비 등으로 인해 발생한 채무는 탕감이 거절될 수 있습니다.',
      '세금, 벌금, 벌칙금, 자녀 양육비 등은 파산을 신청해도 면제되지 않고 남게 됩니다.',
      '파산 절차를 밟는 동안 일부 전문직 자격이나 특정 취업에 제한이 있을 수 있으나, 면책을 받으면 복권됩니다.',
    ],
    faqs: [
      {
        q: '파산하면 신용불량자가 되어 평생 금융거래를 못 하나요?',
        a: '전혀 그렇지 않습니다. 면책 결정을 받고 나면 파산 기록은 약 5년 뒤에 완전히 지워집니다. 이후에는 자유롭게 입출금 통장을 개설하고, 신용카드를 만들거나 대출을 받는 등 정상적인 경제 생활이 가능합니다.',
      },
      {
        q: '반드시 무직이어야만 파산 신청을 할 수 있나요?',
        a: '아닙니다. 파트타임이나 일용직으로 일하고 있더라도, 그 소득이 가족 수 기준의 최소 생계비보다 적거나 건강 등의 이유로 장기적 변제가 불가능하다면 충분히 파산 선고를 받으실 수 있습니다.',
      },
      {
        q: '내가 파산하면 우리 가족이나 아이들에게 불이익이 있나요?',
        a: '전혀 없습니다. 파산은 오직 신청인 본인에게만 적용되므로 배우자나 자녀의 신용도, 재산, 취업 등에 아무런 영향도 주지 않으니 걱정하지 않으셔도 됩니다. 다만, 가족이 보증을 섰다면 그 보증 빚은 남게 되므로 별도로 챙겨보아야 합니다.',
      },
    ],
    ctaTitle: '개인파산 자격 진단 및 면책 상담 신청',
    ctaContent: '개인파산 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n현재 소득 활동이 어려운 상태이며, 채무 전액 탕감을 위한 파산 면책 절차의 자격 여부를 긴급히 진단받고 싶습니다. 보유 재산 대비 채무 규모를 분석하여 최적의 면책 전략을 수립해 주시기 바랍니다.',
  },

  credit: {
    title: '신용회복',
    subtitle: '신용회복위원회의 도움으로 대출 이자를 줄이고 나누어 갚는 제도',
    badge: '이자 최대 100% 감면',
    description: '신용회복위원회(신복위)를 통해 금융기관 채무의 이자를 감면받고 상환 기간을 연장하는 자율적 채무 조정 제도입니다. 법원 절차 없이 금융기관 간 협약에 의해 진행되어 비교적 간편하며, 신청 다음 날부터 모든 독촉이 정지되는 즉각적 효과가 있습니다. 프리워크아웃(연체 30~89일)과 개인워크아웃(90일 이상)으로 나뉩니다.',
    legalBasis: '신용회복위원회 운영규정, 금융기관 자율 협약',
    qualifications: [
      '은행, 카드사, 캐피탈 등 제도권 금융회사에 빚이 있으신 분',
      '채무 연체 기간이 30일 이상이신 분 (연체 일수에 따라 다른 프로그램 지원)',
      '조정된 상환금을 매월 성실하게 갚아 나갈 수 있는 일정 소득이 있으신 분',
      '최근 1년 이내에 채무조정이 취소된 이력이 없으신 분',
    ],
    timeline: [
      { title: '위원회 상담 및 접수', desc: '전화(1600-5500)나 모바일 앱으로 간편하게 신청합니다.' },
      { title: '즉각적인 독촉 정지', desc: '신청서가 접수된 바로 다음 날부터 독촉이 전면 차단됩니다.' },
      { title: '채무 조정 심사 및 동의', desc: '각 금융기관들의 동의를 얻어 채무를 조정합니다. (약 1개월)' },
      { title: '조정 계약 체결 및 납부 시작', desc: '확정된 조건에 따라 최장 10년에 걸쳐 나누어 갚아 나갑니다.' },
    ],
    pros: [
      '신청서 접수 바로 다음 날부터 전화, 문자 등 모든 금융사 추심이 차단됩니다.',
      '연체 기간에 따라 이자를 전액 면제해주거나 상환 기간을 최대 10년까지 넉넉히 연장해 줍니다.',
      '법원 절차 없이 비교적 간편하게 신청 가능하여 신속합니다.',
    ],
    cautions: [
      '개인 간의 빚, 사채, 보증이 서지 않은 일부 대부업 빚은 조정 대상에서 제외될 수 있습니다.',
      '원금을 크게 깎아주는 탕감율은 개인회생에 비해 상대적으로 낮을 수 있습니다.',
      '약속한 분할 상환금을 3회 이상 밀리면 조정 계약이 해지되어 원래 채무로 되돌아갈 수 있습니다.',
    ],
    faqs: [
      {
        q: '사채나 일가친척에게 빌린 개인 빚도 조율이 되나요?',
        a: '아쉽게도 신용회복위원회의 워크아웃은 협약이 체결된 금융기관 채무만 조율할 수 있습니다. 개인 사채나 일반 지인 빚은 포함되지 않으므로, 이러한 빚이 많다면 개인회생이나 파산 제도를 알아보셔야 합니다.',
      },
      {
        q: '신용등급에는 어떤 영향을 미치나요?',
        a: '워크아웃을 신청하면 신용정보기관에 채무조정 중임이 등록됩니다. 하지만 연체를 계속 방치하는 것보다 채무조정을 통해 성실히 상환하는 것이 신용점수를 가장 빠르고 안전하게 회복시키는 길입니다.',
      },
      {
        q: '상환하는 중에 사정이 어려워져 못 내면 어떻게 되나요?',
        a: '납부금을 연체하게 되면 채무조정이 효력을 잃고 빚 독촉이 재개될 수 있습니다. 만약 불가피한 사정이 생겼을 경우, 신용회복위원회에 상환 유예를 신청하여 일정 기간 납부를 미룰 수 있으므로 미리 상담받으시는 것이 좋습니다.',
      },
    ],
    ctaTitle: '신용회복(워크아웃) 채무 조정 상담 신청',
    ctaContent: '신용회복 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n금융기관 채무에 대해 이자 감면 및 상환 기간 연장을 희망하며, 워크아웃 신청 자격 여부와 예상 조정 조건을 확인하고자 합니다. 개인회생과 비교하여 저에게 더 유리한 제도가 무엇인지도 함께 안내 부탁드립니다.',
  },

  representation: {
    title: '채무자대리',
    subtitle: '대부업이나 사채 업자의 무서운 독촉 전화를 변호사가 대신 받아주는 제도',
    badge: '추심 즉시 법적 차단',
    description: '변호사를 채무자대리인으로 선임하여, 채권자의 모든 추심 행위를 법적으로 차단하고 변호사가 채권자와의 협상을 전담하는 제도입니다. 위임장 1장으로 즉시 발동되며, 대리인 선임 통보 후 채권자가 채무자 본인에게 직접 연락하는 것 자체가 불법이 됩니다. 극심한 추심 스트레스에서 즉시 벗어날 수 있는 가장 빠른 조치입니다.',
    legalBasis: '대부업법 제9조의2, 채권의 공정한 추심에 관한 법률 제8조',
    qualifications: [
      '대부업체, 미등록 대부업(일수, 사채 등)으로부터 빌린 돈이 있으신 분',
      '극심한 추심 행위(폭언, 협박, 야간 연락 등)로 정상적인 생활이 불가능하신 분',
      '빚의 액수나 개인 소득 요건 등과 무관하게 누구나 신청 가능',
      '개인회생이나 파산 신청을 준비하며 임시로 독촉을 차단하고 싶으신 분',
    ],
    timeline: [
      { title: '변호사와 긴급 전화 상담', desc: '피해 중인 불법 추심 현황과 채무 상황을 상담합니다.' },
      { title: '대리인 선임 위임장 작성', desc: '변호사 대리 선임을 확정하는 위임장을 간단히 작성합니다.' },
      { title: '대리인 선임 통보서 발송', desc: '대부업체/채권자들에게 내용증명을 보내 선임 사실을 공식 통보합니다.' },
      { title: '직접 연락 및 방문 즉시 중단', desc: '통보서 도달 즉시 채무자 본인에게 직접적인 접촉을 할 수 없게 됩니다.' },
      { title: '변호사가 채권 조율 진행', desc: '이후 모든 빚 관련 조율과 협상은 변호사가 전담하여 소통합니다.' },
    ],
    pros: [
      '전화, 문자, 집/회사로 찾아오는 모든 형태의 직접 독촉을 즉시 차단합니다.',
      '불법 추심(야간 연락, 가족 협박 등)에 대한 형사고소 및 손해배상 청구가 수월합니다.',
      '극심한 심리적 압박에서 즉시 해방되어 일상생활을 정상적으로 회복할 수 있습니다.',
    ],
    cautions: [
      '이 제도는 독촉을 변호사가 대신 받으며 막아주는 것이며, 채무 원금 자체가 깎이거나 없어지는 것은 아닙니다.',
      '결과적으로 빚을 청산하려면 대리인 선임 기간 동안 개인회생이나 파산 등의 근본적인 법적 면책 절차를 준비해야 합니다.',
      '시중 1금융권 은행이나 카드사 채무에 대해서는 대부업법상 대리인 제도의 적용이 제한될 수 있습니다.',
    ],
    faqs: [
      {
        q: '대리인을 선임하면 빚이 없어지나요?',
        a: '채무자대리는 추심 행위를 차단하고 협상을 대리하는 제도이며, 채무 자체를 소멸시키지는 않습니다. 채무 감면을 위해서는 개인회생이나 파산 등 별도의 법적 절차를 병행하여 근본적으로 해결해야 합니다.',
      },
      {
        q: '사채업자가 대리인 선임을 무시하고 계속 연락하면?',
        a: '대리인 선임 통보 후에도 직접 추심을 계속하는 것은 채권추심법 위반으로 형사처벌(2년 이하 징역 또는 2천만원 이하 벌금) 대상입니다. 즉시 증거(녹취, 문자 캡처 등)를 확보하여 형사고소를 진행하며, 손해배상까지 청구할 수 있습니다.',
      },
      {
        q: '비용은 얼마나 드나요?',
        a: '사안의 복잡도와 채권자 수에 따라 달라지며, 보통 초기 착수금과 월 관리비 형태로 책정됩니다. 본 플랫폼을 통한 초기 상담은 무료이며, 상담 시 정확한 예상 비용을 투명하게 안내받으실 수 있습니다.',
      },
    ],
    ctaTitle: '채무자대리인 선임 및 독촉 차단 긴급 상담',
    ctaContent: '채무자대리 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n현재 대부업체/사채업자의 극심한 추심에 시달리고 있어, 변호사 대리인 선임을 통한 즉각적인 독촉 차단과 향후 채무 해결 전략(회생/파산 병행) 수립을 긴급히 요청합니다.',
  },

  tax: {
    title: '세금체납 관리',
    subtitle: '국세나 지방세가 밀려 압류 등의 곤경에 처했을 때 해결을 도와주는 절차',
    badge: '소멸시효 완성 시 영구 면제',
    description: '국세·지방세 체납에 대해 징수권 소멸시효(5년/10년) 완성 여부를 정밀 분석하고, 불법·부당 압류 해제 및 조세 고충 민원을 통해 세금 채무를 구제받는 전문 절차입니다. 세금 채무는 개인회생으로 감면 불가하고 파산으로도 면책되지 않는 특수 채권이므로, 소멸시효 및 압류 적법성 분석이라는 별도의 전문적 접근이 필수적입니다.',
    legalBasis: '국세기본법 제27조(소멸시효), 지방세징수법, 국세징수법',
    qualifications: [
      '종합소득세, 부가가치세, 지방세 등의 체납으로 고민하고 계신 분',
      '세금이 체납된 후 5년(5억 원 미만) 또는 10년(5억 원 이상) 동안 압류가 없었거나 시효 연장 사유를 분석하고 싶으신 분',
      '예금 잔액 185만 원 이하의 소액 예금이 부당하게 압류되어 당장 생활이 곤란하신 분',
      '과도하거나 위법한 체납 처분으로 생업이나 일상생활에 심한 피해를 받고 계신 분',
    ],
    timeline: [
      { title: '체납 및 압류 내역 전수 조사', desc: '홈택스 등에서 세금 체납 역사와 압류 기록을 면밀히 찾아냅니다.' },
      { title: '소멸시효 및 압류 적법성 분석', desc: '시효가 중단되지 않고 흐르고 있는지, 압류에 절차적 하자가 없는지 점검합니다.' },
      { title: '행정 서류 및 고충 민원 신청', desc: '문제가 발견되면 관할 세무서나 행정기관을 상대로 이의제기를 진행합니다.' },
      { title: '체납 세금 면제 및 압류 해제', desc: '시효 완성이 확정되거나 위법 압류가 풀리면 세금 빚이 소멸되고 정상 금융거래가 가능해집니다.' },
    ],
    pros: [
      '소멸시효 완성 시 세금 채무 영구 면제 — 원금·가산세 전액 소멸',
      '불법 또는 부당한 계좌 압류 해제 및 압류금 반환 청구 가능',
      '개인회생·파산과 별도로 독립 진행 가능하여 효율적입니다.',
    ],
    cautions: [
      '세금은 일반 빚과 달리 개인파산이나 일반 회생 절차를 통해서도 면책되거나 깎이지 않는 완강한 채권입니다.',
      '세무서에서 적법하게 압류를 걸어 두었거나 주기적으로 독촉장을 정상적으로 송달했다면 시효가 일시 중단될 수 있습니다.',
      '전문적인 검토 없이 무작정 버티기만 하면 시효가 계속 연장되므로 반드시 분석을 거쳐야 합니다.',
    ],
    faqs: [
      {
        q: '세금도 시효로 소멸되나요?',
        a: '네. 국세는 5년(5억 원 이상 10년), 지방세는 5년(1억 원 이상 10년)의 징수권 소멸시효가 적용됩니다. 다만 압류, 독촉, 납부 등의 사유로 시효가 중단·정지될 수 있어, 개별 체납 건별로 전문가의 정밀 분석이 필수적입니다.',
      },
      {
        q: '압류된 돈은 돌려받을 수 있나요?',
        a: '소액금융재산(잔액 185만원 이하의 예금)에 대한 압류는 위법할 수 있으며, 이 경우 압류 해제 및 반환 청구가 가능합니다. 또한 소멸시효가 이미 완성된 이후의 압류금도 부당이득으로서 반환 대상이 됩니다.',
      },
      {
        q: '개인회생과 동시에 진행할 수 있나요?',
        a: '세금 채무는 개인회생에서 "우선권 있는 채권"으로 분류되어 감면 대상이 아닙니다. 따라서 세금 체납 해결은 개인회생과 별도의 독립적 절차로 동시 병행하는 것이 가장 효율적인 전략입니다.',
      },
    ],
    ctaTitle: '세금체납 소멸시효 진단 및 압류 해제 상담',
    ctaContent: '세금체납 관리 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n국세/지방세 체납으로 인한 계좌 압류를 겪고 있으며, 징수권 소멸시효 완성 여부 및 압류 적법성에 대한 전문적인 검토를 요청합니다. 체납 면제 및 압류 해제 가능성을 정밀 진단해 주시기 바랍니다.',
  },
};

// ─── Comparison Data ─────────────────────────────────────────────────────────
const comparison = {
  labels: ['감면 범위', '소요 기간', '독촉 정지', '소득 요건', '재산 보유', '적합 대상'],
  types: ['rehab', 'bankruptcy', 'credit', 'representation', 'tax'] as SolutionType[],
  titles: ['개인회생', '개인파산', '신용회복', '채무자대리', '세금체납'],
  data: [
    ['원금 최대 90%', '전액 100%', '이자 최대 100%', '감면 아님', '시효 시 전액'],
    ['3~5년 변제', '6~12개월', '최장 10년', '즉시', '사안별 상이'],
    ['금지명령 즉시', '파산선고 시', '신청 다음 날', '선임 즉시', '해당 없음'],
    ['정기소득 필수', '소득 없어야', '최저생계비↑', '무관', '무관'],
    ['보유 가능', '청산 필요', '보유 가능', '영향 없음', '영향 없음'],
    ['직장인·사업자', '무직·고령·질병', '금융기관 채무자', '독촉 피해자', '세금 체납자'],
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function SolutionDetailModal({
  solutionType,
  onClose,
  onStartDiagnosis,
  onApplyConsult,
}: SolutionDetailModalProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const data = solutions[solutionType];
  const theme = themes[solutionType];
  const typeIdx = comparison.types.indexOf(solutionType);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className={`relative p-5 md:p-7 bg-gradient-to-r ${theme.gradient}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shrink-0">
              {getIcon(solutionType, 'w-6 h-6 md:w-7 md:h-7 text-white')}
            </div>
            <div>
              <span className="text-white/90 text-[10px] md:text-[11px] font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
                {data.badge}
              </span>
              <h3 className="text-lg md:text-xl font-bold text-white mt-1">
                {data.title} 전문 가이드
              </h3>
              <p className="text-white/70 text-[11px] md:text-xs mt-0.5">{data.subtitle}</p>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className="p-5 md:p-7 space-y-6 md:space-y-8 overflow-y-auto text-left flex-1">
          {/* Section 1: 제도 개요 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <BookOpen className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">제도 개요</h4>
            </div>
            <div className={`p-4 md:p-5 rounded-2xl ${theme.highlight} border ${theme.border}`}>
              <p className="text-xs md:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {data.description}
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <FileText className={`w-3.5 h-3.5 ${theme.iconText} shrink-0`} />
                <span className="text-[10px] md:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  법적 근거: {data.legalBasis}
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: 신청 자격 체크리스트 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <Target className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">신청 자격 체크리스트</h4>
            </div>
            <div className="space-y-2.5">
              {data.qualifications.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 md:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mt-0.5 shrink-0">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs md:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {q}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3: 절차 안내 타임라인 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <Clock className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">절차 안내 타임라인</h4>
            </div>
            <div className="relative ml-3 pl-6 border-l-2 border-slate-200 dark:border-slate-700/60 space-y-0">
              {data.timeline.map((step, i) => (
                <div key={i} className="relative pb-5 last:pb-0">
                  {/* Step dot */}
                  <div
                    className={`absolute -left-[calc(0.375rem+1.5px+1px)] top-[2px] w-3 h-3 rounded-full bg-gradient-to-br ${theme.gradient} ring-[3px] ring-white dark:ring-slate-900`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black ${theme.iconText} opacity-70`}>
                        STEP {i + 1}
                      </span>
                    </div>
                    <h5 className="text-xs md:text-[13px] font-semibold text-slate-800 dark:text-white mt-0.5">
                      {step.title}
                    </h5>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: 장점 & 주의사항 */}
          <section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pros */}
              <div className="p-4 md:p-5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20">
                <h5 className="font-bold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-3">
                  <Zap className="w-3.5 h-3.5" />
                  핵심 장점
                </h5>
                <ul className="space-y-2.5">
                  {data.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cautions */}
              <div className="p-4 md:p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20">
                <h5 className="font-bold text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  주의사항
                </h5>
                <ul className="space-y-2.5">
                  {data.cautions.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {c}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5: 제도 비교 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <Scale className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">다른 제도와 비교</h4>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 -mx-1">
              <table className="w-full text-[11px] md:text-xs min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80">
                    <th className="text-left p-2.5 md:p-3 font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap sticky left-0 bg-slate-50 dark:bg-slate-800/80 z-10">
                      항목
                    </th>
                    {comparison.titles.map((title, i) => (
                      <th
                        key={i}
                        className={`p-2.5 md:p-3 font-bold text-center whitespace-nowrap ${
                          i === typeIdx
                            ? `${theme.highlight} ${theme.iconText}`
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {title}
                        {i === typeIdx && (
                          <span className="block text-[9px] font-semibold mt-0.5 opacity-70">
                            ◄ 현재 보기
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.labels.map((label, ri) => (
                    <tr
                      key={ri}
                      className="border-t border-slate-100 dark:border-slate-800"
                    >
                      <td className="p-2.5 md:p-3 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-900 z-10">
                        {label}
                      </td>
                      {comparison.data[ri].map((val, ci) => (
                        <td
                          key={ci}
                          className={`p-2.5 md:p-3 text-center font-medium whitespace-nowrap ${
                            ci === typeIdx
                              ? `${theme.highlight} font-bold ${theme.iconText}`
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 6: FAQ */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <HelpCircle className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-white">자주 묻는 질문</h4>
            </div>
            <div className="space-y-2">
              {data.faqs.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-3.5 md:p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-xs md:text-[13px] font-semibold text-slate-700 dark:text-slate-200 pr-4">
                      Q. {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        openFaq === i ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-3.5 md:px-4 pb-3.5 md:pb-4">
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-2 font-medium">
                          A. {faq.a}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Real-time matching indicator */}
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              실시간 도산 전문 변호사 매칭 대기 중
            </span>
            <span className={`${theme.iconText}`}>안심 100% 비공개 보장</span>
          </div>
        </div>

        {/* ── Footer CTA ────────────────────────────────────────────── */}
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            onClick={() => {
              onClose();
              onStartDiagnosis();
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            자가진단 시작하기
          </button>
          <button
            onClick={() => onApplyConsult(data.ctaTitle, data.ctaContent)}
            className={`w-full sm:w-auto flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r ${theme.gradient} hover:opacity-90 text-white rounded-2xl text-xs font-bold shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
          >
            이 제도로 상담 신청
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
