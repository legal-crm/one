import React from 'react';
import { Scale, Shield, Check, AlertTriangle, Landmark, Calendar, FileText, User } from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface PrintableReportTemplateProps {
  result: RehabCalculationResult;
  userInput: RehabUserInput;
}

export default function PrintableReportTemplate({ result, userInput }: PrintableReportTemplateProps) {
  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined) return '0원';
    if (amount === 0) return '0원';
    
    const absAmount = Math.abs(amount);
    const eok = Math.floor(absAmount / 100000000);
    const remainder = absAmount % 100000000;
    const man = Math.floor(remainder / 10000);

    let res = '';
    if (eok > 0) res += `${eok}억 `;
    if (man > 0) res += `${man.toLocaleString()}만`;
    return `${res}원`.trim();
  };

  const today = new Date();
  const dateString = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const hasSpeculative = userInput.speculativeLoss && userInput.speculativeLoss > 0;
  const hasGambling = userInput.gamblingLoss && userInput.gamblingLoss > 0;

  const medianIncomes = [
    { size: 1, median: 2564238, minLiving: 1538543 },
    { size: 2, median: 4199292, minLiving: 2519575 },
    { size: 3, median: 5359036, minLiving: 3215422 },
    { size: 4, median: 6494738, minLiving: 3896843 },
    { size: 5, median: 7556719, minLiving: 4534031 },
    { size: 6, median: 8555952, minLiving: 5133571 },
  ];

  const PageWrapper = ({ children, pageNumber }: { children: React.ReactNode, pageNumber: number }) => (
    <div
      id={`pdf-page-${pageNumber}`}
      style={{
        width: '794px',
        height: '1120px',
        backgroundColor: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Pretendard', 'Malgun Gothic', sans-serif",
        color: '#334155'
      }}
    >
      <div style={{ height: '6px', backgroundColor: '#1e1b4b', width: '100%' }} />
      <div style={{ padding: '40px 50px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50px',
          right: '50px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '10.5px',
          color: '#94a3b8',
          fontFamily: "'Pretendard', 'Malgun Gothic', sans-serif"
        }}
      >
        <span>CONFIDENTIAL · ROY LAW CRM SYSTEM</span>
        <span>페이지 {pageNumber} / 7</span>
      </div>
    </div>
  );

  const SectionHeader = ({ icon, title }: { icon: string, title: string }) => (
    <div style={{
      backgroundColor: '#1e1b4b',
      color: '#ffffff',
      padding: '10px 16px',
      borderRadius: '6px',
      fontSize: '16px',
      fontWeight: 'bold',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <span>{icon}</span>
      <span>{title}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', backgroundColor: '#f1f5f9', padding: '20px' }}>
      
      {/* PAGE 1 */}
      <PageWrapper pageNumber={1}>
        <div style={{
          backgroundColor: '#1e1b4b',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '60px'
        }}>
          <Shield size={32} color="#ffffff" />
          <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>ROY LAW CRM SERVICES</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '60px', flex: 1 }}>
          <div style={{ fontSize: '40px', fontWeight: 900, color: '#1e1b4b', marginBottom: '16px' }}>
            개인회생·파산 정밀 진단 보고서
          </div>
          <div style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
            본 보고서는 입력하신 데이터를 바탕으로 AI와 회생 전문 알고리즘이 분석한 예상 결과입니다.<br/>
            실제 법원 심사 과정에서는 다양한 변수에 의해 결과가 달라질 수 있습니다.
          </div>
        </div>

        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '24px',
          marginBottom: '40px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <User size={20} color="#1e1b4b" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>의뢰인</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b' }}>{userInput.name} 님</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={20} color="#1e1b4b" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>진단일자</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b' }}>{dateString}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Landmark size={20} color="#1e1b4b" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>관할법원</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b' }}>{result.courtName}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText size={20} color="#1e1b4b" />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>예상 소요기간</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b' }}>약 {result.processingMonths}개월</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '40px' }}>
          <SectionHeader icon="📊" title="I. Executive Summary (요약)" />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>총 채무액</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>{formatCurrency(userInput.totalDebt)}</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>총 변제예정액 ({result.repaymentMonths}개월)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#059669' }}>{formatCurrency(result.totalRepayment)}</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>예상 탕감액 ({result.debtReductionRate}%)</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4338ca' }}>{formatCurrency(result.totalDebtReduction)}</div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px', fontWeight: 'bold' }}>인가 가능성</div>
              <div style={{
                padding: '8px 16px',
                backgroundColor: result.status === 'POSSIBLE' || (result.status as any) === '가능' ? '#dcfce7' : result.status === 'IMPOSSIBLE' || (result.status as any) === '위험' ? '#fee2e2' : '#fef9c3',
                color: result.status === 'POSSIBLE' || (result.status as any) === '가능' ? '#166534' : result.status === 'IMPOSSIBLE' || (result.status as any) === '위험' ? '#991b1b' : '#854d0e',
                borderRadius: '20px',
                fontWeight: 'bold',
                fontSize: '18px'
              }}>
                {result.status === 'POSSIBLE' ? '가능' : result.status === 'IMPOSSIBLE' ? '불가' : result.status === 'DIFFICULT' ? '보완 필요' : result.status}
              </div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', marginTop: 'auto', marginBottom: '40px', position: 'relative' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '20px', textAlign: 'center' }}>
            * 본 진단은 법률적 효력을 갖는 확정 문서가 아니며, 신청 전 참고용으로만 사용하시기 바랍니다. <br/>
            * 상세 상담을 통해 추가적인 공제 요건이나 특이사항을 검토할 것을 권장합니다.
          </div>
          
          <div style={{ display: 'inline-block', position: 'relative' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '8px' }}>
              ROY LAW CRM 법률 분석 시스템
            </div>
            <div style={{ 
              position: 'absolute', 
              top: '-10px', 
              right: '-30px', 
              width: '70px', 
              height: '70px', 
              borderRadius: '50%', 
              border: '2px solid #ef4444', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#ef4444',
              fontWeight: 'bold',
              fontSize: '14px',
              transform: 'rotate(-15deg)',
              opacity: 0.6
            }}>
              공식진단
            </div>
          </div>
        </div>
      </PageWrapper>

      {/* PAGE 2 */}
      <PageWrapper pageNumber={2}>
        <SectionHeader icon="🏠" title="II. 생계비 및 부양가족 정밀 분석" />
        
        <div style={{ borderLeft: '4px solid #4338ca', backgroundColor: '#eff6ff', padding: '14px', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px', borderRadius: '0 8px 8px 0' }}>
          <strong>기준 중위소득이란?</strong> 보건복지부에서 매년 고시하는 국민 가구소득의 중간값입니다. 개인회생에서는 원칙적으로 이 중위소득의 60%를 '최저생계비'로 인정하여, 소득에서 최저생계비를 공제한 나머지 금액을 월 변제금으로 산정합니다.
        </div>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '10px' }}>
          부양가족 산정 기준
        </div>
        <ul style={{ fontSize: '13px', lineHeight: 1.7, marginBottom: '30px', paddingLeft: '20px', color: '#475569' }}>
          <li><strong>미성년 자녀:</strong> 만 19세 미만 자녀는 원칙적으로 부양가족으로 인정됩니다. 단, 배우자의 소득 유무에 따라 0.5명(50%)만 인정되기도 합니다.</li>
          <li><strong>고령의 부모:</strong> 만 65세 이상 부모 중 소득이 없고 동거 중이거나 정기적 부양비 송금 내역이 있는 경우 예외적으로 인정될 수 있습니다.</li>
          <li><strong>배우자:</strong> 배우자는 원칙적으로 부양가족에서 제외되나, 중증 질환, 임신, 장애 등 근로능력이 상실된 경우 진단서 첨부 시 인정 가능합니다.</li>
        </ul>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '10px' }}>
          2024년 기준 가구별 최저생계비표 (중위소득 60%)
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ backgroundColor: '#1e1b4b', color: '#ffffff', padding: '10px 14px', border: '1px solid #cbd5e1' }}>가구원 수</th>
              <th style={{ backgroundColor: '#1e1b4b', color: '#ffffff', padding: '10px 14px', border: '1px solid #cbd5e1' }}>기준 중위소득 (100%)</th>
              <th style={{ backgroundColor: '#1e1b4b', color: '#ffffff', padding: '10px 14px', border: '1px solid #cbd5e1' }}>최저생계비 (60%)</th>
            </tr>
          </thead>
          <tbody>
            {medianIncomes.map((item, idx) => {
              const isCurrent = item.size === userInput.familySize;
              return (
                <tr key={idx} style={{ 
                  backgroundColor: isCurrent ? '#e0e7ff' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                  borderLeft: isCurrent ? '4px solid #4338ca' : 'none'
                }}>
                  <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: isCurrent ? 'bold' : 'normal' }}>
                    {item.size}인 가구 {isCurrent && '(의뢰인)'}
                  </td>
                  <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                    {formatCurrency(item.median)}
                  </td>
                  <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: isCurrent ? 'bold' : 'normal', color: isCurrent ? '#4338ca' : 'inherit' }}>
                    {formatCurrency(item.minLiving)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '15px' }}>
          소득 대비 생계비 분석 그래프
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '30px', backgroundColor: '#ffffff' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
            <div style={{ width: '150px', fontSize: '13px', fontWeight: 'bold' }}>월 평균 소득</div>
            <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '22px', borderRadius: '11px', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', backgroundColor: '#64748b' }} />
            </div>
            <div style={{ width: '120px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>{formatCurrency(userInput.monthlyIncome)}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
            <div style={{ width: '150px', fontSize: '13px', fontWeight: 'bold' }}>인정 최저생계비</div>
            <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '22px', borderRadius: '11px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (result.recognizedLivingCost / userInput.monthlyIncome) * 100)}%`, height: '100%', backgroundColor: '#059669' }} />
            </div>
            <div style={{ width: '120px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: '#059669' }}>{formatCurrency(result.recognizedLivingCost)}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '150px', fontSize: '13px', fontWeight: 'bold' }}>가용 소득 (월 변제금)</div>
            <div style={{ flex: 1, backgroundColor: '#f1f5f9', height: '22px', borderRadius: '11px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, (result.availableIncome / userInput.monthlyIncome) * 100)}%`, height: '100%', backgroundColor: '#4338ca' }} />
            </div>
            <div style={{ width: '120px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: '#4338ca' }}>{formatCurrency(result.availableIncome)}</div>
          </div>
          
        </div>
      </PageWrapper>

      {/* PAGE 3 */}
      <PageWrapper pageNumber={3}>
        <SectionHeader icon="💰" title="III. 보유자산 및 법원 청산가치 평가" />
        
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', backgroundColor: '#f8fafc', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '8px' }}>청산가치 보장의 원칙이란?</div>
          <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
            개인회생에서 가장 중요한 대원칙 중 하나로, "채무자가 회생을 통해 갚는 총 금액(현재가치 기준)이, 현재 가진 재산을 전부 팔아서 빚을 갚을 때(청산가치)보다 많아야 한다"는 원칙입니다. 따라서 본인의 재산 가치보다 적게 갚는 변제계획안은 법원에서 인가되지 않습니다.
          </div>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '16px' }}>주요 자산별 청산가치 산정 기준</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🏠</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>부동산 및 임대차보증금</span>
            </div>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              시세에서 담보대출액을 뺀 금액이 청산가치입니다. 보증금은 지역별 '소액임차보증금 최우선변제금'을 공제한 나머지 금액만 청산가치에 반영됩니다.
            </div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🚗</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>자동차 (차량)</span>
            </div>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              SK엔카 등 중고차 시세 평균가에서 차량 담보대출 잔액을 공제한 환가가치가 청산가치로 산정됩니다.
            </div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>💸</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>보험 해약환급금 & 퇴직금</span>
            </div>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              보험은 150만원 공제 후 나머지, 퇴직금은 민사집행법에 따라 50%만 청산가치에 포함됩니다.
            </div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px' }}>🎲</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>사행성 손실 (주식/도박)</span>
            </div>
            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              법원에 따라 주식/코인 손실금이나 도박 탕진액을 전액 청산가치(재산)에 산입하도록 명령할 수 있습니다.
            </div>
          </div>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '10px' }}>2024년 지역별 소액임차보증금 면제 범위 (참고)</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ backgroundColor: '#1e1b4b', color: '#ffffff', padding: '10px 14px', border: '1px solid #cbd5e1' }}>지역</th>
              <th style={{ backgroundColor: '#1e1b4b', color: '#ffffff', padding: '10px 14px', border: '1px solid #cbd5e1' }}>보증금 범위</th>
              <th style={{ backgroundColor: '#1e1b4b', color: '#ffffff', padding: '10px 14px', border: '1px solid #cbd5e1' }}>면제 재산(최우선변제금)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>서울특별시</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center' }}>1억 6,500만원 이하</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#4338ca', fontWeight: 'bold' }}>5,500만원</td>
            </tr>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>수도권 과밀억제권역 등</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center' }}>1억 4,500만원 이하</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center', color: '#0d9488', fontWeight: 'bold' }}>4,800만원</td>
            </tr>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>광역시, 안산, 광주, 파주 등</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center' }}>8,500만원 이하</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>2,800만원</td>
            </tr>
            <tr style={{ backgroundColor: '#ffffff' }}>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>그 밖의 지역</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center' }}>7,500만원 이하</td>
              <td style={{ padding: '10px 14px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>2,500만원</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '16px' }}>청산가치 보장 원칙 검증 결과</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '12px', padding: '24px', flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>의뢰인의 산정된 청산가치 (재산)</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#334155' }}>{formatCurrency(result.liquidationValue)}</div>
          </div>
          
          <div style={{ fontSize: '24px', color: '#94a3b8' }}>&lt;</div>
          
          <div style={{ border: '2px solid #4338ca', borderRadius: '12px', padding: '24px', flex: 1, textAlign: 'center', backgroundColor: '#eef2ff' }}>
            <div style={{ fontSize: '14px', color: '#4338ca', marginBottom: '8px', fontWeight: 'bold' }}>총 변제예정액</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4338ca' }}>{formatCurrency(result.totalRepayment)}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '13px', color: '#059669', marginTop: '16px', fontWeight: 'bold' }}>
          ✓ 총 변제액이 청산가치보다 커서 청산가치 보장 원칙을 충족합니다.
        </div>
      </PageWrapper>

      {/* PAGE 4 */}
      <PageWrapper pageNumber={4}>
        <SectionHeader icon="⚖️" title="IV. 월 변제금 결정 과정 상세 분석" />
        
        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '24px', lineHeight: 1.6, padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
          월 변제금은 '가용소득'을 기준으로 산정되나, 청산가치 보장 원칙 및 최저 변제액 규정에 따라 상향 조정될 수 있습니다. 아래는 최종 월 변제금이 결정되는 논리적 흐름입니다.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '140px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
              월 평균 소득
            </div>
            <div style={{ flex: 1, borderBottom: '1px dashed #cbd5e1', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: '-8px' }}>▶</div>
            </div>
            <div style={{ width: '120px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
              {formatCurrency(userInput.monthlyIncome)}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '140px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
              인정 최저생계비 (-)
            </div>
            <div style={{ flex: 1, borderBottom: '1px dashed #cbd5e1', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: '-8px' }}>▶</div>
            </div>
            <div style={{ width: '120px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
              - {formatCurrency(result.recognizedLivingCost)}
            </div>
          </div>

          <div style={{ paddingLeft: '156px', fontSize: '12px', color: '#64748b' }}>
            * 기본 생계비: {formatCurrency(result.baseLivingCost)}<br/>
            * 추가 생계비(의료비, 주거비 등): {formatCurrency(result.additionalLivingCost)}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            <div style={{ width: '140px', padding: '12px', backgroundColor: '#e0e7ff', color: '#4338ca', borderRadius: '6px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
              기본 가용소득 (=)
            </div>
            <div style={{ flex: 1, borderBottom: '1px dashed #cbd5e1', position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: '-8px' }}>▶</div>
            </div>
            <div style={{ width: '120px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#4338ca' }}>
              {formatCurrency(result.availableIncome)}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '16px' }}>
          변제금 결정 3대 요건 비교
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ border: '1px solid #4338ca', backgroundColor: '#eef2ff', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#4338ca', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', marginRight: '16px' }}>1</div>
            <div style={{ flex: 1, fontSize: '13px', fontWeight: 'bold' }}>가용소득에 따른 산정액</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4338ca' }}>{formatCurrency(result.availableIncome)} / 월</div>
          </div>
          
          <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#94a3b8', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', marginRight: '16px' }}>2</div>
            <div style={{ flex: 1, fontSize: '13px', color: '#475569' }}>청산가치 보장을 위한 최소 필요액 (추산)</div>
            <div style={{ fontSize: '14px', color: '#475569' }}>{formatCurrency(Math.ceil(result.liquidationValue / result.repaymentMonths))} / 월</div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#94a3b8', color: '#ffffff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', marginRight: '16px' }}>3</div>
            <div style={{ flex: 1, fontSize: '13px', color: '#475569' }}>총 채무액 대비 최소 변제 기준액</div>
            <div style={{ fontSize: '14px', color: '#475569' }}>{formatCurrency(Math.ceil((userInput.totalDebt * 0.05) / result.repaymentMonths))} / 월</div>
          </div>
        </div>

        {(hasGambling || hasSpeculative) && (
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '16px', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '24px' }}>
            <AlertTriangle size={20} color="#d97706" style={{ marginTop: '2px' }} />
            <div style={{ fontSize: '13px', color: '#b45309', lineHeight: 1.5 }}>
              <strong>주의: 사행성 채무 특칙 적용 가능성</strong><br/>
              도박이나 주식/코인 투자 손실금이 존재합니다. 법원 실무상 해당 손실금 전액을 청산가치에 반영하도록 보정권고가 나올 수 있으며, 이 경우 월 변제금이 대폭 상승하거나 인가가 어려울 수 있습니다.
            </div>
          </div>
        )}

        <div style={{ backgroundColor: '#1e1b4b', color: '#ffffff', borderRadius: '10px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>최종 예상 월 변제금</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fde047' }}>{formatCurrency(result.monthlyPayment)}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '30px' }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>변제 기간</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#334155' }}>{result.repaymentMonths}개월</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>월 변제금</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#334155' }}>{formatCurrency(result.monthlyPayment)}</div>
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>총 변제금</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>{formatCurrency(result.totalRepayment)}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#065f46', marginBottom: '12px', textAlign: 'center' }}>
            💡 채무 탕감 요약
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#047857', marginBottom: '4px' }}>예상 탕감액</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>{formatCurrency(result.totalDebtReduction)}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#047857', marginBottom: '4px' }}>탕감율</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>{result.debtReductionRate}%</div>
            </div>
          </div>
        </div>

      </PageWrapper>

      {/* PAGE 5 */}
      <PageWrapper pageNumber={5}>
        <SectionHeader icon="🏛️" title="V. 관할법원 분석 및 대응 가이드" />
        
        <div style={{ 
          backgroundColor: result.status === 'IMPOSSIBLE' || (result.status as any) === '위험' ? '#fef2f2' : '#f8fafc', 
          border: `1px solid ${result.status === 'IMPOSSIBLE' || (result.status as any) === '위험' ? '#fca5a5' : '#e2e8f0'}`,
          borderRadius: '10px', 
          padding: '24px',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Landmark size={24} color={result.status === 'IMPOSSIBLE' || (result.status as any) === '위험' ? '#ef4444' : '#1e1b4b'} />
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: result.status === 'IMPOSSIBLE' || (result.status as any) === '위험' ? '#b91c1c' : '#1e1b4b' }}>
              관할법원: {result.courtName}
            </div>
          </div>
          
          <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.7, marginBottom: '20px' }}>
            각 지방법원마다 개인회생 사건을 심사하는 실무 준칙과 엄격성이 다릅니다. 귀하의 관할인 <strong>{result.courtName}</strong>의 주요 특징과 심사 성향을 분석하여 최적의 인가 전략을 수립해야 합니다. 특히 최근 주식/코인 손실이나 과도한 최근 채무에 대해 보정명령이 강화되는 추세입니다.
          </div>

          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '12px' }}>
            로이 변호사 체크리스트
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Check size={16} color="#059669" style={{ marginTop: '3px', flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#334155' }}>
                <strong>최근 대출금 사용처 소명:</strong> 대출 발생일로부터 1년 이내의 채무 비중이 높을 경우, 생활비 등 필수적인 곳에 사용했다는 금융거래내역 증빙이 필수입니다.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Check size={16} color="#059669" style={{ marginTop: '3px', flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#334155' }}>
                <strong>추가 생계비 인정 여부:</strong> 월세, 고정 의료비 등 추가 생계비를 청구할 경우, 해당 법원의 실무상 인정 범위(보통 중위소득의 일정 비율 제한)를 확인해야 합니다.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Check size={16} color="#059669" style={{ marginTop: '3px', flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: '#334155' }}>
                <strong>변제금 상향 보정 대비:</strong> 인가 결정을 위해 법원이 월 변제금을 올리라는 보정명령을 내릴 수 있으며, 수용 가능한 마지노선을 미리 설정해야 합니다.
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🤖</span> AI 분석 종합 코멘트
        </div>
        
        <div style={{ borderLeft: '4px solid #4338ca', backgroundColor: '#eef2ff', padding: '20px', borderRadius: '0 8px 8px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(result.aiAdvice || []).map((advice, index) => (
            <div key={index} style={{ fontSize: '13px', color: '#312e81', lineHeight: 1.6 }}>
              • {advice}
            </div>
          ))}
          {(!result.aiAdvice || result.aiAdvice.length === 0) && (
            <div style={{ fontSize: '13px', color: '#312e81' }}>
              특별한 이상 징후가 발견되지 않았습니다. 통상적인 절차에 따라 진행이 가능할 것으로 예상됩니다.
            </div>
          )}
        </div>

      </PageWrapper>

      {/* PAGE 6 */}
      <PageWrapper pageNumber={6}>
        <SectionHeader icon="📖" title="VI. 핵심 용어 해설" />
        
        <div style={{ fontSize: '13px', color: '#475569', marginBottom: '24px', padding: '0 8px' }}>
          개인회생 절차에서 자주 사용되는 필수 법률 용어입니다. 절차 진행 중 법원의 문건이나 상담 시 도움이 될 수 있습니다.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[
            {
              term: '가용소득',
              desc: '월 평균 소득에서 법원이 인정하는 최저생계비 및 추가생계비를 공제하고 남은 금액입니다. 원칙적으로 이 금액이 매월 납부해야 할 월 변제금이 됩니다.'
            },
            {
              term: '청산가치',
              desc: '채무자가 현재 보유하고 있는 모든 재산(부동산, 임차보증금, 차량, 예금, 보험해약환급금 등)을 처분했을 때 확보할 수 있는 총 금액을 의미합니다.'
            },
            {
              term: '보정권고 / 보정명령',
              desc: '법원이 신청서를 검토한 후 누락된 서류를 보완하거나, 미심쩍은 재산/채무 내역에 대해 소명하라고 요구하는 절차입니다. 기한 내 미제출 시 기각될 수 있습니다.'
            },
            {
              term: '금지명령 / 중지명령',
              desc: '개인회생 신청 직후 법원에 요청하여, 채권자들의 독촉, 압류, 추심 행위를 법적으로 금지시키는 명령입니다. 통상 접수 후 1~2주 내에 결정됩니다.'
            },
            {
              term: '개시결정',
              desc: '법원이 서류 심사를 마치고 본격적으로 회생 절차를 시작하겠다고 선언하는 것입니다. 이때부터 법원 계좌로 변제금을 납부하기 시작합니다.'
            },
            {
              term: '인가결정',
              desc: '채무자가 제출한 변제계획안을 법원이 최종적으로 확정하고 승인하는 절차입니다. 인가결정 후에는 채무가 확정되어 압류 등이 취소될 수 있습니다.'
            },
            {
              term: '면책결정',
              desc: '36~60개월의 변제 기간 동안 납부 의무를 모두 완료한 후, 나머지 갚지 못한 빚을 탕감(면제)받는 최종 절차입니다.'
            },
            {
              term: '채권자집회',
              desc: '인가결정 전 채무자가 법원에 출석하여 채권자들의 이의신청에 대해 답변하는 기일입니다. 실무상 채권자가 참석하는 경우는 매우 드뭅니다.'
            }
          ].map((item, idx) => (
            <div key={idx} style={{ 
              padding: '16px', 
              border: '1px solid #e2e8f0', 
              borderRadius: '8px', 
              backgroundColor: idx % 4 === 1 || idx % 4 === 2 ? '#ffffff' : '#f8fafc'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4338ca', marginBottom: '8px' }}>
                {item.term}
              </div>
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </PageWrapper>

      {/* PAGE 7 */}
      <PageWrapper pageNumber={7}>
        <SectionHeader icon="⚠️" title="VII. 주의사항 총정리" />
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
          
          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '20px', borderRadius: '10px' }}>
            <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#991b1b', marginBottom: '6px' }}>1. 신청 전 대출 금지</div>
              <div style={{ fontSize: '12px', color: '#7f1d1d', lineHeight: 1.5 }}>
                개인회생을 앞두고 무리하게 추가 대출을 받거나 신용카드를 사용하는 것은 '사기회생죄'로 처벌받거나 기각 사유가 될 수 있습니다.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '20px', borderRadius: '10px' }}>
            <Landmark size={24} color="#d97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#92400e', marginBottom: '6px' }}>2. 재산 은닉 및 염가 처분 절대 금지</div>
              <div style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.5 }}>
                본인 명의의 부동산이나 차량을 지인에게 헐값에 넘기거나 명의를 변경하는 행위는 부인권 행사의 대상이 되며 심각한 불이익을 초래합니다.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '20px', borderRadius: '10px' }}>
            <FileText size={24} color="#16a34a" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#166534', marginBottom: '6px' }}>3. 성실한 소명 서류 준비</div>
              <div style={{ fontSize: '12px', color: '#14532d', lineHeight: 1.5 }}>
                법원의 보정명령에 대해 기한 내에 정확하고 투명한 금융자료를 제출하는 것이 인가율을 높이는 가장 핵심적인 요소입니다.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '20px', borderRadius: '10px' }}>
            <User size={24} color="#2563eb" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e40af', marginBottom: '6px' }}>4. 특정 채권자 편파 변제 금지</div>
              <div style={{ fontSize: '12px', color: '#1e3a8a', lineHeight: 1.5 }}>
                가족이나 지인의 빚만 먼저 갚아주는 행위(편파 변제)는 법원에서 부인권 행사 대상으로 보아 해당 금액만큼 청산가치에 강제 반영될 수 있습니다.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', backgroundColor: '#faf5ff', border: '1px solid #e9d5ff', padding: '20px', borderRadius: '10px' }}>
            <Scale size={24} color="#9333ea" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#6b21a8', marginBottom: '6px' }}>5. 법률 전문가와의 지속적 소통</div>
              <div style={{ fontSize: '12px', color: '#581c87', lineHeight: 1.5 }}>
                진행 중 이직, 소득 변동, 이사 등 주요 변경 사항이 생기면 반드시 대리인 사무실에 즉각 통보하여 전략을 수정해야 합니다.
              </div>
            </div>
          </div>

        </div>

        <div style={{ borderTop: '2px solid #1e1b4b', paddingTop: '40px', marginTop: 'auto', marginBottom: '60px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Shield size={48} color="#1e1b4b" opacity={0.1} />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '12px' }}>
            ROY LAW CRM SERVICES
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6 }}>
            본 보고서는 ROY LAW CRM 시스템 알고리즘에 의해 자동 생성되었습니다.<br/>
            발행일자: {dateString} | 문서번호: RLC-{today.getFullYear()}{String(today.getMonth()+1).padStart(2, '0')}{String(today.getDate()).padStart(2, '0')}-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}
          </div>
        </div>

      </PageWrapper>
    </div>
  );
}
