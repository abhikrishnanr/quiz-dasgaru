'use client';

import { publicApi } from '@/src/lib/api/public';
import { emitToast } from '@/src/lib/ui/toast';
import { FormEvent, useEffect, useState } from 'react';
import { normalizeSessionId } from '@/src/lib/session-id';

type HealthPayload = {
  id?: string;
  state?: string;
  activeQuestionIndex?: number;
  [key: string]: unknown;
};

export default function HealthPage() {
  const [sessionId, setSessionId] = useState('demo');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [response, setResponse] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalizeSessionId(params.get('sessionId'));
    if (fromQuery) {
      setSessionId(fromQuery);
    }
  }, []);

  const checkHealth = async (event?: FormEvent) => {
    event?.preventDefault();
    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      setError('Session ID is required to run health check.');
      return;
    }

    if (normalizedSessionId !== sessionId) {
      setSessionId(normalizedSessionId);
    }

    setChecking(true);
    setError(null);

    const startedAt = performance.now();
    try {
      const payload = await publicApi.getSession<HealthPayload>(normalizedSessionId);
      const elapsed = Math.round(performance.now() - startedAt);
      setLatencyMs(elapsed);
      setResponse(payload);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Health check failed.';
      setError(message);
      setResponse(null);
      setLatencyMs(null);
      emitToast({
        level: 'error',
        title: 'Health endpoint unreachable',
        message: `${message} Confirm API base URL and session ID.`,
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <header className="card space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">Health</h2>
        <p className="text-slate-600">Checks public session endpoint availability and latency.</p>
      </header>

      <form className="card space-y-4" onSubmit={checkHealth}>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-700">Session ID</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="demo"
          />
        </label>

        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-500"
          disabled={checking}
        >
          {checking ? 'Checking...' : 'Run health check'}
        </button>

        {latencyMs !== null && (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Public session endpoint responded in <span className="font-semibold">{latencyMs} ms</span>.
          </p>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>

      <section className="card space-y-3">
        <h3 className="text-lg font-semibold">Response</h3>
        <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {JSON.stringify(response, null, 2) || 'No response yet.'}
        </pre>
      </section>
    </section>
  );
}
