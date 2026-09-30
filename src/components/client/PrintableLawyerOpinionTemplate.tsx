import React from 'react';
import { 
  Scale, Shield, Check, FileText, Lock, ShieldCheck, CheckCircle2, 
  Calendar, Phone, Building2, Landmark
} from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface PrintableLawyerOpinionTemplateProps {
  result?: RehabCalculationResult;
  userInput?: RehabUserInput;
  proposal?: any;
  lawyerName?: string;
  lawyerFirmName?: string;
  clientName?: string;
  courtName?: string;
  totalDebt?: number;
  monthlyPayment?: number;
  debtReductionRate?: number;
  estimatedReduction?: number;
  repaymentMonths?: number;
  totalRepayment?: number;
  lawyerOpinion?: string;
  specialNotes?: string[];
  totalFeeWon?: number;
  downPaymentWon?: number;
  monthlyInstallmentWon?: number;
  installments?: number;
  additionalCostsNotice?: string;
  /** 문서번호 생성 기준 (제안서 ID) — 동명이인 충돌 방지 */
  documentId?: string;
  /** 작성일 (제안서 생성일). 없으면 오늘 */
  issuedAt?: string;
  /** 변호사가 등록한 인감 이미지 (없으면 '(인)' 표기만) */
  sealImageUrl?: string;
}

/** 문자열 → 안정적인 8자리 16진 해시 (FNV-1a) */
function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

