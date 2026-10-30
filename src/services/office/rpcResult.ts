// 서버 함수(RPC) 결과 공통 형태 — 실패를 조용히 숨기지 않고 화면에 보일 문장으로 돌려준다 (연동 원칙 4)
import type { PostgrestError } from '@supabase/supabase-js';

// (이 프로젝트 tsconfig는 strict 가 아니라 판별 유니온 좁히기가 안 되므로, 양쪽에 같은 이름의 선택 칸을 둔다)
export type RpcResult<T> =
  | { ok: true; data: T; code?: undefined; message?: undefined }
  | { ok: false; code: string; message: string; data?: undefined };

const MESSAGE_RULES: Array<[RegExp, string]> = [
  [/permission denied|not an office member/i, '이 작업을 할 권한이 없어요. 사무소 대표에게 권한을 확인해 주세요.'],
  [/authentication required/i, '로그인이 필요해요. 다시 로그인해 주세요.'],
  [/version conflict/i, '다른 사람이 먼저 고쳤어요. 새로 불러온 뒤 다시 저장해 주세요.'],
  [/resident registration numbers/i, '주민등록번호는 저장하지 않아요. 출력할 때만 입력해 주세요.'],
  [/invite expired|no longer valid/i, '초대 링크 유효기간이 지났어요. 새 초대를 요청해 주세요.'],
  [/invite already used/i, '이미 사용한 초대 링크예요.'],
  [/invalid invite/i, '초대 링크를 확인하지 못했어요. 주소를 다시 확인해 주세요.'],
  [/restricted to another email/i, '이 초대는 다른 이메일 계정용이에요. 초대받은 이메일로 로그인해 주세요.'],
  [/cannot accept own office invite/i, '내 사무소 초대는 수락할 수 없어요.'],
  [/lawyer role requires a verified lawyer account/i, '담당 변호사 역할은 마이김변 승인을 받은 변호사 계정만 받을 수 있어요.'],
  [/lawyer-only permission/i, '변호사 전용 권한은 바꿀 수 없어요.'],
  [/owner cannot be changed/i, '대표의 역할은 바꿀 수 없어요.'],
  [/case already exists for this consult request/i, '이 상담 요청으로 이미 사건을 만들었어요.'],
  [/consult request is not addressed to this office/i, '우리 사무소에 온 상담 요청이 아니에요.'],
  [/case_number and court_name required/i, '사건번호와 법원을 모두 입력해 주세요.'],
  [/date required|decision date required/i, '결정일(날짜)을 입력해 주세요.'],
  [/reason required/i, '사유를 입력해 주세요.'],
  [/invalid close reason/i, '종결 사유를 골라 주세요.'],
  [/case is closed/i, '종결된 사건이에요. 다시 열기를 먼저 해 주세요.'],
  [/only owner or assigned lawyer/i, '대표 또는 담당 변호사만 할 수 있어요.'],
  [/rehab case|bankruptcy case/i, '이 사건 유형에는 쓸 수 없는 기록이에요.'],
  [/restore window passed/i, '휴지통 보관 기간(30일)이 지나 복구할 수 없어요.'],
  [/already linked/i, '이미 회원 계정과 연결된 의뢰인이에요.'],
  [/office accounts cannot be linked as clients/i, '변호사·직원 계정으로는 의뢰인 연결을 할 수 없어요. 의뢰인 본인 계정으로 로그인해 주세요.'],
  [/not found/i, '대상을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.'],
];

export function rpcErrorMessage(error: Pick<PostgrestError, 'message' | 'code'> | { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message || '';
  for (const [re, text] of MESSAGE_RULES) if (re.test(msg)) return text;
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
  return '처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function toRpcError<T>(error: { message?: string; code?: string } | null | undefined): RpcResult<T> {
  return { ok: false, code: error?.code || 'unknown', message: rpcErrorMessage(error) };
}

export const NOT_CONFIGURED: RpcResult<never> = { ok: false, code: 'not_configured', message: '서버 설정이 없어 저장할 수 없어요.' };
