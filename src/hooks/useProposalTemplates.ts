import { useState, useEffect, useCallback } from 'react';

export interface OpinionTemplate {
  id: string;
  title: string;
  category: 'coin' | 'recent_loan' | 'youth_special' | 'standard_salary' | 'business' | 'custom';
  content: string;
  recommendedNotes?: string[];
  isCustom?: boolean;
}

export interface FeePreset {
  id: string;
  label: string;
  totalFee: number;       // 원 단위
  downPayment: number;    // 원 단위
  installments: number;   // 분납 횟수
  courtDeposit: number;   // 법원 예납금
  memo?: string;
  isCustom?: boolean;
}

export interface QASnippet {
  id: string;
  keyword: string;
  questionMatch?: string;
  answer: string;
  isCustom?: boolean;
}

// 기본 제공되는 실무 표준 템플릿
export const DEFAULT_OPINION_TEMPLATES: OpinionTemplate[] = [
  {
    id: 'tpl-coin-stock',
    title: '코인·주식 손실형',
    category: 'coin',
    content: `본 사건은 주식/가상자산 투자로 인한 채무 비중이 높은 상황입니다.

1. 서울회생법원 및 주요 법원 실무준칙에 따라, 단순 투자 손실금을 전액 청산가치에 무조건 산입하지 않도록 사용처 및 거래 내역을 철저히 소명하겠습니다.
2. 월 소득 대비 필수 생계비를 최대한 확보하여 매월 현실적으로 납부 가능한 최적의 변제계획안을 도출하겠습니다.
3. 준비 서류: 코인 거래소 입출금 내역서, 주식 거래내역서, 계좌 입출금 1년 치 내역을 준비해 주시면 신속히 접수 가능합니다.`,
    recommendedNotes: [
      '투자 손실금 소명 자료(거래소 내역) 철저 준비 필요',
      '청산가치 반영 방어를 위한 사용처 소명 집중',
      '최근 대출금 중 투자 유입분 분리 소명'
    ]
  },
  {
    id: 'tpl-recent-loan',
    title: '최근 1년 대출 과다형',
    category: 'recent_loan',
    content: `최근 1년 이내 발생한 대출 비중이 다소 높아 법원의 소명 요구(보정명령)가 예상됩니다.

1. 신규 대출금이 기존 채무의 돌려막기(대환) 또는 실질적 생계비/의료비로 사용되었음을 금융거래내역으로 명확히 입증하여 기각 위험을 차단하겠습니다.
2. 법원의 편파변제 의심을 방지하고 금지명령이 신속히 인용될 수 있도록 접수 당일 사건번호 및 금지명령 신청서를 즉시 법원에 제출합니다.
3. 추심 및 독촉은 금지명령 결정 시점(접수 후 3~7일 내) 즉시 전면 중단됩니다.`,
    recommendedNotes: [
      '최근 대출금 사용처(생계비/기존채무 상환) 영수증 확보',
      '접수 즉시 금지명령 신청을 통한 채권추심 신속 방어',
      '법원 보정명령 대비 통장 내역 정리'
    ]
  },
  {
    id: 'tpl-youth-special',
    title: '청년 24개월 단축 특례형',
    category: 'youth_special',
    content: `의뢰인께서는 만 29세 이하 청년층(또는 취약계층)에 해당하여 24개월 변제기간 단축 특례 적용이 유력합니다.

1. 통상 36개월인 변제 기간을 24개월(2년)로 단축하여 총 변제액을 획기적으로 낮추고 조기 면책을 도모합니다.
2. 직장 유지 및 소득 안정성을 입증하여 법원의 신속 인가 결정을 이끌어내겠습니다.
3. 채무 탕감 후 빠른 신용 회복을 통해 사회 진출 및 금융 생활 정상화를 적극 지원합니다.`,
    recommendedNotes: [
      '만 29세 이하 서울/수원/부산회생법원 24개월 단축 특례 적용',
      '변제기간 1년 단축에 따른 총 상환 부담 대폭 경감',
      '조기 면책 후 신용 정상화 플랜'
    ]
  },
  {
    id: 'tpl-standard-salary',
    title: '급여소득자 표준형',
    category: 'standard_salary',
    content: `안정적인 급여 소득을 바탕으로 개인회생 진행 가능성이 매우 높은 사건입니다.

1. 월 세후 소득에서 의뢰인 가구원 수에 따른 법정 최저생계비(추가 주거비/의료비 소명 포함)를 최대한 공제하여 가용소득(월 변제금)을 합법적으로 최소화합니다.
2. 직장이나 가족 모르게 비공개(가명/안심번호)로 안전하게 진행되며, 급여 압류나 통장 압류 위험을 사전에 차단합니다.
3. 서류 준비 완료 후 48시간 이내 법원 접수 및 금지명령 결정을 완료하겠습니다.`,
    recommendedNotes: [
      '직장 통보 없이 비공개 안심 진행',
      '급여 통장 압류 방지 및 해제 조치 병행',
      '법정 최저생계비 + 주거비 추가 공제 소명'
    ]
  },
  {
    id: 'tpl-business',
    title: '사업자·프리랜서형',
    category: 'business',
    content: `사업 소득(매출)의 변동성을 고려하여 실질 순소득을 객관적으로 입증하는 전략이 핵심입니다.

1. 최근 1년 부가세 신고서, 종합소득세 신고서, 사업용 통장 내역을 종합 분석하여 필요 경비를 최대한 인정받도록 변제계획을 수립합니다.
2. 거래처 대금 결제나 사업 운영에 지장이 없도록 법적 보호 조치를 병행합니다.
3. 사업을 유지하면서 빚을 최대 90% 이상 탕감받고 재기할 수 있도록 맞춤형으로 조력합니다.`,
    recommendedNotes: [
      '사업 필요경비(임대료, 인건비, 매입비) 공제 소명',
      '거래처 및 사업장 운영 지속 가능성 확보',
      '종합소득세/부가세 체납액(우선변제) 연계 변제계획 수립'
    ]
  }
];

