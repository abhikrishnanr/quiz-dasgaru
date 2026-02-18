'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { getTTSAudio } from '@/src/services/aiService';

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

  const decodeAudio = useCallback(async (audioBase64: string): Promise<AudioBuffer | undefined> => {
    try {
      const context = ensureAudioContext();
      if (!context) {
        return undefined;
      }

      const arrayBuffer = decodeBase64ToArrayBuffer(audioBase64);
      return await context.decodeAudioData(arrayBuffer.slice(0));
    } catch {
      return undefined;
    }
  }, []);

  const playSequence = useCallback(
    async (audios: string[]) => {
      const context = ensureAudioContext();
      if (!context) {
        return;
      }

      if (context.state === 'suspended') {
        await context.resume();
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
