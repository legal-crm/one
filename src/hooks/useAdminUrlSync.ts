import { useEffect, useRef } from 'react';

export type LawyerTabType =
  | 'dashboard'
  | 'chat'
  | 'cases'
  | 'billing'
  | 'client-crm'
  | 'sales-leads'
  | 'case-copilot'
  | 'staff-management'
  | 'settings'
  | 'qna-answer'
  | 'tasks-schedule'
  | 'inquiry-to-admin'
  | 'contracts'
  | 'fee-settlement'
  | 'requests';

export interface UseAdminUrlSyncOptions {
  activeTab: LawyerTabType;
  setActiveTab: (tab: LawyerTabType) => void;
  crmTargetClientId: string;
  setCrmTargetClientId: (id: string) => void;
  crmTargetDetailTab: string;
  setCrmTargetDetailTab: (tab: any) => void;
  isLoggedIn: boolean;
}

/**
 * 어드민 URL 상태 동기화 및 뒤로가기 복원 훅 (기획서 Phase 1-6 & 3.6)
 * - URL search params (tab, caseId, stage)와 어드민 뷰 상태를 양방향 동기화
 * - 새로고침, 뒤로가기, 링크 공유 시 정확한 탭 및 사건·단계로 복원
 */
export function useAdminUrlSync({
  activeTab,
  setActiveTab,
  crmTargetClientId,
  setCrmTargetClientId,
  crmTargetDetailTab,
  setCrmTargetDetailTab,
  isLoggedIn,
}: UseAdminUrlSyncOptions) {
  const isPopStateRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // 1) 초기 마운트 시 URL search params에서 tab, caseId, stage 복원
  useEffect(() => {
    if (!isLoggedIn) return;

    try {
      const params = new URLSearchParams(window.location.search);
      const urlTab = (params.get('tab') || params.get('view')) as LawyerTabType | null;
      const urlCaseId = params.get('caseId') || params.get('case') || params.get('client');
      const urlStage = params.get('stage') || params.get('detailTab');

      if (urlTab && urlTab !== activeTab) {
        setActiveTab(urlTab);
      }
      if (urlCaseId) {
        setCrmTargetClientId(urlCaseId);
      }
      if (urlStage) {
        setCrmTargetDetailTab(urlStage);
      }

      // 초기 상태 history에 등록 (뒤로가기 가드 포함)
      window.history.replaceState(
        {
          lawyerTab: urlTab || activeTab,
          caseId: urlCaseId || '',
          stage: urlStage || 'info',
          guard: true,
        },
        ''
      );
    } catch (e) {
      console.error('[useAdminUrlSync] Initial restore error:', e);
    }
  }, [isLoggedIn]);

  // 2) popstate 리스너: 브라우저 뒤로가기 / 앞으로가기 처리
  useEffect(() => {
    if (!isLoggedIn) return;

    const handlePopState = (event: PopStateEvent) => {
      isPopStateRef.current = true;
      try {
        const state = event.state;
        const params = new URLSearchParams(window.location.search);
        const targetTab = (state?.lawyerTab || params.get('tab') || params.get('view') || 'dashboard') as LawyerTabType;
        const targetCaseId = state?.caseId ?? (params.get('caseId') || params.get('case') || '');
        const targetStage = state?.stage ?? (params.get('stage') || params.get('detailTab') || 'info');

        setActiveTab(targetTab);
        setCrmTargetClientId(targetCaseId);
        setCrmTargetDetailTab(targetStage);

        if (!state) {
          // 상태가 없으면 dashboard로 복귀 + guard 재설치
          window.history.pushState(
            { lawyerTab: 'dashboard', caseId: '', stage: 'info', guard: true },
            ''
          );
        }
      } catch (e) {
        console.error('[useAdminUrlSync] popstate handle error:', e);
      } finally {
        setTimeout(() => {
          isPopStateRef.current = false;
        }, 50);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn, setActiveTab, setCrmTargetClientId, setCrmTargetDetailTab]);

  // 3) 상태 변경 시 URL search params 및 history.pushState 동기화
  useEffect(() => {
    if (!isLoggedIn) return;

    // 첫 마운트 실행 시 URL 덮어쓰기 방지
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (isPopStateRef.current) return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('role', 'lawyer');

      if (activeTab === 'dashboard') {
        url.searchParams.delete('tab');
        url.searchParams.delete('view');
        url.searchParams.delete('caseId');
        url.searchParams.delete('case');
        url.searchParams.delete('stage');
        url.searchParams.delete('detailTab');
      } else {
        url.searchParams.set('tab', activeTab);
        if (activeTab === 'client-crm' && crmTargetClientId) {
          url.searchParams.set('caseId', crmTargetClientId);
          if (crmTargetDetailTab && crmTargetDetailTab !== 'info') {
            url.searchParams.set('stage', crmTargetDetailTab);
          } else {
            url.searchParams.delete('stage');
          }
        } else {
          url.searchParams.delete('caseId');
          url.searchParams.delete('case');
          url.searchParams.delete('stage');
          url.searchParams.delete('detailTab');
        }
      }

      const currentState = window.history.state;
      const isSameTab = currentState?.lawyerTab === activeTab;
      const isSameCase = (currentState?.caseId || '') === (crmTargetClientId || '');
      const isSameStage = (currentState?.stage || 'info') === (crmTargetDetailTab || 'info');

      if (!isSameTab || !isSameCase || !isSameStage) {
        window.history.pushState(
          {
            lawyerTab: activeTab,
            caseId: crmTargetClientId || '',
            stage: crmTargetDetailTab || 'info',
          },
          '',
          url.toString()
        );
      }
    } catch (e) {
      console.error('[useAdminUrlSync] pushState error:', e);
    }
  }, [activeTab, crmTargetClientId, crmTargetDetailTab, isLoggedIn]);
}
