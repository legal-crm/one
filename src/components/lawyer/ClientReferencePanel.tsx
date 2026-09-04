import React, { useState } from 'react';
import { 
  Calculator, TrendingDown, Briefcase, Home, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, Building2, Scale, 
  Shield, FileText, User, Clock, Flame, PieChart, Info,
  Sparkles, CheckCircle2, AlertOctagon, HelpCircle, Phone,
  Heart, Users, CreditCard, DollarSign, Landmark, Gavel,
  ShieldAlert, ShieldCheck, FileCheck, Layers, ArrowUpRight, Copy
} from 'lucide-react';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
import type { AIAnalysisData } from './LawyerProposalDraft';
import CourtStatsRadar from './copilot/CourtStatsRadar';
import AIRepaymentMatrix, { RepaymentScenario } from './copilot/AIRepaymentMatrix';

interface ClientReferencePanelProps {
  consultRequest: any;
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  aiAnalysis?: AIAnalysisData;
  crmNotes?: Array<{ id: string; content: string; category: string; createdAt: string; authorName: string }>;
  isAIPremiumEnabled?: boolean;
  onQuoteQuestion?: (question: string, defaultAnswer?: string) => void;
  onApplyPlan?: (plan: { monthlyPayment: number; months: number; reductionRate: number; name?: string }) => void;
  factOutput?: any;
  ruleOutput?: any;
}

// ── 한글 라벨 맵핑 ──
const JOB_TYPE_LABELS: Record<string, string> = {
  SALARIED: '직장인 (4대보험 가입)',
  salary: '직장인 (4대보험 가입)',
  BUSINESS: '개인사업자 / 자영업',
  business: '개인사업자 / 자영업',
  DAILY: '일용직 / 계약직',
  daily: '일용직 / 계약직',
  FREELANCER: '프리랜서 / 특수고용',
  freelancer: '프리랜서 / 특수고용',
  worker_no_ins: '4대보험 미가입 근로자',
  unemployed: '무직 / 구직 중',
  none: '무직 / 구직 중',
  both: '근로 및 사업 병행',
  basic_recipient: '기초생활수급자'
};

const MARITAL_LABELS: Record<string, string> = {
  SINGLE: '미혼 (1인 가구)',
  single: '미혼 (1인 가구)',
  MARRIED: '기혼 (배우자 동거)',
  married: '기혼 (배우자 동거)',
  DIVORCED: '이혼 / 한부모',
  divorced: '이혼 / 한부모',
  WIDOWED: '사별',
  widowed: '사별',
  other: '기타'
};

const HOUSING_LABELS: Record<string, string> = {
  rent: '월세 (임차 거주)',
  jeonse: '전세 (임차 거주)',
  owned: '자가 (본인/배우자 소유)',
  free: '무상 거주 (가족/친척 집)',
  dormitory: '기숙사 / 고시원'
};

const DEBT_CAUSE_LABELS: Record<string, string> = {
  LIVING: '생계비 / 생활고 부족',
  living: '생계비 / 생활고 부족',
  BUSINESS: '사업 실패 / 매출 부진',
  business: '사업 실패 / 매출 부진',
  INVESTMENT: '주식 / 코인 투자 손실',
  investment: '주식 / 코인 투자 손실',
  GUARANTEE: '타인 보증 채무',
  guarantee: '타인 보증 채무',
  GAMBLING: '도박 / 사행성 채무',
  gambling: '도박 / 사행성 채무',
  FRAUD: '사기 피해 (보이스피싱/전세사기)',
  OTHER: '기타 사유'
};

