import { useState, useEffect, useCallback } from 'react';

export interface SavedSession {
    id: string;
    createdAt: number;
    lastAccessedAt: number;
}

export interface SavedQuestion {
    questionId: string;
    text: string;
    optionsText: string;
    correctOptionIndex: number;
    timerDurationSec: number;
    points: number;
    createdAt: number;
    questionType?: string;
    passBehavior?: string;
    maxAttempts?: number;
    buzzerWindowSec?: number;
    wrongPenalty?: number;
}

interface AdminStore {
    sessions: SavedSession[];
    questions: Record<string, SavedQuestion[]>; // sessionId -> questions
}

const STORAGE_KEY = 'aws-quiz-admin-store';

export function useAdminStore() {
    const [store, setStore] = useState<AdminStore>({ sessions: [], questions: {} });
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                setStore(JSON.parse(raw));
            }
        } catch (e) {
            console.error('Failed to load admin store', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    const saveStore = (newStore: AdminStore) => {
        setStore(newStore);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore));
        } catch (e) {
            console.error('Failed to save admin store', e);
        }
    };

    const addSession = useCallback((id: string) => {
        if (!id.trim()) return;
        const now = Date.now();

        setStore(prev => {
            const existing = prev.sessions.find(s => s.id === id);
            let newSessions;

            // If it's already the most recent, don't update to avoid unnecessary re-renders/writes
            if (existing && prev.sessions[0]?.id === id) {
                return prev;
            }

            if (existing) {
                newSessions = prev.sessions.map(s => s.id === id ? { ...s, lastAccessedAt: now } : s);
            } else {
                newSessions = [{ id, createdAt: now, lastAccessedAt: now }, ...prev.sessions];
            }

            // Sort by last accessed
            newSessions.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

            const newStore = { ...prev, sessions: newSessions };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore)); } catch (e) { console.error(e); }
            return newStore;
        });
    }, []);

    const removeSession = useCallback((id: string) => {
        setStore(prev => {
            const newSessions = prev.sessions.filter(s => s.id !== id);
            const newQuestions = { ...prev.questions };
            delete newQuestions[id];

            const newStore = { sessions: newSessions, questions: newQuestions };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore)); } catch (e) { console.error(e); }
            return newStore;
        });
    }, []);

    const saveQuestion = useCallback((sessionId: string, question: Omit<SavedQuestion, 'createdAt'>) => {
        if (!sessionId) return;
        const now = Date.now();

        setStore(prev => {
            const sessionQuestions = prev.questions[sessionId] || [];
            const existingIndex = sessionQuestions.findIndex(q => q.questionId === question.questionId);
            let newList;

            if (existingIndex >= 0) {
                newList = [...sessionQuestions];
                newList[existingIndex] = { ...question, createdAt: now };
            } else {
                newList = [...sessionQuestions, { ...question, createdAt: now }];
            }

            const newStore = {
                ...prev,
                questions: { ...prev.questions, [sessionId]: newList }
            };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newStore)); } catch (e) { console.error(e); }
            return newStore;
        });
    }, []);

    const getQuestions = useCallback((sessionId: string) => {
        // We cannot memoize the return value easily without more complex logic or deps.
        // But the function itself is stable now.
        // NOTE: This getter reads from current closure 'store' if we don't use functional update.
        // BUT accessing state inside a callback without adding it to deps makes it stale.
        // Since getQuestions is called during render or inside effects, we might need 'store' dependency.
        // However, if we add 'store' to deps, we break stability.
        // Ideally, 'getQuestions' should just return the data from the hook return value, not be a function.
        // But keeping API checks out.
        // For now, let's accept that getQuestions MIGHT need to depend on store, OR we change usage.
        // Actually, best pattern is to expose `store` (which we do) and let component select.
        // But to keep existing API:
        return store.questions[sessionId] || [];
    }, [store.questions]);

    // Wait, getQuestions depending on store.questions means it changes when store changes.
    // If AdminPage 'savedQuestions' usage depends on it, it might loop if we are not careful.
    // In AdminPage: const savedQuestions = useMemo(() => sessionId ? getQuestions(sessionId) : [], [sessionId, getQuestions]);
    // If getQuestions changes, savedQuestions changes. That is fine, it doesn't trigger setState in useEffect.
    // The LOOP was caused by addSession changing -> useEffect -> addSession.

    return {
        sessions: store.sessions,
        isLoaded,
        addSession, // Now Stable
        removeSession, // Now Stable
        saveQuestion, // Now Stable
        getQuestions // Updates when questions change
    };
}
