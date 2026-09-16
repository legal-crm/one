/**
 * 부채증명서 발급 대행 관리 서비스
 * - 대행업체 전달용 표준 엑셀 발급의뢰서 생성 (xlsx-js-style)
 * - 대행사별 맞춤 프리셋 (표준, 원클릭, 윈행정사, 한국신용)
 * - 대행사 제출용 원클릭 ZIP 압축팩 생성 (JSZip)
 *   (00_의뢰서.xlsx + 01_신분증 + 02_인감 + 03_자동생성위임장.pdf)
 * - 발급 완료 데이터의 채권자 목록 및 변제계획안 동기화 헬퍼
 */

import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import type { 
  DebtCertificateOrder, 
  DebtCertificateItem, 
  RepaymentCreditor,
  DebtAgencyApplicationData,
  DebtAgencyCreditorRow,
  DebtAgencyBasicDocRequests
} from './repaymentTypes';
import { getDebtPowerOfAttorneyPdfUint8Array } from './debtPowerOfAttorneyGenerator';
import type { DocumentFile, ConsultRequest } from '../../types';
import { matchCreditorPreset } from '../court/creditorAddressDirectory';
import { loadCertificateVault } from '../vault/certificateVaultService';

const STORAGE_KEY_PREFIX = 'debt_cert_order_';

/**
 * 특정 고객의 부채증명서 발급 대행 데이터 로드
 */
export function loadDebtCertificateOrder(clientId: string): DebtCertificateOrder | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${clientId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load debt certificate order:', err);
    return null;
  }
}

/**
 * 부채증명서 발급 대행 데이터 저장
 */
