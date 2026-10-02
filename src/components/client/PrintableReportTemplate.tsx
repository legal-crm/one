import React from 'react';
import { 
  Scale, Shield, Check, AlertTriangle, Landmark, Calendar, FileText, User, 
  CheckCircle2, Clock, ArrowRight, Sparkles, Building2, TrendingDown,
  Layers, BadgeCheck, Phone, Mail, Award, Lock, FileSpreadsheet, HelpCircle
} from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface PrintableReportTemplateProps {
  result?: RehabCalculationResult;
  userInput?: RehabUserInput;
  [key: string]: any;
}

export default function PrintableReportTemplate({ result: rawResult, userInput: rawUserInput }: PrintableReportTemplateProps) {
  const result = rawResult || ({} as RehabCalculationResult);
  const userInput = rawUserInput || ({} as RehabUserInput);

  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined || amount === 0 || isNaN(amount)) return '0원';
    
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
    if (num === undefined || isNaN(num)) return '0';
    return num.toLocaleString();
  };

  const today = new Date();
  const dateString = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
  const clientNameStr = userInput.name || 'CLIENT';
  const docSerial = `RLC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${Math.abs(clientNameStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 1024) % 9000 + 1000)}`;

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
              my김변
            </span>
            <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>
              채무 정리 참고 리포트
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
            문서번호: {docSerial}
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
          <span>입력한 정보로 자동 계산한 참고 자료이며, 변호사의 법률의견서가 아닙니다.</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#475569' }}>
          <span>{pageNumber}</span>
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
          PAGE 1: 표지 & 핵심 요약 (자동 계산 참고 자료)
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
            <span>내 상황 맞춤 분석 결과</span>
          </div>
          <h1 style={{ fontSize: '25px', fontWeight: 900, margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
            내 빚, 얼마나 줄일 수 있을까?
          </h1>
          <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: 1.5, maxWidth: '580px' }}>
            입력하신 소득과 빚 정보를 바탕으로 개인회생을 하면 어떻게 되는지 미리 살펴본 결과입니다.
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
            title="I. 핵심 요약 (Summary)" 
            subtitle="예상 감면과 변제 계획 지표"
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
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>지금 갚아야 할 빚</span>
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
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>매달 내야 할 돈</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 700 }}>상환 목표</span>
              </div>
              <div style={{ fontSize: '23px', fontWeight: 900, color: '#059669', letterSpacing: '-0.5px' }}>
                {formatCurrency(result.monthlyPayment)} / 월
              </div>
              <div style={{ fontSize: '10.5px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>
                총 변제예정액: <strong>{formatCurrency(result.totalRepayment)}</strong> ({result.repaymentMonths}개월간)
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
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>갚지 않아도 되는 돈</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#eef2ff', color: '#4338ca', fontWeight: 800 }}>내 빚 줄어드는 비율 약 {result.debtReductionRate}%</span>
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
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>입력값 기준 요건 점검</span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 700 }}>자동 계산 참고</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: result.status === 'POSSIBLE' ? '#059669' : result.status === 'IMPOSSIBLE' ? '#dc2626' : '#d97706'
                }}>
                  {result.status === 'POSSIBLE' ? '● 기본 요건 충족으로 계산됨' : result.status === 'IMPOSSIBLE' ? '▲ 요건 보완 필요' : '■ 추가 검토 필요'}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '6px' }}>
                입력한 소득·재산·채무 정보로 계산한 결과이며, 실제 판단은 법원 심리에 따라 달라집니다.
              </div>
            </div>
          </div>
        </div>

        {/* 자동 계산 요약 */}
        <div style={{
          marginTop: 'auto',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '18px 22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <Award size={16} color="#0f172a" />
            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>자동 계산 요약 (참고용)</span>
          </div>
          <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6, margin: 0 }}>
            입력해주신 정보를 바탕으로 계산해본 결과, 한 달에 버시는 돈({formatCurrency(userInput.monthlyIncome)})에서 나라에서 정한 최소한의 생활비({formatCurrency(result.recognizedLivingCost)})를 빼면 매달 약 {formatCurrency(result.monthlyPayment)}원씩 갚으시게 될 것 같아요! 법원에서 인정하는 내 재산(청산가치)은 {formatCurrency(result.liquidationValue)}원으로 계산되었고요. 참고로 이 내용은 입력해주신 정보를 바탕으로 한 예상치라서, 실제 결과는 법원 심사에 따라 조금 달라질 수 있답니다.
          </p>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 2: 생계비 및 부양가족 정밀 분석
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={2}>
        <SectionHeader 
          icon={<Building2 size={15} />} 
          title="II. 생계비 및 부양가족 (Living Cost & Dependents)" 
          subtitle="국민기초생활보장법 기준 중위소득 60% 법정 적용 기준"
        />

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
          <strong>💡 쉽게 말하면:</strong><br/>
          법원은 "이 정도는 먹고 살아야 하니까 이 돈은 빼줄게"라고 정해놓은 금액이 있어요. 그게 바로 인정 생계비예요. 월급에서 이 금액을 빼고 남은 돈이 매달 갚아야 할 변제금이 됩니다.
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
                <span style={{ color: '#475569' }}>① 내 월급 (세후)</span>
                <span style={{ color: '#0f172a' }}>{formatCurrency(userInput.monthlyIncome)} (100%)</span>
              </div>
              <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', backgroundColor: '#64748b' }} />
              </div>
            </div>

            {/* 2. 인정 최저생계비 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>
                <span style={{ color: '#059669' }}>② 빼주는 생활비 (나라에서 정한 생활비)</span>
                <span style={{ color: '#059669' }}>{formatCurrency(result.recognizedLivingCost)} ({userInput.monthlyIncome && result.recognizedLivingCost ? Math.round((result.recognizedLivingCost / userInput.monthlyIncome) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, userInput.monthlyIncome && result.recognizedLivingCost ? (result.recognizedLivingCost / userInput.monthlyIncome) * 100 : 0))}%`, height: '100%', backgroundColor: '#10b981' }} />
              </div>
            </div>

            {/* 3. 가용소득 (월 변제금) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, marginBottom: '4px' }}>
                <span style={{ color: '#4338ca' }}>③ 남은 돈 (이게 매달 갚을 변제금!)</span>
                <span style={{ color: '#4338ca' }}>{formatCurrency(result.availableIncome || result.monthlyPayment)} ({userInput.monthlyIncome && (result.availableIncome || result.monthlyPayment) ? Math.round(((result.availableIncome || result.monthlyPayment) / userInput.monthlyIncome) * 100) : 0}%)</span>
              </div>
              <div style={{ height: '18px', backgroundColor: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, Math.max(0, userInput.monthlyIncome && (result.availableIncome || result.monthlyPayment) ? ((result.availableIncome || result.monthlyPayment) / userInput.monthlyIncome) * 100 : 0))}%`, height: '100%', backgroundColor: '#4338ca' }} />
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
          <strong style={{ color: '#0f172a' }}>💡 쉽게 말하면:</strong><br/>
          "재산이 있으면 그것보다는 더 많이 갚아야 해요"라는 뜻이에요. 예를 들어 내 재산(보증금, 차, 퇴직금 등)을 다 합쳐서 500만원이면, 3년 동안 갚는 총액이 최소 500만원은 넘어야 합니다.
        </div>

        {/* 주요 4대 자산군 산정 매트릭스 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', backgroundColor: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>🏠</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>전세/월세 보증금 → 대부분 공제되어 0원 처리!</span>
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
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>주식/코인 손실금 (법원마다 달라요!)</span>
            </div>
            <p style={{ fontSize: '10px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              서울, 수원, 부산은 손실금을 재산에서 빼주지만, 다른 곳은 안 빼줄 수도 있어요.
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
            <span>총 변제액이 청산가치보다 약 {formatCurrency(Math.max(0, (result.totalRepayment || (result as any).totalPayment || 0) - (result.liquidationValue || 0)))}원 많아 입력값 기준으로 청산가치 보장 요건을 충족하는 것으로 계산됩니다.</span>
          </div>
        </div>
      </PageWrapper>


      {/* ══════════════════════════════════════════════════════════════════════
          PAGE 4: 월 변제금 결정 흐름 & 감면 계산
         ══════════════════════════════════════════════════════════════════════ */}
      <PageWrapper pageNumber={4}>
        <SectionHeader 
          icon={<TrendingDown size={15} />} 
          title="IV. 월 변제금 결정 흐름 & 감면 계산 (Decision Matrix)" 
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
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#312e81' }}>내 월급에서 생계비 빼고 남은 돈</div>
                <div style={{ fontSize: '10px', color: '#4338ca' }}>월 세후 소득에서 인정 최저생계비를 차감한 순수 여유 자금</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 900, color: '#4338ca' }}>
                {formatCurrency(result.availableIncome || result.monthlyPayment)} / 월
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#94a3b8', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, marginRight: '12px' }}>2</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>재산보다 더 갚아야 하는 최소 금액</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>재산 가치 총액을 36개월간 균등 상환하기 위한 하한선</div>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                {formatCurrency(Math.ceil((result.liquidationValue || 0) / (result.repaymentMonths || 36)))} / 월
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#94a3b8', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, marginRight: '12px' }}>3</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#334155' }}>빚의 최소 3~5%는 갚아야 함</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>채무자회생법상 채무 원금의 최소 3~5% 변제 충족 요건</div>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                {formatCurrency(Math.ceil(((userInput.totalDebt || 0) * 0.05) / (result.repaymentMonths || 36)))} / 월
              </div>
            </div>
            
            <div style={{ marginTop: '8px', padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center', fontWeight: 800, color: '#166534', fontSize: '12px' }}>
              → 이 중에서 가장 큰 금액이 내 월 변제금!
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
                예상 원금 감면 요약
              </div>
              <div style={{ fontSize: '10.5px', color: '#15803d' }}>
                채무 원금 {formatCurrency(userInput.totalDebt)} 중 약 {formatCurrency(result.totalDebtReduction || (result as any).reductionAmount || 0)} 감면 예상 (변제 완료 후 면책 시)
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>예상 감면율</span>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#15803d' }}>
              약 {result.debtReductionRate || (result as any).reductionRate || 0}%
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
          title="V. 관할 법원 확인 사항 (Court Profile)" 
          subtitle="관할에 따라 달라질 수 있는 실무 기준"
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
            관할 회생법원(지방법원 파산부)은 전국 통일 기준 외에 각 법원 고유의 실무준칙을 운영합니다. 특히 주식/가상자산 손실금에 대한 청산가치 제외 여부, 최근 채무 발생 시 사용처 소명 엄격도, 청년·취약계층 변제기간 단축(24~30개월) 특례 적용 범위는 관할에 따라 다를 수 있으니 담당 변호사와 확인해 주세요.
          </p>
        </div>
        
        {/* 자주 궁금해하는 질문 TOP 5 */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <HelpCircle size={16} color="#0f172a" />
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>자주 궁금해하는 질문 TOP 5</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Q: 독촉 전화가 진짜 멈추나요?</div>
              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>A: 네, 금지명령이 나오면 채권자는 전화·문자·방문 일체 금지됩니다. 위반 시 처벌 대상이에요.</div>
            </div>
            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Q: 직장에 알려지나요?</div>
              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>A: 아닙니다. 개인회생은 직장에 통보되지 않고, 직업 제한도 없습니다. 공무원도 가능해요.</div>
            </div>
            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Q: 집(보증금)을 빼앗기나요?</div>
              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>A: 소액임차보증금 범위 내라면 보호됩니다. 서울 기준 5,500만원까지 보호돼요.</div>
            </div>
            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Q: 카드를 못 쓰게 되나요?</div>
              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>A: 신용카드는 사용이 안 되지만, 체크카드는 자유롭게 사용 가능합니다.</div>
            </div>
            <div style={{ padding: '10px 12px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Q: 가족에게 영향이 있나요?</div>
              <div style={{ fontSize: '10px', color: '#475569', lineHeight: 1.5 }}>A: 본인 명의의 빚만 해당됩니다. 가족의 재산이나 신용에는 영향이 없어요.</div>
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
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#312e81' }}>자동 계산 참고 사항</span>
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
                입력값 기준으로 개인회생 신청 요건(채무 규모, 정기적 소득, 청산가치 보장)을 계산했습니다. 금지명령·개시 결정의 시기와 여부는 법원과 사건에 따라 다르므로 담당 변호사와 확인해 주세요.
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
              { step: '02', title: '금지명령', desc: '드디어 독촉 전화가 멈춥니다!', time: '1~2주' },
              { step: '03', title: '보정권고', desc: '회생위원 서류 소명 및 검토', time: '1~3개월' },
              { step: '04', title: '개시결정', desc: '월 변제금 법원 가상계좌 납부', time: '3~6개월' },
              { step: '05', title: '채권자집회', desc: '법원 기일 출석 (대리인 동행)', time: '5~8개월' },
              { step: '06', title: '인가 및 면책', desc: '🎉 드디어 새 출발! 빚에서 완전히 벗어나는 순간', time: '최종면책' },
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
              { term: '금지명령 / 중지명령', desc: '법원이 "채권자들아, 이 사람한테 독촉하지 마!"라고 내리는 명령이에요. 전화, 문자, 방문, 압류 전부 금지됩니다.' },
              { term: '순 가용소득', desc: '내 월급에서 생활비를 빼고 남은 돈이에요. 이 돈이 매달 법원에 갚아야 할 변제금이 됩니다.' },
              { term: '청산가치 보장 원칙', desc: '내 전 재산을 다 합친 금액보다는, 3년 동안 갚는 총액이 더 커야 한다는 법원의 규칙이에요.' },
              { term: '보정권고 / 보정명령', desc: '법원에서 "이 서류가 부족해요, 이 내용은 뭔가요?"라고 물어보는 거예요. 솔직하고 꼼꼼하게 답하면 됩니다.' },
              { term: '개시결정', desc: '법원이 "네, 회생 시작해도 됩니다"라고 허락하는 결정이에요. 이때부터 매달 법원 계좌에 변제금을 넣기 시작합니다.' },
              { term: '인가결정', desc: '법원이 "네, 이렇게 갚아나가시면 됩니다"라고 최종적으로 확정해주는 정말 중요한 순간이에요!' },
              { term: '면책결정', desc: '변제를 다 마친 후 법원이 "남은 빚은 갚지 않아도 됩니다"라고 결정하는 거예요. 이게 나오면 정말 끝!' },
              { term: '부인권 (편파변제 방어)', desc: '회생 신청 직전에 가족이나 지인에게만 돈을 갚거나 재산을 몰래 넘기면, 법원이 그걸 다시 뺏어오는 권리예요.' }
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
          title="VII. 신청 전 주의사항 (Compliance)" 
          subtitle="진행 중 지켜야 할 사항"
        />

        {/* 5대 주의사항 카드 리스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
            <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#991b1b' }}>1. 신청 직전 추가 대출·신용카드 사용은 피하세요</div>
              <div style={{ fontSize: '10px', color: '#7f1d1d', lineHeight: 1.4 }}>개인회생을 앞두고 신규 대출을 받거나 신용카드를 현금화하면 사기회생 등 형사 문제가 되거나 기각 사유가 될 수 있습니다.</div>
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

        {/* 희망 섹션 */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>🌱</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#166534' }}>회생을 끝내면 이런 일이 생겨요</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              신용점수가 700~800점대로 올라갑니다
            </div>
            <div style={{ fontSize: '11px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              1금융권 정상 거래, 신용카드 발급이 가능해집니다
            </div>
            <div style={{ fontSize: '11px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="#16a34a" />
              빚 걱정 없이 새로운 시작을 할 수 있습니다
            </div>
          </div>
        </div>

        {/* 자료 성격 안내 */}
        <div style={{
          marginTop: 'auto',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '18px 22px',
          backgroundColor: '#f8fafc',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            자동 계산 참고 자료
          </div>
          <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: 1.6 }}>
            이 문서는 이용자가 입력한 정보를 바탕으로 자동 계산한 참고 자료이며, 변호사가 작성하거나 검토한 법률의견서가 아닙니다.
            실제 변제금과 인가 여부는 법원 심리와 제출 서류에 따라 달라지므로, 진행 여부는 선택한 변호사와 상담한 뒤 결정하세요.
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
            생성일: {dateString} | 문서번호: {docSerial}
          </div>
        </div>
      </PageWrapper>

    </div>
  );
}
