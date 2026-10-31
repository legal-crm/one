// ============================================================
// 영업 리드 퀵 문자 (CL-0 정리 뒤 남은 부분)
// 이전: 휴대폰 앱이 직접 쓰는 표(communication_logs·pending_sms·pending_calls)와 구글 드라이브 녹음 업로드를 썼으나
//       그 표는 운영 DB에 없어 늘 실패했다. 통화·문자 기록과 업무폰 명령은 services/comm/commService.ts로 옮겼다.
// ============================================================

/** 전화번호 정규화 (숫자만) */
export const normalizePhoneNumber = (phone: string): string => (phone || '').replace(/[^0-9]/g, '');

/**
 * 퀵 문자: 문구를 클립보드에 복사한다. 실제 발송은 담당자가 직접(또는 사건·리드 화면의 '업무폰으로 문자').
 * (자동 발송된 것처럼 안내하지 않는다)
 */
export const sendQuickSmsOrCopy = async (
  _phoneNumber: string,
  content: string,
): Promise<{ sent: boolean; copied: boolean; message: string }> => {
  let copied = false;
  try {
    await navigator.clipboard.writeText(content);
    copied = true;
  } catch {
    copied = false;
  }
  return {
    sent: false,
    copied,
    message: copied
      ? '문구를 복사했어요. 휴대폰 문자나 카카오톡에 붙여 넣어 보내 주세요. 업무폰을 연결했다면 \'소통 기록\'에서 바로 보낼 수 있어요.'
      : '복사하지 못했어요. 문구를 직접 선택해 복사해 주세요.',
  };
};
