'use client';

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TEXT_MODEL = 'gemini-2.5-flash';
const CACHE_PREFIX = 'ai-host-tts:';
const GEMINI_LOG_PREFIX = '[Gemini API]';

export type TTSAudioPayload = {
  data: string;
  mimeType?: string;
};

const inMemoryTTSCache = new Map<string, string>();
const aiClient = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

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

function readFromLocalStorageCache(text: string): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.localStorage.getItem(`${CACHE_PREFIX}${text}`) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeToLocalStorageCache(text: string, audioBase64: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${text}`, audioBase64);
  } catch {
    // no-op if storage is unavailable or full
  }
}

function extractAudioData(response: unknown): TTSAudioPayload | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const typedResponse = response as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };

  const inlineData = typedResponse.candidates?.[0]?.content?.parts?.find((part) => part?.inlineData?.data)?.inlineData;
  if (!inlineData?.data) {
    return undefined;
  }

  return {
    data: inlineData.data,
    mimeType: inlineData.mimeType,
  };
}

export async function getTTSAudio(text: string): Promise<TTSAudioPayload | undefined> {
  if (!text.trim()) {
    logGeminiInfo('TTS skipped because text is empty.');
    return undefined;
  }

  const cachedAudio = inMemoryTTSCache.get(text);
  if (cachedAudio) {
    logGeminiInfo('TTS cache hit (memory).', { textPreview: text.slice(0, 80) });
    return { data: cachedAudio };
  }

  const localCached = readFromLocalStorageCache(text);
  if (localCached) {
    logGeminiInfo('TTS cache hit (localStorage).', { textPreview: text.slice(0, 80) });
    inMemoryTTSCache.set(text, localCached);
    return { data: localCached };
  }

  if (!aiClient) {
    logGeminiError('TTS failed: Gemini client unavailable. Check NEXT_PUBLIC_GEMINI_API_KEY.');
    return undefined;
  }

  try {
    logGeminiInfo('TTS request started.', {
      model: TTS_MODEL,
      textPreview: text.slice(0, 120),
      textLength: text.length,
    });

    const response = await aiClient.models.generateContent({
      model: TTS_MODEL,
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Kore',
            },
          },
        },
      },
    });

    const audioPayload = extractAudioData(response);
    if (!audioPayload?.data) {
      logGeminiError('TTS response failed: no audio content in Gemini response.', {
        model: TTS_MODEL,
        status: 'fail',
        response,
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

    inMemoryTTSCache.set(text, audioPayload.data);
    writeToLocalStorageCache(text, audioPayload.data);
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
  if (!aiClient) {
    logGeminiError('Commentary failed: Gemini client unavailable. Check NEXT_PUBLIC_GEMINI_API_KEY.');
    return undefined;
  }

  try {
    const prompt = `Write one witty, family-friendly sentence for a live quiz host. Team: ${teamName}. Outcome: ${isCorrect ? 'correct answer' : 'wrong answer'}. Points: ${points}. Keep it under 18 words.`;

    logGeminiInfo('Commentary request started.', {
      model: TEXT_MODEL,
      teamName,
      isCorrect,
      points,
      prompt,
    });

    const response = await aiClient.models.generateContent({
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
