import { NextRequest, NextResponse } from 'next/server';

type ScoreboardCommand = {
  isOpen: boolean;
  stopAudio: boolean;
  updatedAt: number;
  nonce: number;
};

const scoreboardCommandStore = new Map<string, ScoreboardCommand>();

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  const command = scoreboardCommandStore.get(sessionId);
  if (!command) {
    return NextResponse.json({ isOpen: false, stopAudio: false, updatedAt: 0, nonce: 0 });
  }

  return NextResponse.json(command);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, isOpen, stopAudio } = body ?? {};

    if (!sessionId || typeof isOpen !== 'boolean') {
      return NextResponse.json({ error: 'Missing sessionId or isOpen' }, { status: 400 });
    }

    const previous = scoreboardCommandStore.get(sessionId);
    const nextCommand: ScoreboardCommand = {
      isOpen,
      stopAudio: Boolean(stopAudio),
      updatedAt: Date.now(),
      nonce: (previous?.nonce ?? 0) + 1,
    };

    scoreboardCommandStore.set(sessionId, nextCommand);
    return NextResponse.json({ ok: true, ...nextCommand });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
