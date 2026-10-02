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
        description: '변호사와 함께 필요한 서류를 모아 법원에 접수해요',
        duration: '1~2주',
        icon: <FileText className="w-5 h-5" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        warning: '소득 증빙(원천징수영수증), 재산 목록(통장·보험·차량), 빚 목록(어디서 얼마 빌렸는지)을 빠짐없이 준비해야 해요. 변호사가 도와줍니다.'
    },
    {
        id: 2,
        title: '금지명령 신청 → 독촉 STOP',
        description: '신청 후 3~7일이면 독촉 전화·문자·방문이 법적으로 금지돼요',
        duration: '3~7일',
        icon: <Scale className="w-5 h-5" />,
        color: 'text-indigo-400',
        bgColor: 'bg-indigo-500/20',
        warning: '금지명령이 나오기 전까지는 독촉이 올 수 있어요. 당황하지 말고 "회생 신청했습니다"라고 말씀하세요. 금지명령 후 독촉하면 처벌 대상이에요.'
    },
    {
        id: 3,
        title: '보정 & 개시결정',
        description: '법원에서 서류를 검토하고 추가 자료를 요청할 수 있어요',
        duration: '1~5개월',
        icon: <ClipboardList className="w-5 h-5" />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        warning: '법원이 추가 서류(통장 거래내역 소명 등)를 요구하면 기한 내에 내야 해요. 기한을 넘기면 연장 신청을 하면 되니 걱정 마세요. 변호사가 대신 처리해 줍니다.'
    },
    {
        id: 4,
        title: '인가 결정 (법원 승인)',
        description: '법원이 변제계획을 최종 승인하면 매달 변제금을 납부 시작!',
        duration: '1~2개월',
        icon: <CheckCircle2 className="w-5 h-5" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        warning: '인가가 나면 법원 전용 가상계좌가 발급돼요. 이 계좌에 매달 변제금을 넣으면 됩니다. 기존 압류도 해제 신청이 가능해져요.'
    },
    {
        id: 5,
        title: '변제금 납부 (꾸준히 갚기)',
        description: '정해진 금액을 매달 꾸준히 납부하면 돼요',
        duration: '3~5년',
        icon: <Wallet className="w-5 h-5" />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
        warning: '1~2회 밀려도 바로 취소되진 않아요. 실직이나 질병 시 "납부유예 신청서"를 내면 유예가 가능합니다. 중요한 건 연락 없이 안 내는 것만 피하세요.'
    },
    {
        id: 6,
        title: '🎉 면책 결정 (빚에서 해방!)',
        description: '변제를 다 마치면 남은 빚의 책임이 면제돼요. 새 출발!',
        duration: '수주',
        icon: <Award className="w-5 h-5" />,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        warning: '마지막 회차 납부 후 법원에 면책신청서를 내면 2~4주 안에 면책결정이 나와요. 이후 신용점수가 빠르게 올라가고 신용카드 발급도 가능해집니다!'
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
                <div className="absolute left-[22px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 via-cyan-500 via-green-500 via-orange-500 to-yellow-500 opacity-30" />

                {/* Steps */}
                <div className="space-y-3">
                    {PROCEDURE_STEPS.map((step, index) => (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            {/* 펼치기 단추: 키보드(Enter·Space)로도 열고 닫는다 (이전: div onClick만 있어 키보드로 열 수 없었음) */}
                            <div
                                role="button"
                                tabIndex={0}
                                aria-expanded={expandedStep === step.id}
                                className={`
                                    relative pl-12 cursor-pointer rounded-xl
                                    transition-all duration-300
                                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
                                `}
                                onClick={() => toggleStep(step.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleStep(step.id);
                                    }
                                }}
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
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-slate-800 rounded-full text-[12px] font-bold flex items-center justify-center border border-white/20">
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
                                            <p className="text-xs text-slate-500 mt-0.5">
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
                                                <ChevronDown className="w-4 h-4 text-slate-500" />
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
                className="mt-4 p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">전체 예상 기간</p>
                            <p className="text-sm font-bold text-white">신청~면책 약 <span className="text-cyan-400">4~6년</span></p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-500">매달 갚는 기간</p>
                        <p className="text-sm font-bold text-green-400">3~5년</p>
                    </div>
                </div>

                {/* Progress Bar Visualization */}
                <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2, ease: 'easeOut', delay: 1 }}
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 via-cyan-500 via-green-500 via-orange-500 to-yellow-500"
                    />
                </div>
                <div className="flex justify-between mt-1 text-[12px] text-slate-600">
                    <span>신청</span>
                    <span>독촉 멈춤</span>
                    <span>법원 승인</span>
                    <span>갚기 완료</span>
                    <span>🎉 빚 해방</span>
                </div>
            </motion.div>
        </div>
    );
};

export default ProcedureTimeline;
