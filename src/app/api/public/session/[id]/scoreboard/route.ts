import { NextRequest, NextResponse } from 'next/server';

import { getScoreboardVisibility } from '@/src/lib/server/display-controls';

export const GET = async (_request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return NextResponse.json({ showScoreboard: getScoreboardVisibility(id) });
};
