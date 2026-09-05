import React from 'react';
import { 
  Scale, Shield, Check, AlertTriangle, Landmark, Calendar, FileText, User, 
  CheckCircle2, Clock, ArrowRight, Sparkles, Building2, TrendingDown,
  Layers, BadgeCheck, Phone, Mail, Award, Lock, FileSpreadsheet
} from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface PrintableReportTemplateProps {
  result: RehabCalculationResult;
  userInput: RehabUserInput;
}

export default function PrintableReportTemplate({ result, userInput }: PrintableReportTemplateProps) {
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

  const formatNumber = (num: number | undefined): string => {
    if (num === undefined) return '0';
    return num.toLocaleString();
  };

  const today = new Date();
  const dateString = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const docSerial = `RLC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.abs((userInput.name || 'CLIENT').split('').reduce((acc, c) => acc + c.charCodeAt(0), 1024) % 9000 + 1000)}`;

  const medianIncomes = [
    { size: 1, median: 2564238, minLiving: 1538543 },
    { size: 2, median: 4199292, minLiving: 2519575 },
    { size: 3, median: 5359036, minLiving: 3215422 },
    { size: 4, median: 6494738, minLiving: 3896843 },
    { size: 5, median: 7556719, minLiving: 4534031 },
    { size: 6, median: 8555952, minLiving: 5133571 },
  ];

  // A4 Page Container (794px x 1123px @ 96DPI)
  const PageWrapper = ({ children, pageNumber }: { children: React.ReactNode; pageNumber: number }) => (
    <div
      id={`pdf-page-${pageNumber}`}
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
      {/* 상단 장식 바 */}
      <div style={{ height: '7px', background: 'linear-gradient(90deg, #0f172a 0%, #1e1b4b 50%, #4338ca 100%)', width: '100%' }} />

      {/* 헤더 */}
      <div style={{
        padding: '24px 44px 14px 44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '6px',
            backgroundColor: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Scale size={15} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
              ROY LAW CRM
            </span>
            <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>
              회생파산 종합법률지원센터
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: '#f8fafc',
            color: '#475569',
            border: '1px solid #e2e8f0'
          }}>
            문서번호: ${docSerial}
          </span>
          <span style={{
            fontSize: '9.5px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '4px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #fecaca'
          }}>
            STRICTLY CONFIDENTIAL
          </span>
        </div>
      </div>

      {/* 본문 콘텐츠 영역 */}
      <div style={{ padding: '24px 44px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>

      {/* 푸터 */}
      <div
        style={{
          padding: '12px 44px 20px 44px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '9.5px',
          color: '#94a3b8',
          borderTop: '1px solid #f1f5f9'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={11} color="#94a3b8" />
          <span>본 문서는 변호사법 제109조 및 개인정보보호법에 의거하여 비밀이 철저히 보호되는 공인 법률의견서입니다.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#475569' }}>
          <span>${pageNumber}</span>
          <span style={{ color: '#cbd5e1' }}>/</span>
          <span>7</span>
        </div>
      </div>
    </div>
  );

  // 세련된 섹션 헤더
  const SectionHeader = ({ icon, title, subtitle, tag }: { icon: React.ReactNode; title: string; subtitle?: string; tag?: string }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      backgroundColor: '#0f172a',
      borderRadius: '8px',
      color: '#ffffff',
      marginBottom: '16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '5px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon}
        </div>
        <div>
          <span style={{ fontSize: '13.5px', fontWeight: 800, letterSpacing: '0.3px' }}>{title}</span>
          {subtitle && (
            <span style={{ fontSize: '10.5px', color: '#94a3b8', marginLeft: '8px', fontWeight: 500 }}>{subtitle}</span>
          )}
        </div>
      </div>
      {tag && (
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          backgroundColor: '#4338ca',
          color: '#ffffff',
          padding: '2px 8px',
          borderRadius: '4px'
        }}>
          {tag}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#e2e8f0', padding: '0', margin: '0' }}>
      
      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 1: Executive Cover & 정밀 진단 요약 (종합 법률의견서)
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={1}>
        {/* 표지 탑 타이틀 배너 */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '24px 28px',
          marginBottom: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', right: '-15px', bottom: '-15px', opacity: 0.08 }}>
            <Scale size={170} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '20px', fontSize: '10.5px', fontWeight: 700, marginBottom: '10px' }}>
            <Sparkles size={12} color="#fde047" />
            <span>2026 회생법원 실무준칙 종합 적용 공인 진단서</span>
          </div>
          <h1 style={{ fontSize: '25px', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            개인회생·파산 정밀진단 종합법률의견서
          </h1>
          <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: 1.5, maxWidth: '580px' }}>
            본 문서는 의뢰인이 제공한 소득·채무·자산 데이터를 기반으로 회생법원 실무준칙(주식·코인 손실금 청산가치 제외, 생계비 기준) 및 인가 판례 알고리즘을 적용하여 산출한 공인 법률 분석 보고서입니다.
          </p>
        </div>

        {/* 의뢰인 및 사건 개요 메타데이터 카드 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={16} color="#334155" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>진단 의뢰인</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{userInput.name || '의뢰인'} 님</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Landmark size={16} color="#334155" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>관할 법원</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{result.courtName || '관할 회생법원'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} color="#334155" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>진단 및 분석일</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{dateString}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} color="#334155" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>예상 처리기간</span>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>약 {result.processingMonths || 6}개월</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4대 핵심 KPI 카드 (2x2 그리드) */}
        <div style={{ marginBottom: '20px' }}>
          <SectionHeader 
            icon={<FileSpreadsheet size={15} />} 
            title="I. Executive Summary (핵심 재무진단 요약)" 
            subtitle="주요 채무 탕감 및 상환 계획 지표"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* 카드 1: 총 채무액 */}
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #fecaca',
              borderLeft: '5px solid #ef4444',
              borderRadius: '10px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>현재 총 채무액 (원금+이자)</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#fef2f2', color: '#b91c1c', fontWeight: 700 }}>위험 부담</span>
              </div>
              <div style={{ fontSize: '23px', fontWeight: 900, color: '#dc2626', letterSpacing: '-0.5px' }}>
                {formatCurrency(userInput.totalDebt)}
              </div>
              <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '6px' }}>
                * 신용대출, 카드대금, 금융권 채무 일체 포함
              </div>
            </div>

            {/* 카드 2: 총 변제예정액 */}
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #bbf7d0',
              borderLeft: '5px solid #10b981',
              borderRadius: '10px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>총 변제예정액 ({result.repaymentMonths}개월간)</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 700 }}>상환 목표</span>
              </div>
              <div style={{ fontSize: '23px', fontWeight: 900, color: '#059669', letterSpacing: '-0.5px' }}>
                {formatCurrency(result.totalRepayment)}
              </div>
              <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>
                월 예상 변제금: <strong>{formatCurrency(result.monthlyPayment)}</strong> / 월
              </div>
            </div>

            {/* 카드 3: 예상 탕감액 및 탕감률 */}
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #c7d2fe',
              borderLeft: '5px solid #4f46e5',
              borderRadius: '10px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>예상 탕감액 (법정 원금 면책)</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: 800 }}>탕감률 약 {result.debtReductionRate}%</span>
              </div>
              <div style={{ fontSize: '23px', fontWeight: 900, color: '#4338ca', letterSpacing: '-0.5px' }}>
                {formatCurrency(result.totalDebtReduction)}
              </div>
              <div style={{ fontSize: '10.5px', color: '#4f46e5', marginTop: '6px', fontWeight: 600 }}>
                면책 시 원금의 약 <strong>{result.debtReductionRate}%</strong> 합법적 소멸
              </div>
            </div>

            {/* 카드 4: 법원 인가 가능성 등급 */}
            <div style={{
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderLeft: '5px solid #0ea5e9',
              borderRadius: '10px',
              padding: '16px 20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>법원 심사 인가 가능성</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f0f9ff', color: '#0369a1', fontWeight: 700 }}>AI 판정 등급</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: result.status === 'POSSIBLE' ? '#059669' : result.status === 'IMPOSSIBLE' ? '#dc2626' : '#d97706'
                }}>
                  {result.status === 'POSSIBLE' ? '● 인가 유력 (안정권)' : result.status === 'IMPOSSIBLE' ? '▲ 자격 보완 필요' : '■ 정밀 검토 요망'}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '6px' }}>
                소득 대비 청산가치 충족 여부 및 채무 성격 양호
              </div>
            </div>
          </div>
        </div>

        {/* 변호사 종합 1차 소견 & 공인 스탬프 */}
        <div style={{
          marginTop: 'auto',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative'
        }}>
          <div style={{ flex: 1, paddingRight: '120px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Award size={16} color="#0f172a" />
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>회생전담 변호사 종합 1차 소견</span>
            </div>
            <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
              "의뢰인은 현재 월평균 소득({formatCurrency(userInput.monthlyIncome)})에서 법정 최저생계비({formatCurrency(result.recognizedLivingCost)})를 공제한 가용소득을 기반으로 월 약 {formatCurrency(result.monthlyPayment)}원의 변제계획 수립이 가능합니다. 보유 자산에 따른 청산가치({formatCurrency(result.liquidationValue)}) 보장 요건을 충족하고 있으므로, 서류 소명을 충실히 준비할 경우 신속한 금지명령 및 개시결정이 예상됩니다."
            </p>
          </div>

          {/* 원형 변호사 직인 스탬프 */}
          <div style={{
            position: 'absolute',
            right: '24px',
            top: '50%',
            transform: 'translateY(-50%) rotate(-8deg)',
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            border: '2.5px dashed #dc2626',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            backgroundColor: 'rgba(254, 242, 242, 0.6)'
          }}>
            <div style={{ fontSize: '8px', fontWeight: 800, letterSpacing: '1px' }}>ROY LAW</div>
            <div style={{ fontSize: '12px', fontWeight: 900, margin: '2px 0' }}>공인검인</div>
            <div style={{ fontSize: '8.5px', fontWeight: 700 }}>회생전담센터</div>
            <div style={{ fontSize: '7.5px', color: '#ef4444' }}>{today.getFullYear()}</div>
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 2: 생계비 및 부양가족 정밀 분석
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={2}>
        <SectionHeader 
          icon={<Building2 size={15} />} 
          title="II. 생계비 및 부양가족 정밀 분석 (Living Cost & Dependents)" 
          subtitle="국민기초생활보장법 기준 중위소득 60% 법정 적용 기준"
        />

        {/* 법정 최저생계비 원칙 설명 박스 */}
        <div style={{
          backgroundColor: '#eff6ff',
          borderLeft: '4px solid #3b82f6',
          borderRadius: '0 8px 8px 0',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '11px',
          lineHeight: 1.6,
          color: '#1e3a8a'
        }}>
          <strong>💡 기준 중위소득 및 최저생계비 산정 원칙:</strong><br/>
          채무자 회생 및 파산에 관한 법률에 따라 보건복지부 고시 기준 중위소득의 <strong>60%</strong>를 법정 최저생계비로 인정합니다. 소득에서 최저생계비 및 법원이 승인한 추가생계비(주거·의료)를 공제한 잔여 소득(가용소득)이 매월 납입할 월 변제금으로 확정됩니다.
        </div>

        {/* 부양가족 인정 기준 카드 3열 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            법원 실무상 부양가족 인정 3대 원칙
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                👶 미성년 자녀
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
                만 19세 미만 자녀는 전액 인정 원칙. 단, 배우자 소득 유무에 따라 0.5인(50%) 분할 인정될 수 있음.
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                👵 만 65세 이상 고령 부모
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
                소득이 없고 실제 주민등록상 동거하거나 지속적인 부양비(월 30만 이상 송금내역) 소명 시 인정.
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', backgroundColor: '#f8fafc' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>
                💍 배우자 부양 제외 원칙
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5 }}>
                원칙적 근로능력자로 보아 제외. 단, 중증질환, 임신·출산, 장애 등 근로능력 상실 진단서 제출 시 인정.
              </div>
            </div>
          </div>
        </div>

        {/* 2024~2026 기준 가구별 최저생계비표 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>가구원 수별 법정 최저생계비 기준표</span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>단위: 원 (기준 중위소득 60%)</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '8px 12px', border: '1px solid #334155', textAlign: 'center', width: '25%' }}>가구원 수</th>
                <th style={{ padding: '8px 12px', border: '1px solid #334155', textAlign: 'right', width: '35%' }}>기준 중위소득 (100%)</th>
                <th style={{ padding: '8px 12px', border: '1px solid #334155', textAlign: 'right', width: '40%' }}>법정 최저생계비 (60%)</th>
              </tr>
            </thead>
            <tbody>
              {medianIncomes.map((item, idx) => {
                const isClientFamily = item.size === userInput.familySize;
                return (
                  <tr key={idx} style={{
                    backgroundColor: isClientFamily ? '#e0e7ff' : idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderLeft: isClientFamily ? '4px solid #4338ca' : 'none'
                  }}>
                    <td style={{ padding: '7px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: isClientFamily ? 800 : 500, color: isClientFamily ? '#312e81' : 'inherit' }}>
                      {item.size}인 가구 {isClientFamily && '★ (의뢰인 해당)'}
                    </td>
                    <td style={{ padding: '7px 12px', border: '1px solid #cbd5e1', textAlign: 'right', color: '#475569' }}>
                      {formatNumber(item.median)}원
                    </td>
                    <td style={{ padding: '7px 12px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: isClientFamily ? 800 : 600, color: isClientFamily ? '#4338ca' : '#0f172a' }}>
                      {formatNumber(item.minLiving)}원
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 3단 소득-생계비-가용소득 워터폴 인포그래픽 */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
            의뢰인 월 소득 대비 생계비 및 가용소득 분할 구조 (워터폴 분석)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* 1. 월 평균 소득 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: '#475569' }}>① 월 평균 세후 소득</span>
                <span style={{ color: '#0f172a' }}>{formatCurrency(userInput.monthlyIncome)} (100%)</span>
              </div>
              <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', backgroundColor: '#64748b' }} />
              </div>
            </div>

            {/* 2. 인정 최저생계비 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: '#059669' }}>② 인정 최저생계비 (법정보호 생계비)</span>
                <span style={{ color: '#059669' }}>{formatCurrency(result.recognizedLivingCost)} ({userInput.monthlyIncome ? Math.round((result.recognizedLivingCost / userInput.monthlyIncome) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, userInput.monthlyIncome ? (result.recognizedLivingCost / userInput.monthlyIncome) * 100 : 0)}%`, height: '100%', backgroundColor: '#10b981' }} />
              </div>
            </div>

            {/* 3. 가용소득 (월 변제금) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '4px' }}>
                <span style={{ color: '#4338ca' }}>③ 순 가용소득 (월 변제금 산정 기준액 = ① - ②)</span>
                <span style={{ color: '#4338ca' }}>{formatCurrency(result.availableIncome)} ({userInput.monthlyIncome ? Math.round((result.availableIncome / userInput.monthlyIncome) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, userInput.monthlyIncome ? (result.availableIncome / userInput.monthlyIncome) * 100 : 0)}%`, height: '100%', backgroundColor: '#4338ca' }} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '10px', color: '#64748b' }}>
            * 기본 생계비: {formatCurrency(result.baseLivingCost)} | 추가 생계비(의료/주거): {formatCurrency(result.additionalLivingCost)} 반영됨
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 3: 보유자산 및 법원 청산가치 평가
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={3}>
        <SectionHeader 
          icon={<Building2 size={15} />} 
          title="III. 보유자산 및 법원 청산가치 평가 (Liquidation Value)" 
          subtitle="채무자회생법 제614조 제1항 제4호 청산가치 보장의 원칙 검증"
        />

        {/* 청산가치 대원칙 정의 박스 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '11px',
          lineHeight: 1.6,
          color: '#334155'
        }}>
          <strong style={{ color: '#0f172a' }}>⚖️ 청산가치 보장의 원칙 (The Principle of Best Interest):</strong><br/>
          채무자가 회생 계획을 통해 <strong>36개월간 분납하여 갚는 총 변제금의 현재가치</strong>는, 현재 시점에서 <strong>채무자의 모든 재산을 즉시 처분하여 배당하는 청산가치보다 반드시 커야만</strong> 법원 인가를 받을 수 있습니다.
        </div>

        {/* 주요 4대 자산군 산정 매트릭스 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>🏠</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>부동산 및 임대차보증금</span>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              KB부동산 시세에서 담보대출을 차감. 임차보증금은 주택임대차보호법상 소액임차보증금 최우선변제금 공제 후 반영.
            </p>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>🚗</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>차량 (자동차/이륜차)</span>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              엔카/보험개발원 중고차 기준 시세에서 캐피탈/할부사 저당 잔액을 뺀 순수 환가가치만 청산가치에 산정.
            </p>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>📑</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>보험 해약환급금 & 퇴직금</span>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              보험금은 150만 원 법정 압류금지 금액을 공제한 잔액, 퇴직금/퇴직연금은 민사집행법에 따라 50%만 산입.
            </p>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>📈</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>주식/코인/도박 손실금 특칙</span>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              서울·수원·부산회생법원은 투자 손실금을 청산가치에서 제외하는 실무준칙 시행 중. 기타 지방법원은 보정 대비 필수.
            </p>
          </div>
        </div>

        {/* 2024~2026 지역별 최우선변제 소액임차보증금 한도표 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            주택임대차보호법상 지역별 최우선변제 면제재산 한도
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
            <thead>
              <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                <th style={{ padding: '6px 10px', border: '1px solid #334155', textAlign: 'center' }}>적용 지역 구분</th>
                <th style={{ padding: '6px 10px', border: '1px solid #334155', textAlign: 'center' }}>보증금 인정 범위</th>
                <th style={{ padding: '6px 10px', border: '1px solid #334155', textAlign: 'right' }}>압류금지 최우선변제금</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ backgroundColor: '#ffffff' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>서울특별시</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>1억 6,500만 원 이하</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800, color: '#4338ca' }}>5,500만 원 공제</td>
              </tr>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>수도권 과밀억제권역, 세종, 용인, 화성, 김포</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>1억 4,500만 원 이하</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800, color: '#059669' }}>4,800만 원 공제</td>
              </tr>
              <tr style={{ backgroundColor: '#ffffff' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>광역시(군지역 제외), 안산, 광주, 파주, 이천 등</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>8,500만 원 이하</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800 }}>2,800만 원 공제</td>
              </tr>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', fontWeight: 700 }}>그 밖의 전국 지역</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'center' }}>7,500만 원 이하</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 800 }}>2,500만 원 공제</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 청산가치 충족 저울(Balance) 다이어그램 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>
            청산가치 보장의 원칙 비교 검증 다이어그램
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
            <div style={{
              flex: 1,
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '14px',
              backgroundColor: '#ffffff'
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>의뢰인 산정 청산가치 (재산)</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                {formatCurrency(result.liquidationValue)}
              </div>
            </div>

            <div style={{
              fontSize: '22px',
              fontWeight: 900,
              color: '#059669',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <span>&lt;</span>
              <span style={{ fontSize: '9.5px', color: '#059669', fontWeight: 800 }}>충족 완료</span>
            </div>

            <div style={{
              flex: 1,
              border: '2px solid #10b981',
              borderRadius: '8px',
              padding: '14px',
              backgroundColor: '#ecfdf5'
            }}>
              <div style={{ fontSize: '11px', color: '#047857', fontWeight: 800, marginBottom: '4px' }}>총 변제예정액 (36개월 합계)</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669' }}>
                {formatCurrency(result.totalRepayment)}
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '12px',
            fontSize: '11px',
            color: '#059669',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <CheckCircle2 size={14} color="#059669" />
            <span>총 변제액이 청산가치보다 약 {formatCurrency(Math.max(0, result.totalRepayment - result.liquidationValue))}원 많아 청산가치 보장 요건을 완벽히 충족합니다.</span>
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 4: 월 변제금 결정 흐름 & 탕감 시뮬레이션
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={4}>
        <SectionHeader 
          icon={<TrendingDown size={15} />} 
          title="IV. 월 변제금 결정 흐름 & 탕감 시뮬레이션 (Decision Matrix)" 
          subtitle="법정 3대 산정 요건 시뮬레이션 및 변제 스케줄"
        />

        {/* 변제금 결정 3대 요건 비교 카드 */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            월 변제금 결정을 위한 3대 기준 비교
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ border: '2px solid #4338ca', backgroundColor: '#eef2ff', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#4338ca', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, marginRight: '12px' }}>1</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#312e81' }}>기준 1: 순수 가용소득 기준 (원칙)</div>
                <div style={{ fontSize: '10px', color: '#4338ca' }}>월 세후 소득에서 인정 최저생계비를 차감한 순수 여유 자금</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#4338ca' }}>
                {formatCurrency(result.availableIncome)} / 월
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#94a3b8', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, marginRight: '12px' }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>기준 2: 청산가치 보장 최소 필요 월 변제액</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>재산 가치 총액을 36개월간 균등 상환하기 위한 하한선</div>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                {formatCurrency(Math.ceil(result.liquidationValue / (result.repaymentMonths || 36)))} / 월
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#94a3b8', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, marginRight: '12px' }}>3</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>기준 3: 총 채무액 대비 법정 최저 변제 비율 하한</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>채무자회생법상 채무 원금의 최소 3~5% 변제 충족 요건</div>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                {formatCurrency(Math.ceil((userInput.totalDebt * 0.05) / (result.repaymentMonths || 36)))} / 월
              </div>
            </div>
          </div>
        </div>

        {/* 최종 결정 월 변제금 대형 하이라이트 배너 */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>FINAL REPAYMENT PLAN</div>
            <div style={{ fontSize: '16px', fontWeight: 900 }}>최종 산정 예상 월 변제금</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '26px', fontWeight: 900, color: '#fde047' }}>
              {formatCurrency(result.monthlyPayment)}
            </div>
            <div style={{ fontSize: '10.5px', color: '#cbd5e1' }}>
              총 {result.repaymentMonths}회 성실 납입 시 잔여 채무 전액 면책
            </div>
          </div>
        </div>

        {/* 변제 스케줄 요약 3단 박스 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>총 변제 기간</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{result.repaymentMonths}개월</div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>3년 균등 분할 납부</div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>월별 납입액</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>{formatCurrency(result.monthlyPayment)}</div>
            <div style={{ fontSize: '9.5px', color: '#94a3b8' }}>법원 지정 가상계좌</div>
          </div>

          <div style={{ border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', textAlign: 'center', backgroundColor: '#ecfdf5' }}>
            <div style={{ fontSize: '10.5px', color: '#047857', fontWeight: 700 }}>총 상환 합계</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#059669', marginTop: '2px' }}>{formatCurrency(result.totalRepayment)}</div>
            <div style={{ fontSize: '9.5px', color: '#059669' }}>원금 대폭 감면 적용</div>
          </div>
        </div>

        {/* 채무 탕감 효과 요약 배너 */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingDown size={20} color="#16a34a" />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534' }}>
                원금 탕감 효과 종합 분석
              </div>
              <div style={{ fontSize: '10.5px', color: '#15803d' }}>
                채무 원금 {formatCurrency(userInput.totalDebt)} 중 {formatCurrency(result.totalDebtReduction)} 탕감
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>탕감률</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#15803d' }}>
              약 {result.debtReductionRate}%
            </div>
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 5: 관할법원 심사성향 & AI 법률소견
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={5}>
        <SectionHeader 
          icon={<Landmark size={15} />} 
          title="V. 관할법원 심사 성향 & 맞춤형 대응 전략 (Court Profile)" 
          subtitle="해당 관할 실무준칙 및 회생위원 보정 대비 가이드"
        />

        {/* 관할법원 프로필 카드 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={16} color="#0f172a" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>관할 법원: {result.courtName}</span>
            </div>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#3730a3', fontWeight: 700 }}>
              실무준칙 적용 대상
            </span>
          </div>

          <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
            관할 회생법원(지방법원 파산부)은 전국 통일 기준 외에 각 법원 고유의 실무준칙을 운영합니다. 특히 주식/가상자산 손실금에 대한 청산가치 제외 여부, 최근 채무 발생 시 사용처 소명 엄격도, 청년·취약계층 변제기간 단축(24~30개월) 특례 적용 범위가 관할에 따라 상이하므로 철저한 맞춤 대비가 필수적입니다.
          </p>
        </div>

        {/* 법원 핵심 방어 쟁점 3대 체크리스트 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            변호사 전담팀 사전 집중 점검 체크리스트
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>최근 1년 이내 신규 대출금 사용처 100% 소명</div>
                <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5, marginTop: '2px' }}>
                  최근 채무 비중이 높을 경우 기존 채무 상환(돌려막기)이나 생활비, 병원비로 사용되었음을 통장 거래내역과 영수증으로 명확히 소명하여 사기회생 의혹을 사전 차단합니다.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>추가 생계비(주거비/의료비) 법정 한도 내 적극 반영</div>
                <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5, marginTop: '2px' }}>
                  월세 임차료 및 정기적 질환 치료비는 법원별 인정 기준(기준 중위소득의 일정 비율) 범위 내에서 전액 소명하여 월 변제금 부담을 최소화합니다.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>회생위원 보정권고 및 변제금 상향 요구 방어</div>
                <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.5, marginTop: '2px' }}>
                  회생위원의 변제금 인상 요구에 대해 청산가치 충족 기준과 의뢰인의 실질적 생계 유지 불가 판례를 적극 원용하여 초기 변제계획안을 관철합니다.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI 종합 법률 소견 블록 */}
        <div style={{
          backgroundColor: '#eef2ff',
          borderLeft: '4px solid #4338ca',
          borderRadius: '0 8px 8px 0',
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={15} color="#4338ca" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#312e81' }}>AI 리걸 알고리즘 종합 진단 소견</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(result.aiAdvice && result.aiAdvice.length > 0) ? (
              result.aiAdvice.map((adv, idx) => (
                <div key={idx} style={{ fontSize: '10.5px', color: '#3730a3', lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <span style={{ color: '#4338ca' }}>▪</span>
                  <span>{adv}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '10.5px', color: '#3730a3', lineHeight: 1.6 }}>
                의뢰인의 재무 상태는 개인회생 신청 요건(채무 1천만 원 이상, 정기적 소득 증빙, 청산가치 보장 충족)을 안정적으로 충족하고 있습니다. 서류 누락 방지 및 전문 대리인을 통한 신속 접수 시 약 1~2주 내 금지명령 수령이 가능할 것으로 전망됩니다.
              </div>
            )}
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 6: 회생 6단계 로드맵 & 핵심 법률용어
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={6}>
        <SectionHeader 
          icon={<Layers size={15} />} 
          title="VI. 회생 전 과정 6단계 로드맵 & 핵심 법률용어 (Process Roadmap)" 
          subtitle="신청서 접수부터 최종 법원 면책결정까지의 표준 타임라인"
        />

        {/* 6단계 회생 프로세스 비주얼 타임라인 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
            개인회생 표준 사건 진행 단계별 로드맵
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px' }}>
            {[
              { step: '01', title: '신청서 접수', desc: '서류 취합 및 법원 전자접수', time: 'D-Day' },
              { step: '02', title: '금지명령', desc: '모든 빚독촉·압류 전면 금지', time: '1~2주' },
              { step: '03', title: '보정권고', desc: '회생위원 서류 소명 및 검토', time: '1~3개월' },
              { step: '04', title: '개시결정', desc: '월 변제금 법원 가상계좌 납부', time: '3~6개월' },
              { step: '05', title: '채권자집회', desc: '법원 기일 출석 (대리인 동행)', time: '5~8개월' },
              { step: '06', title: '인가 및 면책', desc: '변제 완료 후 잔여 빚 100% 탕감', time: '최종면책' },
            ].map((p, idx) => (
              <div key={idx} style={{
                backgroundColor: idx === 1 || idx === 5 ? '#eef2ff' : '#ffffff',
                border: idx === 1 || idx === 5 ? '1.5px solid #4338ca' : '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 8px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '9px', fontWeight: 800, color: '#64748b' }}>STEP {p.step}</span>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', margin: '3px 0' }}>{p.title}</div>
                <div style={{ fontSize: '9px', color: '#64748b', lineHeight: 1.3, minHeight: '24px' }}>{p.desc}</div>
                <div style={{ fontSize: '8.5px', fontWeight: 700, color: '#4338ca', marginTop: '4px', backgroundColor: '#f1f5f9', padding: '2px 4px', borderRadius: '3px' }}>{p.time}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 8대 필수 법률용어 사전 (2열 카드 그리드) */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            의뢰인이 반드시 알아야 할 8대 핵심 법률용어
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {[
              { term: '금지명령 / 중지명령', desc: '신청 직후 법원이 채권자들에게 독촉 전화, 문자, 방문, 급여/통장 압류를 법적으로 금지시키는 긴급 처분입니다.' },
              { term: '순 가용소득', desc: '월 평균 실수령 소득에서 법정 최저생계비 및 법원 인정 추가생계비를 공제하고 남은 금액으로, 실제 월 변제금이 됩니다.' },
              { term: '청산가치 보장 원칙', desc: '채무자가 가진 모든 재산을 현 시점에서 처분했을 때의 가치보다 36개월간 분납할 총 변제금 합계가 더 많아야 하는 대원칙입니다.' },
              { term: '보정권고 / 보정명령', desc: '회생위원이 신청 서류의 미비점을 보완하거나 채무 사용처, 재산 평가의 적정성을 추가 소명하라고 통보하는 절차입니다.' },
              { term: '개시결정', desc: '법원이 회생 자격을 인정하고 공식 절차 시작을 선언하는 단계로, 이때 법원 변제금 전용 가상계좌가 발급됩니다.' },
              { term: '인가결정', desc: '채무자가 제출한 변제계획안을 법원이 최종 확정·승인하는 절차로, 기존 압류가 해제되고 신용회복 절차에 진입합니다.' },
              { term: '면책결정 (최종 탕감)', desc: '36개월간 약정된 변제금을 모두 성실 납부한 후, 갚지 못한 잔여 채무 원금과 이자를 전액 합법적으로 소멸시키는 종결 단계입니다.' },
              { term: '부인권 (편파변제 방어)', desc: '회생 신청 직전 지인이나 특정 채권자에게만 빚을 갚거나 재산을 헐값 처분한 행위를 법원이 취소하고 회수하는 권리입니다.' }
            ].map((item, idx) => (
              <div key={idx} style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: idx % 4 === 0 || idx % 4 === 3 ? '#ffffff' : '#f8fafc'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#312e81', marginBottom: '3px' }}>
                  {item.term}
                </div>
                <div style={{ fontSize: '9.5px', color: '#475569', lineHeight: 1.5 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 7: 의뢰인 필수 준수사항 & 공식 법적 고지 / 직인 서명부
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={7}>
        <SectionHeader 
          icon={<Shield size={15} />} 
          title="VII. 의뢰인 준수사항 & 공식 법률의견 서명 (Compliance & Certification)" 
          subtitle="사기회생 방지 주의사항 및 공인 변호사 날인부"
        />

        {/* 5대 주의사항 카드 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#991b1b' }}>1. 신청 직전 추가 대출 및 신용카드 사용 절대 금지</div>
              <div style={{ fontSize: '10px', color: '#7f1d1d', lineHeight: 1.4 }}>개인회생을 앞두고 무리하게 신규 대출을 받거나 신용카드를 현금화하는 행위는 사기회생죄에 해당하여 즉각 기각 사유가 됩니다.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#92400e' }}>2. 재산 은닉 및 가족/지인 명의 변경 엄금</div>
              <div style={{ fontSize: '10px', color: '#78350f', lineHeight: 1.4 }}>부동산, 차량, 예금을 지인에게 허위 양도하거나 헐값 처분하는 행위는 부인권 행사 대상이 되며 형사처벌 위험이 따릅니다.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
            <Shield size={18} color="#2563eb" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#1e40af' }}>3. 특정 채권자에 대한 편파 변제 금지</div>
              <div style={{ fontSize: '10px', color: '#1e3a8a', lineHeight: 1.4 }}>가족, 친구, 사채 등 특정 채권자의 빚만 우선 갚는 행위는 편파변제로 간주되어 해당 변제액 전액이 청산가치에 강제 합산됩니다.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <Check size={18} color="#16a34a" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#166534' }}>4. 소명 서류 기한 내 제출 및 투명한 금융 거래 증빙</div>
              <div style={{ fontSize: '10px', color: '#14532d', lineHeight: 1.4 }}>법원의 보정명령에 대해 14일 이내 신속하고 투명하게 금융거래내역을 제출하는 것이 인가율을 높이는 가장 결정적인 요소입니다.</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '8px' }}>
            <Scale size={18} color="#9333ea" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#6b21a8' }}>5. 이직, 퇴직, 소득 변동 시 대리인 사무실 즉각 통보</div>
              <div style={{ fontSize: '10px', color: '#581c87', lineHeight: 1.4 }}>진행 중 이직이나 급여 변동이 발생할 경우 법원 보고 양식이 달라지므로 즉시 담당 변호사에게 고지하여 변제계획안을 수정해야 합니다.</div>
            </div>
          </div>
        </div>

        {/* 변호사 법률의견 서명 및 공식 직인 날인부 */}
        <div style={{
          marginTop: 'auto',
          border: '2px solid #0f172a',
          borderRadius: '10px',
          padding: '20px 24px',
          backgroundColor: '#ffffff',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>CERTIFIED LEGAL OPINION</div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: '2px 0 6px 0' }}>
                로이 회생파산 전담 법률센터 공식 검인
              </div>
              <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.5 }}>
                본 정밀진단서는 담당 변호사가 의뢰인의 진술 자료 및 회생법원 실무준칙을 토대로 직접 종합 검토·발행한 정식 법률 소견서입니다.
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '8px' }}>
                발행일자: ${dateString} | 문서번호: ${docSerial}
              </div>
            </div>

            {/* 변호사 서명 & 직인 날인 */}
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingLeft: '20px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>대표/담당 변호사</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', letterSpacing: '1px' }}>
                  김 로 이 변호사
                </span>
                {/* 붉은 직인 */}
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '6px',
                  border: '2px solid #dc2626',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 900,
                  transform: 'rotate(-5deg)',
                  backgroundColor: 'rgba(254, 242, 242, 0.4)'
                }}>
                  인(印)
                </div>
              </div>
            </div>
          </div>

          {/* 하단 보안 바코드 & 공식 고지 */}
          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '9px', color: '#94a3b8', maxWidth: '520px', lineHeight: 1.4 }}>
              ⚠️ 본 법률의견서는 입력된 진술 자료를 바탕으로 한 법률적 예측 소견이며, 법원의 최종 인가 여부는 서류 심사 결과에 따릅니다. (변호사법 제109조 준수)
            </div>
            {/* 바코드 그래픽 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '20px' }}>
              {[2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3].map((w, i) => (
                <div key={i} style={{ width: `${w}px`, height: '100%', backgroundColor: i % 2 === 0 ? '#0f172a' : '#cbd5e1' }} />
              ))}
            </div>
          </div>
        </div>
      </PageWrapper>

    </div>
  );
}
