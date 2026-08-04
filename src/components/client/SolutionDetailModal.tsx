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
    iconText: 'text-blue-600 dark:text-blue-400',
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
    subtitle: '계속적·반복적 수입 가능성이 있는 개인채무자가 법원에 신청하는 절차',
    badge: '제도 일반정보',
    description: '개인회생은 계속적 또는 반복적으로 수입을 얻을 가능성이 있는 개인채무자가 법원에 신청하는 절차입니다. 법원은 신청인의 소득, 재산, 부양가족, 채무의 종류와 금액, 채무 발생 경위 및 제출자료 등을 심사합니다. 법원이 변제계획을 인가하고 신청인이 계획을 이행한 경우, 법이 정한 요건에 따라 남은 채무에 대한 면책 여부가 결정될 수 있습니다. 구체적인 신청요건, 변제기간, 변제금 및 면책범위는 사건별로 달라질 수 있습니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제579조~제624조',
    qualifications: [
      '현재 소득의 종류와 수입이 계속될 가능성',
      '전체 채무의 종류와 금액 (담보채무·무담보채무 구분)',
      '보유재산과 처분 이력, 부양가족 및 생활비',
      '과거 개인회생·파산·면책 이력, 최근 금융거래 내역',
    ],
    timeline: [
      { title: '자료 준비 및 신청서 작성', desc: '신청에 필요한 자료와 변제계획안을 준비합니다. 기간은 자료 상황에 따라 달라질 수 있습니다.' },
      { title: '법원에 신청서 접수', desc: '서류를 제출하고 사건 번호를 받습니다.' },
      { title: '금지·중지명령 신청 및 법원 심사', desc: '필요한 경우 금지명령 또는 중지명령을 함께 신청할 수 있습니다. 발령 여부와 시기, 적용 대상은 법원이 개별적으로 결정합니다.' },
      { title: '절차 개시 여부 결정', desc: '법원이 제출자료와 신청요건 등을 검토하여 절차 개시 여부를 결정합니다.' },
      { title: '변제계획 인가 여부 결정', desc: '법원이 관계 법령과 사건자료를 검토하여 변제계획의 인가 여부를 결정합니다.' },
      { title: '변제계획 수행 및 면책 여부 결정', desc: '인가된 변제계획을 수행한 후 법원의 면책결정이 확정되면 법이 정한 범위에서 남은 채무에 대한 책임이 면제될 수 있습니다. 세금, 벌금 등 면책되지 않는 항목이 있을 수 있습니다.' },
    ],
    pros: [
      '법원이 인가한 변제계획에 따라 채무를 조정하며, 면책 범위는 개인 상황에 따라 달라집니다.',
      '개인회생 신청과 함께 금지명령·중지명령을 신청할 수 있으며, 발령 여부는 법원이 결정합니다.',
      '개인파산과 달리 보유 재산을 유지하면서 절차를 진행할 수 있습니다. 다만 재산가치가 변제금에 반영됩니다.',
    ],
    cautions: [
      '3~5년 동안 매달 상환금을 밀리지 않고 성실하게 납부해야 합니다.',
      '숨긴 재산이나 소득이 없도록 투명하게 신고해야 합니다.',
      '최근 대출이나 카드 사용 내역이 법원 심사에 영향을 미칠 수 있습니다.',
    ],
    faqs: [
      {
        q: '회사를 다니고 있는데, 신청 사실을 회사에서 알게 되나요?',
        a: '아닙니다. 법원에서 직장으로 따로 알리지 않습니다. 개인회생 신청 사실이 직장에 직접 통보되지는 않습니다. 다만 급여 압류가 진행된 경우 등 상황에 따라 달라질 수 있습니다.',
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
    ctaTitle: '개인회생 제도 관련 상담 문의',
    ctaContent: '개인회생 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  bankruptcy: {
    title: '개인파산',
    subtitle: '채무자의 재산·소득·채무상태 등을 법원이 심사하는 절차',
    badge: '파산선고 및 면책 심사 절차',
    description: '개인파산은 채무자가 지급불능 상태에 있는 경우 법원에 신청하는 절차입니다. 법원이 파산선고를 하고, 이후 별도의 면책결정 여부를 심사합니다. 파산선고와 면책결정은 서로 구분되며, 면책 여부와 범위는 채무 발생 경위, 재산 상태 등에 대한 법원의 심사에 따라 결정됩니다. 세금, 벌금, 양육비 등 면책되지 않는 채무가 있을 수 있습니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제305조~제566조',
    qualifications: [
      '현재 소득 상태와 향후 소득 가능성',
      '채무의 종류, 금액 및 발생 경위',
      '보유재산의 종류와 가액',
      '과거 파산·면책 이력 및 면책불허가 사유 해당 여부',
    ],
    timeline: [
      { title: '서류 준비 및 심사 신청', desc: '신청에 필요한 자료를 준비합니다. 기간은 자료 상황에 따라 달라질 수 있습니다.' },
      { title: '법원의 파산 선고', desc: '법원이 채무자의 지급불능 상태 여부를 심사하여 파산선고 여부를 결정합니다.' },
      { title: '파산관재인(심사관) 조사', desc: '법원이 선임한 파산관재인이 재산과 채무 상황을 조사합니다.' },
      { title: '재산 정리 및 배당', desc: '법이 정한 자유재산을 제외한 재산을 환가하여 채권자에게 배당합니다.' },
      { title: '최종 면책 결정', desc: '법원이 면책 여부를 결정합니다. 면책불허가 사유가 있는 경우 면책이 거부될 수 있으며, 세금 등 비면책채권이 있을 수 있습니다.' },
    ],
    pros: [
      '법원의 면책결정이 확정되면 법이 정한 범위에서 채무에 대한 책임이 면제될 수 있습니다.',
      '개인회생과 달리 매달 변제금을 납부하는 절차가 없습니다.',
      '면책결정 확정 후 복권되면 직업 제한 등이 해소됩니다.',
    ],
    cautions: [
      '도박, 무리한 투기, 낭비 등으로 인해 발생한 채무는 탕감이 거절될 수 있습니다.',
      '세금, 벌금, 벌칙금, 자녀 양육비 등은 파산을 신청해도 면제되지 않고 남게 됩니다.',
      '파산 절차를 밟는 동안 일부 전문직 자격이나 특정 취업에 제한이 있을 수 있으나, 면책을 받으면 복권됩니다.',
    ],
    faqs: [
      {
        q: '파산하면 신용불량자가 되어 평생 금융거래를 못 하나요?',
        a: '전혀 그렇지 않습니다. 면책 결정을 받고 나면 면책결정 확정 후 일정 기간이 경과하면 신용정보 등록이 해제됩니다. 구체적인 기간과 금융거래 가능 범위는 개별 상황에 따라 다를 수 있습니다.',
      },
      {
        q: '반드시 무직이어야만 파산 신청을 할 수 있나요?',
        a: '아닙니다. 파트타임이나 일용직으로 일하고 있더라도, 소득이 있더라도 지급불능 상태에 해당하는 경우 파산 신청이 가능할 수 있습니다. 구체적인 판단은 법원의 심사에 따릅니다.',
      },
      {
        q: '내가 파산하면 우리 가족이나 아이들에게 불이익이 있나요?',
        a: '전혀 없습니다. 파산은 오직 신청인 본인에게만 적용되므로 배우자나 자녀의 신용도, 재산, 취업 등에 아무런 영향도 주지 않으니 걱정하지 않으셔도 됩니다. 다만, 가족이 보증을 섰다면 그 보증 빚은 남게 되므로 별도로 챙겨보아야 합니다.',
      },
    ],
    ctaTitle: '개인파산 제도 관련 상담 문의',
    ctaContent: '개인파산 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  credit: {
    title: '신용회복',
    subtitle: '신용회복위원회가 운영하는 채무조정 제도',
    badge: '협약 금융회사 채무조정',
    description: '신용회복위원회를 통해 협약 금융기관 채무에 대한 이자 조정, 상환 기간 변경 등을 신청할 수 있는 제도입니다. 법원 절차 없이 금융기관 간 협약에 따라 진행됩니다. 프리워크아웃(연체 30~89일)과 개인워크아웃(90일 이상)으로 나뉘며, 지원 조건과 조정 내용은 채무 상태에 따라 달라질 수 있습니다.',
    legalBasis: '신용회복위원회 운영규정, 금융기관 자율 협약',
    qualifications: [
      '협약 금융기관에 대한 채무 여부',
      '연체 기간 및 연체 상태',
      '소득 상태 및 상환 가능 여부',
      '과거 채무조정 이력',
    ],
    timeline: [
      { title: '위원회 상담 및 접수', desc: '전화(1600-5500)나 모바일 앱으로 간편하게 신청합니다.' },
      { title: '추심 중지 요청', desc: '신청이 접수되면 협약 금융기관에 추심 중지가 요청됩니다. 적용 범위는 협약 기관에 따라 다를 수 있습니다.' },
      { title: '채무 조정 심사 및 동의', desc: '각 금융기관의 동의를 얻어 채무 조정 내용을 결정합니다. 소요 기간은 사안에 따라 다릅니다.' },
      { title: '조정 계약 체결 및 납부 시작', desc: '확정된 조건에 따라 분할 상환합니다. 상환 기간은 조정 결과에 따라 달라집니다.' },
    ],
    pros: [
      '신청이 접수되면 협약 금융기관에 추심 중지가 요청됩니다.',
      '연체 기간과 채무 상태에 따라 이자 조정, 상환 기간 변경 등의 조정이 이루어질 수 있습니다.',
      '법원 절차 없이 신용회복위원회를 통해 신청할 수 있습니다.',
    ],
    cautions: [
      '개인 간의 빚, 사채, 보증이 서지 않은 일부 대부업 빚은 조정 대상에서 제외될 수 있습니다.',
      '원금 감면 범위는 개인회생에 비해 상대적으로 제한적일 수 있습니다.',
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
    ctaTitle: '신용회복(워크아웃) 관련 상담 문의',
    ctaContent: '신용회복 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  representation: {
    title: '채무자대리',
    subtitle: '채권추심 대응과 관련된 제도',
    badge: '추심 대응 관련 제도',
    description: '변호사를 채무자대리인으로 선임하여 채권자와의 연락 및 협상을 대리하는 제도입니다. 대리인 선임 통보 후 채권자의 직접 추심 행위는 법률상 제한됩니다. 적용 대상과 범위, 비용 등은 채권자 유형과 개별 사안에 따라 달라질 수 있습니다.',
    legalBasis: '대부업법 제9조의2, 채권의 공정한 추심에 관한 법률 제8조',
    qualifications: [
      '채권자의 종류 (대부업체, 미등록 대부업 등)',
      '추심 행위의 내용과 증거자료 (문자, 녹취 등)',
      '채무의 종류와 금액',
      '불법추심 여부 확인 (야간추심, 제3자 통보, 폭언 등)',
    ],
    timeline: [
      { title: '전문가 상담', desc: '추심 현황과 채무 상황을 확인합니다.' },
      { title: '대리인 선임 위임장 작성', desc: '대리인 선임을 위한 위임장을 작성합니다.' },
      { title: '대리인 선임 통보서 발송', desc: '채권자에게 대리인 선임 사실을 통보합니다.' },
      { title: '직접 추심 행위 제한', desc: '대리인 선임 통보 후 채권자의 직접 추심 행위가 법률상 제한됩니다. 적용 범위는 채권자 유형에 따라 다를 수 있습니다.' },
      { title: '변호사가 채권 조율 진행', desc: '대리인이 채권자와의 연락 및 협상을 대리합니다.' },
    ],
    pros: [
      '채무자대리인이 선임되면 채권자는 채무자에게 직접 연락할 수 없게 됩니다.',
      '불법 추심이 있는 경우 관련 법률에 따라 신고 또는 법적 대응을 검토할 수 있습니다.',
      '채권자와의 직접 연락 부담을 줄일 수 있습니다.',
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
        a: '사안의 복잡도와 채권자 수에 따라 달라지며, 보통 초기 착수금과 월 관리비 형태로 책정됩니다. 구체적인 비용은 전문가에게 직접 확인하시기 바랍니다.',
      },
    ],
    ctaTitle: '채무자대리인 제도 관련 상담 문의',
    ctaContent: '채무자대리인 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },

  tax: {
    title: '세금체납 관리',
    subtitle: '체납처분 및 납부 지원제도 일반정보',
    badge: '체납처분 및 납부 관련 정보',
    description: '세금 체납에는 납부유예, 분할납부, 징수권 소멸시효 등 여러 제도가 있습니다. 세금 채무는 개인회생이나 파산 절차에서 일반 채무와 다르게 취급됩니다. 체납 세목, 금액, 압류 진행 상태 등에 따라 확인해야 할 사항이 달라질 수 있으며, 구체적인 판단은 전문가 상담이 필요합니다.',
    legalBasis: '국세기본법 제27조(소멸시효), 지방세징수법, 국세징수법',
    qualifications: [
      '체납 세목의 종류와 금액 (국세·지방세 구분)',
      '체납 기간 및 그간의 독촉·압류 이력',
      '현재 압류 상태 및 압류 대상 재산',
      '사업자등록 이력과 폐업 시기, 기타 채무 현황',
    ],
    timeline: [
      { title: '체납 및 압류 내역 확인', desc: '홈택스 등을 통해 체납 세목, 금액, 압류 기록 등을 확인합니다.' },
      { title: '소멸시효 및 압류 적법성 분석', desc: '징수권 소멸시효의 진행 여부와 압류의 적법성을 확인합니다. 구체적인 판단은 전문가 검토가 필요합니다.' },
      { title: '행정 서류 및 고충 민원 신청', desc: '필요한 경우 관할 세무서에 이의신청, 고충 민원 등을 제기할 수 있습니다.' },
      { title: '결과 확인', desc: '절차의 결과는 사안에 따라 달라지며, 관할 기관의 결정에 따릅니다.' },
    ],
    pros: [
      '관계 법령에 따라 징수권 소멸시효가 완성된 경우 세금 채무가 소멸될 수 있습니다.',
      '부당한 압류에 대해서는 관련 법률에 따라 해제를 요청할 수 있습니다.',
      '개인회생·파산 절차와 별도로 진행할 수 있습니다.',
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
    ctaTitle: '세금 체납 관련 상담 문의',
    ctaContent: '세금 체납 관련 제도에 대한 일반정보를 확인한 후 상담을 문의합니다.',
  },
};

// ─── Comparison Data ─────────────────────────────────────────────────────────
const comparison = {
  labels: ['감면 범위', '소요 기간', '독촉 정지', '소득 요건', '재산 보유', '주요 대상'],
  types: ['rehab', 'bankruptcy', 'credit', 'representation', 'tax'] as SolutionType[],
  titles: ['개인회생', '개인파산', '신용회복', '채무자대리', '세금체납'],
  data: [
    ['법원 결정에 따름', '전액 100%', '법원 결정에 따름', '감면 아님', '시효 시 전액'],
    ['3~5년 변제', '6~12개월', '최장 10년', '즉시', '사안별 상이'],
    ['법원 결정 시', '파산선고 시', '접수 후 요청', '통보 후', '해당 없음'],
    ['정기소득 필요', '지급불능 상태', '일정소득 필요', '무관', '무관'],
    ['보유 가능', '청산 필요', '보유 가능', '영향 없음', '영향 없음'],
    ['개인채무자', '지급불능 채무자', '협약기관 채무자', '추심 대응', '세금 체납'],
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
              <span className="text-white/90 text-xs md:text-sm font-semibold bg-white/20 px-2.5 py-0.5 rounded-full">
                {data.badge}
              </span>
              <h3 className="text-xl md:text-2xl font-bold text-white mt-1">
                {data.title} 제도 알아보기
              </h3>
              <p className="text-white/70 text-sm md:text-sm mt-0.5">{data.subtitle}</p>
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
              <h4 className="font-bold text-base text-slate-900 dark:text-white">제도 개요</h4>
            </div>
            <div className={`p-4 md:p-5 rounded-2xl ${theme.highlight} border ${theme.border}`}>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {data.description}
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <FileText className={`w-3.5 h-3.5 ${theme.iconText} shrink-0`} />
                <span className="text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                  법적 근거: {data.legalBasis}
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: 법률검토 시 일반적으로 확인되는 정보 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${theme.iconBg} flex items-center justify-center`}>
                <Target className={`w-3.5 h-3.5 ${theme.iconText}`} />
              </div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">신청 자격 체크리스트</h4>
            </div>
            <div className="space-y-2.5">
              {data.qualifications.map((q, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 md:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
                >
                  <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-0.5 shrink-0">
                    <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
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
              <h4 className="font-bold text-base text-slate-900 dark:text-white">절차 안내 타임라인</h4>
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
                      <span className={`text-[12px] font-black ${theme.iconText} opacity-70`}>
                        STEP {i + 1}
                      </span>
                    </div>
                    <h5 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                      {step.title}
                    </h5>
                    <p className="text-sm text-slate-500 dark:text-slate-500 mt-0.5 font-medium">
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
                <h5 className="font-bold text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-3">
                  <Zap className="w-3.5 h-3.5" />
                  제도의 일반적 특징
                </h5>
                <ul className="space-y-2.5">
                  {data.pros.map((p, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-sm md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cautions */}
              <div className="p-4 md:p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/20">
                <h5 className="font-bold text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  주의사항
                </h5>
                <ul className="space-y-2.5">
                  {data.cautions.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-sm md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
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
              <h4 className="font-bold text-base text-slate-900 dark:text-white">다른 제도와 비교</h4>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 -mx-1">
              <table className="w-full text-sm md:text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80">
                    <th className="text-left p-2.5 md:p-3 font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap sticky left-0 bg-slate-50 dark:bg-slate-800/80 z-10">
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
                          <span className="block text-[11px] font-semibold mt-0.5 opacity-70">
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
                      <td className="p-2.5 md:p-3 font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap sticky left-0 bg-white dark:bg-slate-900 z-10">
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
              <h4 className="font-bold text-base text-slate-900 dark:text-white">자주 묻는 질문</h4>
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
                    <span className="text-sm md:text-base font-semibold text-slate-700 dark:text-slate-200 pr-4">
                      Q. {faq.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                        openFaq === i ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-3.5 md:px-4 pb-3.5 md:pb-4">
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-sm md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-2 font-medium">
                          A. {faq.a}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>


        </div>

        {/* ── Footer CTA ────────────────────────────────────────────── */}
        <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            onClick={() => {
              onClose();
              onStartDiagnosis();
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <HelpCircle className="w-4 h-4" />
            내 채무현황 정리하기
          </button>
          <button
            onClick={() => onApplyConsult(data.ctaTitle, data.ctaContent)}
            className={`w-full sm:w-auto flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r ${theme.gradient} hover:opacity-90 text-white rounded-2xl text-sm font-bold shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
          >
            전문가 정보 직접 검색하기
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
