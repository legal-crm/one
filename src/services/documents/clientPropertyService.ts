/**
 * 의뢰인 재산상황 기초자료 관리 및 변호사 CRM 연동 서비스
 * (대법원 전산양식 D5102 및 리걸플로 7-4 벤치마킹)
 */

import type { PropertyListD5102Data } from '../../types/propertyTypes';
import { recalculateD5102Totals } from './propertyValuationService';
import { secureGetItem, secureSetItem } from '../../utils/secureStorage';

const CLIENT_PROPERTY_STORAGE_PREFIX = 'legal_crm_client_property_';

export class ClientPropertyService {
  /**
   * 신규 의뢰인용 기본 D5102 빈 템플릿 생성
   */
  static createInitialData(clientId: string, clientName: string = '신청인'): PropertyListD5102Data {
    const today = new Date().toISOString().split('T')[0];
    return {
      id: `d5102-${clientId}-${Date.now()}`,
      clientId,
      clientName,
      baseDate: today,
      realEstates: [],
      vehicles: [],
      leaseDeposits: [],
      insurances: [],
      severances: [],
      financialAssets: [],
      businessAssets: [],
      exemptProperties: [],
      totalMarketValue: 0,
      totalEncumbrance: 0,
      totalStatutoryDeduction: 0,
      totalLiquidationValue: 0,
      isCompleted: false,
      clientIntakeStatus: 'draft',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * 로컬 스토리지에서 의뢰인 재산 데이터 로드
   */
  static loadClientData(clientId: string, clientName: string = '신청인'): PropertyListD5102Data {
    try {
      const key = `${CLIENT_PROPERTY_STORAGE_PREFIX}${clientId}`;
      const raw = secureGetItem(key) || localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        return recalculateD5102Totals(parsed);
      }
    } catch (e) {
      console.warn('[ClientPropertyService] Failed to load from storage:', e);
    }
    return this.createInitialData(clientId, clientName);
  }

  /**
   * 로컬 스토리지에 의뢰인 재산 데이터 임시 저장
   */
  static saveClientData(data: PropertyListD5102Data): PropertyListD5102Data {
    const recalculated = recalculateD5102Totals(data);
    try {
      const key = `${CLIENT_PROPERTY_STORAGE_PREFIX}${data.clientId}`;
      const serialized = JSON.stringify(recalculated);
      secureSetItem(key, serialized);
      localStorage.setItem(key, serialized);
    } catch (e) {
      console.warn('[ClientPropertyService] Failed to save to storage:', e);
    }
    return recalculated;
  }

  /**
   * 담당 변호사에게 재산 기초자료 전달 (상태 변경 및 CRM 동기화)
   */
  static submitToLawyer(
    data: PropertyListD5102Data,
    onSyncCrmExt?: (updates: { propertyListD5102: PropertyListD5102Data }) => Promise<void> | void
  ): PropertyListD5102Data {
    const submittedData: PropertyListD5102Data = {
      ...recalculateD5102Totals(data),
      clientIntakeStatus: 'submitted_to_lawyer',
      clientSubmittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 로컬 저장
    this.saveClientData(submittedData);

    // 변호사 CRM 동기화 콜백 호출
    if (onSyncCrmExt) {
      try {
        onSyncCrmExt({ propertyListD5102: submittedData });
      } catch (e) {
        console.warn('[ClientPropertyService] Failed to sync to lawyer CRM:', e);
      }
    }

    return submittedData;
  }

  /**
   * 카테고리별 입력 완료 건수 집계
   */
  static getCategoryCounts(data: PropertyListD5102Data) {
    return {
      depositsAndInsurances: (data.financialAssets?.filter(f => f.category === 'deposit') || []).length + (data.insurances || []).length,
      vehicles: (data.vehicles || []).length,
      leaseDeposits: (data.leaseDeposits || []).length,
      realEstates: (data.realEstates || []).length,
      businessAssets: (data.businessAssets || []).length,
      severancesAndExempt: (data.severances || []).length + (data.exemptProperties || []).length,
      totalCount:
        (data.financialAssets || []).length +
        (data.insurances || []).length +
        (data.vehicles || []).length +
        (data.leaseDeposits || []).length +
        (data.realEstates || []).length +
        (data.businessAssets || []).length +
        (data.severances || []).length +
        (data.exemptProperties || []).length,
    };
  }
}
