/**
 * Interactive Block 컴포넌트
 * 
 * 폼-혼합형(gradient) 템플릿에서 대화 중간에 삽입되는 UI 블록
 * - 단일 선택 (라디오)
 * - 다중 선택 (체크박스)
 * - 날짜 선택
 * - 연락처 입력
 * - CTA 버튼
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check,
    X,
    Calendar,
    Phone,
    Mail,
    ChevronRight,
    AlertCircle,
    CheckCircle2,
    User
} from 'lucide-react';
import {
    InteractiveBlockConfig,
    InteractiveBlockState,
    InteractiveBlockOption,
    ChatbotColorPalette
} from './ChatbotTemplateConfig';

interface InteractiveBlockProps {
    config: InteractiveBlockConfig;
    state: InteractiveBlockState;
    colors: ChatbotColorPalette;
    isDark: boolean;
    onSubmit: (value: string | string[] | Date) => void;
    onCancel?: () => void;
}

const InteractiveBlock: React.FC<InteractiveBlockProps> = ({
    config,
    state,
    colors,
    isDark,
    onSubmit,
    onCancel
}) => {
    const [selectedValue, setSelectedValue] = useState<string | string[] | Date | null>(
        state.value || null
    );
    const [inputValue, setInputValue] = useState<string>('');
    const [nameValue, setNameValue] = useState<string>('');
    const [phoneValue, setPhoneValue] = useState<string>('');
    const [emailValue, setEmailValue] = useState<string>('');
    const [error, setError] = useState<string | null>(state.error || null);

    // 초기 010 설정
    React.useEffect(() => {
        if ((config.contactType === 'phone' || config.contactType === 'both') && !phoneValue && !state.value) {
            setPhoneValue('010-');
        }
    }, []);

    // 카드 스타일
    const cardStyle = {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderRadius: '16px',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        boxShadow: isDark
            ? '0 4px 20px rgba(0,0,0,0.3)'
            : '0 4px 20px rgba(0,0,0,0.1)',
        overflow: 'hidden' as const
    };

    // 헤더 스타일
    const headerStyle = {
        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        padding: '16px',
    };

    // 검증 함수
    const validate = useCallback((): boolean => {
        if (config.required) {
            if (config.type === 'single_select' && !selectedValue) {
                setError('항목을 선택해주세요.');
                return false;
            }
            if (config.type === 'multi_select' && (!selectedValue || (Array.isArray(selectedValue) && selectedValue.length === 0))) {
                setError('최소 하나 이상 선택해주세요.');
                return false;
            }
            if (config.type === 'contact_input') {
                if (config.includeName && !nameValue) {
                    setError('이름을 입력해주세요.');
                    return false;
                }
                if (config.contactType === 'phone' && !phoneValue) {
                    setError('전화번호를 입력해주세요.');
                    return false;
                }
                if (config.contactType === 'email' && !emailValue) {
                    setError('이메일을 입력해주세요.');
                    return false;
                }
                if (config.contactType === 'both' && (!phoneValue || !emailValue)) {
                    setError('전화번호와 이메일을 모두 입력해주세요.');
                    return false;
                }
            }
            if (config.type === 'date_picker' && !selectedValue) {
                setError('날짜를 선택해주세요.');
                return false;
            }
        }

        // 패턴 검증
        if (config.validationPattern) {
            const pattern = new RegExp(config.validationPattern);
            if (config.type === 'contact_input') {
                if (config.contactType === 'phone' && !pattern.test(phoneValue)) {
                    setError(config.validationMessage || '올바른 형식이 아닙니다.');
                    return false;
                }
                if (config.contactType === 'email' && !pattern.test(emailValue)) {
                    setError(config.validationMessage || '올바른 형식이 아닙니다.');
                    return false;
                }
            }
        }

        setError(null);
        return true;
    }, [config, selectedValue, phoneValue, emailValue]);

    // 제출 핸들러
    const handleSubmit = useCallback(() => {
        if (!validate()) return;

        let value: string | string[] | Date;

        switch (config.type) {
            case 'single_select':
            case 'multi_select':
            case 'date_picker':
                value = selectedValue!;
                break;
            case 'contact_input':
                const contactData: any = {};
                if (config.includeName) {
                    contactData.name = nameValue;
                }

                if (config.contactType === 'both') {
                    contactData.phone = phoneValue;
                    contactData.email = emailValue;
                    value = JSON.stringify(contactData);
                } else if (config.contactType === 'email') {
                    if (config.includeName) {
                        contactData.email = emailValue;
                        value = JSON.stringify(contactData);
                    } else {
                        value = emailValue;
                    }
                } else {
                    if (config.includeName) {
                        contactData.phone = phoneValue;
                        value = JSON.stringify(contactData);
                    } else {
                        value = phoneValue;
                    }
                }
                break;
            case 'cta_button':
                value = 'confirmed';
                break;
            default:
                value = inputValue;
        }

        onSubmit(value);
    }, [config, selectedValue, phoneValue, emailValue, inputValue, validate, onSubmit]);

    // 완료 상태 렌더링
    if (state.status === 'completed') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.2)'}`
                }}
            >
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div className="flex-1">
                    <p
                        className="text-sm font-medium"
                        style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                    >
                        {config.title}
                    </p>
                    <p
                        className="text-sm"
                        style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                    >
                        {state.summary || String(state.value)}
                    </p>
                </div>
            </motion.div>
        );
    }

    // 단일 선택 (라디오) 렌더링
    const renderSingleSelect = () => (
        <div className="space-y-2 p-4">
            {config.options?.map((option, idx) => (
                <motion.button
                    key={idx}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedValue(String(option.value))}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{
                        backgroundColor: selectedValue === String(option.value)
                            ? `${colors.primary}20`
                            : (isDark ? '#334155' : '#f1f5f9'),
                        border: selectedValue === String(option.value)
                            ? `2px solid ${colors.primary}`
                            : `2px solid transparent`
                    }}
                >
                    <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        style={{
                            borderColor: selectedValue === String(option.value)
                                ? colors.primary
                                : (isDark ? '#64748b' : '#94a3b8')
                        }}
                    >
                        {selectedValue === String(option.value) && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: colors.primary }}
                            />
                        )}
                    </div>
                    {option.icon && <span className="text-lg">{option.icon}</span>}
                    <span
                        className="font-medium"
                        style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                    >
                        {option.label}
                    </span>
                </motion.button>
            ))}
        </div>
    );

    // 다중 선택 (체크박스) 렌더링
    const renderMultiSelect = () => {
        const selectedValues = Array.isArray(selectedValue) ? selectedValue : [];

        const toggleOption = (value: string) => {
            if (selectedValues.includes(value)) {
                setSelectedValue(selectedValues.filter(v => v !== value));
            } else {
                setSelectedValue([...selectedValues, value]);
            }
        };

        return (
            <div className="space-y-2 p-4">
                {config.options?.map((option, idx) => {
                    const isSelected = selectedValues.includes(String(option.value));
                    return (
                        <motion.button
                            key={idx}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => toggleOption(String(option.value))}
                            className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                            style={{
                                backgroundColor: isSelected
                                    ? `${colors.primary}20`
                                    : (isDark ? '#334155' : '#f1f5f9'),
                                border: isSelected
                                    ? `2px solid ${colors.primary}`
                                    : `2px solid transparent`
                            }}
                        >
                            <div
                                className="w-5 h-5 rounded-md border-2 flex items-center justify-center"
                                style={{
                                    borderColor: isSelected
                                        ? colors.primary
                                        : (isDark ? '#64748b' : '#94a3b8'),
                                    backgroundColor: isSelected ? colors.primary : 'transparent'
                                }}
                            >
                                {isSelected && (
                                    <Check className="w-3 h-3" style={{ color: '#ffffff' }} />
                                )}
                            </div>
                            {option.icon && <span className="text-lg">{option.icon}</span>}
                            <span
                                className="font-medium"
                                style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                            >
                                {option.label}
                            </span>
                        </motion.button>
                    );
                })}
            </div>
        );
    };

    // 날짜 선택 렌더링
    const renderDatePicker = () => (
        <div className="p-4">
            <div className="relative">
                <Calendar
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                    style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                />
                <input
                    type="date"
                    value={selectedValue ? new Date(selectedValue as Date).toISOString().split('T')[0] : ''}
                    onChange={(e) => setSelectedValue(new Date(e.target.value))}
                    min={config.minDate ? config.minDate.toISOString().split('T')[0] : undefined}
                    max={config.maxDate ? config.maxDate.toISOString().split('T')[0] : undefined}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 transition-all"
                    style={{
                        backgroundColor: isDark ? '#334155' : '#f8fafc',
                        borderColor: isDark ? '#475569' : '#e2e8f0',
                        color: isDark ? '#e2e8f0' : '#1e293b'
                    }}
                />
            </div>
        </div>
    );

    // 전화번호 포맷팅
    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/[^0-9]/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    };

    // 초기 010 설정


    // 연락처 입력 렌더링
    const renderContactInput = () => (
        <div className="p-4 space-y-3">
            {config.includeName && (
                <div className="relative">
                    <User
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                    />
                    <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        placeholder="이름"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 transition-all"
                        style={{
                            backgroundColor: isDark ? '#334155' : '#f8fafc',
                            borderColor: isDark ? '#475569' : '#e2e8f0',
                            color: isDark ? '#e2e8f0' : '#1e293b'
                        }}
                    />
                </div>
            )}
            {(config.contactType === 'phone' || config.contactType === 'both') && (
                <div className="relative">
                    <Phone
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                    />
                    <input
                        type="tel"
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(formatPhoneNumber(e.target.value))}
                        placeholder={config.placeholder || '010-0000-0000'}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 transition-all"
                        style={{
                            backgroundColor: isDark ? '#334155' : '#f8fafc',
                            borderColor: isDark ? '#475569' : '#e2e8f0',
                            color: isDark ? '#e2e8f0' : '#1e293b'
                        }}
                    />
                </div>
            )}
            {(config.contactType === 'email' || config.contactType === 'both') && (
                <div className="relative">
                    <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                    />
                    <input
                        type="email"
                        value={emailValue}
                        onChange={(e) => setEmailValue(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 transition-all"
                        style={{
                            backgroundColor: isDark ? '#334155' : '#f8fafc',
                            borderColor: isDark ? '#475569' : '#e2e8f0',
                            color: isDark ? '#e2e8f0' : '#1e293b'
                        }}
                    />
                </div>
            )}
        </div>
    );

    // CTA 버튼 렌더링
    const renderCTAButton = () => (
        <div className="p-4">
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                className="w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2"
                style={{
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                    color: colors.headerText,
                    boxShadow: `0 4px 15px ${colors.primary}40`
                }}
            >
                {config.buttonLabel || '확인'}
                <ChevronRight className="w-5 h-5" />
            </motion.button>
        </div>
    );

    // 블록 내용 렌더링
    const renderBlockContent = () => {
        switch (config.type) {
            case 'single_select':
                return renderSingleSelect();
            case 'multi_select':
                return renderMultiSelect();
            case 'date_picker':
                return renderDatePicker();
            case 'contact_input':
                return renderContactInput();
            case 'cta_button':
                return renderCTAButton();
            default:
                return null;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={cardStyle}
            className="max-w-sm"
        >
            {/* 헤더 */}
            <div style={headerStyle}>
                <h4
                    className="font-bold text-base"
                    style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                >
                    {config.title}
                </h4>
                {config.description && (
                    <p
                        className="text-sm mt-1"
                        style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                    >
                        {config.description}
                    </p>
                )}
            </div>

            {/* 내용 */}
            {renderBlockContent()}

            {/* 에러 메시지 */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-2"
                    >
                        <div className="flex items-center gap-2 text-red-500 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 하단 버튼 (CTA 타입 제외) */}
            {config.type !== 'cta_button' && (
                <div
                    className="flex gap-2 p-4 border-t"
                    style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}
                >
                    {config.cancelLabel && onCancel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 py-2.5 rounded-xl font-medium transition-colors"
                            style={{
                                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                                color: isDark ? '#94a3b8' : '#64748b'
                            }}
                        >
                            {config.cancelLabel}
                        </button>
                    )}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSubmit}
                        className="flex-1 py-2.5 rounded-xl font-medium transition-all"
                        style={{
                            backgroundColor: colors.primary,
                            color: colors.headerText
                        }}
                    >
                        {config.buttonLabel || '확인'}
                    </motion.button>
                </div>
            )}
        </motion.div>
    );
};

export default InteractiveBlock;
