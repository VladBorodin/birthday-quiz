(() => {
  let data = null;
  let state = QuizState.load();
  let imageResizeObserver = null;
  let imageFitFrame = null;

  const els = {
    stage: document.querySelector("#stage"),
    stageKicker: document.querySelector("#stageKicker"),
    stageTitle: document.querySelector("#stageTitle"),
    stageSubtitle: document.querySelector("#stageSubtitle"),
    bigScoreboard: document.querySelector("#bigScoreboard"),
    bigTimer: document.querySelector("#bigTimer")
  };

  if (!els.stage) {
    console.warn("Image quiz screen module: stage is unavailable.");
    return;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function gameExtra() {
    return document.querySelector("#gameExtra");
  }

  function getTask(groupId) {
    if (!data || !groupId?.startsWith("task-")) return null;
    const order = Number(groupId.replace("task-", ""));
    return data.tasks.find(task => task.order === order) || null;
  }

  function clearExtra() {
    if (imageResizeObserver) {
      imageResizeObserver.disconnect();
      imageResizeObserver = null;
      imageFitFrame = null;
    }

    const extra = gameExtra();
    if (!extra) return null;
    extra.innerHTML = "";
    extra.className = "game-extra image-quiz-extra";
    return extra;
  }

  function getZoom(taskOrder) {
    const raw = state.imageQuiz?.zoomByTask?.[String(taskOrder)];
    const zoom = Number(raw);
    return Number.isFinite(zoom) ? Math.max(0.5, Math.min(1.8, zoom)) : 1;
  }

  function fitImageIntoFrame(frame, img, taskOrder) {
    if (!frame?.isConnected || !img.naturalWidth || !img.naturalHeight) return;

    const box = frame.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;

    // "contain": take the smaller scale so BOTH image dimensions fit.
    const fitScale = Math.min(
      box.width / img.naturalWidth,
      box.height / img.naturalHeight
    );

    // 100% in the admin means "automatic best fit".
    // +/- is an optional multiplier on top of that fitted size.
    const zoom = getZoom(taskOrder);
    const width = Math.max(1, img.naturalWidth * fitScale * zoom);
    const height = Math.max(1, img.naturalHeight * fitScale * zoom);

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
  }

  function watchImageFit(frame, img, taskOrder) {
    const apply = () => {
      requestAnimationFrame(() => fitImageIntoFrame(frame, img, taskOrder));
    };

    if (img.complete && img.naturalWidth) {
      apply();
    } else {
      img.addEventListener("load", apply, { once: true });
    }

    if ("ResizeObserver" in window) {
      if (imageResizeObserver) imageResizeObserver.disconnect();

      imageResizeObserver = new ResizeObserver(() => apply());
      imageResizeObserver.observe(frame);
      imageFitFrame = frame;
    } else {
      // Old-browser fallback. Modern Chromium uses ResizeObserver.
      window.addEventListener("resize", apply, { passive: true });
    }
  }

  function setImage(extra, src, alt, taskOrder) {
    const frame = document.createElement("div");
    frame.className = "image-quiz-frame";

    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.draggable = false;

    frame.appendChild(img);
    extra.appendChild(frame);

    watchImageFit(frame, img, taskOrder);
  }

  function getCurrentImage(task, sceneId) {
    if (!task) return null;

    return sceneId === "original"
      ? {
          src: task.originalImage,
          alt: `Оригинал: ${task.title}`
        }
      : {
          src: task.editedImage,
          alt: `Изменённое изображение, задание ${task.order}`
        };
  }

  function ensureModal() {
    let modal = document.querySelector("#imageQuizModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "imageQuizModal";
      modal.className = "image-quiz-modal hidden";
      modal.innerHTML = `
        <div class="image-quiz-modal-inner">
          <img class="image-quiz-modal-image" alt="">
        </div>
      `;
      document.body.appendChild(modal);
    }

    return modal;
  }

  function renderFullscreen(task, sceneId) {
    const modal = ensureModal();
    const fullscreen = state.imageQuiz?.fullscreen;

    const enabled = Boolean(
      fullscreen?.enabled &&
      fullscreen.groupId === state.current.groupId &&
      fullscreen.sceneId === state.current.sceneId
    );

    if (!enabled) {
      modal.classList.add("hidden");
      return;
    }

    const image = getCurrentImage(task, sceneId);
    if (!image) {
      modal.classList.add("hidden");
      return;
    }

    const img = modal.querySelector(".image-quiz-modal-image");
    img.src = image.src;
    img.alt = image.alt;
    modal.classList.remove("hidden");
  }

  function renderRules() {
    const extra = clearExtra();
    els.stageKicker.textContent = `Конкурс №${data.competitionNumber} · ${data.title}`;
    els.stageTitle.textContent = "Правила";
    els.stageSubtitle.textContent = "";

    const list = document.createElement("ol");
    list.className = "rules-list";

    data.rules.forEach(rule => {
      const item = document.createElement("li");
      item.textContent = rule;
      list.appendChild(item);
    });

    extra.appendChild(list);
  }

  function renderTask(task, sceneId) {
    const extra = clearExtra();
    const taskLabel = `${data.title} · Задание ${task.order} / ${data.tasks.length}`;

    if (sceneId === "prompt") {
      els.stageKicker.textContent = taskLabel;
      els.stageTitle.textContent = "Что исчезло?";
      els.stageSubtitle.textContent = "Назовите пропажу и источник изображения";
      setImage(extra, task.editedImage, `Изменённое изображение, задание ${task.order}`, task.order);
      return;
    }

    if (sceneId === "hint") {
      els.stageKicker.textContent = taskLabel;
      els.stageTitle.textContent = "Подсказка";
      els.stageSubtitle.textContent = task.hint;

      const chip = document.createElement("div");
      chip.className = "image-quiz-hint-chip";
      chip.textContent = "После подсказки — максимум 1 балл";
      extra.appendChild(chip);

      setImage(extra, task.editedImage, `Изменённое изображение с подсказкой, задание ${task.order}`, task.order);
      return;
    }

    if (sceneId === "original") {
      els.stageKicker.textContent = `${taskLabel} · Оригинал`;
      els.stageTitle.textContent = task.title;
      els.stageSubtitle.textContent = `${task.creatorLabel}: ${task.creator}${task.year ? ` · ${task.year}` : ""}`;

      setImage(extra, task.originalImage, `Оригинал: ${task.title}`, task.order);

      const answer = document.createElement("div");
      answer.className = "image-quiz-answer-chip";
      answer.innerHTML = `<span>Было удалено:</span> <strong>${escapeHtml(task.missing)}</strong>`;
      extra.appendChild(answer);
    }
  }

  function render() {
    if (!data) return;

    state = QuizState.load();

    const isImageQuiz =
      state.current.type === "game" &&
      state.current.gameId === "game-1";

    document.body.dataset.gameMode = isImageQuiz ? "image-quiz" : "";

    if (!isImageQuiz) {
      ensureModal().classList.add("hidden");
      return;
    }

    els.bigScoreboard?.classList.add("hidden");
    els.bigTimer?.classList.add("hidden");

    if (state.current.groupId === "intro") {
      ensureModal().classList.add("hidden");

      if (state.current.sceneId === "rules") {
        renderRules();
      } else {
        clearExtra();
        els.stageKicker.textContent = `Конкурс №${data.competitionNumber}`;
        els.stageTitle.textContent = data.title;
        els.stageSubtitle.textContent = data.subtitle;
      }
      return;
    }

    if (state.current.groupId === "results") {
      ensureModal().classList.add("hidden");
      clearExtra();
      els.stageKicker.textContent = `Конкурс №${data.competitionNumber} · ${data.title}`;
      els.stageTitle.textContent = "Конкурс завершён";
      els.stageSubtitle.textContent = "Можно посмотреть общий счёт";
      return;
    }

    const task = getTask(state.current.groupId);
    if (task) {
      renderTask(task, state.current.sceneId);
      renderFullscreen(task, state.current.sceneId);
    }
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

    QuizSync.init();

    // screen.js subscribes before this module, therefore its generic render
    // happens first and this module then replaces only game-1 content.
    QuizSync.subscribe(message => {
      if (message?.type === "state" && message.payload) {
        state = message.payload;
        render();
      }
    });

    window.addEventListener("storage", event => {
      if (event.key === QuizState.STORAGE_KEY) render();
    });

    render();
  }

  init();
})();
