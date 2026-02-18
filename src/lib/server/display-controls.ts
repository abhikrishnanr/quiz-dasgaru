type DisplayControlStore = {
  scoreboardVisibilityBySession: Map<string, boolean>;
};

const globalStore = globalThis as typeof globalThis & { __displayControlStore?: DisplayControlStore };

function getStore(): DisplayControlStore {
  if (!globalStore.__displayControlStore) {
    globalStore.__displayControlStore = {
      scoreboardVisibilityBySession: new Map<string, boolean>(),
    };
  }

  return globalStore.__displayControlStore;
}

export function getScoreboardVisibility(sessionId: string): boolean {
  return getStore().scoreboardVisibilityBySession.get(sessionId) ?? false;
}

export function setScoreboardVisibility(sessionId: string, visible: boolean): boolean {
  getStore().scoreboardVisibilityBySession.set(sessionId, visible);
  return visible;
}
