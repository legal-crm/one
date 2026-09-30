/**
 * AI 챗봇 템플릿 렌더러 V2
 * 
 * 디자인 기획서 10가지 템플릿에 따라 다른 레이아웃/UI를 렌더링합니다.
 * - 01. 클래식 카드형
 * - 02. 미니멀 프리미엄 (상단 고정 정보바 + 큰 여백)
 * - 03. 타임레일 (좌측 타임레일)
 * - 04. 버블 꼬리형 (말풍선 꼬리 강조)
 * - 05. 컴팩트 메신저 (밀도 높은 리스트)
 * - 06. 하단 툴바형 (확장 패널)
 * - 07. 참여자 레일 (좌측 미니 프로필)
 * - 08. 헤더 탭형 (FAQ/Chat/History)
 * - 09. 플로팅 위젯 (Collapsed/Expanded)
 * - 10. 폼-혼합형 (Interactive Block)
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, MessageCircle, User, Sparkles, Zap, Building2, ChevronDown, ChevronLeft, Search, Paperclip, Smile, Image, Clock, Users } from 'lucide-react';
import { ChatbotTemplateId, ChatbotColorPalette, ThemeMode, getTemplateById, TemplateLayoutConfig, InteractiveBlockConfig, InteractiveBlockState } from './ChatbotTemplateConfig';
import InteractiveBlock from './InteractiveBlock';

// **text** 마크다운을 컬러 강조 <span>으로 변환하는 유틸리티
const parseHighlight = (text: string, accentColor: string = '#1E3A5F'): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*)/);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            return <span key={i} style={{ color: accentColor, fontWeight: 700 }}>{inner}</span>;
        }
        return <span key={i}>{part}</span>;
    });
};

// 메시지 타입
export interface ChatMessage {
    id: string;
    type: 'user' | 'bot';
    content: string;
    options?: { label: string; value: string; selected?: boolean }[];
    inputType?: string;
    multiSelect?: boolean;
    timestamp?: Date;
    // Interactive Block (폼-혼합형)
    interactiveBlock?: InteractiveBlockConfig;
    blockState?: InteractiveBlockState;
    // 롤백을 위한 단계 추적
    stepId?: string;
    isAnswered?: boolean;
}

// 렌더러 Props
interface ChatbotRendererProps {
    templateId: ChatbotTemplateId;
    mode: ThemeMode;
    colors: ChatbotColorPalette;
    messages: ChatMessage[];
    inputValue: string;
    isTyping: boolean;
    characterName: string;
    characterImage?: string; // NEW: Custom Character Image
    progress: number;
    onInputChange: (value: string) => void;
    onSubmit: () => void;
    onOptionSelect: (option: { label: string; value: string }, messageId?: string) => void;
    onClose: () => void;
    messagesEndRef: React.RefObject<HTMLDivElement>;
    inputRef: React.RefObject<HTMLInputElement>;
    // Interactive Block (폼-혼합형)
    isComposerLocked?: boolean;
    onBlockSubmit?: (messageId: string, value: string | string[] | Date) => void;
    onBlockCancel?: (messageId: string) => void;
    enableFormBlocks?: boolean; // NEW: 모든 템플릿에서 Interactive Block 활성화
    // 뒤로 가기 기능
    onGoBack?: () => void;
    canGoBack?: boolean;
    /** 헤더 이름 아래 보조 문구(기본 헤더) */
    headerSubtitle?: string;
    /** 진행 막대 옆 문구(예: '40% · 약 2분 남음') */
    progressLabel?: string;
    /** 닫기 버튼의 접근성 이름 */
    closeLabel?: string;
    /** 바깥 컨테이너가 모서리·테두리를 담당할 때(페이지 임베드·모바일 전체 화면) 둥근 모서리 제거 */
    flush?: boolean;
}

