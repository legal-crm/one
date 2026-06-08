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
        description: '채무자 재정 상태 파악 및 서류 제출',
        duration: '1~2주',
        icon: <FileText className="w-5 h-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        warning: '소득 증빙, 재산 목록, 채권자 목록 등 필수 서류를 빠짐없이 준비해야 합니다.'
    },
    {
        id: 2,
        title: '법원 심사 및 개시 결정',
        description: '법원에서 신청서류 검토 후 개시 결정',
        duration: '1~2개월',
        icon: <Scale className="w-5 h-5" />,
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        warning: '추가 서류 제출이나 보정이 요구될 수 있으며, 보정명령 시 신속한 대응이 필요합니다.'
    },
    {
        id: 3,
        title: '변제계획안 제출 및 심사',
        description: '월 변제액, 변제 기간 등 계획안 제출',
        duration: '1~2개월',
        icon: <ClipboardList className="w-5 h-5" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        warning: '현실적인 소득과 지출을 반영해야 합니다. 과도한 변제액 설정은 인가 거부 사유가 됩니다.'
    },
    {
        id: 4,
        title: '인가 결정',
        description: '법원에서 변제계획안 승인',
        duration: '1~2개월',
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        warning: '이의가 제기되면 인가가 지연될 수 있습니다. 채권자 협의가 중요합니다.'
    },
    {
        id: 5,
        title: '변제 이행',
        description: '승인된 변제계획에 따라 채무 변제',
        duration: '3~5년',
        icon: <Wallet className="w-5 h-5" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        warning: '성실히 변제해야 하며, 중도 변제 불능 시 회생 취소 사유가 됩니다.'
    },
    {
        id: 6,
        title: '면책 결정',
        description: '변제 완료 후 채무 면책 결정',
        duration: '수개월',
        icon: <Award className="w-5 h-5" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        warning: '면책 결정을 받아야 채무가 최종 면제됩니다. 면책 전까지는 일부 채무가 남을 수 있습니다.'
    }
];

interface ProcedureTimelineProps {
    processingMonths?: number;
}

export const ProcedureTimeline: React.FC<ProcedureTimelineProps> = ({ processingMonths }) => {
    const [expandedStep, setExpandedStep] = useState<number | null>(null);

    const toggleStep = (stepId: number) => {
        setExpandedStep(expandedStep === stepId ? null : stepId);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    개인회생 절차 안내
                </h4>
                {processingMonths && (
                    <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-full">
                        예상 개시결정: ~{processingMonths}개월
                    </span>
                )}
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Connecting Line */}
                <div className="absolute left-[22px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 via-cyan-500 via-green-500 via-orange-500 to-yellow-500 opacity-30" />

                {/* Steps */}
                <div className="space-y-3">
                    {PROCEDURE_STEPS.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <div
                                className={`
                                    relative pl-12 cursor-pointer
                                    transition-all duration-300
                                `}
                                onClick={() => toggleStep(step.id)}
                            >
                                {/* Step Icon */}
                                <motion.div
                                    className={`
                                        absolute left-0 top-0 w-11 h-11 rounded-xl
                                        ${step.bgColor} ${step.color}
                                        flex items-center justify-center
                                        border border-white/10
                                        shadow-lg
                                    `}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                    animate={expandedStep === step.id ? {
                                        boxShadow: `0 0 20px ${step.color.replace('text-', '').replace('-400', '')}40`
                                    } : {}}
                                >
                                    {step.icon}
                                    {/* Step Number Badge */}
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-800 rounded-full text-[10px] font-bold flex items-center justify-center border border-white/20">
                                        {step.id}
                                    </span>
                                </motion.div>

                                {/* Step Content */}
                                <div className={`
                                    p-3 rounded-xl
                                    bg-slate-800/50 border border-white/5
                                    hover:bg-slate-800/70 hover:border-white/10
                                    transition-all duration-300
                                    ${expandedStep === step.id ? 'bg-slate-800/70 border-white/10' : ''}
                                `}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h5 className={`text-sm font-semibold ${step.color}`}>
                                                {step.title}
                                            </h5>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {step.description}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-white bg-white/10 px-2 py-1 rounded-lg font-medium">
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
                                                <div className="mt-3 pt-3 border-t border-white/5">
                                                    <div className="flex items-start gap-2">
                                                        <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                                        <p className="text-xs text-yellow-200/80">
                                                            {step.warning}
                                                        </p>
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
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">총 예상 소요기간</p>
                            <p className="text-sm font-bold text-white">신청~면책 약 <span className="text-cyan-400">4~6년</span></p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400">변제 기간</p>
                        <p className="text-sm font-bold text-green-400">3~5년</p>
                    </div>
                </div>

                {/* Progress Bar Visualization */}
                <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, ease: 'easeOut', delay: 1 }}
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 via-cyan-500 via-green-500 via-orange-500 to-yellow-500"
                    />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-slate-500">
                    <span>신청</span>
                    <span>개시결정</span>
                    <span>인가</span>
                    <span>변제완료</span>
                    <span>면책</span>
                </div>
            </motion.div>
        </div>
    );
};

export default ProcedureTimeline;
