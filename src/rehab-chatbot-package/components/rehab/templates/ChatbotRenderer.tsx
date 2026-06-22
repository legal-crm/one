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

// 메시지 타입
export interface ChatMessage {
    id: string;
    type: 'user' | 'bot';
    content: string;
    options?: { label: string; value: string }[];
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
    canGoBack = false
}) => {
    const isDark = mode === 'dark';
    const template = getTemplateById(templateId);
    const layout = template?.layoutConfig;

    // 특수 레이아웃 상태
    const [activeTab, setActiveTab] = useState<'faq' | 'chat' | 'history'>('chat');
    const [showToolbarPanel, setShowToolbarPanel] = useState(false);
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
        return '#fafbff';
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
                                    <Sparkles className="w-5 h-5" style={{ color: colors.headerText }} />
                                )}
                            </div>
                            <span style={{ color: colors.headerText }} className="font-bold">{characterName}</span>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
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
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
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
                    <button onClick={onClose} className="p-1 hover:opacity-70">
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
                    <button onClick={onClose} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
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
                        <button className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                            <Search className="w-4 h-4" style={{ color: colors.headerText }} />
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
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
                    <button onClick={onClose} className="p-1" style={{ color: colors.primary }}>
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
                        onClick={onClose}
                        className="p-2 rounded-lg transition-all hover:scale-110"
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

        // 01. 클래식 카드형 (기본)
        return (
            <div
                className="px-4 py-3 flex items-center justify-between"
                style={{
                    backgroundColor: colors.primary,
                    borderBottom: showBorder ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none'
                }}
            >
                <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
                    <span style={{ color: colors.headerText }} className="font-semibold">{characterName}</span>
                </div>
                <button onClick={onClose} className="p-1 hover:opacity-70 transition-opacity">
                    <X className="w-5 h-5" style={{ color: colors.headerText }} />
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
                className="flex-1 overflow-y-auto p-4"
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
                            <Bot className="w-5 h-5" style={{ color: colors.headerText }} />
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: `${messageGap}px` }}>
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
                                            <img src={characterImage} alt="Bot" className="w-full h-full object-cover" />
                                        ) : (
                                            <Bot className="w-4 h-4" style={{ color: colors.headerText }} />
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
                                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
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
                                                    className="px-4 py-2.5 text-sm font-semibold transition-all"
                                                    style={{
                                                        backgroundColor: isDark ? colors.accent : '#ffffff',
                                                        color: isDark ? colors.headerText : colors.primary,
                                                        borderRadius: `${(layout?.bubbleRadius || 14)}px`,
                                                        border: isDark ? 'none' : `1.5px solid ${colors.primary}`,
                                                        boxShadow: isDark ? 'none' : '0 2px 8px rgba(114, 100, 255, 0.1)'
                                                    }}
                                                >
                                                    {opt.label}
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Interactive Block (폼-혼합형) */}
                                    {(() => {
                                        const shouldRender = (layout?.hasFormBlocks || enableFormBlocks) && msg.interactiveBlock && msg.blockState && onBlockSubmit;

                                        // 디버깅: 마지막 메시지인 경우 항상 로그 출력
                                        if (msg.isLast || msg.interactiveBlock) {
                                            console.log(`[Renderer] Msg ${msg.id} Render Check:`, {
                                                content: msg.content.substring(0, 20),
                                                shouldRender,
                                                hasFormBlocks: layout?.hasFormBlocks,
                                                enableFormBlocks,
                                                msgHasBlock: !!msg.interactiveBlock,
                                                msgState: msg.blockState,
                                                hasSubmitHandler: !!onBlockSubmit,
                                                // interactiveBlock 내용 확인
                                                blockConfig: msg.interactiveBlock
                                            });
                                        }

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
                    {/* 툴바 행 */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}>
                        <button
                            onClick={() => setShowToolbarPanel(!showToolbarPanel)}
                            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <Paperclip className="w-5 h-5" style={{ color: colors.accent }} />
                        </button>
                        <button className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Image className="w-5 h-5" style={{ color: colors.accent }} />
                        </button>
                        <button className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Smile className="w-5 h-5" style={{ color: colors.accent }} />
                        </button>
                    </div>

                    {/* 확장 패널 */}
                    <AnimatePresence>
                        {showToolbarPanel && (
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: 160 }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                                style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc' }}
                            >
                                <div className="p-4 grid grid-cols-3 gap-3">
                                    {['📄 파일', '📷 사진', '📍 위치'].map((item, i) => (
                                        <button
                                            key={i}
                                            className="flex flex-col items-center gap-1 p-3 rounded-xl transition-colors"
                                            style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0' }}
                                        >
                                            <span className="text-2xl">{item.split(' ')[0]}</span>
                                            <span className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                {item.split(' ')[1]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                            className="flex-1 px-4 py-3 border outline-none focus:ring-2 transition-all"
                            style={{
                                backgroundColor: isDark ? '#334155' : '#f8fafc',
                                color: isDark ? '#f1f5f9' : '#1e293b',
                                borderColor: isDark ? '#475569' : '#e2e8f0',
                                borderRadius: `${inputRadius}px`
                            }}
                        />
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onSubmit}
                            className="p-3 transition-all"
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
                            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
                            color: isDark ? '#a5b4fc' : '#6366f1'
                        }}
                    >
                        위 블록에서 입력을 완료해주세요
                    </div>
                )}

                {/* 숫자 입력 도우미 버튼 (inputType이 money일 때만 표시) */}
                {(() => {
                    const lastBotMsg = [...messages].reverse().find(m => m.type === 'bot');
                    if (lastBotMsg?.inputType === 'money' && !isComposerLocked) {
                        const currentVal = parseInt(inputValue.replace(/,/g, '')) || 0;

                        const addAmount = (amount: number) => {
                            const newVal = currentVal + amount;
                            onInputChange(newVal.toString());
                        };

                        const resetAmount = () => onInputChange('');

                        // 한글 금액 포맷팅 (만원 단위 입력 기준)
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
                            <div className="flex flex-col gap-2 mb-2">
                                {/* 실시간 금액 프리뷰 */}
                                {currentVal > 0 && (
                                    <div className="text-sm font-bold text-blue-600 dark:text-blue-400 px-1">
                                        현재 입력: {formatKoreanMoney(currentVal)}
                                    </div>
                                )}

                                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                                    {[
                                        { label: '+1억', value: 10000 },
                                        { label: '+5천만', value: 5000 },
                                        { label: '+1천만', value: 1000 },
                                        { label: '+100만', value: 100 },
                                        { label: '+10만', value: 10 },
                                    ].map((btn, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => addAmount(btn.value)}
                                            className="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors border"
                                            style={{
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                borderColor: isDark ? '#475569' : '#e2e8f0',
                                                color: isDark ? '#e2e8f0' : '#475569'
                                            }}
                                        >
                                            {btn.label}
                                        </button>
                                    ))}
                                    <button
                                        onClick={resetAmount}
                                        className="px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors border bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"
                                    >
                                        초기화
                                    </button>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

                <div className="flex items-center gap-2">
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
                        onKeyDown={(e) => e.key === 'Enter' && !isComposerLocked && onSubmit()}
                        placeholder={isComposerLocked ? "블록 입력 대기 중..." : "입력해주세요..."}
                        disabled={isComposerLocked}
                        className="flex-1 px-4 py-3 border outline-none focus:ring-2 transition-all"
                        style={{
                            backgroundColor: isDark ? '#334155' : '#f8fafc',
                            color: isDark ? '#f1f5f9' : '#1e293b',
                            borderColor: isDark ? '#475569' : '#e2e8f0',
                            borderRadius: `${inputRadius}px`,
                            opacity: isComposerLocked ? 0.6 : 1,
                            cursor: isComposerLocked ? 'not-allowed' : 'text'
                        }}
                    />
                    <motion.button
                        whileHover={isComposerLocked ? {} : { scale: 1.05 }}
                        whileTap={isComposerLocked ? {} : { scale: 0.95 }}
                        onClick={onSubmit}
                        disabled={isComposerLocked}
                        className="p-3 transition-all"
                        style={{
                            backgroundColor: colors.primary,
                            color: colors.headerText,
                            borderRadius: `${inputRadius}px`,
                            opacity: isComposerLocked ? 0.6 : 1,
                            cursor: isComposerLocked ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <Send className="w-5 h-5" />
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
    return (
        <div
            className={getContainerStyle()}
            style={{
                backgroundColor: getBackgroundColor(),
                borderColor: templateId === 'sidebar' ? colors.primary : undefined,
                borderLeftWidth: layout?.hasParticipantRail ? '0' : undefined
            }}
        >
            {/* Header */}
            {renderHeader()}

            {/* Progress Bar */}
            <div className="h-1" style={{ backgroundColor: isDark ? '#374151' : '#ede9fe' }}>
                <motion.div
                    className="h-full"
                    style={{ background: isDark ? colors.accent : `linear-gradient(90deg, ${colors.primary}, ${colors.accent})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                />
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
