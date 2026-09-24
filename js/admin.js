(() => {
  const structure = window.QUIZ_STRUCTURE;
  let state = QuizState.load();
  let timerLoop = null;
  let tabooData = null;

  const els = {
    syncStatus: document.querySelector("#syncStatus"),
    teamsAdmin: document.querySelector("#teamsAdmin"),
    systemScreens: document.querySelector("#systemScreens"),
    gameTabs: document.querySelector("#gameTabs"),
    gameSceneList: document.querySelector("#gameSceneList"),
    currentScope: document.querySelector("#currentScope"),
    currentPrimary: document.querySelector("#currentPrimary"),
    currentSecondary: document.querySelector("#currentSecondary"),
    gameAdminInfo: document.querySelector("#gameAdminInfo"),
    timerSeconds: document.querySelector("#timerSecondsInput"),
    timerSoundToggle: document.querySelector("#timerSoundToggle"),
    timerAdminReadout: document.querySelector("#timerAdminReadout")
  };

  const syncOk = QuizSync.init();
  els.syncStatus.textContent = syncOk ? "Синхронизация активна" : "BroadcastChannel недоступен";

  QuizSync.subscribe(message => {
    if (message?.type === "request-state") {
      QuizSync.broadcastState(state);
    }
  });

  async function loadGameData() {
    try {
      const response = await fetch("data/taboo.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      tabooData = await response.json();
    } catch (error) {
      console.error("Не удалось загрузить data/taboo.json", error);
      tabooData = null;
    }
  }

  function commit(mutator) {
    const next = QuizState.clone(state);
    mutator(next);
    state = QuizState.save(next);
    render();
    QuizSync.broadcastState(state);
  }

  function addTeam() {
    commit(s => {
      const id = `team-${Date.now()}`;
      s.teams.push({
        id,
        name: `Команда ${s.teams.length + 1}`,
        score: 0
      });
    });
  }

  function deleteTeam(teamId) {
    const team = state.teams.find(t => t.id === teamId);
    if (!team || state.teams.length <= 1) return;

    if (!confirm(`Удалить команду «${team.name}»?`)) return;

    commit(s => {
      s.teams = s.teams.filter(t => t.id !== teamId);
      if (s.activeTeamId === teamId) s.activeTeamId = null;
    });
  }

  function changeScore(teamId, delta, makeActive = false) {
    commit(s => {
      const target = s.teams.find(t => t.id === teamId);
      if (target) target.score += delta;
      if (makeActive) s.activeTeamId = teamId;
    });
  }

  function getTeamName(teamId) {
    return state.teams.find(t => t.id === teamId)?.name || teamId || "—";
  }

  function getTabooTaskByGroup(groupId) {
    if (!tabooData || !groupId?.startsWith("task-")) return null;
    const order = Number(groupId.replace("task-", ""));
    return tabooData.tasks.find(task => task.order === order) || null;
  }

  function renderTeams() {
    els.teamsAdmin.innerHTML = "";

    state.teams.forEach((team, index) => {
      const row = document.createElement("div");
      row.className = "team-row";
      if (team.id === state.activeTeamId) row.classList.add("active");

      row.innerHTML = `
        <div class="team-index">${index + 1}</div>
        <input class="team-name" type="text" value="${escapeHtml(team.name)}" aria-label="Название команды">
        <input class="team-score" type="number" value="${team.score}" aria-label="Очки команды">
        <div class="team-buttons">
          <button class="button button-secondary select-team" title="Сделать активной">Ход</button>
          <button class="button button-secondary minus-score">−1</button>
          <button class="button plus-score">+1</button>
          <button class="button button-danger delete-team" title="Удалить команду">×</button>
        </div>
      `;

      const nameInput = row.querySelector(".team-name");
      const scoreInput = row.querySelector(".team-score");

      nameInput.addEventListener("change", () => {
        commit(s => {
          const target = s.teams.find(t => t.id === team.id);
          if (target) target.name = nameInput.value.trim() || target.name;
        });
      });

      scoreInput.addEventListener("change", () => {
        commit(s => {
          const target = s.teams.find(t => t.id === team.id);
          if (target) target.score = Number(scoreInput.value) || 0;
        });
      });

      row.querySelector(".select-team").addEventListener("click", () => {
        commit(s => {
          s.activeTeamId = s.activeTeamId === team.id ? null : team.id;
        });
      });

      row.querySelector(".minus-score").addEventListener("click", () => changeScore(team.id, -1, true));
      row.querySelector(".plus-score").addEventListener("click", () => changeScore(team.id, 1, true));
      row.querySelector(".delete-team").addEventListener("click", () => deleteTeam(team.id));

      els.teamsAdmin.appendChild(row);
    });
  }

  function renderSystemScreens() {
    els.systemScreens.innerHTML = "";

    structure.systemScreens.forEach(screen => {
      const btn = document.createElement("button");
      btn.className = "button button-secondary system-screen-button";
      btn.textContent = screen.title;

      if (state.current.type === "system" && state.current.systemId === screen.id) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        commit(s => {
          s.current = {
            type: "system",
            systemId: screen.id,
            gameId: null,
            groupId: null,
            sceneId: null
          };
        });
      });

      els.systemScreens.appendChild(btn);
    });
  }

  function renderGameTabs() {
    els.gameTabs.innerHTML = "";

    structure.games.forEach(game => {
      const btn = document.createElement("button");
      btn.className = "game-tab";
      btn.textContent = game.title;

      if (state.admin.selectedGameId === game.id) btn.classList.add("active");

      btn.addEventListener("click", () => {
        commit(s => {
          s.admin.selectedGameId = game.id;
          if (!s.admin.openGroupByGame[game.id]) {
            s.admin.openGroupByGame[game.id] = game.groups[0]?.id || null;
          }
        });
      });

      els.gameTabs.appendChild(btn);
    });
  }

  function getAdminGroupTitle(game, group) {
    if (game.id !== "game-2") return group.title;

    const task = getTabooTaskByGroup(group.id);
    if (!task) return group.title;

    return `${task.order}. ${getTeamName(task.teamId)} — ${task.answer}`;
  }

  function renderGameSceneList() {
    els.gameSceneList.innerHTML = "";

    const game = structure.games.find(g => g.id === state.admin.selectedGameId) || structure.games[0];
    if (!game) return;

    const openGroupId = state.admin.openGroupByGame[game.id];

    game.groups.forEach(group => {
      const wrapper = document.createElement("div");
      wrapper.className = "scene-group";

      const header = document.createElement("button");
      header.className = "scene-group-header";
      header.innerHTML = `<span>${escapeHtml(getAdminGroupTitle(game, group))}</span><span>${openGroupId === group.id ? "Свернуть" : "Открыть"}</span>`;

      header.addEventListener("click", () => {
        commit(s => {
          s.admin.openGroupByGame[game.id] =
            s.admin.openGroupByGame[game.id] === group.id ? null : group.id;
        });
      });

      wrapper.appendChild(header);

      if (openGroupId === group.id) {
        const body = document.createElement("div");
        body.className = "scene-group-body";

        group.scenes.forEach(scene => {
          const btn = document.createElement("button");
          btn.className = "scene-button";
          btn.textContent = scene.title;

          if (
            state.current.type === "game" &&
            state.current.gameId === game.id &&
            state.current.groupId === group.id &&
            state.current.sceneId === scene.id
          ) {
            btn.classList.add("active");
          }

          btn.addEventListener("click", () => {
            commit(s => {
              s.current = {
                type: "game",
                systemId: null,
                gameId: game.id,
                groupId: group.id,
                sceneId: scene.id
              };
              s.admin.selectedGameId = game.id;
              s.admin.openGroupByGame[game.id] = group.id;

              if (game.id === "game-2") {
                const task = getTabooTaskByGroup(group.id);
                if (task) s.activeTeamId = task.teamId;
              }
            });
          });

          body.appendChild(btn);
        });

        wrapper.appendChild(body);
      }

      els.gameSceneList.appendChild(wrapper);
    });
  }

  function getCurrentDescription() {
    if (state.current.type === "system") {
      const screen = structure.systemScreens.find(s => s.id === state.current.systemId);
      return {
        scope: "Системный экран",
        primary: screen?.title || "Не выбран",
        secondary: "—"
      };
    }

    const game = structure.games.find(g => g.id === state.current.gameId);
    const group = game?.groups.find(g => g.id === state.current.groupId);
    const scene = group?.scenes.find(s => s.id === state.current.sceneId);

    if (game?.id === "game-2") {
      const task = getTabooTaskByGroup(group?.id);

      if (task) {
        return {
          scope: game.title,
          primary: `Задание ${task.order} / ${tabooData?.tasks.length || 8}`,
          secondary: `${getTeamName(task.teamId)} · ${scene?.title || "Сцена"}`
        };
      }
    }

    return {
      scope: game?.title || "Игра",
      primary: group?.title || "Раздел",
      secondary: scene?.title || "Сцена"
    };
  }

  function flattenGameScenes(game) {
    const result = [];
    game.groups.forEach(group => {
      group.scenes.forEach(scene => {
        result.push({ gameId: game.id, groupId: group.id, sceneId: scene.id });
      });
    });
    return result;
  }

  function moveScene(delta) {
    if (state.current.type !== "game") return;

    const game = structure.games.find(g => g.id === state.current.gameId);
    if (!game) return;

    const flat = flattenGameScenes(game);
    const index = flat.findIndex(item =>
      item.groupId === state.current.groupId &&
      item.sceneId === state.current.sceneId
    );

    if (index < 0) return;

    const target = flat[index + delta];
    if (!target) return;

    commit(s => {
      s.current = {
        type: "game",
        systemId: null,
        ...target
      };
      s.admin.selectedGameId = game.id;
      s.admin.openGroupByGame[game.id] = target.groupId;

      if (game.id === "game-2") {
        const task = getTabooTaskByGroup(target.groupId);
        if (task) s.activeTeamId = task.teamId;
      }
    });
  }

  function renderCurrentScene() {
    const d = getCurrentDescription();
    els.currentScope.textContent = d.scope;
    els.currentPrimary.textContent = d.primary;
    els.currentSecondary.textContent = d.secondary;
  }

  function renderGameAdminInfo() {
    const box = els.gameAdminInfo;
    box.classList.add("hidden");
    box.innerHTML = "";

    if (state.current.type !== "game" || state.current.gameId !== "game-2") return;

    if (!tabooData) {
      box.classList.remove("hidden");
      box.innerHTML = `<div class="game-info-error">Не удалось загрузить data/taboo.json</div>`;
      return;
    }

    if (state.current.groupId === "intro") {
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="game-info-heading">Табу</div>
        <div class="game-info-muted">Вступление конкурса. Секретных данных для ведущего на этом экране нет.</div>
      `;
      return;
    }

    if (state.current.groupId === "results") {
      box.classList.remove("hidden");
      box.innerHTML = `
        <div class="game-info-heading">Завершение Табу</div>
        <div class="game-info-muted">Можно вывести системное «Табло», если хотите отдельно показать общий счёт.</div>
      `;
      return;
    }

    const task = getTabooTaskByGroup(state.current.groupId);
    if (!task) return;

    const nextTask = tabooData.tasks.find(t => t.order === task.order + 1);
    const teamName = getTeamName(task.teamId);
    const nextText = nextTask
      ? `${getTeamName(nextTask.teamId)} — ${nextTask.answer}`
      : "это последнее задание";

    box.classList.remove("hidden");

    const tabooItems = task.taboo
      .map(word => `<li>${escapeHtml(word)}</li>`)
      .join("");

    const guessButtons = state.teams
      .map(team => `<button class="button button-secondary taboo-guess-btn" data-team-id="${escapeHtml(team.id)}">${escapeHtml(team.name)} +1</button>`)
      .join("");

    box.innerHTML = `
      <div class="game-info-heading">Информация ведущего</div>

      <div class="taboo-meta-grid">
        <div>
          <span>Задание</span>
          <strong>${task.order} / ${tabooData.tasks.length}</strong>
        </div>
        <div>
          <span>Круг</span>
          <strong>${task.round}</strong>
        </div>
        <div>
          <span>Объясняет</span>
          <strong>${escapeHtml(teamName)}</strong>
        </div>
      </div>

      <div class="taboo-answer-label">Ответ</div>
      <div class="taboo-answer">${escapeHtml(task.answer)}</div>

      <div class="taboo-answer-label">Запрещённые слова</div>
      <ol class="taboo-word-list">${tabooItems}</ol>

      <div class="taboo-score-box">
        <button id="tabooExplainedBtn" class="button">
          Объяснил: ${escapeHtml(teamName)} +1
        </button>

        <div class="taboo-answer-label">Кто первым отгадал?</div>
        <div class="taboo-guess-buttons">${guessButtons}</div>
      </div>

      <div class="game-info-next">
        <span>Следующее:</span>
        <strong>${escapeHtml(nextText)}</strong>
      </div>
    `;

    box.querySelector("#tabooExplainedBtn")?.addEventListener("click", () => {
      changeScore(task.teamId, 1, false);
    });

    box.querySelectorAll(".taboo-guess-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        changeScore(btn.dataset.teamId, 1, false);
      });
    });
  }

  function getRemainingSeconds() {
    if (!state.timer.running || !state.timer.startedAt) {
      return Math.max(0, state.timer.remaining);
    }

    const elapsed = Math.floor((Date.now() - state.timer.startedAt) / 1000);
    return Math.max(0, state.timer.duration - elapsed);
  }

  function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function renderTimer() {
    const remaining = getRemainingSeconds();
    els.timerAdminReadout.textContent = formatTime(remaining);
    els.timerSoundToggle.checked = Boolean(state.timer.soundEnabled);

    if (document.activeElement !== els.timerSeconds) {
      els.timerSeconds.value = state.timer.duration;
    }
  }

  function startTimerLoop() {
    stopTimerLoop();

    timerLoop = setInterval(() => {
      if (!state.timer.running || !state.timer.startedAt) return;

      const remaining = getRemainingSeconds();
      const next = QuizState.clone(state);
      next.timer.remaining = remaining;

      if (remaining <= 0) {
        next.timer.running = false;
        next.timer.startedAt = null;
        next.timer.endSignalId = (next.timer.endSignalId || 0) + 1;
        stopTimerLoop();
      }

      state = QuizState.save(next);
      renderTimer();
      QuizSync.broadcastState(state);
    }, 150);
  }

  function stopTimerLoop() {
    if (timerLoop) {
      clearInterval(timerLoop);
      timerLoop = null;
    }
  }

  function render() {
    renderTeams();
    renderSystemScreens();
    renderGameTabs();
    renderGameSceneList();
    renderCurrentScene();
    renderGameAdminInfo();
    renderTimer();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  document.querySelector("#openScreenBtn").addEventListener("click", () => {
    window.open("screen.html", "birthdayQuizScreen");
  });

  document.querySelector("#addTeamBtn").addEventListener("click", addTeam);
  document.querySelector("#prevSceneBtn").addEventListener("click", () => moveScene(-1));
  document.querySelector("#nextSceneBtn").addEventListener("click", () => moveScene(1));

  document.querySelector("#timerSoundToggle").addEventListener("change", () => {
    commit(s => {
      s.timer.soundEnabled = els.timerSoundToggle.checked;
    });
  });

  document.querySelector("#timerStartBtn").addEventListener("click", () => {
    const seconds = Math.max(1, Number(els.timerSeconds.value) || 30);

    commit(s => {
      s.timer.duration = seconds;
      s.timer.remaining = seconds;
      s.timer.running = true;
      s.timer.startedAt = Date.now();
    });

    startTimerLoop();
  });

  document.querySelector("#timerPauseBtn").addEventListener("click", () => {
    const remaining = getRemainingSeconds();

    commit(s => {
      s.timer.remaining = remaining;
      s.timer.duration = Math.max(1, remaining || s.timer.duration);
      s.timer.running = false;
      s.timer.startedAt = null;
    });

    stopTimerLoop();
  });

  document.querySelector("#timerResetBtn").addEventListener("click", () => {
    const seconds = Math.max(1, Number(els.timerSeconds.value) || 30);

    commit(s => {
      s.timer.duration = seconds;
      s.timer.remaining = seconds;
      s.timer.running = false;
      s.timer.startedAt = null;
    });

    stopTimerLoop();
  });

  document.querySelector("#showTimerBtn").addEventListener("click", () => {
    commit(s => {
      s.current = {
        type: "system",
        systemId: "timer",
        gameId: null,
        groupId: null,
        sceneId: null
      };
    });
  });

  document.addEventListener("keydown", event => {
    if (event.target.matches("input")) return;

    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      const team = state.teams[index];
      if (!team) return;

      commit(s => {
        s.activeTeamId = s.activeTeamId === team.id ? null : team.id;
      });
    }
  });

  async function init() {
    await loadGameData();

    if (state.timer.running) startTimerLoop();

    render();
    QuizSync.broadcastState(state);
  }

  init();
})();
