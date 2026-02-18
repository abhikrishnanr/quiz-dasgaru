'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

function extractSessionIdFromToken(rawToken: string): string {
  if (!rawToken) return '';

  if (rawToken.includes('__')) {
    return rawToken.split('__')[0] ?? '';
  }

  const lastUnderscoreIndex = rawToken.lastIndexOf('_');
  if (lastUnderscoreIndex <= 0) return '';

  return rawToken.slice(0, lastUnderscoreIndex);
}

export default function LegacyDisplayTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = typeof params?.token === 'string' ? params.token : '';

  useEffect(() => {
    const sessionId = extractSessionIdFromToken(token);
    if (!sessionId) return;

    router.replace(`/display?sessionId=${encodeURIComponent(sessionId)}`);
  }, [router, token]);

  return (
    <section className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
      <div>
        <p className="text-sm uppercase tracking-[0.28em] text-cyan-300/80">Display</p>
        <h1 className="mt-3 text-2xl font-black">Redirecting to the new display view…</h1>
      </div>
    </section>
  );
}