// 기본 제공되는 수임료 패키지 프리셋
export const DEFAULT_FEE_PRESETS: FeePreset[] = [
  {
    id: 'fee-preset-1',
    label: '기본형 (150만 · 5회 분납)',
    totalFee: 1500000,
    downPayment: 300000,
    installments: 5,
    courtDeposit: 300000,
    memo: '착수금 30만원 결제 후 매월 24만원씩 5회 분납 (인지대/송달료 별도)'
  },
  {
    id: 'fee-preset-2',
    label: '표준형 (180만 · 6회 분납)',
    totalFee: 1800000,
    downPayment: 300000,
    installments: 6,
    courtDeposit: 300000,
    memo: '착수금 30만원 결제 후 매월 25만원씩 6회 분납 (송달료 포함 패키지)'
  },
  {
    id: 'fee-preset-3',
    label: '복합·채권자다수 (220만 · 8회 분납)',
    totalFee: 2200000,
    downPayment: 400000,
    installments: 8,
    courtDeposit: 400000,
    memo: '채권자 8곳 이상 / 코인·최근대출 소명 포함 (월 22.5만원씩 8회 분납)'
  },
  {
    id: 'fee-preset-4',
    label: '청년/취약계층 특별할인 (130만 · 5회)',
    totalFee: 1300000,
    downPayment: 200000,
    installments: 5,
    courtDeposit: 300000,
    memo: '청년재기 특례 대상자 수임료 감면 패키지 (월 22만원씩 5회 분납)'
  }
];

// 기본 제공되는 Q&A 스니펫 (자주 묻는 질문 베스트 답변)
export const DEFAULT_QA_SNIPPETS: QASnippet[] = [
  {
    id: 'qa-job-notice',
    keyword: '직장/가족 비밀',
    questionMatch: '직장에 알려지나요? 가족이 알 수 있나요?',
    answer: '회생 절차는 본인 안심번호 및 사무실 대리인 송달로 진행되므로, 직장이나 가족에게 별도 우편물이나 통보가 가지 않습니다. 100% 비밀 보장으로 안전하게 진행됩니다.'
  },
  {
    id: 'qa-card-stop',
    keyword: '신용카드/통장 사용',
    questionMatch: '신용카드나 은행 통장은 계속 쓸 수 있나요?',
    answer: '접수 후 금지명령이 내려지면 신용카드는 정지되지만, 체크카드 및 채무가 없는 타 은행 통장은 자유롭게 개설하여 입출금 및 급여 수령이 정상 가능합니다.'
  },
  {
    id: 'qa-chushim-stop',
    keyword: '독촉/추심 중단 시점',
    questionMatch: '독촉 전화는 언제부터 안 오나요?',
    answer: '서류 접수 후 통상 3~7일 내에 법원의 [금지명령/중지명령]이 결정됩니다. 금지명령이 채권자들에게 도달하는 즉시 모든 전화, 문자, 방문 추심 및 급여 압류가 전면 금지됩니다.'
  },
  {
    id: 'qa-repay-amount',
    keyword: '변제금 상향 가능성',
    questionMatch: '월 변제금이 나중에 올라갈 수도 있나요?',
    answer: '인가 시점에 확정된 월 변제금은 추후 소득이 증가하더라도(조건부 인가가 아닌 한) 원칙적으로 올라가지 않으며, 확정된 금액만 성실히 납부하시면 됩니다.'
  }
];

