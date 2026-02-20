'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAudioController } from '@/src/hooks/useAudioController';
import AIHostAvatar from '@/src/components/AIHostAvatar';
import { formatTeamName } from '@/src/lib/format';

export default function DisplayPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorPayload, setErrorPayload] = useState<any>(null);
  const [lastAnnouncedQuestionKey, setLastAnnouncedQuestionKey] = useState('');
  const isAnnouncingRef = useRef(false);
  const isSpeakingHostRef = useRef(false);
  const revealAnnouncementKeyRef = useRef('');
  const lowTimeWarningQuestionRef = useRef('');
  const lockAnnouncementKeyRef = useRef('');
  const [isScorePanelOpen, setIsScorePanelOpen] = useState(false);
  const [hostTranscript, setHostTranscript] = useState<string[]>([]);
  const { speak, isFetching, isSpeaking, unlock } = useAudioController();
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const handleUnlockAudio = useCallback(async () => {
    try {
      await unlock();
      console.log('[Display] Audio unlocked by user interaction.');
    } catch { /* ignore */ }
    setAudioUnlocked(true);
  }, [unlock]);

  const pushHostLine = useCallback((line: string) => {
    const normalizedLine = line.trim();
    if (!normalizedLine) return;

    setHostTranscript((previous) => {
      const next = [...previous, normalizedLine];
      return next.slice(-6);
    });
  }, []);

  const speakHostLine = useCallback(async (line: string) => {
    if (isSpeakingHostRef.current || isFetching || isSpeaking) {
      return false;
    }

    isSpeakingHostRef.current = true;
    try {
      const played = await speak(line);
      if (played) {
        pushHostLine(line);
      }
      return played;
    } finally {
      isSpeakingHostRef.current = false;
    }
  }, [isFetching, isSpeaking, pushHostLine, speak]);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/display/${token}`);
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          setErrorPayload(errJson);

          if (res.status === 404) setError('Session Not Found');
          else if (res.status === 403) setError('Unauthorized Access');
          else setError('Failed to load data');
          return;
        }
        const result = await res.json();
        setData(result);
        setError('');
        setErrorPayload(null);
      } catch (err) {
        console.error(err);
        setError('Network Error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 1000); // Auto-refresh every 1s for near-live display
    return () => clearInterval(interval);
  }, [token]);

  // Timer state for display
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setCurrentTimeMs(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  const session = data?.session;
  const currentQuestion = data?.currentQuestion;
  const leaderboard = data?.leaderboard ?? [];
  const recentAnswers = data?.recentAnswers ?? [];
  const isLive = session?.questionState === 'LIVE';
  const isLocked = session?.questionState === 'LOCKED';
  const isRevealed = session?.questionState === 'REVEALED';
  const startedAt = session?.questionStartedAt;
  const duration = session?.timerDurationSec || 20;

  useEffect(() => {
    if (!audioUnlocked) return; // Wait for user gesture
    if (!currentQuestion || !session) {
      return;
    }

    // Allow reading in 'LIVE' or any other active state (like 'READY'), but skip if finished.
    if (session.questionState === 'LOCKED' || session.questionState === 'REVEALED') {
      return;
    }

    // Use questionId, text, AND concernTeamId as the unique key.
    // Fall back to text if id is undefined (prevents all questions sharing the same key).
    const questionKey = `${currentQuestion.id ?? currentQuestion.text ?? 'unknown'}-${session.concernTeamId || 'all'}`;
    if (questionKey === lastAnnouncedQuestionKey) {
      return;
    }

    // Prevent overlapping announcements if one is already in progress
    if (isAnnouncingRef.current) {
      return;
    }

    const teamName = formatTeamName(session.concernTeamName) || 'all teams';
    const optionSpeech = Array.isArray(currentQuestion.options)
      ? currentQuestion.options.map((opt: any) => `${opt.key}. ${opt.text}`).join('. ')
      : '';

    const intro = `Question is for ${teamName}.`;
    const message = `${intro} Question: ${currentQuestion.text}. Options: ${optionSpeech}.`;

    isAnnouncingRef.current = true;
    speakHostLine(message).then((played) => {
      isAnnouncingRef.current = false;
      if (played) {
        setLastAnnouncedQuestionKey(questionKey);
        console.info('[Display TTS] Auto announcement success:', questionKey);
      } else {
        console.warn('[Display TTS] Announcement failed/skipped — will retry on next poll:', questionKey);
      }
    });

  }, [audioUnlocked, currentQuestion, duration, lastAnnouncedQuestionKey, session, speakHostLine]);

  // Report audio status to the server so admin page can show progress
  const sessionId = data?.session?.sessionId;
  const reportAudioStatus = useCallback(async (status: string, message: string) => {
    if (!sessionId) return;
    try {
      await fetch('/api/audio-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, status, message }),
      });
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => {
    if (isFetching && !isSpeaking) {
      reportAudioStatus('FETCHING', 'Generating audio from ElevenLabs TTS…');
    } else if (isSpeaking) {
      reportAudioStatus('SPEAKING', 'AI Host is speaking…');
    } else {
      reportAudioStatus('IDLE', '');
    }
  }, [isFetching, isSpeaking, reportAudioStatus]);

  // Calc remaining time
  let remaining = 0;
  if (isLive && startedAt) {
    const elapsed = (currentTimeMs - startedAt) / 1000;
    remaining = Math.max(0, Math.ceil(duration - elapsed));
  }

  const latestHostLine = hostTranscript.length ? hostTranscript[hostTranscript.length - 1] : '';

  // UI-only derived labels (no logic changes)
  const roundLabel =
    (currentQuestion?.roundType as string | undefined) ||
    (session?.gameMode as string | undefined) ||
    (session?.questionState as string | undefined) ||
    'ROUND';

  // Determine if concern team answered incorrectly
  const concernTeamAnswer = session?.concernTeamId
    ? recentAnswers?.find((a: any) => a.teamId === session.concernTeamId)
    : null;
  const showWrongAnswer =
    isRevealed &&
    session?.gameMode === 'STANDARD' &&
    session?.concernTeamId &&
    concernTeamAnswer &&
    concernTeamAnswer.selectedKey !== currentQuestion?.correctAnswer;

  const concernTeamName = formatTeamName(session?.concernTeamName) || 'Concerned Team';

  useEffect(() => {
    if (!audioUnlocked || !isLive || !currentQuestion || !session?.concernTeamId || !concernTeamAnswer) return;

    const questionKey = `${currentQuestion.id ?? currentQuestion.text ?? 'unknown'}-${session.concernTeamId}`;
    const lockKey = `${questionKey}-${concernTeamAnswer.action}-${concernTeamAnswer.selectedKey ?? ''}`;
    if (lockAnnouncementKeyRef.current === lockKey) return;

    const teamLabel = formatTeamName(concernTeamAnswer.teamName) || concernTeamName;
    const lockMessage = concernTeamAnswer.action === 'PASS'
      ? `${teamLabel}, PASS submitted.`
      : concernTeamAnswer.action === 'BUZZ'
        ? `${teamLabel}, BUZZ received.`
        : `${teamLabel} locked option ${concernTeamAnswer.selectedKey}.`;

    speakHostLine(lockMessage).then((played) => {
      if (played) {
        lockAnnouncementKeyRef.current = lockKey;
      }
    });
  }, [audioUnlocked, concernTeamAnswer, concernTeamName, currentQuestion, isLive, session?.concernTeamId, speakHostLine]);

  useEffect(() => {
    if (!audioUnlocked || !isLive || !currentQuestion || !session?.concernTeamId) return;

    const questionKey = `${currentQuestion.id ?? currentQuestion.text ?? 'unknown'}-${session.concernTeamId}`;

    // Don't play low-time warning once the concern team has already submitted.
    if (concernTeamAnswer) {
      lowTimeWarningQuestionRef.current = questionKey;
      return;
    }

    if (remaining >= 10 || remaining <= 0) {
      if (remaining >= 10) {
        lowTimeWarningQuestionRef.current = '';
      }
      return;
    }

    if (lowTimeWarningQuestionRef.current === questionKey) return;

    const warningMessage = `TIME IS RUNNING OUT FOR ${concernTeamName.toUpperCase()}! LOCK IT IN NOW!`;
    speakHostLine(warningMessage).then((played) => {
      if (played) {
        lowTimeWarningQuestionRef.current = questionKey;
      }
    });
  }, [audioUnlocked, concernTeamAnswer, concernTeamName, currentQuestion, isLive, remaining, session?.concernTeamId, speakHostLine]);

  useEffect(() => {
    if (!audioUnlocked || !isRevealed || !currentQuestion || !session?.concernTeamId || !concernTeamAnswer) return;

    const revealKey = `${currentQuestion.id ?? currentQuestion.text ?? 'unknown'}-${session.concernTeamId}-${concernTeamAnswer.selectedKey}-${currentQuestion.correctAnswer}`;
    if (revealAnnouncementKeyRef.current === revealKey) return;

    const isCorrectSelection = concernTeamAnswer.selectedKey === currentQuestion.correctAnswer;
    const correctOption = Array.isArray(currentQuestion.options)
      ? currentQuestion.options.find((opt: any) => opt?.key === currentQuestion.correctAnswer)
      : null;
    const correctAnswerLine = correctOption
      ? `The right answer is ${correctOption.key}. ${correctOption.text}.`
      : `The right answer is ${currentQuestion.correctAnswer}.`;

    const selectedLine = concernTeamAnswer.selectedKey
      ? `${concernTeamName} locked option ${concernTeamAnswer.selectedKey}.`
      : `${concernTeamName} submitted an answer.`;

    const revealMessage = isCorrectSelection
      ? `${selectedLine} That is the right answer.`
      : `${selectedLine} That is wrong. ${correctAnswerLine}`;

    speakHostLine(revealMessage).then((played) => {
      if (played) {
        revealAnnouncementKeyRef.current = revealKey;
      }
    });
  }, [audioUnlocked, concernTeamAnswer, concernTeamName, currentQuestion, isRevealed, session?.concernTeamId, speakHostLine]);

  if (loading && !data && !error) {
    return (
      <div className="display-scope min-h-screen w-full bg-[#071027] text-white grid place-items-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#071027]" />
          <div className="absolute inset-0 opacity-90 [background-image:radial-gradient(1.6px_1.6px_at_20px_30px,rgba(255,255,255,0.85),transparent),radial-gradient(1px_1px_at_90px_150px,rgba(120,200,255,0.9),transparent),radial-gradient(1px_1px_at_170px_80px,rgba(120,120,255,0.9),transparent),radial-gradient(1px_1px_at_220px_160px,rgba(90,240,255,0.9),transparent)] [background-size:240px_240px] animate-[stardustDrift_80s_linear_infinite]" />
          <div className="absolute inset-0 opacity-55 [background-image:radial-gradient(1px_1px_at_30px_40px,rgba(255,255,255,0.9),transparent),radial-gradient(1px_1px_at_110px_110px,rgba(120,240,255,0.9),transparent),radial-gradient(1px_1px_at_190px_210px,rgba(160,160,255,0.85),transparent)] [background-size:170px_170px] animate-[stardustDrift_60s_linear_infinite_reverse]" />
          <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(1px_1px_at_12px_18px,rgba(255,255,255,0.95),transparent),radial-gradient(1px_1px_at_72px_92px,rgba(255,255,255,0.75),transparent)] [background-size:120px_120px] animate-[stardustTwinkle_6s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(80,170,255,0.18),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(120,120,255,0.14),transparent_55%),radial-gradient(circle_at_55%_80%,rgba(80,240,255,0.10),transparent_55%)]" />
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full border border-white/10 bg-white/5 grid place-items-center shadow-[0_0_40px_rgba(120,200,255,0.18)]">
            <div className="h-6 w-6 rounded-full border-2 border-white/25 border-t-cyan-200 animate-spin" />
          </div>
          <div className="text-xs font-black uppercase tracking-[0.36em] text-white/70">Loading Display…</div>
        </div>

        <style jsx global>{`
          @keyframes stardustDrift {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(-240px, -360px, 0); }
          }
          @keyframes stardustTwinkle {
            0%, 100% { opacity: 0.22; }
            50% { opacity: 0.5; }
          }
          .display-scope {
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji',
              'Segoe UI Emoji';
            letter-spacing: normal;
          }
          .display-scope :where(*) { box-sizing: border-box; }
          .display-scope :where(h1,h2,h3,h4,h5,h6,p,span,button,table,th,td,div) { margin: 0; }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="display-scope min-h-screen w-full bg-[#071027] text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[#071027]" />
          <div className="absolute inset-0 opacity-90 [background-image:radial-gradient(1.6px_1.6px_at_20px_30px,rgba(255,255,255,0.85),transparent),radial-gradient(1px_1px_at_90px_150px,rgba(120,200,255,0.9),transparent),radial-gradient(1px_1px_at_170px_80px,rgba(120,120,255,0.9),transparent)] [background-size:240px_240px] animate-[stardustDrift_80s_linear_infinite]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(80,170,255,0.18),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(120,120,255,0.14),transparent_55%)]" />
        </div>

        <div className="relative z-10 min-h-screen w-full grid place-items-center">
          <div className="w-full max-w-2xl px-6">
            <div className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_80px_rgba(120,200,255,0.12)] p-10 relative overflow-hidden">
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-300/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-indigo-400/10 rounded-full blur-3xl" />

              <div className="relative">
                <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">Display Error</div>
                <div className="mt-4 text-4xl font-black tracking-tight text-white">{error}</div>

                {errorPayload?.sessionId && (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="text-[10px] font-black uppercase tracking-[0.35em] text-white/45">Attempted Session ID</div>
                    <div className="mt-2 text-2xl font-mono font-black text-cyan-200">{errorPayload.sessionId}</div>
                  </div>
                )}

                <div className="mt-6 text-white/65 leading-relaxed">
                  {errorPayload?.error === 'DYNAMO_404' ? (
                    <p>This session code was not found. Ask the host to create the session and verify the link.</p>
                  ) : errorPayload?.error === 'TOKEN_INVALID' ? (
                    <p>The security token for this session is invalid. Please request a fresh display link.</p>
                  ) : (
                    <p>Something went wrong while fetching the session. Check connectivity and try again.</p>
                  )}
                </div>

                <button
                  onClick={() => window.location.reload()}
                  className="mt-8 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/8 px-8 py-4 text-xs font-black uppercase tracking-[0.28em] text-white hover:bg-white/12 transition shadow-[0_0_40px_rgba(120,200,255,0.10)]"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        <style jsx global>{`
          @keyframes stardustDrift {
            from { transform: translate3d(0, 0, 0); }
            to { transform: translate3d(-240px, -360px, 0); }
          }
          .display-scope {
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji',
              'Segoe UI Emoji';
            letter-spacing: normal;
          }
          .display-scope :where(*) { box-sizing: border-box; }
          .display-scope :where(h1,h2,h3,h4,h5,h6,p,span,button,table,th,td,div) { margin: 0; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="display-scope relative min-h-screen w-full overflow-hidden bg-[#071027] text-white">
      {/* ─── Wrong Answer Overlay ─── */}
      {showWrongAnswer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-500">
          <div className="bg-red-600/90 backdrop-blur-md border-y-8 border-red-400 text-white text-6xl md:text-8xl font-black uppercase tracking-widest px-20 py-16 shadow-[0_0_150px_rgba(220,38,38,0.8)] transform -rotate-2">
            WRONG ANSWER
          </div>
        </div>
      )}

      {/* ─── Audio Unlock Overlay ─── */}
      {!audioUnlocked && (
        <div
          className="absolute inset-0 z-[99] flex flex-col items-center justify-center cursor-pointer"
          onClick={handleUnlockAudio}
          style={{ background: 'rgba(7,16,39,0.96)', backdropFilter: 'blur(8px)' }}
        >
          {/* stardust behind the card */}
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(1.5px_1.5px_at_30px_40px,rgba(255,255,255,0.85),transparent),radial-gradient(1px_1px_at_110px_110px,rgba(103,232,249,0.9),transparent)] [background-size:170px_170px] animate-[stardustDrift_58s_linear_infinite_reverse]" />
          <div className="relative text-center space-y-8 max-w-md px-8">
            <div className="text-[80px] leading-none drop-shadow-[0_0_40px_rgba(90,220,255,0.35)] animate-pulse">🔊</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/45 mb-3">DUK Bodhini Quiz</div>
              <h2 className="text-4xl font-black tracking-tight text-white">Tap to Enable Audio</h2>
              <p className="mt-3 text-white/55 text-base font-medium">One-time activation required by your browser to allow voice announcements.</p>
            </div>
            <button
              onClick={handleUnlockAudio}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-black py-5 px-12 rounded-full text-lg transition-all transform hover:scale-105 shadow-[0_0_60px_rgba(90,220,255,0.30)]"
            >
              <span className="text-2xl">▶</span> Start Audio
            </button>
          </div>
        </div>
      )}
      {/* FULL-PAGE Stardust + Nebula (higher contrast) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[#071027]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(80,170,255,0.20),transparent_52%),radial-gradient(circle_at_82%_22%,rgba(130,120,255,0.16),transparent_55%),radial-gradient(circle_at_60%_82%,rgba(80,240,255,0.12),transparent_58%)]" />

        <div className="absolute inset-0 opacity-95 [background-image:radial-gradient(1.7px_1.7px_at_20px_30px,rgba(255,255,255,0.92),transparent),radial-gradient(1.1px_1.1px_at_90px_150px,rgba(125,211,252,0.98),transparent),radial-gradient(1.1px_1.1px_at_170px_80px,rgba(129,140,248,0.95),transparent),radial-gradient(1.1px_1.1px_at_220px_160px,rgba(56,189,248,0.98),transparent)] [background-size:240px_240px] animate-[stardustDrift_78s_linear_infinite]" />
        <div className="absolute inset-0 opacity-62 [background-image:radial-gradient(1px_1px_at_30px_40px,rgba(255,255,255,0.95),transparent),radial-gradient(1px_1px_at_110px_110px,rgba(103,232,249,0.95),transparent),radial-gradient(1px_1px_at_190px_210px,rgba(129,140,248,0.92),transparent)] [background-size:170px_170px] animate-[stardustDrift_58s_linear_infinite_reverse]" />
        <div className="absolute inset-0 opacity-38 [background-image:radial-gradient(1px_1px_at_12px_18px,rgba(255,255,255,0.98),transparent),radial-gradient(1px_1px_at_72px_92px,rgba(255,255,255,0.80),transparent)] [background-size:120px_120px] animate-[stardustTwinkle_6s_ease-in-out_infinite]" />

        {/* soft vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(0,0,0,0.35)_100%)]" />
      </div>

      {/* TOP HUD */}
      <div className="fixed left-6 top-6 z-40 flex items-center gap-4">
        <div className="hudPill flex items-center gap-3 rounded-full border border-white/10 bg-white/6 backdrop-blur-xl px-5 py-3 shadow-[0_0_60px_rgba(90,220,255,0.10)]">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_22px_rgba(52,211,153,0.45)] animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.36em] text-emerald-200/85">System Active</span>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <span className="text-[13px] md:text-[14px] font-black uppercase tracking-[0.12em]">
            DUK <span className="bodhiniText">BODHINI</span>
          </span>
        </div>
      </div>

      <div className="fixed right-6 top-6 z-40 flex items-center gap-4">
        {/* Scoreboard */}
        <button
          type="button"
          onClick={() => setIsScorePanelOpen((prev) => !prev)}
          className="hudPill rounded-full border border-white/10 bg-white/6 backdrop-blur-xl px-6 py-3 text-[10px] font-black uppercase tracking-[0.32em] text-white/90 hover:bg-white/10 transition shadow-[0_0_60px_rgba(90,220,255,0.10)]"
        >
          {isScorePanelOpen ? 'Hide Scores' : 'Scores'}
        </button>

        {/* Round */}
        <div className="hudPill rounded-full border border-white/10 bg-white/6 backdrop-blur-xl px-6 py-3 text-[10px] font-black uppercase tracking-[0.32em] text-white/90 shadow-[0_0_60px_rgba(90,220,255,0.10)]">
          {String(roundLabel).replaceAll('_', ' ')} ROUND
        </div>
      </div>

      {/* Countdown (top center) */}
      {isLive && (
        <div className="fixed left-1/2 -translate-x-1/2 top-6 z-40">
          <div className="hudPill flex items-center gap-3 rounded-full border border-white/10 bg-white/6 backdrop-blur-xl px-6 py-3 shadow-[0_0_70px_rgba(90,220,255,0.14)]">
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.45)] animate-pulse" />
            <span className="text-2xl md:text-3xl font-mono font-black text-cyan-100 tabular-nums drop-shadow-[0_10px_30px_rgba(0,0,0,0.55)]">
              00:{String(remaining).padStart(2, '0')}
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.36em] text-white/55">Time</span>
          </div>
        </div>
      )}

      {/* SCORE PANEL (logic unchanged, styling tuned to match HUD) */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-3xl border-l border-white/10 bg-[#071027]/92 backdrop-blur-2xl shadow-[0_0_120px_rgba(90,220,255,0.10)] transform transition-transform duration-300 ${isScorePanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="h-full overflow-y-auto p-6 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase text-white/90">Score Panel</h2>
            <button
              type="button"
              onClick={() => setIsScorePanelOpen(false)}
              className="rounded-full border border-white/10 bg-white/6 px-5 py-2 text-[10px] font-black uppercase tracking-[0.32em] text-white/85 hover:bg-white/10 transition"
            >
              Close
            </button>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/6 border-b border-white/10 text-[10px] uppercase tracking-[0.2em] text-white/55 font-black">
                    <th className="px-6 py-4 w-20 text-center">Rank</th>
                    <th className="px-6 py-4">Team</th>
                    <th className="px-6 py-4 text-right">Standard</th>
                    <th className="px-6 py-4 text-right">Buzzer</th>
                    <th className="px-6 py-4 text-right bg-cyan-200/5 text-cyan-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {leaderboard.map((team: any, index: number) => (
                    <tr key={index} className="transition-all duration-300 hover:bg-white/6">
                      <td className="px-6 py-5 text-center font-mono font-black text-white/55">{index + 1}</td>
                      <td className="px-6 py-5">
                        <div className="font-black text-white text-lg md:text-xl tracking-tight">{formatTeamName(team.name)}</div>
                      </td>
                      <td className="px-6 py-5 text-right font-mono text-white/65 text-lg">{team.standard}</td>
                      <td className="px-6 py-5 text-right font-mono text-white/65 text-lg">{team.buzzer}</td>
                      <td className="px-6 py-5 text-right font-mono font-black text-xl md:text-2xl text-cyan-100 bg-cyan-200/[0.05]">
                        {team.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </aside>

      {isScorePanelOpen && (
        <button
          type="button"
          aria-label="Close score panel backdrop"
          onClick={() => setIsScorePanelOpen(false)}
          className="fixed inset-0 z-40 bg-black/55"
        />
      )}

      {/* MAIN LAYOUT (match screenshot: left HUD avatar + right question panel, blended seam) */}
      <main className="relative z-10 w-full h-screen">
        <div className="flex h-full w-full">
          {/* LEFT: Avatar lane */}
          <section className="relative h-full w-full lg:w-[35%]">
            <div className="absolute inset-0">
              <AIHostAvatar isSpeaking={isSpeaking} size="lg" />
            </div>

            {/* subtle overlay to keep avatar integrated */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(90,220,255,0.12),transparent_58%)]" />

            {/* bottom-left system ready pill (like screenshot) */}
            <div className="absolute left-10 bottom-10">
              <div className="hudPill rounded-full border border-white/10 bg-white/6 backdrop-blur-xl px-8 py-4 shadow-[0_0_70px_rgba(90,220,255,0.12)]">
                <div className="text-[12px] font-semibold italic text-white/80">
                  “{latestHostLine ? latestHostLine : 'System Ready'}”
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Question lane */}
          <section className="relative h-full w-full lg:w-[65%]">
            {/* Seam blend: overlap into the avatar lane so the left edge has no obvious cut */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-24 -translate-x-10 bg-gradient-to-r from-transparent via-[#071027]/75 to-[#071027]" />
            <div className="pointer-events-none absolute inset-y-0 left-0 w-40 -translate-x-12 bg-[radial-gradient(circle_at_left,rgba(90,220,255,0.10),transparent_65%)]" />

            {/* content */}
            <div className="relative h-full w-full flex flex-col justify-center px-8 lg:px-14">
              {/* Big question panel (keep screenshot vibe) */}
              <div className="relative rounded-[3.2rem] border border-cyan-200/20 bg-white/[0.03] backdrop-blur-2xl shadow-[0_0_120px_rgba(90,220,255,0.12)] overflow-hidden">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(90,220,255,0.10),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(129,140,248,0.10),transparent_60%)]" />
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

                <div className="relative px-10 py-16 lg:px-14 lg:py-20 text-center">
                  {currentQuestion ? (
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white drop-shadow-[0_18px_50px_rgba(0,0,0,0.55)] animate-[questionGlow_9s_ease-in-out_infinite]">
                      {currentQuestion.text}
                    </h1>
                  ) : (
                    <h1 className="text-3xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white/80 italic">
                      Waiting for next question…
                    </h1>
                  )}
                </div>
              </div>

              {/* Options: 2x2 blocks like screenshot */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                {currentQuestion?.options?.map((opt: any, idx: number) => {
                  const isCorrect = isRevealed && opt.key === currentQuestion.correctAnswer;
                  const isConcernSelection = isRevealed && concernTeamAnswer?.selectedKey === opt.key;
                  const isConcernWrong = isConcernSelection && !isCorrect;

                  return (
                    <div
                      key={opt.key}
                      className={[
                        'optIn relative rounded-[2.6rem] border border-white/10 bg-white/[0.03] backdrop-blur-2xl',
                        'shadow-[0_0_80px_rgba(0,0,0,0.35)]',
                        'transition-transform duration-300 hover:scale-[1.01]',
                        isCorrect ? 'border-emerald-200/45 bg-emerald-500/25' : '',
                        isConcernWrong ? 'border-rose-200/45 bg-rose-500/25' : '',
                      ].join(' ')}
                      style={{ animationDelay: `${idx * 90}ms` }}
                    >
                      <div className="pointer-events-none absolute inset-0 rounded-[2.6rem] bg-[radial-gradient(circle_at_20%_15%,rgba(90,220,255,0.12),transparent_55%),radial-gradient(circle_at_80%_70%,rgba(129,140,248,0.10),transparent_60%)]" />
                      <div className="relative flex items-center gap-6 px-10 py-10">
                        <div className="optBadge h-12 w-12 md:h-14 md:w-14 rounded-2xl flex items-center justify-center font-black text-lg md:text-xl text-white">
                          {opt.key}
                        </div>
                        <div className="flex-1">
                          <div className="text-lg md:text-xl lg:text-2xl font-bold text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.6)]">
                            {opt.text}
                          </div>
                        </div>

                        {isRevealed && (
                          <div className={['text-xl font-black', isCorrect ? 'text-emerald-200' : 'text-rose-200'].join(' ')}>
                            {isCorrect ? '✅' : '❌'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* subtle bottom activity row (kept, but quiet) */}
              <div className="mt-10 flex items-center gap-3 overflow-x-auto scrollbar-hide opacity-75">
                {recentAnswers?.slice(0, 8)?.map((ans: any, idx: number) => (
                  <div
                    key={idx}
                    className="shrink-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3"
                  >
                    <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">👤</div>
                    <div className="min-w-[150px]">
                      <div className="font-black text-white/90 truncate">{formatTeamName(ans.teamName)}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">
                        {ans.action === 'PASS' ? 'PASS' : ans.action === 'BUZZ' ? 'BUZZ' : `OPT ${ans.selectedKey}`}
                      </div>
                    </div>
                  </div>
                ))}

                {(!recentAnswers || recentAnswers.length === 0) && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-white/55 font-bold italic">
                    No activity yet
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* styles */}
      <style jsx global>{`
        @keyframes stardustDrift {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-240px, -360px, 0); }
        }
        @keyframes stardustTwinkle {
          0%, 100% { opacity: 0.22; }
          50% { opacity: 0.55; }
        }
        @keyframes questionGlow {
          0%, 100% { text-shadow: 0 0 22px rgba(125, 211, 252, 0.22), 0 0 44px rgba(129, 140, 248, 0.16); }
          50% { text-shadow: 0 0 28px rgba(125, 211, 252, 0.28), 0 0 58px rgba(129, 140, 248, 0.22); }
        }
        @keyframes optIn {
          from { opacity: 0; transform: translateY(14px) scale(0.99); filter: blur(2px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .optIn { animation: optIn 520ms cubic-bezier(0.2, 0.9, 0.2, 1) both; }

        /* A/B/C/D badge: strong contrast */
        .optBadge {
          background: radial-gradient(circle at 30% 25%, rgba(90,220,255,0.95), rgba(129,140,248,0.60) 55%, rgba(7,16,39,0.35));
          box-shadow:
            0 14px 36px rgba(0,0,0,0.58),
            0 0 44px rgba(90,220,255,0.20),
            0 0 80px rgba(129,140,248,0.12),
            inset 0 0 0 1px rgba(255,255,255,0.16);
          text-shadow: 0 8px 22px rgba(0,0,0,0.55);
        }

        /* HUD pill polish */
        .hudPill {
          box-shadow:
            0 18px 60px rgba(0,0,0,0.30),
            0 0 70px rgba(90,220,255,0.08);
        }

        /* “BODHINI” accent like the screenshot */
        .bodhiniText {
          background: linear-gradient(90deg, rgba(129,140,248,1), rgba(56,189,248,1));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 0 26px rgba(90,220,255,0.14);
        }

        /* Hide scrollbar */
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* Audio status bar animations */
        @keyframes audioBar1 {
          0%, 100% { height: 10px; }
          50% { height: 18px; }
        }
        @keyframes audioBar2 {
          0%, 100% { height: 16px; }
          50% { height: 8px; }
        }
        @keyframes audioBar3 {
          0%, 100% { height: 8px; }
          50% { height: 14px; }
        }

        /* Local reset: prevents app-wide layout/typography bleed */
        .display-scope {
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
          letter-spacing: normal;
        }
        .display-scope :where(*) { box-sizing: border-box; }
        .display-scope :where(h1,h2,h3,h4,h5,h6,p,span,button,table,th,td,div) { margin: 0; }
      `}</style>
    </div>
  );
}
