// api/_lib/rate-limiter.js
// [SECURITY Multi-Tier Sliding Window & Auto-Jail]
// 1분(Burst), 10분(누적), 30분(Drip 공격) 다단계 요청 검사 및 위반자 30분 격리(Jail)

const ipTracker = new Map();

// 기본 다단계 제한 프로필
export const RATE_LIMIT_TIERS = {
  // 1. 민감 유료 발송 API (알림톡, SMS, 텔레그램 알림)
  // 정상 고객은 10분 내 2~3회 이상 발송할 일이 없으므로 엄격 제한
  STRICT: {
    minute: { max: 3, windowMs: 60 * 1000 },          // 1분 최대 3회
    tenMin: { max: 5, windowMs: 10 * 60 * 1000 },     // 10분 최대 5회
    thirtyMin: { max: 10, windowMs: 30 * 60 * 1000 }, // 30분 최대 10회
    jailMs: 30 * 60 * 1000,                          // 위반 시 30분간 전면 차단
  },

  // 2. 표준 API (계약서 검증, 인보이스 등)
  STANDARD: {
    minute: { max: 10, windowMs: 60 * 1000 },         // 1분 최대 10회
    tenMin: { max: 30, windowMs: 10 * 60 * 1000 },    // 10분 최대 30회
    thirtyMin: { max: 60, windowMs: 30 * 60 * 1000 }, // 30분 최대 60회
    jailMs: 15 * 60 * 1000,                          // 위반 시 15분간 차단
  },

  // 3. 일반 조회 API
  RELAXED: {
    minute: { max: 30, windowMs: 60 * 1000 },
    tenMin: { max: 100, windowMs: 10 * 60 * 1000 },
    thirtyMin: { max: 200, windowMs: 30 * 60 * 1000 },
    jailMs: 10 * 60 * 1000,
  }
};

/**
 * 다단계 슬라이딩 윈도우 + 위반자 즉시 격리(Auto-Jail) 검사
 */
export function checkMultiTierRateLimit(key, tier = RATE_LIMIT_TIERS.STRICT) {
  const now = Date.now();
  let record = ipTracker.get(key) || {
    timestamps: [],
    jailedUntil: 0,
    violations: 0,
  };

  // 1. 이미 감옥(Jail)에 수감된 IP인지 확인 (0ms 입구컷)
  if (now < record.jailedUntil) {
    const retryAfterSec = Math.ceil((record.jailedUntil - now) / 1000);
    return {
      isLimited: true,
      reason: 'JAILED',
      retryAfter: retryAfterSec,
      current: record.timestamps.length,
      remaining: 0,
    };
  }

  // 30분 초과한 오래된 타임스탬프 정리
  const maxWindow = tier.thirtyMin?.windowMs || (30 * 60 * 1000);
  record.timestamps = record.timestamps.filter(t => now - t < maxWindow);

  // 2. 단기 (1분), 중기 (10분), 장기 (30분) 누적 요청 검사
  const count1Min = record.timestamps.filter(t => now - t < tier.minute.windowMs).length;
  const count10Min = record.timestamps.filter(t => now - t < tier.tenMin.windowMs).length;
  const count30Min = record.timestamps.length;

  if (
    count1Min >= tier.minute.max ||
    count10Min >= tier.tenMin.max ||
    count30Min >= tier.thirtyMin.max
  ) {
    // 🚨 위반 감지 -> 지정된 시간(기본 30분) 동안 즉시 Jail 격리
    record.violations++;
    // 반복 위반 시 격리 시간 가중 (1회: 30분, 2회: 1시간, 3회: 2시간)
    const multiplier = Math.min(4, record.violations);
    const jailDuration = (tier.jailMs || (30 * 60 * 1000)) * multiplier;
    record.jailedUntil = now + jailDuration;

    ipTracker.set(key, record);

    const retryAfterSec = Math.ceil(jailDuration / 1000);
    console.warn(`[SECURITY RateLimit JAIL] Key ${key} jailed for ${retryAfterSec}s (1m: ${count1Min}/${tier.minute.max}, 10m: ${count10Min}/${tier.tenMin.max}, 30m: ${count30Min}/${tier.thirtyMin.max})`);

    return {
      isLimited: true,
      reason: 'LIMIT_EXCEEDED',
      retryAfter: retryAfterSec,
      current: count30Min + 1,
      remaining: 0,
    };
  }

  // 통과 -> 현재 타임스탬프 추가
  record.timestamps.push(now);
  ipTracker.set(key, record);

  // 메모리 정리: 5,000개 초과 시 만료된 키 전수 삭제
  if (ipTracker.size > 5000) {
    for (const [k, v] of ipTracker.entries()) {
      if (now > v.jailedUntil && v.timestamps.length === 0) {
        ipTracker.delete(k);
      }
    }
  }

  const remaining = Math.max(0, tier.minute.max - count1Min - 1);
  return {
    isLimited: false,
    reason: 'OK',
    retryAfter: 0,
    current: count1Min + 1,
    remaining,
  };
}

/**
 * 하위 호환성을 위한 단일 윈도우 검사 함수
 */
export function checkRateLimit(key, max = 60, windowMs = 60000) {
  const dynamicTier = {
    minute: { max, windowMs },
    tenMin: { max: max * 3, windowMs: windowMs * 10 },
    thirtyMin: { max: max * 5, windowMs: windowMs * 30 },
    jailMs: 15 * 60 * 1000,
  };
  const res = checkMultiTierRateLimit(key, dynamicTier);
  return {
    isLimited: res.isLimited,
    current: res.current,
    remaining: res.remaining,
    resetTime: Date.now() + (res.retryAfter * 1000 || windowMs),
  };
}

/**
 * 핸들러를 감싸 다단계 Rate Limiting을 강제 적용하는 미들웨어
 */
export function withMultiTierRateLimit(handler, tier = RATE_LIMIT_TIERS.STRICT) {
  return async (req, res) => {
    if (req.method === 'OPTIONS') {
      return handler(req, res);
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
    const path = req.url?.split('?')[0] || 'endpoint';
    const clientKey = `${ip}:${path}`;

    const limit = checkMultiTierRateLimit(clientKey, tier);

    res.setHeader('X-RateLimit-Limit', tier.minute.max);
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    if (limit.retryAfter > 0) {
      res.setHeader('Retry-After', limit.retryAfter);
    }

    if (limit.isLimited) {
      return res.status(429).json({
        ok: false,
        error: `Too Many Requests: 비정상적인 반복 호출이 감지되어 보안을 위해 일시적으로 차단되었습니다. (${Math.ceil(limit.retryAfter / 60)}분 후 재시도 가능)`,
        retryAfter: limit.retryAfter,
      });
    }

    return handler(req, res);
  };
}
