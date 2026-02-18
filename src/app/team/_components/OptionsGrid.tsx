'use client';

import { QuestionOption } from '../types';

interface OptionsGridProps {
    options: QuestionOption[];
    selectedKey: string;
    onSelect: (key: string) => void;
    disabled: boolean;
    hasBuzz: boolean;
    isBuzzerMode: boolean;
}

export function OptionsGrid({ options, selectedKey, onSelect, disabled, hasBuzz, isBuzzerMode }: OptionsGridProps) {
    if (!options || options.length === 0) {
        return (
            <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                Waiting for options...
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {options.map((option) => {
                const isSelected = selectedKey === option.key;
                // In buzzer mode, you can only select if you have the buzz.
                // In normal mode, hasBuzz is always true.
                const canSelect = !disabled && hasBuzz;

                return (
                    <button
                        key={option.key}
                        type="button"
                        onClick={() => canSelect && onSelect(option.key)}
                        disabled={!canSelect}
                        className={`
              relative flex items-center p-4 rounded-xl border-2 text-left transition-all duration-200
              ${isSelected
                                ? 'border-indigo-600 bg-indigo-50 shadow-md transform scale-[1.02]'
                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            }
              ${!canSelect ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
            `}
                    >
                        <div className={`
              flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold mr-3 transition-colors
              ${isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-slate-100 text-slate-500'}
            `}>
                            {option.key}
                        </div>
                        <span className={`font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {option.text}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
