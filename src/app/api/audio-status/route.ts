/**
 * In-memory audio status bridge.
 * Display page POSTs status updates, Admin page GETs them.
 * Keyed by sessionId so multiple sessions don't conflict.
 */

import { NextRequest, NextResponse } from 'next/server';

interface AudioStatus {
    status: 'IDLE' | 'FETCHING' | 'SPEAKING' | 'DONE' | 'ERROR';
    message?: string;
    updatedAt: number;
}

const statusStore = new Map<string, AudioStatus>();

// GET — Admin reads audio status for a session
export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
        return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const entry = statusStore.get(sessionId);
    if (!entry) {
        return NextResponse.json({ status: 'IDLE', message: 'No audio activity yet.', updatedAt: 0 });
    }

    // Auto-expire after 30s of no updates (stale)
    if (Date.now() - entry.updatedAt > 30_000) {
        statusStore.delete(sessionId);
        return NextResponse.json({ status: 'IDLE', message: 'No audio activity.', updatedAt: 0 });
    }

    return NextResponse.json(entry);
}

// POST — Display page reports audio status
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionId, status, message } = body;

        if (!sessionId || !status) {
            return NextResponse.json({ error: 'Missing sessionId or status' }, { status: 400 });
        }

        statusStore.set(sessionId, {
            status,
            message: message || '',
            updatedAt: Date.now(),
        });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
}
