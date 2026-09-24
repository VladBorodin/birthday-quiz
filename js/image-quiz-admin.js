(() => {
  const root = document.querySelector("#gameAdminInfo");
  const api = window.AdminQuizAPI;

  if (!root || !api) {
    console.warn("Image quiz admin module: admin API or info container is unavailable.");
    return;
  }

  let data = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getTask(groupId) {
    if (!data || !groupId?.startsWith("task-")) return null;
    const order = Number(groupId.replace("task-", ""));
    return data.tasks.find(task => task.order === order) || null;
  }

  function changeScore(teamId, delta) {
    api.commit(state => {
      const team = state.teams.find(item => item.id === teamId);
      if (team) team.score += delta;
    });
  }

  function goToScene(sceneId) {
    api.commit(state => {
      if (state.current.type !== "game" || state.current.gameId !== "game-1") return;
      state.current.sceneId = sceneId;
    });
  }

  function scoreButtons(label, cssClass = "") {
    const state = api.getState();

    return `
      <div class="image-quiz-score-row ${cssClass}">
        <div class="image-quiz-score-label">${escapeHtml(label)}</div>
        <div class="image-quiz-score-buttons">
          ${state.teams.map(team => `
            <button
              type="button"
              class="button button-secondary image-quiz-score-btn"
              data-team-id="${escapeHtml(team.id)}"
            >${escapeHtml(team.name)} +1</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function bindScoreButtons() {
    root.querySelectorAll(".image-quiz-score-btn").forEach(button => {
      button.addEventListener("click", () => changeScore(button.dataset.teamId, 1));
    });
  }

  function renderIntro(state) {
    root.classList.remove("hidden");
    root.innerHTML = `
      <div class="game-info-heading">${escapeHtml(data.title)}</div>
      <div class="game-info-muted">
        ${state.current.sceneId === "rules"
          ? "На экране сейчас показывается свод правил конкурса."
          : "Заставка конкурса. Следующей сценой идёт свод правил."}
      </div>
    `;
  }

  function renderTask(state, task) {
    const sceneId = state.current.sceneId;
    const afterHint = sceneId === "hint";
    const original = sceneId === "original";

    root.classList.remove("hidden");

    root.innerHTML = `
      <div class="game-info-heading">Информация ведущего</div>

      <div class="image-quiz-meta-grid">
        <div>
          <span>Задание</span>
          <strong>${task.order} / ${data.tasks.length}</strong>
        </div>
        <div>
          <span>Тип</span>
          <strong>${escapeHtml(task.typeLabel)}</strong>
        </div>
        <div>
          <span>Год</span>
          <strong>${escapeHtml(task.year)}</strong>
        </div>
      </div>

      <div class="image-quiz-secret">
        <div>
          <span>Источник</span>
          <strong>${escapeHtml(task.title)}</strong>
        </div>
        <div>
          <span>${escapeHtml(task.creatorLabel)}</span>
          <strong>${escapeHtml(task.creator)}</strong>
        </div>
        <div class="image-quiz-missing">
          <span>Что удалено</span>
          <strong>${escapeHtml(task.missing)}</strong>
        </div>
      </div>

      <div class="image-quiz-hint-admin">
        <span>Подсказка</span>
        <p>${escapeHtml(task.hint)}</p>
      </div>

      <div class="image-quiz-admin-actions">
        ${sceneId === "prompt" ? `
          <button type="button" class="button button-secondary" data-image-action="hint">
            Показать подсказку
          </button>
        ` : ""}

        ${!original ? `
          <button type="button" class="button" data-image-action="original">
            Показать оригинал
          </button>
        ` : ""}
      </div>

      ${original ? `
        <div class="image-quiz-closed">
          Оригинал показан — задание закрыто.
        </div>
      ` : afterHint ? `
        <div class="image-quiz-warning">
          Подсказка уже показана: за всё задание теперь разыгрывается только 1 балл.
        </div>
        ${scoreButtons("Правильный ответ после подсказки")}
      ` : `
        ${scoreButtons("Кто первым назвал пропавшую деталь?")}
        ${scoreButtons("Кто первым назвал картину / фильм?")}
      `}
    `;

    root.querySelector('[data-image-action="hint"]')?.addEventListener("click", () => goToScene("hint"));
    root.querySelector('[data-image-action="original"]')?.addEventListener("click", () => goToScene("original"));
    bindScoreButtons();
  }

  function render() {
    if (!data) return;

    const state = api.getState();

    if (state.current.type !== "game" || state.current.gameId !== "game-1") {
      return;
    }

    if (state.current.groupId === "intro") {
      renderIntro(state);
      return;
    }

    if (state.current.groupId === "results") {
      root.classList.remove("hidden");
      root.innerHTML = `
        <div class="game-info-heading">${escapeHtml(data.title)}</div>
        <div class="game-info-muted">
          Конкурс завершён. При необходимости можно вывести системное «Табло».
        </div>
      `;
      return;
    }

    const task = getTask(state.current.groupId);
    if (task) renderTask(state, task);
  }

  async function init() {
    try {
      const response = await fetch("data/image-quiz.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      console.error("Не удалось загрузить data/image-quiz.json", error);
      return;
    }

    window.addEventListener("quiz:state-changed", render);

    // Current scene is normally a system screen at startup, but this also makes
    // the module robust when the page is refreshed in the middle of the contest.
    render();
  }

  init();
})();
