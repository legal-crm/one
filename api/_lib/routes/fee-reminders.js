// 수임료 납부 안내 알림톡 예약 발송 (FE-7)
// POST /api/popbill?service=reminders  — Supabase pg_cron(pg_net)만 부른다 (매시 05분, 09~19시 KST)
//  * 호출 확인: 헤더 x-mykim-cron 값을 DB vault 토큰과 비교 (check_cron_token, service role)
//  * 보낼 목록: claim_fee_reminders() — 보내기 직전에 남은 금액·연락처를 DB가 다시 확인하고 '보내는 중'으로 잠근다
//  * 결과: finish_fee_reminder() — 보냄/실패와 사유를 남긴다 (승인 템플릿이 없으면 보내지 않고 '실패: 템플릿 승인 전')
//  * 문구는 카카오 검수 신청 문안(src/services/alimtokService.ts MYKIM_ATS_12~14)과 같아야 한다. '독촉' 표현 없음 (FE-Q4)

import { kakaoService, POPBILL_CONFIG } from '../popbill-service.js';
import { supabase } from '../auth-middleware.js';
import { resolveMilestoneTemplate, isIssuedTemplateCode } from './alimtok.js';

const LINK = 'https://mykim.kr/?tab=mypage';

const KIND = {
  d_minus_3: { milestone: 'fee_upcoming', subject: '수임료 분납 예정 안내' },
  due: { milestone: 'fee_due', subject: '수임료 당일 납부 안내' },
  d_plus_1: { milestone: 'fee_overdue', subject: '수임료 납부기한 경과 안내' },
  d_plus_7: { milestone: 'fee_overdue', subject: '수임료 납부기한 경과 안내' },
};

const won = (n) => `${Number(n || 0).toLocaleString('ko-KR')}원`;
const ymd = (d) => { const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${y}. ${Number(m)}. ${Number(dd)}.`; };

export function renderReminder(r) {
  const office = r.office_name || '담당 사무소';
  const name = r.client_name || '의뢰인';
  if (r.kind === 'd_minus_3') {
    return `[${office}] 수임료 분납 예정 안내\n\n${name}님, 사건 착수 및 수임료 분납 일정을 안내해 드립니다.\n\n■ 납부 항목: ${r.item_label}\n■ 입금 금액: ${won(r.remaining_won)}\n■ 입금 계좌: ${r.account_text}\n■ 입금 기한: ${ymd(r.due_on)}\n\n원활한 사건 진행을 위해 기한 내 입금 부탁드립니다.\n▶ 납부 현황 확인: ${LINK}`;
  }
  if (r.kind === 'due') {
    return `[${office}] 수임료 당일 납부 안내\n\n${name}님, 오늘은 약정된 수임료 납부일입니다.\n\n■ 납부 항목: ${r.item_label}\n■ 입금 금액: ${won(r.remaining_won)}\n■ 입금 계좌: ${r.account_text}\n\n입금 확인 후 마이페이지에서 납부 확인증을 조회하실 수 있습니다.\n▶ 납부 현황 확인: ${LINK}`;
  }
  return `[${office}] 수임료 연체 미납 안내\n\n${name}님, 약정된 수임료 납부기한(${ymd(r.due_on)})이 경과되어 안내드립니다.\n\n■ 미납 항목: ${r.item_label}\n■ 미납 금액: ${won(r.remaining_won)}\n■ 입금 계좌: ${r.account_text}\n\n납부 일정 조율이나 상담이 필요하신 경우 사무소로 연락 부탁드립니다.\n▶ 납부 및 문의: ${LINK}`;
}

const finish = (id, status, channel, receipt, error) =>
  supabase.rpc('finish_fee_reminder', { p_id: id, p_status: status, p_channel: channel, p_receipt: receipt, p_error: error });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, error: 'server key missing' });

  const token = String(req.headers['x-mykim-cron'] || '');
  const { data: okToken, error: tokenErr } = await supabase.rpc('check_cron_token', { p_token: token });
  if (tokenErr || okToken !== true) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const { data: rows, error } = await supabase.rpc('claim_fee_reminders', { p_limit: 20 });
  if (error) {
    console.error('[fee-reminders] claim failed:', error.message);
    return res.status(500).json({ ok: false, error: 'claim failed' });
  }

  let sent = 0;
  let failed = 0;
  for (const r of rows || []) {
    const cfg = KIND[r.kind] || KIND.due;
    const templateCode = resolveMilestoneTemplate(cfg.milestone) || '';
    if (!POPBILL_CONFIG.isConfigured) {
      await finish(r.reminder_id, 'failed', 'not_sent', null, '알림톡 서비스(팝빌)가 설정되지 않아 보내지 않았습니다');
      failed++;
      continue;
    }
    if (!isIssuedTemplateCode(templateCode)) {
      await finish(r.reminder_id, 'failed', 'not_sent', null, '카카오 검수 승인된 알림톡 템플릿이 없어 보내지 않았습니다');
      failed++;
      continue;
    }
    const content = renderReminder(r);
    try {
      const receiptNum = await new Promise((resolve, reject) => {
        kakaoService.sendATS_one(
          POPBILL_CONFIG.corpNum, templateCode, String(POPBILL_CONFIG.senderPhone || '').replace(/[^0-9]/g, ''),
          content, `[${r.office_name || '마이김변'}] ${cfg.subject}`, content, 'C', null,
          r.phone, r.client_name || '의뢰인', POPBILL_CONFIG.userId, `FEE-${r.reminder_id}`.slice(0, 36), null,
          (result) => resolve(result), (err) => reject(err),
        );
      });
      await finish(r.reminder_id, 'sent', 'alimtalk', String(receiptNum || ''), null);
      sent++;
    } catch (e) {
      console.warn('[fee-reminders] send failed:', e?.code, e?.message);
      await finish(r.reminder_id, 'failed', 'alimtalk', null, '알림톡 접수에 실패했습니다. 팝빌 전송내역·템플릿 상태를 확인해 주세요');
      failed++;
    }
  }
  return res.status(200).json({ ok: true, claimed: (rows || []).length, sent, failed });
}
