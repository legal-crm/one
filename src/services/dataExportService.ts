import * as XLSX from 'xlsx';

// ── localStorage 키 목록 ──
const STORAGE_KEYS = [
  'legal_crm_requests',
  'legal_crm_messages',
  'legal_crm_cases',
  'legal_crm_lawyers',
  'legal_crm_members',
  'legal_crm_activity_logs',
  'legal_crm_news',
  'legal_crm_qas',
  'legal_crm_reviews',
  'legal_crm_banners',
  'legal_crm_notices',
  'legal_crm_inquiries',
  'legal_crm_lawyer_inquiries',
  'legal_crm_platform_config',
  'legal_crm_popup_config',
  'legal_crm_data',
  'legal_crm_staff',
  'legal_crm_staff_activities',
  'staff_custom_roles',
  'electronic_contracts',
  'legal_crm_copilot_cases',
  'legal_crm_pending_proposals',
] as const;

// 동적 키 패턴 (tenantId/lawyerId/clientId 포함)
const DYNAMIC_KEY_PATTERNS = [
  'task-tickets-',
  'internal_messages',
  'cal-events-',
  'alimtok_logs_',
  'proposal_templates_',
  'proposal_fee_presets_',
  'copilot_rulesets_',
];

/** localStorage에서 동적 키 패턴 매칭 데이터 수집 */
function collectDynamicKeys(): Record<string, any> {
  const result: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    for (const pattern of DYNAMIC_KEY_PATTERNS) {
      if (key.startsWith(pattern)) {
        try {
          result[key] = JSON.parse(localStorage.getItem(key) || 'null');
        } catch {
          result[key] = localStorage.getItem(key);
        }
      }
    }
  }
  return result;
}

/** 백업 메타데이터 (통계 정보) */
export function getBackupStats(): {
  clientCount: number;
  messageCount: number;
  caseCount: number;
  contractCount: number;
  lastBackup: string | null;
} {
  const requests = JSON.parse(localStorage.getItem('legal_crm_requests') || '[]');
  const messages = JSON.parse(localStorage.getItem('legal_crm_messages') || '[]');
  const cases = JSON.parse(localStorage.getItem('legal_crm_cases') || '[]');
  const contracts = JSON.parse(localStorage.getItem('electronic_contracts') || '[]');
  const lastBackup = localStorage.getItem('legal_crm_last_backup');
  return {
    clientCount: requests.length,
    messageCount: messages.length,
    caseCount: cases.length,
    contractCount: contracts.length,
    lastBackup,
  };
}

/** 파일 다운로드 헬퍼 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 타임스탬프 문자열 생성 */
function getTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// 1. 전체 JSON 백업
// ═══════════════════════════════════════════════════════════════
export function exportFullJsonBackup(): { success: boolean; filename: string } {
  try {
    const backup: Record<string, any> = {
      _meta: {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        platform: 'mykim-legal-crm',
        description: '마이김변 법률 CRM 전체 백업 데이터',
      },
    };

    // 고정 키 수집
    for (const key of STORAGE_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          backup[key] = JSON.parse(raw);
        } catch {
          backup[key] = raw;
        }
      }
    }

    // 동적 키 수집
    const dynamicData = collectDynamicKeys();
    if (Object.keys(dynamicData).length > 0) {
      backup._dynamic = dynamicData;
    }

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const filename = `mykim_backup_${getTimestamp()}.json`;
    downloadBlob(blob, filename);

    // 마지막 백업 시간 기록
    localStorage.setItem('legal_crm_last_backup', new Date().toISOString());

    return { success: true, filename };
  } catch (err) {
    console.error('JSON 백업 실패:', err);
    return { success: false, filename: '' };
  }
}

// ═══════════════════════════════════════════════════════════════
// 2. Excel 내보내기
// ═══════════════════════════════════════════════════════════════

/** 날짜 포맷 */
function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
}

/** 금액 포맷 (만원 단위) */
function fmtMoney(val?: number): string {
  if (val == null) return '';
  return val.toLocaleString('ko-KR');
}

