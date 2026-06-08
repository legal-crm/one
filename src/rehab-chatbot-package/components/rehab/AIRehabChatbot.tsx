/**
 * AI 변제금 진단 챗봇 - 메인 컴포넌트
 * 
 * 8단계 대화형 인터페이스로 개인회생 변제금 계산
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, User, Bot, ArrowRight, Check, ChevronDown } from 'lucide-react';
import { calculateRepayment, RehabUserInput, RehabCalculationResult, formatCurrency } from '../../services/calculationService';
import { DEFAULT_POLICY_CONFIG_2026, getPolicyForDate, RehabPolicyConfig } from '../../config/PolicyConfig';
import { fetchGlobalSettings } from '../../services/googleSheetService';
import RehabResultReport from './RehabResultReport';

// 대화 메시지 타입
interface ChatMessage {
    id: string;
    type: 'bot' | 'user';
    content: string;
    timestamp: Date;
    options?: ChatOption[];      // 선택 버튼
    inputType?: 'text' | 'number' | 'buttons' | 'address'; // 입력 타입
}

interface ChatOption {
    label: string;
    value: string | number;
}

// 대화 단계
type ChatStep =
    | 'intro'
    | 'address'
    | 'income'
    | 'family'
    | 'assets'
    | 'spouse_check'
    | 'spouse_assets'
    | 'debt'
    | 'risk'
    | 'contact'
    | 'result';

interface AIRehabChatbotProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (result: RehabCalculationResult, input: RehabUserInput) => void;
    characterName?: string;
    characterImage?: string;
    buttonColor?: string;
}

const DEFAULT_CHARACTER_NAME = '로이';

const AIRehabChatbot: React.FC<AIRehabChatbotProps> = ({
    isOpen,
    onClose,
    onComplete,
    characterName = DEFAULT_CHARACTER_NAME,
    characterImage,
    buttonColor = '#3B82F6'
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentStep, setCurrentStep] = useState<ChatStep>('intro');
    const [userInput, setUserInput] = useState<Partial<RehabUserInput>>({});
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [result, setResult] = useState<RehabCalculationResult | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [policyConfigs, setPolicyConfigs] = useState<Record<number, RehabPolicyConfig> | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // 스크롤 자동 이동
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 설정 로드
    useEffect(() => {
        const loadSettings = async () => {
            const settings = await fetchGlobalSettings();
            if (settings?.rehabPolicyConfigs) {
                setPolicyConfigs(settings.rehabPolicyConfigs);
            }
        };
        loadSettings();
    }, []);

    // 초기 메시지
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setTimeout(() => {
                addBotMessage(
                    `안녕하세요! 저는 당신의 새출발을 도울 AI 법률 비서 '${characterName}'입니다. 🤖\n\n3분 만에 당신의 빚이 얼마나 줄어들 수 있는지 계산해 드릴게요.\n\n비밀은 100% 보장되니 안심하세요!`,
                    [{ label: '시작하기', value: 'start' }],
                    'buttons'
                );
            }, 500);
        }
    }, [isOpen]);

    // 봇 메시지 추가
    const addBotMessage = (content: string, options?: ChatOption[], inputType?: ChatMessage['inputType']) => {
        setIsTyping(true);

        setTimeout(() => {
            const newMessage: ChatMessage = {
                id: Date.now().toString(),
                type: 'bot',
                content,
                timestamp: new Date(),
                options,
                inputType
            };

            setMessages(prev => [...prev, newMessage]);
            setIsTyping(false);

            if (inputType === 'number' || inputType === 'text' || inputType === 'address') {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }, 800);
    };

    // 사용자 메시지 추가
    const addUserMessage = (content: string) => {
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
    };

    // 다음 단계로 진행
    const processStep = (step: ChatStep, value?: string | number) => {
        switch (step) {
            case 'intro':
                setCurrentStep('address');
                addBotMessage(
                    '먼저, 정확한 법원 배정을 위해 현재 **사시는 곳**이 어디신가요?\n\n(예: 서울 강남구, 수원시 영통구)',
                    undefined,
                    'address'
                );
                break;

            case 'address':
                setUserInput(prev => ({ ...prev, address: value as string }));
                setCurrentStep('income');
                addBotMessage(
                    '숨만 쉬어도 나가는 돈이 있죠? 💸\n\n현재 매월 통장에 찍히는 **실수령 소득(세후)**은 대략 얼마인가요?\n\n(만원 단위로 입력해주세요)',
                    undefined,
                    'number'
                );
                break;

            case 'income':
                setUserInput(prev => ({ ...prev, monthlyIncome: (value as number) * 10000 }));
                setCurrentStep('family');
                addBotMessage(
                    '가족 구성원에 따라 생계비가 달라져요.\n\n**부양가족을 포함한** 가구원 수는 몇 명인가요?',
                    [
                        { label: '1인 (나만)', value: 1 },
                        { label: '2인', value: 2 },
                        { label: '3인', value: 3 },
                        { label: '4인', value: 4 },
                        { label: '5인 이상', value: 5 },
                    ],
                    'buttons'
                );
                break;

            case 'family':
                const familySize = value as number;
                setUserInput(prev => ({ ...prev, familySize }));
                setCurrentStep('assets');
                addBotMessage(
                    '거의 다 왔어요! 💪\n\n법원은 "빚"이 "재산"보다 많아야 도와준답니다.\n\n본인 명의의 **집, 차, 보증금, 예상 퇴직금** 등을 모두 합치면 대략 얼마 정도 되나요?\n\n(만원 단위, 대출금 제외 순수 가치)',
                    undefined,
                    'number'
                );
                break;

            case 'assets':
                const assets = (value as number) * 10000;
                setUserInput(prev => ({ ...prev, myAssets: assets, deposit: assets * 0.5 })); // 보증금은 재산의 50%로 가정
                setCurrentStep('spouse_check');
                addBotMessage(
                    '혹시 결혼하셨나요? 💍',
                    [
                        { label: '네, 기혼이에요', value: 'married' },
                        { label: '아니요, 미혼이에요', value: 'single' },
                    ],
                    'buttons'
                );
                break;

            case 'spouse_check':
                const isMarried = value === 'married';
                setUserInput(prev => ({ ...prev, isMarried }));

                if (isMarried) {
                    setCurrentStep('spouse_assets');
                    addBotMessage(
                        '배우자분의 재산은 어느 정도인가요?\n\n(만원 단위)',
                        undefined,
                        'number'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, spouseAssets: 0 }));
                    setCurrentStep('debt');
                    addBotMessage(
                        '이제 무거운 짐을 내려놓을 시간이에요. 😌\n\n**이자와 원금을 합친 총 채무 금액**은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'number'
                    );
                }
                break;

            case 'spouse_assets':
                setUserInput(prev => ({ ...prev, spouseAssets: (value as number) * 10000 }));
                setCurrentStep('debt');
                addBotMessage(
                    '이제 무거운 짐을 내려놓을 시간이에요. 😌\n\n**이자와 원금을 합친 총 채무 금액**은 얼마인가요?\n\n(만원 단위)',
                    undefined,
                    'number'
                );
                break;

            case 'debt':
                setUserInput(prev => ({ ...prev, totalDebt: (value as number) * 10000 }));
                setCurrentStep('risk');
                addBotMessage(
                    '혹시 다음 중 해당하는 항목이 있나요?\n\n(채무 유형에 따라 변제금이 달라질 수 있어요)',
                    [
                        { label: '아니요, 생활비 등 일반 채무예요', value: 'none' },
                        { label: '최근 1년 내 대출이 많아요', value: 'recent_loan' },
                        { label: '주식/코인 투자 손실이 있어요', value: 'investment' },
                        { label: '도박으로 인한 채무가 있어요', value: 'gambling' },
                    ],
                    'buttons'
                );
                break;

            case 'risk':
                setUserInput(prev => ({ ...prev, riskFactor: value as RehabUserInput['riskFactor'] }));
                setCurrentStep('contact');
                addBotMessage(
                    '분석이 거의 끝났습니다! 🎉\n\n정확한 진단 결과를 받으실 **성함**과 **연락처**를 남겨주세요.\n\n(성함을 먼저 입력해주세요)',
                    undefined,
                    'text'
                );
                break;

            case 'contact':
                if (!userInput.name) {
                    setUserInput(prev => ({ ...prev, name: value as string }));
                    addBotMessage(
                        '감사합니다! 이제 **연락처**를 입력해주세요.\n\n(예: 010-1234-5678)',
                        undefined,
                        'text'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, phone: value as string }));
                    // 계산 실행
                    calculateResult({ ...userInput, phone: value as string } as RehabUserInput);
                }
                break;
        }
    };

    // 결과 계산
    const calculateResult = (input: RehabUserInput) => {
        setIsTyping(true);

        setTimeout(() => {
            // Determine effective config
            // 1. Get date-based default config
            const today = new Date();
            const year = today.getFullYear();
            let config = getPolicyForDate(today);

            // 2. Override with global settings if available for that year
            if (policyConfigs && policyConfigs[year]) {
                config = policyConfigs[year];
            } else if (policyConfigs && year > 2026 && policyConfigs[2026]) {
                // Fallback to 2026 if future year not found in settings? 
                // Currently getPolicyForDate handles fallback, but if we have custom settings, we might want to use custom 2026 as base.
                // For now, let's trust getPolicyForDate basic logic unless there is an explicit override.
            }

            // If year is <= 2026 and we have a custom config for 2026, use it.
            if (year <= 2026 && policyConfigs && policyConfigs[2026]) {
                config = policyConfigs[2026];
            }

            const calculationResult = calculateRepayment(input, config);
            setResult(calculationResult);

            const statusEmoji = calculationResult.status === 'POSSIBLE' ? '🟢' :
                calculationResult.status === 'DIFFICULT' ? '🟡' : '🔴';

            addBotMessage(
                `${statusEmoji} **분석이 완료되었습니다!**\n\n${input.name}님은 빚을 최대 **${calculationResult.debtReductionRate}%**까지 탕감받을 수 있어요.\n\n상세 리포트를 지금 바로 보여드릴게요.`,
                [{ label: '📊 진단 결과 보기', value: 'show_result' }],
                'buttons'
            );

            setCurrentStep('result');

            // 콜백 호출
            if (onComplete) {
                onComplete(calculationResult, input);
            }
        }, 1500);
    };

    // 입력 처리
    const handleSubmit = () => {
        if (!inputValue.trim()) return;

        const value = messages[messages.length - 1]?.inputType === 'number'
            ? parseFloat(inputValue)
            : inputValue;

        addUserMessage(inputValue);
        setInputValue('');

        setTimeout(() => {
            processStep(currentStep, value);
        }, 300);
    };

    // 옵션 선택 처리
    const handleOptionSelect = (option: ChatOption) => {
        addUserMessage(option.label);

        if (option.value === 'start') {
            setTimeout(() => processStep('intro'), 300);
        } else if (option.value === 'show_result') {
            setShowResult(true);
        } else {
            setTimeout(() => processStep(currentStep, option.value), 300);
        }
    };

    // 진행률 계산
    const getProgress = () => {
        const steps: ChatStep[] = ['intro', 'address', 'income', 'family', 'assets', 'spouse_check', 'debt', 'risk', 'contact', 'result'];
        const currentIndex = steps.indexOf(currentStep);
        return Math.round((currentIndex / (steps.length - 1)) * 100);
    };

    if (!isOpen) return null;

    return createPortal(
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    className="w-full max-w-md h-[85vh] flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {characterImage ? (
                                <img src={characterImage} alt={characterName} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <Bot className="w-6 h-6 text-white" />
                                </div>
                            )}
                            <div>
                                <h3 className="font-bold text-white">{characterName}</h3>
                                <p className="text-xs text-blue-100">AI 법률 비서</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 bg-slate-700">
                        <motion.div
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${getProgress()}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <AnimatePresence>
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[85%] ${msg.type === 'user' ? 'order-1' : 'order-2'}`}>
                                        <div
                                            className={`px-4 py-3 rounded-2xl ${msg.type === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-sm'
                                                : 'bg-slate-700 text-slate-100 rounded-bl-sm'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                        </div>

                                        {/* Option Buttons */}
                                        {msg.options && msg.type === 'bot' && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {msg.options.map((opt, idx) => (
                                                    <motion.button
                                                        key={idx}
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={() => handleOptionSelect(opt)}
                                                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-full font-medium hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                                                    >
                                                        {opt.label}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Typing Indicator */}
                        {isTyping && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex justify-start"
                            >
                                <div className="bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-sm">
                                    <div className="flex gap-1">
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    {messages.length > 0 && messages[messages.length - 1]?.inputType && !isTyping && (
                        <div className="p-4 bg-slate-800/80 border-t border-slate-700">
                            <div className="flex gap-2">
                                <input
                                    ref={inputRef}
                                    type={messages[messages.length - 1]?.inputType === 'number' ? 'number' : 'text'}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                    placeholder={
                                        messages[messages.length - 1]?.inputType === 'number'
                                            ? '숫자 입력 (만원)'
                                            : messages[messages.length - 1]?.inputType === 'address'
                                                ? '예: 서울 강남구'
                                                : '입력해주세요'
                                    }
                                    className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-xl border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none placeholder-slate-400"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleSubmit}
                                    className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg transition-shadow"
                                >
                                    <Send className="w-5 h-5" />
                                </motion.button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Result Modal */}
            {showResult && result && (
                <RehabResultReport
                    result={result}
                    userInput={userInput as RehabUserInput}
                    onClose={() => setShowResult(false)}
                />
            )}
        </>,
        document.body
    );
};

export default AIRehabChatbot;
