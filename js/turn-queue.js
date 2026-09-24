(() => {
  const root = document.querySelector("#turnQueueAdmin");
  const api = window.AdminQuizAPI;

  if (!root || !api) {
    console.warn("Turn queue module: admin API or container is unavailable.");
    return;
  }

  function randomIndex(maxExclusive) {
    if (maxExclusive <= 1) return 0;

    if (window.crypto?.getRandomValues) {
      // Rejection sampling avoids modulo bias.
      const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
      const buffer = new Uint32Array(1);
      let value;

      do {
        window.crypto.getRandomValues(buffer);
        value = buffer[0];
      } while (value >= limit);

      return value % maxExclusive;
    }

    return Math.floor(Math.random() * maxExclusive);
  }

  function shuffle(items) {
    const result = items.slice();

    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = randomIndex(i + 1);
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  function createOrder(teamIds, previousFirstTeamId) {
    if (!teamIds.length) return [];
    if (teamIds.length === 1) return teamIds.slice();

    const firstCandidates = teamIds.filter(id => id !== previousFirstTeamId);
    const first = firstCandidates[randomIndex(firstCandidates.length)];
    const rest = shuffle(teamIds.filter(id => id !== first));

    return [first, ...rest];
  }

  function isQueueRunning(queue) {
    return Boolean(
      queue &&
      Array.isArray(queue.order) &&
      queue.order.length &&
      !queue.completed &&
      queue.currentIndex >= 0 &&
      queue.currentIndex < queue.order.length
    );
  }

  function generateQueue() {
    const state = api.getState();
    const teamIds = state.teams.map(team => team.id);

    if (!teamIds.length) return;

    if (isQueueRunning(state.turnQueue)) {
      const replace = confirm("Текущая очередь ещё не закончена. Создать новую?");
      if (!replace) return;
    }

    const previousFirstTeamId = state.turnQueue?.previousFirstTeamId || null;
    const order = createOrder(teamIds, previousFirstTeamId);
    const firstTeamId = order[0] || null;

    api.commit(s => {
      const previousRound = s.turnQueue?.roundNumber || 0;

      s.turnQueue = {
        order,
        currentIndex: order.length ? 0 : -1,
        previousFirstTeamId: firstTeamId,
        roundNumber: previousRound + 1,
        completed: order.length === 0
      };

      s.activeTeamId = firstTeamId;
    });
  }

  function advanceQueue() {
    api.commit(s => {
      const queue = s.turnQueue;
      if (!isQueueRunning(queue)) return;

      const existingTeamIds = new Set(s.teams.map(team => team.id));
      let nextIndex = queue.currentIndex + 1;

      // If a team was removed from the admin panel after the queue was generated,
      // silently skip it instead of breaking the round.
      while (
        nextIndex < queue.order.length &&
        !existingTeamIds.has(queue.order[nextIndex])
      ) {
        nextIndex += 1;
      }

      if (nextIndex >= queue.order.length) {
        queue.currentIndex = queue.order.length;
        queue.completed = true;
        s.activeTeamId = null;
        return;
      }

      queue.currentIndex = nextIndex;
      s.activeTeamId = queue.order[nextIndex];
    });
  }

  function finishQueue() {
    api.commit(s => {
      if (!s.turnQueue) return;
      s.turnQueue.currentIndex = Array.isArray(s.turnQueue.order)
        ? s.turnQueue.order.length
        : 0;
      s.turnQueue.completed = true;
      s.activeTeamId = null;
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function render() {
    const state = api.getState();
    const queue = state.turnQueue;
    const teamMap = new Map(state.teams.map(team => [team.id, team]));
    const hasOrder = Array.isArray(queue?.order) && queue.order.length > 0;
    const running = isQueueRunning(queue);

    let statusText = "Очередь ещё не создана";

    if (hasOrder && queue.completed) {
      statusText = `Раунд ${queue.roundNumber || 1}: очередь завершена`;
    } else if (running) {
      const currentId = queue.order[queue.currentIndex];
      const currentName = teamMap.get(currentId)?.name || "Удалённая команда";
      statusText = `Раунд ${queue.roundNumber || 1} · ход ${queue.currentIndex + 1} из ${queue.order.length}: ${currentName}`;
    }

    const chips = hasOrder
      ? queue.order.map((teamId, index) => {
          const team = teamMap.get(teamId);
          const classes = ["turn-queue-chip"];

          if (!team) classes.push("missing");
          if (queue.completed || index < queue.currentIndex) classes.push("done");
          if (!queue.completed && index === queue.currentIndex) classes.push("current");

          return `
            <div class="${classes.join(" ")}">
              <span class="turn-queue-number">${index + 1}</span>
              <span>${escapeHtml(team?.name || "Команда удалена")}</span>
            </div>
          `;
        }).join("")
      : '<div class="turn-queue-empty">Нажмите «Новая очередь», чтобы случайно распределить ходы.</div>';

    root.innerHTML = `
      <div class="turn-queue-heading">
        <div>
          <div class="subheading">Очередь ответов</div>
          <div class="turn-queue-status">${escapeHtml(statusText)}</div>
        </div>

        <div class="turn-queue-actions">
          <button type="button" class="button button-secondary" data-turn-action="generate">
            🎲 Новая очередь
          </button>
          <button type="button" class="button" data-turn-action="next" ${running ? "" : "disabled"}>
            Следующий ход →
          </button>
          <button type="button" class="button button-secondary" data-turn-action="finish" ${running ? "" : "disabled"}>
            Завершить
          </button>
        </div>
      </div>

      <div class="turn-queue-list">${chips}</div>
      <div class="turn-queue-note">
        Первая команда нового раунда никогда не повторяет первую команду предыдущего раунда.
      </div>
    `;
  }

  root.addEventListener("click", event => {
    const button = event.target.closest("[data-turn-action]");
    if (!button) return;

    const action = button.dataset.turnAction;

    if (action === "generate") generateQueue();
    if (action === "next") advanceQueue();
    if (action === "finish") finishQueue();
  });

  window.addEventListener("quiz:state-changed", render);
  render();
})();
