'use client';

import { AdminSessionDetails } from "../types";
import { useState } from 'react';
import { postJson, getJson } from "@/src/lib/api/http";
import { emitToast } from "@/src/lib/ui/toast";

interface SessionInfoCardProps {
    session: AdminSessionDetails['session'];
    stats: AdminSessionDetails['counts'];
}

export function SessionInfoCard({ session, stats }: SessionInfoCardProps) {
    const [generatingLink, setGeneratingLink] = useState(false);

    const handleCopyDisplayLink = async () => {
        let token = session.displayToken;
        if (!token) {
            setGeneratingLink(true);
            try {
                // Fetch stateless token from new API
                const res = await getJson<{ token: string }>(`/api/admin/session/${session.sessionId}/token`);
                token = res.token;
            } catch (error) {
                console.error("Failed to generate token", error);
                emitToast({ level: 'error', title: 'Error', message: 'Failed to generate link' });
                setGeneratingLink(false);
                return;
            }
            setGeneratingLink(false);
        }

        const url = `${window.location.origin}/display/${session.sessionId}__${token}`;
        navigator.clipboard.writeText(url);
        emitToast({ level: 'success', title: 'Copied', message: 'Leaderboard link copied!' });
    };

    return (
        <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                        {session.eventName || 'Unnamed Session'}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Session ID: <span className="font-mono font-bold text-gray-700">{session.sessionId}</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${session.questionState === 'LIVE' ? 'bg-green-100 text-green-800' :
                        session.questionState === 'LOCKED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                        {session.questionState}
                    </span>

                    <button
                        onClick={handleCopyDisplayLink}
                        disabled={generatingLink}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors flex items-center gap-1 border border-indigo-100 shadow-sm"
                        title="Open public scoreboard"
                    >
                        {generatingLink ? 'Wait...' : '📺 DISPLAY BOARD'}
                    </button>
                </div>
            </div>
            <div className="px-6 py-5">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Organizer</dt>
                        <dd className="mt-1 text-sm text-gray-900">{session.organizer || '-'}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Date & Venue</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                            {session.eventDate || 'No date'} <br />
                            <span className="text-gray-500">{session.eventVenue}</span>
                        </dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Passcode</dt>
                        <dd className="mt-1 text-sm font-mono text-gray-900">{session.passcode || 'None'}</dd>
                    </div>
                    <div className="sm:col-span-1">
                        <dt className="text-sm font-medium text-gray-500">Participation</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                            {stats.teamCount} / {session.maxTeams || '∞'} Teams
                        </dd>
                    </div>
                    {session.description && (
                        <div className="sm:col-span-4">
                            <dt className="text-sm font-medium text-gray-500">Description</dt>
                            <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded border border-gray-100">
                                {session.description}
                            </dd>
                        </div>
                    )}
                </dl>
            </div>
        </div >
    );
}
