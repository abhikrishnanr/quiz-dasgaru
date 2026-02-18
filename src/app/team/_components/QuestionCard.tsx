'use client';

import { Question } from '../types';
import { useState } from 'react';

interface QuestionCardProps {
    question: Question | null;
    state: string;
}

export function QuestionCard({ question, state }: QuestionCardProps) {
    const [showHint, setShowHint] = useState(false);

    if (!question || state !== 'LIVE') {
        return (
            <div className="card flex min-h-[12rem] flex-col items-center justify-center space-y-3 text-center bg-slate-50 border-dashed">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-200 animate-pulse">
                    <span className="text-3xl">⏳</span>
                </div>
                <div>
                    <h3 className="text-lg font-medium text-slate-700">Waiting for Question</h3>
                    <p className="text-sm text-slate-500">The quiz master will start the next question soon.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-xl text-white">
            <div className="mb-4 flex items-center justify-between gap-2 flex-wrap text-sm font-medium tracking-wide text-slate-400">
                <div className="flex items-center gap-2">
                    {question.difficulty && (
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold border ${question.difficulty === 'easy' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
                            question.difficulty === 'hard' ? 'text-rose-400 border-rose-400/30 bg-rose-400/10' :
                                'text-amber-400 border-amber-400/30 bg-amber-400/10'
                            }`}>
                            {question.difficulty}
                        </span>
                    )}
                </div>
                {question.topic && (
                    <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        {question.topic}
                    </span>
                )}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold leading-relaxed mb-4">
                {question.text}
            </h2>
            {question.hint && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                    <button
                        onClick={() => setShowHint(!showHint)}
                        className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
                    >
                        <span>💡</span>
                        <span>{showHint ? 'Hide Hint' : 'Show Hint'}</span>
                    </button>
                    {showHint && (
                        <p className="mt-2 text-sm text-slate-300 italic bg-slate-800/50 p-3 rounded-lg">
                            {question.hint}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
