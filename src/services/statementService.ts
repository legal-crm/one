import type { 
  CourtStatementData, 
  CourtStatementCaseType, 
  JobHistoryItem,
  PastCourtHistory,
  ResidenceDetail,
  DebtGrowthStory
} from '../types/statementTypes';
import { secureGetItem, secureSetItem } from '../utils/secureStorage';
import { loadCrmData, saveCrmClient } from './crmService';

const STATEMENT_STORAGE_KEY_PREFIX = 'legal_crm_statement_';

export class StatementService {
  /**
   * 저장소 키 생성
   */
  private static getKey(clientId: string): string {
    return `${STATEMENT_STORAGE_KEY_PREFIX}${clientId}`;
  }

  /**
   * 진술서 조회 (로컬 스토리지 또는 CRM 연동)
   */
  static async loadStatement(
    clientId: string,
    caseType: CourtStatementCaseType = 'rehab',
    clientName = '신청인',
    initialData?: Partial<CourtStatementData>
  ): Promise<CourtStatementData> {
    try {
      const raw = secureGetItem(this.getKey(clientId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.id) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[StatementService] Load failed from storage', e);
    }

    // CRM 데이터에서 기존 진술서 확인
    try {
      const crmStore = await loadCrmData();
      const ext = crmStore[clientId];
      if (ext?.courtStatement) {
        return ext.courtStatement;
      }
    } catch {
      // ignore
    }

    // 신규 기본 진술서 모델 생성
    return this.createDefaultStatement(clientId, caseType, clientName, initialData);
  }

  /**
   * 기본 진술서 템플릿 모델 생성
   */
  static createDefaultStatement(
    clientId: string,
    caseType: CourtStatementCaseType,
    clientName: string,
    initialData?: Partial<CourtStatementData>
  ): CourtStatementData {
    return {
      id: `stmt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      clientId,
      caseType,
      // 법원 제출 문서이므로 가짜 기본값(주민번호·주소·보증금·경력 등)을 채우지 않는다 — 미입력은 빈 값
      // 관할 법원을 모르면 비워 둔다(이전: '서울회생법원'을 기본으로 넣어 인쇄본에 그대로 찍힘)
      courtName: initialData?.courtName || '',
      applicantName: clientName,
      applicantRrnMasked: initialData?.applicantRrnMasked || '',
      applicantPhone: initialData?.applicantPhone || '',
      applicantAddress: initialData?.applicantAddress || '',
      finalEducation: initialData?.finalEducation || '',
      jobHistories: initialData?.jobHistories && initialData.jobHistories.length > 0 
        ? initialData.jobHistories 
        : [
            { period: '', companyName: '', position: '', reasonForLeaving: '' }
          ],
      pastHistory: initialData?.pastHistory || {
        hasPastCase: false
      },
      // 주거 형태도 선택 전에는 비워 둔다(이전: '임차(월세)'·보증금 0원이 신청인이 고른 값처럼 표시됨)
      residence: initialData?.residence || {
        residenceType: '' as unknown as ResidenceDetail['residenceType'],
        residenceTypeLabel: '',
        deposit: 0,
        monthlyRent: 0,
        ownerName: '',
        ownerRelation: ''
      },
      story: initialData?.story || {
        initialCauseKeywords: [],
        initialCauseDetail: '',
        growthProcessDetail: '',
        insolvencyTriggerDetail: '',
        resolutionAndApology: ''
      },
      bankruptcyScreening: caseType === 'bankruptcy' ? {
        gamblingOrSpeculation: false,
        fraudulentLoan: false,
        preferentialPayment: false,
        concealmentOfAssets: false,
        falseCreditorList: false,
        pastDischargeWithinYears: false,
        falseReportToTrustee: false,
        creditTransactionBeforeFiling: false
      } : undefined,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * 진술서 임시 저장
   */
  static async saveStatement(statement: CourtStatementData): Promise<void> {
    statement.updatedAt = new Date().toISOString();
    secureSetItem(this.getKey(statement.clientId), JSON.stringify(statement));

    // CRM에도 비동기 동기화
    try {
      const crmStore = await loadCrmData();
      const ext = crmStore[statement.clientId];
      if (ext) {
        ext.courtStatement = statement;
        await saveCrmClient(statement.clientId, ext);
      }
    } catch (e) {
      console.warn('[StatementService] CRM sync failed on temp save', e);
    }
  }

  /**
   * 변호사에게 최종 제출 & 서류철 자동 첨부
   */
  static async deliverStatementToLawyer(statement: CourtStatementData): Promise<{ ok: boolean; message: string }> {
    statement.status = 'client_completed';
    statement.deliveredToLawyerAt = new Date().toISOString();
    statement.updatedAt = new Date().toISOString();

    // 1. 로컬 저장
    secureSetItem(this.getKey(statement.clientId), JSON.stringify(statement));

    // 2. CRM 확장 데이터 동기화 및 가상 첨부파일 생성
    try {
      const crmStore = await loadCrmData();
      let ext = crmStore[statement.clientId];
      if (!ext) {
        ext = {
          crmStatus: 'document',
          documents: [],
          notes: [],
          activities: [],
          lastActivityAt: new Date().toISOString()
        };
      }

      ext.courtStatement = statement;

      // 활동 로그 추가
      const isRehab = statement.caseType === 'rehab';
      ext.activities.unshift({
        id: `act-stmt-${Date.now()}`,
        type: 'status_change',
        clientId: statement.clientId,
        actorId: 'client',
        actorRole: 'CLIENT',
        actorName: `${statement.applicantName} (의뢰인)`,
        description: `[서류제출] 법원 제출용 ${isRehab ? '개인회생' : '개인파산'} 진술서 작성 완료 — 의뢰인이 AI 스마트 진술서 작성을 완료하고 변호사 사무실로 자동 전달하였습니다. (사유: ${statement.story.initialCauseKeywords.join(', ')})`,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      // 진술서는 구조화 데이터(ext.courtStatement)로 전달한다.
      // (이전: 열리지 않는 가짜 PDF를 첨부하고, 이름에 '진술서'가 들어간 기존 업로드 파일을 모두 삭제하던 로직 제거)
      const synced = await saveCrmClient(statement.clientId, ext);
      if (!synced) {
        return {
          ok: false,
          message: '진술서는 이 기기에 저장되었지만 서버 전송에 실패했습니다. 네트워크 확인 후 다시 제출해 주세요.'
        };
      }

      return {
        ok: true,
        message: '진술서를 담당 변호사 사건 기록에 저장했습니다. 변호사가 검토 후 법원 제출용으로 확정합니다.'
      };
    } catch (e: any) {
      console.warn('[StatementService] CRM deliver error', e);
      return {
        ok: false,
        message: '진술서는 이 기기에 저장되었지만 변호사에게 전달하지 못했습니다. 잠시 후 다시 제출해 주세요.'
      };
    }
  }
}
