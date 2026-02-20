'use client';

import AIHostAvatar from '@/src/components/AIHostAvatar';
import { useAudioController } from '@/src/hooks/useAudioController';
import { publicApi } from '@/src/lib/api/public';
import { constructVerdict, HOST_SCRIPTS } from '@/src/lib/constants';
import { generateCommentary, getTTSAudio, type TTSAudioPayload } from '@/src/services/aiService';
import { emitToast } from '@/src/lib/ui/toast';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type QuizState = 'PREVIEW' | 'LIVE' | 'LOCKED' | 'REVEALED' | string;

type CurrentResponse = {
  state?: QuizState;
  activeTeamName?: string;
  selectedOptionIndex?: number;
  question?: {
    id?: string;
    text?: string;
    options?: Array<string | { key?: string; text?: string }>;
    correctOptionIndex?: number;
  };
  questionStartedAt?: string | number;
  timerDurationSec?: number;
  serverNowEpochMs?: number;
  mode?: 'STANDARD' | 'BUZZER' | 'ASK_AI'; // Added game mode
};

type LeaderboardEntry = {
  teamName?: string;
  score?: number;
};

type LeaderboardResponse = {
  leaderboard?: LeaderboardEntry[];
};

const CURRENT_POLL_MS = 700;
const LEADERBOARD_POLL_MS = 1500;


function normalizeDisplayOption(option: string | { key?: string; text?: string } | null | undefined, index: number) {
  if (typeof option === 'string') {
    return { key: String.fromCharCode(65 + index), text: option };
  }

  if (option && typeof option === 'object') {
    return {
      key: (typeof option.key === 'string' && option.key.trim()) || String.fromCharCode(65 + index),
      text: typeof option.text === 'string' ? option.text : '',
    };
  }

  return { key: String.fromCharCode(65 + index), text: '' };
}

