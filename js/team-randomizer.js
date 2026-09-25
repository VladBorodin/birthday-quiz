(() => {
  const api = window.AdminQuizAPI;
  const openBtn = document.querySelector("#openTeamRandomizerBtn");
  const showBtn = document.querySelector("#showTeamRosterBtn");

  if (!api || !openBtn || !showBtn) {
    console.warn("Team randomizer module: required admin API or buttons are unavailable.");
    return;
  }

  let employees = [];
  let birthdays = [];
  let host = null;
  let config = null;
  let draft = null;
  let modal = null;
  let remoteTeamId = null;

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLocaleLowerCase("ru-RU");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function randomIndex(maxExclusive) {
    if (maxExclusive <= 1) return 0;

    if (window.crypto?.getRandomValues) {
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

  function employeeMap() {
    return new Map(employees.map(employee => [employee.id, employee]));
  }

  function getTeams() {
    return api.getState().teams || [];
  }

  function getTeamName(teamId) {
    return getTeams().find(team => team.id === teamId)?.name || teamId || "—";
  }

  function resolveRemoteTeamId() {
    const teams = getTeams();
    const teamIds = new Set(teams.map(team => team.id));

    if (config?.remoteTeam?.teamId && teamIds.has(config.remoteTeam.teamId)) {
      return config.remoteTeam.teamId;
    }

    const remoteBirthday = birthdays.find(person =>
      person.participationMode === "remote" &&
      teamIds.has(person.teamId || person.id)
    );

    if (remoteBirthday) {
      return remoteBirthday.teamId || remoteBirthday.id;
    }

    return teams.at(-1)?.id || null;
  }

  function excludedIdentitySets() {
    const ids = new Set();
    const names = new Set();

    if (config?.exclude?.birthdayPeople !== false) {
      birthdays.forEach(person => {
        if (person.id) ids.add(person.id);
        if (person.teamId) ids.add(person.teamId);
        if (person.name) names.add(normalize(person.name));
      });
    }

    if (config?.exclude?.host !== false && host) {
      if (host.id) ids.add(host.id);
      if (host.name) names.add(normalize(host.name));
    }

    return { ids, names };
  }

  function eligibleEmployees() {
    const { ids, names } = excludedIdentitySets();

    return employees.filter(employee => {
      if (config?.exclude?.disabledEmployees !== false && employee.enabled === false) {
        return false;
      }

      if (ids.has(employee.id)) return false;
      if (names.has(normalize(employee.name))) return false;

      return true;
    });
  }

  function emptyAssignment() {
    const byTeam = {};
    getTeams().forEach(team => {
      byTeam[team.id] = [];
    });

    return {
      version: 1,
      remoteTeamId: resolveRemoteTeamId(),
      byTeam,
      excluded: [],
      generatedAt: null
    };
  }

  function normalizeSavedAssignment(saved) {
    const result = emptyAssignment();
    const eligible = eligibleEmployees();
    const eligibleIds = new Set(eligible.map(employee => employee.id));
    const used = new Set();

    if (saved?.byTeam) {
      Object.keys(result.byTeam).forEach(teamId => {
        const ids = Array.isArray(saved.byTeam[teamId]) ? saved.byTeam[teamId] : [];

        result.byTeam[teamId] = ids.filter(id => {
          if (!eligibleIds.has(id) || used.has(id)) return false;
          used.add(id);
          return true;
        });
      });
    }

    if (Array.isArray(saved?.excluded)) {
      result.excluded = saved.excluded.filter(id => {
        if (!eligibleIds.has(id) || used.has(id)) return false;
        used.add(id);
        return true;
      });
    }

    eligible.forEach(employee => {
      if (!used.has(employee.id)) result.excluded.push(employee.id);
    });

    result.remoteTeamId = resolveRemoteTeamId();
    result.generatedAt = saved?.generatedAt || null;
    return result;
  }

  function randomize(preserveExcluded = true) {
    const next = emptyAssignment();
    const eligible = eligibleEmployees();
    const preservedExcluded = preserveExcluded && draft
      ? new Set(draft.excluded)
      : new Set();

    next.excluded = eligible
      .filter(employee => preservedExcluded.has(employee.id))
      .map(employee => employee.id);

    const active = eligible.filter(employee => !preservedExcluded.has(employee.id));
    remoteTeamId = resolveRemoteTeamId();
    next.remoteTeamId = remoteTeamId;

    const remoteEmployees = active.filter(employee => employee.participationMode === "remote");
    const officeEmployees = active.filter(employee => employee.participationMode !== "remote");

    if (remoteTeamId && next.byTeam[remoteTeamId]) {
      next.byTeam[remoteTeamId] = shuffle(remoteEmployees).map(employee => employee.id);
    } else {
      next.excluded.push(...remoteEmployees.map(employee => employee.id));
    }

    let officeTeamIds = getTeams()
      .map(team => team.id)
      .filter(teamId => teamId !== remoteTeamId);

    // If no separate office teams exist, fall back to every available team.
    if (!officeTeamIds.length) {
      officeTeamIds = getTeams().map(team => team.id);
    }

    officeTeamIds = shuffle(officeTeamIds);
    const shuffledOffice = shuffle(officeEmployees);

    shuffledOffice.forEach((employee, index) => {
      const teamId = officeTeamIds[index % officeTeamIds.length];
      if (teamId) {
        next.byTeam[teamId].push(employee.id);
      } else {
        next.excluded.push(employee.id);
      }
    });

    next.generatedAt = new Date().toISOString();
    draft = next;
    renderModal();
  }

  function saveDraft() {
    if (!draft) return;

    api.commit(state => {
      state.teamAssignments = JSON.parse(JSON.stringify(draft));
    });

    closeModal();
  }

  function assignmentExists() {
    const saved = api.getState().teamAssignments;
    return Boolean(saved?.byTeam && Object.values(saved.byTeam).some(ids => Array.isArray(ids) && ids.length));
  }

  function showRoster() {
    if (!assignmentExists()) {
      openModal();
      return;
    }

    api.commit(state => {
      state.current = {
        type: "system",
        systemId: "team-roster",
        gameId: null,
        groupId: null,
        sceneId: null
      };
      state.activeTeamId = null;
    });
  }

  function ensureModal() {
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "team-randomizer-modal hidden";
    modal.innerHTML = `
      <div class="team-randomizer-dialog" role="dialog" aria-modal="true" aria-labelledby="teamRandomizerTitle">
        <div class="team-randomizer-header">
          <div>
            <div class="eyebrow">РАСПРЕДЕЛЕНИЕ УЧАСТНИКОВ</div>
            <h2 id="teamRandomizerTitle">Состав команд</h2>
          </div>
          <button type="button" class="button button-secondary" data-team-modal-action="close">Закрыть</button>
        </div>

        <div class="team-randomizer-toolbar">
          <button type="button" class="button" data-team-modal-action="reroll">🎲 Перемешать</button>
          <button type="button" class="button button-secondary" data-team-modal-action="restore">Вернуть всех</button>
          <button type="button" class="button button-secondary" data-team-modal-action="export">Скачать JSON</button>
          <div class="team-randomizer-spacer"></div>
          <button type="button" class="button" data-team-modal-action="save">Сохранить составы</button>
        </div>

        <div class="team-randomizer-note" id="teamRandomizerNote"></div>
        <div class="team-randomizer-board" id="teamRandomizerBoard"></div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();

      const actionButton = event.target.closest("[data-team-modal-action]");
      if (actionButton) {
        const action = actionButton.dataset.teamModalAction;

        if (action === "close") closeModal();
        if (action === "reroll") randomize(true);
        if (action === "restore") {
          draft.excluded = [];
          randomize(false);
        }
        if (action === "export") exportDraft();
        if (action === "save") saveDraft();
      }

      const removeButton = event.target.closest("[data-remove-employee]");
      if (removeButton) {
        moveEmployee(removeButton.dataset.removeEmployee, "excluded");
      }

      const restoreButton = event.target.closest("[data-restore-employee]");
      if (restoreButton) {
        restoreEmployee(restoreButton.dataset.restoreEmployee);
      }
    });

    modal.addEventListener("dragstart", event => {
      const card = event.target.closest("[data-employee-id]");
      if (!card) return;

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.employeeId);
      card.classList.add("dragging");
    });

    modal.addEventListener("dragend", event => {
      event.target.closest("[data-employee-id]")?.classList.remove("dragging");
      modal.querySelectorAll(".drag-over").forEach(node => node.classList.remove("drag-over"));
    });

    modal.addEventListener("dragover", event => {
      const zone = event.target.closest("[data-drop-zone]");
      if (!zone) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.classList.add("drag-over");
    });

    modal.addEventListener("dragleave", event => {
      const zone = event.target.closest("[data-drop-zone]");
      if (zone && !zone.contains(event.relatedTarget)) {
        zone.classList.remove("drag-over");
      }
    });

    modal.addEventListener("drop", event => {
      const zone = event.target.closest("[data-drop-zone]");
      if (!zone) return;

      event.preventDefault();
      zone.classList.remove("drag-over");

      const employeeId = event.dataTransfer.getData("text/plain");
      if (employeeId) moveEmployee(employeeId, zone.dataset.dropZone);
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeModal();
      }
    });

    return modal;
  }

  function openModal() {
    ensureModal();

    const saved = api.getState().teamAssignments;
    remoteTeamId = resolveRemoteTeamId();

    if (saved?.byTeam) {
      draft = normalizeSavedAssignment(saved);
    } else {
      draft = emptyAssignment();
      randomize(false);
    }

    modal.classList.remove("hidden");
    document.body.classList.add("team-modal-open");
    renderModal();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("team-modal-open");
  }

  function removeFromEverywhere(employeeId) {
    Object.values(draft.byTeam).forEach(ids => {
      const index = ids.indexOf(employeeId);
      if (index >= 0) ids.splice(index, 1);
    });

    const excludedIndex = draft.excluded.indexOf(employeeId);
    if (excludedIndex >= 0) draft.excluded.splice(excludedIndex, 1);
  }

  function moveEmployee(employeeId, target) {
    if (!draft) return;

    removeFromEverywhere(employeeId);

    if (target === "excluded") {
      draft.excluded.push(employeeId);
    } else if (draft.byTeam[target]) {
      draft.byTeam[target].push(employeeId);
    }

    renderModal();
  }

  function restoreEmployee(employeeId) {
    const employee = employeeMap().get(employeeId);
    if (!employee) return;

    if (employee.participationMode === "remote" && draft.byTeam[remoteTeamId]) {
      moveEmployee(employeeId, remoteTeamId);
      return;
    }

    const officeTeamIds = getTeams()
      .map(team => team.id)
      .filter(teamId => teamId !== remoteTeamId && draft.byTeam[teamId]);

    const target = officeTeamIds
      .slice()
      .sort((a, b) => draft.byTeam[a].length - draft.byTeam[b].length)[0]
      || getTeams()[0]?.id;

    if (target) moveEmployee(employeeId, target);
  }

  function shortName(fullName) {
    const parts = String(fullName || "").trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return fullName || "Без имени";
  }

  function employeeCard(employeeId, excluded = false) {
    const employee = employeeMap().get(employeeId);
    if (!employee) return "";

    return `
      <div class="team-member-card" draggable="true" data-employee-id="${escapeHtml(employee.id)}">
        <div class="team-member-main">
          <strong>${escapeHtml(shortName(employee.name))}</strong>
          <span>${employee.participationMode === "remote" ? "🌐 удалённо" : "🏢 офис"}</span>
        </div>
        <button
          type="button"
          class="team-member-remove"
          title="${excluded ? "Вернуть в команду" : "Не участвует"}"
          ${excluded
            ? `data-restore-employee="${escapeHtml(employee.id)}"`
            : `data-remove-employee="${escapeHtml(employee.id)}"`}
        >${excluded ? "↩" : "×"}</button>
      </div>
    `;
  }

  function renderModal() {
    if (!modal || !draft) return;

    const board = modal.querySelector("#teamRandomizerBoard");
    const note = modal.querySelector("#teamRandomizerNote");
    const teams = getTeams();

    note.innerHTML = `
      <strong>Автоматические правила:</strong>
      все удалёнщики → команда «${escapeHtml(getTeamName(remoteTeamId))}»;
      именинники и ведущий не участвуют;
      офисные сотрудники распределяются поровну между остальными командами.
      Ручное перетаскивание после жеребьёвки разрешено и считается осознанным исключением.
    `;

    const teamColumns = teams.map(team => {
      const ids = draft.byTeam[team.id] || [];
      const remoteClass = team.id === remoteTeamId ? " remote-team" : "";

      return `
        <section class="team-drop-column${remoteClass}" data-drop-zone="${escapeHtml(team.id)}">
          <div class="team-drop-heading">
            <div>
              <span>${team.id === remoteTeamId ? "🌐 Удалённая команда" : "Команда"}</span>
              <strong>${escapeHtml(team.name)}</strong>
            </div>
            <b>${ids.length}</b>
          </div>

          <div class="team-drop-members">
            ${ids.length
              ? ids.map(id => employeeCard(id)).join("")
              : '<div class="team-drop-empty">Перетащите участника сюда</div>'}
          </div>
        </section>
      `;
    }).join("");

    board.innerHTML = `
      <div class="team-drop-grid">${teamColumns}</div>

      <section class="team-drop-column excluded-column" data-drop-zone="excluded">
        <div class="team-drop-heading">
          <div>
            <span>Не участвуют</span>
            <strong>Исключённые из жеребьёвки</strong>
          </div>
          <b>${draft.excluded.length}</b>
        </div>

        <div class="team-drop-members excluded-members">
          ${draft.excluded.length
            ? draft.excluded.map(id => employeeCard(id, true)).join("")
            : '<div class="team-drop-empty">Сейчас никто не исключён</div>'}
        </div>
      </section>
    `;
  }

  function exportDraft() {
    if (!draft) return;

    const map = employeeMap();
    const state = api.getState();

    const exportData = {
      generatedAt: draft.generatedAt || new Date().toISOString(),
      remoteTeamId: draft.remoteTeamId,
      teams: state.teams.map(team => ({
        teamId: team.id,
        teamName: team.name,
        participants: (draft.byTeam[team.id] || [])
          .map(id => map.get(id))
          .filter(Boolean)
          .map(employee => ({
            id: employee.id,
            name: employee.name,
            participationMode: employee.participationMode
          }))
      })),
      excluded: draft.excluded
        .map(id => map.get(id))
        .filter(Boolean)
        .map(employee => ({
          id: employee.id,
          name: employee.name,
          participationMode: employee.participationMode
        }))
    };

    const blob = new Blob(
      [JSON.stringify(exportData, null, 2)],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = config?.exportFileName || "team-assignments.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function loadJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function init() {
    try {
      const [employeesData, birthdaysData, hostData, configData] = await Promise.all([
        loadJson("data/employees.json"),
        loadJson("data/birthdays.json"),
        loadJson("data/host.json"),
        loadJson("data/team-randomizer.json")
      ]);

      employees = Array.isArray(employeesData.employees) ? employeesData.employees : [];
      birthdays = Array.isArray(birthdaysData.birthdays) ? birthdaysData.birthdays : [];
      host = hostData.host || null;
      config = configData || {};
      remoteTeamId = resolveRemoteTeamId();
    } catch (error) {
      console.error("Не удалось загрузить данные рандомайзера команд", error);
      openBtn.disabled = true;
      showBtn.disabled = true;
      return;
    }

    openBtn.addEventListener("click", openModal);
    showBtn.addEventListener("click", showRoster);

    window.addEventListener("quiz:state-changed", () => {
      if (modal && !modal.classList.contains("hidden")) {
        remoteTeamId = resolveRemoteTeamId();
        draft = normalizeSavedAssignment(draft);
        renderModal();
      }
    });
  }

  init();
})();
