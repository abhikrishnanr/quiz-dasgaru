import { proxyPublicGet } from '@/src/app/api/public/_lib/proxy';
import { NextRequest } from 'next/server';

export const GET = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return proxyPublicGet(request, `/session/${encodeURIComponent(id)}/leaderboard`);
};
