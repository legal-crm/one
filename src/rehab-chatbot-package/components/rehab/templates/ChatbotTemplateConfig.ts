/**
 * AI 챗봇 템플릿 시스템 설정
 * 
 * 10가지 디자인 템플릿과 색상/다크모드 옵션 정의
 */

// 템플릿 ID 타입
export type ChatbotTemplateId =
    | 'classic'
    | 'messenger'
    | 'minimal'
    | 'gradient'
    | 'bot'
    | 'sidebar'
    | 'modern'
    | 'bubble'
    | 'corporate'
    | 'neon';

// 색상 팔레트 타입
export interface ChatbotColorPalette {
    primary: string;      // 헤더, 사용자 메시지
    secondary: string;    // 봇 메시지
    accent: string;       // 버튼 호버, CTA
    headerText: string;   // 헤더 텍스트
    userText: string;     // 사용자 메시지 텍스트
    botText: string;      // 봇 메시지 텍스트
}

// 레이아웃 설정 타입 (디자인 기획서 기반)
export interface TemplateLayoutConfig {
    // 기본 레이아웃
    headerHeight: number;           // 헤더 높이 (dp)
    messageGap: number;             // 메시지 간 간격 (dp)
    bubbleRadius: number;           // 말풍선 라운드 (dp)
    bubblePadding: number;          // 말풍선 내부 패딩 (dp)
    bubbleMaxWidth: string;         // 말풍선 최대 폭 (%)
    composerInputRadius: number;    // 입력창 라운드 (dp)

    // 표시 옵션
    showAvatar: boolean;            // 아바타 표시 여부
    showBubbleTail: boolean;        // 말풍선 꼬리 표시 여부
    showSenderLabel: boolean;       // 발신자 라벨 표시 여부
    showHeaderBorder: boolean;      // 헤더 하단 구분선 표시
    groupConsecutiveMessages: boolean; // 연속 메시지 묶기

    // 시간 표시 위치
    timeStampPosition: 'inline' | 'below' | 'aside' | 'center';

    // 날짜 구분 스타일
    dateSeparatorStyle: 'sticky' | 'pill' | 'line';

    // 특수 레이아웃 플래그
    hasTimeline?: boolean;          // 03. 타임레일
    hasParticipantRail?: boolean;   // 07. 참여자 레일
    hasTabs?: boolean;              // 08. 탭 구조
    hasExpandPanel?: boolean;       // 06. 하단 확장 패널
    isFloatingWidget?: boolean;     // 09. 플로팅 위젯
    hasFormBlocks?: boolean;        // 10. 폼-혼합형
}

// ==================== Interactive Block 타입 (폼-혼합형) ====================

// Interactive Block 타입
export type InteractiveBlockType =
    | 'single_select'   // 단일 선택 (라디오)
    | 'multi_select'    // 다중 선택 (체크)
    | 'date_picker'     // 날짜 선택
    | 'contact_input'   // 연락처 입력 (전화/이메일)
    | 'cta_button';     // CTA 버튼

// Interactive Block 옵션
export interface InteractiveBlockOption {
    label: string;
    value: string | number;
    icon?: string;  // 아이콘 이모지 또는 아이콘 이름
}

// 연락처 입력 타입
export type ContactInputType = 'phone' | 'email' | 'both';

// Interactive Block 설정
export interface InteractiveBlockConfig {
    type: InteractiveBlockType;
    title: string;                          // 상단 안내 문구
    description?: string;                   // 부가 설명
    options?: InteractiveBlockOption[];     // 선택지 (single_select, multi_select)
    placeholder?: string;                   // 입력 필드 플레이스홀더
    buttonLabel?: string;                   // CTA/확인 버튼 텍스트
    cancelLabel?: string;                   // 취소 버튼 텍스트
    required?: boolean;                     // 필수 입력 여부
    contactType?: ContactInputType;         // 연락처 입력 타입
    minDate?: Date;                         // 날짜 선택 최소값
    maxDate?: Date;                         // 날짜 선택 최대값
    validationPattern?: string;             // 검증 패턴 (정규식)
    validationMessage?: string;             // 검증 실패 메시지
    includeName?: boolean;                  // 이름 입력 포함 여부 (contact_input)
}

