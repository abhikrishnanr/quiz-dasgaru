const scoreboardVisibilityBySession = new Map<string, boolean>();

export function getScoreboardVisibility(sessionId: string): boolean {
  return scoreboardVisibilityBySession.get(sessionId) ?? false;
}

export function setScoreboardVisibility(sessionId: string, visible: boolean): boolean {
  scoreboardVisibilityBySession.set(sessionId, visible);
  return visible;
}
