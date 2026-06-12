import React from 'react';
import { INTEREST_CATEGORIES } from '@/lib/interests';

const MAX_SELECTIONS = 10;

interface InterestPickerProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
}

export const InterestPicker = ({ value, onChange, label }: InterestPickerProps): JSX.Element => {
  const toggle = (interest: string) => {
    if (value.includes(interest)) {
      onChange(value.filter(v => v !== interest));
    } else if (value.length < MAX_SELECTIONS) {
      onChange([...value, interest]);
    }
  };

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">{label}</p>
          <span className="text-xs text-gray-400">{value.length}/{MAX_SELECTIONS} selected</span>
        </div>
      )}
      {!label && (
        <div className="flex justify-end">
          <span className="text-xs text-gray-400">{value.length}/{MAX_SELECTIONS} selected</span>
        </div>
      )}
      {Object.entries(INTEREST_CATEGORIES).map(([category, interests]) => (
        <div key={category}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{category}</p>
          <div className="flex flex-wrap gap-2">
            {interests.map(interest => {
              const selected = value.includes(interest);
              const disabled = !selected && value.length >= MAX_SELECTIONS;
              return (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggle(interest)}
                  disabled={disabled}
                  className={[
                    'px-3 py-1 rounded-full text-sm border transition-colors',
                    selected
                      ? 'bg-[#008060] text-white border-[#008060]'
                      : disabled
                        ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-[#008060] hover:text-[#008060]',
                  ].join(' ')}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
