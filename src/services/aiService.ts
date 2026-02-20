'use client';

import { GoogleGenAI } from '@google/genai';

const API_KEYS = [
  process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  process.env.NEXT_PUBLIC_GEMINI_API_KEY_2,
].filter((k): k is string => !!k?.trim());

const TEXT_MODEL = 'gemini-2.5-flash';
const CACHE_PREFIX = 'ai-host-tts:';
const TTS_LOG_PREFIX = '[ElevenLabs TTS]';
const GEMINI_LOG_PREFIX = '[Gemini API]';

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

export async function getTTSAudio(text: string): Promise<TTSAudioPayload | undefined> {
  if (!text.trim()) {
    console.info(`${TTS_LOG_PREFIX} TTS skipped because text is empty.`);
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
      if (res.status === 503) {
        console.warn(`[AI Service] TTS rate-limited — will retry on next call.`);
      } else {
        console.error(`[AI Service] TTS API Error: ${res.status} ${res.statusText}`);
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

    console.info(`${TTS_LOG_PREFIX} TTS fetched from server API.`, { textLength: text.length, mimeType });
    inMemoryTTSCache.set(text, payload);
    writeToLocalStorageCache(text, payload);
    return payload;
  } catch (err) {
    console.error('[AI Service] TTS fetch failed:', err);
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
