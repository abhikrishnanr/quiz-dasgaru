'use client';

import { useCallback } from 'react';

type SoundType = 'join' | 'live' | 'lock' | 'reveal_correct' | 'reveal_wrong';

export function useGameSounds() {
    const play = useCallback((type: SoundType) => {
        try {
            const audio = new Audio(`/sounds/${type}.mp3`);
            audio.play().catch(e => {
                // Ignore auto-play errors or missing files
                console.log(`Sound not played: ${type}`, e);
            });
        } catch (e) {
            console.error("Audio error", e);
        }
    }, []);

    return { play };
}
