/**
 * AI 변제금 진단 챗봇 V2 - 2026년 고도화 버전
 * 
 * 20+ 단계 조건부 분기 대화형 인터페이스
 * - 나이(년생 입력 가능)
 * - 고용형태(겸업 지원, 무직 시 200만원 기준)
 * - 혼인상태 4가지 분기 (미혼/기혼/이혼/사별)
 * - 재산 다중선택
 * - 신용카드 채무 분리
 * - 입력값 확인 단계
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, Check, AlertCircle } from 'lucide-react';
import { calculateRepayment, RehabUserInput, RehabCalculationResult, formatCurrency, formatTenThousandWon } from '../../services/calculationService';
import { DEFAULT_POLICY_CONFIG_2026, getCourtNameForAddress } from '../../config/PolicyConfig';
import { RehabChatConfig } from '../../types';
import RehabResultReport from './RehabResultReport';
import ChatbotRenderer from './templates/ChatbotRenderer';
import { ChatbotTemplateId, ThemeMode, ChatbotColorPalette, getTemplateById, DEFAULT_DARK_PALETTE, DEFAULT_LIGHT_PALETTE, CHATBOT_TEMPLATES, InteractiveBlockConfig, InteractiveBlockState } from './templates/ChatbotTemplateConfig';
import { fetchGlobalSettings } from '../../services/googleSheetService';
import { RehabPolicyConfig } from '../../config/PolicyConfig';

// 대화 메시지 타입
interface ChatMessage {
    id: string;
    type: 'bot' | 'user';
    content: string;
    timestamp: Date;
    options?: ChatOption[];
    inputType?: InputType;
    multiSelect?: boolean;
    // Interactive Block (폼-혼합형)
    interactiveBlock?: InteractiveBlockConfig;
    blockState?: InteractiveBlockState;
    // 롤백을 위한 단계 추적
    stepId?: ChatStep;
    isAnswered?: boolean; // 이미 답변된 메시지인지 표시
}

interface ChatOption {
    label: string;
    value: string | number;
    selected?: boolean;
}

// 단계별 상태 스냅샷 (뒤로 가기/답변 수정용)
interface StepSnapshot {
    step: ChatStep;
    userInput: Partial<RehabUserInput>;
    selectedAssets: AssetType[];
    currentAssetIndex: number;
    assetValues: Record<AssetType, number>;
    spouseSelectedAssets: AssetType[];
    currentSpouseAssetIndex: number;
    spouseAssetValues: Record<AssetType, number>;
    messageCount: number;
}

type InputType = 'text' | 'number' | 'buttons' | 'address' | 'multiselect' | 'money';

// 대화 단계 (2026 고도화)
type ChatStep =
    | 'intro'
    | 'address'
    | 'age'
    | 'employment'
    | 'work_location'           // NEW: 근무지역/사업지역 (관할 법원용)
    | 'income_salary'
    | 'income_business'
    | 'income_confirm'
    | 'marital_status'
    | 'spouse_income'
    | 'spouse_assets_select'
    | 'spouse_asset_detail'
    | 'custody'
    | 'child_support_receive'
    | 'child_support_pay'
    | 'minor_children'
    | 'housing_type'
    | 'rent_cost'
    | 'deposit_amount'
    | 'deposit_loan'
    | 'owned_value'          // 자가 시세
    | 'owned_mortgage'       // 자가 담보대출
    | 'owned_mortgage'       // 자가 담보대출
    | 'medical_check'        // 의료비 여부 (NEW)
    | 'medical_amount'       // 의료비 금액
    | 'education_check'      // 교육비 여부 (NEW)
    | 'education_amount'     // 교육비 금액
    | 'special_education'    // 특수교육 여부 (NEW)
    | 'assets_select'
    | 'asset_detail'
    | 'asset_car_loan'
    | 'business_assets_deposit' // 사업장 보증금
    | 'business_assets_facility' // 사업장 시설/권리금
    | 'credit_card'
    | 'credit_card_amount'
    | 'other_debt'
    | 'debt_confirm'
    | 'priority_debt'
    | 'priority_debt_amount'
    | 'prior_rehab'          // 기존 개인회생/파산 진행 여부
    | 'prior_rehab_detail'   // 면책 년월
    | 'prior_credit_recovery' // 신용회복 상세
    | 'prior_credit_recovery_amount' // 신용회복 잔액 (NEW)
    | 'risk'
    | 'special_24_months'    // 24개월 특례 적용 여부 (기초수급자, 장애 등)
    | 'elderly_parent_check'  // 고령 부모님 부양가족 확인
    | 'elderly_parent_count'  // 고령 부모님 인원수
    | 'debt_types'            // V2.1: 채무 유형 분류
    | 'legal_actions'         // V2.1: 법적 조치 경험
    | 'monthly_expenses'      // V2.1: 월 고정 지출
    | 'result';

// 재산 항목 타입
type AssetType = 'car' | 'realEstate' | 'land' | 'savings' | 'insurance' | 'stocks';

interface AIRehabChatbotV2Props {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: (result: RehabCalculationResult, input: RehabUserInput) => void;
    characterName?: string;
    characterImage?: string;
    // 템플릿 시스템
    templateId?: ChatbotTemplateId;
    themeMode?: ThemeMode;
    customColors?: Partial<ChatbotColorPalette>;
    chatFontFamily?: string;
    enableFormBlocks?: boolean; // NEW: 모든 템플릿에서 Interactive Block 활성화
    interactiveBlockPreset?: 'none' | 'basic' | 'advanced' | 'custom';
    interactiveBlockConfig?: {
        useContactForm?: boolean;
        useDatePicker?: boolean;
        useMultiSelect?: boolean;
    };
    // NEW: Intro & Standalone
    introConfig?: RehabChatConfig['introConfig'];
    isStandalone?: boolean;
    disablePortal?: boolean; // NEW: For Admin Preview
}

const ASSET_LABELS: Record<AssetType, string> = {
    car: '자동차',
    realEstate: '부동산',
    land: '토지',
    savings: '예금/적금',
    insurance: '보험(해지환급금)',
    stocks: '주식/코인'
};

const ASSET_BLOCK_OPTIONS = [
    { label: '자동차', value: 'car', icon: '🚗' },
    { label: '부동산', value: 'realEstate', icon: '🏠' },
    { label: '토지', value: 'land', icon: '🏞️' },
    { label: '예금/적금', value: 'savings', icon: '💰' },
    { label: '보험', value: 'insurance', icon: '🛡️' },
    { label: '주식/코인', value: 'stocks', icon: '📈' }
];

const AIRehabChatbotV2: React.FC<AIRehabChatbotV2Props> = ({
    isOpen,
    onClose,
    onComplete,
    characterName = '로이',
    characterImage,
    templateId = 'classic' as ChatbotTemplateId,
    themeMode = 'light',
    customColors,
    chatFontFamily,
    enableFormBlocks = false,
    interactiveBlockPreset = 'none',
    interactiveBlockConfig,
    introConfig, // NEW prop
    isStandalone = false, // NEW prop from RehabChatButton
    disablePortal = false // NEW prop
}) => {
    // 템플릿 색상 계산
    const templateInfo = getTemplateById(templateId);
    const baseColors = themeMode === 'dark'
        ? (templateInfo?.previewColors.dark || DEFAULT_DARK_PALETTE)
        : (templateInfo?.previewColors.light || DEFAULT_LIGHT_PALETTE);

    const colors = useMemo(() => {
        if (customColors) {
            return {
                ...baseColors,
                ...customColors
            };
        }
        return baseColors;
    }, [baseColors, customColors]);

    // Interactive Block 사용 여부 확인
    const shouldUseBlock = useCallback((blockType: 'form' | 'multiSelect' | 'datePicker') => {
        console.log(`[RehabChat] shouldUseBlock check: type=${blockType}`, {
            preset: interactiveBlockPreset,
            config: interactiveBlockConfig
        });

        switch (interactiveBlockPreset) {
            case 'none': return false;
            case 'basic': return blockType === 'form';
            case 'advanced': return true;
            case 'custom':
                const result = blockType === 'form'
                    ? (interactiveBlockConfig?.useContactForm ?? false)
                    : blockType === 'datePicker'
                        ? (interactiveBlockConfig?.useDatePicker ?? false)
                        : (interactiveBlockConfig?.useMultiSelect ?? false);
                console.log(`[RehabChat] Custom preset check result for ${blockType}: ${result}`);
                return result;
            default: return false;
        }
    }, [enableFormBlocks, interactiveBlockPreset, interactiveBlockConfig]);

    // Intro State
    const [showIntro, setShowIntro] = useState(!!introConfig?.useIntro && !!introConfig?.mediaUrl);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [currentStep, setCurrentStep] = useState<ChatStep>('intro');
    const [userInput, setUserInput] = useState<Partial<RehabUserInput>>({
        monthlyIncome: 0,
        familySize: 1,
        isMarried: false,
        myAssets: 0,
        deposit: 0,
        spouseAssets: 0,
        totalDebt: 0
    });
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [result, setResult] = useState<RehabCalculationResult | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [policyConfig, setPolicyConfig] = useState<RehabPolicyConfig | undefined>(undefined);

    // 롤백 확인 상태
    const [rollbackConfirm, setRollbackConfirm] = useState<{
        isOpen: boolean;
        targetStep: ChatStep | null;
        targetMessageId: string | null;
        newValue: string | number | null;
    }>({ isOpen: false, targetStep: null, targetMessageId: null, newValue: null });

    // Fetch Global Policy
    useEffect(() => {
        const loadPolicy = async () => {
            const settings = await fetchGlobalSettings();
            if (settings && (settings as any).policyConfig) {
                console.log('Loaded Global Policy Config:', (settings as any).policyConfig);
                setPolicyConfig((settings as any).policyConfig);
            }
        };
        loadPolicy();
    }, []);

    // 추가 상태
    const [selectedAssets, setSelectedAssets] = useState<AssetType[]>([]);
    const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
    const [assetValues, setAssetValues] = useState<Record<AssetType, number>>({
        car: 0, realEstate: 0, land: 0, savings: 0, insurance: 0, stocks: 0
    });
    const [spouseSelectedAssets, setSpouseSelectedAssets] = useState<AssetType[]>([]);
    const [currentSpouseAssetIndex, setCurrentSpouseAssetIndex] = useState(0);
    const [spouseAssetValues, setSpouseAssetValues] = useState<Record<AssetType, number>>({
        car: 0, realEstate: 0, land: 0, savings: 0, insurance: 0, stocks: 0
    });

    // 뒤로 가기: 단계 히스토리 스택
    const [stepHistory, setStepHistory] = useState<StepSnapshot[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasInitialized = useRef(false);

    // stepId 자동 태깅용 ref (goToStep에서 동기적으로 갱신)
    const nextStepRef = useRef<ChatStep>('intro');
    const goToStep = useCallback((step: ChatStep) => {
        nextStepRef.current = step;
        setCurrentStep(step);
    }, []);

    // 스크롤 자동 이동
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 초기 메시지 (중복 방지)
    useEffect(() => {
        if (isOpen && !hasInitialized.current && messages.length === 0) {
            hasInitialized.current = true;
            setTimeout(() => {
                // [PREVIEW MODE] 에디터에서 Interactive Block이 활성화된 경우 즉시 보여줌
                if (disablePortal && shouldUseBlock('form')) {
                    addBotMessage(
                        `[미리보기 모드] \n설정하신 '폼-혼합형' 블록입니다.\n\n* 실제 사용 시에는 대화 마지막 단계에서, 상담원이 정보를 요청할 때 표시됩니다.`,
                        undefined,
                        'text',
                        undefined,
                        {
                            type: 'contact_input',
                            title: '연락처 입력',
                            description: '정확한 분석 결과를 위해 성함과 연락처를 입력해주세요.',
                            contactType: 'phone',
                            includeName: true,
                            placeholder: '010-0000-0000',
                            buttonLabel: '결과 확인하기',
                            required: true
                        }
                    );
                    return;
                }

                // [DEFAULT] 기본 인트로 메시지
                addBotMessage(
                    `안녕하세요! 저는 AI 법률비서 '${characterName}'예요 😊\n\n빚 걱정, 혼자 하지 마세요.\n지금부터 몇 가지만 여쭤보면 법원 기준에 맞는 정확한 분석 결과를 알려드릴게요!\n\n3분이면 충분해요. 시작해볼까요?`,
                    [{ label: '좋아요, 시작할게요', value: 'start' }],
                    'buttons'
                );
            }, 500);
        }
    }, [isOpen, characterName, messages.length, disablePortal, shouldUseBlock]);

    // 설정 변경 시 채팅 초기화 (Preview 모드에서 즉시 반영 확인용)
    useEffect(() => {
        console.log('[RehabChat] Config/Template Updated:', {
            templateId,
            introConfig,
            interactiveBlockPreset,
            interactiveBlockConfig
        });
        if (disablePortal) { // 에디터/프리뷰 모드일 때만
            setMessages([]);
            setCurrentStep('intro');
            setUserInput({
                monthlyIncome: 0,
                familySize: 1,
                isMarried: false,
                myAssets: 0,
                deposit: 0,
                spouseAssets: 0,
                totalDebt: 0
            });
            hasInitialized.current = false;
        }
    }, [interactiveBlockPreset, interactiveBlockConfig, disablePortal]);

    // 봇 메시지 추가 (Interactive Block 지원 + stepId 추적)
    const addBotMessage = useCallback((
        content: string,
        options?: ChatOption[],
        inputType?: InputType,
        multiSelect?: boolean,
        interactiveBlock?: InteractiveBlockConfig,
        stepId?: ChatStep
    ) => {
        setIsTyping(true);
        setTimeout(() => {
            // 이전 봇 메시지를 "답변됨"으로 표시
            setMessages(prev => {
                const updated = prev.map(msg =>
                    msg.type === 'bot' && msg.options && !msg.isAnswered
                        ? { ...msg, isAnswered: true }
                        : msg
                );
                const newMessage: ChatMessage = {
                    id: Date.now().toString(),
                    type: 'bot',
                    content,
                    timestamp: new Date(),
                    options,
                    inputType,
                    multiSelect,
                    interactiveBlock,
                    blockState: interactiveBlock ? { status: 'active' } : undefined,
                    stepId: stepId || nextStepRef.current,
                    isAnswered: false
                };
                return [...updated, newMessage];
            });
            setIsTyping(false);
            if (inputType === 'number' || inputType === 'text' || inputType === 'address' || inputType === 'money') {
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        }, 600);
    }, []);

    // 사용자 메시지 추가
    const addUserMessage = useCallback((content: string) => {
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
    }, []);

    // 나이 계산 (년생 입력 시)
    const calculateAge = (input: string): number | null => {
        const num = parseInt(input);
        if (isNaN(num)) return null;

        // 4자리 숫자면 년생으로 간주
        if (num >= 1940 && num <= 2010) {
            return 2026 - num;
        }
        // 2자리 숫자면 나이로 간주
        if (num >= 18 && num <= 100) {
            return num;
        }
        return null;
    };

    // 다음 단계로 진행
    const processStep = useCallback((step: ChatStep, value?: string | number | string[]) => {
        // 뒤로 가기: 현재 상태 스냅샷 저장 (intro와 result 제외)
        if (step !== 'intro' && step !== 'result') {
            setStepHistory(prev => {
                // 동일 단계 중복 방지
                if (prev.length > 0 && prev[prev.length - 1].step === step) return prev;
                return [...prev, {
                    step,
                    userInput: JSON.parse(JSON.stringify(userInput)),
                    selectedAssets: [...selectedAssets],
                    currentAssetIndex,
                    assetValues: { ...assetValues },
                    spouseSelectedAssets: [...spouseSelectedAssets],
                    currentSpouseAssetIndex,
                    spouseAssetValues: { ...spouseAssetValues },
                    messageCount: messages.length
                }];
            });
        }
        switch (step) {
            case 'intro':
                goToStep('address');
                addBotMessage(
                    '정확한 진단을 위해 현재 **사시는 곳**이 어디신가요?\n\n(예: 서울 강남구, 수원시 영통구)',
                    undefined,
                    'address'
                );
                break;

            case 'address':
                const addressVal = value as string;
                const detectedCourt = getCourtNameForAddress(addressVal, policyConfig || DEFAULT_POLICY_CONFIG_2026);

                if (detectedCourt === 'Default') {
                    addBotMessage(
                        '죄송합니다. 입력하신 주소를 확인하기 어렵습니다.\n\n정확한 지역명을 입력해주세요.\n(예: 서울 강남구, 경기 수원시, 남양주시)',
                        undefined,
                        'address'
                    );
                    return;
                }

                setUserInput(prev => ({ ...prev, address: addressVal }));
                goToStep('age');
                addBotMessage(
                    '만 나이가 어떻게 되시나요?\n\n(모르시면 태어난 연도를 입력해주셔도 돼요. 예: 1990)',
                    undefined,
                    'number'
                );
                break;

            case 'age':
                let age: number | undefined;
                const ageValue = typeof value === 'number' ? value : parseInt(value as string);
                if (!isNaN(ageValue)) {
                    // 4자리 숫자면 년생으로 간주
                    if (ageValue >= 1940 && ageValue <= 2010) {
                        age = 2026 - ageValue;
                    } else if (ageValue >= 18 && ageValue <= 100) {
                        age = ageValue;
                    }
                }
                setUserInput(prev => ({ ...prev, age }));
                goToStep('employment');
                addBotMessage(
                    '현재 어떤 형태로 소득을 얻고 계신가요?',
                    [
                        { label: '💼 급여소득자(직장인)', value: 'salary' },
                        { label: '🏪 영업소득자(자영업)', value: 'business' },
                        { label: '💻 프리랜서', value: 'freelancer' },
                        { label: '🔄 직장인 + 사업자 겸업', value: 'both' },
                        { label: '👷 일용직', value: 'daily' },
                        { label: '🔍 무직/구직 중', value: 'none' }
                    ],
                    'buttons'
                );
                break;

            case 'employment':
                const employmentType = value as 'salary' | 'business' | 'freelancer' | 'both' | 'none' | 'daily';
                setUserInput(prev => ({ ...prev, employmentType }));

                if (employmentType === 'none') {
                    // 무직: 200만원 기준으로 자동 설정, 근무지역 질문 스킵
                    setUserInput(prev => ({ ...prev, monthlyIncome: 2000000 }));
                    goToStep('marital_status');
                    addBotMessage(
                        '현재 결혼 상태는 어떻게 되시나요?',
                        [
                            { label: '👤 미혼', value: 'single' },
                            { label: '💑 기혼', value: 'married' },
                            { label: '📋 이혼', value: 'divorced' },
                            { label: '❓ 기타', value: 'other' }
                        ],
                        'buttons',
                        undefined,
                        undefined,
                        'marital_status'
                    );
                } else {
                    // 직장인/사업자/프리랜서/일용직/겸업: 근무지역 질문으로 이동
                    goToStep('work_location');
                    const locationQuestion = employmentType === 'business'
                        ? '사업장이 위치한 지역(구/시)을 입력해주세요.\n\n(예: 서울 강남구, 부산 해운대구)'
                        : employmentType === 'freelancer'
                            ? '주로 근무하시는 지역(구/시)을 입력해주세요.\n\n(예: 서울 마포구, 대전 유성구)'
                            : employmentType === 'daily'
                                ? '주로 일하시는 지역(구/시)을 입력해주세요.\n\n(예: 서울 마포구, 대전 유성구)'
                                : '직장이 위치한 지역(구/시)을 입력해주세요.\n\n(예: 서울 강남구, 경기 수원시)';
                    addBotMessage(locationQuestion, undefined, 'text');
                }
                break;

            case 'work_location':
                // 근무지역 저장
                setUserInput(prev => ({ ...prev, workLocation: value as string }));
                const empType = userInput.employmentType;

                if (empType === 'both') {
                    goToStep('income_salary');
                    addBotMessage(
                        '먼저, 직장에서 받는 월 실수령액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    goToStep('income_salary');
                    addBotMessage(
                        empType === 'salary' || empType === 'daily'
                            ? '세금과 4대보험을 제외한 월 평균 실수령액은 얼마인가요?\n\n(만원 단위)'
                            : '매달 순수익(매출-비용)은 대략 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;

            case 'income_salary':
                const salaryIncome = (value as number) * 10000;
                setUserInput(prev => ({ ...prev, salaryIncome }));

                if (userInput.employmentType === 'both') {
                    goToStep('income_business');
                    addBotMessage(
                        '사업에서 발생하는 월 순수익은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, monthlyIncome: salaryIncome }));
                    goToStep('income_confirm');
                    addBotMessage(
                        `월 소득이 ${formatCurrency(salaryIncome)}이 맞으신가요?`,
                        [
                            { label: '네, 맞아요', value: 'yes' },
                            { label: '아니요, 다시 입력', value: 'no' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'income_business':
                const businessIncome = (value as number) * 10000;
                const totalIncome = (userInput.salaryIncome || 0) + businessIncome;
                setUserInput(prev => ({
                    ...prev,
                    businessIncome,
                    monthlyIncome: totalIncome
                }));
                goToStep('income_confirm');
                addBotMessage(
                    `총 월 소득이 ${formatCurrency(totalIncome)}이 맞으신가요?`,
                    [
                        { label: '네, 맞아요', value: 'yes' },
                        { label: '아니요, 다시 입력', value: 'no' }
                    ],
                    'buttons'
                );
                break;

            case 'income_confirm':
                if (value === 'no') {
                    goToStep('income_salary');
                    addBotMessage(
                        '소득을 다시 입력해주세요.\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    goToStep('marital_status');
                    addBotMessage(
                        '현재 결혼 상태는 어떻게 되시나요?',
                        [
                            { label: '👤 미혼', value: 'single' },
                            { label: '💑 기혼', value: 'married' },
                            { label: '📋 이혼', value: 'divorced' },
                            { label: '❓ 기타', value: 'other' }
                        ],
                        'buttons',
                        undefined,
                        undefined,
                        'marital_status'
                    );
                }
                break;

            case 'marital_status':
                const maritalStatus = value as 'single' | 'married' | 'divorced' | 'other';
                const isMarried = maritalStatus === 'married';
                setUserInput(prev => ({ ...prev, maritalStatus, isMarried }));

                if (maritalStatus === 'married') {
                    // 배우자 소득은 변제금에 영향 없음 - 바로 배우자 재산 질문으로
                    goToStep('spouse_assets_select');
                    addBotMessage(
                        '배우자 명의로 가지고 있는 재산이 있나요?\n\n(해당하는 항목을 모두 선택하고 "선택완료"를 눌러주세요)',
                        [
                            { label: '🚗 자동차', value: 'car' },
                            { label: '🏠 부동산', value: 'realEstate' },
                            { label: '🏞️ 토지', value: 'land' },
                            { label: '💰 예금/적금', value: 'savings' },
                            { label: '🛡️ 보험', value: 'insurance' },
                            { label: '📈 주식/코인', value: 'stocks' },
                            { label: '🏢 사업재산', value: 'businessAssets' },
                            { label: '✅ 선택완료', value: 'done' },
                            { label: '❌ 없어요', value: 'none' }
                        ],
                        'buttons',
                        true,
                        interactiveBlockPreset !== 'none' ? {
                            type: 'multi_select',
                            title: '보유 재산 선택',
                            description: '해당하는 항목을 모두 선택해주세요.',
                            options: [
                                ...ASSET_BLOCK_OPTIONS,
                                { label: '사업재산', value: 'businessAssets', icon: '🏢' }
                            ],
                            buttonLabel: '선택 완료',
                            required: false
                        } : undefined
                    );
                } else if (maritalStatus === 'divorced') {
                    goToStep('custody');
                    addBotMessage(
                        '미성년 자녀를 양육하고 계신가요?',
                        [
                            { label: '✅ 예, 양육 중이에요', value: 'yes' },
                            { label: '❌ 아니요, 전 배우자가 양육해요', value: 'no' }
                        ],
                        'buttons'
                    );
                } else {
                    // 미혼/기타
                    setUserInput(prev => ({ ...prev, spouseAssets: 0 }));
                    goToStep('minor_children');
                    addBotMessage(
                        '함께 살고 있는 만 19세 미만 자녀가 몇 명인가요?\n\n(부양가족 인정 기준이 까다로워서 미성년 자녀만 여쭤볼게요)',
                        [
                            { label: '0️⃣ 없어요', value: 0 },
                            { label: '1️⃣ 1명', value: 1 },
                            { label: '2️⃣ 2명', value: 2 },
                            { label: '3️⃣ 3명', value: 3 },
                            { label: '4️⃣ 4명', value: 4 },
                            { label: '5️⃣ 5명 이상', value: 5 }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'spouse_assets_select':
                if (value === 'none' || (Array.isArray(value) && value.includes('none'))) {
                    setUserInput(prev => ({ ...prev, spouseAssets: 0 }));
                    goToStep('minor_children');
                    addBotMessage(
                        '함께 살고 있는 만 19세 미만 자녀가 몇 명인가요?',
                        [
                            { label: '0️⃣ 없어요', value: 0 },
                            { label: '1️⃣ 1명', value: 1 },
                            { label: '2️⃣ 2명', value: 2 },
                            { label: '3️⃣ 3명', value: 3 },
                            { label: '4️⃣ 4명', value: 4 },
                            { label: '5️⃣ 5명 이상', value: 5 }
                        ],
                        'buttons'
                    );
                } else {
                    // 'done'과 'none'을 제외한 실제 자산만 필터링
                    const rawAssets = Array.isArray(value) ? value : [value];
                    const assets = rawAssets.filter(v => v !== 'done' && v !== 'none') as AssetType[];

                    if (assets.length === 0) {
                        // 자산을 선택하지 않고 완료만 누른 경우
                        setUserInput(prev => ({ ...prev, spouseAssets: 0 }));
                        goToStep('minor_children');
                        addBotMessage(
                            '함께 살고 있는 만 19세 미만 자녀가 몇 명인가요?',
                            [
                                { label: '0️⃣ 없어요', value: 0 },
                                { label: '1️⃣ 1명', value: 1 },
                                { label: '2️⃣ 2명', value: 2 },
                                { label: '3️⃣ 3명', value: 3 },
                                { label: '4️⃣ 4명', value: 4 },
                                { label: '5️⃣ 5명 이상', value: 5 }
                            ],
                            'buttons'
                        );
                    } else {
                        setSpouseSelectedAssets(assets);
                        setCurrentSpouseAssetIndex(0);
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[assets[0]]} 가치는 대략 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'number'
                        );
                    }
                }
                break;

            case 'spouse_asset_detail':
                const spouseAssetType = spouseSelectedAssets[currentSpouseAssetIndex];
                setSpouseAssetValues(prev => ({ ...prev, [spouseAssetType]: (value as number) * 10000 }));

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    addBotMessage(
                        `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                } else {
                    // 배우자 재산 합산
                    const totalSpouseAssets = (Object.values(spouseAssetValues) as number[]).reduce((a, b) => a + b, 0) + (value as number) * 10000;
                    setUserInput(prev => ({ ...prev, spouseAssets: totalSpouseAssets }));
                    goToStep('minor_children');
                    addBotMessage(
                        '함께 살고 있는 만 19세 미만 자녀가 몇 명인가요?',
                        [
                            { label: '0️⃣ 없어요', value: 0 },
                            { label: '1️⃣ 1명', value: 1 },
                            { label: '2️⃣ 2명', value: 2 },
                            { label: '3️⃣ 3명', value: 3 },
                            { label: '4️⃣ 4명', value: 4 },
                            { label: '5️⃣ 5명 이상', value: 5 }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'custody':
                setUserInput(prev => ({ ...prev, isCustodialParent: value === 'yes' }));
                if (value === 'yes') {
                    goToStep('child_support_receive');
                    addBotMessage(
                        '전 배우자로부터 매달 받는 양육비는 얼마인가요?\n\n(만원 단위, 없으면 0)',
                        undefined,
                        'money'
                    );
                } else {
                    goToStep('child_support_pay');
                    addBotMessage(
                        '전 배우자에게 매달 지급하는 양육비는 얼마인가요?\n\n(만원 단위, 없으면 0)',
                        undefined,
                        'money'
                    );
                }
                break;

            case 'child_support_receive':
                const received = (value as number) * 10000;
                setUserInput(prev => ({
                    ...prev,
                    childSupportReceived: received,
                    monthlyIncome: (prev.monthlyIncome || 0) + received
                }));
                setUserInput(prev => ({ ...prev, spouseAssets: 0 }));
                goToStep('minor_children');
                addBotMessage(
                    '함께 살고 있는 만 19세 미만 자녀가 몇 명인가요?',
                    [
                        { label: '0️⃣ 없어요', value: 0 },
                        { label: '1️⃣ 1명', value: 1 },
                        { label: '2️⃣ 2명', value: 2 },
                        { label: '3️⃣ 3명', value: 3 },
                        { label: '4️⃣ 4명', value: 4 },
                        { label: '5️⃣ 5명 이상', value: 5 }
                    ],
                    'buttons'
                );
                break;

            case 'child_support_pay':
                setUserInput(prev => ({
                    ...prev,
                    childSupportPaid: (value as number) * 10000,
                    spouseAssets: 0
                }));
                goToStep('minor_children');
                addBotMessage(
                    '함께 살고 있는 만 19세 미만 자녀가 몇 명인가요?',
                    [
                        { label: '0️⃣ 없어요', value: 0 },
                        { label: '1️⃣ 1명', value: 1 },
                        { label: '2️⃣ 2명', value: 2 },
                        { label: '3️⃣ 3명', value: 3 },
                        { label: '4️⃣ 4명', value: 4 },
                        { label: '5️⃣ 5명 이상', value: 5 }
                    ],
                    'buttons'
                );
                break;

            case 'minor_children':
                // 문자열 연결 버그 수정: 명시적으로 숫자로 변환
                const minorChildren = typeof value === 'number' ? value : parseInt(String(value), 10);
                const safeMinorChildren = isNaN(minorChildren) ? 0 : minorChildren;

                // 가구원 수는 나중에 배우자 소득 기반으로 최종 계산됨
                // 여기서는 일단 본인(1) + 미성년 자녀로 임시 설정 (미혼인 경우 최종값)
                let familySize = 1 + safeMinorChildren;

                setUserInput(prev => ({ ...prev, minorChildren: safeMinorChildren, familySize }));
                goToStep('housing_type');
                addBotMessage(
                    '현재 거주 형태는 무엇인가요?',
                    [
                        { label: '🏠 월세', value: 'rent' },
                        { label: '🏢 전세', value: 'jeonse' },
                        { label: '🏡 자가(내 집)', value: 'owned' },
                        { label: '👨‍👩‍👧 무상거주(친가 등)', value: 'free' }
                    ],
                    'buttons'
                );
                break;

            case 'housing_type':
                const housingType = value as 'rent' | 'jeonse' | 'owned' | 'free';
                setUserInput(prev => ({ ...prev, housingType }));

                if (housingType === 'rent') {
                    goToStep('rent_cost');
                    addBotMessage(
                        '매달 월세는 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else if (housingType === 'jeonse') {
                    goToStep('deposit_amount');
                    addBotMessage(
                        '전세금은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else if (housingType === 'owned') {
                    goToStep('owned_value');
                    addBotMessage(
                        '자가 부동산의 대략적인 시세는 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, deposit: 0, rentCost: 0 }));
                    goToStep('medical_check');
                    addBotMessage(
                        '본인이나 가족의 **의료비**로 매달 고정적으로 지출하는 비용이 있나요?',
                        [
                            { label: '없어요', value: 'no' },
                            { label: '있어요', value: 'yes' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'rent_cost':
                setUserInput(prev => ({ ...prev, rentCost: (value as number) * 10000 }));
                goToStep('deposit_amount');
                addBotMessage(
                    '보증금은 얼마인가요?\n\n(만원 단위)',
                    undefined,
                    'number'
                );
                break;

            case 'deposit_amount':
                setUserInput(prev => ({ ...prev, deposit: (value as number) * 10000 }));
                goToStep('deposit_loan');
                addBotMessage(
                    '보증금 중 대출받은 금액이 있나요?',
                    [
                        { label: '없어요', value: 'no' },
                        { label: '있어요', value: 'yes' }
                    ],
                    'buttons'
                );
                break;

            case 'deposit_loan':
                if (value === 'yes') {
                    addBotMessage(
                        '보증금 대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                    // 다음 입력 후 medical_check로 이동
                    goToStep('medical_check');
                } else {
                    setUserInput(prev => ({ ...prev, depositLoan: 0 }));
                    goToStep('medical_check');
                    addBotMessage(
                        '본인이나 가족의 **의료비**로 매달 고정적으로 지출하는 비용이 있나요?',
                        [
                            { label: '없어요', value: 'no' },
                            { label: '있어요', value: 'yes' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'owned_value':
                setUserInput(prev => ({ ...prev, myAssets: (prev.myAssets || 0) + (value as number) * 10000 }));
                goToStep('owned_mortgage');
                addBotMessage(
                    '해당 부동산에 담보대출이 있으신가요?\n\n만원 단위로 입력해주세요. (없으면 0)',
                    undefined,
                    'number'
                );
                break;

            case 'owned_mortgage':
                // 담보대출은 자산에서 차감
                const mortgageAmount = (value as number) * 10000;
                setUserInput(prev => ({ ...prev, myAssets: Math.max(0, (prev.myAssets || 0) - mortgageAmount) }));
                goToStep('medical_check');
                addBotMessage(
                    '본인이나 가족의 **의료비**로 매달 고정적으로 지출하는 비용이 있나요?',
                    [
                        { label: '없어요', value: 'no' },
                        { label: '있어요', value: 'yes' }
                    ],
                    'buttons'
                );
                break;

            case 'medical_check':
                if (value === 'yes') {
                    goToStep('medical_amount');
                    addBotMessage(
                        '월 의료비 지출액은 대략 얼마인가요?\n\n(만원 단위, 증빙 가능한 금액)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, medicalCost: 0 }));
                    goToStep('education_check');
                    addBotMessage(
                        '미성년 자녀의 **교육비**로 매달 고정적으로 지출하는 비용이 있나요?',
                        [
                            { label: '없어요', value: 'no' },
                            { label: '있어요', value: 'yes' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'medical_amount':
                setUserInput(prev => ({ ...prev, medicalCost: (value as number) * 10000 }));
                goToStep('education_check');
                addBotMessage(
                    '미성년 자녀의 **교육비**로 매달 고정적으로 지출하는 비용이 있나요?',
                    [
                        { label: '없어요', value: 'no' },
                        { label: '있어요', value: 'yes' }
                    ],
                    'buttons'
                );
                break;

            case 'education_check':
                if (value === 'yes') {
                    goToStep('education_amount');
                    addBotMessage(
                        '월 교육비 지출액은 대략 얼마인가요?\n\n(만원 단위, 증빙 가능한 금액)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, educationCost: 0 }));
                    // V2.1: 월 고정 지출로 이동
                    goToStep('monthly_expenses');
                    addBotMessage(
                        '네, 확인했어요. 소득 부분은 변제금 산정의 핵심이라 정확히 반영할게요 💪\n\n매달 꼭 나가는 고정 지출이 있다면 합계를 입력해주세요.\n(통신비, 보험료, 교통비 등)\n\n없으시면 0을 입력해주세요.',
                        undefined,
                        'money'
                    );
                }
                break;

            case 'education_amount':
                setUserInput(prev => ({ ...prev, educationCost: (value as number) * 10000 }));
                goToStep('special_education');
                addBotMessage(
                    '자녀 중 장애 등으로 인해 **특수교육**이 필요한 경우가 있나요?\n\n(특수교육비는 인정 한도가 더 높습니다)',
                    [
                        { label: '아니요, 일반 교육이에요', value: 'no' },
                        { label: '네, 특수교육이 필요해요', value: 'yes' }
                    ],
                    'buttons'
                );
                break;

            case 'special_education':
                setUserInput(prev => ({ ...prev, hasSpecialEducation: value === 'yes' }));
                // V2.1: 월 고정 지출로 이동
                goToStep('monthly_expenses');
                addBotMessage(
                    '네, 확인했어요. 소득 부분은 변제금 산정의 핵심이라 정확히 반영할게요 💪\n\n매달 꼭 나가는 고정 지출이 있다면 합계를 입력해주세요.\n(통신비, 보험료, 교통비 등)\n\n없으시면 0을 입력해주세요.',
                    undefined,
                    'money'
                );
                break;

            case 'assets_select':
                if (value === 'none' || (Array.isArray(value) && value.includes('none'))) {
                    setUserInput(prev => ({ ...prev, myAssets: 0 }));
                    goToStep('credit_card');
                    addBotMessage(
                        '현재 신용카드를 사용하고 계신가요?\n\n(카드 사용금액도 채무에 포함됩니다)',
                        [
                            { label: '사용 중이에요', value: 'yes' },
                            { label: '사용 안 해요', value: 'no' }
                        ],
                        'buttons'
                    );
                } else {
                    // 'done'과 'none'을 제외한 실제 자산만 필터링
                    const rawAssets = Array.isArray(value) ? value : [value];
                    const assets = rawAssets.filter(v => v !== 'done' && v !== 'none') as AssetType[];

                    if (assets.length === 0) {
                        // 자산을 선택하지 않고 완료만 누른 경우
                        setUserInput(prev => ({ ...prev, myAssets: 0 }));
                        goToStep('credit_card');
                        addBotMessage(
                            '현재 신용카드를 사용하고 계신가요?\n\n(카드 사용금액도 채무에 포함됩니다)',
                            [
                                { label: '사용 중이에요', value: 'yes' },
                                { label: '사용 안 해요', value: 'no' }
                            ],
                            'buttons'
                        );
                    } else {
                        setSelectedAssets(assets);
                        setCurrentAssetIndex(0);
                        goToStep('asset_detail');
                        addBotMessage(
                            `${ASSET_LABELS[assets[0]]}의 현재 가치는 대략 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'number'
                        );
                    }
                }
                break;

            case 'asset_detail': {
                const assetType = selectedAssets[currentAssetIndex];
                const rawVal = (value as number) * 10000;
                setAssetValues(prev => ({ ...prev, [assetType]: rawVal }));

                if (assetType === 'car') {
                    goToStep('asset_car_loan');
                    addBotMessage(
                        '해당 자동차에 남은 할부 금액 또는 담보대출 금액은 얼마인가요?\n\n(없으시면 0을 입력해 주세요, 만원 단위)',
                        undefined,
                        'number'
                    );
                    return;
                }

                if (currentAssetIndex < selectedAssets.length - 1) {
                    const nextIndex = currentAssetIndex + 1;
                    setCurrentAssetIndex(nextIndex);
                    addBotMessage(
                        `${ASSET_LABELS[selectedAssets[nextIndex]]}의 현재 가치는 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                } else {
                    // 재산 합산
                    const totalAssets = (Object.values(assetValues) as number[]).reduce((a, b) => a + b, 0) + rawVal;
                    setUserInput(prev => ({ ...prev, myAssets: totalAssets }));
                    goToStep('credit_card');
                    addBotMessage(
                        '현재 신용카드를 사용하고 계신가요?\n\n(카드 사용금액도 채무에 포함됩니다)',
                        [
                            { label: '사용 중이에요', value: 'yes' },
                            { label: '사용 안 해요', value: 'no' }
                        ],
                        'buttons'
                    );
                }
                break;
            }

            case 'asset_car_loan': {
                const loanAmount = (value as number) * 10000;
                const carPrice = assetValues.car || 0;
                const carNetValue = Math.max(0, carPrice - loanAmount);

                setAssetValues(prev => ({ ...prev, car: carNetValue }));
                const updatedAssetValues = { ...assetValues, car: carNetValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    const nextIndex = currentAssetIndex + 1;
                    setCurrentAssetIndex(nextIndex);
                    goToStep('asset_detail');
                    addBotMessage(
                        `${ASSET_LABELS[selectedAssets[nextIndex]]}의 현재 가치는 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                } else {
                    // 재산 합산
                    const totalAssets = (Object.values(updatedAssetValues) as number[]).reduce((a, b) => a + b, 0);
                    setUserInput(prev => ({ ...prev, myAssets: totalAssets }));
                    goToStep('credit_card');
                    addBotMessage(
                        '현재 신용카드를 사용하고 계신가요?\n\n(카드 사용금액도 채무에 포함됩니다)',
                        [
                            { label: '사용 중이에요', value: 'yes' },
                            { label: '사용 안 해요', value: 'no' }
                        ],
                        'buttons'
                    );
                }
                break;
            }

            case 'credit_card':
                if (value === 'yes') {
                    goToStep('credit_card_amount');
                    addBotMessage(
                        '신용카드 총 사용금액(미결제액)은 얼마인가요?\n\n(여러 장 있으시면 합산해주세요, 만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, creditCardDebt: 0 }));
                    goToStep('other_debt');
                    addBotMessage(
                        '갚아야 할 채무(대출, 카드론, 사채, 개인간 채무 등)는 총 얼마인가요?\n\n(개인간 채무도 포함해서 입력해주세요, 만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;

            case 'credit_card_amount':
                setUserInput(prev => ({ ...prev, creditCardDebt: (value as number) * 10000 }));
                // V2.1: 채무 유형 분류로 이동
                goToStep('debt_types');
                addBotMessage(
                    '많이 힘드셨을 거예요. 걸정 마세요, 대부분의 분들이 비슷한 상황에서 해결책을 찾으셨어요 🤝\n\n빚의 종류를 좀 더 자세히 알려주시면 더 정확한 분석이 가능해요.',
                    [
                        { label: '🏦 은행 대출', value: 'bank' },
                        { label: '💳 카드사/캐피탈', value: 'capital' },
                        { label: '🏪 저축은행/대부업', value: 'savings_bank' },
                        { label: '👤 사금융/지인', value: 'private' },
                        { label: '📱 앱/온라인 대출', value: 'app_loan' },
                        { label: '🏢 보증채무', value: 'guarantee' },
                        { label: '✅ 선택완료', value: 'done' }
                    ],
                    'buttons',
                    true
                );
                break;

            case 'other_debt':
                const otherDebt = (value as number) * 10000;
                const totalDebt = (userInput.creditCardDebt || 0) + otherDebt;
                setUserInput(prev => ({ ...prev, totalDebt }));
                goToStep('debt_confirm');
                addBotMessage(
                    `총 채무가 ${formatCurrency(totalDebt)}이 맞으신가요?`,
                    [
                        { label: '네, 맞아요', value: 'yes' },
                        { label: '아니요, 다시 입력', value: 'no' }
                    ],
                    'buttons'
                );
                break;

            case 'debt_confirm':
                if (value === 'no') {
                    goToStep('credit_card');
                    addBotMessage(
                        '채무를 다시 입력해주세요.\n\n신용카드를 사용하고 계신가요?',
                        [
                            { label: '사용 중이에요', value: 'yes' },
                            { label: '사용 안 해요', value: 'no' }
                        ],
                        'buttons'
                    );
                } else {
                    // 기혼이고 미성년 자녀가 있는 경우 배우자 소득 질문
                    if (userInput.isMarried && userInput.minorChildren && userInput.minorChildren > 0) {
                        goToStep('spouse_income');
                        addBotMessage(
                            '배우자의 월 소득은 대략 얼마인가요?\n\n(자녀 부양가족 산정에 필요합니다)',
                            [
                                { label: '💼 무소득', value: 0 },
                                { label: '💵 100만원 미만', value: 50 },
                                { label: '💵 100~200만원', value: 150 },
                                { label: '💵 200~300만원', value: 250 },
                                { label: '💵 300~400만원', value: 350 },
                                { label: '💵 400만원 이상', value: 450 }
                            ],
                            'buttons'
                        );
                    } else {
                        // 기혼+자녀 없는 경우 또는 미혼인 경우, 고령 부모님 부양가족 확인으로 이동
                        goToStep('elderly_parent_check');
                        addBotMessage(
                            '아래 조건에 **모두 부합하는** 부모님이 계신가요?\n\n• 친부모\n• 만 65세 이상\n• 소득이 없거나 기초수급 혹은 장애\n• 20만원 이상 생활비를 매달 드리는 중',
                            [
                                { label: '✅ 예, 해당됩니다', value: 'yes' },
                                { label: '❌ 아니요', value: 'no' }
                            ],
                            'buttons'
                        );
                    }
                }
                break;

            case 'spouse_income':
                // 배우자 소득 저장 및 가구원 수 재계산
                const spouseIncome = (typeof value === 'number' ? value : parseInt(String(value), 10)) * 10000;
                const myIncome = userInput.monthlyIncome || 0;
                const children = userInput.minorChildren || 0;

                // 배우자 소득 비율 계산
                const spouseIncomeRatio = myIncome > 0 ? spouseIncome / myIncome : 0;

                let recognizedDependents = 0;
                let dependentReason = '';

                if (spouseIncomeRatio < 0.7) {
                    // 배우자 소득 < 70%: 자녀 전원 인정
                    recognizedDependents = children;
                    dependentReason = '배우자 소득이 본인의 70% 미만으로, 미성년 자녀 전원이 부양가족으로 인정됩니다.';
                } else if (spouseIncomeRatio <= 1.3) {
                    // 배우자 소득 70~130%: 자녀 0.5명씩 산정
                    recognizedDependents = children * 0.5;
                    dependentReason = '부부 소득이 비슷하여(70~130%), 미성년 자녀는 공동 부양으로 0.5명씩 산정됩니다.';
                } else {
                    // 배우자 소득 > 130%: 자녀 미인정
                    recognizedDependents = 0;
                    dependentReason = '배우자 소득이 본인의 130% 초과로, 자녀는 배우자의 부양가족으로 간주됩니다.';
                }

                // 최종 가구원 수 = 본인(1) + 인정된 자녀 부양가족 (소수점 올림)
                const updatedFamilySize = 1 + Math.ceil(recognizedDependents);

                setUserInput(prev => ({
                    ...prev,
                    spouseIncome,
                    familySize: updatedFamilySize,
                    recognizedChildDependents: recognizedDependents,
                    dependentReason
                }));

                // 고령 부모님 부양가족 확인으로 이동
                goToStep('elderly_parent_check');
                addBotMessage(
                    '아래 조건에 **모두 부합하는** 부모님이 계신가요?\n\n• 친부모\n• 만 65세 이상\n• 소득이 없거나 기초수급 혹은 장애\n• 20만원 이상 생활비를 매달 드리는 중',
                    [
                        { label: '✅ 예, 해당됩니다', value: 'yes' },
                        { label: '❌ 아니요', value: 'no' }
                    ],
                    'buttons'
                );
                break;

            case 'elderly_parent_check':
                if (value === 'yes') {
                    goToStep('elderly_parent_count');
                    addBotMessage(
                        '해당 조건에 부합하는 부모님이 몇 분이신가요?',
                        [
                            { label: '👤 1분', value: 1 },
                            { label: '👫 2분 (부모님 모두)', value: 2 }
                        ],
                        'buttons'
                    );
                } else {
                    // 고령 부모님 부양가족 없음
                    setUserInput(prev => ({ ...prev, elderlyParentDependents: 0 }));
                    goToStep('priority_debt');
                    addBotMessage(
                        '세금, 건강보험료 등 미납된 공과금이 있으신가요?',
                        [
                            { label: '없어요', value: 'no' },
                            { label: '있어요', value: 'yes' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'elderly_parent_count':
                const elderlyParentCount = typeof value === 'number' ? value : parseInt(String(value), 10);
                const safeElderlyCount = isNaN(elderlyParentCount) ? 0 : elderlyParentCount;

                // 가구원 수에 고령 부모님 추가
                setUserInput(prev => {
                    const newFamilySize = (prev.familySize || 1) + safeElderlyCount;
                    const updatedReason = prev.dependentReason
                        ? `${prev.dependentReason} 고령 부모님 ${safeElderlyCount}분이 추가로 인정됩니다.`
                        : `고령 부모님 ${safeElderlyCount}분이 부양가족으로 인정됩니다.`;
                    return {
                        ...prev,
                        elderlyParentDependents: safeElderlyCount,
                        familySize: newFamilySize,
                        dependentReason: updatedReason
                    };
                });

                goToStep('priority_debt');
                addBotMessage(
                    '세금, 건강보험료 등 미납된 공과금이 있으신가요?',
                    [
                        { label: '없어요', value: 'no' },
                        { label: '있어요', value: 'yes' }
                    ],
                    'buttons'
                );
                break;

            case 'priority_debt':
                if (value === 'yes') {
                    goToStep('priority_debt_amount');
                    addBotMessage(
                        '미납된 세금/보험료 총액은 대략 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, priorityDebt: 0 }));
                    goToStep('risk');
                    addBotMessage(
                        '혹시 다음 중 해당하는 항목이 있나요?',
                        [
                            { label: '아니요, 일반 채무예요', value: 'none' },
                            { label: '최근 1년 내 대출이 많아요', value: 'recent_loan' },
                            { label: '주식/코인 투자 손실이 있어요', value: 'investment' },
                            { label: '도박으로 인한 채무가 있어요', value: 'gambling' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'priority_debt_amount':
                setUserInput(prev => ({ ...prev, priorityDebt: (value as number) * 10000 }));
                goToStep('risk');
                addBotMessage(
                    '혹시 다음 중 해당하는 항목이 있나요?',
                    [
                        { label: '아니요, 일반 채무예요', value: 'none' },
                        { label: '최근 1년 내 대출이 많아요', value: 'recent_loan' },
                        { label: '주식/코인 투자 손실이 있어요', value: 'investment' },
                        { label: '도박으로 인한 채무가 있어요', value: 'gambling' }
                    ],
                    'buttons'
                );
                break;

            case 'risk':
                setUserInput(prev => ({ ...prev, riskFactor: value as RehabUserInput['riskFactor'] }));
                // V2.1: 공감 리액션 후 법적 조치 질문으로 이동
                setTimeout(() => {
                    addBotMessage(
                        '솔직하게 말씀해주셔서 감사해요. 정확한 상황 파악이 좋은 결과의 첫걸음이에요 ✨',
                        undefined,
                        undefined
                    );
                }, 300);
                setTimeout(() => {
                    goToStep('legal_actions');
                    addBotMessage(
                        '혼시 현재 아래와 같은 법적 조치를 받고 계신 게 있나요?\n해당하는 것을 모두 선택해주세요.',
                        [
                            { label: '📞 독촉 전화/문자', value: 'collection_call' },
                            { label: '📄 지급명령/소장 수령', value: 'court_order' },
                            { label: '🔒 급여/계좌 압류', value: 'seizure' },
                            { label: '🏠 부동산 가압류', value: 'property_seizure' },
                            { label: '⚠️ 신용등급 하락 통보', value: 'credit_drop' },
                            { label: '✅ 해당 없음', value: 'none' }
                        ],
                        'buttons',
                        true
                    );
                }, 1200);
                break;

            case 'prior_rehab':
                if (value === 'none' || value === 'fresh_start') {
                    // 24개월 특례 적용 가능 여부 확인으로 이동
                    goToStep('special_24_months');
                    addBotMessage(
                        '24개월 단기 변제 특례 적용 가능 여부를 확인합니다.\n\n다음 중 해당하는 항목이 있으신가요?',
                        [
                            { label: '🔘 해당 없음', value: 'none' },
                            { label: '📋 기초생활수급자', value: 'basic_recipient' },
                            { label: '♿ 심한 장애(1~3급)', value: 'severe_disability' },
                            { label: '👴 만 70세 이상', value: 'elderly' }
                        ],
                        'buttons'
                    );
                } else if (value === 'rehab' || value === 'bankruptcy') {
                    goToStep('prior_rehab_detail');
                    addBotMessage(
                        '면책받으신 년도와 월을 대략적으로 입력해주세요.\n\n(정확하지 않아도 괜찮아요. 예: 2020년 5월)',
                        undefined,
                        'text'
                    );
                } else if (value === 'credit_recovery') {
                    goToStep('prior_credit_recovery');
                    addBotMessage(
                        '신용회복 상태가 어떻게 되시나요?',
                        [
                            { label: '완납했어요', value: 'completed' },
                            { label: '진행 중이에요', value: 'ongoing' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'special_24_months':
                // 24개월 특례 조건 저장
                const updatedInputWithSpecial = { ...userInput, specialCondition: value as any };
                setUserInput(updatedInputWithSpecial);
                calculateResult(updatedInputWithSpecial);
                break;

            case 'prior_rehab_detail':
                calculateResult(userInput);
                break;

            case 'prior_credit_recovery':
                if (value === 'ongoing') {
                    addBotMessage(
                        '신용회복 남은 채무금액은 대략 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                    goToStep('prior_credit_recovery_amount');
                } else {
                    calculateResult(userInput);
                }
                break;

            case 'prior_credit_recovery_amount':
                calculateResult(userInput);
                break;

            // ── V2.1 신규 단계 ──

            case 'debt_types': {
                // 채무 유형 저장 후 other_debt로 이동
                const rawDebtTypes = Array.isArray(value) ? value : [value];
                const debtTypes = rawDebtTypes.filter(v => v !== 'done' && v !== 'none') as string[];
                setUserInput(prev => ({ ...prev, debtTypes }));
                goToStep('other_debt');
                addBotMessage(
                    '신용카드 외에 갚아야 할 채무(대출, 카드론, 사채, 개인간 채무 등)는 총 얼마인가요?\n\n(개인간 채무도 포함해서 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'legal_actions': {
                // 법적 조치 저장 후 prior_rehab으로 이동
                const rawLegalActions = Array.isArray(value) ? value : [value];
                const legalActions = rawLegalActions.filter(v => v !== 'done') as string[];
                setUserInput(prev => ({ ...prev, legalActions }));

                // 압류 경험자 특별 리액션
                if (legalActions.includes('seizure')) {
                    setTimeout(() => {
                        addBotMessage(
                            '⚡ 압류를 받고 계시군요. 개인회생 신청 시 **금지명령**으로 즉시 중단시킬 수 있어요!',
                            undefined,
                            undefined
                        );
                    }, 300);
                }

                setTimeout(() => {
                    goToStep('prior_rehab');
                    addBotMessage(
                        '기존에 개인회생, 파산, 신용회복, 새출발기금을 진행 중이거나 진행하신 적 있으신가요?',
                        [
                            { label: '없어요', value: 'none' },
                            { label: '개인회생', value: 'rehab' },
                            { label: '파산', value: 'bankruptcy' },
                            { label: '신용회복', value: 'credit_recovery' },
                            { label: '새출발기금', value: 'fresh_start' }
                        ],
                        'buttons'
                    );
                }, legalActions.includes('seizure') ? 1500 : 300);
                break;
            }

            case 'monthly_expenses': {
                // 월 고정 지출 저장 후 assets_select로 이동
                const monthlyFixedExpenses = (value as number) * 10000;
                setUserInput(prev => ({ ...prev, monthlyFixedExpenses }));
                goToStep('assets_select');
                addBotMessage(
                    '현재 본인 명의로 가지고 있는 재산이 있으신가요?\n\n(해당하는 항목을 모두 선택하고 "선택완료"를 눌러주세요)',
                    [
                        { label: '🚗 자동차', value: 'car' },
                        { label: '🏠 부동산', value: 'realEstate' },
                        { label: '🏞️ 토지', value: 'land' },
                        { label: '💰 예금/적금', value: 'savings' },
                        { label: '🛡️ 보험', value: 'insurance' },
                        { label: '📈 주식/코인', value: 'stocks' },
                        { label: '✅ 선택완료', value: 'done' },
                        { label: '❌ 없어요', value: 'none' }
                    ],
                    'buttons',
                    true,
                    interactiveBlockPreset !== 'none' ? {
                        type: 'multi_select',
                        title: '보유 재산 선택',
                        description: '해당하는 항목을 모두 선택해주세요.',
                        options: ASSET_BLOCK_OPTIONS,
                        buttonLabel: '선택 완료',
                        required: false
                    } : undefined
                );
                break;
            }


        }
    }, [userInput, addBotMessage, selectedAssets, currentAssetIndex, assetValues, spouseSelectedAssets, currentSpouseAssetIndex, spouseAssetValues, shouldUseBlock, messages.length]);

    // 결과 계산 (V2.1 강화: 5단계 프로그레스 애니메이션)
    const calculateResult = useCallback((input: RehabUserInput) => {
        setIsTyping(true);

        // V2.1: 5단계 분석 애니메이션
        const phases = [
            '모든 정보를 입력해주셨어요! 🎉 법원 기준에 맞춰 정밀 분석을 시작할게요.',
            '✅ 입력 데이터 검증 완료',
            '🏦 관할 법원 판별 중...',
            '📊 2026년 생계비 기준 적용 중...',
            '💰 월 변제금 시뮬레이션 중...',
        ];

        let phaseIndex = 0;
        const phaseInterval = setInterval(() => {
            if (phaseIndex < phases.length) {
                addBotMessage(phases[phaseIndex], undefined, undefined);
                phaseIndex++;
            } else {
                clearInterval(phaseInterval);
            }
        }, 700);

        setTimeout(() => {
            clearInterval(phaseInterval);
            const calculationResult = calculateRepayment(input, policyConfig);
            setResult(calculationResult);

            const statusEmoji = calculationResult.status === 'POSSIBLE' ? '🟢' :
                calculationResult.status === 'DIFFICULT' ? '🟡' : '🔴';

            // 무직자 안내 메시지
            let resultMessage = `${statusEmoji} **분석이 완료되었습니다!**\n\n${input.name || '의뢰인'}님은 빚을 최대 **${calculationResult.debtReductionRate}%**까지 탕감받을 수 있어요.`;

            if (input.employmentType === 'none') {
                resultMessage += '\n\n💡 현재 무직이시지만 월 200만원 수입 기준으로 계산한 결과입니다.\n\n어렵게 생각하지 마세요! 아르바이트 하루만 나가시거나 일용직 하루만 출근하셔도 수입이 인정되어 개인회생 진행이 가능합니다.';
            }

            // V2.1: 압류 경험자 특별 메시지
            if (input.legalActions?.includes('seizure')) {
                resultMessage += '\n\n⚡ 압류를 받고 계시군요. 개인회생 신청 시 **금지명령**으로 즉시 중단시킬 수 있어요!';
            }

            addBotMessage(
                resultMessage,
                [{ label: '📊 진단 결과 보기', value: 'show_result' }],
                'buttons'
            );

            setCurrentStep('result');
            setShowResult(true);

            if (onComplete) {
                onComplete(calculationResult, input);
            }
        }, 4000);
    }, [addBotMessage, onComplete, policyConfig]);

    // 입력 처리
    const handleSubmit = useCallback(() => {
        if (!inputValue.trim()) return;

        const lastMessage = messages[messages.length - 1];

        // 입력값 파싱
        let value: string | number = inputValue;
        if (lastMessage?.inputType === 'number' || lastMessage?.inputType === 'money') {
            // 쉼표 제거 후 파싱
            value = parseFloat(inputValue.replace(/,/g, ''));
        }

        // 사용자 메시지 표시 (돈 관련 입력이면 한글 포맷팅)
        let displayContent = inputValue;
        if (lastMessage?.inputType === 'money') {
            displayContent = `${inputValue} (${formatTenThousandWon(value as number)})`;
        }

        addUserMessage(displayContent);
        setInputValue('');

        setTimeout(() => {
            processStep(currentStep, value);
        }, 300);
    }, [inputValue, messages, addUserMessage, processStep, currentStep]);

    // 롤백 실행 함수 (스냅샷 기반 완전 복원)
    const executeRollback = useCallback((targetStep: ChatStep, targetMessageId: string, newValue?: string | number) => {
        // 1. 해당 단계의 스냅샷 찾기
        const snapshotIndex = stepHistory.findIndex(s => s.step === targetStep);
        if (snapshotIndex === -1) return;
        const snapshot = stepHistory[snapshotIndex];

        // 2. 스냅샷 시점의 메시지까지만 유지
        setMessages(prev => {
            const kept = prev.slice(0, snapshot.messageCount);
            return kept.map((msg, idx) =>
                idx === kept.length - 1 && msg.type === 'bot' ? { ...msg, isAnswered: false } : msg
            );
        });

        // 3. 모든 관련 상태를 스냅샷으로 복원
        setUserInput(snapshot.userInput);
        setSelectedAssets(snapshot.selectedAssets);
        setCurrentAssetIndex(snapshot.currentAssetIndex);
        setAssetValues(snapshot.assetValues);
        setSpouseSelectedAssets(snapshot.spouseSelectedAssets);
        setCurrentSpouseAssetIndex(snapshot.currentSpouseAssetIndex);
        setSpouseAssetValues(snapshot.spouseAssetValues);

        // 4. 히스토리 스택에서 해당 단계 이후 제거
        setStepHistory(prev => prev.slice(0, snapshotIndex));

        // 5. 해당 단계로 이동
        setCurrentStep(targetStep);

        // 6. 새 값이 있으면 바로 답변 처리 (이전 옵션 클릭으로 롤백 시)
        if (newValue !== undefined && newValue !== null) {
            const targetMessage = messages.find(msg => msg.id === targetMessageId);
            const selectedOption = targetMessage?.options?.find(opt => String(opt.value) === String(newValue));
            if (selectedOption) {
                setTimeout(() => {
                    addUserMessage(selectedOption.label);
                    setTimeout(() => processStep(targetStep, newValue), 300);
                }, 100);
            }
        }

        setRollbackConfirm({ isOpen: false, targetStep: null, targetMessageId: null, newValue: null });
    }, [stepHistory, messages, addUserMessage, processStep]);

    // 뒤로 가기 함수
    const handleGoBack = useCallback(() => {
        if (stepHistory.length === 0) return;
        const lastSnapshot = stepHistory[stepHistory.length - 1];

        // 스냅샷 시점으로 메시지 복원
        setMessages(prev => {
            const kept = prev.slice(0, lastSnapshot.messageCount);
            return kept.map((msg, idx) =>
                idx === kept.length - 1 && msg.type === 'bot' ? { ...msg, isAnswered: false } : msg
            );
        });

        // 모든 상태 복원
        setUserInput(lastSnapshot.userInput);
        setSelectedAssets(lastSnapshot.selectedAssets);
        setCurrentAssetIndex(lastSnapshot.currentAssetIndex);
        setAssetValues(lastSnapshot.assetValues);
        setSpouseSelectedAssets(lastSnapshot.spouseSelectedAssets);
        setCurrentSpouseAssetIndex(lastSnapshot.currentSpouseAssetIndex);
        setSpouseAssetValues(lastSnapshot.spouseAssetValues);
        setCurrentStep(lastSnapshot.step);

        // 히스토리 스택에서 마지막 제거
        setStepHistory(prev => prev.slice(0, -1));
    }, [stepHistory]);

    // 옵션 선택 처리 (롤백 지원)
    const handleOptionSelect = useCallback((option: ChatOption, messageId?: string) => {
        // 시작하기 버튼은 사용자 메시지 표시 안 함
        if (option.value === 'start') {
            setTimeout(() => processStep('intro'), 300);
        } else if (option.value === 'show_result') {
            setShowResult(true);
        } else {
            // 해당 메시지가 이미 답변된 것인지 확인
            const clickedMessage = messageId ? messages.find(msg => msg.id === messageId) : null;

            if (clickedMessage?.isAnswered && clickedMessage.stepId) {
                // 롤백 확인 모달 표시
                setRollbackConfirm({
                    isOpen: true,
                    targetStep: clickedMessage.stepId,
                    targetMessageId: messageId || null,
                    newValue: option.value as string | number
                });
            } else {
                // 일반 진행
                addUserMessage(option.label);
                setTimeout(() => processStep(currentStep, option.value), 300);
            }
        }
    }, [addUserMessage, processStep, currentStep, messages]);

    // 진행률 계산
    const getProgress = useCallback(() => {
        const stepOrder: Record<ChatStep, number> = {
            'intro': 0, 'address': 5, 'age': 10, 'employment': 15,
            'work_location': 17,
            'income_salary': 20, 'income_business': 22, 'income_confirm': 25,
            'marital_status': 30, 'spouse_income': 35, 'spouse_assets_select': 38,
            'spouse_asset_detail': 40, 'custody': 35, 'child_support_receive': 38,
            'child_support_pay': 38, 'minor_children': 42, 'housing_type': 48,
            'rent_cost': 50, 'deposit_amount': 52, 'deposit_loan': 54,
            'owned_value': 53, 'owned_mortgage': 55,
            'medical_check': 57, 'medical_amount': 59,
            'education_check': 61, 'education_amount': 63, 'special_education': 64,
            'assets_select': 65,
            'asset_detail': 70, 'asset_car_loan': 71, 'business_assets_deposit': 72, 'business_assets_facility': 74,
            'credit_card': 75, 'credit_card_amount': 78,
            'debt_types': 79,
            'other_debt': 82, 'debt_confirm': 85, 'priority_debt': 88,
            'priority_debt_amount': 90, 'prior_rehab': 91, 'prior_rehab_detail': 92,
            'prior_credit_recovery': 93, 'prior_credit_recovery_amount': 94, 'risk': 95,
            'legal_actions': 95.2, 'monthly_expenses': 62,
            'special_24_months': 95.5, 'elderly_parent_check': 86, 'elderly_parent_count': 87,
            'result': 100
        };
        return stepOrder[currentStep] || 0;
    }, [currentStep]);

    // Interactive Block 제출 핸들러
    const handleBlockSubmit = useCallback((messageId: string, value: string | string[] | Date) => {
        // 메시지 상태 업데이트
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, blockState: { status: 'completed', value, summary: '입력 완료' } } : msg
        ));



        // Multi Select 처리 (자산)
        if (currentStep === 'assets_select' || currentStep === 'spouse_assets_select') {
            const selectedValues = Array.isArray(value) ? value : [value as string];
            // 기존 로직 재사용을 위해 processStep 호출
            processStep(currentStep, selectedValues.length > 0 ? selectedValues : 'none');
            return;
        }
    }, [currentStep, userInput, processStep]); // calculateResult는 useEffect 내에 정의된게 아니라 컴포넌트 내 함수여야 함 (확인 필요)

    if (!isOpen) return null;

    const isDark = themeMode === 'dark';
    const bgColor = isDark ? '#1e293b' : '#ffffff';
    const borderColor = isDark ? '#374151' : '#e5e7eb';

    // Portal 렌더링 또는 직접 렌더링
    const content = (
        <>
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`fixed inset-0 z-[9999] flex items-center justify-center ${disablePortal ? '' : 'p-4'} bg-black/60 backdrop-blur-sm`}
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    className={`${disablePortal ? 'w-full max-w-md h-full rounded-none shadow-2xl' : 'w-full max-w-md h-[85vh] rounded-2xl shadow-2xl'} flex flex-col overflow-hidden`}
                    style={{
                        borderWidth: '1px',
                        borderColor: isDark ? '#374151' : '#e5e7eb',
                        fontFamily: chatFontFamily || 'inherit'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ChatbotRenderer를 사용하여 템플릿별 UI 렌더링 */}
                    <ChatbotRenderer
                        templateId={templateId}
                        mode={themeMode}
                        colors={colors}
                        messages={messages.map(msg => ({
                            id: msg.id,
                            type: msg.type,
                            content: msg.content,
                            options: msg.options?.map(opt => ({ label: opt.label, value: String(opt.value) })),
                            inputType: msg.inputType,
                            multiSelect: msg.multiSelect,
                            timestamp: msg.timestamp,
                            interactiveBlock: msg.interactiveBlock,
                            blockState: msg.blockState,
                            isAnswered: msg.isAnswered,
                            stepId: msg.stepId
                        }))}
                        inputValue={inputValue}
                        isTyping={isTyping}
                        characterName={characterName}
                        characterImage={characterImage}
                        progress={getProgress()}
                        onInputChange={setInputValue}
                        onSubmit={handleSubmit}
                        onOptionSelect={(opt, msgId) => handleOptionSelect({ label: opt.label, value: opt.value }, msgId)}
                        onClose={onClose}
                        messagesEndRef={messagesEndRef}
                        inputRef={inputRef}
                        onBlockSubmit={handleBlockSubmit}
                        enableFormBlocks={enableFormBlocks || interactiveBlockPreset !== 'none'}
                        onGoBack={handleGoBack}
                        canGoBack={stepHistory.length > 0 && currentStep !== 'intro' && currentStep !== 'result'}
                        onBlockCancel={(id) => {
                            setMessages(prev => prev.map(msg =>
                                msg.id === id ? { ...msg, blockState: { status: 'cancelled' } } : msg
                            ));
                        }}
                    />
                </motion.div>
            </motion.div>

            {/* Intro Overlay */}
            {showIntro && introConfig && (
                <div className="absolute inset-0 z-50 bg-white flex flex-col animate-fade-in">
                    <div className="flex-1 relative bg-gray-900 flex items-center justify-center overflow-hidden">
                        {introConfig.mediaType === 'image' ? (
                            <img
                                src={introConfig.mediaUrl}
                                alt="Intro"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full">
                                {/* YouTube or Video Embed */}
                                {introConfig.mediaUrl.includes('youtu') ? (
                                    <iframe
                                        src={`https://www.youtube.com/embed/${introConfig.mediaUrl.split('/').pop()?.replace('watch?v=', '')}?autoplay=1&controls=0&modestbranding=1&rel=0`}
                                        className="w-full h-full"
                                        allow="autoplay; encrypted-media"
                                        allowFullScreen
                                    />
                                ) : (
                                    <video
                                        src={introConfig.mediaUrl}
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                        <div className="absolute bottom-10 left-0 w-full px-6 text-center pb-20">
                            {introConfig.message && (
                                <h2 className="text-white text-xl font-bold mb-6 drop-shadow-lg animate-slide-up">
                                    {introConfig.message}
                                </h2>
                            )}
                            <button
                                onClick={() => setShowIntro(false)}
                                className="w-full py-4 bg-purple-600 text-white font-bold rounded-xl shadow-xl active:scale-95 transition-all text-lg animate-bounce-subtle"
                            >
                                상담 시작하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rollback Confirmation Modal */}
            {rollbackConfirm.isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-60 bg-black/50 flex items-center justify-center p-6"
                    onClick={() => setRollbackConfirm({ isOpen: false, targetStep: null, targetMessageId: null, newValue: null })}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                답변을 변경하시겠습니까?
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                이 질문 이후의 답변들이 삭제되고,<br />
                                새로운 답변으로 다시 진행됩니다.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRollbackConfirm({ isOpen: false, targetStep: null, targetMessageId: null, newValue: null })}
                                    className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => {
                                        if (rollbackConfirm.targetStep && rollbackConfirm.targetMessageId && rollbackConfirm.newValue !== null) {
                                            executeRollback(rollbackConfirm.targetStep, rollbackConfirm.targetMessageId, rollbackConfirm.newValue);
                                        }
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl text-white font-medium transition-colors"
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    변경하기
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Result Modal */}
            {showResult && result && (
                <RehabResultReport
                    result={result}
                    userInput={userInput as RehabUserInput}
                    onClose={() => {
                        setShowResult(false);
                        onClose();
                    }}
                    onConsultation={() => {
                        setShowResult(false);
                        onClose();
                    }}
                />
            )}
        </>
    );

    if (disablePortal) {
        return content;
    }

    return createPortal(content, document.body);
};

export default AIRehabChatbotV2;
