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

function decodeAsLikelyPCM16(context: AudioContext, arrayBuffer: ArrayBuffer): AudioBuffer | undefined {
  const commonSampleRates = [24000, 22050, 16000];

  for (const sampleRate of commonSampleRates) {
    try {
      return decodePCM16ToAudioBuffer(context, arrayBuffer, sampleRate);
    } catch {
      // try next sample rate
    }
  }

  return undefined;
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
  const hasUserGestureRef = useRef(false);

  const waitForUserGesture = useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || hasUserGestureRef.current) {
      return;
    }

    await new Promise<void>((resolve) => {
      const handler = () => {
        hasUserGestureRef.current = true;
        window.removeEventListener('pointerdown', handler);
        window.removeEventListener('keydown', handler);
        resolve();
      };

      window.addEventListener('pointerdown', handler, { once: true });
      window.addEventListener('keydown', handler, { once: true });
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const markGestureAndUnlockAudio = async () => {
      hasUserGestureRef.current = true;

      const context = ensureAudioContext();
      if (!context) {
        return;
      }
      if (context.state === 'suspended') {
        await context.resume();
      }
    };

    const handler = () => {
      void markGestureAndUnlockAudio();
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

      try {
        return await context.decodeAudioData(arrayBuffer.slice(0));
      } catch (decodeError) {
        if (!mimeType) {
          const pcmFallback = decodeAsLikelyPCM16(context, arrayBuffer);
          if (pcmFallback) {
            console.warn('[AudioController] Falling back to PCM16 decode without mimeType.', {
              mimeType: audio.mimeType,
            });
            return pcmFallback;
          }
        }

        throw decodeError;
      }
    } catch (error) {
      console.error('[AudioController] Failed to decode TTS audio payload.', {
        mimeType: audio.mimeType,
        error,
      });
      return undefined;
    }
  }, []);

  const playSequence = useCallback(
    async (audios: TTSAudioPayload[]): Promise<boolean> => {
      if (!hasUserGestureRef.current) {
        await waitForUserGesture();
      }

      const context = ensureAudioContext();
      if (!context) {
        console.warn('[AudioController] No browser AudioContext available.');
        return false;
      }

      if (context.state === 'suspended') {
        try {
          await context.resume();
        } catch {
          console.warn('[AudioController] Unable to resume suspended AudioContext.');
          return false;
        }
      }

      setIsSpeaking(true);
      let playedCount = 0;

      try {
        for (let index = 0; index < audios.length; index += 1) {
          const audio = audios[index];
          if (!audio) {
            continue;
          }

          const buffer = await decodeAudio(audio);
          if (!buffer) {
            console.warn('[AudioController] Skipping TTS playback due to decode failure.', {
              mimeType: audio.mimeType,
            });
            continue;
          }

          await playAudioBuffer(context, buffer);
          playedCount += 1;
          if (index < audios.length - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 300));
          }
        }
      } finally {
        setIsSpeaking(false);
      }

      return playedCount > 0;
    },
    [decodeAudio, waitForUserGesture],
  );

  const speak = useCallback(
    async (text: string): Promise<boolean> => {
      const audio = await getTTSAudio(text);
      if (!audio) {
        return false;
      }
      return playSequence([audio]);
    },
    [playSequence],
  );

  return { isSpeaking, playSequence, speak };
}
