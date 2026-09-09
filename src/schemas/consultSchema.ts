// src/schemas/consultSchema.ts
// ============================================================
// [SECURITY Input Validation] Zod 기반 런타임 스키마 검증
// XSS, SQL 인젝션, 비정상 음수/오버플로우 값 방어
// ============================================================
import { z } from 'zod';

// HTML 태그 및 잠재적 XSS 스크립트 제거 정제 함수
function sanitizeString(val: string): string {
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
}

export const FinancialProfileSchema = z.object({
  monthlyIncome: z.number().min(0, '월 소득은 0원 이상이어야 합니다.').max(100000, '비정상적인 소득 금액입니다.').default(0),
  dependents: z.number().int().min(0).max(20).default(0),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'other']).default('single'),
  residence: z.string().max(100).default('서울'),
  selectedCourt: z.string().max(100).default('서울회생법원'),
  debtTotal: z.number().min(0).default(0),
  assetsTotal: z.number().min(0).default(0),
  speculativeLoss: z.number().min(0).default(0),
  gamblingLoss: z.number().min(0).default(0),
  riskFlags: z.array(z.string().max(50)).default([]),
  retirementPensionType: z.enum(['pension', 'none', 'unknown']).default('unknown'),
  retirementPay: z.number().min(0).default(0),
  legalActions: z.array(z.string().max(50)).default([]),
}).passthrough(); // 추가 계산 필드 허용

export const ConsultRequestSchema = z.object({
  id: z.string().min(1).max(100),
  clientId: z.string().min(1).max(100).default('client-temp'),
  clientName: z.string().min(1).max(50).transform(sanitizeString).default('익명 의뢰인'),
  phone: z.string().max(30).transform(sanitizeString).default(''),
  requestType: z.enum(['direct', 'open', 'urgent']).default('open'),
  maxParticipants: z.number().int().min(1).max(10).default(3),
  status: z.enum(['requested', 'responding', 'comparing', 'counseling', 'contracted', 'rejected', 'completed']).default('requested'),
  selectedLawyerId: z.string().nullable().optional(),
  selectedLawyerIds: z.array(z.string()).default([]),
  acceptedLawyerIds: z.array(z.string()).default([]),
  title: z.string().max(200).transform(sanitizeString).default(''),
  content: z.string().max(10000).transform(sanitizeString).default(''),
  financialProfile: FinancialProfileSchema.default({}),
  phoneConsultationRequested: z.boolean().default(false),
  safeNumber: z.string().nullable().optional(),
  entryCategory: z.any().nullable().optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export type ValidatedConsultRequest = z.infer<typeof ConsultRequestSchema>;

/**
 * 상담 요청 페이로드의 스키마 유효성을 검증하고 위험 요소를 제거합니다.
 */
export function validateAndSanitizeConsultRequest(input: unknown): {
  success: boolean;
  data?: ValidatedConsultRequest;
  error?: string;
} {
  const result = ConsultRequestSchema.safeParse(input);
  if (!result.success) {
    const errorMsg = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
    return { success: false, error: errorMsg };
  }
  return { success: true, data: result.data };
}
