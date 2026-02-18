'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * useQuizTimer
 * 
 * Manages a smooth countdown timer that syncs with the server's remaining time.
 * It decrements locally every second but realigns with the server value whenever it updates.
 *
 * @param serverTimeRemaining - The remaining seconds from the server response.
 * @param isLive - Whether the current question is live (timer should run).
 * @param totalDuration - Optional: Total duration of the question for progress calculation (default 20s if unknown).
 * @returns { displayTime: number, progress: number }
 */
export function useQuizTimer(serverTimeRemaining: number, isLive: boolean, totalDuration: number = 20) {
    const [displayTime, setDisplayTime] = useState(serverTimeRemaining);
    const lastServerTimeRef = useRef(serverTimeRemaining);
    const tickRef = useRef<NodeJS.Timeout>(null);

    // Sync with server if value changes significantly or on re-entry
    useEffect(() => {
        // Only update if server time is logically different (avoid jitter)
        // or if we just mounted/rendered
        if (serverTimeRemaining !== lastServerTimeRef.current) {
            setDisplayTime(serverTimeRemaining);
            lastServerTimeRef.current = serverTimeRemaining;
        }
    }, [serverTimeRemaining]);

    useEffect(() => {
        if (!isLive || displayTime <= 0) {
            if (tickRef.current) clearInterval(tickRef.current as unknown as number);
            return;
        }

        tickRef.current = setInterval(() => {
            setDisplayTime((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            if (tickRef.current) clearInterval(tickRef.current as unknown as number);
        };
    }, [isLive, displayTime]);

    const safeDuration = totalDuration > 0 ? totalDuration : 20;
    const progress = Math.min(100, Math.max(0, (displayTime / safeDuration) * 100));

    return { displayTime, progress };
}
