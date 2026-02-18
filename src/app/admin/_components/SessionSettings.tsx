'use client';

import { useState } from "react";
import { AdminSessionDetails } from "../types";
import { emitToast } from "@/src/lib/ui/toast";
import { postJson, putJson } from "@/src/lib/api/http";

interface SessionSettingsProps {
    session: AdminSessionDetails['session'];
    onUpdate: () => void;
    onReset: () => void;
    onPurge: () => void;
}

export function SessionSettings({ session, onUpdate, onReset, onPurge }: SessionSettingsProps) {
    const [formData, setFormData] = useState({
        eventName: session.eventName || '',
        eventDate: session.eventDate || '',
        eventVenue: session.eventVenue || '',
        statusLabel: session.statusLabel || '',
        description: session.description || '',
        passcode: session.passcode || '',
        maxTeams: session.maxTeams || 50,
        theme: session.theme || 'blue',
        organizer: session.organizer || '',
        gameMode: session.gameMode || 'STANDARD'
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await postJson(`/api/admin/session/${encodeURIComponent(session.sessionId)}/meta`, formData);
            emitToast({ level: 'success', title: 'Saved', message: 'Session settings updated.' });
            onUpdate();
        } catch (error) {
            emitToast({ level: 'error', title: 'Error', message: 'Failed to update settings.' });
        } finally {
            setSaving(false);
        }
    };

    // Team Generation Handled in SessionDetailView now

    return (
        <div className="space-y-8 divide-y divide-gray-200">
            <div className="space-y-6 pt-4">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Event Details</h3>
                    <p className="mt-1 text-sm text-gray-500">Public information about the quiz session.</p>
                </div>
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Event Name</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                value={formData.eventName}
                                onChange={e => setFormData({ ...formData, eventName: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-3">
                        <label className="block text-sm font-medium text-gray-700">Organizer</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                value={formData.organizer}
                                onChange={e => setFormData({ ...formData, organizer: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                placeholder="Host Name"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-6">
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <div className="mt-1">
                            <textarea
                                rows={3}
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                placeholder="Event details..."
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Status Label</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                value={formData.statusLabel}
                                onChange={e => setFormData({ ...formData, statusLabel: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Date</label>
                        <div className="mt-1">
                            <input
                                type="date"
                                value={formData.eventDate}
                                onChange={e => setFormData({ ...formData, eventDate: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Venue</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                value={formData.eventVenue}
                                onChange={e => setFormData({ ...formData, eventVenue: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Passcode</label>
                        <div className="mt-1">
                            <input
                                type="text"
                                value={formData.passcode}
                                onChange={e => setFormData({ ...formData, passcode: e.target.value })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                                placeholder="Optional"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Max Teams</label>
                        <div className="mt-1">
                            <input
                                type="number"
                                value={formData.maxTeams}
                                onChange={e => setFormData({ ...formData, maxTeams: Number(e.target.value) })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            />
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Theme</label>
                        <div className="mt-1">
                            <select
                                value={formData.theme}
                                onChange={e => setFormData({ ...formData, theme: e.target.value as any })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            >
                                <option value="blue">Deep Blue</option>
                                <option value="red">Fiery Red</option>
                                <option value="dark">Professional Dark</option>
                                <option value="light">Clean Light</option>
                            </select>
                        </div>
                    </div>

                    <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Game Mode</label>
                        <div className="mt-1">
                            <select
                                value={formData.gameMode}
                                onChange={e => setFormData({ ...formData, gameMode: e.target.value as any })}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                            >
                                <option value="STANDARD">Standard (All Play)</option>
                                <option value="BUZZER">Buzzer (First to Answer)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Details'}
                    </button>
                </div>
            </div>


            <div className="pt-8">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-red-900">Danger Zone</h3>
                    <p className="mt-1 text-sm text-gray-500">Destructive actions available for this session.</p>
                </div>
                <div className="mt-6 flex gap-4">
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to RESET this session? Current question state will be cleared to PREVIEW.')) {
                                onReset();
                            }
                        }}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-100 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                        Reset State
                    </button>
                    <button
                        onClick={() => {
                            const code = Math.floor(1000 + Math.random() * 9000);
                            const input = prompt(`DANGER! This will DELETE ALL DATA for this session.\nTo confirm, type: ${code}`);
                            if (input === String(code)) {
                                onPurge();
                            }
                        }}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                        PURGE EVERYTHING
                    </button>
                </div>
            </div>
        </div>
    );
}
