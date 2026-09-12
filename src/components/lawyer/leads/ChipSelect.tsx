import React from 'react';

interface ChipSelectProps {
  label?: string;
  value: any;
  onChange: (val: any) => void;
  options: string[];
  isMulti?: boolean;
  className?: string;
}

export const ChipSelect: React.FC<ChipSelectProps> = ({
  label,
  value,
  onChange,
  options,
  isMulti = false,
  className = '',
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-bold text-slate-700">
          {label}
        </label>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {options.map((opt: string) => {
          const isSelected = isMulti ? value?.includes(opt) : value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                if (isMulti) {
                  const arr = Array.isArray(value) ? [...value] : [];
                  if (arr.includes(opt)) {
                    onChange(arr.filter(x => x !== opt));
                  } else {
                    onChange([...arr, opt]);
                  }
                } else {
                  onChange(opt);
                }
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer select-none press-scale active:scale-[0.98] ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChipSelect;
