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
import { DEFAULT_POLICY_CONFIG_2026, getCourtNameForAddress, chooseFavorableCourt } from '../../config/PolicyConfig';
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
    carLoanType?: 'installment' | 'mortgage' | null;
    spouseCarLoanType?: 'installment' | 'mortgage' | null;
    realEstateLoanType?: 'mortgage' | 'deposit' | 'both' | null;
    tempRealEstateMortgage?: number;
    spouseRealEstateLoanType?: 'mortgage' | 'deposit' | 'both' | null;
    tempSpouseRealEstateMortgage?: number;
    landLoanCheck?: 'yes' | 'no' | null;
    spouseLandLoanCheck?: 'yes' | 'no' | null;
    tempBusinessDeposit?: number;
    tempBusinessPremium?: number;
    tempBusinessMachinery?: number;
    tempBusinessEtc?: number;
    tempSpouseBusinessDeposit?: number;
    tempSpouseBusinessPremium?: number;
    tempSpouseBusinessMachinery?: number;
    tempSpouseBusinessEtc?: number;
    savingsLoanCheck?: 'yes' | 'no' | null;
    spouseSavingsLoanCheck?: 'yes' | 'no' | null;
    insuranceLoanCheck?: 'yes' | 'no' | null;
    spouseInsuranceLoanCheck?: 'yes' | 'no' | null;
    tempOwnedValue?: number;
    tempOwnedMortgage?: number;
    unemployedReason?: 'illness' | 'none' | null;
    currentDebtTypeIndex?: number;
    debtTypeValues?: Record<string, number>;
}

type InputType = 'text' | 'number' | 'buttons' | 'address' | 'multiselect' | 'money';

// 대화 단계 (2026 고도화)
type ChatStep =
    | 'intro'
    | 'address'
    | 'age'
    | 'employment'
    | 'unemployed_reason'     // 무직 사유 질문 단계 (NEW)
    | 'work_location'           // NEW: 근무지역/사업지역 (관할 법원용)
    | 'income_salary'
    | 'income_business'
    | 'income_confirm'
    | 'marital_status'
    | 'spouse_income'
    | 'spouse_assets_select'
    | 'spouse_asset_detail'
    | 'spouse_asset_car_loan_check'
    | 'spouse_asset_car_loan_amount'
    | 'spouse_asset_real_estate_loan_check'
    | 'spouse_asset_real_estate_mortgage_amount'
    | 'spouse_asset_real_estate_deposit_amount'
    | 'spouse_asset_land_loan_check'
    | 'spouse_asset_land_loan_amount'
    | 'spouse_asset_business_deposit'
    | 'spouse_asset_business_premium'
    | 'spouse_asset_business_machinery'
    | 'spouse_asset_business_etc'
    | 'spouse_asset_savings_loan_check'
    | 'spouse_asset_savings_loan_amount'
    | 'spouse_asset_insurance_loan_check'
    | 'spouse_asset_insurance_loan_amount'
    | 'custody'
    | 'child_support_receive'
    | 'child_support_pay'
    | 'minor_children'
    | 'housing_type'
    | 'rent_cost'
    | 'deposit_amount'
    | 'deposit_loan'
    | 'deposit_loan_amount'  // 보증금 대출 금액 (NEW)
    | 'deposit_contract_holder' // 계약명의자 확인 (NEW)
    | 'owned_value'          // 자가 시세
    | 'owned_mortgage'       // 자가 담보대출
    | 'owned_owner_type'     // 자가 명의자 확인 (NEW)
    | 'medical_check'        // 의료비 여부 (NEW)
    | 'medical_amount'       // 의료비 금액
    | 'education_check'      // 교육비 여부 (NEW)
    | 'education_amount'     // 교육비 금액
    | 'special_education'    // 특수교육 여부 (NEW)
    | 'special_education_amount' // 특수교육비 금액 입력 (NEW)
    | 'assets_select'
    | 'asset_detail'
    | 'asset_car_loan_check'
    | 'asset_car_loan_amount'
    | 'asset_real_estate_loan_check'
    | 'asset_real_estate_mortgage_amount'
    | 'asset_real_estate_deposit_amount'
    | 'asset_land_loan_check'
    | 'asset_land_loan_amount'
    | 'asset_business_deposit'
    | 'asset_business_premium'
    | 'asset_business_machinery'
    | 'asset_business_etc'
    | 'asset_savings_loan_check'
    | 'asset_savings_loan_amount'
    | 'asset_insurance_loan_check'
    | 'asset_insurance_loan_amount'
    | 'asset_retirement_type'
    | 'asset_retirement_value'
    | 'credit_card'
    | 'credit_card_amount'
    | 'debt_confirm'
    | 'prior_rehab'          // 기존 개인회생/파산 진행 여부
    | 'prior_rehab_detail'   // 면책 년월
    | 'prior_credit_recovery' // 신용회복 상세
    | 'prior_credit_recovery_amount' // 신용회복 잔액 (NEW)
    | 'risk'
    | 'speculative_loss_amount' // 1년 이내 주식/코인 손실 또는 도박 채무 금액 확인 (NEW)
    | 'special_24_months'    // 24개월 특례 적용 여부 (기초수급자, 장애 등)
    | 'elderly_parent_check'  // 고령 부모님 부양가족 확인
    | 'elderly_parent_count'  // 고령 부모님 인원수
    | 'debt_types'            // V2.1: 채무 유형 분류
    | 'debt_amount_detail'    // 채무 유형별 금액 개별 입력 단계 (NEW)
    | 'legal_actions'         // V2.1: 법적 조치 경험
    | 'monthly_expenses'      // V2.1: 월 고정 지출
    | 'result';

// 재산 항목 타입
type AssetType = 'car' | 'realEstate' | 'land' | 'savings' | 'insurance' | 'stocks' | 'businessAssets' | 'retirementPay';

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
    stocks: '주식/코인',
    businessAssets: '사업재산',
    retirementPay: '퇴직금'
};

const ASSET_BLOCK_OPTIONS = [
    { label: '자동차', value: 'car', icon: '🚗' },
    { label: '부동산', value: 'realEstate', icon: '🏠' },
    { label: '토지', value: 'land', icon: '🏞️' },
    { label: '예금/적금', value: 'savings', icon: '💰' },
    { label: '보험', value: 'insurance', icon: '🛡️' },
    { label: '주식/코인', value: 'stocks', icon: '📈' },
    { label: '사업재산', value: 'businessAssets', icon: '🏢' },
    { label: '퇴직금', value: 'retirementPay', icon: '💼' }
];

