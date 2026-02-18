'use client';

import { useEffect, useState } from "react";
import { AdminSessionSummary } from "../types";
import { getJson, postJson } from "@/src/lib/api/http";
import { SessionCard } from "./SessionCard";
import { CreateSessionWizard } from "./CreateSessionWizard";
import { emitToast } from "@/src/lib/ui/toast";

interface DashboardProps {
    onSelectSession: (id: string) => void;
}

export function Dashboard({ onSelectSession }: DashboardProps) {
    const [sessions, setSessions] = useState<AdminSessionSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const [showWizard, setShowWizard] = useState(false);

    const fetchSessions = async () => {
        try {
            // 1. Get List
            const res = await getJson<{ sessions: AdminSessionSummary[] }>('/api/admin/sessions');
            const initialSessions = res.sessions || [];

            // 2. Fetch full details for each session to get 'description' if missing
            // (The summary endpoint might be lightweight and not include description)
            const enrichedSessions = await Promise.all(initialSessions.map(async (s) => {
                try {
                    const details = await getJson<any>(`/api/admin/session/${encodeURIComponent(s.sessionId)}/details`);
                    return { ...s, ...details.session }; // Merge details into summary
                } catch (e) {
                    return s; // Fallback to summary if details fail
                }
            }));

            setSessions(enrichedSessions);
        } catch (error) {
            console.error(error);
            emitToast({ level: 'error', title: 'Error', message: 'Failed to load sessions.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleCreateSuccess = () => {
        setShowWizard(false);
        fetchSessions();
    };

    if (loading) return <div className="p-8 text-center">Loading sessions...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="md:flex md:items-center md:justify-between mb-8">
                <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
                        Admin Dashboard
                    </h2>
                </div>
                <div className="mt-4 flex md:ml-4 md:mt-0">
                    <button
                        onClick={() => setShowWizard(true)}
                        type="button"
                        className="ml-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    >
                        Create New Session
                    </button>
                </div>
            </div>

            {showWizard && (
                <CreateSessionWizard
                    onClose={() => setShowWizard(false)}
                    onSuccess={handleCreateSuccess}
                />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map(s => (
                    <SessionCard key={s.sessionId} session={s} onSelect={onSelectSession} />
                ))}

                {sessions.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <p className="text-gray-500">No sessions found. Create one to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
