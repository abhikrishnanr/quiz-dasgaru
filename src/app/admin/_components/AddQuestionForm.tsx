'use client';

import { useState, useEffect } from "react";
import { postJson, putJson } from "@/src/lib/api/http";
import { emitToast } from "@/src/lib/ui/toast";

interface QuestionData {
    questionId?: string;
    questionText: string;
    options: Array<{ key: string; text: string }>;
    correctKey?: string;
    points: number;
    timerDurationSec?: number;
    state?: string;
}

interface AddQuestionFormProps {
    sessionId: string;
    initialData?: QuestionData | null;
    onQuestionAdded: () => void;
    onCancel?: () => void;
}

export function AddQuestionForm({ sessionId, initialData, onQuestionAdded, onCancel }: AddQuestionFormProps) {
    const isEditMode = !!initialData;
    const [questionText, setQuestionText] = useState("");
    const [options, setOptions] = useState<string[]>(["", "", "", ""]);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [points, setPoints] = useState(10);
    const [timer, setTimer] = useState(30);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setQuestionText(initialData.questionText);

            // Map existing options or default to 4 empty ones
            if (initialData.options && initialData.options.length > 0) {
                const newOptions = initialData.options.map(o => o.text);
                while (newOptions.length < 4) newOptions.push("");
                setOptions(newOptions.slice(0, 4));

                // Find correct index
                const correctKey = initialData.correctKey || 'A';
                const idx = correctKey.charCodeAt(0) - 65;
                setCorrectIndex(idx >= 0 && idx < 4 ? idx : 0);
            } else {
                setOptions(["", "", "", ""]);
                setCorrectIndex(0);
            }

            setPoints(initialData.points || 10);
            setTimer(initialData.timerDurationSec || 30);
        } else {
            // Reset for add mode
            setQuestionText("");
            setOptions(["", "", "", ""]);
            setCorrectIndex(0);
            setPoints(10);
            setTimer(30);
        }
    }, [initialData]);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                questionId: isEditMode ? initialData?.questionId : `q-${Date.now()}`,
                questionText: questionText,
                options: options.map((opt, idx) => ({
                    key: String.fromCharCode(65 + idx),
                    text: opt
                })),
                correctOptionKey: String.fromCharCode(65 + correctIndex),
                points: points,
                timerDurationSec: timer,
                questionType: "MCQ"
            };

            if (isEditMode && initialData?.questionId) {
                await putJson(`/api/admin/session/${sessionId}/question/${initialData.questionId}`, payload);
                emitToast({ level: 'success', title: 'Updated', message: 'Question updated successfully' });
            } else {
                await postJson(`/api/admin/session/${sessionId}/questions/create`, payload);
                emitToast({ level: 'success', title: 'Success', message: 'Question added successfully' });
            }

            // Reset form only if not editing (or close modal logic handled by parent)
            if (!isEditMode) {
                setQuestionText("");
                setOptions(["", "", "", ""]);
                setCorrectIndex(0);
            }

            onQuestionAdded();
        } catch (error) {
            emitToast({ level: 'error', title: 'Error', message: `Failed to ${isEditMode ? 'update' : 'add'} question` });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">{isEditMode ? 'Edit Question' : 'Add New Question'}</h3>
                {isEditMode && onCancel && (
                    <button onClick={onCancel} className="text-xs text-gray-500 hover:text-gray-700 underline">Cancel</button>
                )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Question Text</label>
                    <textarea
                        required
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        rows={2}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
                    <div className="space-y-2">
                        {options.map((option, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="correctOption"
                                    checked={correctIndex === idx}
                                    onChange={() => setCorrectIndex(idx)}
                                    className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                                />
                                <span className="text-sm font-mono text-gray-500 w-6">
                                    {String.fromCharCode(65 + idx)}
                                </span>
                                <input
                                    type="text"
                                    required
                                    value={option}
                                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Points</label>
                        <input
                            type="number"
                            value={points}
                            onChange={(e) => setPoints(Number(e.target.value))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Timer (sec)</label>
                        <input
                            type="number"
                            value={timer}
                            onChange={(e) => setTimer(Number(e.target.value))}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                    </div>
                </div>

                <div className="pt-2 flex gap-3">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Question' : 'Add Question')}
                    </button>
                    {isEditMode && onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
