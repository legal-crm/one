// 마케팅 자동화 수준 (M-1, MK-Q1: 기본 L2·엄격) — 서버·브라우저·시험 공용 순수 함수 (외부 호출 없음)
//   L1: 매일 초안만 만들고 승인·게시는 사람
//   L2: 아침 자동 생성분 중 고위험·수정 권고 표시가 하나도 없고 점수가 기준 이상이면 자동 승인.
//       승인된 캠페인(자동·사람)은 표시 없는 API 채널(스레드·페이스북)만 황금 시간표에 맞춰 자동 게시.
//       표시가 남은 채널은 사람이 '자동 게시' 버튼으로만 올린다.
//   checkMode strict(기본): 고위험 표현이 남으면 승인 불가 / advisory: 사유(5자 이상)를 적으면 승인 가능(조치 기록)
// 설정 원본: platform_config 'marketing_automation' (admin_set_marketing_automation), 읽기: marketing_automation_config()

export const AUTO_CHANNELS = ['threads', 'facebook'];

/** 서버 기본값 (저장값이 없을 때 DB 함수가 돌려주는 값과 같다) */
export const AUTOMATION_DEFAULTS = Object.freeze({ level: 'L2', checkMode: 'strict', minScore: 90, autoChannels: [...AUTO_CHANNELS], updatedAt: null });

/** 설정을 읽지 못했을 때: 자동 동작 없음(L1) */
export const AUTOMATION_OFF = Object.freeze({ level: 'L1', checkMode: 'strict', minScore: 90, autoChannels: [], updatedAt: null });

export function normalizeAutomationConfig(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const min = Number(d.minScore);
  return {
    level: d.level === 'L2' ? 'L2' : 'L1',
    checkMode: d.checkMode === 'advisory' ? 'advisory' : 'strict',
    minScore: Number.isFinite(min) ? Math.min(100, Math.max(70, Math.round(min))) : 90,
    autoChannels: Array.isArray(d.autoChannels) ? AUTO_CHANNELS.filter(c => d.autoChannels.includes(c)) : [],
    updatedAt: typeof d.updatedAt === 'string' && d.updatedAt ? d.updatedAt : null,
  };
}

/** 캠페인 검사 결과의 심각도별 건수 (고지문 누락·관리자가 더한 표현은 '수정 권고'로 들어 있다) */
export function severityCounts(compliance) {
  const out = { high: 0, medium: 0, low: 0 };
  for (const r of Object.values(compliance?.byChannel || {})) {
    for (const i of r?.issues || []) if (Object.prototype.hasOwnProperty.call(out, i?.severity)) out[i.severity] += 1;
  }
  return out;
}

/**
 * 아침 자동 생성분을 자동 승인할지 (L2만)
 * @returns {{ approve: boolean, reason?: 'level'|'empty'|'high'|'medium'|'score', score: number, counts: {high:number,medium:number,low:number}, note?: string }}
 */
export function autoApprovalDecision(compliance, config) {
  const cfg = normalizeAutomationConfig(config);
  const counts = severityCounts(compliance);
  const score = Number.isFinite(Number(compliance?.score)) ? Number(compliance.score) : 0;
  if (cfg.level !== 'L2') return { approve: false, reason: 'level', score, counts };
  if (!Object.keys(compliance?.byChannel || {}).length) return { approve: false, reason: 'empty', score, counts };
  if (counts.high > 0 || Number(compliance?.highCount) > 0) return { approve: false, reason: 'high', score, counts };
  if (counts.medium > 0) return { approve: false, reason: 'medium', score, counts };
  if (score < cfg.minScore) return { approve: false, reason: 'score', score, counts };
  return { approve: true, score, counts, note: `자동 승인(L2): 고위험·수정 권고 0건 · 점수 ${score}점(기준 ${cfg.minScore}점)` };
}

