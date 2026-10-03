/**
 * 통계 비교 인포그래픽 컴포넌트
 * 애니메이션과 시각적 요소를 활용한 사용자 데이터 vs 통계 비교
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Users, DollarSign, Percent, Award } from 'lucide-react';
import { PercentileResult } from '../../utils/statisticsUtils';
import { formatCurrency } from '../../services/calculationService';

interface StatComparisonCardProps {
    title: string;
    userValue: string | number;
    averageValue?: string | number;
    percentile: PercentileResult;
    icon: React.ReactNode;
    unit?: string;
}

/**
 * 통계 비교 카드 컴포넌트
 */
export const StatComparisonCard: React.FC<StatComparisonCardProps> = ({
    title,
    userValue,
    averageValue,
    percentile,
    icon,
    unit = ''
}) => {
    const colorMap = {
        green: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', text: 'text-slate-900', bar: 'bg-emerald-600' },
        blue: { badge: 'bg-blue-50 text-blue-700 border border-blue-200', text: 'text-slate-900', bar: 'bg-[#1E3A5F]' },
        yellow: { badge: 'bg-amber-50 text-amber-700 border border-amber-200', text: 'text-slate-900', bar: 'bg-amber-500' },
        red: { badge: 'bg-slate-100 text-slate-700 border border-slate-200', text: 'text-slate-900', bar: 'bg-slate-700' }
    };

    const colors = colorMap[percentile.color] || colorMap.blue;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[#1E3A5F]">
                        {icon}
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">{title}</h4>
                </div>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${colors.badge}`}>
                    {percentile.message}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-500 font-medium">귀하의 {title}</span>
                    <span className={`text-base sm:text-lg font-black ${colors.text} font-mono`}>
                        {typeof userValue === 'number' ? formatCurrency(userValue) : userValue}{unit}
                    </span>
                </div>

                {averageValue && (
                    <div className="flex justify-between items-baseline pt-1 border-t border-slate-100">
                        <span className="text-xs text-slate-400 font-medium">평균 (사법연감 통계)</span>
                        <span className="text-xs text-slate-600 font-semibold font-mono">
                            {typeof averageValue === 'number' ? formatCurrency(averageValue) : averageValue}{unit}
                        </span>
                    </div>
                )}

                {/* Animated Progress Bar */}
                <div className="mt-2.5 pt-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, Math.max(5, percentile.percentile))}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                            className={`h-full ${colors.bar} rounded-full`}
                        />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5 text-right font-medium">
                        전체 신청자 중 상위 <strong className="text-slate-800 font-bold font-mono">{(100 - percentile.percentile).toFixed(0)}%</strong> 위치
                    </p>
                </div>
            </div>
        </motion.div>
    );
};

interface DistributionBarProps {
    title: string;
    userValue: number;
    distribution: { range: string; percentage: number }[];
    highlightRange: string;
}

/**
 * 분포 막대 그래프 컴포넌트
 */
export const DistributionBar: React.FC<DistributionBarProps> = ({
    title,
    userValue,
    distribution,
    highlightRange
}) => {
    return (
        <div className="p-4 rounded-xl bg-gray-100 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-800 mb-3">{title} 분포</h4>

            <div className="space-y-2">
                {distribution.map((item, index) => {
                    const isUserRange = item.range === highlightRange;

                    return (
                        <div key={index} className="relative">
                            <div className="flex justify-between text-xs mb-1">
                                <span className={isUserRange ? 'text-blue-700 font-bold' : 'text-gray-600'}>
                                    {item.range}
                                    {isUserRange && ' ← 귀하'}
                                </span>
                                <span className="text-gray-700">{item.percentage}%</span>
                            </div>
                            <div className="h-6 bg-gray-200 rounded overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.percentage}%` }}
                                    transition={{ duration: 0.8, delay: index * 0.1 }}
                                    className={`h-full ${isUserRange
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                                        : 'bg-gray-400'
                                        }`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface TrendIndicatorProps {
    value: number;
    average: number;
    label: string;
}

/**
 * 트렌드 인디케이터 컴포넌트
 */
export const TrendIndicator: React.FC<TrendIndicatorProps> = ({ value, average, label }) => {
    const diff = ((value - average) / average) * 100;
    const isPositive = diff > 0;
    const isNeutral = Math.abs(diff) < 5;

    const Icon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
    const color = isNeutral ? 'text-slate-500' : isPositive ? 'text-green-400' : 'text-red-400';
    const bgColor = isNeutral ? 'bg-slate-500/20' : isPositive ? 'bg-green-500/20' : 'bg-red-500/20';

    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.2 }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${bgColor}`}
        >
            <Icon className={`w-4 h-4 ${color}`} />
            <span className={`text-xs font-bold ${color}`}>
                {isNeutral ? '평균' : `${isPositive ? '+' : ''}${diff.toFixed(0)}%`}
            </span>
            <span className="text-xs text-slate-500">{label}</span>
        </motion.div>
    );
};

interface PercentileBadgeProps {
    percentile: number;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * 백분위 배지 컴포넌트
 */
export const PercentileBadge: React.FC<PercentileBadgeProps> = ({ percentile, size = 'md' }) => {
    const sizeClasses = {
        sm: 'w-12 h-12 text-xs',
        md: 'w-16 h-16 text-sm',
        lg: 'w-20 h-20 text-base'
    };

    const color = percentile >= 75 ? 'from-green-500 to-emerald-600' :
        percentile >= 50 ? 'from-blue-500 to-cyan-600' :
            percentile >= 25 ? 'from-yellow-500 to-orange-600' : 'from-red-500 to-pink-600';

    return (
        <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, delay: 0.3 }}
            className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${color} flex flex-col items-center justify-center shadow-lg`}
        >
            <Award className="w-5 h-5 text-white mb-0.5" />
            <span className="text-white font-bold">상위</span>
            <span className="text-white font-bold">{(100 - percentile).toFixed(0)}%</span>
        </motion.div>
    );
};

interface ComparisonMetricProps {
    label: string;
    userValue: number;
    averageValue: number;
    format?: (value: number) => string;
}

/**
 * 비교 메트릭 컴포넌트
 */
export const ComparisonMetric: React.FC<ComparisonMetricProps> = ({
    label,
    userValue,
    averageValue,
    format = (v) => v.toString()
}) => {
    const diff = userValue - averageValue;
    const diffPercent = ((diff / averageValue) * 100).toFixed(0);
    const isHigher = diff > 0;

    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
            <span className="text-sm text-slate-300">{label}</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{format(userValue)}</span>
                <span className="text-xs text-slate-500">vs</span>
                <span className="text-xs text-slate-500">{format(averageValue)}</span>
                <TrendIndicator value={userValue} average={averageValue} label="" />
            </div>
        </div>
    );
};