export function saveDebtCertificateOrder(order: DebtCertificateOrder): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${order.clientId}`, JSON.stringify(order));
  } catch (err) {
    console.error('Failed to save debt certificate order:', err);
  }
}

export type AgencyPresetType = 'standard' | 'oneclick' | 'winadmin' | 'koreacredit';

/**
 * 대행사별 맞춤 발급의뢰 엑셀 워크북 생성
 */
export function generateDebtAgencyExcelWorkbook(
  order: DebtCertificateOrder,
  preset: AgencyPresetType = 'standard'
): any {
  const wb = XLSX.utils.book_new();

  const titleStyle = {
    font: { name: '맑은 고딕', sz: 16, bold: true, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const metaLabelStyle = {
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '334155' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const metaValStyle = {
    font: { name: '맑은 고딕', sz: 10, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
  };

  const thStyle = {
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: preset === 'oneclick' ? '2563EB' : preset === 'winadmin' ? '7C3AED' : '1E3A8A' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '0F172A' } },
      bottom: { style: 'medium', color: { rgb: '0F172A' } },
      left: { style: 'thin', color: { rgb: '93C5FD' } },
      right: { style: 'thin', color: { rgb: '93C5FD' } },
    },
  };

  const tdCenterStyle = {
    font: { name: '맑은 고딕', sz: 10, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const tdLeftStyle = {
    font: { name: '맑은 고딕', sz: 10, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const tdCurrencyStyle = {
    font: { name: '맑은 고딕', sz: 10, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin', color: { rgb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
      left: { style: 'thin', color: { rgb: 'E2E8F0' } },
      right: { style: 'thin', color: { rgb: 'E2E8F0' } },
    },
  };

  const wsData: any[][] = [];

  const presetLabel = 
    preset === 'oneclick' ? '원클릭부채대행 전용 양식' :
    preset === 'winadmin' ? '윈행정사합동 전용 양식' :
    preset === 'koreacredit' ? '한국신용발급대행 전용 양식' : '표준 발급의뢰서';

  // Title
  wsData.push([`부채증명서 발급의뢰서 (${presetLabel})`]);
  wsData.push([]);

  // 의뢰 정보
  wsData.push(['의뢰일자', order.requestedAt || new Date().toISOString().slice(0, 10), '', '수신업체', order.agencyName || '발급대행사']);
  wsData.push(['채무자 성명', order.clientName, '', '주민번호 앞자리', order.clientRrnFront || '-']);
  wsData.push(['연락처', order.clientPhone || '-', '', '의뢰건수', `${order.items.length}개 금융기관`]);
  wsData.push([]);

  // 컬럼 헤더
  let headers = [
    '연번',
    '채권기관명 (금융사)',
    '계좌/관리번호',
    '예상 채무액 (원)',
    '발급 관할지점',
    '진행상태',
    '확정 원금 (발급후)',
    '확정 이자 (발급후)',
    '발급일자',
    '특이사항 / 메모'
  ];

  if (preset === 'oneclick') {
    headers = [
      '순번',
      '고객성명',
      '주민등록번호',
      '채권금융사명',
      '카드/계좌번호',
      '발급지점',
      '진행상태',
      '확정원금',
      '확정이자',
      '대행메모'
    ];
  }

  wsData.push(headers);

  // 데이터 행
  order.items.forEach((item, idx) => {
    if (preset === 'oneclick') {
      wsData.push([
        idx + 1,
        order.clientName,
        order.clientRrnFront ? `${order.clientRrnFront}-*******` : '******-*******',
        item.creditorName,
        item.accountOrContractNo || '-',
        item.branchName || '본점/전지점',
        item.issueStatus === 'issued' ? '발급완료' : item.issueStatus === 'agency_requested' ? '의뢰중' : '접수',
        item.confirmedPrincipal || '',
        item.confirmedInterest || '',
        item.memo || ''
      ]);
    } else {
      wsData.push([
        idx + 1,
        item.creditorName,
        item.accountOrContractNo || '-',
        item.expectedPrincipal,
        item.branchName || '본점/전지점',
        item.issueStatus === 'issued' ? '발급완료' : item.issueStatus === 'agency_requested' ? '의뢰중' : '접수',
        item.confirmedPrincipal || '',
        item.confirmedInterest || '',
        item.issueDate || '',
        item.memo || ''
      ]);
    }
  });

  // 합계 행
  const totalExpected = order.items.reduce((s, i) => s + (i.expectedPrincipal || 0), 0);
  const totalConfirmed = order.items.reduce((s, i) => s + (i.confirmedPrincipal || 0), 0);
  wsData.push([
    '합계',
    `${order.items.length}개 금융기관`,
    '',
    totalExpected,
    '',
    '',
    totalConfirmed > 0 ? totalConfirmed : '',
    '',
    '',
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  if (ws['A1']) ws['A1'].s = titleStyle;

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
    { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
    { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
    { s: { r: 2, c: 4 }, e: { r: 2, c: 9 } },
    { s: { r: 3, c: 4 }, e: { r: 3, c: 9 } },
    { s: { r: 4, c: 4 }, e: { r: 4, c: 9 } },
  ];

  // 메타 정보 서식
  [2, 3, 4].forEach((r) => {
    ['A', 'D'].forEach((col) => {
      const cell = ws[`${col}${r + 1}`];
      if (cell) cell.s = metaLabelStyle;
    });
    ['B', 'E'].forEach((col) => {
      const cell = ws[`${col}${r + 1}`];
      if (cell) cell.s = metaValStyle;
    });
  });

  // 헤더 서식 (Row 6)
  for (let c = 0; c < headers.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 6, c });
    if (ws[cellRef]) ws[cellRef].s = thStyle;
  }

  // 데이터 행 서식
  const startRow = 7;
  const endRow = startRow + order.items.length;
  for (let r = startRow; r < endRow; r++) {
    for (let c = 0; c < headers.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (ws[cellRef]) {
        if (c === 0 || c === 5 || c === 8) {
          ws[cellRef].s = tdCenterStyle;
        } else if (c === 3 || c === 6 || c === 7) {
          ws[cellRef].s = tdCurrencyStyle;
        } else {
          ws[cellRef].s = tdLeftStyle;
        }
      }
    }
  }

  // 열 너비
  ws['!cols'] = [
    { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
    { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 24 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '부채증명서_의뢰');
  return wb;
}

/**
 * 대행업체 제출용 엑셀 다운로드 (.xlsx)
 */
export function exportDebtAgencyExcel(
  order: DebtCertificateOrder,
  preset: AgencyPresetType = 'standard'
): void {
  const wb = generateDebtAgencyExcelWorkbook(order, preset);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeClient = order.clientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
  const fileName = `부채증명서_발급의뢰_${safeClient}_${order.agencyName || '대행사'}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * 📦 대행사 전달용 원클릭 ZIP 압축팩 다운로드
 * - 00_발급의뢰서_[고객명]_(대행사).xlsx
 * - 01_신분증사본_[고객명].[ext] (고객 서류함에 신분증이 있을 시)
 * - 02_인감증명서_[고객명].[ext] (고객 서류함에 인감이 있을 시)
 * - 03_부채증명서_발급위임장_[고객명].pdf (시스템 자동 생성)
 */
