// api/lib/auth-middleware.js
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 생성 (서버 환경 변수 사용)
// 보안을 위해 서비스 롤 키를 사용하여 어드민 권한으로 확인
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function verifyAuth(req, requiredRole = null) {
  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('인증 토큰이 누락되었습니다.');
  }

  const token = authHeader.split(' ')[1];
  
  // Supabase Auth를 통해 토큰 검증 및 사용자 정보 가져오기
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('유효하지 않은 토큰입니다.');
  }

  // 권한(Role) 확인이 필요한 경우 app_metadata.role 검사
  if (requiredRole) {
    const userRole = user.app_metadata?.role;
    if (userRole !== requiredRole) {
      throw new Error(`접근 권한이 없습니다. (${requiredRole} 필요)`);
    }
  }

  return user;
}

export function withAuth(handler, options = {}) {
  // 기존 핸들러를 감싸서 인증 로직 추가
  return async (req, res) => {
    // OPTIONS 요청(CORS 프리플라이트)은 인증 생략
    if (req.method === 'OPTIONS') {
      return handler(req, res);
    }

    try {
      // 인증 및 권한 확인
      const user = await verifyAuth(req, options.requiredRole);
      req.user = user; // 확인된 사용자 정보를 req 객체에 저장
      return handler(req, res);
    } catch (err) {
      return res.status(401).json({ ok: false, error: err.message });
    }
  };
}
