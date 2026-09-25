(() => {
  let data = null;
  let state = QuizState.load();

  const els = {
    stage: document.querySelector("#stage"),
    kicker: document.querySelector("#stageKicker"),
    title: document.querySelector("#stageTitle"),
    subtitle: document.querySelector("#stageSubtitle"),
    bigScoreboard: document.querySelector("#bigScoreboard"),
    bigTimer: document.querySelector("#bigTimer")
  };

  function gameExtra() {
    return document.querySelector("#gameExtra");
  }

  function getTask(groupId) {
    if (!data || !groupId?.startsWith("task-")) return null;
    const order = Number(groupId.slice(5));
    return data.tasks.find(task => task.order === order) || null;
  }

  function clearExtra() {
    const extra = gameExtra();
    if (!extra) return null;
    extra.innerHTML = "";
    extra.className = "game-extra music-quiz-extra";
    return extra;
  }

  function addListeningCard(extra, task) {
    const tier =
      state.musicQuiz?.taskOrder === task.order
        ? state.musicQuiz?.tier
        : null;

    const pointMap = { "4": 3, "8": 2, "12": 1, "full": 1 };
    const labelMap = {
      "4": "4 секунды",
      "8": "8 секунд",
      "12": "12 секунд",
      "full": "Полный трек"
    };

    const card = document.createElement("div");
    card.className = "music-listening-card";
    card.innerHTML = `
      <div class="music-note">♪</div>
      <div class="music-track-counter">Трек ${task.order} / ${data.tasks.length}</div>
      <div class="music-listen-title">Слушаем…</div>
      <div class="music-tier-chip">
        ${tier
          ? `${labelMap[tier]} · ${pointMap[tier]} ${pointMap[tier] === 1 ? "балл" : "балла"}`
          : "Ведущий выбирает фрагмент"}
      </div>
    `;
    extra.appendChild(card);
  }

  function render() {
    state = QuizState.load();

    const active = state.current?.type === "game" && state.current?.gameId === "game-3";

    if (!active) {
      if (document.body.dataset.gameMode === "music-quiz") {
        delete document.body.dataset.gameMode;
      }
      return;
    }

    document.body.dataset.gameMode = "music-quiz";
    els.bigScoreboard?.classList.add("hidden");
    els.bigTimer?.classList.add("hidden");

    const extra = clearExtra();
    if (!extra) return;

    if (!data) {
      els.kicker.textContent = "Конкурс №3";
      els.title.textContent = "Угадай мелодию";
      els.subtitle.textContent = "Не удалось загрузить данные конкурса";
      return;
    }

    if (state.current.groupId === "intro" && state.current.sceneId === "title") {
      els.kicker.textContent = `Конкурс №${data.competitionNumber}`;
      els.title.textContent = data.title;
      els.subtitle.textContent = data.subtitle;
      return;
    }

    if (state.current.groupId === "intro" && state.current.sceneId === "rules") {
      els.kicker.textContent = `Конкурс №${data.competitionNumber} · ${data.title}`;
      els.title.textContent = "Правила";
      els.subtitle.textContent = "";

      const list = document.createElement("ol");
      list.className = "rules-list";
      data.rules.forEach(rule => {
        const item = document.createElement("li");
        item.textContent = rule;
        list.appendChild(item);
      });
      extra.appendChild(list);
      return;
    }

    if (state.current.groupId === "results") {
      els.kicker.textContent = `Конкурс №${data.competitionNumber} · ${data.title}`;
      els.title.textContent = "Конкурс завершён";
      els.subtitle.textContent = "Можно посмотреть общий счёт";
      return;
    }

    const task = getTask(state.current.groupId);
    if (!task) return;

    if (state.current.sceneId === "answer") {
      els.kicker.textContent = `${data.title} · Ответ ${task.order} / ${data.tasks.length}`;
      els.title.textContent = `${task.artist} — ${task.title}`;
      els.subtitle.textContent = "Правильный ответ";

      const answer = document.createElement("div");
      answer.className = "music-answer-card";
      answer.innerHTML = `
        <span>ИСПОЛНИТЕЛЬ</span>
        <strong>${task.artist}</strong>
        <span>ТРЕК</span>
        <strong>${task.title}</strong>
      `;
      extra.appendChild(answer);
      return;
    }

    els.kicker.textContent = `${data.title} · Трек ${task.order} / ${data.tasks.length}`;
    els.title.textContent = "Угадайте мелодию";
    els.subtitle.textContent = "Назовите исполнителя и композицию";
    addListeningCard(extra, task);
  }

  async function init() {
    try {
      const response = await fetch("data/music-quiz.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      console.error("Не удалось загрузить data/music-quiz.json", error);
      data = null;
    }

    QuizSync.subscribe(message => {
      if (message?.type === "state" && message.payload) {
        state = message.payload;
        render();
      }
    });

    window.addEventListener("storage", event => {
      if (event.key === QuizState.STORAGE_KEY) {
        state = QuizState.load();
        render();
      }
    });

    render();
  }

  init();
})();
