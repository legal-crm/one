// api/_lib/rate-limiter.js
// [SECURITY Anti-Scraping] 슬라이딩 윈도우 기반 메모리 Rate Limiter

const rateLimits = new Map();
const DEFAULT_WINDOW_MS = 60 * 1000; // 1분
const DEFAULT_MAX_REQUESTS = 60;     // 분당 최대 60회

/**
 * 특정 키(IP 또는 사용자 식별자)에 대한 요청 빈도를 검사합니다.
 */
export function checkRateLimit(key, max = DEFAULT_MAX_REQUESTS, windowMs = DEFAULT_WINDOW_MS) {
  const now = Date.now();
  const record = rateLimits.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }

  rateLimits.set(key, record);

  // 메모리 누수 방지: 5,000개 초과 시 만료된 키 정리
  if (rateLimits.size > 5000) {
    for (const [k, v] of rateLimits.entries()) {
      if (now > v.resetTime) rateLimits.delete(k);
    }
  }

  return {
    isLimited: record.count > max,
    current: record.count,
    remaining: Math.max(0, max - record.count),
    resetTime: record.resetTime,
  };
}

/**
 * 핸들러를 래핑하여 Rate Limiting을 적용합니다.
 */
export function withRateLimit(handler, options = {}) {
  const max = options.max || DEFAULT_MAX_REQUESTS;
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;

  return async (req, res) => {
    // OPTIONS 요청은 Rate Limit 제외
    if (req.method === 'OPTIONS') {
      return handler(req, res);
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '127.0.0.1');
    const path = req.url?.split('?')[0] || 'endpoint';
    const clientKey = `${ip}:${path}`;

    const limit = checkRateLimit(clientKey, max, windowMs);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(limit.resetTime / 1000));

    if (limit.isLimited) {
      console.warn(`[SECURITY RateLimit] IP ${ip} exceeded limit on ${path}: ${limit.current}/${max}`);
      return res.status(429).json({
        ok: false,
        error: 'Too Many Requests: 비정상적으로 많은 요청이 감지되었습니다. 잠시 후 다시 시도해 주세요.',
      });
    }

    return handler(req, res);
  };
}
