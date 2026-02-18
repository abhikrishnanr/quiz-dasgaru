'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import AIHostAvatar from '@/src/components/AIHostAvatar';
import { useAudioController } from '@/src/hooks/useAudioController';
import { getJson } from '@/src/lib/api/http';
import { publicApi } from '@/src/lib/api/public';
import { constructVerdict } from '@/src/lib/constants';
import { emitToast } from '@/src/lib/ui/toast';
import { generateCommentary, getTTSAudio, type TTSAudioPayload } from '@/src/services/aiService';

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
      text: typeof option.text === 'string' ? option.text : '',
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

export default function DisplayPage() {
  const [sessionId, setSessionId] = useState('');
  const [current, setCurrent] = useState<CurrentResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);
  const [visibleQuestionId, setVisibleQuestionId] = useState<string | null>(null);
  const [tickNow, setTickNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const lastToastAtRef = useRef(0);
  const introPlayedRef = useRef(false);
  const announcedResultRef = useRef<string | null>(null);
  const pendingQuestionRef = useRef<string | null>(null);
  const announcedTenSecondRef = useRef<string | null>(null);
  const lastScoreboardModeRef = useRef(false);

  const { isSpeaking, playSequence, speak } = useAudioController();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionId(params.get('sessionId')?.trim() ?? '');
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
        setError(null);
      } catch {
        if (!mounted) return;

        if (Date.now() - lastToastAtRef.current > 12_000) {
          lastToastAtRef.current = Date.now();
          emitToast({
            level: 'error',
            title: 'Network issue while polling quiz state',
            message: 'Safe mode active. Retrying automatically every 700ms.',
          });
        }

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
        if (!mounted) return;
        setShowScoreboard(Boolean(response.showScoreboard));
      } catch {
        // No-op fallback
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
        if (mounted) setLeaderboard([]);
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

  const state = current?.state ?? 'PREVIEW';
  const activeTeamName = current?.activeTeamName ?? 'Team';
  const correctOptionIndex = current?.question?.correctOptionIndex;
  const questionOptions = (current?.question?.options ?? []).map((option, index) => normalizeDisplayOption(option, index));

  const currentQuestionId =
    current?.question?.id ??
    (current?.question?.text ? `${current.question.text}-${questionOptions.map((option) => option.text).join('|')}` : null);

  useEffect(() => {
    if (!currentQuestionId || !current?.question?.text || questionOptions.length === 0) return;
    if (pendingQuestionRef.current === currentQuestionId || visibleQuestionId === currentQuestionId) return;

    pendingQuestionRef.current = currentQuestionId;
    setIsQuestionLoading(true);

    const optionsText = questionOptions.map((option) => `${option.key}. ${option.text}`).join('. ');
    const questionPrompt = `Question for ${activeTeamName}. ${current.question.text}. Options are ${optionsText}.`;

    void (async () => {
      await speak(questionPrompt);
      setVisibleQuestionId(currentQuestionId);
      setIsQuestionLoading(false);
      pendingQuestionRef.current = null;
      announcedTenSecondRef.current = null;
    })();
  }, [activeTeamName, current?.question?.text, currentQuestionId, questionOptions, speak, visibleQuestionId]);

  const countdown = useMemo(() => {
    const startedAtMs = toEpochMs(current?.questionStartedAt);
    const durationSec = current?.timerDurationSec;
    if (!startedAtMs || !durationSec) return null;

    const elapsedMs = (current?.serverNowEpochMs ?? tickNow) - startedAtMs;
    return Math.max(0, Math.ceil(durationSec - elapsedMs / 1000));
  }, [current?.questionStartedAt, current?.serverNowEpochMs, current?.timerDurationSec, tickNow]);

  useEffect(() => {
    if (countdown !== 10 || !currentQuestionId) return;
    if (announcedTenSecondRef.current === currentQuestionId) return;

    announcedTenSecondRef.current = currentQuestionId;
    void speak('10 seconds remaining.');
  }, [countdown, currentQuestionId, speak]);

  useEffect(() => {
    if (!showScoreboard || lastScoreboardModeRef.current === showScoreboard) {
      lastScoreboardModeRef.current = showScoreboard;
      return;
    }

    const lines = leaderboard.slice(0, 3).map((entry, index) => `${index + 1}. ${entry.teamName ?? 'Unknown team'} with ${entry.score ?? 0} points`);
    const summary = lines.length
      ? `Scoreboard is now visible. Current standings: ${lines.join('. ')}.`
      : 'Scoreboard is now visible. Scores will appear shortly.';

    void speak(summary);
    lastScoreboardModeRef.current = showScoreboard;
  }, [leaderboard, showScoreboard, speak]);

  useEffect(() => {
    if (state !== 'REVEALED' || correctOptionIndex === undefined) return;

    const resultSignature = `${currentQuestionId}-${correctOptionIndex}-${current?.selectedOptionIndex ?? 'NA'}`;
    if (announcedResultRef.current === resultSignature) return;
    announcedResultRef.current = resultSignature;

    const selectedOption = current?.selectedOptionIndex !== undefined ? questionOptions[current.selectedOptionIndex]?.key : undefined;
    const correctOption = questionOptions[correctOptionIndex]?.key ?? String.fromCharCode(65 + correctOptionIndex);
    const isCorrect = current?.selectedOptionIndex === correctOptionIndex;
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
  }, [activeTeamName, correctOptionIndex, current?.selectedOptionIndex, currentQuestionId, playSequence, questionOptions, state]);

  const showQuestion = Boolean(visibleQuestionId && visibleQuestionId === currentQuestionId);
  const remainingTime = countdown === null ? '—' : `${countdown}s`;

  return (
    <section className="fixed inset-0 overflow-hidden bg-slate-950 text-slate-100">
      <div className="grid h-full grid-cols-12">
        <aside className="col-span-4 flex flex-col items-center justify-center border-r border-slate-800 bg-gradient-to-b from-slate-950 to-slate-900 p-8">
          <div className="w-full max-w-sm">
            <AIHostAvatar isSpeaking={isSpeaking} size="h-[28rem] w-full" />
            <p className="mt-4 text-center text-base text-cyan-200">DUK Core {isSpeaking ? 'Speaking…' : 'Standing by'}</p>
          </div>
        </aside>

        <main className="col-span-8 flex h-full flex-col p-8 lg:p-12">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-200">{state}</span>
            <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-purple-200">Team: {activeTeamName}</span>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-200">Remaining: {remainingTime}</span>
          </div>

          <div className="mt-8 flex-1">
            {!showQuestion || isQuestionLoading ? (
              <div className="flex h-full items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/70 p-10">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Question Loading</p>
                  <h2 className="mt-4 text-4xl font-black leading-tight text-white lg:text-6xl">Please wait. DUK Core is preparing the question…</h2>
                </div>
              </div>
            ) : (
              <div className="h-full animate-in fade-in zoom-in duration-500 rounded-3xl border border-slate-800 bg-slate-900/70 p-8">
                <h2 className="text-4xl font-bold leading-tight lg:text-5xl">{current?.question?.text ?? 'Waiting for question...'}</h2>

                <ul className="mt-8 grid gap-4 md:grid-cols-2">
                  {questionOptions.map((option, index) => {
                    const isCorrect = state === 'REVEALED' && correctOptionIndex === index;
                    return (
                      <li
                        key={`${index}-${option.key}-${option.text}`}
                        className={`rounded-2xl border px-5 py-4 text-2xl font-semibold transition-all duration-300 ${
                          isCorrect ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100' : 'border-slate-700 bg-slate-800/80 text-slate-100'
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
          </div>

          {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
        </main>
      </div>

      {showScoreboard && (
        <div className="absolute inset-0 z-50 bg-blue-950/92 backdrop-blur-sm">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col p-8 lg:p-12">
            <div className="rounded-3xl border border-blue-300/30 bg-blue-900/30 p-6">
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/85">Live Overlay</p>
              <h1 className="mt-3 text-5xl font-black tracking-tight text-white lg:text-7xl">Scoreboard</h1>
              <p className="mt-2 text-blue-100/80">Session {sessionId || '—'}</p>
            </div>

            <ol className="mt-8 grid flex-1 auto-rows-min gap-4 overflow-y-auto">
              {leaderboard.map((entry, index) => (
                <li
                  key={`${entry.teamName}-${index}`}
                  className={`flex items-center justify-between rounded-2xl border px-6 py-5 text-2xl ${
                    index === 0
                      ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-50 shadow-[0_0_40px_rgba(34,211,238,0.25)]'
                      : 'border-blue-200/25 bg-blue-900/30 text-blue-50'
                  }`}
                >
                  <span className="font-bold">#{index + 1} {entry.teamName ?? 'Unknown team'}</span>
                  <span className="text-3xl font-black tabular-nums text-cyan-200">{entry.score ?? 0}</span>
                </li>
              ))}
              {leaderboard.length === 0 && (
                <li className="rounded-2xl border border-blue-200/25 bg-blue-900/30 px-6 py-5 text-blue-100/80">No leaderboard data yet.</li>
              )}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
