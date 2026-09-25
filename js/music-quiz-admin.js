(() => {
  const api = window.AdminQuizAPI;
  if (!api) {
    console.warn("Music quiz admin: AdminQuizAPI is unavailable.");
    return;
  }

  let data = null;
  let panel = null;
  let lastTaskOrder = null;

  const player = new Audio();
  player.preload = "metadata";
  player.controls = true;

  const tiers = {
    "4": { label: "4 сек", points: 3 },
    "8": { label: "8 сек", points: 2 },
    "12": { label: "12 сек", points: 1 },
    "full": { label: "Весь трек", points: 1 }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "musicQuizAdminInfo";
    panel.className = "music-admin-info hidden";

    const anchor = document.querySelector("#gameAdminInfo");
    anchor?.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function getTask(groupId) {
    if (!data || !groupId?.startsWith("task-")) return null;
    const order = Number(groupId.slice(5));
    return data.tasks.find(task => task.order === order) || null;
  }

  function currentTier(state, task) {
    if (!task || state.musicQuiz?.taskOrder !== task.order) return null;
    return state.musicQuiz?.tier || null;
  }

  function stopAudio(clearSource = false) {
    player.pause();

    if (clearSource) {
      player.removeAttribute("src");
      player.load();
    } else {
      try { player.currentTime = 0; } catch {}
    }
  }

  function selectTier(task, tier) {
    const meta = tiers[tier];
    if (!meta || !task?.clips?.[tier]) return;

    api.commit(state => {
      state.musicQuiz = {
        ...(state.musicQuiz || {}),
        taskOrder: task.order,
        tier,
        points: meta.points,
        updatedAt: Date.now()
      };
    });

    stopAudio(false);
    player.src = task.clips[tier];

    const freshPanel = ensurePanel();
    const host = freshPanel.querySelector("#musicFullPlayerHost");

    if (tier === "full") {
      player.controls = true;
      player.className = "music-full-player";
      host?.appendChild(player);
    } else {
      player.controls = false;
    }

    player.currentTime = 0;
    const playPromise = player.play();
    if (playPromise?.catch) {
      playPromise.catch(error => {
        console.warn("Не удалось запустить аудио.", error);
      });
    }
  }

  function award(teamId, points) {
    api.commit(state => {
      const team = state.teams.find(item => item.id === teamId);
      if (team) team.score += points;
      state.activeTeamId = teamId;
    });
  }

  function render() {
    const box = ensurePanel();
    const state = api.getState();
    const active = state.current?.type === "game" && state.current?.gameId === "game-3";

    if (!active) {
      box.classList.add("hidden");
      if (lastTaskOrder !== null) stopAudio(true);
      lastTaskOrder = null;
      return;
    }

    box.classList.remove("hidden");

    if (!data) {
      box.innerHTML = '<div class="game-info-error">Не удалось загрузить data/music-quiz.json</div>';
      return;
    }

    if (state.current.groupId === "intro") {
      if (lastTaskOrder !== null) stopAudio(true);
      lastTaskOrder = null;

      box.innerHTML = `
        <div class="game-info-heading">Угадай мелодию</div>
        <div class="game-info-muted">
          На каждом треке появятся четыре кнопки: 4, 8, 12 секунд и полный трек.
          Звук воспроизводится с пульта ведущего.
        </div>
      `;
      return;
    }

    if (state.current.groupId === "results") {
      if (lastTaskOrder !== null) stopAudio(true);
      lastTaskOrder = null;

      box.innerHTML = `
        <div class="game-info-heading">Конкурс завершён</div>
        <div class="game-info-muted">Можно вывести общее табло.</div>
      `;
      return;
    }

    const task = getTask(state.current.groupId);
    if (!task) {
      box.innerHTML = '<div class="game-info-error">Трек для этой сцены не найден.</div>';
      return;
    }

    if (lastTaskOrder !== null && lastTaskOrder !== task.order) {
      stopAudio(true);
    }
    lastTaskOrder = task.order;

    const tier = currentTier(state, task);
    const points = tier ? tiers[tier]?.points ?? 1 : null;

    const scoreButtons = points
      ? state.teams.map(team => `
          <button
            class="button button-secondary music-score-btn"
            data-team-id="${escapeHtml(team.id)}"
            data-points="${points}"
          >${escapeHtml(team.name)} +${points}</button>
        `).join("")
      : '<div class="music-score-placeholder">Сначала включите один из фрагментов.</div>';

    const ownerLine = task.owner
      ? `<span class="music-owner-chip">Из топа: ${escapeHtml(task.owner)}</span>`
      : `<span class="music-owner-chip autumn">Осенний блок</span>`;

    box.innerHTML = `
      <div class="music-admin-heading">
        <div>
          <div class="game-info-heading">Трек ${task.order} / ${data.tasks.length}</div>
          <div class="music-answer">${escapeHtml(task.artist)} — ${escapeHtml(task.title)}</div>
        </div>
        ${ownerLine}
      </div>

      <div class="music-fragment-buttons">
        <button class="button music-fragment-btn" data-tier="4">
          <strong>4 сек</strong><span>3 балла</span>
        </button>
        <button class="button music-fragment-btn" data-tier="8">
          <strong>8 сек</strong><span>2 балла</span>
        </button>
        <button class="button music-fragment-btn" data-tier="12">
          <strong>12 сек</strong><span>1 балл</span>
        </button>
        <button class="button music-fragment-btn" data-tier="full">
          <strong>Весь трек</strong><span>1 балл · плеер</span>
        </button>
      </div>

      <div id="musicFullPlayerHost" class="music-player-host ${tier === "full" ? "" : "hidden"}"></div>

      <div class="music-current-tier">
        ${tier
          ? `Сейчас разыгрывается: <strong>${escapeHtml(tiers[tier].label)}</strong> · <strong>+${points}</strong>`
          : "Фрагмент ещё не выбран."}
      </div>

      <div class="taboo-answer-label">Кто угадал?</div>
      <div class="music-score-buttons">${scoreButtons}</div>
    `;

    if (tier === "full") {
      const host = box.querySelector("#musicFullPlayerHost");
      player.controls = true;
      player.className = "music-full-player";
      host?.appendChild(player);
    }

    box.querySelectorAll(".music-fragment-btn").forEach(button => {
      button.addEventListener("click", () => {
        selectTier(task, button.dataset.tier);
      });
    });

    box.querySelectorAll(".music-score-btn").forEach(button => {
      button.addEventListener("click", () => {
        award(button.dataset.teamId, Number(button.dataset.points) || 1);
      });
    });
  }

  async function init() {
    ensurePanel();

    try {
      const response = await fetch("data/music-quiz.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      console.error("Не удалось загрузить data/music-quiz.json", error);
      data = null;
    }

    window.addEventListener("quiz:state-changed", render);
    window.addEventListener("beforeunload", () => stopAudio(true));
    render();
  }

  init();
})();
