'use client';

import { useEffect, useState } from "react";
import { AdminSessionDetails, AnswerRecord } from "../types";
import { getJson } from "@/src/lib/api/http";

interface AnswersViewProps {
    sessionId: string;
    questions: AdminSessionDetails['questions'];
}



export function AnswersView({ sessionId, questions }: AnswersViewProps) {
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
        const interval = setInterval(fetchAnswers, 5000);
        return () => clearInterval(interval);
    }, [sessionId]);

    if (loading && answers.length === 0) return <div className="p-4 text-center">Loading answers...</div>;

    const sorted = [...answers].sort((a, b) => b.submittedAt - a.submittedAt);

    return (
        <div className="mt-4 flex flex-col">
            <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Team</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Question</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Choice</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Mode</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Time</th>
                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Result</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {sorted.map((ans) => (
                                    <tr key={`${ans.questionId}-${ans.teamId}`}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                            {ans.teamId}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {questions.find(q => q.questionId === ans.questionId)?.orderIndex ?? ans.questionId}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                                                {ans.selectedKey}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {ans.action === 'BUZZ' ? (
                                                <span className="inline-flex items-center rounded bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-800">BUZZER</span>
                                            ) : ans.action === 'BUZZ_ANSWER' ? (
                                                <span className="inline-flex items-center rounded bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-800">BUZZER</span>
                                            ) : ans.action === 'PASS' ? (
                                                <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-800">PASSED</span>
                                            ) : (
                                                <span className="inline-flex items-center rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">STANDARD</span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {new Date(ans.submittedAt).toLocaleTimeString()}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {ans.isCorrect === true && <span className="text-green-600 font-bold">✓ (+{ans.pointsAwarded})</span>}
                                            {ans.isCorrect === false && <span className="text-red-600 font-bold">✗</span>}
                                            {ans.isCorrect === undefined && <span className="text-gray-400">-</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
