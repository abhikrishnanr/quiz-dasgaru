'use strict';

import { useEffect, useState } from "react";
import { getJson } from "@/src/lib/api/http";

interface LiveAnswersPreviewProps {
    sessionId: string;
}

interface AnswerRecord {
    teamId: string;
    questionId: string;
    selectedKey: string;
    submittedAt: number;
    isCorrect?: boolean;
    pointsAwarded?: number;
    action?: 'BUZZ' | 'PASS' | 'BUZZ_ANSWER' | 'ANSWER';
}

export function LiveAnswersPreview({ sessionId }: LiveAnswersPreviewProps) {
    const [answers, setAnswers] = useState<AnswerRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAnswers = async () => {
        try {
            const res = await getJson<{ answers: AnswerRecord[] }>(`/api/admin/session/${sessionId}/answers`);
            setAnswers(res.answers || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnswers();
        const interval = setInterval(fetchAnswers, 3000);
        return () => clearInterval(interval);
    }, [sessionId]);

    const recent = [...answers].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 5);

    if (loading && answers.length === 0) return <div className="text-xs text-slate-400 italic">Loading answers...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Live Feed</h3>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{answers.length} Total</span>
            </div>

            <ul className="divide-y divide-slate-100">
                {recent.map((ans, idx) => (
                    <li key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-slate-800">{ans.teamId}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Q{ans.questionId.split('-').pop()?.slice(-4)}...</span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                            {ans.action === 'BUZZ' ? (
                                <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded border border-pink-100">BUZZER</span>
                            ) : ans.action === 'BUZZ_ANSWER' ? (
                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">BUZZER</span>
                            ) : ans.action === 'PASS' ? (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">PASS</span>
                            ) : (
                                <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{ans.selectedKey}</span>
                            )}

                            <div className="flex items-center gap-1">
                                {ans.isCorrect === true && <span className="text-[10px] text-green-600 font-bold">+{ans.pointsAwarded}</span>}
                                {ans.isCorrect === false && <span className="text-[10px] text-red-500 font-bold">✗</span>}
                                <span className="text-[10px] text-slate-300">
                                    {new Date(ans.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }).split(' ')[0]}
                                </span>
                            </div>
                        </div>
                    </li>
                ))}
                {recent.length === 0 && (
                    <li className="p-6 text-center text-slate-400 text-xs italic">
                        No answers yet.
                    </li>
                )}
            </ul>
        </div>
    );
}
