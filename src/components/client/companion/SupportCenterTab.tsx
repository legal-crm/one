import React, { useState, useEffect } from 'react';
import { 
  Shield, ExternalLink, Phone, HeartHandshake, Landmark, DollarSign, 
  AlertTriangle, CheckCircle2, ChevronRight, HelpCircle, Sparkles, 
  MapPin, Check, Award, Lightbulb, Home, Briefcase, Zap, Globe
} from 'lucide-react';
import { 
  loadRehabCompanionCase, 
  getRecommendedBenefits, 
  fetchLiveBenefitsFromApi,
  OFFICIAL_SUPPORT_PROGRAMS 
} from '../../../services/companionService';
import { RehabCompanionCase, SupportProgram, SupportCategoryType } from '../../../types';

interface SupportCenterTabProps {
  caseData?: RehabCompanionCase;
}

export default function SupportCenterTab({ caseData }: SupportCenterTabProps) {
  const currentCase = caseData || loadRehabCompanionCase();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('stage_matched');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [isLiveApi, setIsLiveApi] = useState<boolean>(false);
  const [livePrograms, setLivePrograms] = useState<SupportProgram[] | null>(null);

  // 실시간 공공데이터포털 API 연동 시도
  useEffect(() => {
    const stage = currentCase.caseStage || (currentCase.completedRounds > 0 ? 'approved' : 'submitted');
    fetchLiveBenefitsFromApi(stage, selectedCategory, selectedRegion, currentCase.completedRounds || 0)
      .then(res => {
        setIsLiveApi(res.isLiveApi);
        if (res.isLiveApi && res.programs?.length > 0) {
          setLivePrograms(res.programs);
        }
      });
  }, [currentCase.caseStage, currentCase.completedRounds, selectedCategory, selectedRegion]);

  // 추천 엔진 결과 가져오기 (실시간 수신 데이터가 있으면 병합)
  const basePrograms = (isLiveApi && livePrograms) ? livePrograms : OFFICIAL_SUPPORT_PROGRAMS;
  const { programs: scoredPrograms, stageMatchedCount } = getRecommendedBenefits(
    currentCase, 
    selectedCategory === 'stage_matched' ? 'all' : selectedCategory, 
    selectedRegion
  );

  // '내 단계 맞춤' 탭일 때는 단계 매칭 상품만 노출
  const displayPrograms = selectedCategory === 'stage_matched'
    ? scoredPrograms.filter(prog => {
        const stage = currentCase.caseStage || (currentCase.completedRounds > 0 ? 'approved' : 'submitted');
        const isStage = prog.targetStages ? prog.targetStages.includes(stage) : true;
        const isRound = prog.minCompletedRounds !== undefined ? (currentCase.completedRounds || 0) >= prog.minCompletedRounds : true;
        return isStage && isRound;
      })
    : scoredPrograms;

  // 현재 사건 단계 레이블
  const getStageLabel = () => {
    const stage = currentCase.caseStage || (currentCase.completedRounds > 0 ? 'approved' : 'submitted');
    switch (stage) {
      case 'preparing': return '신청 준비 (채무 조정 및 긴급 생계 지원 단계)';
      case 'submitted': return '법원 접수 (사건 심리 및 보정명령 단계)';
      case 'started': return '개시 결정 (변제계획안 검토 및 집회 단계)';
      case 'approved': return `변제계획 인가 (${currentCase.completedRounds || 0}회차 성실 납부 수행 중)`;
      case 'completed': return '변제 완료 (성공적 완주 및 면책 확정 단계)';
      default: return '변제 수행 중';
    }
  };

  const isEligibleForKinfaLoan = (currentCase.completedRounds || 0) >= 6;

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      
      {/* ═══ 1. 헤더: 내 회생 단계 맞춤 추천 안내 배너 ═══ */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold bg-brand/20 text-brand-light border border-brand/30 px-3 py-1 rounded-full uppercase tracking-wider">
              국가 공적 복지 & 정책금융 큐레이션
            </span>
            <span className="text-[11px] font-bold bg-white/10 text-white/90 px-3 py-1 rounded-full">
              {getStageLabel()}
            </span>
            <span className={`text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
              isLiveApi 
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                : 'bg-white/10 text-slate-300 border border-white/10'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isLiveApi ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
              <span>{isLiveApi ? '공공데이터포털 실시간 연동 가동' : '공식 공공데이터 기준 검증 16선'}</span>
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-black leading-tight">
            현재 회생 시기에 <span className="text-brand-light">지원받을 수 있는 공적 혜택</span>을 확인하세요
          </h2>
          
          <p className="text-xs text-slate-300 leading-relaxed">
            마이김변은 대부업체나 고금리 금융상품을 일체 배제합니다. 행정안전부, 보건복지부, 서민금융진흥원 등 공식 공공데이터를 기반으로 의뢰인님의 진행 단계에 맞는 무상 복지와 저금리 정책금융을 우선순위별로 선별 안내합니다.
          </p>
        </div>

        {/* 성실납부 6회차 이상 시 특례 배너 카드 */}
        {isEligibleForKinfaLoan && (
          <div className="mt-5 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-white">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0 mt-0.5">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <span>🎖️ 성실 납부 6개월 돌파 특례 안내</span>
                </span>
                <p className="text-xs text-emerald-100/90 mt-0.5">
                  개인회생 인가 후 6회차 이상 성실 상환 중이시므로 <strong className="text-white underline decoration-emerald-400">서민금융진흥원 소액대출(연 2~4% 저금리, 최대 700만 원)</strong> 공적 검토 대상입니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCategory('diligent_repayment_loan')}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
            >
              제도 상세 보기 ➔
            </button>
          </div>
        )}
      </div>

      {/* ═══ 2. 카테고리 & 지역 다차원 필터 바 ═══ */}
      <div className="space-y-3">
        {/* 상단 1열: 카테고리 필터 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('stage_matched')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'stage_matched'
                ? 'bg-brand text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>🎯 내 단계 맞춤 추천 ({stageMatchedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            전체 제도 ({OFFICIAL_SUPPORT_PROGRAMS.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('welfare_emergency')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'welfare_emergency'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-emerald-600 border border-emerald-200 dark:border-emerald-800/60'
            }`}
          >
            <span>🥇 1순위: 무상·긴급복지</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('public_debt_credit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'public_debt_credit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-blue-600 border border-blue-200 dark:border-blue-800/60'
            }`}
          >
            <span>🥈 2순위: 공적 채무·법률</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('diligent_repayment_loan')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'diligent_repayment_loan'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-purple-600 border border-purple-200 dark:border-purple-800/60'
            }`}
          >
            <span>🥉 3순위: 성실상환 정책금융</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('cost_reduction')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'cost_reduction'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-amber-600 border border-amber-200 dark:border-amber-800/60'
            }`}
          >
            <span>💡 4순위: 생활비·공과금 감면</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('housing_job')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'housing_job'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-indigo-600 border border-indigo-200 dark:border-indigo-800/60'
            }`}
          >
            <span>🏠 5순위: 주거·취업·자산</span>
          </button>
        </div>

        {/* 하단 2열: 지역 필터 */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold flex items-center gap-1 shrink-0">
            <MapPin className="w-3.5 h-3.5" />
            <span>지역:</span>
          </span>
          {['all', '서울/경기', '지방'].map((reg) => (
            <button
              key={reg}
              type="button"
              onClick={() => setSelectedRegion(reg)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                selectedRegion === reg
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
              }`}
            >
              {reg === 'all' ? '전국 공통' : reg}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 3. 공적 지원 프로그램 카드 그리드 ═══ */}
      {displayPrograms.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            선택하신 조건에 해당하는 제도가 없습니다.
          </p>
          <button
            type="button"
            onClick={() => { setSelectedCategory('all'); setSelectedRegion('all'); }}
            className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl shadow-sm"
          >
            전체 제도 보기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayPrograms.map((prog) => {
            const isStageFit = prog.targetStages 
              ? prog.targetStages.includes(currentCase.caseStage || 'approved')
              : true;

            return (
              <div
                key={prog.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between gap-5 text-left group"
              >
                <div className="space-y-3">
                  
                  {/* 상단 뱃지 & 기관 */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        prog.priority === 1 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' :
                        prog.priority === 2 ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800' :
                        prog.priority === 3 ? 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-800' :
                        prog.priority === 4 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' :
                        'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                      }`}>
                        {prog.badge}
                      </span>

                      {isStageFit && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand/10 text-brand dark:text-brand-light flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>현재 단계 적합</span>
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-500 font-semibold">{prog.organization}</span>
                  </div>

                  {/* 제목 및 부제 */}
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug group-hover:text-brand transition-colors">
                      {prog.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {prog.subtitle}
                    </p>
                  </div>

                  {/* 태그 목록 */}
                  {prog.criteriaTags && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {prog.criteriaTags.map(tag => (
                        <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 요건 & 혜택 박스 */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                        🎯 지원 대상 및 자격 요건
                      </span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {prog.eligibility}
                      </p>
                    </div>

                    <div className="bg-brand/5 dark:bg-brand/10 p-3 rounded-2xl space-y-1 border border-brand/10">
                      <span className="text-[11px] font-bold text-brand dark:text-brand-light block">
                        🎁 주요 지원 혜택
                      </span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                        {prog.benefit}
                      </p>
                    </div>

                    {prog.safetyNotice && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl">
                        * {prog.safetyNotice}
                      </p>
                    )}
                  </div>

                </div>

                {/* 하단 공식 링크 & 전화 */}
                <div className="pt-3 border-t border-slate-150 dark:border-slate-800 flex items-center justify-between gap-3">
                  <a
                    href={`tel:${prog.contactNumber.replace(/[^0-9]/g, '')}`}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-brand transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{prog.contactNumber}</span>
                  </a>

                  <a
                    href={prog.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-brand dark:hover:bg-brand-light text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                  >
                    <span>공식 신청·안내</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ═══ 4. 규제 및 안전 고지문 ═══ */}
      <div className="p-5 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 space-y-2 leading-relaxed">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>공적 지원 및 정책금융 제도 안내에 관한 투명 고지</span>
        </div>
        <p>
          마이김변에 안내된 지원제도는 각 주관기관(행정안전부, 보건복지부, 고용노동부, 신용회복위원회, 서민금융진흥원 등)의 공식 공개 기준을 바탕으로 제공되는 정보입니다.
          실제 지원 자격 및 금융상품 승인 여부는 주관기관의 고유 심사를 통해 결정되며, 마이김변은 대출을 확정·보장하거나 어떠한 중개 수수료도 수취하지 않습니다.
        </p>
      </div>

    </div>
  );
}