export function exportExcelReport(): { success: boolean; filename: string } {
  try {
    const wb = XLSX.utils.book_new();
    
    // ── 시트 1: 고객 상담 ──
    const requests = JSON.parse(localStorage.getItem('legal_crm_requests') || '[]');
    const requestRows = requests.map((r: any) => ({
      '상담ID': r.id,
      '고객명': r.clientName || '',
      '연락처': r.phone || '',
      '상담유형': r.requestType === 'direct' ? '1:1 지명' : r.requestType === 'open' ? '공개 상담' : (r.requestType || ''),
      '상태': r.status || '',
      '채무총액(만원)': fmtMoney(r.financialProfile?.debtTotal),
      '월소득(만원)': fmtMoney(r.financialProfile?.income),
      '부양가족': r.financialProfile?.dependents ?? '',
      '직업유형': r.financialProfile?.jobType || '',
      '지역': r.financialProfile?.residenceRegion || '',
      '등록일': fmtDate(r.createdAt),
      '제목': r.title || '',
    }));
    if (requestRows.length > 0) {
      const ws1 = XLSX.utils.json_to_sheet(requestRows);
      ws1['!cols'] = [
        { wch: 16 }, { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
        { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
        { wch: 18 }, { wch: 30 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, '고객 상담');
    }

    // ── 시트 2: 재무 프로필 상세 ──
    const profileRows = requests
      .filter((r: any) => r.financialProfile)
      .map((r: any) => {
        const fp = r.financialProfile;
        return {
          '고객명': r.clientName || fp.clientName || '',
          '채무총액': fmtMoney(fp.debtTotal),
          '은행': fmtMoney(fp.debtTypes?.banks),
          '카드': fmtMoney(fp.debtTypes?.cards),
          '사채': fmtMoney(fp.debtTypes?.personals),
          '최근대출': fmtMoney(fp.debtTypes?.recentLoans),
          '코인/투자': fmtMoney(fp.debtTypes?.coinCrypto),
          '자산총액': fmtMoney(fp.assetsTotal),
          '월소득': fmtMoney(fp.income),
          '부양가족': fp.dependents ?? '',
          '배우자소득': fmtMoney(fp.spouseIncome),
          '배우자자산': fmtMoney(fp.spouseAsset),
          '직업': fp.jobType || '',
          '회사명': fp.companyNameMasked || '',
          '독촉수준': fp.harassmentLevel || '',
          '채무원인': fp.debtCause || '',
          '위험요소': (fp.riskFlags || []).join(', '),
        };
      });
    if (profileRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(profileRows);
      XLSX.utils.book_append_sheet(wb, ws2, '재무 프로필');
    }

    // ── 시트 3: 제안서 ──
    const proposalRows: any[] = [];
    requests.forEach((r: any) => {
      (r.proposals || []).forEach((p: any) => {
        proposalRows.push({
          '상담ID': r.id,
          '고객명': r.clientName || '',
          '변호사명': p.lawyerName || '',
          '법무법인': p.firmName || '',
          '월변제금(만원)': fmtMoney(p.monthlyPayment),
          '변제기간': p.duration || '',
          '탕감률(%)': p.reductionRate ? `${p.reductionRate}%` : '',
          '수임료': fmtMoney(p.fee),
          '분납': p.installment || '',
          '발송일': fmtDate(p.createdAt),
          '소견': p.remark || '',
        });
      });
    });
    if (proposalRows.length > 0) {
      const ws3 = XLSX.utils.json_to_sheet(proposalRows);
      XLSX.utils.book_append_sheet(wb, ws3, '제안서');
    }

    // ── 시트 4: 채팅 기록 ──
    const messages = JSON.parse(localStorage.getItem('legal_crm_messages') || '[]');
    const msgRows = messages.map((m: any) => ({
      '상담ID': m.consultRequestId || '',
      '발신자유형': m.senderType === 'client' ? '의뢰인' : m.senderType === 'lawyer' ? '변호사' : (m.senderType || ''),
      '발신자': m.senderName || '',
      '메시지': m.message || '',
      '시간': fmtDate(m.createdAt),
    }));
    if (msgRows.length > 0) {
      const ws4 = XLSX.utils.json_to_sheet(msgRows);
      ws4['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 60 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws4, '채팅 기록');
    }

    // ── 시트 5: 수임·계약 ──
    const contracts = JSON.parse(localStorage.getItem('electronic_contracts') || '[]');
    const contractRows = contracts.map((c: any) => ({
      '계약ID': c.id || '',
      '고객명': c.clientName || '',
      '연락처': c.clientPhone || '',
      '변호사': c.lawyerName || '',
      '총수임료': fmtMoney(c.totalFee),
      '법원비용': fmtMoney(c.courtCosts),
      '상태': c.status || '',
      '계약일': fmtDate(c.contractDate),
    }));
    if (contractRows.length > 0) {
      const ws5 = XLSX.utils.json_to_sheet(contractRows);
      XLSX.utils.book_append_sheet(wb, ws5, '수임·계약');
    }

    // ── 시트 6: 사건 관리 ──
    const cases = JSON.parse(localStorage.getItem('legal_crm_cases') || '[]');
    const caseRows = cases.map((c: any) => ({
      '사건ID': c.id || '',
      '고객명': c.clientName || '',
      '연락처': c.phone || '',
      '상태': c.status || '',
      '담당변호사': c.assignedLawyerName || '',
      '채무총액': fmtMoney(c.debtTotal),
      '월소득': fmtMoney(c.income),
      '생성일': fmtDate(c.createdAt),
      '수정일': fmtDate(c.updatedAt),
    }));
    if (caseRows.length > 0) {
      const ws6 = XLSX.utils.json_to_sheet(caseRows);
      XLSX.utils.book_append_sheet(wb, ws6, '사건 관리');
    }

    // ── 시트 7: 활동 로그 ──
    const logs = JSON.parse(localStorage.getItem('legal_crm_activity_logs') || '[]');
    const logRows = logs.slice(0, 500).map((l: any) => ({
      '작업자': l.memberName || '',
      '역할': l.role || '',
      '행위': l.action || '',
      '상세': l.details || '',
      '시간': fmtDate(l.timestamp),
    }));
    if (logRows.length > 0) {
      const ws7 = XLSX.utils.json_to_sheet(logRows);
      ws7['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 50 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws7, '활동 로그');
    }

    // 워크북에 시트가 없으면 빈 시트 추가
    if (wb.SheetNames.length === 0) {
      const wsEmpty = XLSX.utils.aoa_to_sheet([['데이터 없음']]);
      XLSX.utils.book_append_sheet(wb, wsEmpty, '안내');
    }

    const filename = `mykim_고객데이터_${getTimestamp()}.xlsx`;
    XLSX.writeFile(wb, filename);

    // 마지막 백업 시간 기록
    localStorage.setItem('legal_crm_last_backup', new Date().toISOString());

    return { success: true, filename };
  } catch (err) {
    console.error('Excel 내보내기 실패:', err);
    return { success: false, filename: '' };
  }
}
