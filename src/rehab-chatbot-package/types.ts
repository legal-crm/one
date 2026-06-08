import { RehabPolicyConfig } from './config/PolicyConfig';

export interface RehabChatConfig {
  isEnabled: boolean;
  hideFloatingButton?: boolean; // New: Hide default floating button
  displayMode: 'popup' | 'embedded' | 'floating';
  buttonText: string;
  buttonPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  buttonColor?: string;
  buttonBackgroundImage?: string; // New: Custom Image Background
  characterName?: string;  // AI 캐릭터 이름 (기본: 로이)
  characterImage?: string; // AI 캐릭터 이미지 URL

  // 챗봇 템플릿 설정
  templateId?: 'classic' | 'messenger' | 'minimal' | 'gradient' | 'bot' | 'sidebar' | 'modern' | 'bubble' | 'corporate' | 'neon';
  themeMode?: 'light' | 'dark';
  customColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    headerText?: string;
    userText?: string;
    botText?: string;
  };
  chatFontFamily?: string; // 채팅창 폰트
  enableFormBlocks?: boolean; // 모든 템플릿에서 Interactive Block 활성화

  // Interactive Block 프리셋 설정
  interactiveBlockPreset?: 'none' | 'basic' | 'advanced' | 'custom';
  interactiveBlockConfig?: {
    useContactForm?: boolean;   // 연락처 입력을 폼 블록으로
    useDatePicker?: boolean;    // 날짜 관련 질문에 날짜 선택기
    useMultiSelect?: boolean;   // 재산 선택 등에 다중 선택 UI
  };

  // 인트로 설정
  introConfig?: {
    useIntro: boolean;
    mediaType: 'image' | 'youtube';
    mediaUrl: string;
    message?: string;
  };

  // 버튼 스타일링
  buttonStyle?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;      // e.g., '8px', '9999px' (pill)
    fontSize?: string;          // e.g., '14px', '16px'
    fontWeight?: string;        // e.g., 'normal', 'bold', '600'
    fontFamily?: string;        // e.g., 'Noto Sans KR', 'Pretendard'
    padding?: string;           // e.g., '12px 24px'
    boxShadow?: string;         // e.g., '0 4px 12px rgba(0,0,0,0.2)'
    borderWidth?: string;
    borderColor?: string;
    icon?: 'sparkles' | 'calculator' | 'chat' | 'none';
    iconPosition?: 'left' | 'right';
    buttonSize?: 'sm' | 'md' | 'lg' | 'xl';
    mobileSize?: 'sm' | 'md' | 'lg' | 'xl';
    pcSize?: 'sm' | 'md' | 'lg' | 'xl';
  };

  // 삽입 위치 옵션
  placement?: {
    showInHero?: boolean;           // 히어로 섹션에 표시
    showInPopup?: boolean;          // 팝업에 표시
    showInTopBanner?: boolean;      // 상단 고정 배너에 표시
    showInBottomBanner?: boolean;   // 하단 고정 배너에 표시
    showAsFloating?: boolean;       // 플로팅 버튼으로 표시
  };
}

export interface GlobalSettings {
  adminPassword?: string;
  githubToken?: string;
  imgbbApiKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  geminiApiKey?: string;
  rehabChatConfig?: RehabChatConfig;
  rehabPolicyConfigs?: Record<number, RehabPolicyConfig>;
  adminUsers?: Array<{ email: string, name: string, memo: string }>;
}
