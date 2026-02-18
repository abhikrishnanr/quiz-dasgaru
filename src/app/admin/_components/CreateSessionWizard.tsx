'use client';

import { useState } from "react";
import { emitToast } from "@/src/lib/ui/toast";
import { postJson } from "@/src/lib/api/http";

interface CreateSessionWizardProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateSessionWizard({ onClose, onSuccess }: CreateSessionWizardProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        sessionId: '',
        eventName: '',
        eventDate: new Date().toISOString().split('T')[0],
        description: '',
        passcode: '',
        maxTeams: 50,
        theme: 'blue',
        organizer: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Create the session (Base)
            // We force uppercase for Session ID
            const sid = formData.sessionId.toUpperCase().trim();
            if (!sid) throw new Error("Session ID is required");

            await postJson('/api/admin/session/create', {
                sessionId: sid,
                timerDurationSec: 30
            });

            // 2. Update Metadata (Extended)
            await postJson(`/api/admin/session/${encodeURIComponent(sid)}/meta`, {
                eventName: formData.eventName || sid,
                eventDate: formData.eventDate,
                description: formData.description,
                passcode: formData.passcode,
                maxTeams: Number(formData.maxTeams),
                theme: formData.theme,
                organizer: formData.organizer,
                // Default status
                statusLabel: 'REGISTRATION_OPEN'
            });

            emitToast({ level: 'success', title: 'Success', message: `Session ${sid} created successfully!` });
            onSuccess();
        } catch (error: any) {
            console.error(error);
            emitToast({ level: 'error', title: 'Error', message: error.message || 'Failed to create session.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold">Create New Session</h2>
                    <button onClick={onClose} className="text-white/80 hover:text-white">&times;</button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <form id="create-session-form" onSubmit={handleCreate} className="space-y-4">

                        {/* Essential Info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Session ID (Unique Code)</label>
                                <input
                                    required
                                    type="text"
                                    name="sessionId"
                                    value={formData.sessionId}
                                    onChange={(e) => setFormData({ ...formData, sessionId: e.target.value.toUpperCase() })}
                                    placeholder="AWS-NOV26"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-lg font-mono uppercase bg-gray-50 p-2 border"
                                />
                                <p className="text-xs text-gray-500 mt-1">Teams will use this code to join.</p>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">Event Name</label>
                                <input
                                    required
                                    type="text"
                                    name="eventName"
                                    value={formData.eventName}
                                    onChange={handleChange}
                                    placeholder="Annual Cloud Quiz 2026"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input
                                    type="date"
                                    name="eventDate"
                                    value={formData.eventDate}
                                    onChange={handleChange}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Organizer</label>
                                <input
                                    type="text"
                                    name="organizer"
                                    value={formData.organizer}
                                    onChange={handleChange}
                                    placeholder="Host Name"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                />
                            </div>
                        </div>

                        {/* Details */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                placeholder="Details about this event..."
                            />
                        </div>

                        {/* Advanced / Security */}
                        <div className="border-t pt-4">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">Security & Limits</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Passcode (Optional)</label>
                                    <input
                                        type="number"
                                        name="passcode"
                                        value={formData.passcode}
                                        onChange={handleChange}
                                        placeholder="1234"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Max Teams</label>
                                    <input
                                        type="number"
                                        name="maxTeams"
                                        value={formData.maxTeams}
                                        onChange={handleChange}
                                        min={1}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Theme</label>
                                    <select
                                        name="theme"
                                        value={formData.theme}
                                        onChange={handleChange}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    >
                                        <option value="blue">Deep Blue (Default)</option>
                                        <option value="red">Fiery Red</option>
                                        <option value="dark">Professional Dark</option>
                                        <option value="light">Clean Light</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="create-session-form"
                        disabled={loading}
                        className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating...' : 'Create Session'}
                    </button>
                </div>
            </div>
        </div>
    );
}
