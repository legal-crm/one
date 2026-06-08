import { GlobalSettings } from '../types';

/**
 * Dummy Google Sheet Service
 * 챗봇 이식 시 구글 시트 의존성 컴파일 에러를 방지하기 위한 가상 서비스입니다.
 * 실제 설정 로딩이 필요하지 않으면 null을 반환하여 기본 2026년 법원 정책(PolicyConfig)을 따르도록 합니다.
 */
export const fetchGlobalSettings = async (): Promise<GlobalSettings | null> => {
    return null;
};
