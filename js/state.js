(() => {
  const STORAGE_KEY = "birthdayQuizState.v2";

  const defaultState = {
    version: 2,
    teams: [
      { id: "marina", name: "Марина", score: 0 },
      { id: "tatiana", name: "Татьяна", score: 0 },
      { id: "slava", name: "Слава", score: 0 },
      { id: "stas", name: "Стас", score: 0 }
    ],
    activeTeamId: null,

    current: {
      type: "system",
      systemId: "welcome",
      gameId: null,
      groupId: null,
      sceneId: null
    },

    admin: {
      selectedGameId: "game-1",
      openGroupByGame: {
        "game-1": "intro",
        "game-2": "intro",
        "game-3": "intro"
      }
    },

    timer: {
      duration: 30,
      remaining: 30,
      running: false,
      startedAt: null,
      soundEnabled: true,
      endSignalId: 0
    },

    updatedAt: Date.now()
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(defaultState);
      const saved = JSON.parse(raw);

      return {
        ...clone(defaultState),
        ...saved,
        current: {
          ...clone(defaultState.current),
          ...(saved.current || {})
        },
        admin: {
          ...clone(defaultState.admin),
          ...(saved.admin || {}),
          openGroupByGame: {
            ...clone(defaultState.admin.openGroupByGame),
            ...((saved.admin && saved.admin.openGroupByGame) || {})
          }
        },
        timer: {
          ...clone(defaultState.timer),
          ...(saved.timer || {})
        },
        teams: Array.isArray(saved.teams) && saved.teams.length
          ? saved.teams
          : clone(defaultState.teams)
      };
    } catch {
      return clone(defaultState);
    }
  }

  function save(state) {
    const next = clone(state);
    next.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function reset() {
    const fresh = clone(defaultState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  window.QuizState = {
    STORAGE_KEY,
    defaultState: clone(defaultState),
    load,
    save,
    reset,
    clone
  };
})();
