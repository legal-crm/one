// ============================================================================
// QA용 가상 상담 데이터 시딩 / 정리 (service role 사용 — 로컬 전용, 배포 금지)
//
//   시딩: node scripts/qa-seed-test-consults.mjs
//   정리: node scripts/qa-seed-test-consults.mjs --cleanup
//
// 대상: 의뢰인 aimart9999@gmail.com / 변호사 amjone8@gmail.com (lawyer-1788446057289)
// 생성 데이터는 id가 'req-qa-'로 시작하고 제목에 [테스트]가 붙는다.
// 메시지는 consult_requests ON DELETE CASCADE로 함께 지워진다.
// ============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const CLIENT_EMAIL = 'aimart9999@gmail.com';
const LAWYER_EMAIL = 'amjone8@gmail.com';
const ID_PREFIX = 'req-qa-';

const read = f => Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const env = { ...read('.env'), ...read('.env.local') };
if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('.env.local에 SUPABASE_SERVICE_ROLE_KEY가 없습니다.');
const svc = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function cleanup() {
  const { data, error } = await svc.from('consult_requests').delete().like('id', `${ID_PREFIX}%`).select('id');
  if (error) throw error;
  console.log(`삭제한 테스트 상담 ${data.length}건 (메시지는 CASCADE 삭제)`, data.map(r => r.id).join(', '));
}

if (process.argv.includes('--cleanup')) {
  await cleanup();
  process.exit(0);
}

// ── 계정 확인 ──
const { data: { users }, error: listError } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
const client = users.find(u => (u.email || '').toLowerCase() === CLIENT_EMAIL);
const lawyerUser = users.find(u => (u.email || '').toLowerCase() === LAWYER_EMAIL);
if (!client || !lawyerUser) throw new Error('대상 계정을 찾지 못했습니다.');
const { data: acc } = await svc.from('lawyer_accounts').select('lawyer_id, approved').eq('auth_user_id', lawyerUser.id).single();
if (!acc?.approved) throw new Error('변호사 계정이 서버 승인 상태가 아닙니다.');
const LID = acc.lawyer_id;
const { data: lawyerProfile } = await svc.from('lawyers').select('name, firm_name, avatar').eq('id', LID).maybeSingle();
const LAWYER_NAME = lawyerProfile?.name || 'amjone 변호사';
const FIRM_NAME = lawyerProfile?.firm_name || `${LAWYER_NAME} 법률사무소`;
const CID = client.id;
const ALIAS = client.user_metadata?.alias || '테스트 의뢰인';

// 기존 테스트 데이터는 지우고 새로 만든다 (재실행 가능)
await cleanup();

const now = Date.now();
const H = 3600_000;
const iso = ms => new Date(now - ms).toISOString();
const stamp = String(now);
const id = s => `${ID_PREFIX}${stamp}-${s}`;

const proposal = (reqId, createdMs, over = {}) => ({
  id: `prop-qa-${stamp}-${reqId}`,
  lawyerId: LID,
  lawyerName: LAWYER_NAME,
  lawyerAvatar: lawyerProfile?.avatar || '',
  firmName: FIRM_NAME,
  feasibility: '개인회생 개시 가능성 높음',
  monthlyPayment: 95,
  duration: 36,
  reductionRate: 72,
  totalReduction: 8780,
  fee: 250,
  installment: '착수금 50만 원, 잔금 10개월 분납',
  remark: '소득 대비 채무 비율이 높아 36개월 변제 계획으로 진행하는 것이 유리합니다.',
  createdAt: iso(createdMs),
  approvalStatus: 'approved',
  approvedByLawyerId: LID,
  approvedByLawyerName: LAWYER_NAME,
  approvedAt: iso(createdMs),
  ...over,
});

const base = {
  client_id: CID,
  client_name: ALIAS,
  phone: '010-0000-1234',
  max_participants: 1,
  rejection_notified: false,
  phone_consultation_requested: false,
  admin_hidden: false,
};

