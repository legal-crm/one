// 담당자 카톡 안내 → 알림톡 자동 대체 (KT-2)
// POST /api/popbill?service=notice-fallback  — Supabase pg_cron(pg_net)만 부른다 (10분마다, 09~19시 KST)
//  * 호출 확인: 헤더 x-mykim-cron 값을 DB vault 토큰과 비교 (check_cron_token, service role)
//  * 보낼 목록: claim_client_notice_fallbacks() — 담당자 카톡 기한(근무 시간 기준)이 지난 할 일만, '보내는 중'으로 잠근다
//  * 결과: finish_client_notice_fallback() — 성공하면 소통 기록에 '알림톡'으로 남기고 번호를 지운다.
//    실패(템플릿 승인 전 등)는 사무소에 알리고 할 일은 오늘의 업무에 남는다
//  * 문구는 할 일을 만들 때 저장한 알림톡 문안 그대로 (카카오 검수 문안과 같아야 발송된다)

import { kakaoService, POPBILL_CONFIG } from '../popbill-service.js';
import { supabase } from '../auth-middleware.js';
import { resolveMilestoneTemplate, isIssuedTemplateCode } from './alimtok.js';

const finish = (id, ok, channel, receipt, error) =>
  supabase.rpc('finish_client_notice_fallback', { p_id: id, p_ok: ok, p_channel: channel, p_receipt: receipt, p_error: error });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ ok: false, error: 'server key missing' });

  const token = String(req.headers['x-mykim-cron'] || '');
  const { data: okToken, error: tokenErr } = await supabase.rpc('check_cron_token', { p_token: token });
  if (tokenErr || okToken !== true) return res.status(401).json({ ok: false, error: 'unauthorized' });

  const { data: rows, error } = await supabase.rpc('claim_client_notice_fallbacks', { p_limit: 20 });
  if (error) {
    console.error('[notice-fallback] claim failed:', error.message);
    return res.status(500).json({ ok: false, error: 'claim failed' });
  }

  let sent = 0;
  let failed = 0;
  for (const r of rows || []) {
    const templateCode = resolveMilestoneTemplate(r.milestone) || '';
    if (!POPBILL_CONFIG.isConfigured) {
      await finish(r.id, false, 'not_sent', null, '알림톡 서비스(팝빌)가 설정되지 않아 대신 보내지 못했어요');
      failed++;
      continue;
    }
    if (!isIssuedTemplateCode(templateCode)) {
      await finish(r.id, false, 'not_sent', null, '카카오 검수 승인된 알림톡 템플릿이 없어 대신 보내지 못했어요');
      failed++;
      continue;
    }
    const content = String(r.alimtok_text || '');
    try {
      const receiptNum = await new Promise((resolve, reject) => {
        kakaoService.sendATS_one(
          POPBILL_CONFIG.corpNum, templateCode, String(POPBILL_CONFIG.senderPhone || '').replace(/[^0-9]/g, ''),
          content, '[마이김변] 진행 안내', content, 'C', null,
          r.phone, r.receiver_name || '의뢰인', POPBILL_CONFIG.userId, `NTC-${r.id}`.slice(0, 36), null,
          (result) => resolve(result), (err) => reject(err),
        );
      });
      await finish(r.id, true, 'alimtalk', String(receiptNum || ''), null);
      sent++;
    } catch (e) {
      console.warn('[notice-fallback] send failed:', e?.code, e?.message);
      await finish(r.id, false, 'alimtalk', null, '알림톡 접수에 실패했어요. 팝빌 전송내역·템플릿 상태를 확인해 주세요');
      failed++;
    }
  }
  return res.status(200).json({ ok: true, claimed: (rows || []).length, sent, failed });
}
