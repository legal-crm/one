import React from 'react';

function fmt(v: number): string {
  if (!v && v !== 0) return '-';
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (v >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return `${v.toLocaleString()}`;
}

interface ClientOriginalInfoProps {
  fp: any;
  clientName?: string;
  phone?: string;
  consultType?: string;
  createdAt?: string;
  compact?: boolean;
}

/** 인라인 키-값 플랫 테이블 — 1개 컨테이너, divide-y 행 구분 */
export default function ClientOriginalInfo({ fp, clientName, phone, consultType, createdAt }: ClientOriginalInfoProps) {
  if (!fp) return null;

  const V = ({ l, v, unit }: { l: string; v: string | number | undefined | null; unit?: string }) => {
    const val = v == null || v === '' || v === '-' ? '-' : `${v}${unit || ''}`;
    return <span className="inline-flex items-baseline gap-0.5"><span className="text-slate-400">{l}</span> <span className="font-extrabold text-slate-900">{val}</span></span>;
  };

  const Sep = () => <span className="text-slate-300 mx-0.5">·</span>;

  const name = fp.clientName || clientName || '-';
  const phoneVal = fp.clientPhone || phone || '-';
  const age = fp.age ? `${fp.age}세` : '-';
  const gender = fp.gender === 'male' ? '남' : fp.gender === 'female' ? '여' : '';
  const marital = fp.maritalStatus === 'MARRIED' || fp.maritalStatus === 'married' ? '기혼' : fp.maritalStatus === 'DIVORCED' || fp.maritalStatus === 'divorced' ? '이혼' : fp.maritalStatus === 'SINGLE' || fp.maritalStatus === 'single' ? '미혼' : '-';
  const children = fp.minorChildren != null ? fp.minorChildren : (fp.dependents || 0);
  const region = fp.residence || fp.residenceRegion || fp.address || '-';
  const housing = fp.housingType === 'rent' ? '월세' : fp.housingType === 'jeonse' ? '전세' : fp.housingType === 'owned' ? '자가' : fp.housingType === 'free' ? '무상' : fp.housingType || '-';
  const income = fmt(fp.income || fp.monthlyIncome || 0);
  const job = fp.jobType === 'SALARIED' ? '급여소득' : fp.jobType === 'BUSINESS' ? '자영업' : fp.jobType === 'DAILY' ? '일용직' : fp.jobType === 'FREELANCER' ? '프리랜서' : fp.employmentType || fp.incomeType || '-';
  const work = fp.workLocation || '';
  const spouseIncome = fp.spouseIncome ? fmt(fp.spouseIncome) : '';
  const debt = fmt(fp.debtTotal || 0);
  const creditors = fp.creditorCount || (fp.debts || []).length || 0;
  const cause = fp.debtCause === 'LIVING' ? '생활비' : fp.debtCause === 'BUSINESS' ? '사업' : fp.debtCause === 'INVESTMENT' ? '투자' : fp.debtCause === 'GUARANTEE' ? '보증' : fp.debtCause === 'GAMBLING' ? '도박' : fp.debtCause || '-';
  const harass = fp.harassmentLevel === 'CALL' ? '독촉전화' : fp.harassmentLevel === 'LETTER' ? '내용증명' : fp.harassmentLevel === 'LAWSUIT' ? '소송' : fp.harassmentLevel === 'SEIZURE' ? '압류' : fp.harassmentLevel || '-';
  const assets = fmt(fp.assetsTotal || 0);
  const myAsset = fp.myAssets ? `${fp.myAssets}만` : '';
  const deposit = fp.rentalDeposit ? `${fp.rentalDeposit}만` : '';
  const retire = fp.retirementPay ? `${fp.retirementPay}만` : '';
  const retirePension = fp.retirementPensionType === 'pension' ? '연금0%' : fp.retirementPensionType === 'none' ? '미가입50%' : fp.retirementPensionType === 'unknown' ? '확인필요' : '';
  const housingHolder = fp.housingContractHolder === 'self' ? '본인' : fp.housingContractHolder === 'spouse' ? '배우자' : '';
  const rent = fp.rentCost ? `${fp.rentCost}만` : '';
  const medical = fp.medicalCost ? `${fp.medicalCost}만` : '';
  const edu = fp.educationCost ? `${fp.educationCost}만` : '';
  const special = fp.specialCondition === 'basic_recipient' ? '기초수급' : fp.specialCondition === 'severe_disability' ? '중증장애' : fp.specialCondition === 'elderly' ? '고령자' : '';

  return (
    <div className="border border-slate-200/80 rounded-xl overflow-hidden text-[11px] leading-relaxed">
      {/* 기본 정보 */}
      <div className="px-3 py-2 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-slate-500 font-bold mr-0.5">👤</span>
        <span className="font-extrabold text-slate-900">{name}</span>
        <Sep /><span className="text-slate-700">{phoneVal}</span>
        <Sep /><span className="text-slate-700">{age}{gender && ` ${gender}`}</span>
        <Sep /><span className="text-slate-700">{marital}</span>
        <Sep /><V l="자녀" v={children} unit="명" />
        <Sep /><span className="text-slate-700">{region}</span>
        <Sep /><span className="text-slate-700">{housing}</span>
      </div>

      {/* 소득/직업 */}
      <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-slate-500 font-bold mr-0.5">💼</span>
        <V l="소득" v={income} />
        <Sep /><span className="text-slate-700">{job}</span>
        {work && <><Sep /><span className="text-slate-700">{work}</span></>}
        {spouseIncome && <><Sep /><V l="배우자" v={spouseIncome} /></>}
      </div>

      {/* 채무 */}
      <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-slate-500 font-bold mr-0.5">🔴</span>
        <V l="채무" v={debt} />
        <Sep /><V l="채권자" v={creditors} unit="곳" />
        <Sep /><span className="text-slate-700">{cause}</span>
        <Sep /><span className="text-slate-700">{harass}</span>
      </div>

      {/* 자산 */}
      <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-slate-500 font-bold mr-0.5">🏦</span>
        <V l="자산" v={assets} />
        {myAsset && <><Sep /><V l="본인" v={myAsset} /></>}
        {deposit && <><Sep /><V l="보증금" v={deposit} /></>}
        {retire && <><Sep /><V l="퇴직금" v={`${retire}${retirePension ? `(${retirePension})` : ''}`} /></>}
        {fp.depositLoan ? <><Sep /><V l="보증금대출" v={`${fp.depositLoan}만`} /></> : null}
        {housingHolder && <><Sep /><V l="주택" v={housingHolder} /></>}
      </div>

      {/* 생활비 + 특이사항 */}
      <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap items-center gap-x-1 gap-y-0.5">
        <span className="text-slate-500 font-bold mr-0.5">🏠</span>
        {rent && <><V l="월세" v={rent} /><Sep /></>}
        {medical && <><V l="의료" v={medical} /><Sep /></>}
        {edu && <><V l="교육" v={edu} /><Sep /></>}
        {special && <><span className="text-amber-600 font-bold">⚡ {special}</span><Sep /></>}
        <span className="text-slate-400">{consultType || '-'}</span>
        <Sep /><span className="text-slate-400">{createdAt?.split('T')[0] || '-'}</span>
      </div>
    </div>
  );
}
