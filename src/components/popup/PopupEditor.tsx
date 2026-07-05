/**
 * PopupEditor - 팝업 설정 에디터 컴포넌트
 * 
 * 기능:
 * - 팝업 ON/OFF 토글
 * - 팝업 아이템 추가/삭제/순서변경
 * - 이미지 업로드 (FileReader Base64) + URL 직접 입력
 * - 클릭 동작 설정 (링크 이동 / 폼 스크롤 / 채팅 오픈)
 * - PC/모바일 별도 크기/위치 설정
 * - 슬라이더 옵션 (autoPlay, interval, slideEffect)
 * - 닫기 버튼 색상 설정
 * - "오늘 하루 보지 않기" / 오버레이 옵션
 * - 실시간 프리뷰 패널
 */
import React, { useState, useRef } from 'react';
import { PopupConfig, PopupItem } from '../../types';
import { X, Upload, Monitor, Smartphone, ArrowUp, ArrowDown, Play, Pause, Eye, Image as ImageIcon, Link, Type } from 'lucide-react';
import PopupContainer from './PopupContainer';

interface PopupEditorProps {
    popupConfig: PopupConfig;
    onChange: (config: PopupConfig) => void;
}

const PopupEditor: React.FC<PopupEditorProps> = ({ popupConfig, onChange }) => {
    const [previewDevice, setPreviewDevice] = useState<'pc' | 'mobile'>('pc');
    const [showPreview, setShowPreview] = useState(false);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    // Helpers
    const updateConfig = (updates: Partial<PopupConfig>) => {
        onChange({ ...popupConfig, ...updates });
    };

    const updateItem = (idx: number, updates: Partial<PopupItem>) => {
        const newItems = [...popupConfig.items];
        newItems[idx] = { ...newItems[idx], ...updates };
        updateConfig({ items: newItems });
    };

    const updatePcStyle = (updates: Record<string, any>) => {
        updateConfig({ pcStyle: { ...popupConfig.pcStyle, ...updates } });
    };

    const updateMobileStyle = (updates: Record<string, any>) => {
        updateConfig({ mobileStyle: { ...popupConfig.mobileStyle, ...updates } });
    };

    const moveItem = (idx: number, direction: 'up' | 'down') => {
        const newItems = [...popupConfig.items];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= newItems.length) return;
        [newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]];
        updateConfig({ items: newItems });
    };

    const handleImageUpload = (idx: number, file: File) => {
        if (file.size > 5 * 1024 * 1024) {
            alert('파일 크기가 5MB를 초과합니다.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            updateItem(idx, { imageUrl: result });
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="space-y-6">
            {/* 1. Global Toggle */}
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <div>
                    <h3 className="text-sm font-bold text-gray-900">🎯 팝업(Popup) 관리</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">메인 페이지 방문 시 노출되는 팝업 배너를 관리합니다.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-bold text-gray-600">팝업 사용</span>
                    <div
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer ${popupConfig.usePopup ? 'bg-blue-600' : 'bg-gray-300'}`}
                        onClick={() => {
                            const newConfig = { ...popupConfig, usePopup: !popupConfig.usePopup };
                            if (!newConfig.items) newConfig.items = [];
                            if (!newConfig.pcStyle) newConfig.pcStyle = { width: 400, top: 100, left: 100, isCentered: true };
                            if (!newConfig.mobileStyle) newConfig.mobileStyle = { width: 300, top: 50, left: 20, isCentered: true };
                            onChange(newConfig);
                        }}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${popupConfig.usePopup ? 'translate-x-5' : ''}`} />
                    </div>
                </label>
            </div>

            {popupConfig.usePopup && (
                <>
                    {/* 2. Popup Items List */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-gray-700">📋 팝업 목록 ({popupConfig.items.length}개)</h4>
                            <button
                                onClick={() => {
                                    const newItems = [...(popupConfig.items || [])];
                                    newItems.push({
                                        id: crypto.randomUUID(),
                                        title: `팝업 ${newItems.length + 1}`,
                                        imageUrl: '',
                                        openInNewWindow: false,
                                        startDate: new Date().toISOString().split('T')[0],
                                        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                    });
                                    updateConfig({ items: newItems });
                                }}
                                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold transition-colors"
                            >
                                + 팝업 추가
                            </button>
                        </div>

                        {popupConfig.items.length === 0 && (
                            <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400 text-xs">
                                <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                등록된 팝업이 없습니다.<br />
                                <span className="text-[10px]">'+ 팝업 추가' 버튼을 눌러 팝업을 만들어보세요.</span>
                            </div>
                        )}

                        {popupConfig.items.map((item, idx) => (
                            <div key={item.id} className="bg-white border rounded-xl p-4 shadow-sm relative group hover:shadow-md transition-shadow">
                                {/* Header: Title + Actions */}
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                                        <input
                                            type="text"
                                            value={item.title || ''}
                                            onChange={(e) => updateItem(idx, { title: e.target.value })}
                                            className="flex-1 border-0 border-b border-gray-200 focus:border-blue-500 p-0 pb-0.5 text-sm font-bold text-gray-800 outline-none bg-transparent"
                                            placeholder="팝업 제목 (관리자 메모)"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            onClick={() => moveItem(idx, 'up')}
                                            disabled={idx === 0}
                                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                                            title="위로 이동"
                                        >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => moveItem(idx, 'down')}
                                            disabled={idx === popupConfig.items.length - 1}
                                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                                            title="아래로 이동"
                                        >
                                            <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (confirm('이 팝업을 삭제하시겠습니까?')) {
                                                    const newItems = popupConfig.items.filter((_, i) => i !== idx);
                                                    updateConfig({ items: newItems });
                                                }
                                            }}
                                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                            title="삭제"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[140px_1fr] gap-4">
                                    {/* Image Upload Area */}
                                    <div
                                        className="h-36 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 hover:border-blue-300 overflow-hidden relative transition-colors"
                                        onClick={() => fileInputRefs.current[item.id]?.click()}
                                    >
                                        <input
                                            ref={(el) => { fileInputRefs.current[item.id] = el; }}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(idx, file);
                                                e.target.value = '';
                                            }}
                                        />
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt="popup" className="w-full h-full object-contain" />
                                        ) : (
                                            <div className="text-center text-gray-400">
                                                <Upload className="w-6 h-6 mx-auto mb-1" />
                                                <span className="text-[10px] font-medium">클릭하여 업로드</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Config Fields */}
                                    <div className="space-y-2.5">
                                        {/* Image URL direct input */}
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1 flex items-center gap-1">
                                                <Link className="w-3 h-3" /> 이미지 URL (직접 입력)
                                            </label>
                                            <input
                                                type="text"
                                                value={item.imageUrl?.startsWith('data:') ? '' : (item.imageUrl || '')}
                                                onChange={(e) => updateItem(idx, { imageUrl: e.target.value })}
                                                className="w-full border rounded-lg p-1.5 text-xs bg-white focus:border-blue-400 outline-none"
                                                placeholder="https://... (또는 위 영역에 파일 업로드)"
                                            />
                                        </div>

                                        {/* Action Type Selector */}
                                        <div>
                                            <label className="block text-[10px] text-gray-500 mb-1">클릭 동작</label>
                                            <div className="flex gap-1">
                                                {[
                                                    { id: 'link_url', label: '🔗 링크 이동' },
                                                    { id: 'scroll_to_form', label: '📋 폼 이동' },
                                                    { id: 'open_rehab_chat', label: '💬 채팅 팝업' }
                                                ].map(action => (
                                                    <button
                                                        key={action.id}
                                                        onClick={() => updateItem(idx, { actionType: action.id as PopupItem['actionType'] })}
                                                        className={`flex-1 py-1.5 px-2 text-[10px] rounded-lg border transition-all ${
                                                            (!item.actionType && action.id === 'link_url') || item.actionType === action.id
                                                                ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-sm'
                                                                : 'bg-white text-gray-500 hover:bg-gray-50 border-gray-200'
                                                        }`}
                                                    >
                                                        {action.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Link URL Input */}
                                        {(!item.actionType || item.actionType === 'link_url') && (
                                            <div className="space-y-1.5 p-2 bg-blue-50/50 rounded-lg border border-blue-100">
                                                <div>
                                                    <label className="block text-[10px] text-gray-500 mb-1">연결 링크 (Link URL)</label>
                                                    <input
                                                        type="text"
                                                        value={item.linkUrl || ''}
                                                        onChange={(e) => updateItem(idx, { linkUrl: e.target.value })}
                                                        className="w-full border rounded-lg p-1.5 text-xs bg-white focus:border-blue-400 outline-none"
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.openInNewWindow}
                                                        onChange={(e) => updateItem(idx, { openInNewWindow: e.target.checked })}
                                                        className="rounded"
                                                    />
                                                    새 창에서 열기
                                                </label>
                                            </div>
                                        )}

                                        {/* Date Range */}
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">게시 시작일</label>
                                                <input
                                                    type="date"
                                                    value={item.startDate || ''}
                                                    onChange={(e) => updateItem(idx, { startDate: e.target.value })}
                                                    className="w-full border rounded-lg p-1.5 text-xs focus:border-blue-400 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-gray-500 mb-1">게시 종료일</label>
                                                <input
                                                    type="date"
                                                    value={item.endDate || ''}
                                                    onChange={(e) => updateItem(idx, { endDate: e.target.value })}
                                                    className="w-full border rounded-lg p-1.5 text-xs focus:border-blue-400 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 3. Slider Options */}
                    {popupConfig.items.length > 1 && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100">
                            <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                                <Play className="w-3.5 h-3.5 text-purple-500" /> 슬라이더 설정
                            </h4>
                            <div className="flex flex-wrap gap-x-6 gap-y-3">
                                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={popupConfig.autoPlay || false}
                                        onChange={(e) => updateConfig({ autoPlay: e.target.checked })}
                                        className="rounded text-purple-600"
                                    />
                                    자동 재생
                                </label>
                                {popupConfig.autoPlay && (
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs text-gray-600">재생 간격:</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={10}
                                            value={popupConfig.autoPlayInterval || 3}
                                            onChange={(e) => updateConfig({ autoPlayInterval: Math.max(1, Math.min(10, parseInt(e.target.value) || 3)) })}
                                            className="w-14 border rounded-lg p-1 text-xs text-center focus:border-purple-400 outline-none"
                                        />
                                        <span className="text-xs text-gray-500">초</span>
                                    </div>
                                )}
                                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={popupConfig.slideEffect || false}
                                        onChange={(e) => updateConfig({ slideEffect: e.target.checked })}
                                        className="rounded text-purple-600"
                                    />
                                    페이드 전환 효과
                                </label>
                            </div>
                        </div>
                    )}

                    {/* 4. Style & Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* PC Style */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                                <Monitor className="w-3.5 h-3.5 text-blue-500" /> PC 화면 설정
                            </h4>
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-gray-600">가로 크기 (px)</label>
                                    <input
                                        type="number"
                                        value={popupConfig.pcStyle?.width || 400}
                                        onChange={(e) => updatePcStyle({ width: parseInt(e.target.value) || 400 })}
                                        className="w-20 border rounded-lg p-1.5 text-xs text-right focus:border-blue-400 outline-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-gray-600">상단 여백 (Top)</label>
                                    <input
                                        type="number"
                                        value={popupConfig.pcStyle?.top || 100}
                                        onChange={(e) => updatePcStyle({ top: parseInt(e.target.value) || 100 })}
                                        className="w-20 border rounded-lg p-1.5 text-xs text-right focus:border-blue-400 outline-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-gray-600">좌측 여백 (Left)</label>
                                    <input
                                        type="number"
                                        value={popupConfig.pcStyle?.left || 100}
                                        disabled={popupConfig.pcStyle?.isCentered}
                                        onChange={(e) => updatePcStyle({ left: parseInt(e.target.value) || 100 })}
                                        className="w-20 border rounded-lg p-1.5 text-xs text-right disabled:bg-gray-100 disabled:text-gray-400 focus:border-blue-400 outline-none"
                                    />
                                </div>
                                <label className="flex items-center gap-2 justify-end pt-1">
                                    <input
                                        type="checkbox"
                                        checked={popupConfig.pcStyle?.isCentered || false}
                                        onChange={(e) => updatePcStyle({ isCentered: e.target.checked })}
                                        className="rounded text-blue-600"
                                    />
                                    <span className="text-xs font-bold text-blue-600">가로 중앙 정렬</span>
                                </label>
                            </div>
                        </div>

                        {/* Mobile Style */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5 text-green-500" /> 모바일 화면 설정
                            </h4>
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-gray-600">가로 크기 (px)</label>
                                    <input
                                        type="number"
                                        value={popupConfig.mobileStyle?.width || 300}
                                        onChange={(e) => updateMobileStyle({ width: parseInt(e.target.value) || 300 })}
                                        className="w-20 border rounded-lg p-1.5 text-xs text-right focus:border-blue-400 outline-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs text-gray-600">상단 여백 (Top)</label>
                                    <input
                                        type="number"
                                        value={popupConfig.mobileStyle?.top || 50}
                                        onChange={(e) => updateMobileStyle({ top: parseInt(e.target.value) || 50 })}
                                        className="w-20 border rounded-lg p-1.5 text-xs text-right focus:border-blue-400 outline-none"
                                    />
                                </div>
                                <label className="flex items-center gap-2 justify-end pt-1">
                                    <input
                                        type="checkbox"
                                        checked={popupConfig.mobileStyle?.isCentered || false}
                                        onChange={(e) => updateMobileStyle({ isCentered: e.target.checked })}
                                        className="rounded text-green-600"
                                    />
                                    <span className="text-xs font-bold text-green-600">가로 중앙 정렬 (권장)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* 5. Additional Options */}
                    <div className="bg-white border rounded-xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-gray-700">⚙️ 추가 옵션</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={popupConfig.showDoNotOpenToday}
                                    onChange={(e) => updateConfig({ showDoNotOpenToday: e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                '오늘 하루 보지 않기' 버튼 표시
                            </label>
                            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!popupConfig.disableOverlay}
                                    onChange={(e) => updateConfig({ disableOverlay: !e.target.checked })}
                                    className="rounded text-blue-600"
                                />
                                배경 어둡게 하기 (Overlay)
                            </label>
                            <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-700">닫기 버튼 색상:</label>
                                <input
                                    type="color"
                                    value={popupConfig.closeButtonColor || '#ffffff'}
                                    onChange={(e) => updateConfig({ closeButtonColor: e.target.value })}
                                    className="w-8 h-6 border rounded cursor-pointer"
                                />
                                <span className="text-[10px] text-gray-400">{popupConfig.closeButtonColor || '#ffffff'}</span>
                            </div>
                        </div>
                    </div>

                    {/* 6. Preview Panel */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b">
                            <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-indigo-500" /> 실시간 프리뷰
                            </h4>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { setPreviewDevice('pc'); setShowPreview(true); }}
                                    className={`flex items-center gap-1 px-3 py-1 text-[10px] rounded-lg font-bold transition-colors ${
                                        showPreview && previewDevice === 'pc'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-500 border hover:bg-gray-50'
                                    }`}
                                >
                                    <Monitor className="w-3 h-3" /> PC
                                </button>
                                <button
                                    onClick={() => { setPreviewDevice('mobile'); setShowPreview(true); }}
                                    className={`flex items-center gap-1 px-3 py-1 text-[10px] rounded-lg font-bold transition-colors ${
                                        showPreview && previewDevice === 'mobile'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-white text-gray-500 border hover:bg-gray-50'
                                    }`}
                                >
                                    <Smartphone className="w-3 h-3" /> 모바일
                                </button>
                                {showPreview && (
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="ml-1 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-600"
                                    >
                                        닫기
                                    </button>
                                )}
                            </div>
                        </div>

                        {showPreview && (
                            <div
                                className="relative bg-gradient-to-b from-gray-200 to-gray-300 overflow-auto"
                                style={{
                                    height: previewDevice === 'mobile' ? '500px' : '400px',
                                    maxWidth: previewDevice === 'mobile' ? '375px' : '100%',
                                    margin: previewDevice === 'mobile' ? '0 auto' : undefined,
                                }}
                            >
                                <div className="absolute inset-0 flex items-start justify-center pt-4 text-gray-400 text-xs select-none pointer-events-none">
                                    {previewDevice === 'mobile' ? '📱 모바일 프리뷰' : '🖥️ PC 프리뷰'}
                                </div>
                                <PopupContainer
                                    config={popupConfig}
                                    landingId="preview"
                                    isPreview={true}
                                    forceMobile={previewDevice === 'mobile'}
                                />
                            </div>
                        )}

                        {!showPreview && (
                            <div className="p-6 text-center text-gray-400 text-xs">
                                PC 또는 모바일 버튼을 눌러 프리뷰를 확인하세요.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default PopupEditor;
