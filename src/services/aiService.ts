'use client';

import { GoogleGenAI } from '@google/genai';

const API_KEYS = [
  process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  process.env.NEXT_PUBLIC_GEMINI_API_KEY_2,
].filter((k): k is string => !!k?.trim());

const TEXT_MODEL = 'gemini-2.5-flash';
const CACHE_PREFIX = 'ai-host-tts:v2:';
const TTS_LOG_PREFIX = '[ElevenLabs TTS]';
const GEMINI_LOG_PREFIX = '[Gemini API]';
const CLIENT_TTS_FAILURE_BACKOFF_BASE_MS = 4000;
const CLIENT_TTS_FAILURE_BACKOFF_MAX_MS = 30000;

let clientTTSFailureCount = 0;
let clientTTSBlockedUntil = 0;

function getClientTTSBackoffMs(failureCount: number): number {
  const exponent = Math.max(0, failureCount - 1);
  return Math.min(CLIENT_TTS_FAILURE_BACKOFF_BASE_MS * Math.pow(2, exponent), CLIENT_TTS_FAILURE_BACKOFF_MAX_MS);
}

function noteClientTTSFailure(retryAfterMs?: number): number {
  clientTTSFailureCount += 1;
  const backoffMs = Math.max(retryAfterMs || 0, getClientTTSBackoffMs(clientTTSFailureCount));
  clientTTSBlockedUntil = Date.now() + backoffMs;
  return backoffMs;
}

function resetClientTTSFailureState(): void {
  clientTTSFailureCount = 0;
  clientTTSBlockedUntil = 0;
}


export type TTSAudioPayload = {
  data: string;
  mimeType?: string;
};

const inMemoryTTSCache = new Map<string, TTSAudioPayload>();

// --- Multi-key failover (Gemini text generation only) ---
let activeKeyIndex = 0;
const aiClients: GoogleGenAI[] = API_KEYS.map((key) => new GoogleGenAI({ apiKey: key }));

function getActiveClient(): GoogleGenAI | null {
  return aiClients[activeKeyIndex] ?? null;
}

function rotateToNextKey(): boolean {
  const nextIndex = activeKeyIndex + 1;
  if (nextIndex < aiClients.length) {
    activeKeyIndex = nextIndex;
    console.warn(
      `${GEMINI_LOG_PREFIX} Rotated to API key #${nextIndex + 1} of ${aiClients.length}.`,
    );
    return true;
  }
  console.error(`${GEMINI_LOG_PREFIX} All ${aiClients.length} API keys exhausted.`);
  return false;
}

function logGeminiInfo(message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.info(`${GEMINI_LOG_PREFIX} ${message}`);
    return;
  }

  console.info(`${GEMINI_LOG_PREFIX} ${message}`, payload);
}

function logGeminiError(message: string, payload?: unknown): void {
  if (payload === undefined) {
    console.error(`${GEMINI_LOG_PREFIX} ${message}`);
    return;
  }

  console.error(`${GEMINI_LOG_PREFIX} ${message}`, payload);
}

function readFromLocalStorageCache(text: string): TTSAudioPayload | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const cached = window.localStorage.getItem(`${CACHE_PREFIX}${text}`);
    if (!cached) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(cached) as TTSAudioPayload;
      if (parsed?.data && typeof parsed.data === 'string') {
        return {
          data: parsed.data,
          mimeType: parsed.mimeType,
        };
      }
    } catch {
      // backwards compatibility: older cache entries stored only base64 string
    }

    return { data: cached };
  } catch {
    return undefined;
  }
}