export async function exportDebtAgencyZipPackage(
  order: DebtCertificateOrder,
  clientUploadedFiles: DocumentFile[] = [],
  preset: AgencyPresetType = 'standard'
): Promise<void> {
  const zip = new JSZip();
  const safeClient = order.clientName.replace(/[^a-zA-Z0-9가-힣]/g, '');
  const rrnFront = order.clientRrnFront || '880125';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const agencyName = (order.agencyName || '대행사').replace(/부채대행|합동|대행사|사무소/g, '') || '원클릭';

  // 1. 00_발급의뢰서_[채무자명]_[대행사명전용].xlsx
  const wb = generateDebtAgencyExcelWorkbook(order, preset);
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  zip.file(`00_발급의뢰서_${safeClient}_${agencyName}전용.xlsx`, excelBuffer);

  // 2. 03_발급위임장_[채무자명]_자동생성.pdf
  const poaPdfBytes = await getDebtPowerOfAttorneyPdfUint8Array(order);
  zip.file(`03_발급위임장_${safeClient}_자동생성.pdf`, poaPdfBytes);

  // 3. 의뢰인 신분증 및 인감증명서 서류 매핑
  let idDocFound = false;
  let sealDocFound = false;

  for (const file of clientUploadedFiles) {
    const fileName = (file.name || '').toLowerCase();
    const isId = fileName.includes('신분증') || fileName.includes('주민등록') || file.category === 'id_doc';
    const isSeal = fileName.includes('인감') || fileName.includes('본인서명') || file.category === 'other';
    const fileContentUrl = file.dataUrl || (file as any).url;

    if (isId && !idDocFound && fileContentUrl) {
      idDocFound = true;
      try {
        const ext = file.name.split('.').pop() || 'png';
        if (fileContentUrl.startsWith('data:')) {
          const base64Content = fileContentUrl.split(',')[1];
          zip.file(`01_신분증사본_${safeClient}.${ext}`, base64Content, { base64: true });
        }
      } catch (err) {
        console.warn('Failed to embed ID image:', err);
      }
    }

    if (isSeal && !sealDocFound && fileContentUrl) {
      sealDocFound = true;
      try {
        const ext = file.name.split('.').pop() || 'pdf';
        if (fileContentUrl.startsWith('data:')) {
          const base64Content = fileContentUrl.split(',')[1];
          zip.file(`02_인감증명서_${safeClient}.${ext}`, base64Content, { base64: true });
        }
      } catch (err) {
        console.warn('Failed to embed seal image:', err);
      }
    }
  }

  // 3.5. 의뢰인 공동인증서(NPKI) 안전 금고 연동 파일 포함 (비밀번호 분리 발송 프로토콜)
  try {
    const vault = loadCertificateVault(order.clientId);
    if (vault?.npki?.derBase64 && vault?.npki?.keyBase64 && vault.status !== 'shredded') {
      const npkiFolder = zip.folder(`04_공동인증서_NPKI_${safeClient}`);
      if (npkiFolder) {
        npkiFolder.file('signCert.der', vault.npki.derBase64, { base64: true });
        npkiFolder.file('signPri.key', vault.npki.keyBase64, { base64: true });
        npkiFolder.file(
          '보안안내_비밀번호_분리전송.txt',
          `[보안 준칙 안내]\n\n본 폴더의 인증서는 개인정보보호법 및 전자서명법에 따라 보호됩니다.\n인증서 비밀번호는 금융보안 규정에 의거하여 대행사 담당자에게 카카오톡 알림톡/문자를 통해 별도 분리 발송됩니다.\n부채증명서 발급 완료 후 해당 인증서는 즉시 영구 폐기되어야 합니다.`
        );
      }
    }
  } catch (err) {
    console.warn('Failed to embed NPKI in zip package:', err);
  }

  // 4. ZIP 압축 생성 및 브라우저 다운로드
  // Naming: [채무자명_주민앞6자리]_부채발급의뢰_[대행사명]_[YYYYMMDD].zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = zipUrl;
  downloadLink.download = `[${safeClient}_${rrnFront}]_부채발급의뢰_${agencyName}_${dateStr}.zip`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(zipUrl);
}

