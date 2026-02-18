'use client';

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TEXT_MODEL = 'gemini-2.5-flash';
const CACHE_PREFIX = 'ai-host-tts:';

const inMemoryTTSCache = new Map<string, string>();
const aiClient = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

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

function extractAudioData(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const typedResponse = response as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
  };

  return typedResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}

export async function getTTSAudio(text: string): Promise<string | undefined> {
  if (!text.trim()) {
    return undefined;
  }

  if (inMemoryTTSCache.has(text)) {
    return inMemoryTTSCache.get(text);
  }

  const localCached = readFromLocalStorageCache(text);
  if (localCached) {
    inMemoryTTSCache.set(text, localCached);
    return localCached;
  }

  if (!aiClient) {
    return undefined;
  }

  try {
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

    const audioBase64 = extractAudioData(response);
    if (!audioBase64) {
      return undefined;
    }

    inMemoryTTSCache.set(text, audioBase64);
    writeToLocalStorageCache(text, audioBase64);
    return audioBase64;
  } catch {
    return undefined;
  }
}

export async function generateCommentary(
  teamName: string,
  isCorrect: boolean,
  points: number,
): Promise<string | undefined> {
  if (!aiClient) {
    return undefined;
  }

  try {
    const prompt = `Write one witty, family-friendly sentence for a live quiz host. Team: ${teamName}. Outcome: ${isCorrect ? 'correct answer' : 'wrong answer'}. Points: ${points}. Keep it under 18 words.`;
    const response = await aiClient.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
    });

    const text = response.text?.trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}
