(() => {
  let state = QuizState.load();
  let employees = [];

  const stage = document.querySelector("#stage");
  const kicker = document.querySelector("#stageKicker");
  const title = document.querySelector("#stageTitle");
  const subtitle = document.querySelector("#stageSubtitle");
  const bigScoreboard = document.querySelector("#bigScoreboard");
  const bigTimer = document.querySelector("#bigTimer");

  if (!stage) {
    console.warn("Team roster screen module: stage is unavailable.");
    return;
  }

  function employeeMap() {
    return new Map(employees.map(employee => [employee.id, employee]));
  }

  function shortName(fullName) {
    const parts = String(fullName || "").trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return fullName || "Без имени";
  }

  function ensureExtra() {
    let extra = document.querySelector("#gameExtra");

    if (!extra) {
      extra = document.createElement("div");
      extra.id = "gameExtra";
      stage.appendChild(extra);
    }

    return extra;
  }

  function clearRosterMode() {
    document.body.classList.remove("team-roster-mode");
  }

  function renderRoster() {
    state = QuizState.load();

    const active =
      state.current?.type === "system" &&
      state.current?.systemId === "team-roster";

    if (!active) {
      clearRosterMode();
      return;
    }

    document.body.classList.add("team-roster-mode");
    document.body.dataset.systemScreen = "team-roster";

    bigScoreboard?.classList.add("hidden");
    bigTimer?.classList.add("hidden");

    kicker.textContent = "День именинника";
    title.textContent = "Состав команд";
    subtitle.textContent = "Найдите себя перед началом игры";

    const extra = ensureExtra();
    extra.innerHTML = "";
    extra.className = "game-extra team-roster-extra";

    const assignments = state.teamAssignments;
    const map = employeeMap();

    if (!assignments?.byTeam) {
      extra.innerHTML = '<div class="team-roster-empty">Составы команд ещё не сформированы.</div>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "team-roster-grid";
    grid.style.setProperty("--team-count", Math.max(1, state.teams.length));

    state.teams.forEach(team => {
      const ids = Array.isArray(assignments.byTeam[team.id])
        ? assignments.byTeam[team.id]
        : [];

      const card = document.createElement("section");
      card.className = "team-roster-card";
      if (team.id === assignments.remoteTeamId) {
        card.classList.add("remote-team");
      }

      const heading = document.createElement("div");
      heading.className = "team-roster-card-heading";
      heading.innerHTML = `
        <div>
          <span>${team.id === assignments.remoteTeamId ? "🌐 Удалённая команда" : "Команда"}</span>
          <strong>${team.name}</strong>
        </div>
        <b>${ids.length}</b>
      `;

      const list = document.createElement("ol");
      list.className = "team-roster-members";

      ids.forEach(id => {
        const employee = map.get(id);
        if (!employee) return;

        const item = document.createElement("li");
        item.textContent = shortName(employee.name);
        list.appendChild(item);
      });

      if (!list.children.length) {
        const empty = document.createElement("div");
        empty.className = "team-roster-card-empty";
        empty.textContent = "Нет участников";
        card.append(heading, empty);
      } else {
        card.append(heading, list);
      }

      grid.appendChild(card);
    });

    extra.appendChild(grid);
  }

  async function init() {
    try {
      const response = await fetch("data/employees.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      employees = Array.isArray(data.employees) ? data.employees : [];
    } catch (error) {
      console.error("Не удалось загрузить data/employees.json для табло команд", error);
    }

    QuizSync.init();

    QuizSync.subscribe(message => {
      if (message?.type === "state" && message.payload) {
        state = message.payload;
        renderRoster();
      }
    });

    window.addEventListener("storage", event => {
      if (event.key === QuizState.STORAGE_KEY) {
        state = QuizState.load();
        renderRoster();
      }
    });

    renderRoster();
  }

  init();
})();
