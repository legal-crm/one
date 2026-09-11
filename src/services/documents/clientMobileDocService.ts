/**
 * 의뢰인 모바일 서식 자가작성 및 전자서명 연동 서비스
 * 알림톡/문자 발송 ➔ 모바일 웹 작성 ➔ 전자서명 ➔ CRM 자동 접수 및 전자소송 슬롯 연계
 */

export interface MobileDocRequestItem {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  docCode: string;
  docTitle: string;
  status: 'PENDING' | 'SUBMITTED' | 'VERIFIED';
  requestedAt: string;
  completedAt?: string;
  token: string;
  // 의뢰인이 모바일에서 직접 입력한 진술 필드
  formData?: Record<string, any>;
  signatureDataUrl?: string;
}

const STORAGE_KEY = 'LEGAL_CRM_MOBILE_DOC_REQUESTS';

export class ClientMobileDocService {
  /**
   * 저장소에서 요청 목록 조회
   */
  static getRequests(clientId?: string): MobileDocRequestItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const list: MobileDocRequestItem[] = JSON.parse(raw);
      if (clientId) {
        return list.filter(item => item.clientId === clientId);
      }
      return list;
    } catch {
      return [];
    }
  }

  /**
   * 새 모바일 작성 요청 생성 (알림톡 발송용)
   */
  static createRequest(
    clientId: string,
    clientName: string,
    clientPhone: string,
    docCode: string,
    docTitle: string
  ): MobileDocRequestItem {
    const list = this.getRequests();
    const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const newReq: MobileDocRequestItem = {
      id: `mreq-${Date.now()}`,
      clientId,
      clientName,
      clientPhone,
      docCode,
      docTitle,
      status: 'PENDING',
      requestedAt: new Date().toISOString(),
      token
    };

    list.unshift(newReq);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return newReq;
  }

  /**
   * 토큰으로 요청 단건 조회
   */
  static getRequestByToken(token: string): MobileDocRequestItem | null {
    const list = this.getRequests();
    return list.find(r => r.token === token) || null;
  }

  /**
   * 의뢰인이 모바일에서 작성 완료 및 서명 제출
   */
  static submitMobileDoc(
    token: string,
    formData: Record<string, any>,
    signatureDataUrl: string
  ): boolean {
    const list = this.getRequests();
    const idx = list.findIndex(r => r.token === token);
    if (idx === -1) return false;

    list[idx] = {
      ...list[idx],
      status: 'SUBMITTED',
      completedAt: new Date().toISOString(),
      formData,
      signatureDataUrl
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  }

  /**
   * 카카오톡 알림톡/문자 안내 문구 생성
   */
  static generateNotificationMessage(req: MobileDocRequestItem, lawfirmName: string = '법무법인 리걸케어'): string {
    return `[${lawfirmName} 법원 전자소송 서류 작성 안내]

안녕하세요, ${req.clientName} 님.
진행 중이신 법원 사건의 원활한 접수를 위해 [${req.docTitle}] 작성이 필요합니다.

아래 모바일 전용 보안 링크에 접속하시어 간단한 사실관계 확인 후 자필 전자서명을 완료해주시기 바랍니다.

▶ 모바일 간편 작성 링크:
https://legal-crm.kr/mobile-doc?token=${req.token}

※ 본 링크는 본인 인증용 암호화 링크이며 타인에게 양도할 수 없습니다.
※ 문의: ${lawfirmName} 담당 변호사 사무실`;
  }
}
