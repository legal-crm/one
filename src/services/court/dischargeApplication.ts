// ============================================================
// 개인회생 면책신청서 (H-0, 고객 기획서 6-A·변호사 기획서 12번)
//  * 양식: public/court-forms/hwpx/개인회생 면책신청서.hwpx (1장, 표 없음, 빈칸이 공백인 글)
//  * 신청취지·신청원인은 법원 양식 고정 문구 그대로. 이용자는 사실 정보만 넣는다
//  * 주민등록번호는 저장하지 않는다(L8): 출력할 때만 받아 파일에 넣고 버린다
// ============================================================
import type { HwpxEdit } from './hwpxBuilder';
import { guard, runGuard, RRN_RE, REHAB_CASE_NO_RE, type GuardIssue } from './courtDocGuard';

export const DISCHARGE_TEMPLATE_PATH = '/court-forms/hwpx/개인회생 면책신청서.hwpx';

export interface DischargeForm {
  courtName: string;
  /** 2024개회12345 */
  caseNumber: string;
  name: string;
  address: string;
  phone: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  /** 본인 명의 계좌 확인 */
  accountIsOwn: boolean;
  /** YYYY-MM-DD */
  applyDate: string;
  /** 연락 가능한 전화번호 (비우면 위 전화번호) */
  contactPhone: string;
  /** 변제를 모두 마쳤는지 (이용자 확인) */
  repaymentDone: boolean;
}

/** 서버에 저장해도 되는 칸 (주민번호 칸은 이 형식에 없다) */
export type DischargeDraft = Partial<DischargeForm>;

export function emptyDischargeForm(today = new Date()): DischargeForm {
  const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    courtName: '', caseNumber: '', name: '', address: '', phone: '', bankName: '', bankBranch: '', accountNumber: '',
    accountIsOwn: false, applyDate: ymd, contactPhone: '', repaymentDone: false,
  };
}

export function parseCaseNumber(v: string): { year: string; serial: string } | null {
  const m = String(v || '').replace(/\s+/g, '').match(/^((?:19|20)\d{2})개회(\d{1,7})$/);
  return m ? { year: m[1], serial: m[2] } : null;
}

/** 법원 이름 끝의 '귀중' 앞 표기 (예: '서울회생법원') */
const courtLabel = (c: string) => c.trim().replace(/\s*귀중$/, '');

export function validateDischarge(f: DischargeForm, rrn: string, signMethod: 'image' | 'blank' | null): { blocks: GuardIssue[]; warns: GuardIssue[]; ok: boolean } {
  return runGuard([
    guard.required(f.courtName, 'courtName', '관할 법원'),
    guard.required(f.caseNumber, 'caseNumber', '사건번호'),
    guard.pattern(f.caseNumber.replace(/\s+/g, ''), REHAB_CASE_NO_RE, 'caseNumber', '사건번호는 2024개회12345 형식으로 넣어 주세요.'),
    guard.required(f.name, 'name', '성명'),
    guard.required(rrn, 'rrn', '주민등록번호'),
    guard.pattern(rrn, RRN_RE, 'rrn', '주민등록번호 13자리를 확인해 주세요.'),
    guard.required(f.address, 'address', '주소'),
    guard.required(f.phone, 'phone', '전화번호'),
    guard.pattern(f.phone, /^0\d{1,2}-?\d{3,4}-?\d{4}$/, 'phone', '전화번호 형식을 확인해 주세요.'),
    guard.required(f.bankName, 'bankName', '환급계좌 은행'),
    guard.required(f.accountNumber, 'accountNumber', '환급계좌 번호'),
    guard.pattern(f.accountNumber, /^[0-9-]{6,30}$/, 'accountNumber', '계좌번호는 숫자와 - 만 넣어 주세요.'),
    f.accountIsOwn ? null : { level: 'block', field: 'accountIsOwn', message: '환급계좌는 채무자 본인 명의여야 해요. 확인란을 눌러 주세요.' },
    guard.required(f.applyDate, 'applyDate', '작성일'),
    signMethod ? null : { level: 'block', field: 'sign', message: '서명·날인 방법을 골라 주세요.' },
    guard.warn(!f.repaymentDone, '변제를 모두 마친 뒤에 제출해요. 아직 남은 회차가 있으면 법원 변제현황을 먼저 확인하세요.', 'repaymentDone'),
  ]);
}

const formatRrn = (rrn: string) => {
  const d = rrn.replace(/\D/g, '');
  return d.length === 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : rrn;
};
const dotDate = (ymd: string) => {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : ymd;
};

