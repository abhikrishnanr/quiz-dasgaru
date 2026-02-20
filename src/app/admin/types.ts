export type AdminTab = 'QUESTIONS' | 'ANSWERS' | 'SETTINGS' | 'TEAMS';

export interface AdminSessionSummary {
    sessionId: string;
    questionState: string;
    teamCount?: number;
    questionCount?: number;
    createdAt: number;
    eventName?: string;
    eventDate?: string;
    eventVenue?: string;
    statusLabel?: string;
    // Extended fields
    description?: string;
    passcode?: string;
    maxTeams?: number;
    theme?: 'light' | 'dark' | 'blue' | 'red';
    organizer?: string;
    gameMode?: 'STANDARD' | 'BUZZER' | 'ASK_AI';
}

export interface AdminSessionDetails {
    session: {
        sessionId: string;
        questionState: string;
        currentQuestionId?: string;
        timerDurationSec?: number;
        questionStartedAt?: number;
        teamOrder?: string[];
        createdAt: number;
        eventName?: string;
        eventDate?: string;
        eventVenue?: string;
        statusLabel?: string;
        // Extended fields
        description?: string;
        passcode?: string;
        maxTeams?: number;
        theme?: 'light' | 'dark' | 'blue' | 'red';
        organizer?: string;
        gameMode?: 'STANDARD' | 'BUZZER' | 'ASK_AI';
        concernTeamId?: string;
        askAiQuestion?: null | { teamId: string; text: string; createdAt: number };
        askAiAnswer?: null | { text: string; createdAt: number; outOfDomain?: boolean };
        askAiMark?: null | 'RIGHT' | 'WRONG';
        askAiAnnouncement?: null | { text: string; createdAt: number };
        buzzOwnerTeamId?: string;
        displayToken?: string;
    };
    teams: Array<{
        teamId: string;
        teamName: string;
        totalScore: number;
        isConnected?: boolean;
        status?: 'ONLINE' | 'OFFLINE';
    }>;
    questions: Array<{
        questionId: string;
        orderIndex: number;
        questionText: string;
        points: number;
        options?: Array<{ key: string; text: string }>;
        correctKey?: string;
        state?: string;
        category?: string;
        topic?: string;
        difficulty?: string;
        hint?: string;
    }>;
    counts: {
        teamCount: number;
        questionCount: number;
    };
}

export interface AnswerRecord {
    teamId: string;
    questionId: string;
    selectedKey: string;
    submittedAt: number;
    isCorrect?: boolean;
    pointsAwarded?: number;
    action?: 'BUZZ' | 'PASS' | 'BUZZ_ANSWER' | 'ANSWER';
}