/** 자동 승인하지 않은 이유 (승인함에 보여 줄 문장) */
export function autoHoldMessage(decision, config) {
  const cfg = normalizeAutomationConfig(config);
  switch (decision?.reason) {
    case 'level': return '자동화 수준이 L1이라 사람이 승인해야 해요.';
    case 'empty': return '검사할 채널 콘텐츠가 없어요.';
    case 'high': return `고위험 표현 ${decision.counts.high}건이 있어 승인함에서 기다려요.`;
    case 'medium': return `수정 권고 ${decision.counts.medium}건이 있어 승인함에서 기다려요.`;
    case 'score': return `점수 ${decision.score}점이 자동 승인 기준(${cfg.minScore}점)보다 낮아 승인함에서 기다려요.`;
    default: return '';
  }
}

/**
 * 사람이 승인할 때: 엄격 모드는 고위험이 남으면 막고, 권고 모드는 사유를 받으면 허용
 * @returns {{ ok: true, kind: 'manual'|'advisory', high: number, note: string|null, reason: string|null } | { ok: false, status: number, error: string }}
 */
export function manualApprovalCheck(compliance, config, reason) {
  const cfg = normalizeAutomationConfig(config);
  const high = Math.max(severityCounts(compliance).high, Number(compliance?.highCount) || 0);
  if (high === 0) return { ok: true, kind: 'manual', high: 0, note: null, reason: null };
  if (cfg.checkMode !== 'advisory') {
    return { ok: false, status: 409, error: `고위험 표현 ${high}건이 남아 있어 승인할 수 없습니다. 수정 후 다시 승인하세요.` };
  }
  const r = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim() : '';
  if (r.length < 5) {
    return { ok: false, status: 400, error: `권고 모드에서 고위험 표현 ${high}건을 남긴 채 승인하려면 사유를 5자 이상 적어 주세요.` };
  }
  const clipped = r.slice(0, 250);
  return { ok: true, kind: 'advisory', high, note: `권고 모드 승인(고위험 ${high}건): ${clipped}`, reason: r.slice(0, 500) };
}

/** 한국 시간 'HH:MM' */
export function kstClock(now = Date.now()) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(11, 16);
}

/** 낮 자동 게시 실행 시각 (KST) — 마이그레이션 20261101005700 의 pg_cron('35 3 * * *'·'5 5 * * *' UTC)과 같아야 한다 */
export const AUTO_PUBLISH_RUNS = ['12:35', '14:05'];

/** 시간표 시각이 slotTime 인 채널이 오늘 자동 게시될 다음 실행 시각 (지났으면 null) */
export function nextAutoRun(slotTime, clock) {
  if (!/^\d{2}:\d{2}$/.test(slotTime || '') || !/^\d{2}:\d{2}$/.test(clock || '')) return null;
  return AUTO_PUBLISH_RUNS.find(r => r >= slotTime && r > clock) || null;
}

/**
 * 지금 자동 게시할 채널: 설정에서 켠 API 채널 중 서버 키가 있고, 시간표 시각이 지났고,
 * 아직 게시(자동·직접 기록)되지 않았고, 그 채널 콘텐츠가 있고, 고위험·수정 권고 표시가 없는 것
 */
export function dueAutoChannels({ config, schedule, clock, connected, posts, channels, compliance }) {
  const cfg = normalizeAutomationConfig(config);
  if (cfg.level !== 'L2' || !/^\d{2}:\d{2}$/.test(clock || '')) return [];
  const done = new Set((posts || [])
    .filter(p => p?.publish_status === 'published' || p?.publish_status === 'published_manual')
    .map(p => p.channel));
  return cfg.autoChannels.filter(ch => {
    const slot = (schedule || []).find(s => s?.channel === ch);
    if (!slot || !/^\d{2}:\d{2}$/.test(slot.time || '') || slot.time > clock) return false;
    if (!connected?.[ch] || done.has(ch) || !channels?.[ch]) return false;
    const issues = compliance?.byChannel?.[ch]?.issues || [];
    return !issues.some(i => i?.severity === 'high' || i?.severity === 'medium');
  });
}
