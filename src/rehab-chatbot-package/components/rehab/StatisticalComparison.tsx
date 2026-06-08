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
        green: { bg: 'from-green-500/10 to-emerald-600/10', border: 'border-green-500/30', text: 'text-green-700', badge: 'bg-green-500/20 text-green-700' },
        blue: { bg: 'from-blue-500/10 to-cyan-600/10', border: 'border-blue-500/30', text: 'text-blue-700', badge: 'bg-blue-500/20 text-blue-700' },
        yellow: { bg: 'from-yellow-500/10 to-orange-600/10', border: 'border-yellow-500/30', text: 'text-amber-700', badge: 'bg-yellow-500/20 text-amber-700' },
        red: { bg: 'from-red-500/10 to-pink-600/10', border: 'border-red-500/30', text: 'text-red-700', badge: 'bg-red-500/20 text-red-700' }
    };

    const colors = colorMap[percentile.color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl bg-gradient-to-br ${colors.bg} border ${colors.border}`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${colors.badge}`}>
                        {icon}
                    </div>
                    <h4 className="text-sm font-bold text-gray-800">{title}</h4>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${colors.badge} font-bold`}>
                    {percentile.message}
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <span className="text-xs text-gray-600">귀하의 {title}</span>
                    <span className={`text-lg font-bold ${colors.text}`}>
                        {typeof userValue === 'number' ? formatCurrency(userValue) : userValue}{unit}
                    </span>
                </div>

                {averageValue && (
                    <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600">평균</span>
                        <span className="text-sm text-gray-700">
                            {typeof averageValue === 'number' ? formatCurrency(averageValue) : averageValue}{unit}
                        </span>
                    </div>
                )}

                {/* Animated Progress Bar */}
                <div className="mt-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentile.percentile}%` }}
                            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                            className={`h-full bg-gradient-to-r ${colors.bg.replace('/10', '/50')}`}
                        />
                    </div>
                    <p className="text-xs text-gray-600 mt-1 text-right">
                        상위 {(100 - percentile.percentile).toFixed(0)}%
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
    const color = isNeutral ? 'text-slate-400' : isPositive ? 'text-green-400' : 'text-red-400';
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
            <span className="text-xs text-slate-400">{label}</span>
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
                <span className="text-xs text-slate-400">vs</span>
                <span className="text-xs text-slate-400">{format(averageValue)}</span>
                <TrendIndicator value={userValue} average={averageValue} label="" />
            </div>
        </div>
    );
};
