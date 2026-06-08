/**
 * AI 변제금 진단 챗봇 버튼
 * 
 * 랜딩페이지 어디에나 배치 가능한 플로팅/삽입 버튼
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Calculator, Sparkles } from 'lucide-react';
import AIRehabChatbotV2 from './AIRehabChatbotV2';
import { RehabChatConfig, GlobalSettings } from '../../types';
import { RehabCalculationResult, RehabUserInput } from '../../services/calculationService';

interface RehabChatButtonProps {
    config?: RehabChatConfig;
    globalSettings?: GlobalSettings;
    onComplete?: (result: RehabCalculationResult, input: RehabUserInput) => void;
    className?: string;
    // 팝업 모드인 경우 버튼 렌더링, embedded인 경우 직접 삽입
    forceMode?: 'popup' | 'embedded' | 'floating';

    // Controlled Mode (Optional)
    isOpen?: boolean;
    onClose?: () => void;
    onOpen?: () => void; // Parent trigger

    // NEW: Standalone Mode
    isStandalone?: boolean;

    // NEW: Disable Portal (For Admin Preview)
    disablePortal?: boolean;
}

const DEFAULT_CONFIG: RehabChatConfig = {
    isEnabled: true,
    displayMode: 'floating',
    buttonText: 'AI 변제금 확인',
    buttonPosition: 'bottom-right',
    buttonColor: '#3B82F6',
    characterName: '로이',
};

const RehabChatButton: React.FC<RehabChatButtonProps> = ({
    config = DEFAULT_CONFIG,
    globalSettings,
    onComplete,
    className,
    forceMode,
    isOpen: propIsOpen,
    onClose: propOnClose,
    onOpen: propOnOpen,
    isStandalone = false,
    disablePortal = false
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);

    // Determine state mode (Controlled vs Uncontrolled)
    const isControlled = propIsOpen !== undefined;
    const isOpen = isControlled ? propIsOpen : internalIsOpen;

    const handleOpen = () => {
        if (isControlled && propOnOpen) {
            propOnOpen();
        } else if (!isControlled) {
            setInternalIsOpen(true);
        }
    };

    const handleClose = () => {
        if (isControlled && propOnClose) {
            propOnClose();
        } else {
            setInternalIsOpen(false);
        }
    };

    const displayMode = forceMode || config.displayMode;
    const buttonPosition = config.buttonPosition || 'bottom-right';

    // 위치 스타일
    const positionStyles: Record<string, string> = {
        'bottom-right': 'bottom-6 right-6',
        'bottom-left': 'bottom-6 left-6',
        'top-right': 'top-24 right-6',
        'top-left': 'top-24 left-6',
    };

    // Size Logic
    const sizeMap: Record<string, { px: string; py: string; text: string; icon: string }> = {
        sm: { px: 'px-3', py: 'py-2', text: 'text-xs', icon: 'w-4 h-4' },
        md: { px: 'px-5', py: 'py-3', text: 'text-sm', icon: 'w-5 h-5' },
        lg: { px: 'px-6', py: 'py-4', text: 'text-base', icon: 'w-6 h-6' },
        xl: { px: 'px-8', py: 'py-5', text: 'text-lg', icon: 'w-7 h-7' }
    };

    const mobileSizeKey = config.buttonStyle?.mobileSize || config.buttonStyle?.buttonSize || 'md';
    const pcSizeKey = config.buttonStyle?.pcSize || config.buttonStyle?.buttonSize || 'md';

    const m = sizeMap[mobileSizeKey] || sizeMap['md'];
    const p = sizeMap[pcSizeKey] || sizeMap['md'];

    // Construct responsive classes
    // Base is Mobile, md: prefix is PC
    const sizeClasses = `${m.px} ${m.py} ${m.text} md:${p.px} md:${p.py} md:${p.text}`;
    const iconClasses = `${m.icon} md:${p.icon}`;


    // 플로팅 버튼 렌더링
    if (displayMode === 'floating') {
        return (
            <>
                {!config.hideFloatingButton && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleOpen} // Use handleOpen
                        className={`fixed ${positionStyles[buttonPosition]} z-50 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-bold text-white ${sizeClasses} ${className || ''}`}
                        style={{
                            ...(config.buttonBackgroundImage ? {
                                backgroundImage: `url(${config.buttonBackgroundImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                backgroundColor: 'transparent'
                            } : {
                                background: `linear-gradient(135deg, ${config.buttonColor || '#3B82F6'}, ${config.buttonColor || '#3B82F6'}dd)`
                            }),
                            boxShadow: `0 4px 20px ${config.buttonColor || '#3B82F6'}40`,
                            color: config.buttonStyle?.textColor || '#ffffff',
                            fontWeight: config.buttonStyle?.fontWeight || 'bold',
                            fontFamily: config.buttonStyle?.fontFamily || 'inherit',
                            // Allow manual override if strictly set, otherwise rely on class
                            fontSize: config.buttonStyle?.fontSize || undefined
                        }}
                    >
                        <Sparkles className={iconClasses} />
                        <span>{config.buttonText || 'AI 변제금 확인'}</span>
                    </motion.button>
                )}

                <AnimatePresence>
                    {isOpen && (
                        <AIRehabChatbotV2
                            isOpen={isOpen}
                            onClose={handleClose}
                            onComplete={onComplete}
                            characterName={config.characterName}
                            characterImage={config.characterImage}
                            templateId={config.templateId || 'classic'}
                            themeMode={config.themeMode || 'dark'}
                            customColors={config.customColors}
                            chatFontFamily={config.chatFontFamily}
                            enableFormBlocks={
                                (config.interactiveBlockPreset && config.interactiveBlockPreset !== 'none') ||
                                config.interactiveBlockConfig?.useContactForm ||
                                config.interactiveBlockConfig?.useMultiSelect
                            }
                            interactiveBlockPreset={config.interactiveBlockPreset}
                            interactiveBlockConfig={config.interactiveBlockConfig}
                            introConfig={config.introConfig} // Forward Intro Config
                            isStandalone={isStandalone} // Forward Standalone state
                            disablePortal={disablePortal} // Forward Disable Portal
                        />
                    )}
                </AnimatePresence>
            </>
        );
    }

    // 임베디드/팝업 버튼 렌더링
    return (
        <>
            {/* 임베디드 모드에서 버튼 클릭 시에도 팝업 열려야 함 (기존 로직 유지) */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleOpen} // Use handleOpen
                className={`inline-flex items-center gap-2 rounded-xl font-bold text-white transition-all ${sizeClasses} ${className || ''}`}
                style={{
                    ...(config.buttonBackgroundImage ? {
                        backgroundImage: `url(${config.buttonBackgroundImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: 'transparent'
                    } : {
                        background: `linear-gradient(135deg, ${config.buttonColor || '#3B82F6'}, ${config.buttonColor || '#3B82F6'}cc)`
                    }),
                    boxShadow: `0 4px 15px ${config.buttonColor || '#3B82F6'}30`,
                    color: config.buttonStyle?.textColor || '#ffffff',
                    fontWeight: config.buttonStyle?.fontWeight || 'bold',
                    fontFamily: config.buttonStyle?.fontFamily || 'inherit',
                    // Allow manual override if strictly set, otherwise rely on class
                    fontSize: config.buttonStyle?.fontSize || undefined
                }}
            >
                <Calculator className={iconClasses} />
                <span>{config.buttonText || 'AI 변제금 확인'}</span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <AIRehabChatbotV2
                        isOpen={isOpen}
                        onClose={handleClose}
                        onComplete={onComplete}
                        characterName={config.characterName}
                        characterImage={config.characterImage}
                        templateId={config.templateId || 'classic'}
                        themeMode={config.themeMode || 'dark'}
                        customColors={config.customColors}
                        chatFontFamily={config.chatFontFamily}
                        enableFormBlocks={config.interactiveBlockConfig?.useContactForm || config.interactiveBlockConfig?.useMultiSelect}
                        interactiveBlockPreset={config.interactiveBlockPreset}
                        interactiveBlockConfig={config.interactiveBlockConfig}
                        introConfig={config.introConfig} // Forward Intro Config
                        isStandalone={isStandalone} // Forward Standalone state
                        disablePortal={disablePortal} // Forward Disable Portal
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default RehabChatButton;