/**
 * 발급 완료된 부채증명서 항목들을 변제계획안용 RepaymentCreditor 목록으로 자동 변환
 */
export function convertDebtItemsToRepaymentCreditors(
  items: DebtCertificateItem[]
): RepaymentCreditor[] {
  return items.map((item, idx) => {
    const principal = item.confirmedPrincipal !== undefined && item.confirmedPrincipal > 0
      ? item.confirmedPrincipal
      : item.expectedPrincipal;

    const interest = item.confirmedInterest || 0;

    // 조세, 4대보험 등 우선권 키워드 감지
    const name = item.creditorName.toLowerCase();
    const isPriority = 
      name.includes('세무서') || 
      name.includes('구청') || 
      name.includes('시청') || 
      name.includes('국세') || 
      name.includes('지방세') || 
      name.includes('건강보험') || 
      name.includes('국민연금');

    // 주소 정보 매칭 (직접 입력값 우선, 없으면 디렉토리 프리셋 매칭)
    const preset = matchCreditorPreset(item.creditorName);
    const zipCode = item.zipCode || preset?.zipCode || '';
    const address = item.address || preset?.address || '';
    const serviceAddress = item.serviceAddress || preset?.serviceAddress || address;
    const representative = item.representative || preset?.representative || '';
    const bizNumber = item.bizNumber || preset?.bizNumber || '';
    const debtCauseDetail = item.debtCauseDetail || (isPriority ? '조세 및 공과금 체납' : '대여금 / 신용대출');
    const borrowedDate = item.borrowedDate || item.issueDate || '2024-01-01';

    return {
      id: item.id || `cred_${idx + 1}`,
      creditorNumber: idx + 1,
      name: item.creditorName,
      principal,
      interest,
      isSecured: item.isSecured ?? false,
      isUnconfirmed: item.issueStatus !== 'issued' && item.issueStatus !== 'confirmed',
      isPriority: isPriority || (preset?.isPriorityDefault ?? false),
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 0,
      isManuallyAdjusted: false,
      parentCreditorId: item.parentItemId,
      displayNumber: item.displayNumber,
      isGuarantor: item.isGuarantor,
      isUnpaidInterest3Times: item.isUnpaidInterest3Times,
      memo: item.memo,
      zipCode,
      address,
      serviceAddress,
      representative,
      bizNumber,
      debtCauseDetail,
      borrowedDate,
    };
  });
}

/**
 * 대행업체 엑셀 신청서(그림 1 양식) 초기 기본값 생성
 */