// ── 시나리오 A: 요청 접수 (변호사가 제안서를 작성할 차례) ──
const reqA = {
  ...base,
  id: id('a'),
  request_type: 'direct',
  status: 'requested',
  selected_lawyer_id: null,
  selected_lawyer_ids: [LID],
  accepted_lawyer_ids: [],
  proposals: [],
  title: '[테스트] 카드론·리볼빙 연체로 개인회생 상담 요청',
  content: '카드 3곳 리볼빙과 카드론이 쌓여 매달 이자만 120만 원 정도 나갑니다. 월급은 280만 원이고 혼자 살고 있습니다. 개인회생이 가능한지, 변제금이 얼마 정도 될지 궁금합니다.',
  entry_category: { type: 'debt_type', id: 'card_revolving', label: '카드론·리볼빙 연체' },
  financial_profile: {
    clientId: CID, clientName: ALIAS,
    income: 280, debtTotal: 6200, assetsTotal: 800, dependents: 0, maritalStatus: 'single',
    debtTypes: { banks: 1500, cards: 4200, personals: 0, recentLoans: 500, coinCrypto: 0 },
    riskFlags: ['최근 1년 이내 대출 과다'],
    jobType: 'SALARIED', employmentType: 'salary', age: 34, gender: 'male',
    residenceRegion: '서울', selectedCourt: '서울회생법원', housingType: 'rent', rentCost: 55, rentalDeposit: 1000,
    debtCause: 'LIVING', harassmentLevel: 'CALL', creditorCount: 6, priorityDebt: 0, retirementPensionType: 'pension', retirementPay: 700,
    debts: [
      { creditor: '신한카드', amount: 1800, type: '카드론' },
      { creditor: '삼성카드', amount: 1400, type: '리볼빙' },
      { creditor: '현대카드', amount: 1000, type: '카드론' },
      { creditor: '국민은행', amount: 1500, type: '신용대출' },
      { creditor: 'OK저축은행', amount: 500, type: '신용대출' },
    ],
  },
  created_at: iso(2 * H),
  updated_at: iso(2 * H),
};

// ── 시나리오 B: 제안서 도착 (의뢰인이 제안서 확인·수락할 차례) ──
const reqB = {
  ...base,
  id: id('b'),
  request_type: 'direct',
  status: 'responding',
  selected_lawyer_id: null,
  selected_lawyer_ids: [LID],
  accepted_lawyer_ids: [],
  proposals: [proposal('b', 20 * H, {
    feasibility: '개인파산·면책 가능성 검토 필요 (소득 대비 채무 과다)',
    monthlyPayment: 0, duration: 0, reductionRate: 100, totalReduction: 9400, fee: 200,
    installment: '착수금 50만 원, 잔금 6개월 분납',
    remark: '폐업 후 소득이 불안정해 회생보다 파산·면책이 적합해 보입니다. 재산 목록 확인 후 확정하겠습니다.',
  })],
  title: '[테스트] 폐업 후 사업자 대출 연체 — 파산 가능 여부',
  content: '작년에 음식점을 폐업했고 사업자 대출과 카드빚이 남았습니다. 지금은 일용직으로 월 150만 원 정도 벌고 있습니다. 파산이 가능한지 알고 싶습니다.',
  entry_category: { type: 'solution', id: 'bankruptcy', label: '개인파산' },
  financial_profile: {
    clientId: CID, clientName: ALIAS,
    income: 150, debtTotal: 9400, assetsTotal: 300, dependents: 1, maritalStatus: 'divorced',
    debtTypes: { banks: 6000, cards: 2400, personals: 1000, recentLoans: 0, coinCrypto: 0 },
    riskFlags: ['소득 대비 과다 채무'],
    jobType: 'DAILY', employmentType: 'daily', age: 47, gender: 'female', minorChildren: 1,
    residenceRegion: '경기', selectedCourt: '수원회생법원', housingType: 'rent', rentCost: 40, rentalDeposit: 500,
    debtCause: 'BUSINESS', harassmentLevel: 'LETTER', creditorCount: 5,
    debts: [
      { creditor: '기업은행', amount: 4000, type: '사업자대출' },
      { creditor: '신용보증재단', amount: 2000, type: '보증채무' },
      { creditor: '롯데카드', amount: 1400, type: '카드대금' },
      { creditor: '우리카드', amount: 1000, type: '카드론' },
      { creditor: '지인', amount: 1000, type: '개인채무' },
    ],
  },
  created_at: iso(26 * H),
  updated_at: iso(20 * H),
};

