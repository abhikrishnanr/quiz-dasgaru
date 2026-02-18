'use client';

import { useState, useRef, useEffect } from 'react';
import { postJson, getJson } from '@/src/lib/api/http';
import { emitToast } from '@/src/lib/ui/toast';

interface QuestionModalProps {
    sessionId: string;
    isOpen: boolean;
    onClose: () => void;
    onQuestionsAdded: () => void;
}

interface ParsedQuestion {
    questionId?: string;
    questionText: string;
    options: Array<{ key: string; text: string }>;
    correctKey: string;
    points?: number;
    timerDurationSec?: number;
    hint?: string;
    difficulty?: string;
    topic?: string;
}

interface ValidationError {
    index: number;
    field: string;
    message: string;
}

interface S3File {
    key: string;
    lastModified: string;
    size: number;
}

export function QuestionModal({ sessionId, isOpen, onClose, onQuestionsAdded }: QuestionModalProps) {
    const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 's3'>('s3');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Single question state
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState<string[]>(['', '', '', '']);
    const [correctIndex, setCorrectIndex] = useState(0);
    const [points, setPoints] = useState(10);
    const [timer, setTimer] = useState(30);

    // Enhanced fields state (Single)
    const [hint, setHint] = useState('');
    const [difficulty, setDifficulty] = useState('moderate');
    const [topic, setTopic] = useState('');

    // Bulk upload state
    const [jsonFile, setJsonFile] = useState<File | null>(null);
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Edit State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<ParsedQuestion | null>(null);

    // S3 state
    const [s3Files, setS3Files] = useState<S3File[]>([]);
    const [isLoadingS3, setIsLoadingS3] = useState(false);

    // AI Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [processingProgress, setProcessingProgress] = useState(0);

    useEffect(() => {
        if (isOpen && activeTab === 's3') {
            fetchS3Files();
        }
    }, [isOpen, activeTab]);

    const fetchS3Files = async () => {
        setIsLoadingS3(true);
        try {
            const res = await getJson<{ files: S3File[] }>('/api/admin/s3/list');
            setS3Files(res.files || []);
        } catch (error) {
            console.error(error);
            emitToast({ level: 'error', title: 'Error', message: 'Failed to load S3 files' });
        } finally {
            setIsLoadingS3(false);
        }
    };

    const simulateProcessing = async (key: string) => {
        setIsProcessing(true);

        const steps = [
            { msg: `Connecting to S3 Bucket (aiquiztext)...`, progress: 10, delay: 600 },
            { msg: `Streaming object: ${key}`, progress: 30, delay: 800 },
            { msg: `Analyzing content structure with Bedrock AI...`, progress: 50, delay: 1200 },
            { msg: `Identifying question patterns and options...`, progress: 75, delay: 1000 },
            { msg: `Validating schema against quiz models...`, progress: 90, delay: 800 },
            { msg: `Extraction complete! Staging for review...`, progress: 100, delay: 500 },
        ];

        for (const step of steps) {
            setProcessingStep(step.msg);
            setProcessingProgress(step.progress);
            await new Promise(r => setTimeout(r, step.delay));
        }

        setIsProcessing(false);
    };

    const handleS3Select = async (key: string) => {
        try {
            await simulateProcessing(key);

            setIsLoadingS3(true);
            const res = await postJson<{ content: any }, { key: string }>('/api/admin/s3/read', { key });

            if (res.content) {
                processJsonContent(res.content);
                setActiveTab('bulk');
                emitToast({ level: 'success', title: 'AI Extraction', message: `Successfully staged questions from ${key}` });
            }
        } catch (error) {
            console.error(error);
            emitToast({ level: 'error', title: 'Error', message: 'Failed to load file content' });
        } finally {
            setIsLoadingS3(false);
        }
    };

    if (!isOpen) return null;

    const resetForm = () => {
        setQuestionText('');
        setOptions(['', '', '', '']);
        setCorrectIndex(0);
        setPoints(10);
        setTimer(30);
        setHint('');
        setDifficulty('moderate');
        setTopic('');

        setJsonFile(null);
        setParsedQuestions([]);
        setValidationErrors([]);
        setEditingIndex(null);
        setEditForm(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setIsProcessing(false);
    };

    const handleClose = () => {
        if (isProcessing) return;
        resetForm();
        onClose();
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleSingleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                questionId: `q-${Date.now()}`,
                questionText,
                options: options.map((opt, idx) => ({
                    key: String.fromCharCode(65 + idx),
                    text: opt
                })),
                correctOptionKey: String.fromCharCode(65 + correctIndex),
                points,
                timerDurationSec: timer,
                questionType: 'MCQ',
                hint,
                difficulty,
                topic
            };

            await postJson<any, any>(`/api/admin/session/${sessionId}/questions/create`, payload);
            emitToast({ level: 'success', title: 'Success', message: 'Question added to Database' });
            resetForm();
            onQuestionsAdded();
            handleClose();
        } catch (error) {
            emitToast({ level: 'error', title: 'Error', message: 'Failed to commit question' });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const validateQuestion = (q: any, index: number): ValidationError[] => {
        const errors: ValidationError[] = [];

        if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
            errors.push({ index, field: 'questionText', message: 'Question text is required' });
        }

        if (!Array.isArray(q.options) || q.options.length < 4) {
            errors.push({ index, field: 'options', message: 'Must have at least 4 options' });
        } else {
            q.options.forEach((opt: any, optIdx: number) => {
                const optText = typeof opt === 'string' ? opt : opt?.text;
                if (!optText || optText.trim() === '') {
                    errors.push({ index, field: `options[${optIdx}]`, message: `Option ${String.fromCharCode(65 + optIdx)} is empty` });
                }
            });
        }

        if (!q.correctKey || typeof q.correctKey !== 'string') {
            errors.push({ index, field: 'correctKey', message: 'Correct answer key is required' });
        }

        return errors;
    };

    const processJsonContent = (json: any) => {
        try {
            const questions = json.questions || [];

            // Validate all questions
            const allErrors: ValidationError[] = [];
            questions.forEach((q: any, idx: number) => {
                const errors = validateQuestion(q, idx);
                allErrors.push(...errors);
            });

            setValidationErrors(allErrors);

            // Parse questions
            const parsed: ParsedQuestion[] = questions.map((q: any, idx: number) => {
                const normalizedOptions = Array.isArray(q.options)
                    ? q.options.map((opt: any, optIdx: number) => ({
                        key: typeof opt === 'object' && opt.key ? opt.key : String.fromCharCode(65 + optIdx),
                        text: typeof opt === 'string' ? opt : opt?.text || ''
                    }))
                    : [];

                return {
                    questionId: q.questionId || `q-bulk-${Date.now()}-${idx}`,
                    questionText: q.questionText || '',
                    options: normalizedOptions,
                    correctKey: q.correctKey || 'A',
                    points: q.points || 10,
                    timerDurationSec: q.timerDurationSec || 30,
                    hint: q.hint || '',
                    difficulty: q.difficulty || 'moderate',
                    topic: q.topic || ''
                };
            });

            setParsedQuestions(parsed);
        } catch (error) {
            emitToast({ level: 'error', title: 'Invalid JSON', message: 'Failed to parse content' });
            setValidationErrors([{ index: -1, field: 'file', message: 'Invalid JSON format' }]);
            setParsedQuestions([]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setJsonFile(file);
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                processJsonContent(json);
            } catch (error) {
                emitToast({ level: 'error', title: 'Invalid JSON', message: 'Failed to parse JSON file' });
                setValidationErrors([{ index: -1, field: 'file', message: 'Invalid JSON format' }]);
                setParsedQuestions([]);
            }
        };

        reader.readAsText(file);
    };

    const startEditing = (index: number) => {
        setEditingIndex(index);
        setEditForm(JSON.parse(JSON.stringify(parsedQuestions[index])));
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditForm(null);
    };

    const saveEditing = () => {
        if (!editForm || editingIndex === null) return;
        if (!editForm.questionText.trim()) {
            emitToast({ level: 'error', title: 'Validation', message: 'Question text cannot be empty' });
            return;
        }

        const updatedQuestions = [...parsedQuestions];
        updatedQuestions[editingIndex] = editForm;

        setParsedQuestions(updatedQuestions);
        setEditingIndex(null);
        setEditForm(null);
        emitToast({ level: 'success', title: 'Updated', message: 'Question updated in staging.' });
    };

    const updateEditField = (field: keyof ParsedQuestion, value: any) => {
        if (!editForm) return;
        setEditForm({ ...editForm, [field]: value });
    };

    const updateEditOption = (idx: number, text: string) => {
        if (!editForm) return;
        const newOpts = [...editForm.options];
        newOpts[idx] = { ...newOpts[idx], text };
        setEditForm({ ...editForm, options: newOpts });
    };


    const handleBulkSubmit = async () => {
        if (validationErrors.length > 0) {
            emitToast({ level: 'error', title: 'Validation Failed', message: 'Please fix validation errors before committing' });
            return;
        }

        if (parsedQuestions.length === 0) {
            emitToast({ level: 'error', title: 'No Questions', message: 'No valid questions to commit' });
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = {
                questions: parsedQuestions.map(q => ({
                    questionId: q.questionId,
                    questionText: q.questionText,
                    options: q.options,
                    correctKey: q.correctKey,
                    points: q.points,
                    timerDurationSec: q.timerDurationSec,
                    questionType: 'MCQ',
                    hint: q.hint,
                    difficulty: q.difficulty,
                    topic: q.topic
                }))
            };

            await postJson<any, any>(`/api/admin/session/${sessionId}/questions/bulk`, payload);
            emitToast({
                level: 'success',
                title: 'Sync Complete',
                message: `${parsedQuestions.length} question(s) committed to DynamoDB`
            });
            resetForm();
            onQuestionsAdded();
            handleClose();
        } catch (error) {
            emitToast({ level: 'error', title: 'Sync Error', message: 'Failed to commit questions' });
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={handleClose} />
                {isProcessing && (
                    <div className="absolute inset-0 z-[60] bg-white/95 flex flex-col items-center justify-center p-8 rounded-xl animate-fadeIn backdrop-blur-sm">
                        <div className="w-16 h-16 mb-6 relative">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">AI Processing Pipeline</h3>
                        <p className="text-sm font-mono text-indigo-600 mb-6">{processingStep}</p>
                        <div className="w-full max-w-sm bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                            <div
                                className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out relative"
                                style={{ width: `${processingProgress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                            </div>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">{processingProgress}% Complete</span>
                    </div>
                )}
                <div className={`relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col ${isProcessing ? 'invisible' : ''}`}>
                    <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <h2 className="text-xl font-bold text-slate-800">Add Questions</h2>
                        <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex gap-2 px-6 pt-4 border-b border-slate-200 bg-white">
                        {['s3', 'bulk', 'single'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors capitalize ${activeTab === tab
                                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                            >
                                {tab === 'bulk' ? 'Staging & Review' : tab === 's3' ? 'Import from S3 (AI)' : 'Single Question'}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                        {activeTab === 'single' && (
                            <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-2xl mx-auto">
                                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                                        <textarea required value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border resize-none" placeholder="Enter your question here..." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                                            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border" placeholder="e.g. AI & ML" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                                            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm sm:text-sm p-2 border">
                                                <option value="easy">Easy</option>
                                                <option value="moderate">Moderate</option>
                                                <option value="hard">Hard</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Hint / Explanation</label>
                                        <textarea value={hint} onChange={(e) => setHint(e.target.value)} rows={2} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" placeholder="Optional hint..." />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ans Options</label>
                                        <div className="space-y-2">
                                            {options.map((option, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input type="radio" name="correctOption" checked={correctIndex === idx} onChange={() => setCorrectIndex(idx)} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" />
                                                    <span className="text-sm font-mono text-gray-500 w-6 font-bold">{String.fromCharCode(65 + idx)}</span>
                                                    <input type="text" required value={option} onChange={(e) => handleOptionChange(idx, e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder={`Option ${String.fromCharCode(65 + idx)}`} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Points</label><input type="number" value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" /></div>
                                        <div><label className="block text-sm font-medium text-gray-700 mb-1">Timer (sec)</label><input type="number" value={timer} onChange={(e) => setTimer(Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm p-2 border" /></div>
                                    </div>
                                </div>
                                <div className="pt-2 flex gap-3">
                                    <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">{isSubmitting ? 'Committing...' : 'Commit to DynamoDB'}</button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'bulk' && (
                            <div className="space-y-6 h-full flex flex-col">
                                {parsedQuestions.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 p-10">
                                        <div className="text-center">
                                            <h3 className="mt-2 text-sm font-medium text-slate-900">No questions staged</h3>
                                            <p className="mt-1 text-xs text-slate-500">Upload JSON or Import from S3 to populate staging.</p>
                                            <div className="mt-6"><label htmlFor="file-upload" className="cursor-pointer bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50"><span>Upload Local JSON</span><input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".json" onChange={handleFileChange} ref={fileInputRef} /></label></div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full">{parsedQuestions.length} Staged</span>
                                                <span className="text-sm text-slate-500">Review questions before committing.</span>
                                            </div>
                                            <button onClick={() => { setParsedQuestions([]); setValidationErrors([]); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-red-600 hover:text-red-800 font-medium">Clear All</button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow-sm border border-slate-200">
                                            <table className="min-w-full divide-y divide-slate-200">
                                                <thead className="bg-slate-50 sticky top-0 z-10">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-16">#</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Question</th>
                                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-32">Metadata</th>
                                                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                    {parsedQuestions.map((q, idx) => (
                                                        <tr key={idx} className={editingIndex === idx ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
                                                            <td className="px-4 py-3 text-xs text-slate-500 align-top pt-4">{idx + 1}</td>
                                                            <td className="px-4 py-3 align-top">
                                                                {editingIndex === idx && editForm ? (
                                                                    <div className="space-y-3 p-3 bg-white rounded border border-indigo-200 shadow-sm animate-fadeIn">
                                                                        <textarea value={editForm.questionText} onChange={(e) => updateEditField('questionText', e.target.value)} className="block w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-2 border" rows={2} />
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <input type="text" value={editForm.topic || ''} onChange={(e) => updateEditField('topic', e.target.value)} placeholder="Topic" className="text-xs border-gray-200 rounded px-2 py-1" />
                                                                            <select value={editForm.difficulty || 'moderate'} onChange={(e) => updateEditField('difficulty', e.target.value)} className="text-xs border-gray-200 rounded px-2 py-1">
                                                                                <option value="easy">Easy</option><option value="moderate">Moderate</option><option value="hard">Hard</option>
                                                                            </select>
                                                                        </div>
                                                                        <textarea value={editForm.hint || ''} onChange={(e) => updateEditField('hint', e.target.value)} placeholder="Hint/Explanation" className="block w-full text-xs border-gray-200 rounded px-2 py-1 border" rows={1} />
                                                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                                                            {editForm.options.map((opt, optIdx) => (
                                                                                <div key={optIdx} className="flex items-center gap-1">
                                                                                    <span className={`text-[10px] font-bold w-4 ${String.fromCharCode(65 + optIdx) === editForm.correctKey ? 'text-green-600' : 'text-slate-400'}`}>{String.fromCharCode(65 + optIdx)}</span>
                                                                                    <input type="text" value={opt.text} onChange={(e) => updateEditOption(optIdx, e.target.value)} className={`block w-full text-xs border-gray-200 rounded px-2 py-1 ${String.fromCharCode(65 + optIdx) === editForm.correctKey ? 'bg-green-50 border-green-200' : ''}`} />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-xs pt-1 border-t border-indigo-50 mt-1">
                                                                            <label className="flex items-center gap-1"><span className="text-slate-500">Correct:</span><select value={editForm.correctKey} onChange={(e) => updateEditField('correctKey', e.target.value)} className="border-gray-200 rounded text-xs py-0.5 px-1 bg-slate-50">{['A', 'B', 'C', 'D'].map(k => <option key={k} value={k}>{k}</option>)}</select></label>
                                                                            <button onClick={saveEditing} className="text-green-600 font-bold hover:underline ml-auto">Save</button>
                                                                            <button onClick={cancelEditing} className="text-slate-400 hover:text-slate-600">Cancel</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1">
                                                                        <p className="text-sm font-medium text-slate-800 line-clamp-2">{q.questionText}</p>
                                                                        <div className="flex gap-2 text-xs text-slate-400">
                                                                            {q.topic && <span className="bg-slate-100 px-1.5 rounded text-slate-600">{q.topic}</span>}
                                                                            <span>{q.options.length} Options</span>
                                                                            <span>•</span>
                                                                            <span>{q.difficulty}</span>
                                                                        </div>
                                                                        {q.hint && <p className="text-xs text-slate-400 italic truncate max-w-md">💡 {q.hint}</p>}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs w-32 align-top pt-4">
                                                                <div className="flex flex-col gap-1 text-slate-500">
                                                                    <span>Ans: <span className="font-bold text-slate-700">{q.correctKey}</span></span>
                                                                    <span>Pts: {q.points}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-xs w-24 align-top pt-4">{editingIndex !== idx && <button onClick={() => startEditing(idx)} className="text-indigo-600 hover:text-indigo-900 font-medium">Edit</button>}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="pt-2"><button onClick={handleBulkSubmit} disabled={isSubmitting || validationErrors.length > 0} className="w-full bg-slate-900 text-white py-3 px-4 rounded-lg font-bold hover:bg-black disabled:opacity-50 transition-all shadow-lg flex justify-center items-center gap-2">{isSubmitting ? <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Syncing...</span> : `Commit ${parsedQuestions.length} Questions to DynamoDB`}</button></div>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 's3' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-4"><h3 className="font-medium text-slate-800">Select file from: <span className="font-mono text-sm bg-slate-100 px-1 rounded text-pink-600">aiquiztext</span></h3><button onClick={fetchS3Files} disabled={isLoadingS3} className="text-xs text-indigo-600 font-bold hover:underline">Refresh List</button></div>
                                {isLoadingS3 && s3Files.length === 0 && <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}
                                {!isLoadingS3 && s3Files.length === 0 && <div className="text-center p-8 text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-300">No files found.</div>}
                                <div className="grid gap-2">
                                    {s3Files.map((file) => (
                                        <div key={file.key} className="flex items-center justify-between p-3 bg-white hover:bg-indigo-50 rounded-lg border border-slate-200 transition-colors shadow-sm">
                                            <div className="flex flex-col"><span className="font-mono text-sm font-bold text-slate-700">{file.key}</span><span className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • {new Date(file.lastModified).toLocaleDateString()}</span></div>
                                            <button onClick={() => handleS3Select(file.key)} disabled={isLoadingS3 || isProcessing} className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded font-bold hover:bg-indigo-600 transition-all shadow-sm">{isLoadingS3 ? 'Loading...' : 'Import'}</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
