(() => {
  const api = window.AdminQuizAPI;

  if (!api) {
    console.warn("Team ID reconcile module: AdminQuizAPI is unavailable.");
    return;
  }

  let birthdays = [];
  let reconciling = false;

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("ru-RU");
  }

  function replaceIdInQueue(queue, oldId, newId) {
    if (!queue) return;

    if (Array.isArray(queue.order)) {
      queue.order = queue.order.map(id => id === oldId ? newId : id);
    }

    if (queue.previousFirstTeamId === oldId) {
      queue.previousFirstTeamId = newId;
    }
  }

  function findRepair(state) {
    for (const birthday of birthdays) {
      const canonicalId = birthday.teamId || birthday.id;
      if (!canonicalId) continue;

      // Already healthy.
      if (state.teams.some(team => team.id === canonicalId)) continue;

      const expectedNames = new Set(
        [birthday.displayName, birthday.name, canonicalId]
          .filter(Boolean)
          .map(normalize)
      );

      const replacement = state.teams.find(team =>
        expectedNames.has(normalize(team.name))
      );

      if (replacement) {
        return {
          oldId: replacement.id,
          newId: canonicalId
        };
      }
    }

    return null;
  }

  function reconcile() {
    if (reconciling || !birthdays.length) return;

    const state = api.getState();
    const repair = findRepair(state);
    if (!repair || repair.oldId === repair.newId) return;

    reconciling = true;

    api.commit(next => {
      const team = next.teams.find(item => item.id === repair.oldId);
      if (!team) return;

      team.id = repair.newId;

      if (next.activeTeamId === repair.oldId) {
        next.activeTeamId = repair.newId;
      }

      replaceIdInQueue(next.turnQueue, repair.oldId, repair.newId);
    });

    reconciling = false;

    // There may be more than one team to repair.
    queueMicrotask(reconcile);
  }

  async function init() {
    try {
      const response = await fetch("data/birthdays.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      birthdays = Array.isArray(data.birthdays) ? data.birthdays : [];
    } catch (error) {
      console.error("Не удалось загрузить data/birthdays.json", error);
      return;
    }

    window.addEventListener("quiz:state-changed", reconcile);
    reconcile();
  }

  init();
})();
