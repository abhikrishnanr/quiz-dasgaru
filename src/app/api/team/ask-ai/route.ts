import { NextRequest, NextResponse } from 'next/server';
import { verifyTeamToken } from '@/src/lib/auth/jwt';
import { requestAdmin } from '@/src/app/api/admin/_lib/proxy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const payload = verifyTeamToken(authHeader.split(' ')[1]);
  if (!payload) {
    return NextResponse.json({ message: 'Invalid Token' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { text?: string };
    const text = body.text?.trim();
    if (!text) {
      return NextResponse.json({ message: 'Question text is required' }, { status: 400 });
    }

    const now = Date.now();
    const askAiQuestion = { teamId: payload.teamId, text, createdAt: now };

    const { status, payload: adminPayload } = await requestAdmin(
      `/session/${encodeURIComponent(payload.sessionId)}/meta`,
      'POST',
      JSON.stringify({
        askAiQuestion,
        askAiAnswer: null,
        askAiMark: null,
        askAiAnnouncement: null,
      }),
    );

    if (status < 200 || status >= 300) {
      return NextResponse.json(adminPayload, { status });
    }

    return NextResponse.json({ ok: true, askAiQuestion });
  } catch (error) {
    console.error('[TEAM ASK_AI] Submit failed:', error);
    return NextResponse.json({ message: 'Failed to submit Ask AI question' }, { status: 500 });
  }
}
