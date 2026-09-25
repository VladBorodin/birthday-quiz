(() => {
  const api = window.AdminQuizAPI;
  if (!api) {
    console.warn("Birthday guess admin: AdminQuizAPI is unavailable.");
    return;
  }

  let data = null;
  let panel = null;
  let modal = null;
  let draftAnswers = {};
  let lastSceneKey = null;

  const player = new Audio();
  player.controls = true;
  player.preload = "auto";
  player.className = "music-full-player birthday-voice-player";

  const audioCache = new Map();
  const audioErrors = new Map();

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value ?? {}));
  }

  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement("section");
    panel.id = "birthdayGuessAdminInfo";
    panel.className = "birthday-guess-admin hidden";

    const anchor = document.querySelector("#musicQuizAdminInfo") || document.querySelector("#gameAdminInfo");
    anchor?.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function getProfile(groupId) {
    return data?.profiles?.find(profile => profile.id === groupId) || null;
  }

  function getCandidates(profile) {
    return [profile.audio, ...(profile.audioAlternatives || [])].filter(Boolean);
  }

  async function cacheProfileAudio(profile) {
    if (audioCache.has(profile.id) || audioErrors.has(profile.id)) return;

    const tried = [];

    for (const path of getCandidates(profile)) {
      tried.push(path);

      try {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) continue;

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        audioCache.set(profile.id, { objectUrl, path });
        audioErrors.delete(profile.id);
        return;
      } catch (error) {
        console.warn("Не удалось проверить файл озвучки", path, error);
      }
    }

    audioErrors.set(profile.id, tried);
  }

  function attachPlayer(host, profile) {
    if (!host || !profile) return;

    const cached = audioCache.get(profile.id);
    const desiredSrc = cached?.objectUrl || profile.audio;

    if (player.dataset.profileId !== profile.id || player.src !== desiredSrc) {
      player.pause();
      player.dataset.profileId = profile.id;
      player.src = desiredSrc;
      player.load();
    }

    host.innerHTML = "";
    host.appendChild(player);
  }

  function playProfile(profile, restart = true) {
    const cached = audioCache.get(profile.id);
    const src = cached?.objectUrl || profile.audio;

    if (player.dataset.profileId !== profile.id || player.src !== src) {
      player.pause();
      player.dataset.profileId = profile.id;
      player.src = src;
      player.load();
    }

    if (restart) {
      try { player.currentTime = 0; } catch {}
    }

    const promise = player.play();
    if (promise?.catch) {
      promise.catch(error => {
        console.warn("Автовоспроизведение озвучки заблокировано.", error);
      });
    }
  }

  function stopVoice(reset = false) {
    player.pause();
    if (reset) {
      try { player.currentTime = 0; } catch {}
    }
  }

  function sceneKey(state) {
    return [
      state.current?.type,
      state.current?.gameId,
      state.current?.groupId,
      state.current?.sceneId
    ].join("|");
  }

  function candidatePeople() {
    return data.profiles.map(profile => ({
      id: profile.answerId,
      name: profile.answerName
    }));
  }

  function ensureTeamDraft(teamId) {
    if (!draftAnswers[teamId]) draftAnswers[teamId] = {};
    return draftAnswers[teamId];
  }

  function findProfileIdByBirthday(teamId, birthdayId) {
    const map = ensureTeamDraft(teamId);
    return Object.keys(map).find(profileId => map[profileId] === birthdayId) || null;
  }

  function assignAnswer(teamId, profileId, birthdayId) {
    const map = ensureTeamDraft(teamId);

    const previousProfile = findProfileIdByBirthday(teamId, birthdayId);
    if (previousProfile && previousProfile !== profileId) {
      delete map[previousProfile];
    }

    map[profileId] = birthdayId;
    renderModalBody();
  }

  function unassignBirthday(teamId, birthdayId) {
    const profileId = findProfileIdByBirthday(teamId, birthdayId);
    if (profileId) delete ensureTeamDraft(teamId)[profileId];
    renderModalBody();
  }

  function correctCount(teamId) {
    const map = ensureTeamDraft(teamId);
    return data.profiles.reduce((count, profile) => {
      return count + (map[profile.id] === profile.answerId ? 1 : 0);
    }, 0);
  }

  function teamComplete(teamId) {
    const map = ensureTeamDraft(teamId);
    return data.profiles.every(profile => Boolean(map[profile.id]));
  }

  function allComplete() {
    const state = api.getState();
    return state.teams.length > 0 && state.teams.every(team => teamComplete(team.id));
  }

  function chipHtml(teamId, person) {
    return `
      <div
        class="birthday-answer-chip"
        draggable="true"
        data-team-id="${escapeHtml(teamId)}"
        data-birthday-id="${escapeHtml(person.id)}"
      >
        <span>${escapeHtml(person.name)}</span>
      </div>
    `;
  }

  function teamEditorHtml(team) {
    const map = ensureTeamDraft(team.id);
    const people = candidatePeople();

    const assignedIds = new Set(Object.values(map));
    const bank = people
      .filter(person => !assignedIds.has(person.id))
      .map(person => chipHtml(team.id, person))
      .join("");

    const slots = data.profiles.map(profile => {
      const birthdayId = map[profile.id];
      const person = people.find(item => item.id === birthdayId);

      return `
        <div
          class="birthday-answer-slot"
          data-team-id="${escapeHtml(team.id)}"
          data-profile-id="${escapeHtml(profile.id)}"
        >
          <div class="birthday-slot-label">Портрет ${profile.order}</div>
          <div class="birthday-slot-drop">
            ${person ? chipHtml(team.id, person) : '<span>Перетащите имя сюда</span>'}
          </div>
        </div>
      `;
    }).join("");

    const complete = teamComplete(team.id);

    return `
      <section class="birthday-answer-team">
        <div class="birthday-answer-team-head">
          <strong>${escapeHtml(team.name)}</strong>
          <span class="${complete ? "complete" : ""}">
            ${complete ? "4 / 4" : `${Object.keys(map).length} / 4`}
          </span>
        </div>

        <div class="birthday-answer-grid">${slots}</div>

        <div
          class="birthday-answer-bank"
          data-team-id="${escapeHtml(team.id)}"
        >
          <span class="birthday-bank-label">Не распределены</span>
          ${bank || '<span class="birthday-bank-empty">Все ответы расставлены</span>'}
        </div>
      </section>
    `;
  }

  function renderModalBody() {
    if (!modal) return;

    const state = api.getState();
    const body = modal.querySelector("#birthdayAnswersBody");
    const publish = modal.querySelector("#birthdayPublishResultsBtn");
    if (!body || !publish) return;

    body.innerHTML = state.teams.map(teamEditorHtml).join("");
    publish.disabled = !allComplete();

    body.querySelectorAll(".birthday-answer-chip").forEach(chip => {
      chip.addEventListener("dragstart", event => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", JSON.stringify({
          teamId: chip.dataset.teamId,
          birthdayId: chip.dataset.birthdayId
        }));
      });

      chip.addEventListener("dblclick", () => {
        unassignBirthday(chip.dataset.teamId, chip.dataset.birthdayId);
      });
    });

    body.querySelectorAll(".birthday-answer-slot").forEach(slot => {
      slot.addEventListener("dragover", event => {
        event.preventDefault();
        slot.classList.add("drag-over");
      });

      slot.addEventListener("dragleave", () => slot.classList.remove("drag-over"));

      slot.addEventListener("drop", event => {
        event.preventDefault();
        slot.classList.remove("drag-over");

        try {
          const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
          if (payload.teamId !== slot.dataset.teamId) return;
          assignAnswer(slot.dataset.teamId, slot.dataset.profileId, payload.birthdayId);
        } catch (error) {
          console.warn("Не удалось обработать перетаскивание ответа.", error);
        }
      });
    });

    body.querySelectorAll(".birthday-answer-bank").forEach(bank => {
      bank.addEventListener("dragover", event => {
        event.preventDefault();
        bank.classList.add("drag-over");
      });

      bank.addEventListener("dragleave", () => bank.classList.remove("drag-over"));

      bank.addEventListener("drop", event => {
        event.preventDefault();
        bank.classList.remove("drag-over");

        try {
          const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
          if (payload.teamId !== bank.dataset.teamId) return;
          unassignBirthday(bank.dataset.teamId, payload.birthdayId);
        } catch (error) {
          console.warn("Не удалось вернуть ответ в банк.", error);
        }
      });
    });
  }

  function closeModal() {
    if (!modal) return;
    modal.remove();
    modal = null;
  }

  function openAnswersModal() {
    stopVoice(false);

    const state = api.getState();
    draftAnswers = clone(state.birthdayGuess?.teamAnswers || {});

    state.teams.forEach(team => ensureTeamDraft(team.id));

    modal = document.createElement("div");
    modal.className = "birthday-answer-modal";
    modal.innerHTML = `
      <div class="birthday-answer-dialog" role="dialog" aria-modal="true" aria-label="Ответы команд">
        <div class="birthday-answer-modal-head">
          <div>
            <div class="eyebrow">КОНКУРС №4</div>
            <h2>Ответы команд</h2>
            <p>Перетащите четыре имени по портретам для каждой команды.</p>
          </div>
          <button id="birthdayCloseModalBtn" class="button button-secondary">Закрыть</button>
        </div>

        <div id="birthdayAnswersBody" class="birthday-answers-body"></div>

        <div class="birthday-answer-modal-actions">
          <button id="birthdayResetAnswersBtn" class="button button-secondary">Сбросить ответы</button>
          <div class="birthday-answer-modal-spacer"></div>
          <button id="birthdayPublishResultsBtn" class="button" disabled>Вывести результат</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", event => {
      if (event.target === modal) closeModal();
    });

    modal.querySelector("#birthdayCloseModalBtn")?.addEventListener("click", closeModal);

    modal.querySelector("#birthdayResetAnswersBtn")?.addEventListener("click", () => {
      draftAnswers = {};
      api.getState().teams.forEach(team => ensureTeamDraft(team.id));
      renderModalBody();
    });

    modal.querySelector("#birthdayPublishResultsBtn")?.addEventListener("click", () => {
      if (!allComplete()) return;

      api.commit(stateNext => {
        stateNext.birthdayGuess = {
          ...(stateNext.birthdayGuess || {}),
          teamAnswers: clone(draftAnswers),
          resultsVisible: true,
          publishedAt: Date.now()
        };

        stateNext.current = {
          type: "game",
          systemId: null,
          gameId: "game-4",
          groupId: "results",
          sceneId: "results"
        };

        stateNext.admin.selectedGameId = "game-4";
        stateNext.admin.openGroupByGame["game-4"] = "results";
        stateNext.activeTeamId = null;
      });

      closeModal();
    });

    renderModalBody();
  }

  function render() {
    const box = ensurePanel();
    const state = api.getState();
    const active = state.current?.type === "game" && state.current?.gameId === "game-4";

    if (!active) {
      box.classList.add("hidden");
      stopVoice(false);
      lastSceneKey = null;
      return;
    }

    box.classList.remove("hidden");

    if (!data) {
      box.innerHTML = '<div class="game-info-error">Не удалось загрузить data/birthday-guess.json</div>';
      return;
    }

    const key = sceneKey(state);
    const profile = getProfile(state.current.groupId);

    if (state.current.groupId === "intro") {
      stopVoice(false);
      lastSceneKey = key;
      box.innerHTML = `
        <div class="birthday-admin-head">
          <div>
            <div class="game-info-heading">Угадай именинника</div>
            <div class="game-info-muted">Четыре музыкальных портрета. Имена зрителям не раскрываются до общего результата.</div>
          </div>
          <button class="button button-secondary birthday-open-answers-btn">Ответы команд</button>
        </div>
      `;
      box.querySelector(".birthday-open-answers-btn")?.addEventListener("click", openAnswersModal);
      return;
    }

    if (state.current.groupId === "results") {
      stopVoice(false);
      lastSceneKey = key;

      const answers = state.birthdayGuess?.teamAnswers || {};
      const resultRows = state.teams.map(team => {
        const count = data.profiles.reduce((sum, item) => sum + (answers[team.id]?.[item.id] === item.answerId ? 1 : 0), 0);
        return `<span>${escapeHtml(team.name)}: <strong>${count} / 4</strong></span>`;
      }).join("");

      box.innerHTML = `
        <div class="birthday-admin-head">
          <div>
            <div class="game-info-heading">Результаты выведены</div>
            <div class="birthday-admin-results">${resultRows}</div>
          </div>
          <button class="button button-secondary birthday-open-answers-btn">Изменить ответы</button>
        </div>
      `;
      box.querySelector(".birthday-open-answers-btn")?.addEventListener("click", openAnswersModal);
      return;
    }

    if (!profile) {
      box.innerHTML = '<div class="game-info-error">Портрет для этой сцены не найден.</div>';
      return;
    }

    const cached = audioCache.get(profile.id);
    const error = audioErrors.get(profile.id);

    box.innerHTML = `
      <div class="birthday-admin-head">
        <div>
          <div class="game-info-heading">Портрет ${profile.order} / ${data.profiles.length}</div>
          <div class="birthday-secret-answer">Ответ ведущего: <strong>${escapeHtml(profile.answerName)}</strong></div>
        </div>
        <button class="button button-secondary birthday-open-answers-btn">Ответы команд</button>
      </div>

      <div class="birthday-admin-actions">
        <button id="birthdayReplayVoiceBtn" class="button">↻ Повторить текст</button>
        <span class="birthday-audio-status ${error ? "error" : ""}">
          ${cached
            ? `Озвучка: ${escapeHtml(cached.path)}`
            : error
              ? "Озвучка пока не найдена — проверьте путь в data/birthday-guess.json"
              : "Загрузка озвучки…"}
        </span>
      </div>

      <div id="birthdayVoicePlayerHost" class="birthday-player-host"></div>
    `;

    box.querySelector(".birthday-open-answers-btn")?.addEventListener("click", openAnswersModal);
    box.querySelector("#birthdayReplayVoiceBtn")?.addEventListener("click", () => playProfile(profile, true));

    attachPlayer(box.querySelector("#birthdayVoicePlayerHost"), profile);

    if (lastSceneKey !== key) {
      lastSceneKey = key;
      playProfile(profile, true);
    }
  }

  async function init() {
    ensurePanel();

    try {
      const response = await fetch("data/birthday-guess.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      console.error("Не удалось загрузить data/birthday-guess.json", error);
      data = null;
    }

    if (data?.profiles) {
      Promise.allSettled(data.profiles.map(cacheProfileAudio)).then(render);
    }

    window.addEventListener("quiz:state-changed", render);

    window.addEventListener("beforeunload", () => {
      stopVoice(false);
      audioCache.forEach(entry => URL.revokeObjectURL(entry.objectUrl));
    });

    render();
  }

  init();
})();