const ChatbotRenderer: React.FC<ChatbotRendererProps> = ({
    templateId,
    mode,
    colors,
    messages,
    inputValue,
    isTyping,
    characterName,
    characterImage,
    progress,
    onInputChange,
    onSubmit,
    onOptionSelect,
    onClose,
    messagesEndRef,
    inputRef,
    isComposerLocked,
    onBlockSubmit,
    onBlockCancel,
    enableFormBlocks = false,
    onGoBack,
    canGoBack = false,
    headerSubtitle,
    progressLabel,
    closeLabel = '닫기',
    flush = false
}) => {
    const isDark = mode === 'dark';
    const template = getTemplateById(templateId);
    const layout = template?.layoutConfig;

    // 특수 레이아웃 상태
    const [activeTab, setActiveTab] = useState<'faq' | 'chat' | 'history'>('chat');
    const [showNewMessage, setShowNewMessage] = useState(false);

    // 배경색
    const getBackgroundColor = () => {
        if (isDark) {
            switch (templateId) {
                case 'neon': return '#0c0a09';
                case 'gradient': return '#1e1b4b';
                default: return '#1e293b';
            }
        }
        return '#f8fafc';
    };

    // 메시지 그룹화 (연속 메시지 묶기)
    const groupedMessages = useMemo(() => {
        if (!layout?.groupConsecutiveMessages) return messages.map(m => ({ ...m, isFirst: true, isLast: true }));

        return messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const next = messages[idx + 1];
            const isFirst = !prev || prev.type !== msg.type;
            const isLast = !next || next.type !== msg.type;
            return { ...msg, isFirst, isLast };
        });
    }, [messages, layout?.groupConsecutiveMessages]);

    // ==================== 헤더 렌더링 ====================
    const renderHeader = () => {
        const headerHeight = layout?.headerHeight || 56;
        const showBorder = layout?.showHeaderBorder ?? true;

        // 08. 헤더 탭형
        if (layout?.hasTabs) {
            return (
                <div>
                    <div
                        className="px-4 py-3 flex items-center justify-between"
                        style={{
                            backgroundColor: colors.primary,
                            height: `${headerHeight}px`
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                                {characterImage ? (
                                    <img src={characterImage} alt={characterName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-lg">🧑‍⚖️</span>
                                )}
                            </div>
                            <span style={{ color: colors.headerText }} className="font-bold">{characterName}</span>
                        </div>
                        <button type="button" onClick={onClose} aria-label="대화 닫기" className="min-w-11 min-h-11 flex items-center justify-center p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5" style={{ color: colors.headerText }} />
                        </button>
                    </div>
                    {/* 탭 바 */}
                    <div className="flex border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                        {(['faq', 'chat', 'history'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${activeTab === tab ? 'border-b-2' : ''
                                    }`}
                                style={{
                                    borderColor: activeTab === tab ? colors.primary : 'transparent',
                                    color: activeTab === tab
                                        ? colors.primary
                                        : (isDark ? '#9ca3af' : '#6b7280'),
                                    backgroundColor: getBackgroundColor()
                                }}
                            >
                                {tab === 'faq' ? 'FAQ' : tab === 'chat' ? '상담' : '내역'}
                            </button>
                        ))}
                    </div>
                </div>
            );
        }

        // 02. 미니멀 프리미엄 (큰 헤더)
        if (templateId === 'minimal') {
            return (
                <div
                    className="px-5 py-4 flex items-center justify-between"
                    style={{
                        backgroundColor: colors.primary,
                        minHeight: `${headerHeight}px`
                    }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center overflow-hidden">
                            {characterImage ? (
                                <img src={characterImage} alt={characterName} className="w-full h-full object-cover" />
                            ) : (
                                <Bot className="w-7 h-7" style={{ color: colors.headerText }} />
                            )}
                        </div>
                        <div>
                            <p style={{ color: colors.headerText }} className="font-bold text-lg">{characterName}</p>
                            <p className="text-xs opacity-70" style={{ color: colors.headerText }}>AI 법률 상담</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="대화 닫기" className="min-w-11 min-h-11 flex items-center justify-center p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5" style={{ color: colors.headerText }} />
                    </button>
                </div>
            );
        }

        // 03. 타임레일
        if (layout?.hasTimeline) {
            return (
                <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                        backgroundColor: colors.primary,
                        borderBottom: showBorder ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none'
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Building2 className="w-6 h-6" style={{ color: colors.headerText }} />
                        <div>
                            <p style={{ color: colors.headerText }} className="font-semibold">{characterName}</p>
                            <p className="text-xs opacity-70" style={{ color: colors.headerText }}>상담 진행 중</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="대화 닫기" className="min-w-11 min-h-11 flex items-center justify-center p-1 hover:opacity-70">
                        <X className="w-5 h-5" style={{ color: colors.headerText }} />
                    </button>
                </div>
            );
        }

        // 04. 버블 꼬리형 (얇은 헤더)
        if (layout?.showBubbleTail) {
            return (
                <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{
                        backgroundColor: colors.primary,
                        height: '56px'
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
                            <span className="text-xl">🤖</span>
                        </div>
                        <div>
                            <p style={{ color: colors.headerText }} className="font-bold">{characterName}</p>
                            <p className="text-xs opacity-80" style={{ color: colors.headerText }}>온라인</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="대화 닫기" className="min-w-11 min-h-11 flex items-center justify-center p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                        <X className="w-5 h-5" style={{ color: colors.headerText }} />
                    </button>
                </div>
            );
        }

        // 05. 컴팩트 메신저
        if (templateId === 'messenger') {
            return (
                <div
                    className="px-3 py-2 flex items-center justify-between"
                    style={{
                        backgroundColor: colors.primary,
                        height: '52px',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`
                    }}
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <MessageCircle className="w-4 h-4" style={{ color: colors.headerText }} />
                        </div>
                        <span style={{ color: colors.headerText }} className="font-medium text-sm">{characterName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button type="button" onClick={onClose} aria-label="대화 닫기" className="min-w-11 min-h-11 flex items-center justify-center p-1.5 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-4 h-4" style={{ color: colors.headerText }} />
                        </button>
                    </div>
                </div>
            );
        }

        // 07. 참여자 레일
        if (layout?.hasParticipantRail) {
            return (
                <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <Users className="w-5 h-5" style={{ color: colors.headerText }} />
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: isDark ? '#fff' : '#1e293b' }}>{characterName}</p>
                            <p className="text-xs" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>참여자 1명</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="대화 닫기" className="min-w-11 min-h-11 flex items-center justify-center p-1" style={{ color: colors.primary }}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
            );
        }

        // 09. 플로팅 위젯
        if (layout?.isFloatingWidget) {
            return (
                <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                        backgroundColor: isDark ? '#0c0a09' : colors.primary,
                        boxShadow: `0 0 20px ${colors.accent}40`
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{
                                backgroundColor: isDark ? colors.primary : 'white',
                                boxShadow: `0 0 15px ${colors.accent}60`
                            }}
                        >
                            <Zap className="w-5 h-5" style={{ color: isDark ? '#fff' : colors.primary }} />
                        </div>
                        <span
                            className="font-bold"
                            style={{
                                color: isDark ? colors.accent : colors.headerText,
                                textShadow: isDark ? `0 0 10px ${colors.accent}` : 'none'
                            }}
                        >
                            {characterName}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="대화 닫기"
                        className="min-w-11 min-h-11 flex items-center justify-center p-2 rounded-lg transition-all hover:scale-110"
                        style={{
                            backgroundColor: isDark ? colors.primary : 'rgba(255,255,255,0.2)',
                            boxShadow: isDark ? `0 0 10px ${colors.accent}40` : 'none'
                        }}
                    >
                        <X className="w-5 h-5" style={{ color: isDark ? colors.accent : colors.headerText }} />
                    </button>
                </div>
            );
        }

        // 01. 클래식 카드형 (기본) — 자동 정리 도구임을 드러내는 아이콘, 44px 닫기 버튼
        return (
            <div
                className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 shrink-0"
                style={{
                    backgroundColor: colors.primary,
                    minHeight: '56px',
                    borderBottom: showBorder ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none'
                }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center overflow-hidden shrink-0" aria-hidden="true">
                        {characterImage ? (
                            <img src={characterImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <Bot className="w-5 h-5" style={{ color: colors.headerText }} />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p style={{ color: colors.headerText }} className="font-bold text-[15px] leading-tight truncate">{characterName}</p>
                        {headerSubtitle && (
                            <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: colors.headerText, opacity: 0.8 }}>{headerSubtitle}</p>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={closeLabel}
                    className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                    <X className="w-5 h-5" style={{ color: colors.headerText }} aria-hidden="true" />
                </button>
            </div>
        );
    };

    // ==================== 메시지 스타일 ====================
    const getMessageStyle = (isUser: boolean, isFirst: boolean = true, isLast: boolean = true) => {
        const radius = layout?.bubbleRadius || 14;
        const padding = layout?.bubblePadding || 12;

        const baseUserStyle = {
            backgroundColor: colors.primary,
            color: colors.userText,
            padding: `${padding}px`
        };
        const baseBotStyle = {
            backgroundColor: colors.secondary,
            color: colors.botText,
            padding: `${padding}px`
        };

        // 말풍선 꼬리 스타일 (04. 버블 꼬리형)
        if (layout?.showBubbleTail) {
            const groupRadius = isFirst ? radius : radius / 2;
            const lastRadius = isLast ? radius : radius / 2;

            return isUser
                ? {
                    ...baseUserStyle,
                    borderRadius: `${groupRadius}px ${groupRadius}px ${isLast ? radius / 3 : lastRadius}px ${radius}px`,
                    marginBottom: isLast ? '4px' : '2px'
                }
                : {
                    ...baseBotStyle,
                    borderRadius: `${groupRadius}px ${groupRadius}px ${radius}px ${isLast ? radius / 3 : lastRadius}px`,
                    marginBottom: isLast ? '4px' : '2px'
                };
        }

        // 03. 타임레일
        if (layout?.hasTimeline) {
            return isUser
                ? { ...baseUserStyle, borderRadius: `${radius}px` }
                : { ...baseBotStyle, borderRadius: `${radius}px`, borderLeft: `3px solid ${colors.accent}` };
        }

        // 05. 컴팩트 메신저
        if (templateId === 'messenger') {
            return isUser
                ? { ...baseUserStyle, borderRadius: `${radius}px ${radius}px 4px ${radius}px` }
                : { ...baseBotStyle, borderRadius: `${radius}px ${radius}px ${radius}px 4px` };
        }

        // 10. 폼-혼합형
        if (layout?.hasFormBlocks) {
            return isUser
                ? {
                    ...baseUserStyle,
                    borderRadius: `${radius}px ${radius}px 4px ${radius}px`,
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`
                }
                : { ...baseBotStyle, borderRadius: `${radius}px ${radius}px ${radius}px 4px` };
        }

        // 기본 스타일
        return isUser
            ? { ...baseUserStyle, borderRadius: `${radius}px ${radius}px 4px ${radius}px` }
            : { ...baseBotStyle, borderRadius: `${radius}px ${radius}px ${radius}px 4px` };
    };

    // ==================== 메시지 리스트 렌더링 ====================
    const renderMessages = () => {
        const messageGap = layout?.messageGap || 12;
        const showAvatar = layout?.showAvatar ?? true;
        const showSenderLabel = layout?.showSenderLabel ?? false;
        const maxWidth = layout?.bubbleMaxWidth || '80%';

        // 07. 참여자 레일 (좌측 레일 있음)
        const hasRail = layout?.hasParticipantRail;

        // 03. 타임레일
        const hasTimeline = layout?.hasTimeline;

        return (
            <div
                role="log"
                aria-live="polite"
                aria-label="채무 정리 대화"
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 chatbot-scroll-area"
                style={{
                    backgroundColor: getBackgroundColor(),
                    paddingLeft: hasRail ? '72px' : hasTimeline ? '48px' : '16px'
                }}
            >
                {/* 07. 참여자 레일 */}
                {hasRail && (
                    <div
                        className="fixed left-0 top-0 bottom-0 flex flex-col items-center pt-20 pb-4 gap-2"
                        style={{
                            width: '60px',
                            backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
                            borderRight: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`
                        }}
                    >
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <span className="text-lg">🧑‍⚖️</span>
                        </div>
                    </div>
                )}

                {/* 03. 타임레일 */}
                {hasTimeline && (
                    <div
                        className="absolute left-6 top-20 bottom-20"
                        style={{
                            width: '2px',
                            backgroundColor: colors.accent
                        }}
                    />
                )}

                <div className="chatbot-messages-inner" style={{ display: 'flex', flexDirection: 'column', gap: `${messageGap}px` }}>
                    <AnimatePresence>
                        {groupedMessages.map((msg, idx) => (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                style={{ position: 'relative' }}
                            >
                                {/* 타임레일 노드 */}
                                {hasTimeline && msg.isFirst && (
                                    <div
                                        className="absolute flex items-center justify-center"
                                        style={{
                                            left: '-20px',
                                            top: '8px',
                                            width: '12px',
                                            height: '12px'
                                        }}
                                    >
                                        <div
                                            className="w-2.5 h-2.5 rounded-full border-2"
                                            style={{
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                borderColor: colors.accent
                                            }}
                                        />
                                    </div>
                                )}

                                {/* 아바타 (봇 메시지) */}
                                {showAvatar && msg.type === 'bot' && msg.isFirst && (
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden"
                                        style={{ backgroundColor: characterImage ? 'transparent' : colors.primary }}
                                    >
                                        {characterImage ? (
                                            <img src={characterImage} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <Bot className="w-4 h-4" style={{ color: colors.headerText }} aria-hidden="true" />
                                        )}
                                    </div>
                                )}
                                {showAvatar && msg.type === 'bot' && !msg.isFirst && (
                                    <div className="w-8 mr-2 flex-shrink-0" />
                                )}

                                <div style={{ maxWidth }}>
                                    {/* 발신자 라벨 */}
                                    {showSenderLabel && msg.isFirst && msg.type === 'bot' && (
                                        <p
                                            className="text-xs mb-1 ml-1"
                                            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                                        >
                                            {characterName}
                                        </p>
                                    )}

                                    {/* 메시지 버블 */}
                                    <div style={getMessageStyle(msg.type === 'user', msg.isFirst, msg.isLast)}>
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                            {msg.type === 'bot' ? parseHighlight(msg.content, colors.primary) : msg.content}
                                        </p>
                                    </div>

                                    {/* 옵션 버튼 - Interactive Block이 없는 경우에만 표시 */}
                                    {msg.options && msg.type === 'bot' && !msg.interactiveBlock && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {msg.options.map((opt, optIdx) => (
                                                <motion.button
                                                    key={optIdx}
                                                    whileHover={{ scale: 1.03 }}
                                                    whileTap={{ scale: 0.97 }}
                                                    onClick={() => onOptionSelect(opt, msg.id)}
                                                    className="min-h-11 px-4 py-2.5 text-sm font-semibold transition-all"
                                                    style={(() => {
                                                        const isCompleteBtn = opt.label.includes('선택완료');
                                                        const isNoneBtn = opt.label.includes('없어요');
                                                        
                                                        let bgColor = opt.selected
                                                            ? colors.primary
                                                            : (isDark ? colors.accent : '#ffffff');
                                                        let textColor = opt.selected
                                                            ? '#ffffff'
                                                            : (isDark ? colors.headerText : colors.primary);
                                                        let borderStyle = `1.5px solid ${colors.primary}`;
                                                        let shadowStyle = opt.selected
                                                            ? `0 0 12px ${colors.primary}40`
                                                            : (isDark ? 'none' : '0 1px 3px rgba(15, 23, 42, 0.08)');

                                                        if (isCompleteBtn) {
                                                            bgColor = '#10b981'; // Emerald Green
                                                            textColor = '#ffffff';
                                                            borderStyle = '1.5px solid #10b981';
                                                            shadowStyle = '0 4px 12px rgba(16, 185, 129, 0.3)';
                                                        } else if (isNoneBtn) {
                                                            bgColor = isDark ? '#451a1a' : '#fef2f2'; // Soft Red / Rose
                                                            textColor = isDark ? '#fca5a5' : '#ef4444'; // Red
                                                            borderStyle = isDark ? '1.5px solid #ef4444' : '1.5px solid #fee2e2';
                                                            shadowStyle = 'none';
                                                        }

                                                        return {
                                                            backgroundColor: bgColor,
                                                            color: textColor,
                                                            borderRadius: `${(layout?.bubbleRadius || 14)}px`,
                                                            border: borderStyle,
                                                            boxShadow: shadowStyle
                                                        };
                                                    })()}
                                                >
                                                    {opt.label}
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Interactive Block (폼-혼합형) */}
                                    {(() => {
                                        const shouldRender = (layout?.hasFormBlocks || enableFormBlocks) && msg.interactiveBlock && msg.blockState && onBlockSubmit;

                                        return shouldRender ? (
                                            <div className="mt-3">
                                                <InteractiveBlock
                                                    config={msg.interactiveBlock!}
                                                    state={msg.blockState!}
                                                    colors={colors}
                                                    isDark={isDark}
                                                    onSubmit={(value) => onBlockSubmit!(msg.id, value)}
                                                    onCancel={onBlockCancel ? () => onBlockCancel(msg.id) : undefined}
                                                />
                                            </div>
                                        ) : null;
                                    })()}

                                    {/* 타임스탬프 (aside 위치) */}
                                    {layout?.timeStampPosition === 'aside' && msg.isLast && (
                                        <span
                                            className="text-xs ml-2 inline-block align-bottom"
                                            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
                                        >
                                            {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* 타이핑 인디케이터 */}
                    {isTyping && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                        >
                            {showAvatar && (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 overflow-hidden"
                                    style={{ backgroundColor: characterImage ? 'transparent' : colors.primary }}
                                >
                                    {characterImage ? (
                                        <img src={characterImage} alt="Bot" className="w-full h-full object-cover" />
                                    ) : (
                                        <Bot className="w-4 h-4" style={{ color: colors.headerText }} />
                                    )}
                                </div>
                            )}
                            <div
                                className="px-4 py-3 flex gap-1"
                                style={{
                                    backgroundColor: colors.secondary,
                                    borderRadius: `${layout?.bubbleRadius || 14}px`
                                }}
                            >
                                {[0, 1, 2].map(i => (
                                    <motion.div
                                        key={i}
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: colors.botText }}
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* 새 메시지 버튼 */}
                {showNewMessage && (
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="fixed bottom-20 right-6 px-3 py-1.5 rounded-full shadow-lg text-sm flex items-center gap-1"
                        style={{ backgroundColor: colors.primary, color: colors.headerText }}
                    >
                        <ChevronDown className="w-4 h-4" />
                        새 메시지
                    </motion.button>
                )}
            </div>
        );
    };

    // ==================== Composer 렌더링 ====================
    const renderComposer = () => {
        const inputRadius = layout?.composerInputRadius || 20;
        // 마지막 질문의 입력 형식(금액이면 숫자 키패드)
        const lastBotInputType = [...messages].reverse().find(m => m.type === 'bot')?.inputType;

        const renderMoneyHelper = () => {
            const lastBotMsg = [...messages].reverse().find(m => m.type === 'bot');
            if (lastBotMsg?.inputType !== 'money' || isComposerLocked) return null;

            const currentVal = parseInt(inputValue.replace(/,/g, '')) || 0;

            const addAmount = (amount: number) => {
                const newVal = currentVal + amount;
                onInputChange(newVal.toString());
            };

            const resetAmount = () => onInputChange('');

            const formatKoreanMoney = (val: number) => {
                if (val === 0) return '';
                const eok = Math.floor(val / 10000);
                const man = val % 10000;

                let result = '';
                if (eok > 0) result += `${eok}억 `;
                if (man > 0) result += `${man.toLocaleString()}만 `;
                return result ? result + '원' : '';
            };

            return (
                <div className="flex flex-col gap-2 mb-2 px-3 pt-2">
                    {currentVal > 0 && (
                        <div className="text-sm font-bold px-1" style={{ color: isDark ? '#93c5fd' : colors.primary }} aria-live="polite">
                            현재 입력: {formatKoreanMoney(currentVal)}
                        </div>
                    )}

                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                        {(() => {
                            const stepId = lastBotMsg?.stepId || '';
                            // 소액: 의료비, 교육비, 월세, 양육비, 월 지출
                            const smallSteps = ['medical_amount', 'education_amount', 'special_education_amount', 'rent_cost', 'child_support_receive', 'child_support_pay', 'monthly_expenses'];
                            // 중간: 월 소득
                            const mediumSteps = ['income_salary', 'income_business', 'income_confirm', 'spouse_income'];
                            // 대형: 보증금, 자가시세, 담보대출, 자산, 채무 등 → 나머지 전부
                            let buttons: { label: string; value: number }[];
                            if (smallSteps.includes(stepId)) {
                                buttons = [
                                    { label: '+10만', value: 10 },
                                    { label: '+100만', value: 100 },
                                ];
                            } else if (mediumSteps.includes(stepId)) {
                                buttons = [
                                    { label: '+10만', value: 10 },
                                    { label: '+100만', value: 100 },
                                    { label: '+500만', value: 500 },
                                    { label: '+1000만', value: 1000 },
                                ];
                            } else {
                                // 대형 금액 (보증금, 자가시세, 대출, 자산, 채무 등)
                                buttons = [
                                    { label: '+10만', value: 10 },
                                    { label: '+100만', value: 100 },
                                    { label: '+500만', value: 500 },
                                    { label: '+1000만', value: 1000 },
                                    { label: '+5000만', value: 5000 },
                                    { label: '+1억', value: 10000 },
                                ];
                            }
                            return buttons.map((btn, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => addAmount(btn.value)}
                                className="min-h-10 px-3 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors border shrink-0"
                                style={{
                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                    borderColor: isDark ? '#475569' : '#e2e8f0',
                                    color: isDark ? '#e2e8f0' : '#475569'
                                }}
                            >
                                {btn.label}
                            </button>
                            ));
                        })()}
                        <button
                            type="button"
                            onClick={resetAmount}
                            className="min-h-10 px-3 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors border shrink-0 bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"
                        >
                            초기화
                        </button>
                    </div>
                </div>
            );
        };

        // 06. 하단 툴바 확장형
        if (layout?.hasExpandPanel) {
            return (
                <div
                    className="border-t"
                    style={{
                        backgroundColor: getBackgroundColor(),
                        borderColor: isDark ? '#374151' : '#e5e7eb'
                    }}
                >
                    {/* 숫자 입력 도우미 버튼 */}
                    {renderMoneyHelper()}



                    {/* 입력 영역 */}
                    <div className="flex items-center gap-2 p-3">
                        {/* 뒤로 가기 버튼 */}
                        {canGoBack && onGoBack && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onGoBack}
                                className="p-2.5 rounded-xl transition-all flex-shrink-0"
                                style={{
                                    backgroundColor: isDark ? '#374151' : '#f3f4f6',
                                    color: isDark ? '#d1d5db' : '#6b7280'
                                }}
                                title="이전 질문으로"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </motion.button>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => onInputChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
                            placeholder="입력해주세요..."
                            className="flex-1 min-w-0 px-4 py-3 border outline-none focus:ring-2 transition-all"
                            style={{
                                backgroundColor: isDark ? '#334155' : '#f8fafc',
                                color: isDark ? '#f1f5f9' : '#1e293b',
                                borderColor: isDark ? '#475569' : '#e2e8f0',
                                borderRadius: `${inputRadius}px`
                            }}
                        />
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onSubmit}
                            aria-label="보내기"
                            className="min-w-11 min-h-11 flex items-center justify-center p-3 transition-all flex-shrink-0"
                            style={{
                                backgroundColor: colors.primary,
                                color: colors.headerText,
                                borderRadius: `${inputRadius}px`
                            }}
                        >
                            <Send className="w-5 h-5" />
                        </motion.button>
                    </div>
                </div>
            );
        }

        // 기본 Composer
        return (
            <div
                className="p-3 border-t"
                style={{
                    backgroundColor: getBackgroundColor(),
                    borderColor: isDark ? '#374151' : '#e5e7eb'
                }}
            >
                {/* Composer 잠금 알림 (폼-혼합형) */}
                {isComposerLocked && layout?.hasFormBlocks && (
                    <div
                        className="mb-2 px-3 py-2 rounded-lg text-sm text-center"
                        style={{
                            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(30, 58, 95, 0.06)',
                            color: isDark ? '#cbd5e1' : '#1E3A5F'
                        }}
                    >
                        위 입력란을 먼저 완료해 주세요
                    </div>
                )}

                {/* 숫자 입력 도우미 버튼 */}
                {renderMoneyHelper()}

                <div className="flex items-center gap-2">
                    {/* 뒤로 가기 버튼 */}
                    {canGoBack && onGoBack && (
                        <motion.button
                            type="button"
                            whileTap={{ scale: 0.95 }}
                            onClick={onGoBack}
                            className="w-11 h-11 rounded-xl transition-colors flex-shrink-0 flex items-center justify-center"
                            style={{
                                backgroundColor: isDark ? '#374151' : '#f1f5f9',
                                color: isDark ? '#d1d5db' : '#475569'
                            }}
                            aria-label="이전 질문으로"
                            title="이전 질문으로"
                        >
                            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                        </motion.button>
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode={lastBotInputType === 'money' || lastBotInputType === 'number' ? 'numeric' : undefined}
                        value={inputValue}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isComposerLocked && onSubmit()}
                        placeholder={isComposerLocked ? '위 입력란을 먼저 완료해 주세요' : lastBotInputType === 'money' ? '금액 입력 (만 원 단위)' : '답변을 입력해 주세요'}
                        aria-label="답변 입력"
                        disabled={isComposerLocked}
                        className="flex-1 min-w-0 min-h-11 px-4 py-2.5 text-base border outline-none focus:ring-2 focus:ring-slate-400/40 transition-all"
                        style={{
                            backgroundColor: isDark ? '#334155' : '#ffffff',
                            color: isDark ? '#f1f5f9' : '#0f172a',
                            borderColor: isDark ? '#475569' : '#cbd5e1',
                            borderRadius: `${inputRadius}px`,
                            opacity: isComposerLocked ? 0.6 : 1,
                            cursor: isComposerLocked ? 'not-allowed' : 'text'
                        }}
                    />
                    <motion.button
                        type="button"
                        whileTap={isComposerLocked ? {} : { scale: 0.95 }}
                        onClick={onSubmit}
                        disabled={isComposerLocked}
                        aria-label="보내기"
                        className="w-11 h-11 transition-all flex-shrink-0 flex items-center justify-center"
                        style={{
                            backgroundColor: colors.primary,
                            color: colors.headerText,
                            borderRadius: `${inputRadius}px`,
                            opacity: isComposerLocked ? 0.6 : 1,
                            cursor: isComposerLocked ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Send className="w-5 h-5" aria-hidden="true" />
                    </motion.button>
                </div>
            </div>
        );
    };

    // ==================== 컨테이너 스타일 ====================
    const getContainerStyle = () => {
        let containerClass = 'w-full h-full flex flex-col overflow-hidden';

        switch (templateId) {
            case 'classic':
                return `${containerClass} rounded-xl`;
            case 'messenger':
                return `${containerClass} rounded-2xl`;
            case 'minimal':
                return `${containerClass} rounded-lg`;
            case 'gradient':
                return `${containerClass} rounded-2xl`;
            case 'bot':
                return `${containerClass} rounded-2xl`;
            case 'sidebar':
                return `${containerClass} rounded-xl`;
            case 'modern':
                return `${containerClass} rounded-2xl shadow-2xl`;
            case 'bubble':
                return `${containerClass} rounded-3xl`;
            case 'corporate':
                return `${containerClass} rounded-lg`;
            case 'neon':
                return `${containerClass} rounded-xl`;
            default:
                return `${containerClass} rounded-xl`;
        }
    };

    // ==================== 메인 렌더링 ====================
    const progressValue = Math.max(0, Math.min(100, Math.round(progress)));
    return (
        <div
            className={flush ? 'w-full h-full flex flex-col overflow-hidden' : getContainerStyle()}
            style={{
                backgroundColor: getBackgroundColor(),
                borderColor: templateId === 'sidebar' ? colors.primary : undefined,
                borderLeftWidth: layout?.hasParticipantRail ? '0' : undefined
            }}
        >
            {/* Header */}
            {renderHeader()}

            {/* Progress — 막대 + 진행 문구 */}
            <div
                className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
                style={{ backgroundColor: isDark ? '#111827' : '#ffffff', borderColor: isDark ? '#374151' : '#e2e8f0' }}
            >
                <div
                    className="flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: isDark ? '#374151' : '#e2e8f0' }}
                    role="progressbar"
                    aria-label="채무 정리 진행률"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progressValue}
                    aria-valuetext={progressLabel || `${progressValue}%`}
                >
                    <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: isDark ? colors.accent : colors.primary }}
                        initial={{ width: 0 }}
                        animate={{ width: `${progressValue}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>
                <span className="text-xs font-bold tabular-nums whitespace-nowrap" style={{ color: isDark ? '#cbd5e1' : '#475569' }} aria-hidden="true">
                    {progressLabel || `${progressValue}%`}
                </span>
            </div>

            {/* Messages (탭 조건부) */}
            {(!layout?.hasTabs || activeTab === 'chat') && renderMessages()}

            {/* FAQ 탭 내용 */}
            {layout?.hasTabs && activeTab === 'faq' && (
                <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: getBackgroundColor() }}>
                    <p className="text-center py-8" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        자주 묻는 질문이 여기에 표시됩니다.
                    </p>
                </div>
            )}

            {/* 내역 탭 내용 */}
            {layout?.hasTabs && activeTab === 'history' && (
                <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: getBackgroundColor() }}>
                    <p className="text-center py-8" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        이전 상담 내역이 여기에 표시됩니다.
                    </p>
                </div>
            )}

            {/* Composer (탭 조건부) */}
            {(!layout?.hasTabs || activeTab === 'chat') && renderComposer()}
        </div>
    );
};

export default ChatbotRenderer;
