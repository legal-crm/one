import React from 'react';

function fmtMoney(v: number): string {
  if (!v && v !== 0) return '-';
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return `${v.toLocaleString()}원`;
}

interface ClientOriginalInfoProps {
  fp: any;
  clientName?: string;
  phone?: string;
  consultType?: string;
  createdAt?: string;
  /** 2-col compact mode for narrow containers like cards */
  compact?: boolean;
}

/** 고객이 입력한 원본 정보 — 6개 섹션 그리드 (컴팩트) */
export default function ClientOriginalInfo({ fp, clientName, phone, consultType, createdAt, compact }: ClientOriginalInfoProps) {
  if (!fp) return null;
  const cols = compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border border-slate-200/80 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200/80">
        <h5 className="text-[11px] font-extrabold text-slate-600">{title}</h5>
      </div>
      {children}
    </div>
  );

  const Cell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
    <div className="px-2.5 py-1.5 text-left">
      <p className="text-[10px] font-bold text-slate-400 leading-tight">{label}</p>
      <p className={`text-xs font-extrabold tracking-tight tabular-nums leading-snug ${highlight ? 'text-slate-900 text-sm' : 'text-slate-900'}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {/* 1. 기본 정보 */}
      <Section title="👤 기본 정보">
        <div className={`grid ${cols} divide-x divide-slate-100`}>
          <Cell label="의뢰인명" value={fp.clientName || clientName || '-'} />
          <Cell label="연락처" value={fp.clientPhone || phone || '-'} />
          <Cell label="나이" value={fp.age ? `${fp.age}세` : '-'} />
          {!compact && <Cell label="성별" value={fp.gender === 'male' ? '남성' : fp.gender === 'female' ? '여성' : '-'} />}
        </div>
        <div className={`grid ${cols} divide-x divide-slate-100 border-t border-slate-100`}>
          <Cell label="혼인" value={fp.maritalStatus === 'MARRIED' || fp.maritalStatus === 'married' ? '기혼' : fp.maritalStatus === 'DIVORCED' || fp.maritalStatus === 'divorced' ? '이혼' : fp.maritalStatus === 'SINGLE' || fp.maritalStatus === 'single' ? '미혼' : '-'} />
          <Cell label="자녀" value={fp.minorChildren != null ? `${fp.minorChildren}명` : `${fp.dependents || 0}명`} />
          <Cell label="거주지" value={fp.residence || fp.residenceRegion || fp.address || '-'} />
          {!compact && <Cell label="거주 형태" value={fp.housingType === 'rent' ? '월세' : fp.housingType === 'jeonse' ? '전세' : fp.housingType === 'owned' ? '자가' : fp.housingType === 'free' ? '무상거주' : fp.housingType || '-'} />}
        </div>
      </Section>

      {/* 2+3. 소득/직업 + 채무 — 2열 병합 */}
      <div className={compact ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5'}>
        <Section title="💼 소득/직업">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="월 소득" value={fmtMoney(fp.income || fp.monthlyIncome || 0)} />
              <Cell label="직업" value={fp.jobType === 'SALARIED' ? '급여소득' : fp.jobType === 'BUSINESS' ? '자영업' : fp.jobType === 'DAILY' ? '일용직' : fp.jobType === 'FREELANCER' ? '프리랜서' : fp.employmentType || fp.incomeType || '-'} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="근무지" value={fp.workLocation || '-'} />
              <Cell label="배우자 소득" value={fp.spouseIncome ? fmtMoney(fp.spouseIncome) : '-'} />
            </div>
          </div>
        </Section>

        <Section title="🔴 채무 요약">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="총 채무" value={fmtMoney(fp.debtTotal || 0)} highlight />
              <Cell label="채권자" value={fp.creditorCount ? `${fp.creditorCount}곳` : `${(fp.debts || []).length}곳`} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="채무 원인" value={fp.debtCause === 'LIVING' ? '생활비' : fp.debtCause === 'BUSINESS' ? '사업' : fp.debtCause === 'INVESTMENT' ? '투자' : fp.debtCause === 'GUARANTEE' ? '보증' : fp.debtCause === 'GAMBLING' ? '도박' : fp.debtCause || '-'} />
              <Cell label="독촉/법적조치" value={fp.harassmentLevel === 'CALL' ? '독촉전화' : fp.harassmentLevel === 'LETTER' ? '내용증명' : fp.harassmentLevel === 'LAWSUIT' ? '소송' : fp.harassmentLevel === 'SEIZURE' ? '압류' : fp.harassmentLevel || '-'} />
            </div>
          </div>
        </Section>
      </div>

      {/* 4. 자산 현황 */}
      <Section title="🏦 자산 현황">
        <div className={`grid ${cols} divide-x divide-slate-100`}>
          <Cell label="총 자산" value={fmtMoney(fp.assetsTotal || 0)} />
          <Cell label="본인 재산" value={fp.myAssets ? `${fp.myAssets}만` : '-'} />
          <Cell label="임대보증금" value={fp.rentalDeposit ? `${fp.rentalDeposit}만` : '-'} />
          {!compact && <Cell label="배우자 자산" value={fp.spouseAsset ? `${fp.spouseAsset}만` : '-'} />}
        </div>
        <div className={`grid ${cols} divide-x divide-slate-100 border-t border-slate-100`}>
          <Cell label="퇴직금" value={fp.retirementPay ? `${fp.retirementPay}만` : '-'} />
          <Cell label="퇴직연금" value={fp.retirementPensionType === 'pension' ? '가입' : fp.retirementPensionType === 'none' ? '미가입' : fp.retirementPensionType === 'unknown' ? '모름' : '-'} />
          <Cell label="주택 명의" value={fp.housingContractHolder === 'self' ? '본인' : fp.housingContractHolder === 'spouse' ? '배우자' : fp.housingContractHolder || '-'} />
          {!compact && <Cell label="보증금 대출" value={fp.depositLoan ? `${fp.depositLoan}만` : '-'} />}
        </div>
      </Section>

      {/* 5+6. 생활비 + 특이사항 — 2열 병합 */}
      <div className={compact ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5'}>
        <Section title="🏠 월 생활비">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="월세" value={fp.rentCost ? `${fp.rentCost}만` : fp.monthlyRent ? fmtMoney(fp.monthlyRent) : '-'} />
              <Cell label="의료비" value={fp.medicalCost ? `${fp.medicalCost}만` : '-'} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="교육비" value={fp.educationCost ? `${fp.educationCost}만` : '-'} />
              <Cell label="합계" value={fp.monthlyExpense ? fmtMoney(fp.monthlyExpense) : fp.livingCost ? fmtMoney(fp.livingCost) : '-'} />
            </div>
          </div>
        </Section>

        <Section title="⚠️ 특이사항">
          <div className="divide-y divide-slate-100">
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="24개월 특례" value={fp.specialCondition === 'basic_recipient' ? '기초수급자' : fp.specialCondition === 'severe_disability' ? '중증장애' : fp.specialCondition === 'elderly' ? '고령자' : '해당없음'} />
              <Cell label="거주 형태" value={fp.housingType === 'rent' ? '월세' : fp.housingType === 'jeonse' ? '전세' : fp.housingType === 'owned' ? '자가' : fp.housingType === 'free' ? '무상거주' : '-'} />
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-100">
              <Cell label="상담 유형" value={consultType || '-'} />
              <Cell label="요청일" value={createdAt?.split('T')[0] || '-'} />
            </div>
          </div>
        </Section>
      </div>

    </div>
  );
}
