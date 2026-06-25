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
            {/* ================= PAGE 1 (COVER) ================= */}
            <div 
                id="pdf-page-1"
                style={{
                    width: '794px',
                    height: '1120px',
                    padding: '60px 50px',
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
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', letterSpacing: '2px' }}>CONFIDENTIAL</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>법률 자문 사전 검토용 리포트</span>
                </div>

                {/* Main Title Area */}
                <div style={{ marginTop: '100px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <Shield style={{ width: '28px', height: '28px', color: '#312e81' }} />
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#312e81', letterSpacing: '3px' }}>ROY LAW CRM SERVICES</span>
                    </div>
                    
                    <h1 style={{ 
                        fontSize: '36px', 
                        fontWeight: '900', 
                        color: '#1e1b4b', 
                        lineHeight: 1.3,
                        margin: '10px 0 20px 0',
                        letterSpacing: '-1px'
                    }}>
                        종합 채무조정 및<br />
                        개인회생 정밀 진단 보고서
                    </h1>
                    
                    <div style={{ width: '80px', height: '4px', backgroundColor: '#312e81', margin: '20px auto' }}></div>
                    
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '10px' }}>
                        본 보고서는 신청인의 자산, 부양가족, 수입 및 채무 상황을 종합 검토하여<br />
                        최적의 채무조정 개시 방안 및 법원 인가 가능성을 정밀 분석한 결과입니다.
                    </p>
                </div>

                {/* Client Info Block */}
                <div style={{ 
                    backgroundColor: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px', 
                    padding: '24px 30px', 
                    margin: '40px 0',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px'
                }}>
                    <div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>의뢰인 성명</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>
                            <User style={{ width: '16px', height: '16px', display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom', color: '#312e81' }} />
                            {userInput.name || '의뢰인'} 귀하
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>진단 일자</div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>
                            <Calendar style={{ width: '16px', height: '16px', display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom', color: '#312e81' }} />
                            {today}
                        </div>
                    </div>
                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>관할 법원 분석</div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                            <Landmark style={{ width: '16px', height: '16px', display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom', color: '#312e81' }} />
                            {result.courtName} (예상 개시결정 소요 기간: 약 {result.processingMonths}개월)
                        </div>
                    </div>
                </div>

                {/* Official Seal / Verification Mark */}
                <div style={{ display: 'flex', justifycontent: 'center', alignItems: 'center', margin: '30px 0' }}>
                    {/* Legal Seal Emulation */}
                    <div style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        border: '4px double #1e1b4b',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: '#1e1b4b',
                        fontWeight: 'bold',
                        textAlign: 'center',
                        padding: '10px',
                        boxSizing: 'border-box',
                        background: 'radial-gradient(circle, #f8fafc 0%, #ffffff 100%)',
                        boxShadow: '0 4px 10px rgba(30, 27, 75, 0.08)',
                        margin: '0 auto'
                    }}>
                        <Scale style={{ width: '24px', height: '24px', marginBottom: '4px', color: '#312e81' }} />
                        <span style={{ fontSize: '9px', letterSpacing: '1px', lineHeight: 1.2 }}>ROY LAW CRM</span>
                        <span style={{ fontSize: '8px', color: '#64748b', fontWeight: 'normal', marginTop: '2px' }}>TECHNICAL CERTIFIED</span>
                    </div>
                </div>

                {/* Summary Outline Box */}
                <div style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    backgroundColor: '#f1f5f9'
                }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e1b4b', margin: '0 0 12px 0', borderBottom: '2px solid #cbd5e1', paddingBottom: '6px' }}>
                        I. 진단 보고 주요 요지 (Executive Summary)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '15px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid #cbd5e1', paddingRight: '15px' }}>
                            <div style={{ fontSize: '11px', color: '#475569' }}>최종 AI 진단 결과</div>
                            <div style={{ fontSize: '20px', fontWeight: '900', color: result.status === 'POSSIBLE' ? '#10b981' : result.status === 'DIFFICULT' ? '#f59e0b' : '#ef4444', marginTop: '4px' }}>
                                {result.status === 'POSSIBLE' ? '개인회생 인가 유력' : result.status === 'DIFFICULT' ? '검토 및 보강 필요' : '신청 불허 대상'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
                                예상 탕감률: <strong style={{ color: '#312e81', fontSize: '14px' }}>{result.debtReductionRate}%</strong>
                            </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#334155', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>• 총 신용 채무액:</span>
                                <span style={{ fontWeight: 'bold' }}>{formatCurrency(userInput.totalDebt)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>• 예상 변제 예정 총액:</span>
                                <span style={{ fontWeight: 'bold', color: '#10b981' }}>{formatCurrency(result.totalRepayment)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '4px' }}>
                                <span>• 총 채무 절감 혜택:</span>
                                <span style={{ fontWeight: 'bold', color: '#312e81' }}>{formatCurrency(result.totalDebtReduction)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Credits */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '20px', fontSize: '9px', color: '#94a3b8' }}>
                    <span>ROY LAW CRM SYSTEM V2.6</span>
                    <span>본 검토 보고서는 법적 효력이 없으며 정식 변호사 대리 수임 전 참고 자료입니다.</span>
                </div>
            </div>

            {/* ================= PAGE 2 (DETAILS) ================= */}
            <div 
                id="pdf-page-2"
                style={{
                    width: '794px',
                    height: '1120px',
                    padding: '60px 50px',
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
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#312e81' }}>II. 세부 정밀 진단 결과 명세</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>의뢰인: {userInput.name || '의뢰인'}</span>
                </div>

                <div style={{ flex: 1, marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Section 1: 가용소득 평가표 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', borderLeft: '3px solid #312e81', paddingLeft: '8px', margin: '0 0 10px 0' }}>
                            1. 가용소득(월 변제금) 및 생계비 평가
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '8px 10px', color: '#475569' }}>평가 항목</th>
                                    <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right' }}>금액 및 조건</th>
                                    <th style={{ padding: '8px 10px', color: '#475569' }}>상세 산정 기준</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>월 평균 실수령액</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(userInput.monthlyIncome)}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>세후 근로소득 또는 영업 소득 증빙 가능액</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px' }}>법정 최저 생계비</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(result.baseLivingCost)}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>부양가족 {userInput.familySize || 1}인 기준 (보건복지부 기준 150% 범위)</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px' }}>추가 인정 생계비</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#10b981' }}>+{formatCurrency(result.additionalLivingCost)}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>추가 주거비, 의료비, 교육비 등 특별 사유 소명 공제액</td>
                                </tr>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#312e81' }}>월 가용소득 (예상 변제금)</td>
                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#312e81', fontSize: '13px' }}>
                                        {formatCurrency(result.monthlyPayment)} / 월
                                    </td>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#312e81' }}>
                                        총 {result.repaymentMonths}개월 납부 예정
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 2: 청산가치 명세 */}
                    <div>
                        <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e1b4b', borderLeft: '3px solid #312e81', paddingLeft: '8px', margin: '0 0 10px 0' }}>
                            2. 자산 보유 현황 및 법원 청산가치 평가
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                    <th style={{ padding: '8px 10px', color: '#475569' }}>자산 구분</th>
                                    <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right' }}>보유 자산 평가액</th>
                                    <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right' }}>청산가치 반영액</th>
                                    <th style={{ padding: '8px 10px', color: '#475569' }}>특이사항 및 공제</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px' }}>본인 보유 자산</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(userInput.myAssets)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(userInput.myAssets)}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>차량, 예적금, 부동산 가치 반영</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px' }}>배우자 보유 자산</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(userInput.spouseAssets || 0)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#f59e0b' }}>{formatCurrency((userInput.spouseAssets || 0) * 0.5)}</td>
                                    <td style={{ padding: '8px 10px', color: '#64748b' }}>법원 실무준칙에 의거 50% 지분 반영</td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px 10px' }}>주거지 임차보증금</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(userInput.deposit || 0)}</td>
                                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(Math.max(0, (userInput.deposit || 0) - result.exemptDeposit))}</td>
                                    <td style={{ padding: '8px 10px', color: '#10b981' }}>소액임차공제: -{formatCurrency(result.exemptDeposit)}</td>
                                </tr>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
                                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#312e81' }}>최종 청산가치 합계 (A)</td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>-</td>
                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#312e81', fontSize: '12px' }}>
                                        {formatCurrency(result.liquidationValue)}
                                    </td>
                                    <td style={{ padding: '10px', color: '#64748b' }}>
                                        총 변제예정액 합계 (B): <strong style={{ color: '#10b981' }}>{formatCurrency(result.totalRepayment)}</strong>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '6px', paddingLeft: '6px' }}>
                            * 청산가치 보장 원칙 통과 상태: <strong>{result.totalRepayment >= result.liquidationValue ? '적합 (B >= A)' : '보완요망 (B < A)'}</strong>
                        </div>
                    </div>

                    {/* Section 3: 투자 및 도박 관련 법원 성향 및 특이사항 */}
                    <div style={{ 
                        border: '1px solid #f87171', 
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
                            <strong>법원별 판단 특이사항:</strong><br />
                            서울회생법원 및 부산·수원회생법원의 경우 주식/코인 투자 손실금 및 사행성 채무를 원칙적으로 청산가치에 산입하지 않도록 실무준칙을 개정하였으나, 그 외 지방법원은 여전히 손실금 전액을 청산가치에 반영하여 월 변제금이 급격히 늘어날 수 있습니다. 본 보고서는 신청인이 <strong>{result.courtName}</strong>의 판단 기조를 고려하여 안전하게 수임 절차를 진행할 수 있도록 준비 계획을 도출하였습니다.
                        </p>
                    </div>

                    {/* Section 4: 전담 변호사 1:1 상담 조언 가이드 */}
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
                                <span style={{ color: '#64748b' }}>변동 요율이 낮고 일반 수치 범위 내에 있어 정규 보정 권고사항을 적용받습니다.</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '12px', fontSize: '9px', color: '#94a3b8', marginTop: '15px' }}>
                    <span>CONFIDENTIAL - ROY LAW CRM SYSTEM</span>
                    <span>페이지 2 / 2</span>
                </div>
            </div>
        </div>
    );
}
