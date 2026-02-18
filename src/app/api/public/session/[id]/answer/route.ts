import { proxyPublicPost } from '@/src/app/api/public/_lib/proxy';
import { NextRequest } from 'next/server';

export const POST = async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return proxyPublicPost(request, `/session/${encodeURIComponent(id)}/answer`);
};
