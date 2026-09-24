(() => {
  const structure = window.QUIZ_STRUCTURE;
  let state = QuizState.load();
  let tabooData = null;
  let lastEndSignalId = state.timer.endSignalId || 0;
  let animationFrameId = null;

  const els = {
    miniScoreboard: document.querySelector("#miniScoreboard"),
    stage: document.querySelector("#stage"),
    stageKicker: document.querySelector("#stageKicker"),
    stageTitle: document.querySelector("#stageTitle"),
    stageSubtitle: document.querySelector("#stageSubtitle"),
    bigScoreboard: document.querySelector("#bigScoreboard"),
    bigTimer: document.querySelector("#bigTimer"),
    bigTimerValue: document.querySelector("#bigTimerValue"),
    timerStripValue: document.querySelector("#timerStripValue"),
    timerProgress: document.querySelector("#timerProgress")
  };

  const gameExtra = document.createElement("div");
  gameExtra.id = "gameExtra";
  gameExtra.className = "game-extra";
  els.stage.appendChild(gameExtra);

  QuizSync.init();

  QuizSync.subscribe(message => {
    if (message?.type === "state" && message.payload) {
      state = message.payload;
      QuizState.save(state);
      handleTimerEndSignal();
      render();
    }

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

  function getTeamName(teamId) {
    return state.teams.find(t => t.id === teamId)?.name || teamId || "—";
  }

  function getTabooTaskByGroup(groupId) {
    if (!tabooData || !groupId?.startsWith("task-")) return null;
    const order = Number(groupId.replace("task-", ""));
    return tabooData.tasks.find(task => task.order === order) || null;
  }

  function getRemainingSeconds() {
    if (!state.timer.running || !state.timer.startedAt) {
      return Math.max(0, state.timer.remaining);
    }

    const elapsed = (Date.now() - state.timer.startedAt) / 1000;
    return Math.max(0, state.timer.duration - elapsed);
  }

  function formatTime(seconds) {
    const whole = Math.ceil(seconds);
    const m = String(Math.floor(whole / 60)).padStart(2, "0");
    const s = String(whole % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function renderTeams() {
    els.miniScoreboard.innerHTML = "";
    els.miniScoreboard.style.setProperty("--team-count", state.teams.length);

    state.teams.forEach(team => {
      const item = document.createElement("div");
      item.className = "mini-team";
      if (team.id === state.activeTeamId) item.classList.add("active");

      const name = document.createElement("div");
      name.className = "mini-team-name";
      name.textContent = team.name;

      const score = document.createElement("div");
      score.className = "mini-team-score";
      score.textContent = team.score;

      item.append(name, score);
      els.miniScoreboard.appendChild(item);
    });
  }

  function renderBigScoreboard() {
    els.bigScoreboard.innerHTML = "";

    state.teams
      .slice()
      .sort((a, b) => b.score - a.score)
      .forEach(team => {
        const row = document.createElement("div");
        row.className = "big-score-row";

        const name = document.createElement("div");
        name.className = "big-score-row-name";
        name.textContent = team.name;

        const score = document.createElement("div");
        score.className = "big-score-row-score";
        score.textContent = team.score;

        row.append(name, score);
        els.bigScoreboard.appendChild(row);
      });
  }

  function getGameSceneDescription() {
    const game = structure.games.find(g => g.id === state.current.gameId);
    const group = game?.groups.find(g => g.id === state.current.groupId);
    const scene = group?.scenes.find(s => s.id === state.current.sceneId);

    return {
      game,
      group,
      scene,
      gameTitle: game?.title || "Игра",
      groupTitle: group?.title || "Раздел",
      sceneTitle: scene?.title || "Сцена"
    };
  }

  function clearGameExtra() {
    gameExtra.innerHTML = "";
    gameExtra.className = "game-extra";
  }

  function renderTabooScene(d) {
    clearGameExtra();

    if (!tabooData) {
      els.stageKicker.textContent = "Ошибка";
      els.stageTitle.textContent = "Taboo не загружено";
      els.stageSubtitle.textContent = "Проверьте data/taboo.json";
      return true;
    }

    if (d.group?.id === "intro" && d.scene?.id === "title") {
      els.stageKicker.textContent = `Конкурс №${tabooData.competitionNumber}`;
      els.stageTitle.textContent = tabooData.title;
      els.stageSubtitle.textContent = tabooData.subtitle;
      return true;
    }

    if (d.group?.id === "intro" && d.scene?.id === "rules") {
      els.stageKicker.textContent = `Конкурс №${tabooData.competitionNumber} · ${tabooData.title}`;
      els.stageTitle.textContent = "Правила";
      els.stageSubtitle.textContent = "";

      const list = document.createElement("ol");
      list.className = "rules-list";

      tabooData.rules.forEach(rule => {
        const li = document.createElement("li");
        li.textContent = rule;
        list.appendChild(li);
      });

      gameExtra.classList.add("rules-extra");
      gameExtra.appendChild(list);
      return true;
    }

    if (d.group?.id === "results") {
      els.stageKicker.textContent = `Конкурс №${tabooData.competitionNumber} · ${tabooData.title}`;
      els.stageTitle.textContent = "Конкурс завершён";
      els.stageSubtitle.textContent = "Можно посмотреть общий счёт";
      return true;
    }

    const task = getTabooTaskByGroup(d.group?.id);
    if (!task) return false;

    const teamName = getTeamName(task.teamId);

    if (d.scene?.id === "prompt") {
      els.stageKicker.textContent = `${tabooData.title} · Задание ${task.order} / ${tabooData.tasks.length}`;
      els.stageTitle.textContent = "???";
      els.stageSubtitle.textContent = `Объясняет команда «${teamName}»`;

      const chip = document.createElement("div");
      chip.className = "round-chip";
      chip.textContent = `Круг ${task.round}`;
      gameExtra.appendChild(chip);
      return true;
    }

    if (d.scene?.id === "answer") {
      els.stageKicker.textContent = `${tabooData.title} · Ответ ${task.order} / ${tabooData.tasks.length}`;
      els.stageTitle.textContent = task.answer;
      els.stageSubtitle.textContent = `Объясняла команда «${teamName}»`;

      const chip = document.createElement("div");
      chip.className = "answer-chip";
      chip.textContent = "Правильный ответ";
      gameExtra.appendChild(chip);
      return true;
    }

    return false;
  }

  function renderStage() {
    document.body.dataset.systemScreen =
      state.current.type === "system" ? state.current.systemId : "";

    els.bigScoreboard.classList.add("hidden");
    els.bigTimer.classList.add("hidden");
    clearGameExtra();

    if (state.current.type === "system") {
      const id = state.current.systemId;

      if (id === "welcome") {
        els.stageKicker.textContent = "День именинника";
        els.stageTitle.textContent = "Сентябрь";
        els.stageSubtitle.textContent = "Добро пожаловать!";
      }

      if (id === "scoreboard") {
        els.stageKicker.textContent = "Текущий счёт";
        els.stageTitle.textContent = "Табло";
        els.stageSubtitle.textContent = "";
        renderBigScoreboard();
        els.bigScoreboard.classList.remove("hidden");
      }

      if (id === "timer") {
        els.bigTimer.classList.remove("hidden");
      }

      if (id === "pause") {
        els.stageKicker.textContent = "Небольшая пауза";
        els.stageTitle.textContent = "Скоро продолжим";
        els.stageSubtitle.textContent = "";
      }

      return;
    }

    const d = getGameSceneDescription();

    if (d.game?.id === "game-2" && renderTabooScene(d)) {
      return;
    }

    els.stageKicker.textContent = d.gameTitle;
    els.stageTitle.textContent = d.groupTitle;
    els.stageSubtitle.textContent = d.sceneTitle;
  }

  function renderTimer() {
    const remaining = getRemainingSeconds();
    const duration = Math.max(1, state.timer.duration || 1);
    const ratio = Math.max(0, Math.min(1, remaining / duration));

    const formatted = formatTime(remaining);
    els.timerStripValue.textContent = formatted;
    els.bigTimerValue.textContent = formatted;
    els.timerProgress.style.width = `${ratio * 100}%`;
  }

  function beep() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = 220;
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.7);

      osc.onended = () => ctx.close();
    } catch (error) {
      console.warn("Не удалось воспроизвести сигнал таймера", error);
    }
  }

  function handleTimerEndSignal() {
    const signal = state.timer.endSignalId || 0;

    if (signal > lastEndSignalId) {
      lastEndSignalId = signal;
      if (state.timer.soundEnabled) beep();
    }
  }

  function render() {
    renderTeams();
    renderStage();
    renderTimer();
  }

  function paintLoop() {
    renderTimer();
    animationFrameId = requestAnimationFrame(paintLoop);
  }

  window.addEventListener("storage", event => {
    if (event.key === QuizState.STORAGE_KEY) {
      state = QuizState.load();
      handleTimerEndSignal();
      render();
    }
  });

  async function init() {
    await loadGameData();
    render();
    paintLoop();
    QuizSync.requestState();
  }

  init();
})();
