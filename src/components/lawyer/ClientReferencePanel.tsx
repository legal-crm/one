import React, { useState } from 'react';
import { 
  Calculator, TrendingDown, Briefcase, Home, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, Building2, Scale, 
  Shield, FileText, User, Clock, Flame, PieChart, Info,
  Sparkles, CheckCircle2, AlertOctagon, HelpCircle
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
  both: '근로 및 사업 병행'
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
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all mb-3.5">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition-colors text-left"
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

  const debtTotal = profile.debtTotal || 0; // 만원
  const income = profile.income || 0;       // 만원
  const reductionRate = rehabCalcResult.debtReductionRate || 0;
  
  const clientName = rehabUserInput.name || consultRequest?.clientName || profile.clientName || '고객';
  const age = profile.age || rehabUserInput.age;
  const gender = profile.gender || (rehabUserInput as any).gender;
  const region = profile.residenceRegion || profile.address || '지역 미정';
  const jobLabel = JOB_TYPE_LABELS[profile.jobType || profile.employmentType] || profile.jobType || '직업 미입력';

  // DTI 배수 계산
  const annualIncome = income * 12;
  const dtiRatio = annualIncome > 0 ? (debtTotal / annualIncome).toFixed(1) : '99.0';
  const dtiNum = parseFloat(dtiRatio);

  // 채무 구성 분석 (만원 단위)
  const debtTypes = profile.debtTypes || {};
  const bankDebt = debtTypes.banks || 0;
  const cardDebt = debtTypes.cards || 0;
  const personalDebt = debtTypes.personals || 0;
  const recentLoans = debtTypes.recentLoans || 0;
  const coinLoss = debtTypes.coinCrypto || profile.speculativeLoss || profile.gamblingLoss || 0;

  // 비율 계산
  const totalDebtMan = debtTotal > 0 ? debtTotal : 1;
  const bankPct = Math.round((bankDebt / totalDebtMan) * 100);
  const cardPct = Math.round((cardDebt / totalDebtMan) * 100);
  const coinPct = Math.round((coinLoss / totalDebtMan) * 100);
  const recentPct = Math.round((recentLoans / totalDebtMan) * 100);

  // 청년 특례 판별 (만 29세 이하 또는 서울회생법원 대상)
  const isYouthSpecial = age ? age <= 29 : false;
  const isSeoulCourt = region.includes('서울') || region.includes('관악') || region.includes('강남') || region.includes('서초');

  return (
    <div className="w-full h-full bg-slate-50/60 overflow-y-auto pb-12 flex flex-col font-sans">
      
      {/* ── 1. 고객 프로필 & 핵심 KPI 헤더 (Sticky Top) ── */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md p-4 border-b border-slate-200 shadow-xs space-y-3">
        {/* 고객 기본 인적사항 칩 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-brand" />
              {clientName}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
              {gender === 'female' ? '여' : '남'} {age ? `· ${age}세` : ''} · {region}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono ${
              dtiNum >= 25 ? 'bg-rose-50 text-rose-600 border border-rose-200' :
              dtiNum >= 15 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              DTI {dtiRatio}배 ({dtiNum >= 25 ? '초고위험' : dtiNum >= 15 ? '경고' : '양호'})
            </span>
          </div>
        </div>

        {/* 3대 핵심 KPI 카드 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gradient-to-br from-rose-50/60 to-rose-100/30 rounded-xl p-2.5 border border-rose-200/80">
            <div className="text-[10px] text-rose-500 font-bold mb-0.5">총 채무액</div>
            <div className="text-base font-extrabold text-rose-700 font-mono tracking-tight">
              {debtTotal.toLocaleString()}<span className="text-xs font-sans font-bold ml-0.5">만원</span>
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50/60 to-blue-100/30 rounded-xl p-2.5 border border-blue-200/80">
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

        {/* 법률 특례 / 맞춤 혜택 뱃지 */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {isYouthSpecial && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              청년 24개월 변제 단축 특례 대상 (만 29세 이하)
            </span>
          )}
          {isSeoulCourt && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
              <Building2 className="w-3 h-3 text-indigo-600" />
              서울회생법원 (실무준칙 제408호 코인손실 비산입)
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        
        {/* ── 2. 고객 사연 & 핵심 질문 인용 카드 (가장 중요) ── */}
        <div className="bg-gradient-to-br from-amber-50/90 to-amber-100/40 rounded-2xl p-4 border border-amber-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
              고객이 남긴 상담 요청 사연
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
              상담 메모
            </span>
          </div>

          <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
            {consultRequest?.content || consultRequest?.title || '등록된 사연 원문이 없습니다.'}
          </div>

          {/* 고객 추가 질문이나 특이사항이 있을 때 */}
          {profile.clientNote && (
            <div className="bg-white/90 rounded-xl p-2.5 border border-amber-200/60 text-xs text-amber-950 font-medium">
              💡 <span className="font-bold">고객 추가 요청:</span> {profile.clientNote}
            </div>
          )}
        </div>

        {/* ── 3. 채무 위험 플래그 배너 ── */}
        {(profile.riskFlags?.length > 0 || aiAnalysis?.riskFlags?.length > 0 || coinLoss > 0 || recentLoans > 0) && (
          <div className="bg-rose-50/70 rounded-2xl p-3.5 border border-rose-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              주의 및 소명 필요 위험 요인
            </div>
            <div className="space-y-1.5">
              {coinLoss > 0 && (
                <div className="flex items-center justify-between text-xs bg-white/80 px-2.5 py-1.5 rounded-lg border border-rose-100 text-rose-900">
                  <span className="font-bold">⚠️ 코인/주식/도박 손실금 존재</span>
                  <span className="font-mono font-extrabold text-rose-600">{coinLoss.toLocaleString()}만원</span>
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

        {/* ── 4. 채무 포트폴리오 비주얼 분석 ── */}
        <AccordionSection 
          title="채무 구성 & 포트폴리오 분석" 
          icon={PieChart} 
          defaultExpanded={true}
          badge={<span className="text-[10px] font-bold text-brand font-mono bg-brand/10 px-1.5 py-0.5 rounded">채권자 {profile.creditorCount || 1}곳</span>}
        >
          <div className="space-y-3 text-xs">
            {/* 시각화 프로그레스 바 */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-500 font-bold">
                <span>채무 성격별 비중</span>
                <span>총 {debtTotal.toLocaleString()}만원</span>
              </div>
              <div className="h-4 bg-slate-100 rounded-lg overflow-hidden flex shadow-inner">
                {bankDebt > 0 && (
                  <div style={{ width: `${bankPct}%` }} className="bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold" title={`은행/신용 ${bankDebt}만`}>
                    {bankPct >= 15 ? `1금융 ${bankPct}%` : ''}
                  </div>
                )}
                {cardDebt > 0 && (
                  <div style={{ width: `${cardPct}%` }} className="bg-sky-400 flex items-center justify-center text-[9px] text-white font-bold" title={`카드/캐피탈 ${cardDebt}만`}>
                    {cardPct >= 15 ? `카드 ${cardPct}%` : ''}
                  </div>
                )}
                {coinLoss > 0 && (
                  <div style={{ width: `${coinPct}%` }} className="bg-rose-500 flex items-center justify-center text-[9px] text-white font-bold" title={`코인/주식 ${coinLoss}만`}>
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

            {/* 채무 항목 상세 그리드 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">1금융 / 신용대출</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{bankDebt.toLocaleString()}만원</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">신용카드 / 카드론</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{cardDebt.toLocaleString()}만원</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">대부 / 개인 / 사채</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{personalDebt.toLocaleString()}만원</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-500 block text-[10px]">세금 / 조세 체납(우선변제)</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{(profile.priorityDebt || 0).toLocaleString()}만원</span>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ── 5. 소득 · 생계비 · 청산가치 매트릭스 ── */}
        <AccordionSection title="소득 · 생계비 · 자산 구조" icon={Briefcase} defaultExpanded={true}>
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">직업 형태</span>
                <span className="font-bold text-slate-800">{jobLabel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">직장명</span>
                <span className="font-bold text-slate-800">{profile.companyName || '비공개/재직중'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">부양가족</span>
                <span className="font-bold text-slate-800">{profile.dependents || 0}명 (본인 포함 {(profile.dependents || 0) + 1}인)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">월세 지출</span>
                <span className="font-bold text-slate-800 font-mono">{(profile.rentCost || 0).toLocaleString()}만원</span>
              </div>
            </div>

            {/* 자산 및 청산가치 */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5">
              <div className="flex justify-between items-center text-slate-700">
                <span>임차 보증금</span>
                <span className="font-mono font-bold">{(profile.rentalDeposit || 0).toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>보증금 대출금</span>
                <span className="font-mono text-slate-500">{(profile.depositLoan || 0).toLocaleString()}만원</span>
              </div>
              <div className="flex justify-between items-center text-slate-700">
                <span>기타 재산 (차량/보험 등)</span>
                <span className="font-mono font-bold">{(profile.myAssets || 0).toLocaleString()}만원</span>
              </div>
              <div className="h-px bg-slate-200 my-1" />
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-900">예상 총 청산가치</span>
                <span className="font-mono text-brand text-sm">{(profile.assetsTotal || 0).toLocaleString()}만원</span>
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* ── 6. 유료 AI 사건 분석 (CaseReviewCopilot) 정밀 진단 탭 ── */}
        {isAIPremiumEnabled && aiAnalysis && (
          <div className="bg-gradient-to-br from-[#1E3A5F]/10 via-[#1E3A5F]/5 to-transparent rounded-2xl p-4 border border-[#1E3A5F]/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#1E3A5F] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F]" />
                AI 사건 분석 인텔리전스
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1E3A5F] text-white">
                검토 등급: {aiAnalysis.reviewGrade || '정밀 검토'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-white/90 p-3 rounded-xl border border-[#1E3A5F]/10 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">AI 가용소득 추정</span>
                  <span className="font-bold text-emerald-600 font-mono">{formatCurrency(aiAnalysis.factSummary.disposableIncome)}원</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">순자산 청산가치</span>
                  <span className="font-bold text-slate-800 font-mono">{formatCurrency(aiAnalysis.factSummary.assets.netAssetValue)}원</span>
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

        {/* ── 7. 상담 메모 이력 ── */}
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