// ── 시나리오 C: 상담 진행 중 (채팅·계약 진행 테스트) ──
const reqC = {
  ...base,
  id: id('c'),
  request_type: 'direct',
  status: 'counseling',
  selected_lawyer_id: LID,
  selected_lawyer_ids: [LID],
  accepted_lawyer_ids: [LID],
  proposals: [proposal('c', 60 * H, { viewedAt: iso(58 * H) })],
  title: '[테스트] 급여 압류 예정 — 개인회생 신청 상담',
  content: '대부업체에서 급여 압류를 하겠다는 통지를 받았습니다. 맞벌이이고 아이가 둘 있습니다. 빨리 신청해서 압류를 막고 싶습니다.',
  entry_category: { type: 'solution', id: 'rehab', label: '개인회생' },
  financial_profile: {
    clientId: CID, clientName: ALIAS,
    income: 320, debtTotal: 12200, assetsTotal: 2500, dependents: 2, maritalStatus: 'married',
    debtTypes: { banks: 5000, cards: 3200, personals: 0, recentLoans: 1500, coinCrypto: 2500 },
    riskFlags: ['사행성 채무(코인/토토)', '최근 1년 이내 대출 과다'],
    jobType: 'SALARIED', employmentType: 'salary', age: 39, gender: 'male', minorChildren: 2,
    spouseIncome: 210, spouseIsWorking: true, cohabitingSpouse: true,
    residenceRegion: '인천', selectedCourt: '인천지방법원', housingType: 'jeonse', rentalDeposit: 18000, depositLoan: 12000,
    debtCause: 'INVESTMENT', harassmentLevel: 'SEIZURE', creditorCount: 8, speculativeLoss: 2500, retirementPensionType: 'pension', retirementPay: 1400,
    legalActions: ['급여 압류 예고 통지'],
  },
  created_at: iso(72 * H),
  updated_at: iso(1 * H),
};

const requests = [reqA, reqB, reqC];
const { error: reqError } = await svc.from('consult_requests').insert(requests);
if (reqError) throw reqError;

// ── 메시지 (시나리오 C 상담방) ──
let seq = 0;
const msg = (reqId, type, text, agoMs) => ({
  id: `msg-qa-${stamp}-${++seq}`,
  consult_request_id: reqId,
  sender_type: type,
  sender_id: type === 'client' ? CID : type === 'lawyer' ? LID : 'system',
  sender_name: type === 'client' ? ALIAS : type === 'lawyer' ? LAWYER_NAME : '시스템 안내',
  message: text,
  created_at: iso(agoMs),
});
const messages = [
  msg(reqC.id, 'system', `${LAWYER_NAME}의 제안서를 수락하여 1:1 상담이 시작되었습니다.`, 57 * H),
  msg(reqC.id, 'client', '안녕하세요. 제안서 잘 봤습니다. 압류 통지를 받았는데 언제까지 신청하면 막을 수 있나요?', 56.5 * H),
  msg(reqC.id, 'lawyer', '안녕하세요. 개인회생을 신청하면서 금지명령을 함께 신청하면 보통 1~2주 안에 압류를 막을 수 있습니다. 급여명세서 3개월분과 부채증명서를 먼저 준비해 주세요.', 55 * H),
  msg(reqC.id, 'client', '코인 손실이 2,500만 원 정도 있는데 문제가 될까요?', 30 * H),
  msg(reqC.id, 'lawyer', '1년 이내 투자 손실은 청산가치에 반영될 수 있어 변제금이 조금 늘 수 있습니다. 거래소 입출금 내역을 함께 보내 주시면 정확히 계산해 드리겠습니다.', 29 * H),
  msg(reqC.id, 'client', '네, 내일까지 서류 준비해서 보내겠습니다. 계약은 어떻게 진행하나요?', 1 * H),
];
// 시나리오 B: 제안서 도착 알림
messages.push(msg(reqB.id, 'system', `${LAWYER_NAME}이(가) 제안서를 보냈습니다. 내용을 확인하고 상담 진행 여부를 선택해 주세요.`, 20 * H));

const { error: msgError } = await svc.from('consult_messages').insert(messages);
if (msgError) throw msgError;

// ── 확인 ──
const { data: check } = await svc.from('consult_requests')
  .select('id, status, request_type, selected_lawyer_id, selected_lawyer_ids, accepted_lawyer_ids, proposals, client_id')
  .like('id', `${ID_PREFIX}%`).order('created_at');
const { count } = await svc.from('consult_messages').select('id', { count: 'exact', head: true }).like('id', `msg-qa-${stamp}-%`);
console.log(`의뢰인 ${CLIENT_EMAIL} (uid ${CID.slice(0, 8)}…, 가명 "${ALIAS}")`);
console.log(`변호사 ${LAWYER_EMAIL} (${LID}, ${LAWYER_NAME})\n`);
for (const r of check) {
  console.log(`- ${r.id} | ${r.status} | ${r.request_type} | selected=${r.selected_lawyer_id} | selectedIds=${JSON.stringify(r.selected_lawyer_ids)} | accepted=${JSON.stringify(r.accepted_lawyer_ids)} | proposals=${r.proposals.length} | owner=${r.client_id === CID}`);
}
console.log(`\n메시지 ${count}건 생성`);
