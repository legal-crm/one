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
  RepaymentCreditor 
} from './repaymentTypes';
import { getDebtPowerOfAttorneyPdfUint8Array } from './debtPowerOfAttorneyGenerator';
import type { DocumentFile } from '../../types';
import { matchCreditorPreset } from '../court/creditorAddressDirectory';

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
      isSecured: false,
      isUnconfirmed: item.issueStatus !== 'issued' && item.issueStatus !== 'confirmed',
      isPriority: isPriority || (preset?.isPriorityDefault ?? false),
      allocationRatio: 0,
      monthlyRepayment: 0,
      totalRepayment: 0,
      repaymentRate: 0,
      isManuallyAdjusted: false,
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
