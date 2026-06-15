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
    subtitle: '소득이 있고 변제 능력이 있는 자를 위한 법적 채무 감면 제도',
    badge: '원금 최대 90% 감면',
    description: '법원 주도의 법적 채무 조정 절차입니다. 정기소득이 있는 채무자가 법원이 인가한 변제계획에 따라 3~5년간 일부 금액만 상환하면 나머지 채무가 법적으로 면책됩니다. 금지명령을 통해 접수 즉시 모든 채권 독촉과 급여 압류를 중단시킬 수 있어, 생활 안정을 되찾으면서 채무를 체계적으로 해결하는 가장 효과적인 방법입니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제579조~제624조',
    qualifications: [
      '정기적 수입이 있을 것 (급여, 사업소득, 연금, 프리랜서 수입 등)',
      '무담보채무 10억 원 이하 / 담보채무 15억 원 이하',
      '최근 5년 내 개인회생 면책을 받은 이력이 없을 것',
      '채무를 갚을 수 없는 우려가 있을 것 (지급불능 우려 상태)',
    ],
    timeline: [
      { title: '서류 준비 및 법률 상담', desc: '2~4주 소요' },
      { title: '법원 접수', desc: '신청서, 채권자 목록, 재산목록 제출' },
      { title: '개시결정', desc: '약 1개월 소요' },
      { title: '금지/중지명령 발령', desc: '독촉·압류 즉시 중단' },
      { title: '변제계획안 작성 및 제출', desc: '변호사가 최적 변제안 설계' },
      { title: '채권자 이의기간', desc: '14일' },
      { title: '인가 결정', desc: '법원이 변제계획안 최종 승인' },
      { title: '변제 이행 및 면책', desc: '36~60개월 변제 후 잔여 채무 면책' },
    ],
    pros: [
      '원금의 최대 90%까지 법적 감면 — 이자는 100% 전액 면제',
      '금지명령으로 채권 추심·급여 압류 즉시 중단',
      '변제기간 중에도 재산(주택, 차량 등) 보유 가능',
    ],
    cautions: [
      '변제기간(3~5년) 중 성실 납부 의무 — 불이행 시 폐지 위험',
      '허위 재산·소득 신고 시 기각 또는 형사 처벌 가능',
      '최근 6개월 내 과다 차입(돌려막기) 시 감면율 축소 불이익',
    ],
    faqs: [
      {
        q: '개인회생을 신청하면 직장에 알려지나요?',
        a: '법원에서 직장으로 별도 통보하지 않습니다. 다만 급여 압류가 이미 진행 중인 경우 중지명령 송달을 위해 회사에 문서가 발송될 수 있습니다. 압류 전에 신청하면 완전한 비공개 진행이 가능합니다.',
      },
      {
        q: '집이나 차를 빼앗기나요?',
        a: '개인회생은 파산과 달리 재산을 청산하지 않습니다. 주택, 차량 등 보유 재산을 유지하면서 채무를 조정합니다. 다만 재산 가치에 상응하는 금액은 변제해야 하는 "청산가치 보장 원칙"이 적용됩니다.',
      },
      {
        q: '변제금은 어떻게 결정되나요?',
        a: '월 소득에서 법정 생계비(부양가족 수에 따라 산정)를 공제한 "가용소득"이 매월 변제금이 됩니다. 예: 월소득 250만원, 1인 가구 기준 법정 생계비 약 120만원 → 월 변제금 약 130만원으로 산정됩니다.',
      },
    ],
    ctaTitle: '개인회생 제도 상세 상담 신청',
    ctaContent: '개인회생 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n현재 정기 소득이 있으며, 채무 부담으로 인해 개인회생을 통한 법적 채무 감면을 희망합니다. 금지명령을 통한 압류 방어와 최대 탕감률을 달성할 수 있는 맞춤 변제계획 수립을 요청합니다.',
  },

  bankruptcy: {
    title: '개인파산',
    subtitle: '상환 능력이 아예 없는 자를 위한 채무 전액 면책 제도',
    badge: '채무 100% 전액 탕감',
    description: '상환 능력이 완전히 없는 채무자의 재산을 공정하게 청산한 후, 남은 채무 전액을 법적으로 면책해주는 최종적 구제 제도입니다. 무직, 고령, 질병 등으로 소득 활동이 불가능하여 최저생계비 미만의 생활을 영위하는 경우, 매달 갚아 나가는 회생 대신 채무를 한 번에 전부 소멸시키는 가장 확실한 해결책입니다.',
    legalBasis: '채무자 회생 및 파산에 관한 법률 제305조~제566조',
    qualifications: [
      '지급불능 상태일 것 (소득이 최저생계비 미만이거나 전혀 없는 상태)',
      '면책불허가 사유에 해당하지 않을 것 (도박 등 사행성 원인 제한)',
      '최근 7년 내 파산 면책을 받은 이력이 없을 것',
      '채무 총액이 보유 재산 가치를 초과할 것 (채무초과 상태)',
    ],
    timeline: [
      { title: '서류 준비 및 법률 상담', desc: '2~4주 소요' },
      { title: '법원 접수', desc: '파산 신청 + 면책 신청 동시 진행' },
      { title: '파산선고', desc: '약 2~3개월 소요' },
      { title: '파산관재인 선임', desc: '재산 조사 및 환가 절차' },
      { title: '채권자 집회 / 재산 청산', desc: '청산 대상 재산 처분' },
      { title: '면책심문기일', desc: '법원 출석 1회' },
      { title: '면책결정', desc: '채무 원금 + 이자 전액 소멸' },
    ],
    pros: [
      '채무 원금 + 이자 100% 전액 탕감 — 1원도 갚지 않는 완전 면책',
      '월별 변제금 부담이 전혀 없음',
      '면책 후 새로운 경제적 출발 가능 (신용 재건)',
    ],
    cautions: [
      '보유 재산 중 일부 청산 필요 (생활 필수품은 보존)',
      '파산선고~면책 사이 일부 직업 자격 제한 (변호사, 공인회계사 등)',
      '세금, 벌금, 양육비 등은 비면책 채권으로 면책 대상에서 제외',
    ],
    faqs: [
      {
        q: '파산하면 평생 불이익이 있나요?',
        a: '아닙니다. 면책 결정을 받으면 파산 기록은 약 5년 후 소멸됩니다. 면책 후에는 금융 거래, 신용카드 발급, 대출 등이 다시 가능해지며, 신용등급도 점차 정상 범위로 회복됩니다.',
      },
      {
        q: '반드시 무직이어야만 신청 가능한가요?',
        a: '무직이 필수 조건은 아닙니다. 소득이 있더라도 최저생계비 이하이거나, 채무 총액이 너무 커서 개인회생으로도 변제가 불가능한 경우 파산이 인정될 수 있습니다. 핵심은 "지급불능 상태"의 객관적 입증입니다.',
      },
      {
        q: '가족에게 영향이 가나요?',
        a: '본인의 파산은 배우자나 가족의 재산·신용에 직접적 영향을 주지 않습니다. 다만 가족이 연대보증을 서 있는 경우 그 보증채무는 별도로 존속하므로, 보증인 보호 대책도 함께 마련해야 합니다.',
      },
    ],
    ctaTitle: '개인파산 자격 진단 및 면책 상담 신청',
    ctaContent: '개인파산 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n현재 소득 활동이 어려운 상태이며, 채무 전액 탕감을 위한 파산 면책 절차의 자격 여부를 긴급히 진단받고 싶습니다. 보유 재산 대비 채무 규모를 분석하여 최적의 면책 전략을 수립해 주시기 바랍니다.',
  },

  credit: {
    title: '신용회복',
    subtitle: '금융기관 채무 조정 희망자를 위한 자율 협약 기반 구제 제도',
    badge: '이자 최대 100% 감면',
    description: '신용회복위원회(신복위)를 통해 금융기관 채무의 이자를 감면받고 상환 기간을 연장하는 자율적 채무 조정 제도입니다. 법원 절차 없이 금융기관 간 협약에 의해 진행되어 비교적 간편하며, 신청 다음 날부터 모든 독촉이 정지되는 즉각적 효과가 있습니다. 프리워크아웃(연체 30~89일)과 개인워크아웃(90일 이상)으로 나뉩니다.',
    legalBasis: '신용회복위원회 운영규정, 금융기관 자율 협약',
    qualifications: [
      '금융기관(시중은행, 저축은행, 카드사, 캐피탈 등) 채무가 주된 대상',
      '프리워크아웃: 연체 30~89일 / 개인워크아웃: 연체 90일 이상',
      '최저생계비 이상의 소득이 있어 조정안 이행이 가능할 것',
      '채무조정 불이행으로 취소된 이력이 최근 1년 내 없을 것',
    ],
    timeline: [
      { title: '신복위 상담 예약', desc: '전화(1600-5500) 또는 온라인 신청' },
      { title: '신청서 접수 및 서류 제출', desc: '소득·재산·채무 증빙 제출' },
      { title: '채무조정안 확정', desc: '약 2~4주 소요' },
      { title: '독촉 정지', desc: '확정 다음 날부터 모든 독촉 즉시 정지' },
      { title: '조정안 이행', desc: '감면된 이자로 최장 10년간 분할 상환' },
      { title: '이행 완료', desc: '잔여 이자 면제 및 신용 정보 정상화' },
    ],
    pros: [
      '신청 다음 날부터 모든 채권 독촉 즉시 정지',
      '이자 최대 100% 감면, 상환기간 최장 10년 연장',
      '법원 절차 없이 비교적 간편하게 신청 가능',
    ],
    cautions: [
      '대부업·사채·개인 간 채무는 대상에서 제외됨',
      '원금 감면 폭은 개인회생(최대 90%)보다 제한적',
      '조정안 불이행 시 원래 채무 조건으로 원복 — 성실 이행 필수',
    ],
    faqs: [
      {
        q: '은행 대출만 대상인가요?',
        a: '시중은행뿐 아니라 저축은행, 캐피탈, 카드사, 보험사 등 신복위 협약 금융기관의 채무가 모두 대상입니다. 다만 미등록 대부업체, 사채, 개인 간 채무는 대상에서 제외됩니다.',
      },
      {
        q: '신용등급에 어떤 영향이 있나요?',
        a: '워크아웃 신청 자체는 신용정보에 기록되지만, 이미 연체가 진행 중인 상태라면 오히려 성실 이행을 통해 신용을 회복하는 가장 빠른 경로가 됩니다. "채무조정 성실이행" 기록은 금융권에서 긍정적으로 평가합니다.',
      },
      {
        q: '이행 완료 후 신용은 회복되나요?',
        a: '워크아웃 이행 완료 시 "채무조정 성실이행" 기록이 남으며, 이는 향후 금융 거래 시 긍정적 요소로 작용합니다. 완료 후 약 1~2년 이내 신용등급이 정상 범위로 회복되는 것이 일반적입니다.',
      },
    ],
    ctaTitle: '신용회복(워크아웃) 채무 조정 상담 신청',
    ctaContent: '신용회복 제도에 대한 상세 설명을 확인한 후 상담을 신청합니다.\n\n금융기관 채무에 대해 이자 감면 및 상환 기간 연장을 희망하며, 워크아웃 신청 자격 여부와 예상 조정 조건을 확인하고자 합니다. 개인회생과 비교하여 저에게 더 유리한 제도가 무엇인지도 함께 안내 부탁드립니다.',
  },

  representation: {
    title: '채무자대리',
    subtitle: '추심 및 대부업 독촉 방어가 우선인 자를 위한 즉각 보호 제도',
    badge: '추심 즉시 법적 차단',
    description: '변호사를 채무자대리인으로 선임하여, 채권자의 모든 추심 행위를 법적으로 차단하고 변호사가 채권자와의 협상을 전담하는 제도입니다. 위임장 1장으로 즉시 발동되며, 대리인 선임 통보 후 채권자가 채무자 본인에게 직접 연락하는 것 자체가 불법이 됩니다. 극심한 추심 스트레스에서 즉시 벗어날 수 있는 가장 빠른 조치입니다.',
    legalBasis: '대부업법 제9조의2, 채권의 공정한 추심에 관한 법률 제8조',
    qualifications: [
      '누구나 가능 — 소득·채무 규모 등 자격 제한 없음',
      '대부업체·사채업자의 직접 독촉에 시달리는 경우 특히 효과적',
      '변호사 위임장 1장이면 즉시 발동 (간단한 절차)',
      '개인회생·파산 등 다른 법적 절차와 병행 가능',
    ],
    timeline: [
      { title: '변호사 상담', desc: '채무 현황 및 추심 피해 상황 파악' },
      { title: '위임 계약 체결', desc: '채무자대리인 선임 위임장 작성' },
      { title: '선임 통보서 발송', desc: '각 채권자에게 내용증명 통보' },
      { title: '직접 독촉 즉시 차단', desc: '법적 효력 즉시 발생' },
      { title: '채권자 협상 대리', desc: '변호사가 채무 조정 및 협상 전담' },
      { title: '최종 해결', desc: '채무 조정 합의 또는 회생/파산 연계' },
    ],
    pros: [
      '전화·문자·방문 등 모든 형태의 직접 독촉 법적으로 즉시 차단',
      '불법 추심(야간 연락, 가족 협박 등)에 대한 형사고소 및 손해배상 청구',
      '극심한 심리적 압박에서 즉시 해방 — 정상적 일상 복귀',
    ],
    cautions: [
      '채무 자체가 소멸되는 것은 아님 — 별도의 채무 해결 전략 필요',
      '개인회생/파산 등과 병행 전략을 세워야 근본적 해결 가능',
      '변호사 위임 비용 발생 (초기 상담은 무료)',
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
    subtitle: '국세·지방세 압류 해결이 필요한 자를 위한 전문 구제 절차',
    badge: '소멸시효 완성 시 영구 면제',
    description: '국세·지방세 체납에 대해 징수권 소멸시효(5년/10년) 완성 여부를 정밀 분석하고, 불법·부당 압류 해제 및 조세 고충 민원을 통해 세금 채무를 구제받는 전문 절차입니다. 세금 채무는 개인회생으로 감면 불가하고 파산으로도 면책되지 않는 특수 채권이므로, 소멸시효 및 압류 적법성 분석이라는 별도의 전문적 접근이 필수적입니다.',
    legalBasis: '국세기본법 제27조(소멸시효), 지방세징수법, 국세징수법',
    qualifications: [
      '국세(소득세, 부가가치세 등) 또는 지방세(재산세, 자동차세 등) 체납이 있는 자',
      '체납 후 5년(5억 미만) 또는 10년(5억 이상)이 경과하여 소멸시효 검토가 가능한 경우',
      '소액금융재산(잔액 185만원 이하 예금)에 대한 부당 압류 피해를 입은 경우',
      '부당하거나 위법한 체납처분(압류, 공매 등)을 받았거나 받을 우려가 있는 경우',
    ],
    timeline: [
      { title: '체납 현황 전수 분석', desc: '국세·지방세 체납 내역 및 압류 이력 조사' },
      { title: '압류 적법성 검토', desc: '소액금융재산 저촉 여부, 압류 절차상 하자 분석' },
      { title: '소멸시효 정밀 분석', desc: '중단·정지 사유 존부 확인' },
      { title: '고충 민원 또는 해제 신청', desc: '세무서/시청 대상 행정 절차 진행' },
      { title: '소멸시효 완성 주장', desc: '법률 대리인을 통한 권리 구제' },
      { title: '체납 면제 확정', desc: '신용 정보 정리 및 압류 말소' },
    ],
    pros: [
      '소멸시효 완성 시 세금 채무 영구 면제 — 원금·가산세 전액 소멸',
      '불법 또는 부당한 계좌 압류 해제 및 압류금 반환 청구 가능',
      '개인회생·파산과 별도로 독립 진행 가능 — 동시 병행 효율적',
    ],
    cautions: [
      '세금은 개인회생에서 "우선권 있는 채권"으로 감면 대상에서 제외됨',
      '개인파산에서도 "비면책 채권"에 해당하여 면책 불가',
      '적법한 압류·독촉 행위는 소멸시효를 중단시킬 수 있으므로 전문 분석 필수',
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