// 블록 상태
export type InteractiveBlockStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'error';

export interface InteractiveBlockState {
    status: InteractiveBlockStatus;
    value?: string | string[] | Date;
    error?: string;
    submittedAt?: Date;
    summary?: string;  // 완료 시 요약 텍스트
}

// ==================== 테마 ====================

// 테마 모드
export type ThemeMode = 'light' | 'dark';

// 템플릿 설정
export interface ChatbotTemplateConfig {
    templateId: ChatbotTemplateId;
    mode: ThemeMode;
    colors: ChatbotColorPalette;
}

// 기본 색상 팔레트 (라이트 모드)
export const DEFAULT_LIGHT_PALETTE: ChatbotColorPalette = {
    primary: '#2563eb',
    secondary: '#f1f5f9',
    accent: '#3b82f6',
    headerText: '#ffffff',
    userText: '#ffffff',
    botText: '#1e293b'
};

// 기본 색상 팔레트 (다크 모드)
export const DEFAULT_DARK_PALETTE: ChatbotColorPalette = {
    primary: '#3b82f6',
    secondary: '#334155',
    accent: '#60a5fa',
    headerText: '#ffffff',
    userText: '#ffffff',
    botText: '#f1f5f9'
};

// 템플릿 정보
export interface TemplateInfo {
    id: ChatbotTemplateId;
    name: string;
    nameKo: string;
    description: string;
    designSpec: string;  // 디자인 기획서 번호/이름
    previewColors: {
        light: ChatbotColorPalette;
        dark: ChatbotColorPalette;
    };
    layoutConfig: TemplateLayoutConfig;
}