// 기본값은 모두 '미입력' 상태 — 테스트용 이름·금액을 기본값으로 두지 않는다
export default function PrintableLawyerOpinionTemplate({
  result,
  userInput,
  proposal,
  lawyerName = '담당 변호사',
  lawyerFirmName = '',
  clientName = '의뢰인',
  courtName = '관할 회생법원',
  totalDebt = 0,
  monthlyPayment = 0,
  debtReductionRate = 0,
  estimatedReduction = 0,
  repaymentMonths = 36,
  totalRepayment = 0,
  lawyerOpinion,
  specialNotes = [],
  totalFeeWon = 0,
  downPaymentWon = 0,
  monthlyInstallmentWon = 0,
  installments = 0,
  additionalCostsNotice = '인지대·송달료 등 법원 실비는 별도입니다.',
  documentId,
  issuedAt,
  sealImageUrl,
}: PrintableLawyerOpinionTemplateProps) {

  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === 0) return '0원';
    const absAmount = Math.abs(amount);
    const eok = Math.floor(absAmount / 100000000);
    const remainder = absAmount % 100000000;
    const man = Math.floor(remainder / 10000);

    let res = '';
    if (eok > 0) res += `${eok}억 `;
    if (man > 0) res += `${man.toLocaleString()}만`;
    return `${res}원`.trim();
  };

  const issued = issuedAt && !isNaN(new Date(issuedAt).getTime()) ? new Date(issuedAt) : new Date();
  const dateString = `${issued.getFullYear()}년 ${issued.getMonth() + 1}월 ${issued.getDate()}일`;
  const ymd = `${issued.getFullYear()}${String(issued.getMonth() + 1).padStart(2, '0')}${String(issued.getDate()).padStart(2, '0')}`;
  // 제안서 ID 기반 문서번호 (같은 제안서 = 같은 번호, 다른 제안서끼리 충돌 없음)
  const serialSource = documentId || proposal?.id || `${lawyerName}|${clientName}|${issued.toISOString()}`;
  const docSerial = `ADV-${ymd}-${stableHash(String(serialSource))}`;

  const years = repaymentMonths % 12 === 0 ? `${repaymentMonths / 12}년` : `${(repaymentMonths / 12).toFixed(1)}년`;

  // 변호사가 실제로 작성한 소견만 변호사 명의로 싣는다.
  // (이전: 소견이 없으면 '검토하였습니다…' 기본 문구, 또는 자리표시 '제안서 발송'을 소견처럼 인쇄)
  const NOT_WRITTEN = '변호사가 아직 작성하지 않았습니다.';
  const PLACEHOLDER_REMARKS = ['제안서 발송'];
  const authored = [lawyerOpinion, proposal?.proposalData?.lawyerOpinion, proposal?.remark]
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .find(v => v && !PLACEHOLDER_REMARKS.includes(v) && v !== NOT_WRITTEN) || '';
  const hasAuthoredOpinion = authored.length > 0;
  const finalOpinion = hasAuthoredOpinion ? authored : NOT_WRITTEN;

  const notes = specialNotes.length > 0 ? specialNotes : [NOT_WRITTEN];

  // A4 Page Container (794px x 1123px @ 96DPI)
  const PageWrapper = ({ children, pageNumber }: { children: React.ReactNode; pageNumber: number }) => (
    <div
      id={`pdf-lawyer-page-${pageNumber}`}
      className="pdf-page-item"
      style={{
        width: '794px',
        height: '1123px',
        minHeight: '1123px',
        maxHeight: '1123px',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        color: '#1e293b',
        borderBottom: '1px solid #e2e8f0',
        pageBreakAfter: 'always'
      }}
    >
      {/* 상단 장식 바 (클래식 변호사 네이비) */}
      <div style={{ height: '6px', background: '#1e3a8a', width: '100%' }} />

      {/* 헤더 */}
      <div style={{
        padding: '22px 44px 14px 44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1.5px solid #0f172a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: '#1e3a8a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Scale size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.5px' }}>
              {lawyerFirmName || `${lawyerName} 변호사`}
            </span>
            <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#475569' }}>
              담당 변호사 {lawyerName}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1'
          }}>
            문서번호: {docSerial}
          </span>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: '#eff6ff',
            color: '#1e40af',
            border: '1px solid #bfdbfe'
          }}>
            수임 전 검토 의견
          </span>
        </div>
      </div>

      {/* 본문 영역 */}
      <div style={{ padding: '24px 44px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {/* 푸터 */}
      <div
        style={{
          padding: '12px 44px 18px 44px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '9.5px',
          color: '#64748b',
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={11} color="#64748b" />
          <span>상담 내용은 변호사법 제26조(비밀유지의무)에 따라 보호됩니다. 본 문서는 수임 전 참고 의견입니다.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#334155' }}>
          <span>{pageNumber}</span>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span>2</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#e2e8f0', padding: 0, margin: 0 }}>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 1: 표지 및 변호사 직접 검토 종합 의견서 (법률 소견 중심)
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={1}>
        
        {/* 공문서 표제 */}
        <div style={{ textAlign: 'center', margin: '6px 0 20px 0' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e3a8a', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
            OFFICIAL LEGAL OPINION LETTER
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            개인회생 신청 검토 및 채무조정 법률의견서
          </h1>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            작성일자: {dateString} ｜ 관할법원: <strong style={{ color: '#0f172a' }}>{courtName}</strong>
          </div>
        </div>

        {/* 의뢰인 및 담당 변호사 정보 테이블 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>수신 (의뢰인)</div>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{clientName} 님</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>총 채무액</div>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{formatCurrency(totalDebt)}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>담당 검토 변호사</div>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>{lawyerName} 변호사</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>소속 법무법인</div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lawyerFirmName || '-'}</div>
          </div>
        </div>

        {/* 핵심 진단 요약 박스 (4대 지표) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #93c5fd', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#3b82f6', fontWeight: 700 }}>예상 원금 감면율</div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#1d4ed8', marginTop: '2px' }}>{debtReductionRate}%</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>원금 감면안</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #86efac', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>월 예상 변제금</div>
            <div style={{ fontSize: '17px', fontWeight: 900, color: '#15803d', marginTop: '2px' }}>{formatCurrency(monthlyPayment)}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{repaymentMonths}개월 기준</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>예상 감면액</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>{formatCurrency(estimatedReduction)}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>변제 완료·면책 시</div>
          </div>
          <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>총 변제 예정액</div>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginTop: '3px' }}>{formatCurrency(totalRepayment)}</div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>{repaymentMonths}개월 합계</div>
          </div>
        </div>

        {/* 1. 변호사 직접 검토 소견 전문 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#0f172a',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '10px'
          }}>
            <span>1. 담당 변호사 검토 소견</span>
          </div>
          <div style={{
            padding: '14px 18px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '11px',
            lineHeight: 1.65,
            color: '#334155'
          }}>
            {hasAuthoredOpinion && (
              <p style={{ margin: '0 0 10px 0', fontWeight: 600, color: '#0f172a' }}>
                의뢰인이 제공한 소득 상황과 부채 정보를 바탕으로 「채무자 회생 및 파산에 관한 법률」상 개인회생 신청 가능성을 검토하였습니다.
              </p>
            )}
            <p style={{ margin: 0, color: hasAuthoredOpinion ? undefined : '#64748b' }}>
              {finalOpinion}
            </p>
          </div>
        </div>

        {/* 2. 사건 진행 시 주의사항 및 법적 방어 전략 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#0f172a',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '10px'
          }}>
            <span>2. 사건 진행 계획 및 유의사항</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notes.map((note, idx) => (
              <div key={idx} style={{
                padding: '9px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '10.5px',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  ✓
                </span>
                <span style={{ fontWeight: 600 }}>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 변호사 직인 및 공인 서명 날인 영역 */}
        <div style={{
          marginTop: 'auto',
          padding: '14px 20px',
          border: '1.5px solid #cbd5e1',
          borderRadius: '8px',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            {lawyerFirmName && (
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>{lawyerFirmName}</div>
            )}
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              담당 변호사: <strong style={{ color: '#0f172a' }}>{lawyerName}</strong> (인)
            </div>
            <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
              작성일 {dateString} · 문서번호 {docSerial}
            </div>
          </div>

          {/* 인감: 변호사가 등록한 이미지가 있을 때만 표시 (임의 도장 그래픽 생성 금지) */}
          {sealImageUrl && (
            <img src={sealImageUrl} alt={`${lawyerName} 변호사 인`} style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
          )}
        </div>
      </PageWrapper>

      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 2: 채무조정 변제계획 상세안 & 수임료 분납 일정 및 로드맵
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={2}>
        
        {/* 상단 섹션 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#0f172a',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '10px'
          }}>
            <span>3. 개인회생 전후 채무조정 비교 상세안</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#475569' }}>구분 항목</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>신청 전 현재 상태</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a' }}>개인회생 인가 후 계획안</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', color: '#1e40af' }}>법적 조정 효과</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>총 채무 원금</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>{formatCurrency(totalDebt)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(totalRepayment)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>▲ {formatCurrency(estimatedReduction)} 감면</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>예상 원금 감면율</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>0% (전액 상환 의무)</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>{debtReductionRate}%</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>인가·면책 시 예상</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>월 변제 부담금</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>매월 원리금 독촉</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>{formatCurrency(monthlyPayment)} / 월</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>인정 생계비 공제 후 산정</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>변제 기간</td>
                <td style={{ padding: '8px 12px', textAlign: 'right' }}>기한 없음 (연체 누적)</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{repaymentMonths}개월 ({years})</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>변제 완료 후 면책 신청</td>
              </tr>
              <tr style={{ borderBottom: '2px solid #0f172a' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>이자 및 연체이자</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>연체이자 가산</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>원금 기준 변제계획</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>개시 후 이자는 원칙적으로 후순위</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 4. 수임료 및 분납 계획안 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#0f172a',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '10px'
          }}>
            <span>4. 제안 수임료 및 납부 조건</span>
          </div>

          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>총 수임료</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{totalFeeWon > 0 ? formatCurrency(totalFeeWon) : '상담 후 확정'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>착수금</div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#1e40af', marginTop: '2px' }}>{downPaymentWon > 0 ? formatCurrency(downPaymentWon) : '협의'}</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>분납 조건</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                {installments > 0 && monthlyInstallmentWon > 0
                  ? `${installments}회 (${formatCurrency(monthlyInstallmentWon)}/월)`
                  : '협의'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '9.5px', color: '#64748b', paddingLeft: '4px' }}>
            ℹ️ {additionalCostsNotice}
          </div>
        </div>

        {/* 5. 5단계 절차 로드맵 */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 12px',
            backgroundColor: '#0f172a',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '10px'
          }}>
            <span>5. 개인회생 사건 진행 5단계 법적 로드맵</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center' }}>
            <div style={{ padding: '8px 6px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#1e40af' }}>STEP 1</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>서류 구비</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>소득·채무 소명</div>
            </div>
            <div style={{ padding: '8px 6px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#15803d' }}>STEP 2</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>신청·금지명령</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>추심 제한 신청</div>
            </div>
            <div style={{ padding: '8px 6px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#7e22ce' }}>STEP 3</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>보정권고 대응</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>보정서 제출</div>
            </div>
            <div style={{ padding: '8px 6px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#b45309' }}>STEP 4</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>개시결정</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>변제금 적립 시작</div>
            </div>
            <div style={{ padding: '8px 6px', backgroundColor: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '6px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#be185d' }}>STEP 5</div>
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>인가 및 면책</div>
              <div style={{ fontSize: '8.5px', color: '#64748b', marginTop: '2px' }}>변제 완료 후 면책</div>
            </div>
          </div>
        </div>

        {/* 법률 고지 및 비밀 보호 안내 */}
        <div style={{
          marginTop: 'auto',
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          fontSize: '9.5px',
          color: '#64748b',
          lineHeight: 1.5
        }}>
          <strong style={{ color: '#0f172a' }}>법적 안내:</strong> 본 의견서는 의뢰인이 제공한 초기 정보를 토대로 담당 변호사가 작성한 예상 변제 계획이며, 개시·인가·면책을 보장하지 않습니다. 실제 변제금과 변제 기간은 법원 심리, 제출 서류, 채권자 이의 등에 따라 달라질 수 있습니다.
        </div>
      </PageWrapper>
    </div>
  );
}
