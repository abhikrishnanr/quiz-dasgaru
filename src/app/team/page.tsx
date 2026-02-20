'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { publicApi } from '@/src/lib/api/public';
import { team } from '@/src/lib/api/team';
import { normalizeSessionId } from '@/src/lib/session-id';
import { emitToast } from '@/src/lib/ui/toast';
import { formatTeamName } from '@/src/lib/format';
import { useQuizTimer } from './hooks/useQuizTimer';
import { RegistrationForm } from './_components/RegistrationForm';
import { QuizView } from './_components/QuizView';
import { QuizCurrentState, Question, TeamRegisterResponse, TeamSubmissionPayload } from './types';

const TEAM_SESSION_KEY = 'quiz-team-session';
const CURRENT_POLL_MS = 1000;

function TeamContent() {
  const searchParams = useSearchParams();
  const sessionId = normalizeSessionId(searchParams.get('sessionId') || '');

  // Registration State
  const [teamId, setTeamId] = useState('');
  const [teamSecret, setTeamSecret] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Quiz State
  const [currentState, setCurrentState] = useState<QuizCurrentState | null>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedQuestionId, setSubmittedQuestionId] = useState<string | null>(null);

  // Restore session
  useEffect(() => {
    const saved = sessionStorage.getItem(TEAM_SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TeamRegisterResponse;
        if (parsed.teamId && parsed.teamSecret) {
          setTeamId(parsed.teamId);
          setTeamSecret(parsed.teamSecret);
        }
      } catch {
        sessionStorage.removeItem(TEAM_SESSION_KEY);
      }
    }
  }, []);

  // Poll for state
  useEffect(() => {
    if (!sessionId || !teamId) return;

    let mounted = true;
    const poll = async () => {
      try {
        let response;
        try {
          response = await publicApi.getCurrent<QuizCurrentState>(sessionId);
        } catch (e) {
          // If primary ID fails, try lowercase fallback just in case backend is case-sensitive and we have a mismatch
          if (e instanceof Error && (e as any).status === 404) {
            const lowerId = sessionId.toLowerCase();
            if (lowerId !== sessionId) {
              response = await publicApi.getCurrent<QuizCurrentState>(lowerId);
              // If successful, we should probably update our local sessionId or just keep using lowerId?
              // For now, let's just use the response.
              // Ideally we'd valid redirect, but let's just make it work.
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }

        if (!mounted) return;
        console.log('Poll Response:', response); // Debugging
        setRegisterError(null); // Clear previous errors if we got a response
        setCurrentState(response);
        setIsLoadingState(false);

        // Reset submitted state if question changes
        const incomingQuestionId = response.question?.id || response.currentQuestion?.id;
        if (incomingQuestionId && incomingQuestionId !== submittedQuestionId) {
          if (!isSubmitting) {
            setSubmittedQuestionId(null);
          }
        }
      } catch (error) {
        // If 404, the session likely doesn't exist or is invalid. 
        if (error instanceof Error && (error as any).status === 404) {
          setRegisterError(`Session '${sessionId}' not found. Check ID & Casing.`);
        } else {
          console.error('Poll error:', error);
        }
      }
    };

    poll();
    const interval = setInterval(poll, CURRENT_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [sessionId, teamId, submittedQuestionId, isSubmitting]);

  // Derived State
  const isRegistered = Boolean(teamId && teamSecret);

  // Robust state derivation
  const sessionData = (currentState?.session as any);
  const rawState = currentState?.state || sessionData?.state || sessionData?.questionState || 'PREVIEW';

  const resolvedState = (currentState?.isLive || rawState === 'LIVE' || rawState === 'PLAYING')
    ? 'LIVE'
    : (currentState?.isLocked || rawState === 'LOCKED')
      ? 'LOCKED'
      : (currentState?.isRevealed || rawState === 'REVEALED' || rawState === 'ENDED')
        ? 'REVEALED'
        : 'PREVIEW';

  const currentQuestion = currentState?.question || currentState?.currentQuestion || (currentState?.session as any)?.question || null;
  const isQuestionLive = resolvedState === 'LIVE';

  // Server-Sync Timer Calculation
  let syncRemaining = typeof currentState?.timerRemainingSec === 'number' ? currentState.timerRemainingSec : 20;

  // Use server timestamp synchronization if available for higher accuracy
  const nowMs = (currentState as any)?.serverNowEpochMs;
  const startedAt = sessionData?.questionStartedAt;
  const timerDuration = sessionData?.timerDurationSec || 20;

  if (isQuestionLive && nowMs && startedAt) {
    const elapsed = Math.floor((nowMs - startedAt) / 1000);
    syncRemaining = Math.max(0, timerDuration - elapsed);
  }

  // Timer Hook
  const timer = useQuizTimer(
    syncRemaining,
    isQuestionLive,
    timerDuration
  );

  // Actions
  const handleRegister = async (data: { teamName: string; college?: string; members?: string }) => {
    if (!sessionId) {
      setRegisterError('Invalid Session ID');
      return;
    }

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const response = await team.register<TeamRegisterResponse>(sessionId, data);
      if (response.teamId && response.teamSecret) {
        setTeamId(response.teamId);
        setTeamSecret(response.teamSecret);
        sessionStorage.setItem(TEAM_SESSION_KEY, JSON.stringify(response));
        emitToast({ level: 'success', title: 'Registered!', message: `Welcome, ${formatTeamName(data.teamName)}` });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setRegisterError(msg);
      emitToast({ level: 'error', title: 'Error', message: msg });
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSubmitAnswer = async (payload: Partial<TeamSubmissionPayload>) => {
    if (!sessionId || !teamId || !teamSecret || !currentQuestion) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    const fullPayload: TeamSubmissionPayload = {
      teamId,
      teamSecret,
      questionId: currentQuestion.id,
      ...payload,
    };

    try {
      await team.submitAnswer(sessionId, fullPayload);
      if (payload.action !== 'BUZZ') {
        setSubmittedQuestionId(currentQuestion.id);
        emitToast({ level: 'success', title: 'Submitted', message: 'Answer received.' });
      } else {
        emitToast({ level: 'info', title: 'Buzzed!', message: 'You pressed the buzzer.' });
      }
    } catch (err) {
      // 409 means already submitted or too late, which is "fine" in a way
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setSubmissionError(msg);
      emitToast({ level: 'error', title: 'Submission Error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="card max-w-md text-center">
          <h1 className="text-xl font-bold text-rose-600">Missing Session ID</h1>
          <p className="text-slate-600 mt-2">Please join using a valid link provided by the quiz master.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Quiz Team Portal</h1>
          <p className="mt-2 text-slate-600">Session: <span className="font-mono bg-slate-200 px-2 py-0.5 rounded">{sessionId}</span></p>
        </header>

        {!isRegistered ? (
          <RegistrationForm
            onSubmit={handleRegister}
            isLoading={isRegistering}
            error={registerError}
          />
        ) : (
          <QuizView
            teamId={teamId}
            state={resolvedState}
            question={currentQuestion}
            timer={timer}
            onSubmit={handleSubmitAnswer}
            submissionState={{
              isSubmitting,
              isSubmitted: submittedQuestionId === currentQuestion?.id,
              error: submissionError
            }}
            buzzer={{
              isBuzzerMode: currentQuestion?.questionType === 'BUZZER' || currentState?.questionType === 'BUZZER' || currentState?.mode === 'BUZZER' || currentState?.gameMode === 'BUZZER',
              hasBuzz: currentState?.buzzOwnerTeamId === teamId,
              buzzOwnerTeamId: currentState?.buzzOwnerTeamId
            }}

            concernTeamId={currentState?.concernTeamId || (currentState?.session as any)?.concernTeamId}
          />
        )}
      </div>
    </main>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center">Loading...</div>}>
      <TeamContent />
    </Suspense>
  );
}
