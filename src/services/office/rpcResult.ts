// 서버 함수(RPC) 결과 공통 형태 — 실패를 조용히 숨기지 않고 화면에 보일 문장으로 돌려준다 (연동 원칙 4)
import type { PostgrestError } from '@supabase/supabase-js';

// (이 프로젝트 tsconfig는 strict 가 아니라 판별 유니온 좁히기가 안 되므로, 양쪽에 같은 이름의 선택 칸을 둔다)
export type RpcResult<T> =
  | { ok: true; data: T; code?: undefined; message?: undefined }
  | { ok: false; code: string; message: string; data?: undefined };

const MESSAGE_RULES: Array<[RegExp, string]> = [
  // 카카오톡 안내·대화 백업·PC 묶음 (KT-2·KT-4·KT-8)
  [/notice already handled/i, '이미 처리한 안내예요. 새로고침해 주세요.'],
  [/fallback alimtalk is being sent/i, '기한이 지나 알림톡으로 대신 보내는 중이에요. 잠시 뒤 다시 확인해 주세요.'],
  [/resident registration number not allowed/i, '주민등록번호 형식이 들어 있어 보낼 수 없어요. 번호를 지우고 다시 시도해 주세요.'],
  [/title and body required/i, '안내 제목과 내용을 확인해 주세요.'],
  [/too many notices today/i, '오늘 만들 수 있는 안내 할 일 수를 넘었어요.'],
  [/file too large \(10MB\)/i, '파일이 너무 커요. 10MB 이하만 올릴 수 있어요.'],
  [/too many uploads today/i, '오늘 올릴 수 있는 대화 파일 수(30개)를 넘었어요.'],
  [/file fingerprint mismatch/i, '올린 파일의 지문이 서버 파일과 달라요. 원본 파일을 다시 올려 주세요.'],
  [/file not stored yet/i, '파일 저장 확인이 아직 끝나지 않았어요. 잠시 뒤 다시 시도해 주세요.'],
  [/choose the client name/i, '대화에서 의뢰인 이름을 골라 주세요.'],
  [/too many lines in one call/i, '한 번에 넣을 수 있는 줄 수를 넘었어요.'],
  [/acknowledgement required to enable PC KakaoTalk batch/i, 'PC 카톡 묶음 발송을 켜려면 [운영자 판단] 안내를 확인해 주세요.'],
  [/PC KakaoTalk batch is off/i, 'PC 카톡 묶음 발송이 꺼져 있어요. 설정 › 업무폰에서 켤 수 있어요.'],
  [/at most 30 rows at once/i, '한 번에 30줄까지 올릴 수 있어요.'],
  [/cannot offboard owner/i, '대표는 퇴사 처리할 수 없어요.'],
  [/already left/i, '이미 퇴사 처리된 구성원이에요.'],
  [/handover member must be an active member/i, '일을 넘겨받을 사람은 지금 사용 중인 다른 구성원이어야 해요.'],
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
  [/too many open pairing codes/i, '아직 쓰지 않은 연결 코드가 3개 있어요. 10분 뒤 다시 만들어 주세요.'],
  [/device limit reached/i, '한 사람당 업무폰은 3대까지 연결할 수 있어요. 쓰지 않는 기기를 먼저 해지해 주세요.'],
  [/device is not waiting for approval/i, '승인 대기 중인 기기가 아니에요.'],
  [/app sms disabled/i, '사무소 정책에서 업무폰 문자 보내기가 꺼져 있어요. 사무소 설정 › 업무폰에서 켤 수 있어요.'],
  [/quiet hours/i, '지금은 문자 발송 금지 시간이에요. 사무소 정책의 발송 가능 시간에 다시 보내 주세요.'],
  [/daily sms limit/i, '오늘 이 업무폰으로 보낼 수 있는 문자 수를 다 썼어요.'],
  [/too many waiting commands/i, '업무폰이 아직 받지 않은 요청이 많아요. 휴대폰에서 마이김변 업무폰 앱을 열어 주세요.'],
  [/device not available/i, '내 업무폰이 연결돼 있지 않거나 승인 전이에요.'],
  [/invalid phone/i, '전화번호를 확인해 주세요. 숫자 8~12자리여야 해요.'],
  [/too many contacts/i, '한 사건에 번호는 10개까지 등록할 수 있어요.'],
  [/unsupported audio type/i, '녹음 파일 형식을 지원하지 않아요. m4a·mp3·amr·wav 파일을 올려 주세요.'],
  [/file too large/i, '파일이 너무 커요. 50MB 이하만 올릴 수 있어요.'],
  [/recording not available/i, '이 녹음을 들을 권한이 없거나 아직 확인 중이에요.'],
  [/too many uploads in progress/i, '올리는 중인 녹음이 많아요. 잠시 뒤 다시 시도해 주세요.'],
  [/request already handled/i, '이미 처리한 요청이에요.'],
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
