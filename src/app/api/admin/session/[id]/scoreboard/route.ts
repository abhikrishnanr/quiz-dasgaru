import { NextRequest, NextResponse } from 'next/server';

import { getScoreboardVisibility, setScoreboardVisibility } from '@/src/lib/server/display-controls';

export const GET = async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return NextResponse.json({ showScoreboard: getScoreboardVisibility(id) });
};

export const POST = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { showScoreboard?: boolean };

  if (typeof body.showScoreboard !== 'boolean') {
    return NextResponse.json({ message: 'showScoreboard (boolean) is required.' }, { status: 400 });
  }

  return NextResponse.json({ showScoreboard: setScoreboardVisibility(id, body.showScoreboard) });
};
