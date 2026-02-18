'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import AIHostAvatar from '@/src/components/AIHostAvatar';
import { useAudioController } from '@/src/hooks/useAudioController';
import { getJson } from '@/src/lib/api/http';
import { publicApi } from '@/src/lib/api/public';
import { constructVerdict } from '@/src/lib/constants';
import { normalizeSessionId } from '@/src/lib/session-id';
import { emitToast } from '@/src/lib/ui/toast';
import { generateCommentary, getTTSAudio, type TTSAudioPayload } from '@/src/services/aiService';

type QuizState = 'PREVIEW' | 'LIVE' | 'LOCKED' | 'REVEALED' | string;

type DisplayQuestion = {
  id?: string;
  questionId?: string;
  text?: string;
  questionText?: string;
  options?:
    | Array<string | { key?: string; text?: string; label?: string; value?: string }>
    | Record<string, string | { text?: string; label?: string; value?: string }>;
  correctOptionIndex?: number;
  correctAnswer?: string;
  correctKey?: string;
};

type CurrentResponse = {
  state?: QuizState;
  session?: {
    state?: QuizState;
  };
  activeTeamName?: string;
  selectedOptionIndex?: number;
  selectedKey?: string;
  question?: DisplayQuestion;
  currentQuestion?: DisplayQuestion;
  questionStartedAt?: string | number;
  timerDurationSec?: number;
  serverNowEpochMs?: number;
  mode?: 'STANDARD' | 'BUZZER';
};

type LeaderboardEntry = {
  teamName?: string;
  score?: number;
};

type LeaderboardResponse = { leaderboard?: LeaderboardEntry[] };

const CURRENT_POLL_MS = 700;
const SCOREBOARD_POLL_MS = 1200;
const LEADERBOARD_POLL_MS = 1500;

function normalizeDisplayOption(option: string | { key?: string; text?: string } | null | undefined, index: number) {
  if (typeof option === 'string') {
    return { key: String.fromCharCode(65 + index), text: option };
  }

  if (option && typeof option === 'object') {
    return {
      key: (typeof option.key === 'string' && option.key.trim()) || String.fromCharCode(65 + index),
      text:
        (typeof option.text === 'string' && option.text) ||
        (typeof option.label === 'string' && option.label) ||
        (typeof option.value === 'string' && option.value) ||
        '',
    };
  }

  return { key: String.fromCharCode(65 + index), text: '' };
}