// 10가지 템플릿 정보 (디자인 기획서 기반)
export const CHATBOT_TEMPLATES: TemplateInfo[] = [
    {
        id: 'classic',
        name: 'Classic Card',
        nameKo: '클래식 카드형',
        description: '센터 카드 + 둥근 라운드 (웹 위젯, 고객센터 채팅)',
        designSpec: '01. 클래식 카드형',
        previewColors: {
            light: { primary: '#334155', secondary: '#f8fafc', accent: '#475569', headerText: '#fff', userText: '#fff', botText: '#1e293b' },
            dark: { primary: '#1e293b', secondary: '#334155', accent: '#64748b', headerText: '#fff', userText: '#fff', botText: '#e2e8f0' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 12,
            bubbleRadius: 14,
            bubblePadding: 12,
            bubbleMaxWidth: '80%',
            composerInputRadius: 20,
            showAvatar: true,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: true,
            groupConsecutiveMessages: false,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'sticky'
        }
    },
    {
        id: 'minimal',
        name: 'Minimal Premium',
        nameKo: '미니멀 프리미엄',
        description: '상단 고정 정보바 + 큰 여백 (의료/법률 상담)',
        designSpec: '02. 상단 고정 정보바 + 큰 여백형',
        previewColors: {
            light: { primary: '#18181b', secondary: '#fafafa', accent: '#27272a', headerText: '#fff', userText: '#fff', botText: '#18181b' },
            dark: { primary: '#fafafa', secondary: '#27272a', accent: '#d4d4d8', headerText: '#18181b', userText: '#18181b', botText: '#fafafa' }
        },
        layoutConfig: {
            headerHeight: 78,
            messageGap: 14,
            bubbleRadius: 12,
            bubblePadding: 16,
            bubbleMaxWidth: '75%',
            composerInputRadius: 12,
            showAvatar: false,
            showBubbleTail: false,
            showSenderLabel: true,
            showHeaderBorder: false,
            groupConsecutiveMessages: false,
            timeStampPosition: 'center',
            dateSeparatorStyle: 'pill'
        }
    },
    {
        id: 'corporate',
        name: 'Timeline',
        nameKo: '타임레일',
        description: '좌측 타임레일 + 말풍선 (상담 프로세스 시각화)',
        designSpec: '03. 좌측 타임레일',
        previewColors: {
            light: { primary: '#1e40af', secondary: '#eff6ff', accent: '#3b82f6', headerText: '#fff', userText: '#fff', botText: '#1e3a8a' },
            dark: { primary: '#1d4ed8', secondary: '#172554', accent: '#60a5fa', headerText: '#fff', userText: '#fff', botText: '#dbeafe' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 10,
            bubbleRadius: 12,
            bubblePadding: 12,
            bubbleMaxWidth: '70%',
            composerInputRadius: 16,
            showAvatar: false,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: true,
            groupConsecutiveMessages: false,
            timeStampPosition: 'aside',
            dateSeparatorStyle: 'line',
            hasTimeline: true
        }
    },
    {
        id: 'bubble',
        name: 'Bubble Tail',
        nameKo: '버블 꼬리형',
        description: '말풍선 꼬리 강조 (커뮤니티, 캐주얼 챗봇)',
        designSpec: '04. 버블 꼬리 강조형',
        previewColors: {
            light: { primary: '#ec4899', secondary: '#fdf2f8', accent: '#f472b6', headerText: '#fff', userText: '#fff', botText: '#831843' },
            dark: { primary: '#db2777', secondary: '#500724', accent: '#f472b6', headerText: '#fff', userText: '#fff', botText: '#fbcfe8' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 5,
            bubbleRadius: 20,
            bubblePadding: 12,
            bubbleMaxWidth: '78%',
            composerInputRadius: 24,
            showAvatar: true,
            showBubbleTail: true,
            showSenderLabel: true,
            showHeaderBorder: false,
            groupConsecutiveMessages: true,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'pill'
        }
    },
    {
        id: 'messenger',
        name: 'Compact Messenger',
        nameKo: '컴팩트 메신저',
        description: '밀도 높은 리스트 + 상단 검색 (업무용, 대화량 많음)',
        designSpec: '05. 컴팩트 리스트형',
        previewColors: {
            light: { primary: '#0ea5e9', secondary: '#e2e8f0', accent: '#0284c7', headerText: '#fff', userText: '#fff', botText: '#1e293b' },
            dark: { primary: '#0284c7', secondary: '#374151', accent: '#38bdf8', headerText: '#fff', userText: '#fff', botText: '#f3f4f6' }
        },
        layoutConfig: {
            headerHeight: 52,
            messageGap: 6,
            bubbleRadius: 12,
            bubblePadding: 10,
            bubbleMaxWidth: '72%',
            composerInputRadius: 16,
            showAvatar: false,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: true,
            groupConsecutiveMessages: true,
            timeStampPosition: 'aside',
            dateSeparatorStyle: 'sticky'
        }
    },
    {
        id: 'bot',
        name: 'Toolbar Panel',
        nameKo: '하단 툴바형',
        description: '하단 툴바 확장 (CS 상담, 첨부/템플릿 응답)',
        designSpec: '06. 하단 툴바 확장형',
        previewColors: {
            light: { primary: '#10b981', secondary: '#ecfdf5', accent: '#34d399', headerText: '#fff', userText: '#fff', botText: '#065f46' },
            dark: { primary: '#059669', secondary: '#064e3b', accent: '#6ee7b7', headerText: '#fff', userText: '#fff', botText: '#d1fae5' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 10,
            bubbleRadius: 16,
            bubblePadding: 14,
            bubbleMaxWidth: '78%',
            composerInputRadius: 20,
            showAvatar: true,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: true,
            groupConsecutiveMessages: false,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'sticky',
            hasExpandPanel: true
        }
    },
    {
        id: 'sidebar',
        name: 'Participant Rail',
        nameKo: '참여자 레일',
        description: '좌측 미니 프로필 레일 (상담사 전환, 팀 채팅)',
        designSpec: '07. 좌측 미니 프로필 레일',
        previewColors: {
            light: { primary: '#ef4444', secondary: '#fef2f2', accent: '#f87171', headerText: '#fff', userText: '#fff', botText: '#7f1d1d' },
            dark: { primary: '#dc2626', secondary: '#450a0a', accent: '#f87171', headerText: '#fff', userText: '#fff', botText: '#fecaca' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 10,
            bubbleRadius: 14,
            bubblePadding: 12,
            bubbleMaxWidth: '75%',
            composerInputRadius: 18,
            showAvatar: false,
            showBubbleTail: false,
            showSenderLabel: true,
            showHeaderBorder: true,
            groupConsecutiveMessages: false,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'sticky',
            hasParticipantRail: true
        }
    },
    {
        id: 'modern',
        name: 'Tab Header',
        nameKo: '헤더 탭형',
        description: 'FAQ/상담/내역 탭 구조 (앱 내 고객센터)',
        designSpec: '08. 헤더 탭형',
        previewColors: {
            light: { primary: '#6366f1', secondary: '#eef2ff', accent: '#818cf8', headerText: '#fff', userText: '#fff', botText: '#312e81' },
            dark: { primary: '#4f46e5', secondary: '#1e1b4b', accent: '#a5b4fc', headerText: '#fff', userText: '#fff', botText: '#e0e7ff' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 10,
            bubbleRadius: 14,
            bubblePadding: 12,
            bubbleMaxWidth: '78%',
            composerInputRadius: 18,
            showAvatar: true,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: false,
            groupConsecutiveMessages: false,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'pill',
            hasTabs: true
        }
    },
    {
        id: 'neon',
        name: 'Floating Widget',
        nameKo: '플로팅 위젯',
        description: '우하단 미니/확장 2단 상태 (웹 라이브챗)',
        designSpec: '09. 플로팅 위젯',
        previewColors: {
            light: { primary: '#06b6d4', secondary: '#ecfeff', accent: '#22d3ee', headerText: '#fff', userText: '#fff', botText: '#164e63' },
            dark: { primary: '#0891b2', secondary: '#0c0a09', accent: '#22d3ee', headerText: '#fff', userText: '#fff', botText: '#a5f3fc' }
        },
        layoutConfig: {
            headerHeight: 52,
            messageGap: 10,
            bubbleRadius: 14,
            bubblePadding: 12,
            bubbleMaxWidth: '80%',
            composerInputRadius: 18,
            showAvatar: true,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: true,
            groupConsecutiveMessages: false,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'sticky',
            isFloatingWidget: true
        }
    },
    {
        id: 'gradient',
        name: 'Form Hybrid',
        nameKo: '폼-혼합형',
        description: '대화 중간에 입력 폼/버튼 삽입 (예약/신청/설문)',
        designSpec: '10. 폼-혼합형',
        previewColors: {
            light: { primary: '#8b5cf6', secondary: '#fef3c7', accent: '#a78bfa', headerText: '#fff', userText: '#fff', botText: '#1e1b4b' },
            dark: { primary: '#7c3aed', secondary: '#1e1b4b', accent: '#a78bfa', headerText: '#fff', userText: '#fff', botText: '#ede9fe' }
        },
        layoutConfig: {
            headerHeight: 56,
            messageGap: 12,
            bubbleRadius: 16,
            bubblePadding: 14,
            bubbleMaxWidth: '80%',
            composerInputRadius: 20,
            showAvatar: true,
            showBubbleTail: false,
            showSenderLabel: false,
            showHeaderBorder: true,
            groupConsecutiveMessages: false,
            timeStampPosition: 'below',
            dateSeparatorStyle: 'pill',
            hasFormBlocks: true
        }
    }
];

// 템플릿 ID로 정보 가져오기
export const getTemplateById = (id: ChatbotTemplateId): TemplateInfo | undefined => {
    return CHATBOT_TEMPLATES.find(t => t.id === id);
};

// 기본 템플릿 설정
export const DEFAULT_TEMPLATE_CONFIG: ChatbotTemplateConfig = {
    templateId: 'classic',
    mode: 'dark',
    colors: DEFAULT_DARK_PALETTE
};
