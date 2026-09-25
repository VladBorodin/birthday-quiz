(() => {
  let data = null;
  let state = QuizState.load();

  const els = {
    kicker: document.querySelector("#stageKicker"),
    title: document.querySelector("#stageTitle"),
    subtitle: document.querySelector("#stageSubtitle"),
    bigScoreboard: document.querySelector("#bigScoreboard"),
    bigTimer: document.querySelector("#bigTimer")
  };

  function gameExtra() {
    return document.querySelector("#gameExtra");
  }

  function getProfile(groupId) {
    return data?.profiles?.find(profile => profile.id === groupId) || null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderStrongMarkdown(value) {
    const safe = escapeHtml(value);
    return safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function clearExtra() {
    const extra = gameExtra();
    if (!extra) return null;
    extra.innerHTML = "";
    extra.className = "game-extra birthday-guess-extra";
    return extra;
  }

  function renderResults(extra) {
    const answers = state.birthdayGuess?.teamAnswers || {};
    const peopleById = Object.fromEntries(
      data.profiles.map(profile => [profile.answerId, profile.answerName])
    );

    const truth = document.createElement("div");
    truth.className = "birthday-truth-row";
    truth.innerHTML = data.profiles.map(profile => `
      <div class="birthday-truth-card">
        <span>Портрет ${profile.order}</span>
        <strong>${escapeHtml(profile.answerName)}</strong>
      </div>
    `).join("");

    const table = document.createElement("div");
    table.className = "birthday-result-table";

    const head = document.createElement("div");
    head.className = "birthday-result-row birthday-result-head";
    head.innerHTML = `
      <div>Команда</div>
      ${data.profiles.map(profile => `<div>№${profile.order}</div>`).join("")}
      <div>Итог</div>
    `;
    table.appendChild(head);

    state.teams.forEach(team => {
      const mapping = answers[team.id] || {};
      let correct = 0;

      const cells = data.profiles.map(profile => {
        const guessedId = mapping[profile.id];
        const ok = guessedId === profile.answerId;
        if (ok) correct += 1;

        return `
          <div class="birthday-result-cell ${ok ? "correct" : "wrong"}">
            <span>${escapeHtml(peopleById[guessedId] || "—")}</span>
            <strong>${ok ? "✓" : "✕"}</strong>
          </div>
        `;
      }).join("");

      const row = document.createElement("div");
      row.className = "birthday-result-row";
      row.innerHTML = `
        <div class="birthday-result-team">${escapeHtml(team.name)}</div>
        ${cells}
        <div class="birthday-result-total">${correct} / 4</div>
      `;
      table.appendChild(row);
    });

    extra.append(truth, table);
  }

  function render() {
    state = QuizState.load();

    const active = state.current?.type === "game" && state.current?.gameId === "game-4";

    if (!active) {
      if (document.body.dataset.gameMode === "birthday-guess") {
        delete document.body.dataset.gameMode;
      }
      return;
    }

    document.body.dataset.gameMode = "birthday-guess";
    els.bigScoreboard?.classList.add("hidden");
    els.bigTimer?.classList.add("hidden");

    const extra = clearExtra();
    if (!extra) return;

    if (!data) {
      els.kicker.textContent = "Конкурс №4";
      els.title.textContent = "Угадай именинника";
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
      els.title.textContent = "Кто есть кто?";
      els.subtitle.textContent = "Ответы команд";

      if (!state.birthdayGuess?.resultsVisible) {
        const wait = document.createElement("div");
        wait.className = "birthday-waiting-results";
        wait.textContent = "Ведущий ещё фиксирует ответы команд.";
        extra.appendChild(wait);
        return;
      }

      renderResults(extra);
      return;
    }

    const profile = getProfile(state.current.groupId);
    if (!profile) return;

    els.kicker.textContent = `${data.title} · Портрет ${profile.order} / ${data.profiles.length}`;
    els.title.textContent = `Портрет №${profile.order}`;
    els.subtitle.textContent = "Кто из именинников скрывается за этим описанием?";

    const card = document.createElement("article");
    card.className = "birthday-profile-card";
    card.innerHTML = `
      <div class="birthday-profile-audio">♪</div>
      <div class="birthday-profile-text">${renderStrongMarkdown(profile.text)}</div>
    `;
    extra.appendChild(card);
  }

  async function init() {
    try {
      const response = await fetch("data/birthday-guess.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      data = await response.json();
    } catch (error) {
      console.error("Не удалось загрузить data/birthday-guess.json", error);
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
