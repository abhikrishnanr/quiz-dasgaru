import { AdminSessionSummary } from "../types";

interface SessionCardProps {
    session: AdminSessionSummary;
    onSelect: (sessionId: string) => void;
}

export function SessionCard({ session, onSelect }: SessionCardProps) {
    const isLive = session.questionState === 'LIVE';
    const isReady = session.statusLabel === 'REGISTRATION_OPEN';

    // Status Logic
    let statusColor = 'bg-gray-100 text-gray-600';
    let statusDot = 'bg-gray-400';

    if (isLive) {
        statusColor = 'bg-green-50 text-green-700 ring-1 ring-green-600/20';
        statusDot = 'bg-green-500 animate-pulse';
    } else if (isReady) {
        statusColor = 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20';
        statusDot = 'bg-blue-500';
    }

    return (
        <div
            onClick={() => onSelect(session.sessionId)}
            className="group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-gray-200 hover:border-indigo-300 cursor-pointer"
        >
            {/* Top Decoration */}
            <div className={`h-2 w-full ${isLive ? 'bg-gradient-to-r from-green-400 to-emerald-600' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`} />

            <div className="flex flex-1 flex-col p-6">

                {/* Header & Status */}
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Session ID</p>
                        <h3 className="text-2xl font-black tracking-tight text-gray-900 font-mono mt-0.5 group-hover:text-indigo-600 transition-colors">
                            {session.sessionId}
                        </h3>
                    </div>
                    <span className={`inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                        <svg className={`h-1.5 w-1.5 ${statusDot} rounded-full`} viewBox="0 0 6 6" aria-hidden="true">
                            <circle cx={3} cy={3} r={3} />
                        </svg>
                        {session.statusLabel || session.questionState}
                    </span>
                </div>

                {/* Event Name & Desc */}
                <div className="mt-4 flex-1">
                    <h4 className="text-base font-semibold text-gray-900 line-clamp-1">
                        {session.eventName || "Untitled Event"}
                    </h4>
                    {session.description && (
                        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                            {session.description}
                        </p>
                    )}
                    {!session.description && (
                        <p className="mt-1 text-sm text-gray-400 italic">
                            No description provided.
                        </p>
                    )}

                    {session.organizer && (
                        <div className="mt-3 flex items-center text-xs text-gray-500 font-medium">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">
                                Host: {session.organizer}
                            </span>
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase">Teams</span>
                        <span className="text-xl font-bold text-gray-900">{session.teamCount || 0}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-500 uppercase">Questions</span>
                        <span className="text-xl font-bold text-gray-900">{session.questionCount || 0}</span>
                    </div>
                </div>

                {/* Date Footer */}
                <div className="mt-4 flex items-center text-xs text-gray-400">
                    <svg className="mr-1.5 h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0h18M5.25 12h13.5h-13.5zm0 0h.008v.008h-.008V12zm0 3h13.5h-13.5zm0 0h.008v.008h-.008V15z" />
                    </svg>
                    {session.eventDate ? new Date(session.eventDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'Date not set'}
                </div>
            </div>

            {/* Hover Action hint */}
            <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
                </svg>
            </div>
        </div>
    );
}
