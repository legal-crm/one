import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProposalDraftState {
  totalFeeStr: string;
  downPaymentStr: string;
  installments: number;
  courtDepositStr: string;
  feeMemo: string;
  lawyerOpinion: string;
  specialNotes: string[];
  clientAnswers: Record<number, string>;
  includeFinancialAnalysis: boolean;
  includeRiskReport: boolean;
  includeCourtNotes: boolean;
}

export function useProposalDraft(clientId: string) {
  const getStorageKey = useCallback(() => `proposal-draft-${clientId}`, [clientId]);
  
  const [savedDraft, setSavedDraft] = useState<ProposalDraftState | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.state) {
          setSavedDraft(parsed.state);
        }
        if (parsed.savedAt) {
          setLastSavedAt(parsed.savedAt);
        }
      }
    } catch (e) {
      console.error('Failed to load proposal draft:', e);
    }
  }, [getStorageKey]);

  // Save instantly
  const saveDraft = useCallback((state: ProposalDraftState) => {
    try {
      const now = new Date().toISOString();
      const dataToSave = {
        state,
        savedAt: now,
      };
      localStorage.setItem(getStorageKey(), JSON.stringify(dataToSave));
      setSavedDraft(state);
      setLastSavedAt(now);
      setIsDirty(false);
    } catch (e) {
      console.error('Failed to save proposal draft:', e);
    }
  }, [getStorageKey]);

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey());
      setSavedDraft(null);
      setLastSavedAt(null);
      setIsDirty(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    } catch (e) {
      console.error('Failed to clear proposal draft:', e);
    }
  }, [getStorageKey]);

  // Schedule auto-save
  const scheduleAutoSave = useCallback((state: ProposalDraftState) => {
    setIsDirty(true);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      saveDraft(state);
    }, 5000); // 5-second debounce
  }, [saveDraft]);

  return {
    savedDraft,
    saveDraft,
    clearDraft,
    scheduleAutoSave,
    lastSavedAt,
    isDirty
  };
}