function toEpochMs(value?: string | number): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function DisplayPage() {
  const [sessionId, setSessionId] = useState('');
  const [current, setCurrent] = useState<CurrentResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hostTranscript, setHostTranscript] = useState<string[]>([]);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const lastNetworkToastAtRef = useRef(0);
  const announcedQuestionRef = useRef<string | null>(null);
  const announcedResultRef = useRef<string | null>(null);
  const announcedTenSecondRef = useRef<string | null>(null);
  const { isSpeaking, playSequence, speak } = useAudioController();

  // User must click once to unlock audio (browser policy)
  const handleUnlockAudio = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        await ctx.resume();
        ctx.close(); // We just needed the gesture; useAudioController manages its own ctx
      }
    } catch { /* ignore */ }
    setAudioUnlocked(true);
  }, []);

  const pushHostLine = useCallback((line: string) => {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      return;
    }

    setHostTranscript((previous) => {
      const next = [...previous, normalizedLine];
      return next.slice(-6);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('sessionId')?.trim() ?? '';
    setSessionId(fromQuery);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTickNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f') {
        return;
      }

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setCurrent(null);
      setLeaderboard([]);
      setError('Missing sessionId in query string. Example: /display?sessionId=demo');
      return;
    }

    let isMounted = true;

    const pollCurrent = async () => {
      try {
        const response = await publicApi.getCurrent<CurrentResponse>(sessionId);
        if (!isMounted) {
          return;
        }

        setCurrent(response);
        setError(null);
        setLastPollAt(Date.now());
        setIsReconnecting(false);
      } catch {
        if (!isMounted) {
          return;
        }

        const shouldToast = Date.now() - lastNetworkToastAtRef.current > 12_000;
        if (shouldToast) {
          lastNetworkToastAtRef.current = Date.now();
          emitToast({
            level: 'error',
            title: 'Network issue while polling quiz state',
            message: 'Safe mode active. Retrying automatically every 700ms.',
          });
        }
        setIsReconnecting(true);
        setError('Live updates paused. Retrying now…');
      }
    };

    pollCurrent();
    const currentInterval = window.setInterval(pollCurrent, CURRENT_POLL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(currentInterval);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || current?.state !== 'REVEALED') {
      return;
    }

    let isMounted = true;

    const pollLeaderboard = async () => {
      try {
        const response = await publicApi.getLeaderboard<LeaderboardResponse>(sessionId);
        if (!isMounted) {
          return;
        }
        setLeaderboard(response.leaderboard ?? []);
      } catch {
        if (!isMounted) {
          return;
        }

        if (Date.now() - lastNetworkToastAtRef.current > 12_000) {
          lastNetworkToastAtRef.current = Date.now();
          emitToast({
            level: 'error',
            title: 'Leaderboard temporarily unavailable',
            message: 'Retrying in the background. Showing the latest known standings.',
          });
        }
        setLeaderboard([]);
      }
    };

    pollLeaderboard();
    const leaderboardInterval = window.setInterval(pollLeaderboard, LEADERBOARD_POLL_MS);

    return () => {
      isMounted = false;
      window.clearInterval(leaderboardInterval);
    };
  }, [sessionId, current?.state]);

  const countdown = useMemo(() => {
    const startedAtMs = toEpochMs(current?.questionStartedAt);
    const durationSec = current?.timerDurationSec;
    if (!startedAtMs || !durationSec) {
      return null;
    }

    const serverNow = current?.serverNowEpochMs;
    const elapsedMs = serverNow ? serverNow - startedAtMs : tickNow - startedAtMs;
    return Math.max(0, Math.ceil(durationSec - elapsedMs / 1000));
  }, [current?.questionStartedAt, current?.serverNowEpochMs, current?.timerDurationSec, tickNow]);

  const state = current?.state ?? 'PREVIEW';
  const activeTeamName = current?.activeTeamName ?? 'Team';
  const correctOptionIndex = current?.question?.correctOptionIndex;
  const questionOptions = (current?.question?.options ?? []).map((option, index) => normalizeDisplayOption(option, index));
  const pollStatus = lastPollAt ? `Last poll ${new Date(lastPollAt).toLocaleTimeString()}` : 'No successful polls yet';

  useEffect(() => {
    if (!audioUnlocked) return;
    pushHostLine(HOST_SCRIPTS.INTRO);
    void speak(HOST_SCRIPTS.INTRO);
  }, [audioUnlocked, pushHostLine, speak]);

  useEffect(() => {
    if (!audioUnlocked || !current?.question?.text || questionOptions.length === 0) {
      return;
    }

    const questionId = current.question.id ?? `${current.question.text}-${questionOptions.map((option) => option.text).join('|')}`;
    if (announcedQuestionRef.current === questionId) {
      return;
    }

    announcedQuestionRef.current = questionId;
    announcedTenSecondRef.current = null;

    const optionsText = questionOptions.map((option) => `${option.key}. ${option.text}`).join('. ');
    const message = `Question for ${activeTeamName}. ${current.question.text}. Options are ${optionsText}.`;

    pushHostLine(message);
    void speak(message);
  }, [audioUnlocked, activeTeamName, current?.question?.id, current?.question?.text, pushHostLine, questionOptions, speak]);

  useEffect(() => {
    if (state !== 'REVEALED' || correctOptionIndex === undefined) {
      return;
    }

    const resultSignature = `${current?.question?.id ?? current?.question?.text}-${correctOptionIndex}-${current?.selectedOptionIndex ?? 'NA'}`;
    if (announcedResultRef.current === resultSignature) {
      return;
    }

    announcedResultRef.current = resultSignature;

    const selectedOption = current?.selectedOptionIndex !== undefined ? questionOptions[current.selectedOptionIndex]?.key : undefined;
    const correctOption = questionOptions[correctOptionIndex]?.key ?? String.fromCharCode(65 + correctOptionIndex);
    const isCorrect = current?.selectedOptionIndex === correctOptionIndex;
    const verdict = constructVerdict(isCorrect, activeTeamName, correctOption, selectedOption);

    void (async () => {
      const wittyComment = await generateCommentary(activeTeamName, isCorrect, isCorrect ? 10 : 0);
      const spokenLines = [verdict.meme, verdict.technical, wittyComment].filter((line): line is string => Boolean(line));
      spokenLines.forEach(pushHostLine);
      const [memeAudio, technicalAudio, wittyAudio] = await Promise.all([
        getTTSAudio(verdict.meme),
        getTTSAudio(verdict.technical),
        wittyComment ? getTTSAudio(wittyComment) : Promise.resolve(undefined),
      ]);

      await playSequence([memeAudio, technicalAudio, wittyAudio].filter((audio): audio is TTSAudioPayload => Boolean(audio)));
    })();
  }, [audioUnlocked, activeTeamName, correctOptionIndex, current?.question?.id, current?.question?.text, current?.selectedOptionIndex, playSequence, pushHostLine, questionOptions, state]);

  useEffect(() => {
    if (!audioUnlocked || countdown !== 10 || !current?.question?.text) {
      return;
    }

    const questionId = current.question.id ?? current.question.text;
    if (announcedTenSecondRef.current === questionId) {
      return;
    }

    announcedTenSecondRef.current = questionId;
    pushHostLine('10 seconds remaining.');
    void speak('10 seconds remaining.');
  }, [audioUnlocked, countdown, current?.question?.id, current?.question?.text, pushHostLine, speak]);

  return (
    <section className="fixed inset-0 overflow-y-auto bg-slate-950 p-8 text-slate-100 lg:p-14">
      {/* Audio Unlock Overlay — required by browsers before any audio can play */}
      {!audioUnlocked && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm cursor-pointer"
          onClick={handleUnlockAudio}
        >
          <div className="text-center space-y-6 max-w-sm">
            <div className="text-7xl animate-pulse">🔊</div>
            <h2 className="text-3xl font-bold text-white">Click to Enable Audio</h2>
            <p className="text-slate-400 text-lg">Tap anywhere to activate voice announcements for this quiz session.</p>
            <div className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-10 rounded-2xl text-xl transition-all transform hover:scale-105 shadow-xl shadow-indigo-900/40">
              ▶ Start Audio
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300">
            Session: <span className="font-semibold text-white">{sessionId || '—'}</span>
          </div>
          <div className="flex gap-2">
            {current?.mode && (
              <div className={`rounded-full border px-4 py-2 text-sm font-semibold uppercase ${current.mode === 'BUZZER'
                ? 'border-pink-500/40 bg-pink-500/10 text-pink-300'
                : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                }`}>
                {current.mode} MODE
              </div>
            )}
            <div className="rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300">
              Display mode: press <kbd className="rounded bg-slate-800 px-2 py-0.5 text-xs">F</kbd> for fullscreen
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex rounded-full border border-amber-400/50 bg-amber-500/10 px-5 py-2 text-base font-semibold tracking-wide text-amber-200">
            {state}
          </span>
          <span
            className={`rounded-full border px-4 py-2 text-sm font-medium ${isReconnecting
              ? 'border-amber-400/60 bg-amber-500/15 text-amber-100'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              }`}
          >
            {isReconnecting ? 'Reconnecting…' : 'Online'} • {pollStatus}
          </span>
          <span className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-3xl font-bold tabular-nums text-emerald-300">
            {countdown === null ? '—' : `${countdown}s`}
          </span>
        </div>

        {isReconnecting && (
          <div className="rounded-xl border border-amber-300/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Safe mode enabled. Showing the last known question while trying to reconnect.
          </div>
        )}

        <div className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 xl:grid-cols-4">
          <div className="xl:col-span-1">
            <AIHostAvatar isSpeaking={isSpeaking} size="lg" />
            <p className="mt-3 text-center text-sm text-cyan-200/80">AI Host {isSpeaking ? 'Speaking…' : 'Standing by'}</p>

            <div className="mt-4 rounded-xl border border-cyan-500/30 bg-slate-950/70 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">AI voice transcript</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {hostTranscript.map((line, index) => (
                  <li key={`${index}-${line.slice(0, 24)}`} className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2">
                    {line}
                  </li>
                ))}
                {hostTranscript.length === 0 && <li className="text-slate-400">Transcript will appear as the AI host speaks.</li>}
              </ul>
            </div>
          </div>

          <div className="xl:col-span-3">
            <h2 className="text-4xl font-bold leading-tight lg:text-6xl">
              {current?.question?.text ?? 'Waiting for question...'}
            </h2>

            <ul className="mt-8 grid gap-4 lg:grid-cols-2">
              {questionOptions.map((option, index) => {
                const isCorrect = state === 'REVEALED' && correctOptionIndex === index;
                return (
                  <li
                    key={`${index}-${option.key}-${option.text}`}
                    className={`rounded-xl border px-5 py-4 text-2xl font-semibold lg:text-3xl ${isCorrect
                      ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100'
                      : 'border-slate-700 bg-slate-800/70 text-slate-100'
                      }`}
                  >
                    <span className="mr-3 text-slate-400">{option.key}.</span>
                    {option.text}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {state === 'REVEALED' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
            <h3 className="text-2xl font-semibold text-emerald-300 lg:text-3xl">Leaderboard</h3>
            <ol className="mt-5 space-y-3">
              {leaderboard.map((entry, index) => (
                <li
                  key={`${entry.teamName}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/80 px-5 py-3"
                >
                  <span className="text-xl font-medium text-slate-100 lg:text-2xl">
                    {index + 1}. {entry.teamName ?? 'Unknown team'}
                  </span>
                  <span className="text-xl font-bold tabular-nums text-amber-300 lg:text-2xl">{entry.score ?? 0}</span>
                </li>
              ))}
              {leaderboard.length === 0 && <li className="text-slate-400">No leaderboard data.</li>}
            </ol>
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-300">
            {error} If this continues, check API connectivity and keep this screen open to auto-retry.
          </p>
        )}
      </div>
    </section>
  );
}