export function useProposalTemplates(lawyerId: string = 'default') {
  const STORAGE_KEY_TEMPLATES = `proposal_templates_${lawyerId}`;
  const STORAGE_KEY_FEES = `proposal_fee_presets_${lawyerId}`;
  const STORAGE_KEY_QA = `proposal_qa_snippets_${lawyerId}`;

  const [opinionTemplates, setOpinionTemplates] = useState<OpinionTemplate[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TEMPLATES);
      return stored ? JSON.parse(stored) : DEFAULT_OPINION_TEMPLATES;
    } catch {
      return DEFAULT_OPINION_TEMPLATES;
    }
  });

  const [feePresets, setFeePresets] = useState<FeePreset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_FEES);
      return stored ? JSON.parse(stored) : DEFAULT_FEE_PRESETS;
    } catch {
      return DEFAULT_FEE_PRESETS;
    }
  });

  const [qaSnippets, setQaSnippets] = useState<QASnippet[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_QA);
      return stored ? JSON.parse(stored) : DEFAULT_QA_SNIPPETS;
    } catch {
      return DEFAULT_QA_SNIPPETS;
    }
  });

  // Sync to localStorage
  const saveOpinionTemplates = useCallback((templates: OpinionTemplate[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates));
      setOpinionTemplates(templates);
    } catch (e) {
      console.error('Failed to save templates:', e);
    }
  }, [STORAGE_KEY_TEMPLATES]);

  const saveFeePresets = useCallback((presets: FeePreset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_FEES, JSON.stringify(presets));
      setFeePresets(presets);
    } catch (e) {
      console.error('Failed to save fee presets:', e);
    }
  }, [STORAGE_KEY_FEES]);

  const saveQaSnippets = useCallback((snippets: QASnippet[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_QA, JSON.stringify(snippets));
      setQaSnippets(snippets);
    } catch (e) {
      console.error('Failed to save QA snippets:', e);
    }
  }, [STORAGE_KEY_QA]);

  // Opinion Template CRUD
  const addOpinionTemplate = useCallback((tpl: Omit<OpinionTemplate, 'id'>) => {
    const newTpl: OpinionTemplate = {
      ...tpl,
      id: `custom-tpl-${Date.now()}`,
      isCustom: true,
    };
    const updated = [newTpl, ...opinionTemplates];
    saveOpinionTemplates(updated);
    return newTpl;
  }, [opinionTemplates, saveOpinionTemplates]);

  const updateOpinionTemplate = useCallback((id: string, updates: Partial<OpinionTemplate>) => {
    const updated = opinionTemplates.map(t => t.id === id ? { ...t, ...updates } : t);
    saveOpinionTemplates(updated);
  }, [opinionTemplates, saveOpinionTemplates]);

  const deleteOpinionTemplate = useCallback((id: string) => {
    const updated = opinionTemplates.filter(t => t.id !== id);
    saveOpinionTemplates(updated);
  }, [opinionTemplates, saveOpinionTemplates]);

  // Fee Preset CRUD
  const addFeePreset = useCallback((preset: Omit<FeePreset, 'id'>) => {
    const newPreset: FeePreset = {
      ...preset,
      id: `custom-fee-${Date.now()}`,
      isCustom: true,
    };
    const updated = [newPreset, ...feePresets];
    saveFeePresets(updated);
    return newPreset;
  }, [feePresets, saveFeePresets]);

  const updateFeePreset = useCallback((id: string, updates: Partial<FeePreset>) => {
    const updated = feePresets.map(p => p.id === id ? { ...p, ...updates } : p);
    saveFeePresets(updated);
  }, [feePresets, saveFeePresets]);

  const deleteFeePreset = useCallback((id: string) => {
    const updated = feePresets.filter(p => p.id !== id);
    saveFeePresets(updated);
  }, [feePresets, saveFeePresets]);

  // QA Snippet CRUD
  const addQaSnippet = useCallback((snip: Omit<QASnippet, 'id'>) => {
    const newSnip: QASnippet = {
      ...snip,
      id: `custom-qa-${Date.now()}`,
      isCustom: true,
    };
    const updated = [newSnip, ...qaSnippets];
    saveQaSnippets(updated);
    return newSnip;
  }, [qaSnippets, saveQaSnippets]);

  const updateQaSnippet = useCallback((id: string, updates: Partial<QASnippet>) => {
    const updated = qaSnippets.map(s => s.id === id ? { ...s, ...updates } : s);
    saveQaSnippets(updated);
  }, [qaSnippets, saveQaSnippets]);

  const deleteQaSnippet = useCallback((id: string) => {
    const updated = qaSnippets.filter(s => s.id !== id);
    saveQaSnippets(updated);
  }, [qaSnippets, saveQaSnippets]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    saveOpinionTemplates(DEFAULT_OPINION_TEMPLATES);
    saveFeePresets(DEFAULT_FEE_PRESETS);
    saveQaSnippets(DEFAULT_QA_SNIPPETS);
  }, [saveOpinionTemplates, saveFeePresets, saveQaSnippets]);

  return {
    opinionTemplates,
    feePresets,
    qaSnippets,
    addOpinionTemplate,
    updateOpinionTemplate,
    deleteOpinionTemplate,
    addFeePreset,
    updateFeePreset,
    deleteFeePreset,
    addQaSnippet,
    updateQaSnippet,
    deleteQaSnippet,
    resetToDefault
  };
}
