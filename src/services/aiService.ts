'use client';

const TTS_MODEL = 'gemini-2.5-flash-tts';
const TEXT_MODEL = 'gemini-2.5-flash';
const CACHE_PREFIX = 'ai-host-tts:';
const GEMINI_LOG_PREFIX = '[VoiceAgent]';

export type TTSAudioPayload = {
  data: string;
  mimeType?: string;
};

const inMemoryTTSCache = new Map<string, TTSAudioPayload>();

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
    logGeminiInfo('TTS skipped because text is empty.');
    return undefined;
  }

  const cachedAudio = inMemoryTTSCache.get(text);
  if (cachedAudio?.data) {
    logGeminiInfo('TTS cache hit (memory).', { textPreview: text.slice(0, 80) });
    return cachedAudio;
  }

  const localCached = readFromLocalStorageCache(text);
  if (localCached?.data) {
    logGeminiInfo('TTS cache hit (localStorage).', { textPreview: text.slice(0, 80) });
    inMemoryTTSCache.set(text, localCached);
    return localCached;
  }

  try {
    logGeminiInfo('TTS request started.', {
      model: TTS_MODEL,
      textPreview: text.slice(0, 120),
      textLength: text.length,
    });

    const response = await fetch('/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      logGeminiError('TTS request failed.', { model: TTS_MODEL, status: 'fail', httpStatus: response.status });
      return undefined;
    }

    const audioPayload = (await response.json()) as TTSAudioPayload;

    if (!audioPayload?.data) {
      logGeminiError('TTS response failed: no audio content in API response.', {
        model: TTS_MODEL,
        status: 'fail',
      });
      return undefined;
    }

    logGeminiInfo('TTS response success.', {
      model: TTS_MODEL,
      status: 'pass',
      audioBytesBase64Length: audioPayload.data.length,
      mimeType: audioPayload.mimeType,
      textPreview: text.slice(0, 120),
    });

    inMemoryTTSCache.set(text, audioPayload);
    writeToLocalStorageCache(text, audioPayload);
    return audioPayload;
  } catch (error) {
    logGeminiError('TTS request failed.', {
      model: TTS_MODEL,
      status: 'fail',
      textPreview: text.slice(0, 120),
      error,
    });

    return undefined;
  }
}

export async function generateCommentary(
  teamName: string,
  isCorrect: boolean,
  points: number,
): Promise<string | undefined> {
  try {
    const prompt = `Write one witty, family-friendly sentence for a live quiz host. Team: ${teamName}. Outcome: ${isCorrect ? 'correct answer' : 'wrong answer'}. Points: ${points}. Keep it under 18 words.`;

    logGeminiInfo('Commentary request started.', {
      model: TEXT_MODEL,
      teamName,
      isCorrect,
      points,
      prompt,
    });

    const response = await fetch('/api/ai/commentary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, teamName, isCorrect, points }),
    });

    if (!response.ok) {
      logGeminiError('Commentary request failed.', {
        model: TEXT_MODEL,
        status: 'fail',
        teamName,
        isCorrect,
        points,
        httpStatus: response.status,
      });
      return undefined;
    }

    const payload = (await response.json()) as { text?: string };
    const text = payload.text?.trim();
    if (!text) {
      logGeminiError('Commentary response failed: empty text.', {
        model: TEXT_MODEL,
        status: 'fail',
        teamName,
        isCorrect,
        points,
      });

      return undefined;
    }

    logGeminiInfo('Commentary response success.', {
      model: TEXT_MODEL,
      status: 'pass',
      content: text,
      teamName,
      isCorrect,
      points,
    });

    return text || undefined;
  } catch (error) {
    logGeminiError('Commentary request failed.', {
      model: TEXT_MODEL,
      status: 'fail',
      teamName,
      isCorrect,
      points,
      error,
    });

    return undefined;
  }
}
