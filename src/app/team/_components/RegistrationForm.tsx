'use client';

import { FormEvent, useState } from 'react';

interface RegistrationFormProps {
    onSubmit: (data: { teamName: string; college?: string; members?: string }) => void;
    isLoading: boolean;
    error?: string | null;
}

export function RegistrationForm({ onSubmit, isLoading, error }: RegistrationFormProps) {
    const [teamName, setTeamName] = useState('');
    const [college, setCollege] = useState('');
    const [members, setMembers] = useState('');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!teamName.trim()) return;
        onSubmit({ teamName: teamName.trim(), college: college.trim(), members: members.trim() });
    };

    return (
        <form className="card space-y-4" onSubmit={handleSubmit}>
            <h3 className="text-lg font-semibold">Step 1 — Register your team</h3>

            <div className="space-y-3">
                <div>
                    <label htmlFor="teamName" className="block text-sm font-medium text-slate-700">Team Name *</label>
                    <input
                        id="teamName"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. Cloud Ninjas"
                        required
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="college" className="block text-sm font-medium text-slate-700">College / Organization</label>
                    <input
                        id="college"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="Optional"
                        disabled={isLoading}
                    />
                </div>

                <div>
                    <label htmlFor="members" className="block text-sm font-medium text-slate-700">Team Members</label>
                    <input
                        id="members"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 mt-1 focus:ring-2 focus:ring-slate-500 focus:border-slate-500 transition-colors"
                        value={members}
                        onChange={(e) => setMembers(e.target.value)}
                        placeholder="Names separated by commas"
                        disabled={isLoading}
                    />
                </div>
            </div>

            <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-4 py-3 font-medium text-white disabled:bg-slate-500 hover:bg-slate-800 transition-colors"
                disabled={isLoading || !teamName.trim()}
            >
                {isLoading ? 'Registering...' : 'Start Quiz'}
            </button>

            {error && (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 animate-in fade-in slide-in-from-top-1">
                    Registration failed: {error}
                </p>
            )}
        </form>
    );
}
