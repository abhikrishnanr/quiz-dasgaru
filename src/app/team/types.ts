export type QuizState = 'PREVIEW' | 'LIVE' | 'LOCKED' | 'REVEALED';

export type QuizPhase = 'WAITING' | 'REGISTERED' | 'PLAYING';

export interface GenericRecord extends Record<string, unknown> { }

export interface TeamRegisterResponse {
    teamId?: string;
    teamSecret?: string;
}

export interface QuestionOption {
    key: string;
    text: string;
}

export interface Question {
    id: string;
    text: string;
    options: QuestionOption[];
    questionType?: string;
    topic?: string;
    difficulty?: string;
    hint?: string;
    orderIndex?: number;
}

export interface QuizCurrentState {
    isLive: boolean;
    isLocked: boolean;
    isRevealed: boolean;
    state: string;
    status?: string;
    question?: Question;
    currentQuestion?: Question;
    allowedTeams?: { teamIds?: string[] } | GenericRecord;
    allowedTeamIds?: string[];
    timerRemainingSec?: number;
    remainingSec?: number;
    buzzOwnerTeamId?: string;
    quizState?: string;
    phase?: string;
    questionType?: string;
    // New fields
    gameMode?: 'STANDARD' | 'BUZZER';
    concernTeamId?: string;
    session?: {
        state: string;
        question?: Question;
    };
}

export interface TeamSubmissionPayload extends Record<string, unknown> {
    teamId: string;
    teamSecret: string;
    questionId: string;
    selectedKey?: string;
    action?: 'BUZZ' | 'PASS';
    buzz?: boolean;
    passed?: boolean;
}