function toEpochMs(value?: string | number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeOptions(options?: DisplayQuestion['options']) {
  if (Array.isArray(options)) {
    return options.map((option, index) => normalizeDisplayOption(option, index));
  }

  if (options && typeof options === 'object') {
    return Object.entries(options).map(([key, value], index) => {
      if (typeof value === 'string') return normalizeDisplayOption({ key, text: value }, index);
      if (value && typeof value === 'object') {
        return normalizeDisplayOption(
          {
            key,
            text: typeof value.text === 'string' ? value.text : undefined,
            label: typeof value.label === 'string' ? value.label : undefined,
            value: typeof value.value === 'string' ? value.value : undefined,
          },
          index,
        );
      }

      return normalizeDisplayOption({ key, text: '' }, index);
    });
  }

  return [];
}

function optionKeyToIndex(options: ReturnType<typeof normalizeOptions>, optionKey?: string) {
  if (!optionKey) return undefined;
  return options.findIndex((option) => option.key.toUpperCase() === optionKey.toUpperCase());
}

function resolveActiveQuestion(current: CurrentResponse | null): DisplayQuestion | undefined {
  if (!current) return undefined;

  const response = current as CurrentResponse & {
    current?: DisplayQuestion;
    current_question?: DisplayQuestion;
    data?: {
      question?: DisplayQuestion;
      currentQuestion?: DisplayQuestion;
      current?: DisplayQuestion;
    };
  };

  return (
    response.question ??
    response.currentQuestion ??
    response.current ??
    response.current_question ??
    response.data?.question ??
    response.data?.currentQuestion ??
    response.data?.current
  );
}

export default function DisplayPage() {
  const [sessionId, setSessionId] = useState('');
  const [current, setCurrent] = useState<CurrentResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const lastNetworkToastAtRef = useRef(0);
  const introPlayedRef = useRef(false);
  const announcedResultRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const announcedTenSecondRef = useRef<string | null>(null);
  const questionRequestRef = useRef(0);

  const { isSpeaking, playSequence, speak, startLoadingTone, stopLoadingTone } = useAudioController();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(normalizeSessionId(params.get('sessionId')));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTickNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f') return;

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
      setError('Missing sessionId in query string. Example: /display?sessionId=demo');
      return;
    }

    let mounted = true;

    const pollCurrent = async () => {
      try {
        const response = await publicApi.getCurrent<CurrentResponse>(sessionId);
        if (!mounted) return;

        setCurrent(response);
        setLastPollAt(Date.now());
        setIsReconnecting(false);
        setError(null);
      } catch {
        if (!mounted) return;

        if (Date.now() - lastNetworkToastAtRef.current > 12_000) {
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

    void pollCurrent();
    const interval = window.setInterval(pollCurrent, CURRENT_POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    let mounted = true;
    const pollScoreboard = async () => {
      try {
        const response = await getJson<{ showScoreboard: boolean }>(`/api/public/session/${encodeURIComponent(sessionId)}/scoreboard`);
        if (mounted) {
          setShowScoreboard(Boolean(response.showScoreboard));
        }
      } catch {
        // silent fallback
      }
    };

    void pollScoreboard();
    const interval = window.setInterval(pollScoreboard, SCOREBOARD_POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !showScoreboard) return;

    let mounted = true;
    const pollLeaderboard = async () => {
      try {
        const response = await publicApi.getLeaderboard<LeaderboardResponse>(sessionId);
        if (mounted) setLeaderboard(response.leaderboard ?? []);
      } catch {
        if (!mounted) return;
        setLeaderboard([]);
      }
    };

    void pollLeaderboard();
    const interval = window.setInterval(pollLeaderboard, LEADERBOARD_POLL_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [sessionId, showScoreboard]);

  useEffect(() => {
    if (introPlayedRef.current) return;
    introPlayedRef.current = true;
    void speak('Welcome to Digital University Quiz. Let us start!');
  }, [speak]);

  const activeQuestion = resolveActiveQuestion(current);
  const state = current?.state ?? current?.session?.state ?? 'PREVIEW';
  const activeTeamName = current?.activeTeamName ?? 'Team';
  const questionOptions = normalizeOptions(activeQuestion?.options);
  const questionText = activeQuestion?.text ?? activeQuestion?.questionText;
  const currentQuestionId = activeQuestion?.id ?? activeQuestion?.questionId ?? (questionText ? `${questionText}-${questionOptions.map((option) => option.text).join('|')}` : null);
  const correctOptionIndex =
    activeQuestion?.correctOptionIndex ??
    optionKeyToIndex(questionOptions, activeQuestion?.correctAnswer ?? activeQuestion?.correctKey);
  const selectedOptionIndex =
    current?.selectedOptionIndex ?? optionKeyToIndex(questionOptions, current?.selectedKey);

  useEffect(() => {
    if (!currentQuestionId || !questionText || questionOptions.length === 0) return;
    if (pendingQuestionRef.current === currentQuestionId) return;

    questionRequestRef.current += 1;
    const requestId = questionRequestRef.current;
    let cancelled = false;

    pendingQuestionRef.current = currentQuestionId;
    setIsQuestionLoading(true);

    const optionsText = questionOptions.map((option) => `${option.key}. ${option.text}`).join('. ');
    const questionPrompt = `Question for ${activeTeamName}. ${questionText}. Options are ${optionsText}.`;
    const loadingAnnouncement = 'Preparing your next question. Please get ready.';
    const audioReadyTimeoutMs = 9_000;

    const resolveWithinTimeout = async <T,>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((resolve) => {
          window.setTimeout(() => resolve(fallback), timeoutMs);
        }),
      ]);
    };

    void (async () => {
      await startLoadingTone();

      try {
        const [preparingAudio, questionAudio] = await Promise.all([
          resolveWithinTimeout(getTTSAudio(loadingAnnouncement), undefined, audioReadyTimeoutMs),
          resolveWithinTimeout(getTTSAudio(questionPrompt), undefined, audioReadyTimeoutMs),
        ]);

        if (cancelled || questionRequestRef.current !== requestId) return;

        setIsQuestionLoading(false);
        pendingQuestionRef.current = null;
        announcedTenSecondRef.current = null;
        stopLoadingTone();

        const readySequence = [preparingAudio, questionAudio].filter((audio): audio is TTSAudioPayload => Boolean(audio));
        if (readySequence.length > 0) {
          await playSequence(readySequence);
        }
      } finally {
        if (!cancelled && questionRequestRef.current === requestId) {
          stopLoadingTone();
          setIsQuestionLoading(false);
          pendingQuestionRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      stopLoadingTone();
    };
  }, [activeTeamName, currentQuestionId, playSequence, questionOptions, questionText, startLoadingTone, stopLoadingTone]);

  const countdown = useMemo(() => {
    const startedAtMs = toEpochMs(current?.questionStartedAt);
    const durationSec = current?.timerDurationSec;
    if (!startedAtMs || !durationSec) return null;

    const elapsedMs = (current?.serverNowEpochMs ?? tickNow) - startedAtMs;
    return Math.max(0, Math.ceil(durationSec - elapsedMs / 1000));
  }, [current?.questionStartedAt, current?.serverNowEpochMs, current?.timerDurationSec, tickNow]);

  useEffect(() => {
    if (state !== 'REVEALED' || correctOptionIndex === undefined) return;

    const resultSignature = `${currentQuestionId}-${correctOptionIndex}-${selectedOptionIndex ?? 'NA'}`;
    if (announcedResultRef.current === resultSignature) return;
    announcedResultRef.current = resultSignature;

    const selectedOption = selectedOptionIndex !== undefined ? questionOptions[selectedOptionIndex]?.key : undefined;
    const correctOption = questionOptions[correctOptionIndex]?.key ?? String.fromCharCode(65 + correctOptionIndex);
    const isCorrect = selectedOptionIndex === correctOptionIndex;
    const verdict = constructVerdict(isCorrect, activeTeamName, correctOption, selectedOption);

    void (async () => {
      const wittyComment = await generateCommentary(activeTeamName, isCorrect, isCorrect ? 10 : 0);
      const [memeAudio, technicalAudio, wittyAudio] = await Promise.all([
        getTTSAudio(verdict.meme),
        getTTSAudio(verdict.technical),
        wittyComment ? getTTSAudio(wittyComment) : Promise.resolve(undefined),
      ]);

      await playSequence([memeAudio, technicalAudio, wittyAudio].filter((audio): audio is TTSAudioPayload => Boolean(audio)));
    })();
  }, [activeTeamName, correctOptionIndex, currentQuestionId, playSequence, questionOptions, selectedOptionIndex, state]);

  useEffect(() => {
    if (countdown !== 10 || !currentQuestionId) return;
    if (announcedTenSecondRef.current === currentQuestionId) return;

    announcedTenSecondRef.current = currentQuestionId;
    void speak('10 seconds remaining.');
  }, [countdown, currentQuestionId, speak]);

  const pollStatus = lastPollAt ? `Last poll ${new Date(lastPollAt).toLocaleTimeString()}` : 'No successful polls yet';
  const leaderboardTotalScore = leaderboard.reduce((sum, entry) => sum + (entry.score ?? 0), 0);

  if (showScoreboard) {
    return (
      <section className="fixed inset-0 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(139,92,246,0.2),transparent_40%),linear-gradient(140deg,#020617,#0b1120,#172554)] p-8 text-slate-100 lg:p-14">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-8">
          <header className="rounded-[2rem] border border-cyan-200/30 bg-white/5 p-8 shadow-[0_0_60px_rgba(14,165,233,0.13)] backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/90">Digital University Quiz</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight lg:text-7xl">Live Scoreboard</h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border border-cyan-100/35 bg-cyan-400/12 px-4 py-1.5">Session: {sessionId || '—'}</span>
              <span className="rounded-full border border-blue-100/35 bg-blue-400/12 px-4 py-1.5">{leaderboard.length} Teams</span>
              <span className="rounded-full border border-violet-100/35 bg-violet-400/12 px-4 py-1.5">{leaderboardTotalScore} Total Points</span>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-200/25 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-200/70">Current Question State</p>
              <p className="mt-2 text-3xl font-extrabold">{state}</p>
            </div>
            <div className="rounded-2xl border border-cyan-200/25 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-200/70">Now Answering</p>
              <p className="mt-2 text-3xl font-extrabold">{activeTeamName}</p>
            </div>
            <div className="rounded-2xl border border-cyan-200/25 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-blue-200/70">Sync</p>
              <p className="mt-2 text-lg font-semibold">{isReconnecting ? 'Reconnecting…' : `Online • ${pollStatus}`}</p>
            </div>
          </div>

          <ol className="space-y-4">
            {leaderboard.map((entry, index) => (
              <li
                key={`${entry.teamName}-${index}`}
                className={`flex items-center justify-between rounded-2xl border px-6 py-4 text-2xl ${
                  index === 0
                    ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-50 shadow-[0_0_45px_rgba(34,211,238,0.28)]'
                    : 'border-cyan-100/20 bg-white/5 backdrop-blur'
                }`}
              >
                <span className="font-bold">#{index + 1} {entry.teamName ?? 'Unknown team'}</span>
                <span className="text-3xl font-black tabular-nums text-cyan-200">{entry.score ?? 0}</span>
              </li>
            ))}
            {leaderboard.length === 0 && (
              <li className="rounded-2xl border border-cyan-100/20 bg-white/5 px-6 py-5 text-blue-100/75">No leaderboard data yet.</li>
            )}
          </ol>
        </div>
      </section>
    );
  }

  const showQuestion = Boolean(currentQuestionId && questionText && questionOptions.length > 0);
  const shouldShowTimer = state === 'LIVE' && showQuestion;

  return (
    <section className="fixed inset-0 overflow-y-auto bg-[radial-gradient(circle_at_20%_5%,rgba(56,189,248,0.2),transparent_35%),radial-gradient(circle_at_80%_90%,rgba(139,92,246,0.2),transparent_38%),linear-gradient(160deg,#020617,#0b1120,#1e1b4b)] p-8 text-slate-100 lg:p-14">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col items-center justify-center gap-8">
        <div className="w-full max-w-md">
          <AIHostAvatar isSpeaking={isSpeaking} size="h-[22rem] w-full" />
          <p className="mt-3 text-center text-sm font-medium tracking-wide text-cyan-200/90">AI Host {isSpeaking ? 'Speaking…' : 'Standing by'}</p>
        </div>

        {!showQuestion ? (
          <div className="w-full max-w-4xl animate-pulse rounded-[2rem] border border-cyan-100/20 bg-white/5 p-10 text-center shadow-[0_0_45px_rgba(14,165,233,0.18)] backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Question Loading</p>
            <h2 className="mt-5 text-4xl font-black lg:text-6xl">Preparing your next question…</h2>
            <p className="mt-4 text-lg text-slate-300">Waiting for the next question data…</p>
          </div>
        ) : (
          <div className="w-full max-w-6xl animate-in fade-in zoom-in rounded-[2rem] border border-cyan-100/20 bg-white/5 p-8 shadow-[0_0_55px_rgba(14,165,233,0.16)] backdrop-blur-xl duration-500">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-cyan-200/40 bg-cyan-500/10 px-5 py-2 text-sm font-bold uppercase tracking-wider text-cyan-100">{state}</span>
              <span className="rounded-full border border-violet-300/40 bg-violet-500/10 px-5 py-2 text-sm font-semibold text-violet-100">Answering Team: {activeTeamName}</span>
              {shouldShowTimer && (
                <span className="rounded-xl border border-emerald-300/45 bg-emerald-500/10 px-5 py-2 text-2xl font-black tabular-nums text-emerald-200">{countdown === null ? '—' : `${countdown}s`}</span>
              )}
            </div>

            {isQuestionLoading && (
              <p className="mb-3 text-sm text-cyan-200/85">AI host is reading the question…</p>
            )}

            <h2 className="text-4xl font-bold leading-tight lg:text-6xl">{questionText ?? 'Waiting for question...'}</h2>

            <ul className="mt-8 grid gap-4 lg:grid-cols-2">
              {questionOptions.map((option, index) => {
                const isCorrect = state === 'REVEALED' && correctOptionIndex === index;
                return (
                  <li
                    key={`${index}-${option.key}-${option.text}`}
                    className={`rounded-xl border px-5 py-4 text-2xl font-semibold transition-all duration-300 lg:text-3xl ${
                      isCorrect
                        ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100'
                        : 'border-cyan-100/20 bg-slate-900/55 text-slate-100'
                    }`}
                  >
                    <span className="mr-3 text-slate-400">{option.key}.</span>
                    {option.text}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-rose-300">{error}</p>}
      </div>
    </section>
  );
}