export function createDefaultAgencyApplicationData(
  order: DebtCertificateOrder,
  clientRequest?: ConsultRequest,
  activeLawyerName?: string
): DebtAgencyApplicationData {
  const creditors: DebtAgencyCreditorRow[] = order.items.map((it) => ({
    id: it.id,
    creditorName: it.creditorName,
    requestDebtCert: true, // 기본적으로 부채증명은 필수 신청
    requestCardHistory: it.creditorName.includes('카드'),
    requestBankHistory: it.creditorName.includes('은행'),
    note: it.memo || it.accountOrContractNo || '',
  }));

  // 최소 10행 보장을 위해 빈 행 추가
  while (creditors.length < 10) {
    creditors.push({
      id: `empty_${creditors.length + 1}`,
      creditorName: '',
      requestDebtCert: false,
      requestCardHistory: false,
      requestBankHistory: false,
      note: '',
    });
  }

  return {
    caseType: 'rehab',
    officeName: '',
    caseManager: '',
    billingManager: '',
    tel: '',
    fax: '',
    directPhone: '',
    hp: '',
    clientName: order.clientName || clientRequest?.clientName || '',
    clientPhone: order.clientPhone || clientRequest?.phone || '',
    cautions: [
      '* 은행, 카드사 개별부채 의뢰시 본사에서 추가로 교차확인 후 발급진행.',
      '* 부채발급진행 시 신용카드 및 은행계좌정지됩니다. 이 점 고객님에게 고지부탁드립니다.',
      '* 서류발급 시 본인통화가 필요할 수 있으니 고객님에게 안내 부탁드립니다.'
    ],
    basicDocs: {
      niceCredit: { requested: true, extraCreditorsAfterIssue: true },
      bankUnion: { requested: true, extraCreditorsAfterIssue: true },
      lifeInsuranceAssoc: { requested: true, expectedRefundDoc: true },
      healthInsurance: {
        all: true,
        unpaidPaymentHistory: true,
        eligibilityConfirm: true,
        assessmentNotice: true,
        other: '',
      },
      nationalPension: {
        all: true,
        subscriberConfirm: true,
        pensionCalcHistory: true,
        rehabApplicationConfirm: true,
        other: '',
      },
      nationalTax: {
        all: true,
        taxPaymentCert: true,
        incomeAmountCert: true,
        closedBizCert: true,
        other: '',
      },
      localDistrict: {
        localTaxCert: true,
        localTaxJurisdiction: '관할구청 전지역',
        residentAbstract: true,
        residentHead: '본인',
        vehicleRegister: false,
        vehiclePlate: '',
        cadastreLandRecord: true,
        other: '',
      },
    },
    creditors,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 📊 대행업체 제출용 엑셀 신청서 워크북 생성 (그림 1 실무 엑셀 서식 100% 매칭)
 */
export function generateAgencyApplicationExcelWorkbook(
  appData: DebtAgencyApplicationData
): any {
  const wb = XLSX.utils.book_new();

  // 스타일 정의
  const titleStyle = {
    font: { name: '맑은 고딕', sz: 16, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const caseTypeHeaderStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'D9E1F2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const caseTypeValStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const headerLabelStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'F2F2F2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const headerValStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const noticeStyle = {
    font: { name: '맑은 고딕', sz: 8, color: { rgb: 'C00000' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const sectionHeaderStyle = {
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'D9E1F2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'medium', color: { rgb: '000000' } },
      bottom: { style: 'medium', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const subHeaderStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'E9EEF4' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const cellBoxStyle = {
    font: { name: '맑은 고딕', sz: 8, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const tableHeaderStyle = {
    font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'F2F2F2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'medium', color: { rgb: '000000' } },
      bottom: { style: 'medium', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    },
  };

  const tableCenterStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } },
    },
  };

  const tableLeftStyle = {
    font: { name: '맑은 고딕', sz: 9, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } },
    },
  };

  const wsData: any[][] = [];

  // Row 1: Title & Case Type
  const isRehab = appData.caseType === 'rehab' ? '■' : '□';
  const isBankrupt = appData.caseType === 'bankruptcy' ? '■' : '□';
  const isOther = appData.caseType === 'other' ? '■' : '□';

  wsData.push([
    '부채증명서 서류대행 신청서', '', '', '', '', '',
    '개인회생', '개인파산', '기타'
  ]);
  wsData.push([
    '', '', '', '', '', '',
    isRehab, isBankrupt, isOther
  ]);

  // Row 3: 사무소 / 사건담당자 / 결제담당자
  wsData.push([
    '사무소', appData.officeName, '', '',
    '사 건\n담당자', appData.caseManager,
    '결 제\n담당자', appData.billingManager, ''
  ]);

  // Row 4: TEL / FAX / 직통번호 / H P
  wsData.push([
    'TEL', appData.tel,
    'FAX', appData.fax,
    '직 통\n번 호', appData.directPhone || '',
    'H P', appData.hp, ''
  ]);

  // Row 5: 고객명 / 고객연락처 / 주의사항
  const cautionsStr = (appData.cautions || [
    '* 은행, 카드사 개별부채 의뢰시 본사에서 추가로 교차확인 후 발급진행.',
    '* 부채발급진행 시 신용카드 및 은행계좌정지됩니다. 이 점 고객님에게 고지부탁드립니다.',
    '* 서류발급 시 본인통화가 필요할 수 있으니 고객님에게 안내 부탁드립니다.'
  ]).join('\n');

  wsData.push([
    '고객명', appData.clientName,
    '고 객\n연락처', appData.clientPhone,
    '주 의\n사 항', cautionsStr, '', '', ''
  ]);

  // Row 6: Section Header: 기본서류 발급신청 ( V )
  wsData.push([
    '기본서류 발급신청 ( V )', '', '', '', '', '', '', '', ''
  ]);

  // Row 7~8: 7개 기관별 발급 옵션 서술
  const b = appData.basicDocs;
  const cb = (v: boolean) => (v ? '☑' : '□');

  const niceText = `${cb(b.niceCredit.requested)} 신청\n${cb(b.niceCredit.extraCreditorsAfterIssue)} 발급 후 신청건 외\n채권사 추가발급진행`;
  const bankUnionText = `${cb(b.bankUnion.requested)} 신청\n${cb(b.bankUnion.extraCreditorsAfterIssue)} 발급 후 신청건 외\n채권사 추가발급진행`;
  const insText = `${cb(b.lifeInsuranceAssoc.requested)} 신청\n${cb(b.lifeInsuranceAssoc.expectedRefundDoc)} 보험 예상해지\n환급금증명서 진행`;

  const healthText = `${cb(b.healthInsurance.all)} 전체내역발급\n${cb(b.healthInsurance.unpaidPaymentHistory)} 건강보험 미납(납부)내역서\n${cb(b.healthInsurance.eligibilityConfirm)} 자격득실 확인서\n${cb(b.healthInsurance.assessmentNotice)} 산정(부과)내역서\n${cb(!!b.healthInsurance.other)} 기타 : ${b.healthInsurance.other || ''}`;
  const pensionText = `${cb(b.nationalPension.all)} 전체내역발급\n${cb(b.nationalPension.subscriberConfirm)} 가입자 가입증명서\n${cb(b.nationalPension.pensionCalcHistory)} 연금산정가입내역확인서\n${cb(b.nationalPension.rehabApplicationConfirm)} 개인회생신청용확인서\n${cb(!!b.nationalPension.other)} 기타 : ${b.nationalPension.other || ''}`;
  const taxText = `${cb(b.nationalTax.all)} 전체내역발급\n${cb(b.nationalTax.taxPaymentCert)} 납세증명,체납증명\n${cb(b.nationalTax.incomeAmountCert)} 소득금액증명\n${cb(b.nationalTax.closedBizCert)} 휴,폐업사실증명\n${cb(!!b.nationalTax.other)} 기타 : ${b.nationalTax.other || ''}`;
  const localText = `${cb(b.localDistrict.localTaxCert)} 지방세세목별과세증명: 관할(${b.localDistrict.localTaxJurisdiction || ' '})\n${cb(b.localDistrict.residentAbstract)} 주민등록 등초본: 세대주(${b.localDistrict.residentHead || ' '})\n${cb(b.localDistrict.vehicleRegister)} 자동차등록원부: 차량번호(${b.localDistrict.vehiclePlate || ' '})\n${cb(b.localDistrict.cadastreLandRecord)} 지적전산자료조회결과서(토지소유현황)\n${cb(!!b.localDistrict.other)} 기타 : ${b.localDistrict.other || ''}`;

  // 1열 라벨 + 내용
  wsData.push([
    '신용\n조회\n(나이스)', niceText,
    '국민\n건강\n보험', healthText, '',
    '국세\n(세무서)', taxText, '', ''
  ]);
  wsData.push([
    '은행\n연합회', bankUnionText,
    '국민\n연금', pensionText, '',
    '구청\n및\n동사무소', localText, '', ''
  ]);
  wsData.push([
    '생명(손해)\n보험협회', insText,
    '', '', '', '', '', '', ''
  ]);

  // Row 10: 채권사 테이블 헤더
  wsData.push([
    '번호', '채 권 사', '', '',
    '부채\n증명', '카드\n거래', '통장\n거래',
    '비 고 사 항', ''
  ]);

  // 채권사 행 (최소 10개)
  appData.creditors.forEach((c, idx) => {
    wsData.push([
      idx + 1,
      c.creditorName, '', '',
      c.requestDebtCert ? 'V' : '',
      c.requestCardHistory ? 'V' : '',
      c.requestBankHistory ? 'V' : '',
      c.note || '', ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 셀 병합 (Merges) 설정
  ws['!merges'] = [
    // Title A1:F2
    { s: { r: 0, c: 0 }, e: { r: 1, c: 5 } },
    // Row 3: 사무소 B3:D3, 결제담당자 H3:I3
    { s: { r: 2, c: 1 }, e: { r: 2, c: 3 } },
    { s: { r: 2, c: 7 }, e: { r: 2, c: 8 } },
    // Row 4: H P H4:I4
    { s: { r: 3, c: 7 }, e: { r: 3, c: 8 } },
    // Row 5: 고객명 B5:C5, 주의사항 F5:I5
    { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
    { s: { r: 4, c: 5 }, e: { r: 4, c: 8 } },
    // Row 6: 기본서류 발급신청 전체 A6:I6
    { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } },
    // Row 7 (기관 박스 병합)
    { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } }, // 건보내용
    { s: { r: 6, c: 6 }, e: { r: 6, c: 8 } }, // 국세내용
    // Row 8
    { s: { r: 7, c: 3 }, e: { r: 7, c: 4 } }, // 국민연금내용
    { s: { r: 7, c: 6 }, e: { r: 7, c: 8 } }, // 구청내용
    // Row 9
    { s: { r: 8, c: 1 }, e: { r: 8, c: 8 } }, // 보험내용
    // Row 10 (채권자 헤더)
    { s: { r: 9, c: 1 }, e: { r: 9, c: 3 } }, // 채권사 B~D
    { s: { r: 9, c: 7 }, e: { r: 9, c: 8 } }, // 비고사항 H~I
  ];

  // 채권자 데이터 행 병합 (B~D, H~I)
  const credStartRow = 10;
  for (let i = 0; i < appData.creditors.length; i++) {
    const r = credStartRow + i;
    ws['!merges'].push(
      { s: { r, c: 1 }, e: { r, c: 3 } },
      { s: { r, c: 7 }, e: { r, c: 8 } }
    );
  }

  // 열 너비
  ws['!cols'] = [
    { wch: 6 },  // A: 번호
    { wch: 16 }, // B: 채권사 1
    { wch: 10 }, // C: 채권사 2
    { wch: 10 }, // D: 채권사 3
    { wch: 7 },  // E: 부채증명
    { wch: 7 },  // F: 카드거래
    { wch: 7 },  // G: 통장거래
    { wch: 16 }, // H: 비고사항 1
    { wch: 16 }, // I: 비고사항 2
  ];

  // 행 높이 (가독성 향상)
  ws['!rows'] = [
    { hpt: 26 }, { hpt: 20 }, // 1, 2
    { hpt: 22 }, { hpt: 22 }, { hpt: 36 }, // 3, 4, 5
    { hpt: 24 }, // 6: 기본서류 헤더
    { hpt: 55 }, { hpt: 55 }, { hpt: 30 }, // 7, 8, 9
    { hpt: 24 }, // 10: 채권자 헤더
  ];

  // 스타일 주입
  if (ws['A1']) ws['A1'].s = titleStyle;
  if (ws['G1']) ws['G1'].s = caseTypeHeaderStyle;
  if (ws['H1']) ws['H1'].s = caseTypeHeaderStyle;
  if (ws['I1']) ws['I1'].s = caseTypeHeaderStyle;
  if (ws['G2']) ws['G2'].s = caseTypeValStyle;
  if (ws['H2']) ws['H2'].s = caseTypeValStyle;
  if (ws['I2']) ws['I2'].s = caseTypeValStyle;

  // 헤더 레이블들
  ['A3', 'E3', 'G3', 'A4', 'C4', 'E4', 'G4', 'A5', 'C5', 'E5'].forEach((k) => {
    if (ws[k]) ws[k].s = headerLabelStyle;
  });

  // 값들
  ['B3', 'F3', 'H3', 'B4', 'D4', 'F4', 'H4', 'B5', 'D5'].forEach((k) => {
    if (ws[k]) ws[k].s = headerValStyle;
  });

  if (ws['F5']) ws['F5'].s = noticeStyle;
  if (ws['A6']) ws['A6'].s = sectionHeaderStyle;

  // 서류 항목 라벨 및 내용 스타일
  ['A7', 'C7', 'F7', 'A8', 'C8', 'F8', 'A9'].forEach((k) => {
    if (ws[k]) ws[k].s = subHeaderStyle;
  });
  ['B7', 'D7', 'G7', 'B8', 'D8', 'G8', 'B9'].forEach((k) => {
    if (ws[k]) ws[k].s = cellBoxStyle;
  });

  // 채권자 테이블 헤더
  ['A10', 'B10', 'E10', 'F10', 'G10', 'H10'].forEach((k) => {
    if (ws[k]) ws[k].s = tableHeaderStyle;
  });

  // 채권자 데이터 스타일
  for (let i = 0; i < appData.creditors.length; i++) {
    const rowNum = 11 + i;
    const a = ws[`A${rowNum}`];
    const bCell = ws[`B${rowNum}`];
    const e = ws[`E${rowNum}`];
    const f = ws[`F${rowNum}`];
    const g = ws[`G${rowNum}`];
    const h = ws[`H${rowNum}`];

    if (a) a.s = tableCenterStyle;
    if (bCell) bCell.s = tableLeftStyle;
    if (e) e.s = tableCenterStyle;
    if (f) f.s = tableCenterStyle;
    if (g) g.s = tableCenterStyle;
    if (h) h.s = tableLeftStyle;
  }

  XLSX.utils.book_append_sheet(wb, ws, '대행신청서');
  return wb;
}

/**
 * 📥 대행업체 엑셀 신청서 (.xlsx) 다운로드 실행
 */
export function exportAgencyApplicationExcel(
  appData: DebtAgencyApplicationData
): void {
  const wb = generateAgencyApplicationExcelWorkbook(appData);
  const safeClient = (appData.clientName || '의뢰인').replace(/[^a-zA-Z0-9가-힣]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `부채증명서_서류대행신청서_${safeClient}_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

const CUSTOM_TEMPLATE_PREFIX = 'agency_custom_excel_';

/**
 * 사용자 업로드 커스텀 엑셀 폼 저장
 */
export async function saveAgencyCustomExcelTemplate(
  clientId: string,
  file: File
): Promise<{ fileName: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const meta = { fileName: file.name, dataUrl };
      try {
        localStorage.setItem(`${CUSTOM_TEMPLATE_PREFIX}${clientId}`, JSON.stringify(meta));
        resolve(meta);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 사용자 업로드 커스텀 엑셀 폼 불러오기
 */
export function getAgencyCustomExcelTemplate(
  clientId: string
): { fileName: string; dataUrl: string } | null {
  try {
    const raw = localStorage.getItem(`${CUSTOM_TEMPLATE_PREFIX}${clientId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * 사용자 업로드 커스텀 엑셀 폼 삭제
 */
export function removeAgencyCustomExcelTemplate(clientId: string): void {
  localStorage.removeItem(`${CUSTOM_TEMPLATE_PREFIX}${clientId}`);
}

