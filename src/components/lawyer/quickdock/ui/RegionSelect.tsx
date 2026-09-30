import React from 'react';
import { REGION_CONFIG_2026, RegionType } from '../../../../services/repayment/repaymentConstants2026';

const REGION_KEYS = Object.keys(REGION_CONFIG_2026) as RegionType[];

interface RegionSelectProps {
  id?: string;
  value: RegionType;
  onChange: (region: RegionType) => void;
  ariaLabel?: string;
}

/** 거주 지역 구분 (주거비 한도·소액임차보증금 공통, 단일 출처: REGION_CONFIG_2026) */
export default function RegionSelect({ id, value, onChange, ariaLabel }: RegionSelectProps) {
  return (
    <select
      id={id}
      value={value}
      aria-label={ariaLabel}
      onChange={e => onChange(e.target.value as RegionType)}
      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    >
      {REGION_KEYS.map(key => (
        <option key={key} value={key}>
          {REGION_CONFIG_2026[key].label}
        </option>
      ))}
    </select>
  );
}