const AIRehabChatbotV2: React.FC<AIRehabChatbotV2Props> = ({
    isOpen,
    onClose,
    onComplete,
    characterName = '김변',
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

    // 이탈 확인 및 흔들림 애니메이션 상태
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

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
        car: 0, realEstate: 0, land: 0, savings: 0, insurance: 0, stocks: 0, businessAssets: 0, retirementPay: 0
    });
    const [spouseSelectedAssets, setSpouseSelectedAssets] = useState<AssetType[]>([]);
    const [currentSpouseAssetIndex, setCurrentSpouseAssetIndex] = useState(0);
    const [spouseAssetValues, setSpouseAssetValues] = useState<Record<AssetType, number>>({
        car: 0, realEstate: 0, land: 0, savings: 0, insurance: 0, stocks: 0, businessAssets: 0, retirementPay: 0
    });
    const [carLoanType, setCarLoanType] = useState<'installment' | 'mortgage' | null>(null);
    const [spouseCarLoanType, setSpouseCarLoanType] = useState<'installment' | 'mortgage' | null>(null);
    const [realEstateLoanType, setRealEstateLoanType] = useState<'mortgage' | 'deposit' | 'both' | null>(null);
    const [tempRealEstateMortgage, setTempRealEstateMortgage] = useState<number>(0);
    const [spouseRealEstateLoanType, setSpouseRealEstateLoanType] = useState<'mortgage' | 'deposit' | 'both' | null>(null);
    const [tempSpouseRealEstateMortgage, setTempSpouseRealEstateMortgage] = useState<number>(0);
    const [landLoanCheck, setLandLoanCheck] = useState<'yes' | 'no' | null>(null);
    const [spouseLandLoanCheck, setSpouseLandLoanCheck] = useState<'yes' | 'no' | null>(null);
    const [tempBusinessDeposit, setTempBusinessDeposit] = useState<number>(0);
    const [tempBusinessPremium, setTempBusinessPremium] = useState<number>(0);
    const [tempBusinessMachinery, setTempBusinessMachinery] = useState<number>(0);
    const [tempBusinessEtc, setTempBusinessEtc] = useState<number>(0);
    const [tempSpouseBusinessDeposit, setTempSpouseBusinessDeposit] = useState<number>(0);
    const [tempSpouseBusinessPremium, setTempSpouseBusinessPremium] = useState<number>(0);
    const [tempSpouseBusinessMachinery, setTempSpouseBusinessMachinery] = useState<number>(0);
    const [tempSpouseBusinessEtc, setTempSpouseBusinessEtc] = useState<number>(0);
    const [savingsLoanCheck, setSavingsLoanCheck] = useState<'yes' | 'no' | null>(null);
    const [spouseSavingsLoanCheck, setSpouseSavingsLoanCheck] = useState<'yes' | 'no' | null>(null);
    const [insuranceLoanCheck, setInsuranceLoanCheck] = useState<'yes' | 'no' | null>(null);
    const [spouseInsuranceLoanCheck, setSpouseInsuranceLoanCheck] = useState<'yes' | 'no' | null>(null);

    // 자가 부동산 관련 상태
    const [tempOwnedValue, setTempOwnedValue] = useState<number>(0);
    const [tempOwnedMortgage, setTempOwnedMortgage] = useState<number>(0);
    const [ownedOwnerType, setOwnedOwnerType] = useState<'me' | 'spouse' | 'co-ownership' | null>(null);

    // 채무 유형별 금액 입력을 위한 상태
    const [currentDebtTypeIndex, setCurrentDebtTypeIndex] = useState<number>(0);
    const [debtTypeValues, setDebtTypeValues] = useState<Record<string, number>>({
        bank: 0, capital: 0, savings_bank: 0, tax: 0, private: 0, app_loan: 0, guarantee: 0
    });

    // 뒤로 가기: 단계 히스토리 스택
    const [stepHistory, setStepHistory] = useState<StepSnapshot[]>([]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const hasInitialized = useRef(false);
    const isRestoring = useRef(false);

    // stepId 자동 태깅용 ref (goToStep에서 동기적으로 갱신)
    const nextStepRef = useRef<ChatStep>('intro');
    const goToStep = useCallback((step: ChatStep) => {
        nextStepRef.current = step;
        setCurrentStep(step);
    }, []);

    const handleCloseRequest = useCallback(() => {
        if (currentStep === 'intro' || currentStep === 'result' || showResult || stepHistory.length === 0) {
            localStorage.removeItem('roi_rehab_chatbot_session');
            onClose();
        } else {
            setShowExitConfirm(true);
        }
    }, [currentStep, showResult, stepHistory.length, onClose]);

    const triggerShake = useCallback(() => {
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);
    }, []);

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

    const moveToAsset = useCallback((nextIndex: number) => {
        setCurrentAssetIndex(nextIndex);
        const nextAsset = selectedAssets[nextIndex];
        if (!nextAsset) return;

        if (nextAsset === 'businessAssets') {
            goToStep('asset_business_deposit');
            addBotMessage(
                '사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                undefined,
                'money'
            );
        } else if (nextAsset === 'retirementPay') {
            goToStep('asset_retirement_type');
            addBotMessage(
                '회사에서 제공하는 퇴직연금(DB/DC형 등)에 가입되어 있으신가요?',
                [
                    { label: '퇴직연금 가입', value: 'pension' },
                    { label: '퇴직연금 미가입', value: 'none' },
                    { label: '모름', value: 'unknown' }
                ],
                'buttons'
            );
        } else {
            goToStep('asset_detail');
            addBotMessage(
                `${ASSET_LABELS[nextAsset]}의 현재 가치는 대략 얼마인가요?\n\n(만원 단위)`,
                undefined,
                'money'
            );
        }
    }, [selectedAssets, goToStep, addBotMessage]);

    // 스크롤 자동 이동
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 초기 메시지 (중복 방지) 및 세션 복구 체크
    useEffect(() => {
        if (isOpen && !hasInitialized.current && messages.length === 0) {
            hasInitialized.current = true;
            
            // [PREVIEW MODE] 에디터에서 Interactive Block이 활성화된 경우 즉시 보여줌
            if (disablePortal && shouldUseBlock('form')) {
                setTimeout(() => {
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
                }, 500);
                return;
            }

            // Check if there is an active saved session
            const raw = localStorage.getItem('roi_rehab_chatbot_session');
            let foundSession = false;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.currentStep && parsed.messages && parsed.messages.length > 0) {
                        foundSession = true;
                        setTimeout(() => {
                            addBotMessage(
                                `안녕하세요! 이전에 진행 중이던 진단 내역이 존재합니다. 이어서 진행하시겠습니까?`,
                                [
                                    { label: '⏮️ 이어서 진행하기', value: 'resume' },
                                    { label: '🔄 처음부터 다시하기', value: 'restart' }
                                ],
                                'buttons'
                            );
                        }, 500);
                    }
                } catch (e) {
                    console.error('Failed to parse saved session on init', e);
                }
            }

            if (!foundSession) {
                setTimeout(() => {
                    // [DEFAULT] 기본 인트로 메시지
                    addBotMessage(
                        `안녕하세요! 법률 상담사 김변입니다 😊\n\n빚 걱정, 혼자 안 하셔도 돼요.\n몇 가지만 알려주시면 법원 기준에 맞게 분석해 드릴게요.\n\n3분이면 충분합니다. 바로 시작해 볼까요?`,
                        [{ label: '좋아요, 시작할게요', value: 'start' }],
                        'buttons'
                    );
                }, 500);
            }
        }
    }, [isOpen, characterName, disablePortal, shouldUseBlock]);

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

    // 실시간 세션 자동 저장 (Auto-Save)
    useEffect(() => {
        if (isRestoring.current) return;
        if (currentStep !== 'intro' && currentStep !== 'result' && messages.length > 0) {
            const sessionData = {
                currentStep,
                userInput,
                messages,
                stepHistory,
                selectedAssets,
                currentAssetIndex,
                assetValues,
                spouseSelectedAssets,
                currentSpouseAssetIndex,
                spouseAssetValues,
                carLoanType,
                spouseCarLoanType,
                realEstateLoanType,
                tempRealEstateMortgage,
                spouseRealEstateLoanType,
                tempSpouseRealEstateMortgage,
                landLoanCheck,
                spouseLandLoanCheck,
                tempBusinessDeposit,
                tempBusinessPremium,
                tempBusinessMachinery,
                tempBusinessEtc,
                tempSpouseBusinessDeposit,
                tempSpouseBusinessPremium,
                tempSpouseBusinessMachinery,
                tempSpouseBusinessEtc,
                savingsLoanCheck,
                spouseSavingsLoanCheck,
                insuranceLoanCheck,
                spouseInsuranceLoanCheck,
                tempOwnedValue,
                tempOwnedMortgage,
                ownedOwnerType,
                currentDebtTypeIndex,
                debtTypeValues,
                savedAt: Date.now()
            };
            localStorage.setItem('roi_rehab_chatbot_session', JSON.stringify(sessionData));
        }
    }, [
        currentStep,
        userInput,
        messages,
        stepHistory,
        selectedAssets,
        currentAssetIndex,
        assetValues,
        spouseSelectedAssets,
        currentSpouseAssetIndex,
        spouseAssetValues,
        carLoanType,
        spouseCarLoanType,
        realEstateLoanType,
        tempRealEstateMortgage,
        spouseRealEstateLoanType,
        tempSpouseRealEstateMortgage,
        landLoanCheck,
        spouseLandLoanCheck,
        tempBusinessDeposit,
        tempBusinessPremium,
        tempBusinessMachinery,
        tempBusinessEtc,
        tempSpouseBusinessDeposit,
        tempSpouseBusinessPremium,
        tempSpouseBusinessMachinery,
        tempSpouseBusinessEtc,
        savingsLoanCheck,
        spouseSavingsLoanCheck,
        insuranceLoanCheck,
        spouseInsuranceLoanCheck,
        tempOwnedValue,
        tempOwnedMortgage,
        ownedOwnerType,
        currentDebtTypeIndex,
        debtTypeValues
    ]);



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
                    messageCount: messages.length,
                    carLoanType,
                    spouseCarLoanType,
                    realEstateLoanType,
                    tempRealEstateMortgage,
                    spouseRealEstateLoanType,
                    tempSpouseRealEstateMortgage,
                    landLoanCheck,
                    spouseLandLoanCheck,
                    tempBusinessDeposit,
                    tempBusinessPremium,
                    tempBusinessMachinery,
                    tempBusinessEtc,
                    tempSpouseBusinessDeposit,
                    tempSpouseBusinessPremium,
                    tempSpouseBusinessMachinery,
                    tempSpouseBusinessEtc,
                    savingsLoanCheck,
                    spouseSavingsLoanCheck,
                    insuranceLoanCheck,
                    spouseInsuranceLoanCheck,
                    tempOwnedValue,
                    tempOwnedMortgage,
                    ownedOwnerType,
                    unemployedReason: userInput.unemployedReason,
                    currentDebtTypeIndex,
                    debtTypeValues: { ...debtTypeValues }
                }];
            });
        }
        switch (step) {
            case 'intro':
                if (value === 'resume') {
                    const raw = localStorage.getItem('roi_rehab_chatbot_session');
                    if (raw) {
                        try {
                            const data = JSON.parse(raw);
                            isRestoring.current = true;
                            
                            if (data.userInput) setUserInput(data.userInput);
                            if (data.messages) {
                                const restoredMessages = data.messages.map((m: any) => ({
                                    ...m,
                                    timestamp: new Date(m.timestamp)
                                }));
                                setMessages(restoredMessages);
                            }
                            if (data.stepHistory) setStepHistory(data.stepHistory);
                            if (data.selectedAssets) setSelectedAssets(data.selectedAssets);
                            if (data.currentAssetIndex !== undefined) setCurrentAssetIndex(data.currentAssetIndex);
                            if (data.assetValues) setAssetValues(data.assetValues);
                            if (data.spouseSelectedAssets) setSpouseSelectedAssets(data.spouseSelectedAssets);
                            if (data.currentSpouseAssetIndex !== undefined) setCurrentSpouseAssetIndex(data.currentSpouseAssetIndex);
                            if (data.spouseAssetValues) setSpouseAssetValues(data.spouseAssetValues);
                            if (data.carLoanType !== undefined) setCarLoanType(data.carLoanType);
                            if (data.spouseCarLoanType !== undefined) setSpouseCarLoanType(data.spouseCarLoanType);
                            if (data.realEstateLoanType !== undefined) setRealEstateLoanType(data.realEstateLoanType);
                            if (data.tempRealEstateMortgage !== undefined) setTempRealEstateMortgage(data.tempRealEstateMortgage);
                            if (data.spouseRealEstateLoanType !== undefined) setSpouseRealEstateLoanType(data.spouseRealEstateLoanType);
                            if (data.tempSpouseRealEstateMortgage !== undefined) setTempSpouseRealEstateMortgage(data.tempSpouseRealEstateMortgage);
                            if (data.landLoanCheck !== undefined) setLandLoanCheck(data.landLoanCheck);
                            if (data.spouseLandLoanCheck !== undefined) setSpouseLandLoanCheck(data.spouseLandLoanCheck);
                            if (data.tempBusinessDeposit !== undefined) setTempBusinessDeposit(data.tempBusinessDeposit);
                            if (data.tempBusinessPremium !== undefined) setTempBusinessPremium(data.tempBusinessPremium);
                            if (data.tempBusinessMachinery !== undefined) setTempBusinessMachinery(data.tempBusinessMachinery);
                            if (data.tempBusinessEtc !== undefined) setTempBusinessEtc(data.tempBusinessEtc);
                            if (data.tempSpouseBusinessDeposit !== undefined) setTempSpouseBusinessDeposit(data.tempSpouseBusinessDeposit);
                            if (data.tempSpouseBusinessPremium !== undefined) setTempSpouseBusinessPremium(data.tempSpouseBusinessPremium);
                            if (data.tempSpouseBusinessMachinery !== undefined) setTempSpouseBusinessMachinery(data.tempSpouseBusinessMachinery);
                            if (data.tempSpouseBusinessEtc !== undefined) setTempSpouseBusinessEtc(data.tempSpouseBusinessEtc);
                            if (data.savingsLoanCheck !== undefined) setSavingsLoanCheck(data.savingsLoanCheck);
                            if (data.spouseSavingsLoanCheck !== undefined) setSpouseSavingsLoanCheck(data.spouseSavingsLoanCheck);
                            if (data.insuranceLoanCheck !== undefined) setInsuranceLoanCheck(data.insuranceLoanCheck);
                            if (data.spouseInsuranceLoanCheck !== undefined) setSpouseInsuranceLoanCheck(data.spouseInsuranceLoanCheck);
                            if (data.tempOwnedValue !== undefined) setTempOwnedValue(data.tempOwnedValue);
                            if (data.tempOwnedMortgage !== undefined) setTempOwnedMortgage(data.tempOwnedMortgage);
                            if (data.ownedOwnerType !== undefined) setOwnedOwnerType(data.ownedOwnerType);
                            if (data.currentDebtTypeIndex !== undefined) setCurrentDebtTypeIndex(data.currentDebtTypeIndex);
                            if (data.debtTypeValues) setDebtTypeValues(data.debtTypeValues);
                            
                            if (data.currentStep) {
                                goToStep(data.currentStep);
                                const lastMsg = data.messages?.[data.messages.length - 1];
                                if (lastMsg && lastMsg.type === 'bot' && (lastMsg.inputType === 'number' || lastMsg.inputType === 'text' || lastMsg.inputType === 'address' || lastMsg.inputType === 'money')) {
                                    setTimeout(() => inputRef.current?.focus(), 200);
                                }
                            }
                            
                            hasInitialized.current = true;
                            
                            setTimeout(() => {
                                isRestoring.current = false;
                            }, 50);
                            break;
                        } catch (e) {
                            console.error('Error restoring session:', e);
                            isRestoring.current = false;
                        }
                    }
                }
                
                localStorage.removeItem('roi_rehab_chatbot_session');
                goToStep('address');
                addBotMessage(
                    '지금 **살고 계신 곳**이 어디인가요?\n\n(예: 서울 강남구, 수원시 영통구)',
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
                        { label: '🔍 무직/구직 중', value: 'none' },
                        { label: '🌾 기초생활수급', value: 'basic_recipient' }
                    ],
                    'buttons'
                );
                break;

            case 'employment':
                const employmentType = value as 'salary' | 'business' | 'freelancer' | 'both' | 'none' | 'daily' | 'basic_recipient';
                setUserInput(prev => ({ ...prev, employmentType }));

                if (employmentType === 'none' || employmentType === 'basic_recipient') {
                    // 무직/수급: 200만원 기준으로 자동 설정, 근무지역 질문 스킵하고 무직 사유 질문으로 이동
                    setUserInput(prev => ({ ...prev, monthlyIncome: 2000000 }));
                    goToStep('unemployed_reason');
                    addBotMessage(
                        '일을 못 하시는 이유가 **몸이 아프시거나 장애** 때문인가요?',
                        [
                            { label: '예 (일하기 어려워요)', value: 'illness' },
                            { label: '아니오 (일할 수 있어요 / 구직 중)', value: 'none' }
                        ],
                        'buttons'
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

            case 'unemployed_reason':
                const reason = value as 'illness' | 'none';
                setUserInput(prev => ({ ...prev, unemployedReason: reason }));
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
                            : empType === 'freelancer'
                            ? '세금을 제외한 월 평균 실수령액은 얼마인가요?(매달 일정하지 않다면 6개월 평균으로 나눠서 입력해 주세요)\n\n(만원 단위)'
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
                        if (assets[0] === 'businessAssets') {
                            goToStep('spouse_asset_business_deposit');
                            addBotMessage(
                                '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                                undefined,
                                'money'
                            );
                        } else {
                            goToStep('spouse_asset_detail');
                            addBotMessage(
                                `배우자의 ${ASSET_LABELS[assets[0]]} 가치는 대략 얼마인가요?\n\n(만원 단위)`,
                                undefined,
                                'money'
                            );
                        }
                    }
                }
                break;

            case 'spouse_asset_detail': {
                const spouseAssetType = spouseSelectedAssets[currentSpouseAssetIndex];
                if (spouseAssetType === 'businessAssets') {
                    goToStep('spouse_asset_business_deposit');
                    addBotMessage(
                        '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                        undefined,
                        'money'
                    );
                    return;
                }
                const rawVal = (value as number) * 10000;
                setSpouseAssetValues(prev => ({ ...prev, [spouseAssetType]: rawVal }));

                if (spouseAssetType === 'savings') {
                    goToStep('spouse_asset_savings_loan_check');
                    addBotMessage(
                        '해당 예금/적금을 담보로 한 대출(예적금 담보대출)이 있나요?',
                        [
                            { label: '네, 있어요', value: 'yes' },
                            { label: '아니요, 없어요', value: 'no' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (spouseAssetType === 'insurance') {
                    goToStep('spouse_asset_insurance_loan_check');
                    addBotMessage(
                        '해당 보험을 담보로 한 대출(보험계약대출/약관대출)이 있나요?',
                        [
                            { label: '네, 있어요', value: 'yes' },
                            { label: '아니요, 없어요', value: 'no' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (spouseAssetType === 'car') {
                    goToStep('spouse_asset_car_loan_check');
                    addBotMessage(
                        '해당 배우자 자동차에 남은 할부 금액 또는 담보대출이 있나요?',
                        [
                            { label: '할부', value: 'installment' },
                            { label: '담보 대출', value: 'mortgage' },
                            { label: '없어요', value: 'none' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (spouseAssetType === 'realEstate') {
                    goToStep('spouse_asset_real_estate_loan_check');
                    addBotMessage(
                        '해당 배우자 부동산에 담보대출이나 임대(세입자) 보증금이 있나요?',
                        [
                            { label: '담보 대출', value: 'mortgage' },
                            { label: '임대 보증금', value: 'deposit' },
                            { label: '둘 다 있음', value: 'both' },
                            { label: '없어요', value: 'none' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (spouseAssetType === 'land') {
                    goToStep('spouse_asset_land_loan_check');
                    addBotMessage(
                        '해당 배우자 토지에 남은 담보대출이 있나요?',
                        [
                            { label: '대출 있음', value: 'yes' },
                            { label: '없어요', value: 'no' }
                        ],
                        'buttons'
                    );
                    return;
                }

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
                    const totalSpouseAssets = (Object.values(spouseAssetValues) as number[]).reduce((a, b) => a + b, 0) + rawVal;
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
            }

            case 'spouse_asset_real_estate_loan_check': {
                const type = value as 'mortgage' | 'deposit' | 'both' | 'none';
                setSpouseRealEstateLoanType(type === 'none' ? null : type);

                if (type === 'none') {
                    // 없어요 선택 시 차감 없이 바로 다음 배우자 자산으로
                    if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                        const nextIndex = currentSpouseAssetIndex + 1;
                        setCurrentSpouseAssetIndex(nextIndex);
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    } else {
                        const totalSpouseAssets = (Object.values(spouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
                } else if (type === 'mortgage' || type === 'both') {
                    goToStep('spouse_asset_real_estate_mortgage_amount');
                    addBotMessage(
                        '해당 배우자 부동산에 남은 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else if (type === 'deposit') {
                    goToStep('spouse_asset_real_estate_deposit_amount');
                    addBotMessage(
                        '해당 배우자 부동산에 남은 임대(세입자) 보증금은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'spouse_asset_real_estate_mortgage_amount': {
                const mortgageVal = (value as number) * 10000;
                setTempSpouseRealEstateMortgage(mortgageVal);

                if (spouseRealEstateLoanType === 'both') {
                    goToStep('spouse_asset_real_estate_deposit_amount');
                    addBotMessage(
                        '해당 배우자 부동산에 남은 임대(세입자) 보증금은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    // 담보대출만 있는 경우: 즉시 차감 계산 후 다음 진행
                    const rePrice = spouseAssetValues.realEstate || 0;
                    const reNetValue = Math.max(0, rePrice - mortgageVal);
                    setSpouseAssetValues(prev => ({ ...prev, realEstate: reNetValue }));
                    const updatedSpouseAssetValues = { ...spouseAssetValues, realEstate: reNetValue };

                    if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                        const nextIndex = currentSpouseAssetIndex + 1;
                        setCurrentSpouseAssetIndex(nextIndex);
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    } else {
                        const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
                }
                break;
            }

            case 'spouse_asset_real_estate_deposit_amount': {
                const depositVal = (value as number) * 10000;
                const rePrice = spouseAssetValues.realEstate || 0;
                
                let reNetValue = 0;
                if (spouseRealEstateLoanType === 'both') {
                    reNetValue = Math.max(0, rePrice - tempSpouseRealEstateMortgage - depositVal);
                } else {
                    reNetValue = Math.max(0, rePrice - depositVal);
                }

                setSpouseAssetValues(prev => ({ ...prev, realEstate: reNetValue }));
                const updatedSpouseAssetValues = { ...spouseAssetValues, realEstate: reNetValue };

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    goToStep('spouse_asset_detail');
                    addBotMessage(
                        `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                } else {
                    const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
            }

            case 'spouse_asset_land_loan_check': {
                const type = value as 'yes' | 'no';
                setSpouseLandLoanCheck(type);

                if (type === 'no') {
                    // 없어요 선택 시 차감 없이 바로 다음 배우자 자산으로
                    if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                        const nextIndex = currentSpouseAssetIndex + 1;
                        setCurrentSpouseAssetIndex(nextIndex);
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    } else {
                        const totalSpouseAssets = (Object.values(spouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
                } else {
                    goToStep('spouse_asset_land_loan_amount');
                    addBotMessage(
                        '해당 배우자 토지에 남은 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'spouse_asset_land_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const landPrice = spouseAssetValues.land || 0;
                const landNetValue = Math.max(0, landPrice - loanAmount);

                setSpouseAssetValues(prev => ({ ...prev, land: landNetValue }));
                const updatedSpouseAssetValues = { ...spouseAssetValues, land: landNetValue };

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    goToStep('spouse_asset_detail');
                    addBotMessage(
                        `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                } else {
                    const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
            }

            case 'spouse_asset_car_loan_check': {
                const type = value as 'installment' | 'mortgage' | 'none';
                setSpouseCarLoanType(type === 'none' ? null : type);

                if (type === 'none') {
                    // 없어요 선택 시 차감 없이 바로 다음으로 진행
                    if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                        const nextIndex = currentSpouseAssetIndex + 1;
                        setCurrentSpouseAssetIndex(nextIndex);
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[spouseSelectedAssets[nextIndex]]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    } else {
                        const totalSpouseAssets = (Object.values(spouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
                } else {
                    goToStep('spouse_asset_car_loan_amount');
                    const labelText = type === 'installment' ? '할부 금액' : '담보대출 금액';
                    addBotMessage(
                        `해당 배우자 자동차에 남은 [${labelText}]은 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'spouse_asset_car_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const carPrice = spouseAssetValues.car || 0;
                const carNetValue = Math.max(0, carPrice - loanAmount);

                setSpouseAssetValues(prev => ({ ...prev, car: carNetValue }));
                const updatedSpouseAssetValues = { ...spouseAssetValues, car: carNetValue };

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    const nextAsset = spouseSelectedAssets[nextIndex];
                    if (nextAsset === 'businessAssets') {
                        goToStep('spouse_asset_business_deposit');
                        addBotMessage(
                            '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                            undefined,
                            'money'
                        );
                    } else {
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[nextAsset]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    }
                } else {
                    // 배우자 재산 합산
                    const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
            }

            case 'spouse_asset_business_deposit': {
                const depVal = (value as number) * 10000;
                setTempSpouseBusinessDeposit(depVal);
                goToStep('spouse_asset_business_premium');
                addBotMessage(
                    '배우자 사업장의 권리금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'spouse_asset_business_premium': {
                const premVal = (value as number) * 10000;
                setTempSpouseBusinessPremium(premVal);
                goToStep('spouse_asset_business_machinery');
                addBotMessage(
                    '배우자 사업장의 시설 및 기자재 가치는 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'spouse_asset_business_machinery': {
                const machVal = (value as number) * 10000;
                setTempSpouseBusinessMachinery(machVal);
                goToStep('spouse_asset_business_etc');
                addBotMessage(
                    '배우자의 그 외 기타 사업재산의 가치는 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'spouse_asset_business_etc': {
                const etcVal = (value as number) * 10000;
                setTempSpouseBusinessEtc(etcVal);
                
                const bizTotal = tempSpouseBusinessDeposit + tempSpouseBusinessPremium + tempSpouseBusinessMachinery + etcVal;
                
                setSpouseAssetValues(prev => ({ ...prev, businessAssets: bizTotal }));
                const updatedSpouseAssetValues = { ...spouseAssetValues, businessAssets: bizTotal };

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    const nextAsset = spouseSelectedAssets[nextIndex];
                    if (nextAsset === 'businessAssets') {
                        goToStep('spouse_asset_business_deposit');
                        addBotMessage(
                            '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                            undefined,
                            'money'
                        );
                    } else {
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[nextAsset]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    }
                } else {
                    const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
            }

            case 'spouse_asset_savings_loan_check': {
                const checkVal = value as 'yes' | 'no';
                setSpouseSavingsLoanCheck(checkVal);

                if (checkVal === 'yes') {
                    goToStep('spouse_asset_savings_loan_amount');
                    addBotMessage(
                        '해당 배우자 예금/적금의 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    const updatedSpouseAssetValues = { ...spouseAssetValues };
                    if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                        const nextIndex = currentSpouseAssetIndex + 1;
                        setCurrentSpouseAssetIndex(nextIndex);
                        const nextAsset = spouseSelectedAssets[nextIndex];
                        if (nextAsset === 'businessAssets') {
                            goToStep('spouse_asset_business_deposit');
                            addBotMessage(
                                '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                                undefined,
                                'money'
                            );
                        } else {
                            goToStep('spouse_asset_detail');
                            addBotMessage(
                                `배우자의 ${ASSET_LABELS[nextAsset]} 가치는 얼마인가요?\n\n(만원 단위)`,
                                undefined,
                                'money'
                            );
                        }
                    } else {
                        const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
                }
                break;
            }

            case 'spouse_asset_savings_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const savingsPrice = spouseAssetValues.savings || 0;
                const savingsNetValue = Math.max(0, savingsPrice - loanAmount);

                setSpouseAssetValues(prev => ({ ...prev, savings: savingsNetValue }));
                const updatedSpouseAssetValues = { ...spouseAssetValues, savings: savingsNetValue };

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    const nextAsset = spouseSelectedAssets[nextIndex];
                    if (nextAsset === 'businessAssets') {
                        goToStep('spouse_asset_business_deposit');
                        addBotMessage(
                            '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                            undefined,
                            'money'
                        );
                    } else {
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[nextAsset]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    }
                } else {
                    const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
            }

            case 'spouse_asset_insurance_loan_check': {
                const checkVal = value as 'yes' | 'no';
                setSpouseInsuranceLoanCheck(checkVal);

                if (checkVal === 'yes') {
                    goToStep('spouse_asset_insurance_loan_amount');
                    addBotMessage(
                        '해당 배우자 보험의 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    const updatedSpouseAssetValues = { ...spouseAssetValues };
                    if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                        const nextIndex = currentSpouseAssetIndex + 1;
                        setCurrentSpouseAssetIndex(nextIndex);
                        const nextAsset = spouseSelectedAssets[nextIndex];
                        if (nextAsset === 'businessAssets') {
                            goToStep('spouse_asset_business_deposit');
                            addBotMessage(
                                '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                                undefined,
                                'money'
                            );
                        } else {
                            goToStep('spouse_asset_detail');
                            addBotMessage(
                                `배우자의 ${ASSET_LABELS[nextAsset]} 가치는 얼마인가요?\n\n(만원 단위)`,
                                undefined,
                                'money'
                            );
                        }
                    } else {
                        const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
                }
                break;
            }

            case 'spouse_asset_insurance_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const insurancePrice = spouseAssetValues.insurance || 0;
                const insuranceNetValue = Math.max(0, insurancePrice - loanAmount);

                setSpouseAssetValues(prev => ({ ...prev, insurance: insuranceNetValue }));
                const updatedSpouseAssetValues = { ...spouseAssetValues, insurance: insuranceNetValue };

                if (currentSpouseAssetIndex < spouseSelectedAssets.length - 1) {
                    const nextIndex = currentSpouseAssetIndex + 1;
                    setCurrentSpouseAssetIndex(nextIndex);
                    const nextAsset = spouseSelectedAssets[nextIndex];
                    if (nextAsset === 'businessAssets') {
                        goToStep('spouse_asset_business_deposit');
                        addBotMessage(
                            '배우자 사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                            undefined,
                            'money'
                        );
                    } else {
                        goToStep('spouse_asset_detail');
                        addBotMessage(
                            `배우자의 ${ASSET_LABELS[nextAsset]} 가치는 얼마인가요?\n\n(만원 단위)`,
                            undefined,
                            'money'
                        );
                    }
                } else {
                    const totalSpouseAssets = (Object.values(updatedSpouseAssetValues) as number[]).reduce((a, b) => a + b, 0);
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
            }

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
                        '매달 **병원비**로 나가는 돈이 있으신가요? (본인 또는 가족)',
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
                    'money'
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
                    goToStep('deposit_loan_amount');
                    addBotMessage(
                        '보증금 대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, depositLoan: 0 }));
                    goToStep('deposit_contract_holder');
                    addBotMessage(
                        '해당 임대차 계약의 **명의자(계약서상 임차인)**가 누구인가요?',
                        [
                            { label: '본인', value: 'self' },
                            { label: '배우자', value: 'spouse' },
                            { label: '지인, 가족, 회사 등', value: 'others' }
                        ],
                        'buttons'
                    );
                }
                break;

            case 'deposit_loan_amount':
                setUserInput(prev => ({ ...prev, depositLoan: (value as number) * 10000 }));
                goToStep('deposit_contract_holder');
                addBotMessage(
                    '해당 임대차 계약의 **명의자(계약서상 임차인)**가 누구인가요?',
                    [
                        { label: '본인', value: 'self' },
                        { label: '배우자', value: 'spouse' },
                        { label: '지인, 가족, 회사 등', value: 'others' }
                    ],
                    'buttons'
                );
                break;

            case 'deposit_contract_holder':
                const holder = value as 'self' | 'spouse' | 'others';
                if (holder === 'others') {
                    setUserInput(prev => ({
                        ...prev,
                        housingContractHolder: 'others',
                        housingType: 'free',
                        deposit: 0,
                        rentCost: 0,
                        depositLoan: 0
                    }));
                    addBotMessage(
                        '명의자가 지인/가족/회사인 경우 **무상거주**로 분류되어 보증금이 재산(청산가치)에서 전액 제외됩니다. 😊',
                        undefined,
                        undefined
                    );
                } else {
                    setUserInput(prev => ({ ...prev, housingContractHolder: holder }));
                }

                goToStep('medical_check');
                setTimeout(() => {
                    addBotMessage(
                        '매달 **병원비**로 나가는 돈이 있으신가요? (본인 또는 가족)',
                        [
                            { label: '없어요', value: 'no' },
                            { label: '있어요', value: 'yes' }
                        ],
                        'buttons'
                    );
                }, holder === 'others' ? 800 : 0);
                break;

            case 'owned_value':
                setTempOwnedValue((value as number) * 10000);
                goToStep('owned_mortgage');
                addBotMessage(
                    '해당 부동산에 담보대출이 있으신가요?\n\n만원 단위로 입력해주세요. (없으면 0)',
                    undefined,
                    'money'
                );
                break;

            case 'owned_mortgage':
                setTempOwnedMortgage((value as number) * 10000);
                goToStep('owned_owner_type');
                addBotMessage(
                    '해당 부동산의 명의자는 누구인가요?',
                    [
                        { label: '본인', value: 'me' },
                        { label: '배우자', value: 'spouse' },
                        { label: '공동명의', value: 'co-ownership' }
                    ],
                    'buttons'
                );
                break;

            case 'owned_owner_type':
                const ownerType = value as 'me' | 'spouse' | 'co-ownership';
                setOwnedOwnerType(ownerType);

                // 1. 순자산액 = 시세 - 담보대출 (최소 0)
                const netAssetValue = Math.max(0, tempOwnedValue - tempOwnedMortgage);

                // 2. 명의자와 관할 법원 설정에 따른 반영률 결정
                let reflectionRate = 0;
                if (ownerType === 'me') {
                    reflectionRate = 1.0;
                } else if (ownerType === 'co-ownership') {
                    reflectionRate = 0.5;
                } else if (ownerType === 'spouse') {
                    const resCourt = getCourtNameForAddress(userInput.address || '', policyConfig || DEFAULT_POLICY_CONFIG_2026);
                    const workCourt = userInput.workLocation ? getCourtNameForAddress(userInput.workLocation, policyConfig || DEFAULT_POLICY_CONFIG_2026) : 'Default';
                    const activeCourt = chooseFavorableCourt(resCourt, workCourt, policyConfig || DEFAULT_POLICY_CONFIG_2026);
                    const courtTrait = (policyConfig || DEFAULT_POLICY_CONFIG_2026).courtTraits[activeCourt] || (policyConfig || DEFAULT_POLICY_CONFIG_2026).courtTraits['Default'];
                    
                    // 법원별 성향 관리에 체크되어 있으면 spousePropertyRate가 0.5, 체크 해제 시 0.0
                    reflectionRate = courtTrait?.spousePropertyRate || 0.0;
                }

                // 3. 최종 금액 계산 후 본인 자산에 추가
                const finalAssetToInclude = Math.round(netAssetValue * reflectionRate);
                setUserInput(prev => ({ ...prev, myAssets: (prev.myAssets || 0) + finalAssetToInclude }));

                // 4. 다음 단계로 진행
                goToStep('medical_check');
                addBotMessage(
                    '매달 **병원비**로 나가는 돈이 있으신가요? (본인 또는 가족)',
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
                        '아이 **학비나 학원비**로 매달 나가는 돈이 있으신가요?',
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
                    '아이 **학비나 학원비**로 매달 나가는 돈이 있으신가요?',
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
                    setUserInput(prev => ({ ...prev, educationCost: 0, monthlyFixedExpenses: 0 }));
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
                            { label: '🏢 사업재산', value: 'businessAssets' },
                            { label: '💼 퇴직금', value: 'retirementPay' },
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
                }
                break;

            case 'education_amount':
                setUserInput(prev => ({ ...prev, educationCost: (value as number) * 10000 }));
                goToStep('special_education');
                addBotMessage(
                    '아이 중에 **특수교육**이 필요한 경우가 있나요?\n\n(인정 한도가 더 높아요)',
                    [
                        { label: '아니요, 일반 교육이에요', value: 'no' },
                        { label: '네, 특수교육이 필요해요', value: 'yes' }
                    ],
                    'buttons'
                );
                break;

            case 'special_education':
                const isSpecial = value === 'yes';
                setUserInput(prev => ({ ...prev, hasSpecialEducation: isSpecial }));
                if (isSpecial) {
                    goToStep('special_education_amount');
                    addBotMessage(
                        '특수교육비는 매달 대략 얼마가 지출되나요?\n\n(만원 단위, 증빙 가능한 금액)',
                        undefined,
                        'money'
                    );
                } else {
                    setUserInput(prev => ({ ...prev, specialEducationCost: 0, monthlyFixedExpenses: 0 }));
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
                            { label: '🏢 사업재산', value: 'businessAssets' },
                            { label: '💼 퇴직금', value: 'retirementPay' },
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
                }
                break;

            case 'special_education_amount':
                const specialEduAmt = (value as number) * 10000;
                setUserInput(prev => ({ ...prev, specialEducationCost: specialEduAmt, monthlyFixedExpenses: 0 }));
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
                        { label: '🏢 사업재산', value: 'businessAssets' },
                        { label: '💼 퇴직금', value: 'retirementPay' },
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
                        if (assets[0] === 'businessAssets') {
                            goToStep('asset_business_deposit');
                            addBotMessage(
                                '사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                                undefined,
                                'money'
                            );
                        } else if (assets[0] === 'retirementPay') {
                            goToStep('asset_retirement_type');
                            addBotMessage(
                                '회사에서 제공하는 퇴직연금(DB/DC형 등)에 가입되어 있으신가요?',
                                [
                                    { label: '퇴직연금 가입', value: 'pension' },
                                    { label: '퇴직연금 미가입', value: 'none' },
                                    { label: '모름', value: 'unknown' }
                                ],
                                'buttons'
                            );
                        } else {
                            goToStep('asset_detail');
                            addBotMessage(
                                `${ASSET_LABELS[assets[0]]}의 현재 가치는 대략 얼마인가요?\n\n(만원 단위)`,
                                undefined,
                                'money'
                            );
                        }
                    }
                }
                break;

            case 'asset_detail': {
                const assetType = selectedAssets[currentAssetIndex];
                if (assetType === 'businessAssets') {
                    goToStep('asset_business_deposit');
                    addBotMessage(
                        '사업장의 임대보증금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                        undefined,
                        'money'
                    );
                    return;
                }
                const rawVal = (value as number) * 10000;
                setAssetValues(prev => ({ ...prev, [assetType]: rawVal }));

                if (assetType === 'savings') {
                    goToStep('asset_savings_loan_check');
                    addBotMessage(
                        '해당 예금/적금을 담보로 한 대출(예적금 담보대출)이 있나요?',
                        [
                            { label: '네, 있어요', value: 'yes' },
                            { label: '아니요, 없어요', value: 'no' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (assetType === 'insurance') {
                    goToStep('asset_insurance_loan_check');
                    addBotMessage(
                        '해당 보험을 담보로 한 대출(보험계약대출/약관대출)이 있나요?',
                        [
                            { label: '네, 있어요', value: 'yes' },
                            { label: '아니요, 없어요', value: 'no' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (assetType === 'car') {
                    goToStep('asset_car_loan_check');
                    addBotMessage(
                        '해당 자동차에 남은 할부 금액 또는 담보대출이 있나요?',
                        [
                            { label: '할부', value: 'installment' },
                            { label: '담보 대출', value: 'mortgage' },
                            { label: '없어요', value: 'none' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (assetType === 'realEstate') {
                    goToStep('asset_real_estate_loan_check');
                    addBotMessage(
                        '해당 부동산에 담보대출이나 임대(세입자) 보증금이 있나요?',
                        [
                            { label: '담보 대출', value: 'mortgage' },
                            { label: '임대 보증금', value: 'deposit' },
                            { label: '둘 다 있음', value: 'both' },
                            { label: '없어요', value: 'none' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (assetType === 'land') {
                    goToStep('asset_land_loan_check');
                    addBotMessage(
                        '해당 토지에 남은 담보대출이 있나요?',
                        [
                            { label: '대출 있음', value: 'yes' },
                            { label: '없어요', value: 'no' }
                        ],
                        'buttons'
                    );
                    return;
                }

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    // 재산 합산
                    const totalAssets = Object.entries(assetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0) + (assetType !== 'retirementPay' ? rawVal : 0);
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

            case 'asset_real_estate_loan_check': {
                const type = value as 'mortgage' | 'deposit' | 'both' | 'none';
                setRealEstateLoanType(type === 'none' ? null : type);

                if (type === 'none') {
                    // 없어요 선택 시 차감 없이 바로 다음 자산으로
                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(assetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                } else if (type === 'mortgage' || type === 'both') {
                    goToStep('asset_real_estate_mortgage_amount');
                    addBotMessage(
                        '해당 부동산에 남은 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else if (type === 'deposit') {
                    goToStep('asset_real_estate_deposit_amount');
                    addBotMessage(
                        '해당 부동산에 남은 임대(세입자) 보증금은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'asset_real_estate_mortgage_amount': {
                const mortgageVal = (value as number) * 10000;
                setTempRealEstateMortgage(mortgageVal);

                if (realEstateLoanType === 'both') {
                    goToStep('asset_real_estate_deposit_amount');
                    addBotMessage(
                        '해당 부동산에 남은 임대(세입자) 보증금은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    // 담보대출만 있는 경우: 즉시 차감 계산 후 다음 자산 진행
                    const rePrice = assetValues.realEstate || 0;
                    const reNetValue = Math.max(0, rePrice - mortgageVal);
                    setAssetValues(prev => ({ ...prev, realEstate: reNetValue }));
                    const updatedAssetValues = { ...assetValues, realEstate: reNetValue };

                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(updatedAssetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                }
                break;
            }

            case 'asset_real_estate_deposit_amount': {
                const depositVal = (value as number) * 10000;
                const rePrice = assetValues.realEstate || 0;
                
                let reNetValue = 0;
                if (realEstateLoanType === 'both') {
                    reNetValue = Math.max(0, rePrice - tempRealEstateMortgage - depositVal);
                } else {
                    reNetValue = Math.max(0, rePrice - depositVal);
                }

                setAssetValues(prev => ({ ...prev, realEstate: reNetValue }));
                const updatedAssetValues = { ...assetValues, realEstate: reNetValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    const totalAssets = Object.entries(updatedAssetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0);
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

            case 'asset_land_loan_check': {
                const type = value as 'yes' | 'no';
                setLandLoanCheck(type);

                if (type === 'no') {
                    // 없어요 선택 시 차감 없이 바로 다음 자산으로
                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(assetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                } else {
                    goToStep('asset_land_loan_amount');
                    addBotMessage(
                        '해당 토지에 남은 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'asset_land_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const landPrice = assetValues.land || 0;
                const landNetValue = Math.max(0, landPrice - loanAmount);

                setAssetValues(prev => ({ ...prev, land: landNetValue }));
                const updatedAssetValues = { ...assetValues, land: landNetValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    const totalAssets = Object.entries(updatedAssetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0);
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

            case 'asset_car_loan_check': {
                const type = value as 'installment' | 'mortgage' | 'none';
                setCarLoanType(type === 'none' ? null : type);

                if (type === 'none') {
                    // 없어요 선택 시 차감 없이 바로 다음으로 진행
                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(assetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                } else {
                    goToStep('asset_car_loan_amount');
                    const labelText = type === 'installment' ? '할부 금액' : '담보대출 금액';
                    addBotMessage(
                        `해당 자동차에 남은 [${labelText}]은 얼마인가요?\n\n(만원 단위)`,
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'asset_car_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const carPrice = assetValues.car || 0;
                const carNetValue = Math.max(0, carPrice - loanAmount);

                setAssetValues(prev => ({ ...prev, car: carNetValue }));
                const updatedAssetValues = { ...assetValues, car: carNetValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    // 재산 합산
                    const totalAssets = Object.entries(updatedAssetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0);
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

            case 'asset_business_deposit': {
                const depVal = (value as number) * 10000;
                setTempBusinessDeposit(depVal);
                goToStep('asset_business_premium');
                addBotMessage(
                    '사업장의 권리금은 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'asset_business_premium': {
                const premVal = (value as number) * 10000;
                setTempBusinessPremium(premVal);
                goToStep('asset_business_machinery');
                addBotMessage(
                    '시설 및 기자재 가치는 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'asset_business_machinery': {
                const machVal = (value as number) * 10000;
                setTempBusinessMachinery(machVal);
                goToStep('asset_business_etc');
                addBotMessage(
                    '그 외 기타 사업재산의 가치는 대략 얼마인가요?\n\n(없으시면 0을 입력해주세요, 만원 단위)',
                    undefined,
                    'money'
                );
                break;
            }

            case 'asset_business_etc': {
                const etcVal = (value as number) * 10000;
                setTempBusinessEtc(etcVal);
                
                const bizTotal = tempBusinessDeposit + tempBusinessPremium + tempBusinessMachinery + etcVal;
                
                setAssetValues(prev => ({ ...prev, businessAssets: bizTotal }));
                const updatedAssetValues = { ...assetValues, businessAssets: bizTotal };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    const totalAssets = Object.entries(updatedAssetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0);
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

            case 'asset_savings_loan_check': {
                const checkVal = value as 'yes' | 'no';
                setSavingsLoanCheck(checkVal);

                if (checkVal === 'yes') {
                    goToStep('asset_savings_loan_amount');
                    addBotMessage(
                        '해당 예금/적금의 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    const updatedAssetValues = { ...assetValues };
                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(updatedAssetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                }
                break;
            }

            case 'asset_savings_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const savingsPrice = assetValues.savings || 0;
                const savingsNetValue = Math.max(0, savingsPrice - loanAmount);

                setAssetValues(prev => ({ ...prev, savings: savingsNetValue }));
                const updatedAssetValues = { ...assetValues, savings: savingsNetValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    const totalAssets = Object.entries(updatedAssetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0);
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

            case 'asset_insurance_loan_check': {
                const checkVal = value as 'yes' | 'no';
                setInsuranceLoanCheck(checkVal);

                if (checkVal === 'yes') {
                    goToStep('asset_insurance_loan_amount');
                    addBotMessage(
                        '해당 보험의 담보대출 금액은 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                } else {
                    const updatedAssetValues = { ...assetValues };
                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(updatedAssetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                }
                break;
            }

            case 'asset_insurance_loan_amount': {
                const loanAmount = (value as number) * 10000;
                const insurancePrice = assetValues.insurance || 0;
                const insuranceNetValue = Math.max(0, insurancePrice - loanAmount);

                setAssetValues(prev => ({ ...prev, insurance: insuranceNetValue }));
                const updatedAssetValues = { ...assetValues, insurance: insuranceNetValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
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

            case 'asset_retirement_type': {
                const typeVal = value as 'pension' | 'none' | 'unknown';
                setUserInput(prev => ({ ...prev, retirementPensionType: typeVal }));

                if (typeVal === 'pension') {
                    // 퇴직연금 가입 시 압류금지 재산 -> 예상퇴직금 0원 처리 후 바로 다음 자산으로
                    setUserInput(prev => ({ ...prev, retirementPay: 0 }));
                    setAssetValues(prev => ({ ...prev, retirementPay: 0 }));
                    const updatedAssetValues = { ...assetValues, retirementPay: 0 };

                    if (currentAssetIndex < selectedAssets.length - 1) {
                        moveToAsset(currentAssetIndex + 1);
                    } else {
                        const totalAssets = Object.entries(updatedAssetValues)
                            .filter(([k]) => k !== 'retirementPay')
                            .reduce((a, [_, b]) => a + (b as number), 0);
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
                } else {
                    // 미가입 또는 모름일 때 예상 퇴직금 금액 확인 질문
                    goToStep('asset_retirement_value');
                    addBotMessage(
                        '예상 퇴직금(현재 퇴직 시 받을 수 있는 총액)은 대략 얼마인가요?\n\n(만원 단위)',
                        undefined,
                        'money'
                    );
                }
                break;
            }

            case 'asset_retirement_value': {
                const retirementPayValue = (value as number) * 10000;
                setUserInput(prev => ({ ...prev, retirementPay: retirementPayValue }));
                setAssetValues(prev => ({ ...prev, retirementPay: retirementPayValue }));
                const updatedAssetValues = { ...assetValues, retirementPay: retirementPayValue };

                if (currentAssetIndex < selectedAssets.length - 1) {
                    moveToAsset(currentAssetIndex + 1);
                } else {
                    const totalAssets = Object.entries(updatedAssetValues)
                        .filter(([k]) => k !== 'retirementPay')
                        .reduce((a, [_, b]) => a + (b as number), 0);
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
                    goToStep('debt_types');
                    addBotMessage(
                        '많이 힘드셨을 거예요. 걱정 마세요, 대부분의 분들이 비슷한 상황에서 해결책을 찾으셨어요 🤝\n\n현재 **빚의 종류를 모두 선택**해주세요. (복수 선택 가능)',
                        [
                            { label: '🏦 은행 대출', value: 'bank' },
                            { label: '💳 카드사/캐피탈', value: 'capital' },
                            { label: '🏪 저축은행/대부업', value: 'savings_bank' },
                            { label: '🏛️ 국세/세금 체납', value: 'tax' },
                            { label: '👤 가족/지인', value: 'private' },
                            { label: '📱 기타', value: 'app_loan' },
                            { label: '🏢 보증채무', value: 'guarantee' },
                            { label: '✅ 선택완료', value: 'done' }
                        ],
                        'buttons',
                        true
                    );
                }
                break;

            case 'credit_card_amount':
                setUserInput(prev => ({ ...prev, creditCardDebt: (value as number) * 10000 }));
                // V2.1: 채무 유형 분류로 이동
                goToStep('debt_types');
                addBotMessage(
                    '많이 힘드셨을 거예요. 걱정 마세요, 대부분의 분들이 비슷한 상황에서 해결책을 찾으셨어요 🤝\n\n현재 **빚의 종류를 모두 선택**해주세요. (복수 선택 가능)',
                    [
                        { label: '🏦 은행 대출', value: 'bank' },
                        { label: '💳 카드사/캐피탈', value: 'capital' },
                        { label: '🏪 저축은행/대부업', value: 'savings_bank' },
                        { label: '🏛️ 국세/세금 체납', value: 'tax' },
                        { label: '👤 가족/지인', value: 'private' },
                        { label: '📱 기타', value: 'app_loan' },
                        { label: '🏢 보증채무', value: 'guarantee' },
                        { label: '✅ 선택완료', value: 'done' }
                    ],
                    'buttons',
                    true
                );
                break;

            case 'other_debt' as any:
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
                            '아래 조건에 **모두 해당하는** 부모님이 계신가요?\n\n• 친부모\n• 만 65세 이상\n• 소득이 없거나 기초수급 혹은 장애\n• 매달 20만원 이상 생활비를 드리는 중',
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

                const config = policyConfig || DEFAULT_POLICY_CONFIG_2026;
                const underLimit = config.spouseIncomeRatioUnder ?? 0.7;
                const underRate = config.spouseIncomeRatioUnderRate ?? 1.0;
                const betweenLimit = config.spouseIncomeRatioBetween ?? 1.3;
                const betweenRate = config.spouseIncomeRatioBetweenRate ?? 0.5;
                const overRate = config.spouseIncomeRatioOverRate ?? 0.0;

                if (spouseIncomeRatio < underLimit) {
                    recognizedDependents = children * underRate;
                    dependentReason = `배우자 소득이 본인의 ${Math.round(underLimit * 100)}% 미만으로, 미성년 자녀가 ${Math.round(underRate * 100)}% 부양가족으로 인정됩니다.`;
                } else if (spouseIncomeRatio <= betweenLimit) {
                    recognizedDependents = children * betweenRate;
                    dependentReason = `부부 소득이 비슷하여(${Math.round(underLimit * 100)}~${Math.round(betweenLimit * 100)}%), 미성년 자녀는 공동 부양으로 ${Math.round(betweenRate * 100)}% 인정됩니다.`;
                } else {
                    recognizedDependents = children * overRate;
                    dependentReason = `배우자 소득이 본인의 ${Math.round(betweenLimit * 100)}% 초과로, 미성년 자녀는 ${Math.round(overRate * 100)}% 부양가족으로 인정됩니다.`;
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
                    '아래 조건에 **모두 해당하는** 부모님이 계신가요?\n\n• 친부모\n• 만 65세 이상\n• 소득이 없거나 기초수급 혹은 장애\n• 매달 20만원 이상 생활비를 드리는 중',
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
                    goToStep('risk');
                    addBotMessage(
                        '혹시 다음 중 해당하는 항목이 있나요?',
                        [
                            { label: '아니요, 일반 채무예요', value: 'none' },
                            { label: '최근 1년 내 대출이 많아요', value: 'recent_loan' },
                            { label: '채무중에 1년 이내에 주식/코인 투자 손실이 있어요.', value: 'investment' },
                            { label: '채무중에 1년 이내에 도박으로 인한 채무가 있어요', value: 'gambling' }
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

                goToStep('risk');
                addBotMessage(
                    '혹시 다음 중 해당하는 항목이 있나요?',
                    [
                        { label: '아니요, 일반 채무예요', value: 'none' },
                        { label: '최근 1년 내 대출이 많아요', value: 'recent_loan' },
                        { label: '채무중에 1년 이내에 주식/코인 투자 손실이 있어요.', value: 'investment' },
                        { label: '채무중에 1년 이내에 도박으로 인한 채무가 있어요', value: 'gambling' }
                    ],
                    'buttons'
                );
                break;

            case 'risk': {
                const riskVal = value as RehabUserInput['riskFactor'];
                setUserInput(prev => ({ ...prev, riskFactor: riskVal }));
                
                if (riskVal === 'investment' || riskVal === 'gambling') {
                    // 투자/도박인 경우, 공감 멘트 없이 바로 금액 질문으로 이동
                    goToStep('speculative_loss_amount');
                    const promptMsg = riskVal === 'investment'
                        ? '1년 이내의 주식/코인 투자 손실액은 대략 얼마인가요?\n\n(만원 단위)'
                        : '1년 이내의 도박으로 인한 채무액은 대략 얼마인가요?\n\n(만원 단위)';
                    addBotMessage(promptMsg, undefined, 'money');
                } else {
                    // 일반 채무 또는 최근 대출의 경우, 기존처럼 공감 멘트 후 법적 조치로 이동
                    addBotMessage(
                        '솔직하게 말씀해주셔서 감사해요. 정확한 상황 파악이 좋은 결과의 첫걸음이에요 ✨',
                        undefined,
                        undefined
                    );
                    setTimeout(() => {
                        goToStep('legal_actions');
                        addBotMessage(
                            '혹시 현재 아래와 같은 법적 조치를 받고 계신 게 있나요?\n해당하는 것을 모두 선택해주세요.',
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
                    }, 1000);
                }
                break;
            }

            case 'speculative_loss_amount': {
                const amount = (typeof value === 'number' ? value : parseInt(String(value), 10)) * 10000;
                setUserInput(prev => {
                    if (prev.riskFactor === 'investment') {
                        return { ...prev, speculativeLoss: amount };
                    } else if (prev.riskFactor === 'gambling') {
                        return { ...prev, gamblingLoss: amount };
                    }
                    return prev;
                });

                // 금액 입력이 끝났을 때 공감 멘트 노출
                addBotMessage(
                    '솔직하게 말씀해주셔서 감사해요. 정확한 상황 파악이 좋은 결과의 첫걸음이에요 ✨',
                    undefined,
                    undefined
                );

                setTimeout(() => {
                    goToStep('legal_actions');
                    addBotMessage(
                        '혹시 현재 아래와 같은 법적 조치를 받고 계신 게 있나요?\n해당하는 것을 모두 선택해주세요.',
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
                }, 1000);
                break;
            }

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
                const rawDebtTypes = Array.isArray(value) ? value : [value];
                const debtTypes = rawDebtTypes.filter(v => v !== 'done' && v !== 'none') as string[];
                setUserInput(prev => ({ ...prev, debtTypes }));

                if (debtTypes.length > 0) {
                    setCurrentDebtTypeIndex(0);
                    setDebtTypeValues({
                        bank: 0, capital: 0, savings_bank: 0, tax: 0, private: 0, app_loan: 0, guarantee: 0
                    });
                    goToStep('debt_amount_detail');
                    
                    const firstType = debtTypes[0];
                    const question = getDebtTypeQuestion(firstType);
                    addBotMessage(firstType === 'tax' ? '💡 국세(세금)는 개인회생 시 일반 채무보다 먼저 갚아야 하는 우선 채권에 해당해요.\n\n' + question : question, undefined, 'money');
                } else {
                    setUserInput(prev => ({ ...prev, priorityDebt: 0, totalDebt: prev.creditCardDebt || 0 }));
                    goToStep('debt_confirm');
                    addBotMessage(
                        `총 채무가 ${formatCurrency(userInput.creditCardDebt || 0)}이 맞으신가요?`,
                        [
                            { label: '네, 맞아요', value: 'yes' },
                            { label: '아니오, 다시 입력', value: 'no' }
                        ],
                        'buttons'
                    );
                }
                break;
            }

            case 'debt_amount_detail': {
                const debtTypes = userInput.debtTypes || [];
                const currentType = debtTypes[currentDebtTypeIndex];
                const amount = (value as number) * 10000;

                const updatedValues = { ...debtTypeValues, [currentType]: amount };
                setDebtTypeValues(updatedValues);

                if (currentDebtTypeIndex < debtTypes.length - 1) {
                    const nextIndex = currentDebtTypeIndex + 1;
                    setCurrentDebtTypeIndex(nextIndex);
                    goToStep('debt_amount_detail');
                    
                    const nextType = debtTypes[nextIndex];
                    const question = getDebtTypeQuestion(nextType);
                    addBotMessage(nextType === 'tax' ? '💡 국세(세금)는 개인회생 시 일반 채무보다 먼저 갚아야 하는 우선 채권에 해당해요.\n\n' + question : question, undefined, 'money');
                } else {
                    const taxAmount = updatedValues.tax || 0;
                    const otherDebtSum = 
                        (updatedValues.bank || 0) +
                        (updatedValues.capital || 0) +
                        (updatedValues.savings_bank || 0) +
                        (updatedValues.private || 0) +
                        (updatedValues.app_loan || 0) +
                        (updatedValues.guarantee || 0);

                    const totalDebt = (userInput.creditCardDebt || 0) + otherDebtSum;

                    setUserInput(prev => ({
                        ...prev,
                        priorityDebt: taxAmount,
                        totalDebt: totalDebt
                    }));

                    goToStep('debt_confirm');
                    addBotMessage(
                        `총 채무가 ${formatCurrency(totalDebt)}이 맞으신가요?\n\n(신용카드 채무 및 입력하신 종류별 채무가 모두 포함된 금액입니다.)`,
                        [
                            { label: '네, 맞아요', value: 'yes' },
                            { label: '아니오, 다시 입력', value: 'no' }
                        ],
                        'buttons'
                    );
                }
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
                            '⚡ 압류를 받고 계시군요. 회생 신청하면 바로 멈출 수 있어요!',
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
                        { label: '🏢 사업재산', value: 'businessAssets' },
                        { label: '💼 퇴직금', value: 'retirementPay' },
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
            let resultMessage = `${statusEmoji} 분석이 완료되었습니다!\n\n${input.name || '의뢰인'}님은 빚을 최대 **${calculationResult.debtReductionRate}%**까지 탕감받을 수 있어요.`;

            if (input.employmentType === 'none') {
                resultMessage += '\n\n💡 현재 무직이시지만 월 200만원 수입 기준으로 계산한 결과입니다.\n\n어렵게 생각하지 마세요! 아르바이트 하루만 나가시거나 일용직 하루만 출근하셔도 수입이 인정되어 개인회생 진행이 가능합니다.';
            }

            // V2.1: 압류 경험자 특별 메시지
            if (input.legalActions?.includes('seizure')) {
                resultMessage += '\n\n⚡ 압류를 받고 계시군요. 회생 신청하면 바로 멈출 수 있어요!';
            }

            addBotMessage(
                resultMessage,
                [{ label: '📊 진단 결과 보기', value: 'show_result' }],
                'buttons'
            );

            setCurrentStep('result');
            setShowResult(true);
            localStorage.removeItem('roi_rehab_chatbot_session');

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
        if (snapshot.carLoanType !== undefined) {
            setCarLoanType(snapshot.carLoanType);
        }
        if (snapshot.spouseCarLoanType !== undefined) {
            setSpouseCarLoanType(snapshot.spouseCarLoanType);
        }
        if (snapshot.realEstateLoanType !== undefined) {
            setRealEstateLoanType(snapshot.realEstateLoanType);
        }
        if (snapshot.tempRealEstateMortgage !== undefined) {
            setTempRealEstateMortgage(snapshot.tempRealEstateMortgage);
        }
        if (snapshot.spouseRealEstateLoanType !== undefined) {
            setSpouseRealEstateLoanType(snapshot.spouseRealEstateLoanType);
        }
        if (snapshot.tempSpouseRealEstateMortgage !== undefined) {
            setTempSpouseRealEstateMortgage(snapshot.tempSpouseRealEstateMortgage);
        }
        if (snapshot.landLoanCheck !== undefined) {
            setLandLoanCheck(snapshot.landLoanCheck);
        }
        if (snapshot.spouseLandLoanCheck !== undefined) {
            setSpouseLandLoanCheck(snapshot.spouseLandLoanCheck);
        }
        if (snapshot.tempBusinessDeposit !== undefined) {
            setTempBusinessDeposit(snapshot.tempBusinessDeposit);
        }
        if (snapshot.tempBusinessPremium !== undefined) {
            setTempBusinessPremium(snapshot.tempBusinessPremium);
        }
        if (snapshot.tempBusinessMachinery !== undefined) {
            setTempBusinessMachinery(snapshot.tempBusinessMachinery);
        }
        if (snapshot.tempBusinessEtc !== undefined) {
            setTempBusinessEtc(snapshot.tempBusinessEtc);
        }
        if (snapshot.tempSpouseBusinessDeposit !== undefined) {
            setTempSpouseBusinessDeposit(snapshot.tempSpouseBusinessDeposit);
        }
        if (snapshot.tempSpouseBusinessPremium !== undefined) {
            setTempSpouseBusinessPremium(snapshot.tempSpouseBusinessPremium);
        }
        if (snapshot.tempSpouseBusinessMachinery !== undefined) {
            setTempSpouseBusinessMachinery(snapshot.tempSpouseBusinessMachinery);
        }
        if (snapshot.tempSpouseBusinessEtc !== undefined) {
            setTempSpouseBusinessEtc(snapshot.tempSpouseBusinessEtc);
        }
        if (snapshot.savingsLoanCheck !== undefined) {
            setSavingsLoanCheck(snapshot.savingsLoanCheck);
        }
        if (snapshot.spouseSavingsLoanCheck !== undefined) {
            setSpouseSavingsLoanCheck(snapshot.spouseSavingsLoanCheck);
        }
        if (snapshot.insuranceLoanCheck !== undefined) {
            setInsuranceLoanCheck(snapshot.insuranceLoanCheck);
        }
        if (snapshot.spouseInsuranceLoanCheck !== undefined) {
            setSpouseInsuranceLoanCheck(snapshot.spouseInsuranceLoanCheck);
        }
        if (snapshot.tempOwnedValue !== undefined) {
            setTempOwnedValue(snapshot.tempOwnedValue);
        }
        if (snapshot.tempOwnedMortgage !== undefined) {
            setTempOwnedMortgage(snapshot.tempOwnedMortgage);
        }
        if (snapshot.ownedOwnerType !== undefined) {
            setOwnedOwnerType(snapshot.ownedOwnerType);
        }
        if (snapshot.currentDebtTypeIndex !== undefined) {
            setCurrentDebtTypeIndex(snapshot.currentDebtTypeIndex);
        }
        if (snapshot.debtTypeValues !== undefined) {
            setDebtTypeValues(snapshot.debtTypeValues);
        }

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
        if (lastSnapshot.carLoanType !== undefined) {
            setCarLoanType(lastSnapshot.carLoanType);
        }
        if (lastSnapshot.spouseCarLoanType !== undefined) {
            setSpouseCarLoanType(lastSnapshot.spouseCarLoanType);
        }
        if (lastSnapshot.realEstateLoanType !== undefined) {
            setRealEstateLoanType(lastSnapshot.realEstateLoanType);
        }
        if (lastSnapshot.tempRealEstateMortgage !== undefined) {
            setTempRealEstateMortgage(lastSnapshot.tempRealEstateMortgage);
        }
        if (lastSnapshot.spouseRealEstateLoanType !== undefined) {
            setSpouseRealEstateLoanType(lastSnapshot.spouseRealEstateLoanType);
        }
        if (lastSnapshot.tempSpouseRealEstateMortgage !== undefined) {
            setTempSpouseRealEstateMortgage(lastSnapshot.tempSpouseRealEstateMortgage);
        }
        if (lastSnapshot.landLoanCheck !== undefined) {
            setLandLoanCheck(lastSnapshot.landLoanCheck);
        }
        if (lastSnapshot.spouseLandLoanCheck !== undefined) {
            setSpouseLandLoanCheck(lastSnapshot.spouseLandLoanCheck);
        }
        if (lastSnapshot.tempBusinessDeposit !== undefined) {
            setTempBusinessDeposit(lastSnapshot.tempBusinessDeposit);
        }
        if (lastSnapshot.tempBusinessPremium !== undefined) {
            setTempBusinessPremium(lastSnapshot.tempBusinessPremium);
        }
        if (lastSnapshot.tempBusinessMachinery !== undefined) {
            setTempBusinessMachinery(lastSnapshot.tempBusinessMachinery);
        }
        if (lastSnapshot.tempBusinessEtc !== undefined) {
            setTempBusinessEtc(lastSnapshot.tempBusinessEtc);
        }
        if (lastSnapshot.tempSpouseBusinessDeposit !== undefined) {
            setTempSpouseBusinessDeposit(lastSnapshot.tempSpouseBusinessDeposit);
        }
        if (lastSnapshot.tempSpouseBusinessPremium !== undefined) {
            setTempSpouseBusinessPremium(lastSnapshot.tempSpouseBusinessPremium);
        }
        if (lastSnapshot.tempSpouseBusinessMachinery !== undefined) {
            setTempSpouseBusinessMachinery(lastSnapshot.tempSpouseBusinessMachinery);
        }
        if (lastSnapshot.tempSpouseBusinessEtc !== undefined) {
            setTempSpouseBusinessEtc(lastSnapshot.tempSpouseBusinessEtc);
        }
        if (lastSnapshot.savingsLoanCheck !== undefined) {
            setSavingsLoanCheck(lastSnapshot.savingsLoanCheck);
        }
        if (lastSnapshot.spouseSavingsLoanCheck !== undefined) {
            setSpouseSavingsLoanCheck(lastSnapshot.spouseSavingsLoanCheck);
        }
        if (lastSnapshot.insuranceLoanCheck !== undefined) {
            setInsuranceLoanCheck(lastSnapshot.insuranceLoanCheck);
        }
        if (lastSnapshot.spouseInsuranceLoanCheck !== undefined) {
            setSpouseInsuranceLoanCheck(lastSnapshot.spouseInsuranceLoanCheck);
        }

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
            } else if (clickedMessage?.multiSelect) {
                // 다중 선택 모드인 경우
                if (option.value === 'none') {
                    // 없어요 선택 시 기존 선택 모두 무시하고 즉시 다음으로
                    addUserMessage(option.label);
                    setTimeout(() => processStep(currentStep, 'none'), 300);
                } else if (option.value === 'done') {
                    // 선택완료 클릭 시 현재까지 선택된 항목들을 수집하여 제출
                    const selectedOptions = clickedMessage.options?.filter(opt => opt.selected && opt.value !== 'done' && opt.value !== 'none') || [];
                    const selectedLabels = selectedOptions.map(opt => opt.label);
                    const selectedValues = selectedOptions.map(opt => String(opt.value));
                    
                    const displayLabel = selectedLabels.length > 0 ? `${selectedLabels.join(', ')} 선택완료` : '선택완료';
                    addUserMessage(displayLabel);
                    
                    setTimeout(() => {
                        processStep(currentStep, selectedValues.length > 0 ? selectedValues : 'none');
                    }, 300);
                } else {
                    // 일반 옵션 클릭 시 selected 상태 토글
                    setMessages(prev => prev.map(msg => {
                        if (msg.id === messageId && msg.options) {
                            return {
                                ...msg,
                                options: msg.options.map(opt => 
                                    opt.value === option.value 
                                        ? { ...opt, selected: !opt.selected } 
                                        : opt
                                )
                            };
                        }
                        return msg;
                    }));
                }
            } else {
                // 일반 진행 (단일 선택)
                addUserMessage(option.label);
                setTimeout(() => processStep(currentStep, option.value), 300);
            }
        }
    }, [addUserMessage, processStep, currentStep, messages]);

    // 진행률 계산
    const getProgress = useCallback(() => {
        const stepOrder: Record<ChatStep, number> = {
            'intro': 0, 'address': 5, 'age': 10, 'employment': 15,
            'unemployed_reason': 16, 'work_location': 17,
            'income_salary': 20, 'income_business': 22, 'income_confirm': 25,
            'marital_status': 30, 'spouse_income': 35, 'spouse_assets_select': 38,
            'spouse_asset_detail': 40, 'spouse_asset_car_loan_check': 40.5, 'spouse_asset_car_loan_amount': 41, 'spouse_asset_real_estate_loan_check': 41.2, 'spouse_asset_real_estate_mortgage_amount': 41.5, 'spouse_asset_real_estate_deposit_amount': 41.8, 'spouse_asset_land_loan_check': 41.9, 'spouse_asset_land_loan_amount': 42,
            'spouse_asset_business_deposit': 42.1, 'spouse_asset_business_premium': 42.2, 'spouse_asset_business_machinery': 42.3, 'spouse_asset_business_etc': 42.4,
            'spouse_asset_savings_loan_check': 42.5, 'spouse_asset_savings_loan_amount': 42.6, 'spouse_asset_insurance_loan_check': 42.7, 'spouse_asset_insurance_loan_amount': 42.8,
            'custody': 35, 'child_support_receive': 38,
            'child_support_pay': 38, 'minor_children': 42, 'housing_type': 48,
            'rent_cost': 50, 'deposit_amount': 52, 'deposit_loan': 54,
            'deposit_loan_amount': 54.5, 'deposit_contract_holder': 55.5,
            'owned_value': 53, 'owned_mortgage': 55, 'owned_owner_type': 56,
            'medical_check': 57, 'medical_amount': 59,
            'education_check': 61, 'education_amount': 63, 'special_education': 64, 'special_education_amount': 64.5,
            'assets_select': 65,
            'asset_detail': 70, 'asset_car_loan_check': 71, 'asset_car_loan_amount': 72, 'asset_real_estate_loan_check': 70.2, 'asset_real_estate_mortgage_amount': 70.5, 'asset_real_estate_deposit_amount': 70.8, 'asset_land_loan_check': 72.2, 'asset_land_loan_amount': 72.5,
            'asset_business_deposit': 73, 'asset_business_premium': 73.2, 'asset_business_machinery': 73.5, 'asset_business_etc': 73.8,
            'asset_savings_loan_check': 74, 'asset_savings_loan_amount': 74.2, 'asset_insurance_loan_check': 74.5, 'asset_insurance_loan_amount': 74.8,
            'asset_retirement_type': 74.9, 'asset_retirement_value': 75.0,
            'credit_card': 75, 'credit_card_amount': 78,
            'debt_types': 79,
            'debt_amount_detail': 82, 'debt_confirm': 85, 
            'prior_rehab': 91, 'prior_rehab_detail': 92,
            'prior_credit_recovery': 93, 'prior_credit_recovery_amount': 94, 'risk': 95, 'speculative_loss_amount': 95.1,
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
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        triggerShake();
                    }
                }}
            >
                <motion.div
                    animate={isShaking ? { x: [-6, 6, -6, 6, -3, 3, 0] } : { x: 0 }}
                    transition={{ duration: 0.5 }}
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
                            options: msg.options?.map(opt => ({ label: opt.label, value: String(opt.value), selected: opt.selected })),
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
                        onClose={handleCloseRequest}
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

            {/* Exit Confirmation Modal */}
            {showExitConfirm && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={() => setShowExitConfirm(false)}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border"
                        style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                                진단을 중단하시겠습니까?
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                지금 종료하면 입력된 진단 데이터가 모두 사라집니다.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowExitConfirm(false)}
                                    className="flex-1 py-3 px-4 rounded-xl text-white font-medium transition-colors hover:opacity-90 cursor-pointer"
                                    style={{ backgroundColor: colors.primary }}
                                >
                                    계속 진행하기
                                </button>
                                <button
                                    onClick={() => {
                                        setShowExitConfirm(false);
                                        localStorage.removeItem('roi_rehab_chatbot_session');
                                        onClose();
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    진단 종료하기
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

function getDebtTypeQuestion(type: string): string {
    switch (type) {
        case 'bank':
            return '🏦 은행 대출금액은 총 얼마인가요?\n\n(만원 단위)';
        case 'capital':
            return '💳 카드사 및 캐피탈 대출금액은 총 얼마인가요?\n\n(만원 단위)';
        case 'savings_bank':
            return '🏪 저축은행 및 대부업 대출금액은 총 얼마인가요?\n\n(만원 단위)';
        case 'tax':
            return '🏛️ 국세(세금 체납액)는 총 얼마인가요?\n\n(만원 단위)';
        case 'private':
            return '👤 사금융 및 지인 대출금액은 총 얼마인가요?\n\n(만원 단위)';
        case 'app_loan':
            return '📱 앱 및 온라인 대출금액은 총 얼마인가요?\n\n(만원 단위)';
        case 'guarantee':
            return '🏢 보증채무 금액은 총 얼마인가요?\n\n(만원 단위)';
        default:
            return '갚아야 할 채무 금액은 총 얼마인가요?\n\n(만원 단위)';
    }
}
