import React from 'react';
import { Scale, Shield, Check, AlertTriangle, Landmark, Calendar, FileText, User } from 'lucide-react';
import { RehabCalculationResult, RehabUserInput } from '../../rehab-chatbot-package/services/calculationService';

interface PrintableReportTemplateProps {
    result: RehabCalculationResult;
    userInput: RehabUserInput;
}

export default function PrintableReportTemplate({ result, userInput }: PrintableReportTemplateProps) {
    const today = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

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

    const hasSpeculative = userInput.speculativeLoss && userInput.speculativeLoss > 0;
    const hasGambling = userInput.gamblingLoss && userInput.gamblingLoss > 0;

    // 2026년 가구원수별 보건복지부 기준 중위소득 및 60% 생계비 데이터
    const medianIncomes = [
        { size: 1, median: 2564238, minLiving: 1538543 },
        { size: 2, median: 4199292, minLiving: 2519575 },
        { size: 3, median: 5359036, minLiving: 3215422 },
        { size: 4, median: 6494738, minLiving: 3896843 },
        { size: 5, median: 7556719, minLiving: 4534031 },
        { size: 6, median: 8555952, minLiving: 5133571 },
    ];

    return (
        <div 
            id="printable-pdf-report"
            style={{
                width: '794px',
                fontFamily: "'Pretendard', 'Malgun Gothic', sans-serif",
                color: '#1e293b',
                backgroundColor: '#ffffff',
                lineHeight: 1.5,
                margin: 0,
                padding: 0,
                boxSizing: 'border-box'
            }}
        >
            {/* ================= PAGE 1 (COVER & EXECUTIVE SUMMARY) ================= */}
            <div 
                id="pdf-page-1"
                style={{
                    width: '794px',
                    height: '1120px',
                    padding: '50px 45px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    border: '15px double #1e1b4b',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#ffffff',
                    pageBreakAfter: 'always'
                }}
            >
                {/* Top Confidential Mark */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px' }}>CONFIDENTIAL REPORT</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>법률 자문 및 채무조정 분석 리포트</span>
                </div>

                {/* Main Title Area */}
                <div style={{ marginTop: '55px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                        <Shield style={{ width: '28px', height: '28px', color: '#312e81' }} />
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#312e81', letterSpacing: '3px' }}>ROY LAW CRM SERVICES</span>
                    </div>
                    
                    <h1 style={{ 
                        fontSize: '34px', 
                        fontWeight: '900', 
                        color: '#1e1b4b', 
                        lineHeight: 1.3,
                        margin: '10px 0 15px 0',
                        letterSpacing: '-1px'
                    }}>
                        의뢰인 종합 채무조정 및<br />
                        개인회생 정밀 진단 보고서
                    </h1>
                    
                    <div style={{ width: '80px', height: '4px', backgroundColor: '#312e81', margin: '15px auto' }}></div>
                    
                    <p style={{ fontSize: '12px', color: '#475569', marginTop: '10px', lineHeight: 1.6 }}>
                        본 보고서는 신청인의 소득, 자산 현황, 부양가족 및 채무 상황을 종합 검토하여<br />
                        채무자회생법 기준 최적의 생계비 공제 혜택과 법원 인가 가능성을 정밀하게 산출한 문서입니다.
                    </p>
                </div>

                {/* Client Info Block */}
                <div style={{ 
                    backgroundColor: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '10px', 
                    padding: '20px 25px', 
                    margin: '25px 0',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px'
                }}>
                    <div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>의뢰인 성명</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                            <User style={{ width: '15px', height: '15px', display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom', color: '#312e81' }} />
                            {userInput.name || '의뢰인'} 귀하
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>진단 일자</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                            <Calendar style={{ width: '15px', height: '15px', display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom', color: '#312e81' }} />
                            {today}
                        </div>
                    </div>
                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px' }}>신청 예정 관할 법원</div>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                            <Landmark style={{ width: '15px', height: '15px', display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: '#312e81' }} />
                            {result.courtName} (평균 개시결정 소요 기간: 약 {result.processingMonths}개월 내외)
                        </div>
                    </div>
                </div>

                {/* Executive Summary Box */}
                <div style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    backgroundColor: '#f1f5f9'
                }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 12px 0', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px' }}>
                        I. 최종 분석 결과 요지 (Executive Summary)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid #cbd5e1', paddingRight: '15px' }}>
                            <div style={{ fontSize: '11px', color: '#475569' }}>예상 법정 승인 가능성</div>
                            <div style={{ fontSize: '18px', fontWeight: '900', color: result.status === 'POSSIBLE' ? '#10b981' : result.status === 'DIFFICULT' ? '#f59e0b' : '#ef4444', marginTop: '4px' }}>
                                {result.status === 'POSSIBLE' ? '개인회생 인가 유력' : result.status === 'DIFFICULT' ? '법리 보완 후 진행 권장' : '신청 불허 리스크 대상'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                                평균 탕감비율: <strong style={{ color: '#312e81', fontSize: '14px' }}>{result.debtReductionRate}% (빚 면제 혜택)</strong>
                            </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>• 총 기존 채무액:</span>
                                <span style={{ fontWeight: 'bold' }}>{formatCurrency(userInput.totalDebt)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>• 3년간 법원 총 변제액:</span>
                                <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(result.totalRepayment)}</span>
                            </div>
                            <div style={{ display: 'flex', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', justifyContent: 'space-between' }}>
                                <span>• 탕감받는 채무 면책액:</span>
                                <span style={{ fontWeight: 'bold', color: '#312e81' }}>{formatCurrency(result.totalDebtReduction)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Seal Emulation */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '15px 0' }}>
                    <div style={{
                        width: '90px',
                        height: '90px',
                        borderRadius: '50%',
                        border: '3px double #1e1b4b',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: '#1e1b4b',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                        background: 'radial-gradient(circle, #f8fafc 0%, #ffffff 100%)',
                        boxShadow: '0 4px 8px rgba(30, 27, 75, 0.05)',
                    }}>
                        <Scale style={{ width: '20px', height: '20px', marginBottom: '2px', color: '#312e81' }} />
                        <span style={{ fontSize: '7.5px', letterSpacing: '0.5px' }}>ROY LAW CRM</span>
                        <span style={{ fontSize: '6.5px', color: '#64748b', fontWeight: 'normal' }}>CERTIFIED</span>
                    </div>
                </div>

                {/* Footer Credits */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '9px', color: '#94a3b8' }}>
                    <span>ROY LAW CRM SYSTEM V2.6</span>
                    <span>본 보고서는 의뢰인 기초 진단용으로 변호사 면담의 기초 자료로 활용됩니다.</span>
                </div>
            </div>

            {/* ================= PAGE 2 (생계비 및 부양가족 정밀 분석) ================= */}
            <div 
                id="pdf-page-2"
                style={{
                    width: '794px',
                    height: '1120px',
                    padding: '50px 45px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    border: '15px double #1e1b4b',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#ffffff',
                    pageBreakAfter: 'always'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#312e81' }}>II. 생계비 및 부양가족 정밀 분석</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>의뢰인: {userInput.name || '의뢰인'}</span>
                </div>

                <div style={{ flex: 1, marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* 1. 용어 설명 */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', borderLeft: '4px solid #312e81' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 5px 0' }}>💡 쉽게 풀어보는 용어 설명</h4>
                        <p style={{ fontSize: '10.5px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                            <strong>법정 생계비:</strong> 채무자가 개인회생을 진행하는 동안 매달 빚을 갚기 전에, 나와 가족들의 생계를 유지하기 위해 법적으로 보장받는 생활비입니다. 이 생계비만큼은 소득에서 제외되어 압류되지 않으며 본인이 자유롭게 사용할 수 있습니다.
                        </p>
                    </div>

                    {/* 2. 부양가족 기준 설명 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            1. 나의 부양가족 산정 근거와 산출 방법
                        </h4>
                        
                        <div style={{ fontSize: '11px', color: '#334155', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <p style={{ margin: 0 }}>
                                현재 의뢰인님의 인정 부양가족 수는 <strong>{userInput.familySize ? userInput.familySize - 1 : 0}명</strong>으로 진단되었습니다. 이에 따라 본인을 포함한 가구원 수는 총 <strong>{userInput.familySize || 1}인 가구</strong>로 법원에 신청하게 됩니다.
                            </p>
                            
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', backgroundColor: '#f8fafc' }}>
                                <strong style={{ fontSize: '11px', color: '#1e1b4b', display: 'block', marginBottom: '6px' }}>📍 왜 이렇게 계산되나요? 부양가족 판정의 핵심 요건</strong>
                                <ul style={{ margin: 0, paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <li><strong>미성년 자녀 (만 19세 미만):</strong> 본인이 부양의무를 지므로 원칙적으로 전원 부양가족으로 인정됩니다. (맞벌이 부부의 경우 원칙적으로 소득이 더 높은 사람에게 부양가족이 일괄 배정되거나 양 부부가 나누어 배정받게 됩니다.)</li>
                                    <li><strong>고령 직계존속 (만 65세 이상 부모님):</strong> 주민등록상 동거 여부와 실질적 부양 여부, 그리고 부모님의 별도 소득 및 재산이 없거나 미미해야 부양가족으로 합산이 가능합니다.</li>
                                    <li><strong>배우자 (원칙적 제외):</strong> 배우자는 경제활동을 할 수 있는 육체적 나이에 속할 경우 원칙적으로 부양가족에서 제외됩니다. (단, 장애, 만성 중증질환 등으로 근로능력이 전혀 없음을 법리적으로 소명하는 경우에만 인정받을 수 있습니다.)</li>
                                </ul>
                            </div>
                            
                            {userInput.familySize && userInput.familySize >= 2 ? (
                                <p style={{ margin: 0, color: '#0f172a', fontWeight: 'bold' }}>
                                    📝 의뢰인 상황 분석: 부양가족이 본인 외 {(userInput.familySize || 1) - 1}명이므로, 신청인 포함 총 {userInput.familySize}인 가구에 대한 생계비가 월 소득에서 기본 공제됩니다.
                                </p>
                            ) : (
                                <p style={{ margin: 0, color: '#475569' }}>
                                    📝 의뢰인 상황 분석: 단독 생계(1인 가구)로 산정되었으며, 추가 의료비나 주거비 특별 소명을 통해 생계비 추가 확대를 목표로 진행합니다.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 3. 생계비 산정 기준 표 및 그래프 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            2. 2026년 기준 가구원수별 인정 생계비 (보건복지부 기준 60%)
                        </h4>
                        <p style={{ fontSize: '10px', color: '#64748b', marginTop: 0, marginBottom: '8px' }}>
                            ※ 법률적 근거: 채무자회생법 제579조 제4호 및 각 회생법원 실무준칙에 의거, 국민기초생활보장법상 기준 중위소득의 60%를 기본 생계비로 정하고 있습니다.
                        </p>
                        
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', textAlign: 'left', marginBottom: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '6px 8px', color: '#475569' }}>가구수</th>
                                    <th style={{ padding: '6px 8px', color: '#475569', textAlign: 'right' }}>2026 기준 중위소득</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', color: '#312e81' }}>인정 생계비 (60% 공제액)</th>
                                    <th style={{ padding: '6px 8px', color: '#475569' }}>적용 여부</th>
                                </tr>
                            </thead>
                            <tbody>
                                {medianIncomes.map((item) => {
                                    const isCurrent = item.size === (userInput.familySize || 1);
                                    return (
                                        <tr key={item.size} style={{ 
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: isCurrent ? '#f1f5f9' : 'transparent',
                                            fontWeight: isCurrent ? 'bold' : 'normal'
                                        }}>
                                            <td style={{ padding: '6px 8px' }}>{item.size}인 가구</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748b' }}>{item.median.toLocaleString()}원</td>
                                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#312e81' }}>{item.minLiving.toLocaleString()}원</td>
                                            <td style={{ padding: '6px 8px', color: isCurrent ? '#10b981' : '#cbd5e1' }}>
                                                {isCurrent ? '★ 의뢰인 적용' : '미적용'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* 생계비 공제 시각화 차트 (CSS) */}
                        <div style={{ 
                            border: '1px solid #e2e8f0', 
                            borderRadius: '8px', 
                            padding: '12px 15px', 
                            backgroundColor: '#fafafa',
                            marginTop: '5px'
                        }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1e1b4b', display: 'block', marginBottom: '8px' }}>
                                📊 월 소득 대비 생계비 확보 수준 ({userInput.familySize || 1}인 가구 기준)
                            </span>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* 월 소득 바 */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', marginBottom: '3px' }}>
                                        <span>내 월 평균 소득</span>
                                        <span style={{ fontWeight: 'bold' }}>{formatCurrency(userInput.monthlyIncome)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#64748b' }}></div>
                                    </div>
                                </div>
                                {/* 생계비 바 */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#1e1b4b', marginBottom: '3px' }}>
                                        <span>인정 생활비 (법정 생계비 {formatCurrency(result.baseLivingCost)} + 추가 소명 생계비 {formatCurrency(result.additionalLivingCost)})</span>
                                        <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                                            {formatCurrency(result.baseLivingCost + result.additionalLivingCost)}
                                        </span>
                                    </div>
                                    <div style={{ width: '100%', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${Math.min(100, Math.round(((result.baseLivingCost + result.additionalLivingCost) / Math.max(1, userInput.monthlyIncome || 1)) * 100))}%`, 
                                            height: '100%', 
                                            backgroundColor: '#10b981' 
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                            <p style={{ fontSize: '10px', color: '#64748b', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                                * 남는 자금(가용 소득): <strong>{formatCurrency(result.monthlyPayment)}</strong>가 월 변제금으로 도출되며, 이 금액으로 3년간 채무를 변제하고 남은 빚은 전액 탕감받습니다.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '9px', color: '#94a3b8' }}>
                    <span>CONFIDENTIAL - ROY LAW CRM SYSTEM</span>
                    <span>페이지 2 / 4</span>
                </div>
            </div>

            {/* ================= PAGE 3 (자산 및 청산가치 정밀 평가) ================= */}
            <div 
                id="pdf-page-3"
                style={{
                    width: '794px',
                    height: '1120px',
                    padding: '50px 45px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    border: '15px double #1e1b4b',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#ffffff',
                    pageBreakAfter: 'always'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#312e81' }}>III. 보유자산 및 법원 청산가치 평가</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>의뢰인: {userInput.name || '의뢰인'}</span>
                </div>

                <div style={{ flex: 1, marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* 1. 용어 및 원칙 설명 */}
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', borderLeft: '4px solid #312e81' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 5px 0' }}>⚖️ 청산가치 보장 원칙이란 무엇인가요?</h4>
                        <p style={{ fontSize: '10.5px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                            개인회생을 신청할 때, <strong>"내가 3년 동안 법원에 갚는 돈의 총합은 내 재산의 합계(청산가치)보다 반드시 많아야 한다"</strong>는 가장 핵심적인 법적 원칙입니다. 채권자들에게 채무자가 파산했을 때 배당받는 재산가치 이상을 갚아주도록 형평성을 보장하기 위함입니다. 따라서 재산 평가를 낮출 수 있는 법률적 공제 근거를 적극 소명하여 청산가치를 낮추는 것이 변제금을 낮추는 핵심 전략입니다.
                        </p>
                    </div>

                    {/* 2. 자산 세부 산정 내역 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            1. 세부 자산별 산정 기준 및 법률 공제 근거
                        </h4>
                        
                        <div style={{ fontSize: '10.5px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {/* 배우자 자산 설명 */}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{ minWidth: '100px', fontWeight: 'bold', color: '#312e81' }}>• 배우자 재산</div>
                                <div style={{ flex: 1 }}>
                                    기본적으로 부부 공동 재산으로 보아 배우자 명의 재산의 50%를 합산하는 것이 일반 실무 기준입니다. 
                                    하지만 <strong>서울/수원/부산회생법원</strong>의 경우, 실무준칙 개정으로 배우자 명의의 재산을 원칙적으로 채무자의 청산가치에 반영하지 않도록 규정(0% 반영)하고 있어, 해당 관할은 자산 평가에서 대단히 큰 혜택을 봅니다.
                                </div>
                            </div>
                            
                            {/* 퇴직금 및 퇴직연금 설명 */}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                <div style={{ minWidth: '100px', fontWeight: 'bold', color: '#312e81' }}>• 퇴직금 / 연금</div>
                                <div style={{ flex: 1 }}>
                                    일반 퇴직금은 향후 수령할 금액이므로 예상액의 50%가 청산가치에 들어갑니다. (나머지 50%는 법상 압류금지 재산). 
                                    그러나 <strong>근로자퇴직급여 보장법</strong>에 따라 금융사에 적립되는 <strong>퇴직연금(DB형, DC형, IRP)</strong>은 법원 압류가 완전히 금지되어 청산가치에 <strong>전혀 반영되지 않습니다 (0% 반영)</strong>. 이 점을 정확히 소명하여 불필요한 자산 산입을 막아야 합니다.
                                </div>
                            </div>

                            {/* 소액임차 보증금 설명 */}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                                <div style={{ minWidth: '100px', fontWeight: 'bold', color: '#312e81' }}>• 소액 보증금 공제</div>
                                <div style={{ flex: 1 }}>
                                    주택임대차보호법에 근거하여, 채무자가 거주 중인 지역별 임차 보증금 중 법적으로 보호받아 청산가치에서 공제되는 면제재산 기준입니다.
                                    <ul style={{ margin: '4px 0 0 0', paddingLeft: '15px', color: '#475569' }}>
                                        <li><strong>서울특별시:</strong> 5,500만 원 공제</li>
                                        <li><strong>수도권 과밀억제권역 (세종, 용인, 화성 포함):</strong> 4,850만 원 공제</li>
                                        <li><strong>광역시 (안산, 광주, 파주, 평택 등 포함):</strong> 2,800만 원 공제</li>
                                        <li><strong>기타 그 밖의 지역:</strong> 2,500만 원 공제</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. 자산 vs 3년 변제예정액 비교 차트 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            2. 나의 법적 청산가치 보장 충족성 검토 시각화
                        </h4>
                        
                        <div style={{ 
                            border: '1px solid #cbd5e1', 
                            borderRadius: '8px', 
                            padding: '12px 15px', 
                            backgroundColor: '#f8fafc',
                            marginTop: '5px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', color: '#1e1b4b', marginBottom: '8px' }}>
                                <span>⚖️ 청산가치(재산) vs 3년간 총 갚는 금액(총 변제액) 비교</span>
                                <span style={{ color: result.totalRepayment >= result.liquidationValue ? '#10b981' : '#ef4444' }}>
                                    {result.totalRepayment >= result.liquidationValue ? '보장 원칙 통과 (적합)' : '보완 및 변제조정 필요'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* 청산가치 */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569', marginBottom: '3px' }}>
                                        <span>내 법적 재산 합계 (최종 청산가치)</span>
                                        <span style={{ fontWeight: 'bold' }}>{formatCurrency(result.liquidationValue)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${Math.min(100, Math.round((result.liquidationValue / Math.max(1, result.totalRepayment, result.liquidationValue)) * 100))}%`, 
                                            height: '100%', 
                                            backgroundColor: '#f59e0b' 
                                        }}></div>
                                    </div>
                                </div>

                                {/* 총 변제예정액 */}
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#1e1b4b', marginBottom: '3px' }}>
                                        <span>3년(36개월) 동안 내가 총 법원에 갚을 돈</span>
                                        <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(result.totalRepayment)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '14px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ 
                                            width: `${Math.min(100, Math.round((result.totalRepayment / Math.max(1, result.totalRepayment, result.liquidationValue)) * 100))}%`, 
                                            height: '100%', 
                                            backgroundColor: '#10b981' 
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                            <p style={{ fontSize: '9.5px', color: '#64748b', margin: '8px 0 0 0', lineHeight: 1.4 }}>
                                * 법률 검토 의견: 총 변제예정액({formatCurrency(result.totalRepayment)})이 청산가치({formatCurrency(result.liquidationValue)})보다 크므로 회생 조건이 성립됩니다. 만약 자산 평가액이 변제금보다 커질 경우 변제 개월수를 늘리거나 재산 평가 축소 전략을 병행해야 합니다.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '9px', color: '#94a3b8' }}>
                    <span>CONFIDENTIAL - ROY LAW CRM SYSTEM</span>
                    <span>페이지 3 / 4</span>
                </div>
            </div>

            {/* ================= PAGE 4 (법원 성향 및 변호사 상담 가이드) ================= */}
            <div 
                id="pdf-page-4"
                style={{
                    width: '794px',
                    height: '1120px',
                    padding: '50px 45px',
                    boxSizing: 'border-box',
                    position: 'relative',
                    border: '15px double #1e1b4b',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#ffffff'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#312e81' }}>IV. 관할법원 분석 및 대응 가이드</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>의뢰인: {userInput.name || '의뢰인'}</span>
                </div>

                <div style={{ flex: 1, marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    
                    {/* 1. 투자/도박 채무 리스크 진단 */}
                    <div style={{ 
                        border: '1px solid #fca5a5', 
                        backgroundColor: '#fffbeb', 
                        borderRadius: '8px', 
                        padding: '12px 15px', 
                        fontSize: '11px' 
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                            <AlertTriangle style={{ width: '14px', height: '14px', color: '#b91c1c' }} />
                            <span>1년 이내 투자·도박 채무 분석 및 리스크 진단</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderBottom: '1px solid #fca5a5', paddingBottom: '8px', marginBottom: '8px' }}>
                            <div>
                                <span style={{ color: '#7f1d1d' }}>• 주식/코인 투자 손실액: </span>
                                <strong style={{ color: '#b91c1c' }}>{hasSpeculative ? formatCurrency(userInput.speculativeLoss) : '없음'}</strong>
                            </div>
                            <div>
                                <span style={{ color: '#7f1d1d' }}>• 도박 및 사행성 채무액: </span>
                                <strong style={{ color: '#b91c1c' }}>{hasGambling ? formatCurrency(userInput.gamblingLoss) : '없음'}</strong>
                            </div>
                        </div>
                        <p style={{ color: '#7f1d1d', fontSize: '10px', margin: 0, lineHeight: 1.4 }}>
                            <strong>법원별 판단 기조 비교:</strong><br />
                            서울, 부산, 수원회생법원은 투자 손실금을 청산가치에 산입하지 않도록 명시하고 있으나, 그 외 지법(인천, 의정부, 춘천 등)은 손실금 대부분을 재산에 가산하도록 엄격하게 보정 권고를 내립니다. 의뢰인의 관할인 <strong>{result.courtName}</strong>의 판단 기조를 고려한 맞춤 변론 준비가 필수적입니다.
                        </p>
                    </div>

                    {/* 2. 전담 변호사 상담을 위한 서류 준비 및 액션 가이드 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 8px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                            🛡️ 변호사 상담 전 필수 자가 점검 및 준비사항
                        </h4>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#334155' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <Check style={{ width: '12px', height: '12px', color: '#10b981', marginTop: '2.5px', flexShrink: 0 }} />
                                <span><strong>3개월간 주거래 통장 거래 내역 정리:</strong> 사용처 불분명 계좌 출금 내역 소명 자료 확보</span>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <Check style={{ width: '12px', height: '12px', color: '#10b981', marginTop: '2.5px', flexShrink: 0 }} />
                                <span><strong>퇴직연금 가입확인서 또는 예상 퇴직금 확인서:</strong> 금융기관의 연금 형태 확인 증명서 확보</span>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <Check style={{ width: '12px', height: '12px', color: '#10b981', marginTop: '2.5px', flexShrink: 0 }} />
                                <span><strong>부양가족 관련 증빙 서류:</strong> 등본, 가족관계증명서, 부모님 부양 시 소득 없음 확인 서류</span>
                            </div>

                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                <Check style={{ width: '12px', height: '12px', color: '#10b981', marginTop: '2.5px', flexShrink: 0 }} />
                                <span><strong>특별 생계비 지출 증빙:</strong> 추가 주거비(임대차계약서, 월세 계좌 이체증), 정기 치료를 위한 진단서 및 영수증</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. 로이 로펌 회생 핵심 가이드 메시지 */}
                    <div style={{ 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px', 
                        padding: '15px', 
                        backgroundColor: '#f8fafc',
                        fontSize: '11px'
                    }}>
                        <div style={{ fontWeight: 'bold', color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                            <FileText style={{ width: '14px', height: '14px', color: '#312e81' }} />
                            <span>전담 변호사 상담을 위한 AI 정밀 가이드</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {result.aiAdvice && result.aiAdvice.length > 0 ? (
                                result.aiAdvice.map((advice, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                                        <Check style={{ width: '12px', height: '12px', color: '#10b981', marginTop: '2.5px', flexShrink: 0 }} />
                                        <span style={{ color: '#334155' }}>{advice}</span>
                                    </div>
                                ))
                            ) : (
                                <span style={{ color: '#64748b' }}>의뢰인님의 소득 요율 및 자산 내역은 일반적인 회생 범위에 잘 부합하므로 특별 기각 리스크 없이 순조롭게 진행될 확률이 큽니다.</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '10px', fontSize: '9px', color: '#94a3b8' }}>
                    <span>CONFIDENTIAL - ROY LAW CRM SYSTEM</span>
                    <span>페이지 4 / 4</span>
                </div>
            </div>
        </div>
    );
}
