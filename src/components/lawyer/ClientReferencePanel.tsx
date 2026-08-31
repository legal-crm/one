import React, { useState } from 'react';
import { 
  Calculator, TrendingDown, Briefcase, Home, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, Building2, Scale, 
  Shield, FileText, User, Clock, Flame, PieChart, Info,
  Sparkles, CheckCircle2, AlertOctagon, HelpCircle, Phone,
  Heart, Users, CreditCard, DollarSign, Landmark, Gavel,
  ShieldAlert, ShieldCheck, FileCheck, Layers
} from 'lucide-react';
import type { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';
import { formatCurrency } from '../../rehab-chatbot-package/services/calculationService';
import type { AIAnalysisData } from './LawyerProposalDraft';

interface ClientReferencePanelProps {
  consultRequest: any;
  rehabCalcResult: RehabCalculationResult;
  rehabUserInput: RehabUserInput;
  aiAnalysis?: AIAnalysisData;
  crmNotes?: Array<{ id: string; content: string; category: string; createdAt: string; authorName: string }>;
  isAIPremiumEnabled?: boolean;
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

const HOLDER_LABELS: Record<string, string> = {
  self: '본인 명의',
  spouse: '배우자 명의',
  others: '가족/타인 명의'
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
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
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
  isAIPremiumEnabled = false
}) => {
  const profile = consultRequest?.financialProfile || {};

  // 기본 재무 수치 (만원 단위)
  const debtTotal = profile.debtTotal || Math.round((rehabUserInput.totalDebt || 0) / 10000);
  const income = profile.income || Math.round((rehabUserInput.monthlyIncome || 0) / 10000);
  const reductionRate = rehabCalcResult.debtReductionRate || 0;
  
  // 인적사항
  const clientName = rehabUserInput.name || consultRequest?.clientName || profile.clientName || '고객';
  const phone = consultRequest?.phone || profile.clientPhone || rehabUserInput.phone;
  const age = profile.age || rehabUserInput.age;
  const gender = profile.gender || rehabUserInput.gender;
  const address = profile.address || profile.residenceRegion || rehabUserInput.address || '지역 미입력';
  const workLocation = profile.workLocation || rehabUserInput.workLocation;

  // DTI 배수 계산
  const annualIncome = income * 12;
  const dtiRatio = annualIncome > 0 ? (debtTotal / annualIncome).toFixed(1) : '99.0';
  const dtiNum = parseFloat(dtiRatio);

  // 직업 및 소득
  const jobKey = profile.jobType || profile.employmentType || rehabUserInput.employmentType || '';
  const jobLabel = JOB_TYPE_LABELS[jobKey] || jobKey || '직업 미입력';
  const companyName = profile.companyName || profile.companyNameMasked;
  const salaryIncome = profile.salaryIncome || (rehabUserInput.salaryIncome ? Math.round(rehabUserInput.salaryIncome / 10000) : 0);
  const businessIncome = profile.businessIncome || (rehabUserInput.businessIncome ? Math.round(rehabUserInput.businessIncome / 10000) : 0);
  const retirementPay = profile.retirementPay || (rehabUserInput.retirementPay ? Math.round(rehabUserInput.retirementPay / 10000) : 0);
  const pensionType = profile.retirementPensionType || rehabUserInput.retirementPensionType;

  // 가족 및 부양가족
  const maritalKey = profile.maritalStatus || rehabUserInput.maritalStatus || '';
  const maritalLabel = MARITAL_LABELS[maritalKey] || (rehabUserInput.isMarried ? '기혼' : '미혼');
  const depCount = profile.dependents !== undefined ? profile.dependents : Math.max(0, (rehabUserInput.familySize || 1) - 1);
  const minorChildren = profile.minorChildren !== undefined ? profile.minorChildren : rehabUserInput.minorChildren || 0;
  const childSupportRecv = profile.childSupportReceived || (rehabUserInput.childSupportReceived ? Math.round(rehabUserInput.childSupportReceived / 10000) : 0);
  const childSupportPaid = profile.childSupportPaid || (rehabUserInput.childSupportPaid ? Math.round(rehabUserInput.childSupportPaid / 10000) : 0);
  const spouseIncome = profile.spouseIncome || (rehabUserInput.spouseIncome ? Math.round(rehabUserInput.spouseIncome / 10000) : 0);
  const spouseAsset = profile.spouseAsset || (rehabUserInput.spouseAssets ? Math.round(rehabUserInput.spouseAssets / 10000) : 0);

  // 주거
  const housingKey = profile.housingType || rehabUserInput.housingType || 'rent';
  const housingLabel = HOUSING_LABELS[housingKey] || housingKey;
  const contractHolder = profile.housingContractHolder || rehabUserInput.housingContractHolder;
  const rentalDeposit = profile.rentalDeposit || Math.round((rehabUserInput.deposit || 0) / 10000);
  const depositLoan = profile.depositLoan || Math.round((rehabUserInput.depositLoan || 0) / 10000);
  const rentCost = profile.rentCost || Math.round((rehabUserInput.rentCost || 0) / 10000);

  // 추가 생계비 지출
  const medicalCost = profile.medicalCost || Math.round((rehabUserInput.medicalCost || 0) / 10000);
  const educationCost = profile.educationCost || Math.round((rehabUserInput.educationCost || 0) / 10000);
  const specialEducationCost = profile.specialEducationCost || Math.round((rehabUserInput.specialEducationCost || 0) / 10000);
  const fixedExpenses = profile.monthlyFixedExpenses || Math.round((rehabUserInput.monthlyFixedExpenses || 0) / 10000);

  // 채무 상세
  const creditorCount = profile.creditorCount || 1;
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
  const courtName = (rehabCalcResult as any).court || '서울회생법원';

  // 자산 / 청산가치
  const myAssets = profile.myAssets || Math.round((rehabUserInput.myAssets || 0) / 10000);
  const assetsTotal = profile.assetsTotal || myAssets;

  // 비율 계산
  const totalDebtMan = debtTotal > 0 ? debtTotal : 1;
  const bankPct = Math.round((bankDebt / totalDebtMan) * 100);
  const cardPct = Math.round((cardDebt / totalDebtMan) * 100);
  const coinPct = Math.round((coinLoss / totalDebtMan) * 100);
  const recentPct = Math.round((recentLoans / totalDebtMan) * 100);

  return (
    <div className="w-full h-full bg-slate-50/60 overflow-y-auto pb-24 flex flex-col font-sans text-left scroll-smooth">
      
      {/* ── 1. 고객 프로필 & 3대 핵심 KPI 헤더 (Sticky Top) ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-4 border-b border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-brand" />
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
          <div className="bg-gradient-to-br from-brand/5 to-brand/15 rounded-xl p-2.5 border border-brand/30">
            <div className="text-[10px] text-brand font-bold mb-0.5">예상 탕감률</div>
            <div className="text-base font-extrabold text-brand font-mono tracking-tight">
              약 {reductionRate}%
            </div>
          </div>
        </div>

        {/* 법률 특례 뱃지들 */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {isYouthSpecial && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              만 29세 이하 청년 (24개월 단축 특례 대상)
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
            관할: {courtName}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        
        {/* ── 2. 고객 사연 원문 & 의뢰인 메모 (최상단 강조) ── */}
        <div className="bg-gradient-to-br from-amber-50/90 to-amber-100/40 rounded-2xl p-4 border border-amber-200/90 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              고객이 남긴 상담 요청 사연
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

        {/* ── 3. 채권 추심 & 법적 조치 & 위험 요인 ── */}
        {(harassment || legalActions.length > 0 || coinLoss > 0 || recentLoans > 0 || profile.riskFlags?.length > 0) && (
          <div className="bg-rose-50/70 rounded-2xl p-4 border border-rose-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                추심 상황 & 핵심 주의 요인
              </span>
            </div>

            {/* 추심 및 법적 조치 현황 뱃지 */}
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
              {gamblingLoss > 0 && (
                <div className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-100 text-rose-900">
                  <span className="font-bold">⚠️ 사행성/도박 손실금</span>
                  <span className="font-mono font-extrabold text-rose-600">{gamblingLoss.toLocaleString()}만원</span>
                </div>
              )}
              {recentLoans > 0 && (
                <div className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-100 text-rose-900">
                  <span className="font-bold">⚠️ 최근 1년 이내 신규 대출</span>
                  <span className="font-mono font-extrabold text-rose-600">{recentLoans.toLocaleString()}만원 ({recentPct}%)</span>
                </div>
              )}
              {profile.riskFlags?.map((flag: string, i: number) => (
                <div key={`rf-${i}`} className="text-xs text-slate-700 bg-white/70 px-2.5 py-1 rounded-lg border border-rose-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  {flag}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. 채무 구성 & 금융기관별 내역 ── */}
        <AccordionSection 
          title="채무 구성 & 금융기관별 분석" 
          icon={PieChart} 
          defaultExpanded={true}
          badge={<span className="text-[10px] font-bold text-brand font-mono bg-brand/10 px-1.5 py-0.5 rounded">채권자 {creditorCount}곳</span>}
        >
          <div className="space-y-3 text-xs">
            {/* 비중 바 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                <span>채무 성격별 비중</span>
                <span>총 {debtTotal.toLocaleString()}만원</span>
              </div>
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
            </div>

            {/* 항목별 상세 그리드 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">1금융 / 시중은행</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{bankDebt.toLocaleString()}만원</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">신용카드 / 카드론 / 2금융</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{cardDebt.toLocaleString()}만원</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">대부업 / 개인 / 사채</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{personalDebt.toLocaleString()}만원</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">세금 / 공과금 체납 (우선변제)</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{priorityDebt.toLocaleString()}만원</span>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ── 5. 소득 & 고용 형태 상세 ── */}
        <AccordionSection title="소득 & 고용 형태 상세" icon={Briefcase} defaultExpanded={true}>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">고용 형태</span>
                <span className="font-bold text-slate-800">{jobLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">직장/상호명</span>
                <span className="font-bold text-slate-800">{companyName || '비공개 / 재직 중'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">월 세후 실수령액</span>
                <span className="font-mono font-extrabold text-blue-600">{income.toLocaleString()}만원</span>
              </div>
              {salaryIncome > 0 && businessIncome > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">겸업 소득 분리</span>
                  <span className="font-mono font-bold text-slate-700">급여 {salaryIncome}만 + 사업 {businessIncome}만</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">근무지 / 사업장</span>
                <span className="font-bold text-slate-800">{workLocation || address}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">예상 퇴직금</span>
                <span className="font-mono font-bold text-slate-800">
                  {retirementPay > 0 ? `${retirementPay.toLocaleString()}만원` : '해당 없음'}
                  {pensionType === 'pension' ? ' (퇴직연금 압류금지)' : ''}
                </span>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ── 6. 가구원 & 부양가족 상세 ── */}
        <AccordionSection title="가구원 & 부양가족 구조" icon={Users} defaultExpanded={true}>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">혼인 상태</span>
                <span className="font-bold text-slate-800">{maritalLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">인정 부양가족</span>
                <span className="font-bold text-slate-800">{depCount}명 (가구원 총 {depCount + 1}인)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">미성년 자녀</span>
                <span className="font-bold text-slate-800">{minorChildren}명</span>
              </div>
              {(childSupportRecv > 0 || childSupportPaid > 0) && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">양육비 수령/지급</span>
                  <span className="font-mono font-bold text-slate-800">
                    {childSupportRecv > 0 ? `수령 +${childSupportRecv}만` : ''} {childSupportPaid > 0 ? `지급 -${childSupportPaid}만` : ''}
                  </span>
                </div>
              )}
              {spouseIncome > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">배우자 월 소득</span>
                  <span className="font-mono font-bold text-slate-800">{spouseIncome.toLocaleString()}만원</span>
                </div>
              )}
              {spouseAsset > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">배우자 재산</span>
                  <span className="font-mono font-bold text-slate-800">{spouseAsset.toLocaleString()}만원 (50% 반영 검토)</span>
                </div>
              )}
            </div>
          </div>
        </AccordionSection>

        {/* ── 7. 주거 형태 & 자산 / 청산가치 매트릭스 ── */}
        <AccordionSection title="주거 형태 & 자산 · 청산가치" icon={Home} defaultExpanded={true}>
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">거주 형태</span>
                <span className="font-bold text-slate-800">{housingLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">계약 명의자</span>
                <span className="font-bold text-slate-800">{contractHolder ? (HOLDER_LABELS[contractHolder] || contractHolder) : '본인'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">임차 보증금</span>
                <span className="font-mono font-bold text-slate-800">{rentalDeposit.toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">보증금 대출금</span>
                <span className="font-mono font-bold text-slate-800">{depositLoan.toLocaleString()}만원</span>
              </div>
            </div>

            {/* 자산 목록 및 청산가치 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
              <div className="flex justify-between items-center text-slate-700">
                <span>기타 본인 재산 (차량/예금/보험)</span>
                <span className="font-mono font-bold">{myAssets.toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>소액보증금 압류금지 공제 후 잔액</span>
                <span className="font-mono text-slate-600">{Math.max(0, rentalDeposit - depositLoan).toLocaleString()}만원</span>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-900">예상 총 청산가치</span>
                <span className="font-mono text-brand text-sm">{assetsTotal.toLocaleString()}만원</span>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ── 8. 추가 생계비 및 고정 지출 ── */}
        <AccordionSection title="추가 생계비 소명 항목 & 고정 지출" icon={DollarSign} defaultExpanded={false}>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">월세 지출</span>
                <span className="font-mono font-bold text-slate-800">{rentCost.toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">월 필수 의료비</span>
                <span className="font-mono font-bold text-slate-800">{medicalCost.toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">월 교육비</span>
                <span className="font-mono font-bold text-slate-800">{educationCost.toLocaleString()}만원</span>
              </div>
              {specialEducationCost > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">월 특수교육비</span>
                  <span className="font-mono font-bold text-slate-800">{specialEducationCost.toLocaleString()}만원</span>
                </div>
              )}
              {fixedExpenses > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">월 고정지출 (통신/보험)</span>
                  <span className="font-mono font-bold text-slate-800">{fixedExpenses.toLocaleString()}만원</span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              * 위 항목들은 법원에 영수증 소명 시 추가 생계비로 인정받아 월 변제금을 낮출 수 있습니다.
            </p>
          </div>
        </AccordionSection>

        {/* ── 9. 유료 AI 사건 분석 (CaseReviewCopilot) 정밀 리포트 ── */}
        {isAIPremiumEnabled && aiAnalysis && (
          <div className="bg-gradient-to-br from-[#1E3A5F]/10 via-[#1E3A5F]/5 to-transparent rounded-2xl p-4 border border-[#1E3A5F]/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1E3A5F] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
                AI 사건 분석 정밀 인텔리전스
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F] text-white">
                검토 등급: {aiAnalysis.reviewGrade || '정밀 검토'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-white/90 p-3 rounded-xl border border-[#1E3A5F]/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">AI 가용소득 추정</span>
                  <span className="font-bold text-emerald-600 font-mono">{formatCurrency(aiAnalysis.factSummary.disposableIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">순자산 청산가치</span>
                  <span className="font-bold text-slate-800 font-mono">{formatCurrency(aiAnalysis.factSummary.assets.netAssetValue)}</span>
                </div>
              </div>

              {aiAnalysis.courtPracticeNotes && (
                <div className="bg-white/90 p-3 rounded-xl border border-[#1E3A5F]/10 text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-[#1E3A5F] block mb-1">🏛️ 관할법원 실무 참고:</span>
                  {aiAnalysis.courtPracticeNotes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 10. 상담 메모 이력 ── */}
        <AccordionSection title="상담 메모 이력" icon={MessageSquare} defaultExpanded={false}>
          {crmNotes.length > 0 ? (
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
          ) : (
            <div className="text-xs text-slate-400 text-center py-3">
              등록된 메모가 없습니다.
            </div>
          )}
        </AccordionSection>

      </div>
    </div>
  );
};
