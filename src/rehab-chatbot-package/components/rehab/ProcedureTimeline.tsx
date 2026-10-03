/**
 * 개인회생 절차 타임라인 컴포넌트
 * 애니메이션과 시각적 요소를 활용한 절차 안내
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    Scale,
    ClipboardList,
    CheckCircle2,
    Wallet,
    Award,
    ChevronDown,
    ChevronUp,
    Clock,
    AlertCircle
} from 'lucide-react';

interface ProcedureStep {
    id: number;
    title: string;
    description: string;
    duration: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    warning: string;
}

const PROCEDURE_STEPS: ProcedureStep[] = [
    {
        id: 1,
        title: '서류 준비 및 신청',
        description: '변호사와 함께 필요한 서류를 모아 법원에 정식 접수해요',
        duration: '1~2주',
        icon: <FileText className="w-5 h-5 text-blue-600" />,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 border-blue-200',
        warning: '소득 증빙(원천징수영수증), 재산 목록(통장·보험·차량), 빚 목록(어디서 얼마 빌렸는지)을 빠짐없이 준비해야 해요. 변호사가 도와줍니다.'
    },
    {
        id: 2,
        title: '금지명령 결정 → 독촉 즉시 STOP',
        description: '신청 후 3~7일이면 모든 독촉 전화·문자·방문이 법적으로 전면 금지돼요',
        duration: '3~7일',
        icon: <Scale className="w-5 h-5 text-indigo-600" />,
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50 border-indigo-200',
        warning: '금지명령이 나오기 전까지는 독촉이 올 수 있어요. 당황하지 말고 "법원에 회생 접수했습니다"라고 사건번호를 말씀하세요. 금지명령 후 독촉하면 불법 처벌 대상입니다.'
    },
    {
        id: 3,
        title: '보정권고 & 개시결정',
        description: '법원에서 서류를 정밀 검토하고 소명 자료를 확인해요',
        duration: '1~5개월',
        icon: <ClipboardList className="w-5 h-5 text-purple-600" />,
        color: 'text-purple-700',
        bgColor: 'bg-purple-50 border-purple-200',
        warning: '법원이 추가 서류(통장 거래내역 등)를 요구하면 기한 내에 내야 해요. 기한이 촉박하면 연장 신청을 하면 되니 걱정 마세요. 담당 변호사가 대신 처리해 드립니다.'
    },
    {
        id: 4,
        title: '인가 결정 (법원 최종 승인)',
        description: '법원이 변제계획을 승인하고 공식 효력이 발생해요',
        duration: '1~2개월',
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50 border-emerald-200',
        warning: '인가가 나오면 법원 전용 가상계좌가 발급돼요. 이 계좌에 매달 변제금을 넣으면 됩니다. 기존 급여·통장 압류도 전면 해제 신청이 가능해집니다.'
    },
    {
        id: 5,
        title: '변제금 성실 납부 (꾸준히 갚기)',
        description: '정해진 월 변제금을 법원 계좌에 꾸준히 납부해요',
        duration: '3~5년',
        icon: <Wallet className="w-5 h-5 text-amber-600" />,
        color: 'text-amber-700',
        bgColor: 'bg-amber-50 border-amber-200',
        warning: '1~2회 밀려도 바로 취소되지 않아요. 실직이나 질병 시 "납부유예 신청서"를 제출하면 유예가 가능합니다. 연락 두절만 피하시고 사무소와 상의하세요.'
    },
    {
        id: 6,
        title: '🎉 면책 결정 (빚 완전 탕감 & 새 출발!)',
        description: '변제를 다 마치면 남은 빚의 법적 책임이 영구 면제돼요',
        duration: '2~4주',
        icon: <Award className="w-5 h-5 text-rose-600" />,
        color: 'text-rose-700',
        bgColor: 'bg-rose-50 border-rose-200',
        warning: '마지막 회차 납부 후 법원에 면책신청서를 내면 2~4주 안에 면책결정이 나와요. 한국신용정보원의 1301 공공정보가 완전 삭제되고 신용점수가 700~800점대로 급상승합니다!'
    }
];

interface ProcedureTimelineProps {
    processingMonths?: number;
    currentStage?: number;
}

export const ProcedureTimeline: React.FC<ProcedureTimelineProps> = ({ processingMonths, currentStage }) => {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    const toggleStep = (stepId: number) => {
        setExpandedStep(expandedStep === stepId ? null : stepId);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1E3A5F]" />
                    <span>개인회생 수임 및 절차 로드맵</span>
                </h4>
                {processingMonths && (
                    <span className="text-xs text-[#1E3A5F] bg-blue-50 border border-blue-200 font-bold px-2.5 py-0.5 rounded-full font-mono">
                        예상 개시결정: ~{processingMonths}개월
                    </span>
                )}
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Connecting Line */}
                <div className="absolute left-[20px] top-6 bottom-6 w-0.5 bg-slate-200" />

                {/* Steps */}
                <div className="space-y-3">
                    {PROCEDURE_STEPS.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <div
                                role="button"
                                tabIndex={0}
                                aria-expanded={expandedStep === step.id}
                                className="relative pl-12 cursor-pointer focus-visible:outline-none"
                                onClick={() => toggleStep(step.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleStep(step.id);
                                    }
                                }}
                            >
                                {/* Step Icon Box */}
                                <div
                                    className={`
                                        absolute left-0 top-1 w-10 h-10 rounded-xl
                                        ${step.bgColor}
                                        flex items-center justify-center
                                        border shadow-2xs transition-transform active:scale-95
                                    `}
                                >
                                    {step.icon}
                                    {/* Step Number Badge */}
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#1E3A5F] text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                                        {step.id}
                                    </span>
                                </div>

                                {/* Step Card (High Contrast White Card) */}
                                <div className={`
                                    p-3.5 rounded-xl bg-white border transition-all duration-200
                                    ${expandedStep === step.id 
                                        ? 'border-[#1E3A5F] shadow-sm ring-1 ring-[#1E3A5F]/10' 
                                        : 'border-slate-200/90 shadow-2xs hover:border-slate-300 hover:bg-slate-50/50'
                                    }
                                `}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h5 className="text-sm font-bold text-slate-900 truncate">
                                                    {step.title}
                                                </h5>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                                                {step.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-mono font-bold">
                                                {step.duration}
                                            </span>
                                            <motion.div
                                                animate={{ rotate: expandedStep === step.id ? 180 : 0 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <ChevronDown className="w-4 h-4 text-slate-400" />
                                            </motion.div>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    <AnimatePresence>
                                        {expandedStep === step.id && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 pt-3 border-t border-slate-100">
                                                    <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2 leading-relaxed">
                                                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                                        <div>
                                                            <strong className="block font-bold mb-0.5 text-amber-950">💡 알아두면 안심되는 실무 팁:</strong>
                                                            <span>{step.warning}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Total Timeline Summary */}
            <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1E3A5F]">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">전체 예상 절차 기간</p>
                            <p className="text-sm font-bold text-slate-900">
                                서류 접수부터 최종 면책까지 약 <span className="text-[#1E3A5F] font-black">3~5년</span>
                            </p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right">
                        <p className="text-xs text-slate-500 font-medium">매달 변제금 납부 기간</p>
                        <p className="text-sm font-bold text-emerald-700">36개월 (원칙) ~ 최대 60개월</p>
                    </div>
                </div>

                {/* Progress Bar Visualization */}
                <div className="pt-2 border-t border-slate-100">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                            className="h-full bg-[#1E3A5F] rounded-full"
                        />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 font-medium">
                        <span>🚀 신청 접수</span>
                        <span>🛡️ 독촉 멈춤(3~7일)</span>
                        <span>⚖️ 법원 인가(6~10개월)</span>
                        <span>🎉 빚 완전 면책!</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProcedureTimeline;