function writeToLocalStorageCache(text: string, payload: TTSAudioPayload): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${text}`, JSON.stringify(payload));
  } catch {
    // no-op if storage is unavailable or full
  }
}

export type TTSConnectionStatus = {
  ok: boolean;
  configured: boolean;
  baseUrl: string;
  details?: string;
  status?: number;
};

export async function checkTTSConnection(): Promise<TTSConnectionStatus | undefined> {
  try {
    const res = await fetch('/api/tts', { method: 'GET', cache: 'no-store' });
    const payload = (await res.json()) as TTSConnectionStatus;

    if (!res.ok || !payload?.ok) {
      console.error(`${TTS_LOG_PREFIX} Connection check failed.`, payload);
      return payload;
    }

    console.info(`${TTS_LOG_PREFIX} Connection check passed.`, payload);
    return payload;
  } catch (err) {
    console.error(`${TTS_LOG_PREFIX} Connection check request failed.`, err);
    return undefined;
  }
}

export async function getTTSAudio(text: string): Promise<TTSAudioPayload | undefined> {
  if (!text.trim()) {
    console.info(`${TTS_LOG_PREFIX} TTS skipped because text is empty.`);
    return undefined;
  }

  if (Date.now() < clientTTSBlockedUntil) {
    const retryAfterMs = clientTTSBlockedUntil - Date.now();
    console.warn(`${TTS_LOG_PREFIX} Skipping TTS request during failure cooldown.`, {
      retryAfterMs,
      failureCount: clientTTSFailureCount,
      textPreview: text.slice(0, 80),
    });
    return undefined;
  }

  const cachedAudio = inMemoryTTSCache.get(text);
  if (cachedAudio?.data) {
    console.info(`${TTS_LOG_PREFIX} TTS cache hit (memory).`, { textPreview: text.slice(0, 80) });
    return cachedAudio;
  }

  const localCached = readFromLocalStorageCache(text);
  if (localCached?.data) {
    console.info(`${TTS_LOG_PREFIX} TTS cache hit (localStorage).`, { textPreview: text.slice(0, 80) });
    inMemoryTTSCache.set(text, localCached);
    return localCached;
  }

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }

      const retryAfterHeader = Number(res.headers.get('retry-after') || '0');
      const retryAfterMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : undefined;
      const cooldownMs = noteClientTTSFailure(retryAfterMs);

      if (res.status === 503) {
        console.warn(`[AI Service] TTS temporarily unavailable — backing off before retry.`, {
          cooldownMs,
          errorBody,
        });
      } else {
        console.error(`[AI Service] TTS API Error: ${res.status} ${res.statusText}`, {
          cooldownMs,
          errorBody,
        });
      }
      return undefined;
    }

    const mimeType = res.headers.get('content-type') || 'audio/mpeg';
    const blob = await res.blob();
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const payload: TTSAudioPayload = { mimeType, data: base64Data };

    resetClientTTSFailureState();
    console.info(`${TTS_LOG_PREFIX} TTS fetched from server API.`, { textLength: text.length, mimeType });
    inMemoryTTSCache.set(text, payload);
    writeToLocalStorageCache(text, payload);
    return payload;
  } catch (err) {
    const cooldownMs = noteClientTTSFailure();
    console.error('[AI Service] TTS fetch failed:', { cooldownMs, err });
    return undefined;
  }
}

export async function generateCommentary(
  teamName: string,
  isCorrect: boolean,
  points: number,
): Promise<string | undefined> {
  // Try each API key until one succeeds
  for (let attempt = 0; attempt < aiClients.length; attempt++) {
    const client = getActiveClient();
    if (!client) {
      logGeminiError('Commentary failed: No Gemini API keys configured.');
      return undefined;
    }

    try {
      const prompt = `Write one witty, family-friendly sentence for a live quiz host. Team: ${teamName}. Outcome: ${isCorrect ? 'correct answer' : 'wrong answer'}. Points: ${points}. Keep it under 18 words.`;

      logGeminiInfo('Commentary request started.', {
        model: TEXT_MODEL,
        keyIndex: activeKeyIndex + 1,
        totalKeys: aiClients.length,
        teamName,
        isCorrect,
        points,
        prompt,
      });

      const response = await client.models.generateContent({
        model: TEXT_MODEL,
        contents: prompt,
      });

      const text = response.text?.trim();
      if (!text) {
        logGeminiError('Commentary response failed: empty text.', {
          model: TEXT_MODEL,
          status: 'fail',
          teamName,
          isCorrect,
          points,
          response,
        });

        return undefined;
      }

      logGeminiInfo('Commentary response success.', {
        model: TEXT_MODEL,
        status: 'pass',
        keyIndex: activeKeyIndex + 1,
        content: text,
        teamName,
        isCorrect,
        points,
      });

      return text || undefined;
    } catch (error) {
      logGeminiError(`Commentary request failed (key #${activeKeyIndex + 1}).`, {
        model: TEXT_MODEL,
        status: 'fail',
        teamName,
        isCorrect,
        points,
        error,
      });

      if (!rotateToNextKey()) {
        return undefined;
      }
    }
  }

  return undefined;
}
