import React, { useState } from 'react';
import { 
  Calculator, TrendingDown, Briefcase, Home, AlertTriangle, 
  MessageSquare, ChevronDown, ChevronUp, Building2, Scale, 
  Shield, FileText, User, Clock 
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
}

const AccordionSection = ({ 
  title, 
  icon: Icon, 
  defaultExpanded = false, 
  children 
}: { 
  title: string, 
  icon: any, 
  defaultExpanded?: boolean, 
  children: React.ReactNode 
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
      </button>
      {expanded && (
        <div className="p-4 border-t border-slate-200">
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
  crmNotes = []
}) => {
  const profile = consultRequest?.financialProfile || {};

  const debtTotal = profile.debtTotal || 0;
  const income = profile.income || 0;
  const reductionRate = rehabCalcResult.debtReductionRate || 0;

  return (
    <div className="w-full h-full bg-slate-50 overflow-y-auto pb-8">
      {/* 1. 핵심 지표 카드 (Sticky top) */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm p-4 border-b border-slate-200">
        <div className="flex gap-2">
          <div className="flex-1 bg-gradient-to-br from-[#7264FF]/5 to-[#7264FF]/10 rounded-2xl p-3 border border-[#7264FF]/20">
            <div className="text-xs text-slate-500 mb-1">총 채무액</div>
            <div className="text-lg font-bold text-[#7264FF]">
              {debtTotal.toLocaleString()}만원
            </div>
          </div>
          <div className="flex-1 bg-gradient-to-br from-[#7264FF]/5 to-[#7264FF]/10 rounded-2xl p-3 border border-[#7264FF]/20">
            <div className="text-xs text-slate-500 mb-1">월 소득</div>
            <div className="text-lg font-bold text-slate-800">
              {income.toLocaleString()}만원
            </div>
          </div>
          <div className="flex-1 bg-gradient-to-br from-[#7264FF]/5 to-[#7264FF]/10 rounded-2xl p-3 border border-[#7264FF]/20">
            <div className="text-xs text-slate-500 mb-1">예상 탕감률</div>
            <div className="text-lg font-bold text-[#7264FF]">
              {reductionRate}%
            </div>
          </div>
        </div>
        
        {/* 8. 위험 플래그 배너 */}
        {(profile.riskFlags?.length > 0 || aiAnalysis?.riskFlags?.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.riskFlags?.map((flag: string, i: number) => (
              <span key={`f-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                {flag}
              </span>
            ))}
            {aiAnalysis?.riskFlags?.map((flag, i) => (
              <span key={`ai-${i}`} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${
                flag.severity === 'high' ? 'bg-red-50 text-red-700 border-red-200' : 
                flag.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                'bg-slate-50 text-slate-700 border-slate-200'
              }`}>
                <AlertTriangle className="w-3 h-3" />
                {flag.flag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* 2. 진단 결과 요약 */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-slate-500" />
            <h3 className="font-semibold text-slate-800">진단 결과 요약</h3>
            <span className={`ml-auto px-2 py-0.5 rounded-lg text-xs font-medium ${
              rehabCalcResult.status === 'POSSIBLE' ? 'bg-green-100 text-green-700' :
              rehabCalcResult.status === 'DIFFICULT' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {rehabCalcResult.status === 'POSSIBLE' ? '진행 가능' : rehabCalcResult.status === 'DIFFICULT' ? '진행 주의' : '진행 불가'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-slate-500">예상 월 변제금</div>
            <div className="text-right font-medium">{formatCurrency(rehabCalcResult.monthlyPayment)}</div>
            <div className="text-slate-500">변제 기간</div>
            <div className="text-right font-medium">{rehabCalcResult.repaymentMonths}개월</div>
          </div>
        </div>

        {/* 3. 채무 구조 섹션 */}
        <AccordionSection title="채무 구조" icon={Building2} defaultExpanded={true}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">채권자 수</span>
              <span className="font-medium">{profile.creditorCount || 0}곳</span>
            </div>
            {aiAnalysis?.debtStructure && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-slate-600 flex-1">신용채무</span>
                  <span className="text-xs font-medium">{aiAnalysis.debtStructure.unsecured.toLocaleString()}만원</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-xs text-slate-600 flex-1">담보채무</span>
                  <span className="text-xs font-medium">{aiAnalysis.debtStructure.secured.toLocaleString()}만원</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  <span className="text-xs text-slate-600 flex-1">세금/체납</span>
                  <span className="text-xs font-medium">{aiAnalysis.debtStructure.tax.toLocaleString()}만원</span>
                </div>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 4. 소득 & 생계비 섹션 */}
        <AccordionSection title="소득 & 생계비" icon={Briefcase} defaultExpanded={true}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <div className="text-slate-500">직업 유형</div>
              <div className="text-right">{profile.jobType || '미입력'}</div>
              <div className="text-slate-500">직장명</div>
              <div className="text-right">{profile.companyName || '미입력'}</div>
              <div className="text-slate-500">부양가족</div>
              <div className="text-right">{profile.dependents || 0}명</div>
              <div className="text-slate-500">월세</div>
              <div className="text-right">{profile.rentCost?.toLocaleString() || 0}만원</div>
              <div className="text-slate-500">의료비</div>
              <div className="text-right">{profile.medicalCost?.toLocaleString() || 0}만원</div>
              <div className="text-slate-500">교육비</div>
              <div className="text-right">{profile.educationCost?.toLocaleString() || 0}만원</div>
            </div>
            {aiAnalysis?.disposableIncome && (
              <div className="pt-2 border-t border-slate-100 flex justify-between font-medium">
                <span className="text-slate-700">가용소득 (AI 추정)</span>
                <span className="text-[#7264FF]">{aiAnalysis.disposableIncome.toLocaleString()}만원</span>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* 5. 자산 & 주거 섹션 */}
        <AccordionSection title="자산 & 주거" icon={Home} defaultExpanded={false}>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-y-2">
              <div className="text-slate-500">거주 지역</div>
              <div className="text-right">{profile.residenceRegion || '미입력'}</div>
              <div className="text-slate-500">본인 자산</div>
              <div className="text-right">{profile.myAssets?.toLocaleString() || 0}만원</div>
              <div className="text-slate-500">임차보증금</div>
              <div className="text-right">{profile.rentalDeposit?.toLocaleString() || 0}만원</div>
              <div className="text-slate-500">보증금 담보대출</div>
              <div className="text-right">{profile.depositLoan?.toLocaleString() || 0}만원</div>
              <div className="text-slate-500">배우자 자산</div>
              <div className="text-right">{profile.spouseAsset?.toLocaleString() || 0}만원</div>
              <div className="text-slate-500">배우자 소득</div>
              <div className="text-right">{profile.spouseIncome?.toLocaleString() || 0}만원</div>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between font-medium">
              <span className="text-slate-700">총 청산가치 (예상)</span>
              <span>{profile.assetsTotal?.toLocaleString() || 0}만원</span>
            </div>
          </div>
        </AccordionSection>

        {/* 6. 상담 요청 원문 섹션 */}
        <AccordionSection title="상담 요청 원문" icon={FileText} defaultExpanded={false}>
          <div>
            <h4 className="text-sm font-semibold text-slate-800 mb-2">{consultRequest?.title || '제목 없음'}</h4>
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
              {consultRequest?.content || '내용이 없습니다.'}
            </p>
          </div>
        </AccordionSection>

        {/* 7. 상담 메모 섹션 */}
        <AccordionSection title="상담 메모" icon={MessageSquare} defaultExpanded={false}>
          {crmNotes.length > 0 ? (
            <div className="space-y-3">
              {crmNotes.slice(0, 3).map(note => (
                <div key={note.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium">
                      {note.category}
                    </span>
                    <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(note.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-2">{note.content}</p>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {note.authorName}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 text-center py-4">
              등록된 메모가 없습니다.
            </div>
          )}
        </AccordionSection>
      </div>
    </div>
  );
};
