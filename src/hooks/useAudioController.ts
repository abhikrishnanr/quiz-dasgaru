'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getTTSAudio, type TTSAudioPayload } from '@/src/services/aiService';

let sharedAudioContext: AudioContext | null = null;

function ensureAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!sharedAudioContext) {
    const Context = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) {
      return null;
    }
    sharedAudioContext = new Context();
  }

  return sharedAudioContext;
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function decodePCM16ToAudioBuffer(context: AudioContext, pcmBuffer: ArrayBuffer, sampleRate: number): AudioBuffer {
  const int16 = new Int16Array(pcmBuffer);
  const audioBuffer = context.createBuffer(1, int16.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < int16.length; i += 1) {
    channelData[i] = int16[i] / 32768;
  }

  return audioBuffer;
}

function parseSampleRateFromMimeType(mimeType?: string): number | undefined {
  if (!mimeType) {
    return undefined;
  }

  const sampleRateMatch = mimeType.match(/rate=(\d+)/i);
  if (!sampleRateMatch?.[1]) {
    return undefined;
  }

  const sampleRate = Number.parseInt(sampleRateMatch[1], 10);
  return Number.isFinite(sampleRate) && sampleRate > 0 ? sampleRate : undefined;
}

async function playAudioBuffer(context: AudioContext, buffer: AudioBuffer): Promise<void> {
  await new Promise<void>((resolve) => {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => resolve();
    source.start();
  });
}

export function useAudioController() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || initializedRef.current) {
      return;
    }

    const unlockAudio = async () => {
      const context = ensureAudioContext();
      if (!context) {
        return;
      }
      if (context.state === 'suspended') {
        await context.resume();
      }
    };

    const handler = () => {
      void unlockAudio();
      initializedRef.current = true;
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };

    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });

    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const decodeAudio = useCallback(async (audio: TTSAudioPayload): Promise<AudioBuffer | undefined> => {
    try {
      const context = ensureAudioContext();
      if (!context) {
        return undefined;
      }

      const arrayBuffer = decodeBase64ToArrayBuffer(audio.data);
      const mimeType = audio.mimeType?.toLowerCase();
      if (mimeType?.includes('audio/l16') || mimeType?.includes('audio/pcm')) {
        const sampleRate = parseSampleRateFromMimeType(mimeType) ?? 24000;
        return decodePCM16ToAudioBuffer(context, arrayBuffer, sampleRate);
      }

      return await context.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      return undefined;
    }
  }, []);

  const playSequence = useCallback(
    async (audios: TTSAudioPayload[]) => {
      const context = ensureAudioContext();
      if (!context) {
        return;
      }

      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch {
          return;
        }
      }

      setIsSpeaking(true);

      try {
        for (let index = 0; index < audios.length; index += 1) {
          const audio = audios[index];
          if (!audio) {
            continue;
          }

          const buffer = await decodeAudio(audio);
          if (!buffer) {
            continue;
          }

          await playAudioBuffer(context, buffer);
          if (index < audios.length - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 300));
          }
        }
      } finally {
        setIsSpeaking(false);
      }
    },
    [decodeAudio],
  );

  const speak = useCallback(
    async (text: string) => {
      const audio = await getTTSAudio(text);
      if (!audio) {
        return;
      }
      await playSequence([audio]);
    },
    [playSequence],
  );

  return { isSpeaking, playSequence, speak };
}
