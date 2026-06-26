import React, { useState } from 'react';
import { X, Copy, Share2, Shield, ArrowRight, MessageSquare, Check } from 'lucide-react';
import { encryptReport } from '../../utils';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface ReportShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: RehabCalculationResult;
    userInput: RehabUserInput;
}

export default function ReportShareModal({ isOpen, onClose, result, userInput }: ReportShareModalProps) {
    const [pin, setPin] = useState('');
    const [step, setStep] = useState<'setup' | 'result'>('setup');
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleGenerateLink = () => {
        if (pin.length !== 4 || isNaN(Number(pin))) {
            alert('비밀번호 숫자 4자리를 정확히 입력해 주세요.');
            return;
        }
        
        // 민감 정보 제거 후 압축 전송
        const payload = JSON.stringify({
            result: {
                status: result.status,
                statusReason: result.statusReason,
                debtReductionRate: result.debtReductionRate,
                totalRepayment: result.totalRepayment,
                totalDebtReduction: result.totalDebtReduction,
                liquidationValue: result.liquidationValue,
                courtName: result.courtName,
                processingMonths: result.processingMonths,
                baseLivingCost: result.baseLivingCost,
                aiAdvice: result.aiAdvice,
                preferred: (result as any).preferred
            },
            userInput: {
                name: userInput.name,
                address: userInput.address,
                age: userInput.age,
                monthlyIncome: userInput.monthlyIncome,
                totalDebt: userInput.totalDebt,
                myAssets: userInput.myAssets,
                spouseAssets: userInput.spouseAssets,
                deposit: userInput.deposit,
                familySize: userInput.familySize,
                maritalStatus: userInput.maritalStatus,
                riskFactor: userInput.riskFactor,
                speculativeLoss: userInput.speculativeLoss,
                gamblingLoss: userInput.gamblingLoss,
                legalActions: userInput.legalActions
            }
        });

        const encrypted = encryptReport(payload, pin);
        const origin = window.location.origin + window.location.pathname;
        const url = `${origin}?share=${encrypted}`;
        
        setShareUrl(url);
        setStep('result');
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSMS = () => {
        const text = `[로이 법률 CRM] 안전하게 보호된 채무 진단 보고서가 도착했습니다.\n\n비밀번호(4자리)를 입력하고 확인해보세요!\n보고서 링크: ${shareUrl}`;
        window.open(`sms:?body=${encodeURIComponent(text)}`);
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: '로이 법률 CRM 채무 진단 보고서',
                    text: '비밀번호로 보호된 채무 진단 보고서입니다.',
                    url: shareUrl
                });
            } catch (err) {
                console.error('기기 공유 실패:', err);
            }
        } else {
            handleCopy();
            alert('기기 자체 공유가 지원되지 않아 링크가 클립보드에 복사되었습니다.');
        }
    };

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col text-slate-800 dark:text-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-850">
                    <h3 className="font-bold text-sm flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        보고서 안전 보내기 & 공유
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    {step === 'setup' ? (
                        <>
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                                <Shield className="w-8 h-8" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-extrabold text-base">보안 비밀번호 설정</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    받는 사람이 안전하게 보고서를 열람할 수 있도록<br />
                                    숫자 4자리 비밀번호(PIN)를 입력해 주세요.
                                </p>
                            </div>

                            <input 
                                type="text"
                                maxLength={4}
                                pattern="[0-9]*"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="숫자 4자리 입력"
                                className="w-full text-center text-2xl tracking-[0.7em] font-bold py-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-[#7264FF] outline-none transition-colors placeholder:text-slate-350 placeholder:text-sm placeholder:tracking-normal"
                            />

                            <button
                                onClick={handleGenerateLink}
                                disabled={pin.length !== 4}
                                className="w-full py-3 bg-[#7264FF] hover:bg-[#5b4cf5] disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1"
                            >
                                <span>안전 링크 생성하기</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-full">
                                <Check className="w-8 h-8" />
                            </div>
                            <div className="space-y-1.5 w-full">
                                <h4 className="font-extrabold text-base">보안 공유 링크 생성 완료</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    설정하신 비밀번호 <strong className="text-emerald-500">[{pin}]</strong> 와 함께<br />
                                    아래의 보안 공유 링크를 전달해 주세요.
                                </p>
                            </div>

                            {/* Share Channels */}
                            <div className="grid grid-cols-2 gap-2.5 w-full">
                                <button
                                    onClick={handleCopy}
                                    className="p-3 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl transition-colors flex flex-col items-center gap-1.5 text-[11px] font-bold"
                                >
                                    {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-550" />}
                                    <span>{copied ? '복사 완료' : '링크 복사'}</span>
                                </button>
                                <button
                                    onClick={handleSMS}
                                    className="p-3 bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl transition-colors flex flex-col items-center gap-1.5 text-[11px] font-bold"
                                >
                                    <MessageSquare className="w-5 h-5 text-indigo-500" />
                                    <span>문자메시지 공유</span>
                                </button>
                                <button
                                    onClick={handleNativeShare}
                                    className="col-span-2 p-3 bg-[#7264FF]/5 hover:bg-[#7264FF]/10 border border-[#7264FF]/20 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-extrabold text-[#7264FF]"
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span>모바일/기기 기본 공유 기능 실행</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
