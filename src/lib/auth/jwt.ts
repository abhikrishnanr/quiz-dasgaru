import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-do-not-use-in-prod';

export interface TeamTokenPayload {
    teamId: string;
    sessionId: string;
    teamName: string;
    teamSecret?: string;
}

export function signTeamToken(payload: TeamTokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyTeamToken(token: string): TeamTokenPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as TeamTokenPayload;
    } catch (_error) {
        return null;
    }
}