/** HWPX 양식에 넣을 편집 (양식의 원래 글을 찾아 바꾼다) */
export function dischargeHwpxEdits(f: DischargeForm, rrn: string): HwpxEdit[] {
  const cn = parseCaseNumber(f.caseNumber);
  const contact = f.contactPhone.trim() || f.phone.trim();
  return [
    { kind: 'text', label: '사건번호', find: '사         건     20    개회        개인회생', replace: `사         건     ${cn ? `${cn.year}개회${cn.serial}` : f.caseNumber.trim()}  개인회생` },
    { kind: 'text', label: '성명·주민등록번호', find: '신청인(채무자)     성    명:           (주민등록번호         -         )', replace: `신청인(채무자)     성    명: ${f.name.trim()}  (주민등록번호 ${formatRrn(rrn)})` },
    { kind: 'text', label: '주소', find: '                  주    소:', replace: `                  주    소: ${f.address.trim()}` },
    { kind: 'text', label: '전화번호', find: '                  전화번호:', replace: `                  전화번호: ${f.phone.trim()}` },
    { kind: 'text', label: '환급계좌', find: '                  환급계좌:      은행    지점(계좌번호:              ) ', replace: `                  환급계좌: ${f.bankName.trim()}${/은행$/.test(f.bankName.trim()) ? '' : ' 은행'} ${f.bankBranch.trim() ? `${f.bankBranch.trim()} 지점` : ''}(계좌번호: ${f.accountNumber.trim()}) ` },
    { kind: 'text', label: '작성일', find: '20  .    .    .', replace: dotDate(f.applyDate) },
    { kind: 'text', label: '신청인 서명', find: ' 신청인(채무자)              (서명 또는 날인)', replace: ` 신청인(채무자)   ${f.name.trim()}   (서명 또는 날인)` },
    { kind: 'text', label: '연락 가능한 전화번호', find: '               연락 가능한 전화번호:             ', replace: `               연락 가능한 전화번호: ${contact}` },
    { kind: 'text', label: '법원', find: '법원 귀중', replace: `${courtLabel(f.courtName)} 귀중` },
  ];
}

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 글자 PDF용 HTML (서버 /api/pdf). 서명·도장 이미지는 data URL로 넣는다 */
export function dischargeHtml(f: DischargeForm, rrn: string, signImage?: string | null): string {
  const cn = parseCaseNumber(f.caseNumber);
  const contact = f.contactPhone.trim() || f.phone.trim();
  const sign = signImage
    ? `<img src="${esc(signImage)}" alt="" style="height:22mm;vertical-align:middle;margin-left:4mm" />`
    : '';
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8" /><title>면책신청서</title>
<style>
@page { size: A4; margin: 25mm 25mm 20mm 25mm; }
body { font-family: 'NanumMyeongjo', 'Nanum Myeongjo', serif; font-size: 12pt; line-height: 1.9; color: #000; }
h1 { text-align: center; font-size: 20pt; letter-spacing: 8pt; margin: 0 0 14mm; }
.row { display: flex; gap: 4mm; } .lab { width: 34mm; flex: none; } .k { width: 22mm; display: inline-block; }
h2 { text-align: center; font-size: 13pt; letter-spacing: 6pt; margin: 10mm 0 4mm; }
p { margin: 0 0 2mm; } .date { text-align: center; margin: 14mm 0 8mm; }
.signer { text-align: center; } .court { margin-top: 14mm; font-size: 14pt; font-weight: bold; letter-spacing: 2pt; }
.note { margin-top: 18mm; font-size: 10pt; }
</style></head><body>
<h1>면책신청서</h1>
<p>사　　건　　${esc(cn ? `${cn.year}개회${cn.serial}` : f.caseNumber)}　개인회생</p>
<div class="row"><span class="lab">신청인(채무자)</span><div>
<p><span class="k">성　　명:</span> ${esc(f.name)} (주민등록번호 ${esc(formatRrn(rrn))})</p>
<p><span class="k">주　　소:</span> ${esc(f.address)}</p>
<p><span class="k">전화번호:</span> ${esc(f.phone)}</p>
<p><span class="k">환급계좌:</span> ${esc(f.bankName)}${/은행$/.test(f.bankName.trim()) ? '' : ' 은행'} ${f.bankBranch.trim() ? `${esc(f.bankBranch)} 지점` : ''}(계좌번호: ${esc(f.accountNumber)})</p>
</div></div>
<h2>신 청 취 지</h2>
<p>‘채무자를 면책한다’라는 결정을 구합니다.</p>
<h2>신 청 원 인</h2>
<p>1. 신청인은 위 사건의 채무자로서 귀 법원에서 인가된 변제계획에 따른 변제를 완료하였습니다.</p>
<p>2. 이에 채무자 회생 및 파산에 관한 법률 제624조제1항에 따라 ‘채무자를 면책한다’라는 결정을 구합니다.</p>
<p class="date">${esc(dotDate(f.applyDate))}</p>
<p class="signer">신청인(채무자)　${esc(f.name)}　${sign || '(서명 또는 날인)'}</p>
<p class="signer">연락 가능한 전화번호: ${esc(contact)}</p>
<p class="court">${esc(courtLabel(f.courtName))} 귀중</p>
<p class="note">※ 환급계좌에는 채무자 본인 명의의 은행계좌번호를 기재합니다.</p>
</body></html>`;
}

export function dischargeFileBase(f: DischargeForm): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 20);
  return `면책신청서_${safe(f.caseNumber) || '사건'}_${f.applyDate.replace(/-/g, '')}`;
}
