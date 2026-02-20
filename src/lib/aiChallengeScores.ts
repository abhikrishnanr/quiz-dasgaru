export const AI_CHALLENGE_SCORES_KEY = 'ai_challenge_scores_v1';

export type AiChallengeScoreMap = Record<string, number>;

export function loadAiScores(): AiChallengeScoreMap {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(AI_CHALLENGE_SCORES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce<AiChallengeScoreMap>((acc, [teamId, value]) => {
      const numericValue = Number(value);
      acc[teamId] = Number.isFinite(numericValue) ? numericValue : 0;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function saveAiScores(map: AiChallengeScoreMap): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AI_CHALLENGE_SCORES_KEY, JSON.stringify(map));
}

export function getAiScore(teamId: string): number {
  if (!teamId) return 0;
  const map = loadAiScores();
  return Number(map[teamId] ?? 0);
}

export function setAiScore(teamId: string, value: number): AiChallengeScoreMap {
  const map = loadAiScores();
  map[teamId] = Number.isFinite(value) ? value : 0;
  saveAiScores(map);
  return map;
}

export function addAiScore(teamId: string, delta: number): AiChallengeScoreMap {
  const map = loadAiScores();
  const current = Number(map[teamId] ?? 0);
  map[teamId] = current + (Number.isFinite(delta) ? delta : 0);
  saveAiScores(map);
  return map;
}
