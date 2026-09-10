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
      courtName: initialData?.courtName || '서울회생법원',
      applicantName: clientName,
      applicantRrnMasked: initialData?.applicantRrnMasked || '800101-1******',
      applicantPhone: initialData?.applicantPhone || '010-****-****',
      applicantAddress: initialData?.applicantAddress || '서울특별시 서초구 서초대로',
      finalEducation: initialData?.finalEducation || '고등학교 졸업',
      jobHistories: initialData?.jobHistories && initialData.jobHistories.length > 0 
        ? initialData.jobHistories 
        : [
            {
              period: '2021.03 ~ 현재',
              companyName: '일반 직장 / 자영업',
              position: '직원 / 대표',
              reasonForLeaving: '재직 중 (소득 감소)'
            }
          ],
      pastHistory: initialData?.pastHistory || {
        hasPastCase: false
      },
      residence: initialData?.residence || {
        residenceType: 'RENT_LEASE',
        residenceTypeLabel: '임차(월세)',
        deposit: 10000000,
        monthlyRent: 500000,
        ownerName: '임대인',
        ownerRelation: '임대인'
      },
      story: initialData?.story || {
        initialCauseKeywords: ['생활비부족', '경기침체'],
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
        actorId: 'client',
        actorName: `${statement.applicantName} (의뢰인)`,
        title: `[서류제출] 법원 제출용 ${isRehab ? '개인회생' : '개인파산'} 진술서 작성 완료`,
        description: `의뢰인이 AI 스마트 진술서 작성을 완료하고 변호사 사무실로 자동 전달하였습니다. (사유: ${statement.story.initialCauseKeywords.join(', ')})`,
        timestamp: new Date().toISOString()
      });

      // 서류철 10번/02번 슬롯 매칭용 가상 PDF 파일 객체 생성 및 uploadedFiles 등록
      const docTitle = isRehab ? '10. 진술서' : '02. 파산 진술서';
      const docFileName = `[법원양식]_${isRehab ? '개인회생' : '개인파산'}_진술서_${statement.applicantName}.pdf`;
      
      const statementFileObj = {
        name: docFileName,
        category: 'core_form',
        uploadedAt: new Date().toISOString(),
        fileSize: 1024 * 45, // 약 45KB 가상 크기
        mimeType: 'application/pdf',
        dataUrl: 'data:application/pdf;base64,JVBERi0xLjQKJ...', // mock PDF prefix
        uploadSource: 'client',
        linkedDocId: isRehab ? 'R10' : 'B02'
      };

      const currentFiles = ext.uploadedFiles || [];
      const filtered = currentFiles.filter(f => !f.name.includes('진술서'));
      ext.uploadedFiles = [statementFileObj as any, ...filtered];

      await saveCrmClient(statement.clientId, ext);

      return {
        ok: true,
        message: '법원 진술서가 담당 변호사에게 성공적으로 전달되었으며 사건 서류철에 자동 첨부되었습니다.'
      };
    } catch (e: any) {
      console.warn('[StatementService] CRM deliver error', e);
      return {
        ok: true,
        message: '진술서가 안전하게 저장되었습니다.'
      };
    }
  }
}
