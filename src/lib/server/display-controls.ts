const scoreboardVisibilityBySession = new Map<string, boolean>();

function toScoreboardKey(sessionId: string): string {
  return sessionId.trim().toUpperCase();
}

export function getScoreboardVisibility(sessionId: string): boolean {
  return scoreboardVisibilityBySession.get(toScoreboardKey(sessionId)) ?? false;
}

export function setScoreboardVisibility(sessionId: string, visible: boolean): boolean {
  scoreboardVisibilityBySession.set(toScoreboardKey(sessionId), visible);
  return visible;
}
