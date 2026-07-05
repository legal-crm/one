/**
 * PopupContainer - 팝업 표시 컴포넌트
 * 
 * 기능:
 * - 이미지 팝업 (슬라이더 지원)
 * - 날짜 기반 노출 제어 (startDate ~ endDate)
 * - "오늘 하루 보지 않기" (localStorage)
 * - PC/모바일 반응형 크기/위치
 * - 오토플레이
 * - 클릭 액션 (링크 이동, 폼 스크롤, 채팅 오픈)
 * - 배경 오버레이 (dimmed backdrop)
 * - 슬라이드 전환 애니메이션
 */
import React, { useState, useEffect, useRef } from 'react';
import { PopupConfig, PopupItem } from '../../types';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PopupContainerProps {
    config?: PopupConfig;
    landingId: string;
    isPreview?: boolean;
    forceMobile?: boolean;
    onScrollToForm?: () => void;
    onOpenChat?: () => void;
}

const PopupContainer: React.FC<PopupContainerProps> = ({ config, landingId, isPreview = false, forceMobile = false, onScrollToForm, onOpenChat }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeItems, setActiveItems] = useState<PopupItem[]>([]);
    const [isFading, setIsFading] = useState(false);
    const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 1. Check Visibility & Active Items
    useEffect(() => {
        if (isPreview) return;

        if (!config || !config.usePopup || !config.items || config.items.length === 0) {
            setIsVisible(false);
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        if (config.showDoNotOpenToday) {
            const hiddenKey = `landing_popup_hidden_${landingId}_${todayStr}`;
            if (localStorage.getItem(hiddenKey)) {
                setIsVisible(false);
                return;
            }
        }

        const valid = config.items.filter(item => {
            if (item.startDate && item.startDate > todayStr) return false;
            if (item.endDate && item.endDate < todayStr) return false;
            return true;
        });

        if (valid.length > 0) {
            setActiveItems(valid);
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [config, landingId, isPreview]);

    const effectiveItems = isPreview ? (config?.items || []) : activeItems;

    // 2. Responsive Check
    useEffect(() => {
        if (isPreview) return;
        const checkMobile = () => {
            setIsMobile(window.matchMedia('(max-width: 768px)').matches);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [isPreview]);

    // 3. Auto-play with fade transition
    useEffect(() => {
        if (!isVisible && !isPreview) return;
        if (!config?.autoPlay || effectiveItems.length <= 1) return;

        const intervalMs = (config.autoPlayInterval || 3) * 1000;
        const timer = setInterval(() => {
            changeSlide((prev: number) => (prev + 1) % effectiveItems.length);
        }, intervalMs);

        return () => clearInterval(timer);
    }, [isVisible, isPreview, config?.autoPlay, config?.autoPlayInterval, effectiveItems.length]);

    // Cleanup fade timer
    useEffect(() => {
        return () => {
            if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        };
    }, []);

    const changeSlide = (getNext: (prev: number) => number) => {
        if (config?.slideEffect) {
            setIsFading(true);
            fadeTimerRef.current = setTimeout(() => {
                setCurrentIndex(getNext);
                setIsFading(false);
            }, 200);
        } else {
            setCurrentIndex(getNext);
        }
    };

    if (!config?.usePopup) return null;
    if (!isPreview && (!isVisible || effectiveItems.length === 0)) return null;

    const safeIndex = currentIndex >= effectiveItems.length ? 0 : currentIndex;
    const currentItem = effectiveItems[safeIndex];

    const effectiveIsMobile = forceMobile || isMobile;
    const styleConfig = effectiveIsMobile ? config!.mobileStyle : config!.pcStyle;
    const closeBtnColor = config.closeButtonColor || '#ffffff';

    const containerStyle: React.CSSProperties = {
        position: isPreview ? 'absolute' : 'fixed',
        zIndex: isPreview ? 100 : 9999,
        width: `${styleConfig?.width || 300}px`,
        top: `${styleConfig?.top || 100}px`,
        left: styleConfig?.isCentered ? '50%' : `${styleConfig?.left || 50}px`,
        transform: styleConfig?.isCentered ? 'translateX(-50%)' : undefined,
        backgroundColor: 'transparent',
    };

    // PREVIEW: no items placeholder
    if (isPreview && effectiveItems.length === 0) {
        return (
            <div style={{ ...containerStyle, height: '200px' }} className="bg-gray-100 border-2 border-dashed border-gray-400 flex flex-col items-center justify-center text-gray-500 rounded-lg shadow-xl">
                <span className="text-2xl mb-2">🚫</span>
                <p className="text-sm font-bold">팝업 없음</p>
                <p className="text-xs">팝업 목록에 항목을 추가해주세요.</p>
            </div>
        );
    }

    const handleClose = (doNotShowToday: boolean) => {
        setIsVisible(false);
        if (doNotShowToday && config?.showDoNotOpenToday) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            localStorage.setItem(`landing_popup_hidden_${landingId}_${todayStr}`, 'true');
        }
    };

    const handleImageClick = () => {
        if (!currentItem) return;
        if (currentItem.actionType === 'open_rehab_chat') {
            onOpenChat?.();
            handleClose(false);
            return;
        }
        if (currentItem.actionType === 'scroll_to_form') {
            onScrollToForm?.();
            handleClose(false);
            return;
        }
        if (currentItem.linkUrl) {
            if (currentItem.openInNewWindow) {
                window.open(currentItem.linkUrl, '_blank');
            } else {
                window.location.href = currentItem.linkUrl;
            }
        }
    };

    const nextSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        changeSlide((prev: number) => (prev + 1) % effectiveItems.length);
    };

    const prevSlide = (e: React.MouseEvent) => {
        e.stopPropagation();
        changeSlide((prev: number) => (prev - 1 + effectiveItems.length) % effectiveItems.length);
    };

    const showOverlay = !config.disableOverlay && !isPreview;

    return (
        <>
            {/* Background Overlay */}
            {showOverlay && (
                <div
                    className="fixed inset-0 bg-black/40 transition-opacity duration-300"
                    style={{ zIndex: 9998 }}
                    onClick={() => handleClose(false)}
                />
            )}

            {/* Popup Container */}
            <div style={containerStyle} className="shadow-2xl rounded-lg overflow-hidden flex flex-col bg-white border border-gray-200">
                {/* Image Area */}
                <div
                    className="relative w-full h-full cursor-pointer group"
                    onClick={handleImageClick}
                >
                    <div
                        className="transition-opacity duration-200"
                        style={{ opacity: isFading ? 0 : 1 }}
                    >
                        {currentItem?.imageUrl ? (
                            <img
                                src={currentItem.imageUrl}
                                alt={currentItem.title || 'Popup'}
                                className="w-full h-auto object-cover block"
                                style={{ maxHeight: '80vh' }}
                            />
                        ) : (
                            <div className="w-full h-40 bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                                <p className="text-xs">이미지 없음</p>
                                <p className="text-[10px] text-gray-300">이미지를 업로드하세요</p>
                            </div>
                        )}
                    </div>

                    {/* Navigation Arrows */}
                    {effectiveItems.length > 1 && (
                        <>
                            <button
                                onClick={prevSlide}
                                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button
                                onClick={nextSlide}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                            {/* Dots */}
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                                {effectiveItems.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            changeSlide(() => idx);
                                        }}
                                        className={`w-2 h-2 rounded-full transition-all ${idx === safeIndex ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/70'}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Control Area */}
                <div
                    className="text-xs py-2.5 px-3 flex justify-between items-center"
                    style={{ backgroundColor: '#1a1a2e', color: closeBtnColor }}
                >
                    {config?.showDoNotOpenToday ? (
                        <label className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity">
                            <input
                                type="checkbox"
                                className="rounded"
                                onChange={(e) => {
                                    if (e.target.checked) handleClose(true);
                                }}
                            />
                            오늘 하루 보지 않기
                        </label>
                    ) : (
                        <span />
                    )}

                    <button
                        onClick={() => handleClose(false)}
                        className="font-bold border-b border-transparent hover:border-current transition-colors flex items-center gap-1"
                        style={{ color: closeBtnColor }}
                    >
                        <X className="w-4 h-4" />
                        닫기
                    </button>
                </div>
            </div>
        </>
    );
};

export default PopupContainer;