const HARASSMENT_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  CALL: { label: '전화 / 문자 독촉', color: 'bg-amber-50 text-amber-800 border-amber-200', desc: '채권사 수시 전화·문자 독촉' },
  LETTER: { label: '독촉장 / 자택 방문', color: 'bg-orange-50 text-orange-800 border-orange-200', desc: '우편 독촉장 및 방문 통보' },
  LAWSUIT: { label: '지급명령 / 법원 소송', color: 'bg-rose-50 text-rose-800 border-rose-200', desc: '법원 소송 및 지급명령 접수됨' },
  SEIZURE: { label: '통장 / 급여 압류 진행', color: 'bg-red-100 text-red-900 border-red-300 font-bold', desc: '계좌 압류 또는 유체동산 압류 상태' }
};

const SPECIAL_COND_LABELS: Record<string, string> = {
  basic_recipient: '기초생활수급자 (취약계층 특례)',
  severe_disability: '중증 장애인 (취약계층 특례)',
  elderly: '65세 이상 고령자 (취약계층 특례)',
  single_parent: '한부모가족 (취약계층 특례)',
  rent_fraud: '전세사기 피해자 (특별법 지원)'
};

const AccordionSection = ({ 
  title, 
  icon: Icon, 
  defaultExpanded = false, 
  badge,
  children 
}: { 
  title: string, 
  icon: any, 
  defaultExpanded?: boolean, 
  badge?: React.ReactNode,
  children: React.ReactNode 
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all mb-3">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <Icon className="w-3.5 h-3.5 text-slate-600" />
          </div>
          <h3 className="font-bold text-xs text-slate-800 truncate">{title}</h3>
          {badge}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {expanded && (
        <div className="p-3.5 border-t border-slate-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );
};

export const ClientReferencePanel: React.FC<ClientReferencePanelProps> = ({
  consultRequest,
  rehabCalcResult,
  rehabUserInput,
  aiAnalysis,
  crmNotes = [],
  isAIPremiumEnabled = false,
  onQuoteQuestion,
  onApplyPlan,
  factOutput,
  ruleOutput
}) => {
  const profile = consultRequest?.financialProfile || {};

  // 3개 메인 참조 탭 (기획서 반영: voice / ai / finance)
  const [activeTab, setActiveTab] = useState<'voice' | 'ai' | 'finance'>('voice');

  // 기본 재무 수치 (만원 단위)
  const debtTotal = profile.debtTotal || Math.round((rehabUserInput.totalDebt || 0) / 10000);
  const income = profile.income || Math.round((rehabUserInput.monthlyIncome || 0) / 10000);
  const reductionRate = rehabCalcResult.debtReductionRate || 0;
  
  // 인적사항
  const clientName = rehabUserInput.name || consultRequest?.clientName || profile.clientName || '고객';
  const age = profile.age || rehabUserInput.age;
  const gender = profile.gender || rehabUserInput.gender;
  const address = profile.address || profile.residenceRegion || rehabUserInput.address || '서울특별시';
  const workLocation = profile.workLocation || rehabUserInput.workLocation || '';
  const selectedCourt = profile.selectedCourt || (rehabCalcResult as any).court || '서울회생법원';

  // DTI 배수 계산
  const annualIncome = income * 12;
  const dtiRatio = annualIncome > 0 ? (debtTotal / annualIncome).toFixed(1) : '99.0';
  const dtiNum = parseFloat(dtiRatio);

  // 채무 및 위험 요인
  const debtTypes = profile.debtTypes || {};
  const bankDebt = debtTypes.banks || 0;
  const cardDebt = debtTypes.cards || Math.round((rehabUserInput.creditCardDebt || 0) / 10000);
  const personalDebt = debtTypes.personals || 0;
  const recentLoans = debtTypes.recentLoans || 0;
  const coinLoss = debtTypes.coinCrypto || profile.speculativeLoss || Math.round((rehabUserInput.speculativeLoss || 0) / 10000);
  const gamblingLoss = profile.gamblingLoss || Math.round((rehabUserInput.gamblingLoss || 0) / 10000);
  const priorityDebt = profile.priorityDebt || Math.round((rehabUserInput.priorityDebt || 0) / 10000);
  const debtCauseKey = profile.debtCause || rehabUserInput.riskFactor || '';
  const debtCauseLabel = DEBT_CAUSE_LABELS[debtCauseKey] || debtCauseKey;

  // 추심 및 법적 조치 현황
  const harassment = profile.harassmentLevel ? HARASSMENT_LABELS[profile.harassmentLevel] : null;
  const legalActions = profile.legalActions || rehabUserInput.legalActions || [];

  // 특례 조건
  const isYouthSpecial = age ? age <= 29 : false;
  const specialCondKey = profile.specialCondition || rehabUserInput.specialCondition;
  const specialCondLabel = specialCondKey && specialCondKey !== 'none' ? SPECIAL_COND_LABELS[specialCondKey] : null;

  // 자산 / 청산가치
  const rentalDeposit = profile.rentalDeposit || Math.round((rehabUserInput.deposit || 0) / 10000);
  const depositLoan = profile.depositLoan || Math.round((rehabUserInput.depositLoan || 0) / 10000);
  const rentCost = profile.rentCost || Math.round((rehabUserInput.rentCost || 0) / 10000);
  const myAssets = profile.myAssets || Math.round((rehabUserInput.myAssets || 0) / 10000);
  const assetsTotal = profile.assetsTotal || myAssets;

  // 추가 생계비
  const medicalCost = profile.medicalCost || Math.round((rehabUserInput.medicalCost || 0) / 10000);
  const educationCost = profile.educationCost || Math.round((rehabUserInput.educationCost || 0) / 10000);
  const specialEducationCost = profile.specialEducationCost || Math.round((rehabUserInput.specialEducationCost || 0) / 10000);
  const fixedExpenses = profile.monthlyFixedExpenses || Math.round((rehabUserInput.monthlyFixedExpenses || 0) / 10000);

  // 채무 비중
  const totalDebtMan = debtTotal > 0 ? debtTotal : 1;
  const bankPct = Math.round((bankDebt / totalDebtMan) * 100);
  const cardPct = Math.round((cardDebt / totalDebtMan) * 100);
  const coinPct = Math.round((coinLoss / totalDebtMan) * 100);
  const recentPct = Math.round((recentLoans / totalDebtMan) * 100);

  // 의뢰인 사전 질문 추출
  const rawQuestions = React.useMemo(() => {
    const list: Array<{ id: string; question: string; defaultAnswer?: string }> = [];
    
    // 사연 본문에서 질문 추출
    const content = consultRequest?.content || consultRequest?.title || '';
    if (content) {
      // 물음표나 고민 표현 기반 분할
      const sentences = content.split(/(?<=[?.!])\s+/);
      sentences.forEach((s: string, idx: number) => {
        const trimmed = s.trim();
        if (trimmed.length >= 10 && (trimmed.includes('?') || trimmed.includes('되나요') || trimmed.includes('가능한가요') || trimmed.includes('어떡하나요') || trimmed.includes('압류') || trimmed.includes('독촉'))) {
          list.push({
            id: `q-sentence-${idx}`,
            question: trimmed,
            defaultAnswer: trimmed.includes('압류') 
              ? '법원에 사건 접수 즉시 금지명령을 신청하여 약 7~10일 이내에 모든 독촉 및 급여 압류 절차를 법적으로 전면 중지시킬 수 있습니다.'
              : trimmed.includes('주식') || trimmed.includes('코인')
              ? `${selectedCourt} 실무준칙에 의거하여, 손실된 원금을 청산가치에 과다 산입하지 않도록 방어하여 원금 탕감률을 최대화하도록 진행합니다.`
              : '의뢰인님의 현재 소득 및 생계비 기준을 면밀히 소명하여 월 변제금을 최소화하는 방향으로 인가 결정을 이끌어내겠습니다.'
          });
        }
      });
    }

    // 추가 명시적 질문이 있을 경우
    if (consultRequest?.questions && Array.isArray(consultRequest.questions)) {
      consultRequest.questions.forEach((q: string, idx: number) => {
        list.push({ id: `q-explicit-${idx}`, question: q });
      });
    }

    // 만약 질문이 없으면 기본 상담 사연 자체를 1순위 질문으로 제공
    if (list.length === 0 && content) {
      list.push({
        id: 'q-content-main',
        question: content.length > 80 ? content.slice(0, 80) + '...' : content,
        defaultAnswer: '의뢰인님의 현재 채무 원인 및 가계 수지를 종합 검토한 결과, 신속한 금지명령과 생계비 추가 인정을 통해 안전하게 회생 인가를 받을 수 있습니다.'
      });
    }

    return list;
  }, [consultRequest, selectedCourt]);

  // AI 3단 변제금 매트릭스용 계산값
  const matrixBasePayment = rehabCalcResult?.monthlyPayment || (factOutput?.factSummary?.disposableIncome) || ((income - 133) * 10000) || 650000;
  const matrixTotalDebt = (debtTotal * 10000) || (factOutput?.factSummary?.totalDebt) || 50000000;
  const matrixLiquidationValue = (assetsTotal * 10000) || 0;

  return (
    <div className="w-full h-full bg-slate-50/60 overflow-y-auto flex flex-col font-sans text-left scroll-smooth">
      
      {/* ── 1. 고객 프로필 & 3대 핵심 KPI 헤더 (Sticky Top) ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-4 border-b border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#1E3A5F]" />
              {clientName}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {gender === 'female' ? '여성' : gender === 'male' ? '남성' : ''} {age ? `· 만 ${age}세` : ''} · {address}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono ${
              dtiNum >= 25 ? 'bg-rose-50 text-rose-600 border border-rose-200' :
              dtiNum >= 15 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              DTI {dtiRatio}배 ({dtiNum >= 25 ? '초고위험' : dtiNum >= 15 ? '위험' : '양호'})
            </span>
          </div>
        </div>

        {/* 3대 핵심 KPI 카드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-rose-50/70 to-rose-100/30 rounded-xl p-2.5 border border-rose-200/80">
            <div className="text-[10px] text-rose-500 font-bold mb-0.5">총 채무액</div>
            <div className="text-base font-extrabold text-rose-700 font-mono tracking-tight">
              {debtTotal.toLocaleString()}<span className="text-xs font-sans font-bold ml-0.5">만원</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50/70 to-blue-100/30 rounded-xl p-2.5 border border-blue-200/80">
            <div className="text-[10px] text-blue-500 font-bold mb-0.5">월 소득 (세후)</div>
            <div className="text-base font-extrabold text-blue-700 font-mono tracking-tight">
              {income.toLocaleString()}<span className="text-xs font-sans font-bold ml-0.5">만원</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-[#1E3A5F]/10 to-[#1E3A5F]/20 rounded-xl p-2.5 border border-[#1E3A5F]/30">
            <div className="text-[10px] text-[#1E3A5F] font-bold mb-0.5">예상 탕감률</div>
            <div className="text-base font-extrabold text-[#1E3A5F] font-mono tracking-tight">
              약 {reductionRate}%
            </div>
          </div>
        </div>

        {/* 법률 특례 뱃지들 */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {isYouthSpecial && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              만 29세 이하 청년 특례
            </span>
          )}
          {specialCondLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
              <Shield className="w-3 h-3 text-indigo-600" />
              {specialCondLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
            <Landmark className="w-3 h-3 text-slate-500" />
            관할: {selectedCourt}
          </span>
        </div>

        {/* ── 2. 스마트 3단 탭 네비게이션 (스크롤 압박 제거의 핵심) ── */}
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('voice')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'voice' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span>고객 질의·상황</span>
            {rawQuestions.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-800 text-[10px] flex items-center justify-center font-bold">
                {rawQuestions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'ai' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
            <span>AI 분석·법원</span>
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'finance' 
                ? 'bg-white text-slate-900 shadow-xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-blue-500" />
            <span>재무·채권자</span>
          </button>
        </div>
      </div>

      {/* ── 탭별 컨텐츠 영역 ── */}
      <div className="p-4 space-y-4 pb-20">

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [TAB 1] 고객 질의 & 특이사항 (Client Voice & Alerts)         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'voice' && (
          <div className="space-y-3.5 animate-fadeIn">
            
            {/* 상담 요청 사연 원문 */}
            <div className="bg-amber-50/90 rounded-2xl p-4 border border-amber-200/90 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  고객 상담 신청 사연 원문
                </span>
                {debtCauseLabel && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900">
                    원인: {debtCauseLabel}
                  </span>
                )}
              </div>

              <div className="bg-white/90 rounded-xl p-3.5 border border-amber-200/60 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                {consultRequest?.content || consultRequest?.title || '등록된 사연 내용이 없습니다.'}
              </div>

              {/* 추가 메모 리스트 */}
              {(profile.clientNote || (profile.clientNotes && profile.clientNotes.length > 0)) && (
                <div className="bg-white/90 rounded-xl p-3 border border-amber-200/60 text-xs space-y-1.5">
                  <span className="font-bold text-amber-900 block">💡 고객 추가 전달사항:</span>
                  {profile.clientNote && <p className="text-slate-700">• {profile.clientNote}</p>}
                  {profile.clientNotes?.map((note: string, idx: number) => (
                    <p key={idx} className="text-slate-700">• {note}</p>
                  ))}
                </div>
              )}
            </div>

            {/* 핵심 질문 & 원클릭 제안서 Q&A 인용 버튼 (핵심 신규 기능) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#1E3A5F]" />
                  고객 핵심 질문 & 고민사항
                </span>
                <span className="text-[11px] text-slate-400">클릭 시 우측 제안서에 인용</span>
              </div>

              {rawQuestions.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                  추출된 질문이 없습니다. 사연 원문을 참고하세요.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rawQuestions.map((qItem, idx) => (
                    <div 
                      key={qItem.id} 
                      className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 transition-all space-y-2 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                            Q{idx + 1}
                          </span>
                          <p className="text-xs font-bold text-slate-800 leading-snug">
                            {qItem.question}
                          </p>
                        </div>
                      </div>

                      {qItem.defaultAnswer && (
                        <p className="text-[11px] text-slate-500 pl-6 border-l-2 border-slate-200 italic leading-relaxed">
                          AI 추천답변: {qItem.defaultAnswer}
                        </p>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            if (onQuoteQuestion) {
                              onQuoteQuestion(qItem.question, qItem.defaultAnswer);
                            }
                          }}
                          className="text-[11px] font-bold text-[#1E3A5F] hover:text-[#14263f] bg-white hover:bg-[#1E3A5F] hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 hover:border-[#1E3A5F] transition-all flex items-center gap-1 shadow-2xs active:scale-95 cursor-pointer"
                        >
                          <span>제안서 Q&A에 답변 삽입</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 추심 및 긴급 주의사항 */}
            {(harassment || legalActions.length > 0 || coinLoss > 0 || recentLoans > 0 || profile.riskFlags?.length > 0) && (
              <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    추심 상황 & 긴급 대응 필요
                  </span>
                </div>

                <div className="space-y-1.5">
                  {harassment && (
                    <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${harassment.color}`}>
                      <span className="font-bold">🚨 {harassment.label}</span>
                      <span className="text-[11px] opacity-90">{harassment.desc}</span>
                    </div>
                  )}
                  {legalActions.length > 0 && (
                    <div className="bg-white/80 p-2.5 rounded-xl border border-rose-100 text-xs text-rose-950 space-y-1">
                      <span className="font-bold block">⚖️ 진행 중인 법적 조치:</span>
                      <div className="flex flex-wrap gap-1">
                        {legalActions.map((act: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-medium text-[11px]">
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 정량적 위험 항목 */}
                <div className="space-y-1 pt-1">
                  {coinLoss > 0 && (
                    <div className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-100 text-rose-900">
                      <span className="font-bold">⚠️ 주식/코인 투자 손실금</span>
                      <span className="font-mono font-extrabold text-rose-600">{coinLoss.toLocaleString()}만원</span>
                    </div>
                  )}
                  {recentLoans > 0 && (
                    <div className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-100 text-rose-900">
                      <span className="font-bold">⚠️ 최근 1년 이내 신규 대출</span>
                      <span className="font-mono font-extrabold text-rose-600">{recentLoans.toLocaleString()}만원 ({recentPct}%)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [TAB 2] AI 사건 분석 & 법원 통계 (AI Matrix & Court Radar)   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'ai' && (
          <div className="space-y-4 animate-fadeIn">
            
            {/* 1. 관할 법원 실무 통계 레이더 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
              <CourtStatsRadar
                residenceAddress={address}
                workLocation={workLocation}
                selectedCourtName={selectedCourt}
              />
            </div>

            {/* 2. AI 3단 변제금 예측 매트릭스 (원클릭 제안서 반영 연동) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
                  AI 변제금 3단 시나리오 비교
                </span>
                <span className="text-[10px] text-slate-400">클릭하여 제안서에 반영</span>
              </div>

              <AIRepaymentMatrix
                baseMonthlyPayment={matrixBasePayment}
                totalDebt={matrixTotalDebt}
                liquidationValue={matrixLiquidationValue}
                repaymentMonths={rehabCalcResult?.repaymentMonths || 36}
                hasDependents={(profile.dependents || 0) > 0}
                onSelectScenario={(scenario: RepaymentScenario) => {
                  if (onApplyPlan) {
                    onApplyPlan({
                      monthlyPayment: scenario.monthlyPayment,
                      months: scenario.repaymentMonths,
                      reductionRate: scenario.reductionRate,
                      name: scenario.title
                    });
                  }
                }}
              />
            </div>

            {/* 3. AI 사건 분석 정밀 인텔리전스 (등급 및 검토 소견) */}
            {aiAnalysis && (
              <div className="bg-gradient-to-br from-[#1E3A5F]/10 via-[#1E3A5F]/5 to-transparent rounded-2xl p-4 border border-[#1E3A5F]/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#1E3A5F] flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-[#1E3A5F]" />
                    AI 사건 정밀 검토 소견
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F] text-white">
                    {aiAnalysis.reviewGrade || '정밀 검토'}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {aiAnalysis.courtPracticeNotes && (
                    <div className="bg-white/90 p-3 rounded-xl border border-[#1E3A5F]/10 text-xs text-slate-700 leading-relaxed">
                      <span className="font-bold text-[#1E3A5F] block mb-1">🏛️ 관할법원 실무 참고:</span>
                      {aiAnalysis.courtPracticeNotes}
                    </div>
                  )}

                  {aiAnalysis.riskFlags && aiAnalysis.riskFlags.length > 0 && (
                    <div className="bg-white/90 p-3 rounded-xl border border-[#1E3A5F]/10 space-y-1">
                      <span className="font-bold text-rose-800 block text-[11px]">⚠️ 중점 리스크 요인:</span>
                      {aiAnalysis.riskFlags.map((flag, idx) => (
                        <div key={idx} className="text-slate-700 text-[11px] flex items-start gap-1">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{flag.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* [TAB 3] 재무 수지 & 채무 구성 (Financial & Debts)           */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {activeTab === 'finance' && (
          <div className="space-y-3 animate-fadeIn">
            
            {/* 채무 구성 및 금융기관별 비중 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  채무 구성 분석
                </span>
                <span className="font-mono text-slate-500 text-[11px]">총 {debtTotal.toLocaleString()}만원</span>
              </div>

              {/* 비중 바 */}
              <div className="h-4 bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
                {bankDebt > 0 && (
                  <div style={{ width: `${bankPct}%` }} className="bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold" title={`1금융/신용 ${bankDebt}만`}>
                    {bankPct >= 15 ? `1금융 ${bankPct}%` : ''}
                  </div>
                )}
                {cardDebt > 0 && (
                  <div style={{ width: `${cardPct}%` }} className="bg-sky-400 flex items-center justify-center text-[9px] text-white font-bold" title={`카드/캐피탈 ${cardDebt}만`}>
                    {cardPct >= 15 ? `카드 ${cardPct}%` : ''}
                  </div>
                )}
                {coinLoss > 0 && (
                  <div style={{ width: `${coinPct}%` }} className="bg-rose-500 flex items-center justify-center text-[9px] text-white font-bold" title={`투자손실 ${coinLoss}만`}>
                    {coinPct >= 15 ? `투자 ${coinPct}%` : ''}
                  </div>
                )}
                {recentLoans > 0 && (
                  <div style={{ width: `${recentPct}%` }} className="bg-amber-400 flex items-center justify-center text-[9px] text-slate-900 font-bold" title={`최근대출 ${recentLoans}만`}>
                    {recentPct >= 15 ? `최근 ${recentPct}%` : ''}
                  </div>
                )}
              </div>

              {/* 상세 그리드 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">1금융 / 시중은행</span>
                  <span className="font-mono font-bold text-slate-800">{bankDebt.toLocaleString()}만원</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">신용카드 / 카드론</span>
                  <span className="font-mono font-bold text-slate-800">{cardDebt.toLocaleString()}만원</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">개인 / 사채 / 대부</span>
                  <span className="font-mono font-bold text-slate-800">{personalDebt.toLocaleString()}만원</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">세금 / 공과금 체납</span>
                  <span className="font-mono font-bold text-slate-800">{priorityDebt.toLocaleString()}만원</span>
                </div>
              </div>
            </div>

            {/* 자산 및 압류금지 공제 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-indigo-600" />
                자산 및 소액보증금 공제
              </span>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-700">
                  <span>임차보증금</span>
                  <span className="font-mono font-bold">{rentalDeposit.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span>기타 본인 재산</span>
                  <span className="font-mono font-bold">{myAssets.toLocaleString()}만원</span>
                </div>
                <div className="h-px bg-slate-200 my-1" />
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-900">예상 총 청산가치</span>
                  <span className="font-mono text-[#1E3A5F] text-sm">{assetsTotal.toLocaleString()}만원</span>
                </div>
              </div>
            </div>

            {/* 추가 생계비 지출 */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                월 필수 고정 지출
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">월세</span>
                  <span className="font-mono font-bold text-slate-800">{rentCost.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">의료비</span>
                  <span className="font-mono font-bold text-slate-800">{medicalCost.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">교육비</span>
                  <span className="font-mono font-bold text-slate-800">{educationCost.toLocaleString()}만원</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">통신/보험</span>
                  <span className="font-mono font-bold text-slate-800">{fixedExpenses.toLocaleString()}만원</span>
                </div>
              </div>
            </div>

            {/* 기존 CRM 메모 */}
            {crmNotes.length > 0 && (
              <AccordionSection title="기존 CRM 상담 이력 메모" icon={MessageSquare} defaultExpanded={false}>
                <div className="space-y-2 text-xs">
                  {crmNotes.slice(0, 3).map(note => (
                    <div key={note.id} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-1 text-[10px] text-slate-400">
                        <span className="font-bold text-slate-700">{note.category} · {note.authorName}</span>
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-800 leading-relaxed">{note.content}</p>
                    </div>
                  ))}
                </div>
              </AccordionSection>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
