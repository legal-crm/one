import { secureGetItem } from '../../utils/secureStorage';
import type { IncomeExpenseD5103Data } from '../../types/incomeExpenseTypes';
import { ClientPropertyService } from '../../services/documents/clientPropertyService';

/**
 * 의뢰인이 작성하는 2차 서류(진술서·수지표·재산상황표)의 실제 작성 상태를 읽는다.
 * '작성 완료' 배지·진행률은 여기서 확인한 값으로만 표시한다(기본값을 '완료'로 두지 않기).
 */
export type DocProgress = 'none' | 'draft' | 'submitted';

/** 연동 대상(변호사 CRM)이 없을 때 이 기기에 저장한 수지표 */
export function loadLocalD5103(clientId?: string | null): IncomeExpenseD5103Data | null {
  if (!clientId) return null;
  try {
    const raw = secureGetItem(`legal_crm_d5103_${clientId}`);
    return raw ? (JSON.parse(raw) as IncomeExpenseD5103Data) : null;
  } catch {
    return null;
  }
}

export function getIncomeExpenseProgress(d5103?: IncomeExpenseD5103Data | null): DocProgress {
  if (!d5103) return 'none';
  if (d5103.d5103ClientStatus === 'client_submitted' || d5103.d5103ClientSubmittedAt) return 'submitted';
  return d5103.lastSavedAt ? 'draft' : 'none';
}

/** StatementService가 저장하는 진술서(legal_crm_statement_{clientId}) */
export function getStatementProgress(clientId?: string | null): DocProgress {
  if (!clientId) return 'none';
  try {
    const raw = secureGetItem(`legal_crm_statement_${clientId}`);
    if (!raw) return 'none';
    const s = JSON.parse(raw);
    if (s?.status === 'client_completed' || s?.deliveredToLawyerAt) return 'submitted';
    const story = s?.story || {};
    const hasContent = Boolean(story.rawCustomerNotes || story.voiceTranscript || story.aiDraftStatement || (story.initialCauseKeywords || []).length);
    return hasContent ? 'draft' : 'none';
  } catch {
    return 'none';
  }
}

/** 재산상황표는 변호사에게 제출(또는 검토 완료)했을 때만 '완료'로 본다 */
export function getPropertyProgress(clientId?: string | null, clientName?: string): DocProgress {
  if (!clientId) return 'none';
  try {
    const data = ClientPropertyService.loadClientData(clientId, clientName || '');
    const status = data?.clientIntakeStatus;
    return status === 'submitted_to_lawyer' || status === 'reviewed_by_lawyer' ? 'submitted' : 'none';
  } catch {
    return 'none';
  }
}
