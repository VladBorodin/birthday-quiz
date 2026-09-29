(() => {
  const imageQuizTaskGroups = Array.from({ length: 20 }, (_, index) => ({
    id: `task-${index + 1}`,
    title: `Задание ${index + 1}`,
    scenes: [
      { id: "prompt", title: "Изменённое изображение" },
      { id: "hint", title: "Подсказка" },
      { id: "original", title: "Оригинал / ответ" }
    ]
  }));

  const tabooTaskGroups = Array.from({ length: 10 }, (_, index) => ({
    id: `task-${index + 1}`,
    title: `Задание ${index + 1}`,
    scenes: [
      { id: "prompt", title: "???" },
      { id: "answer", title: "Ответ" }
    ]
  }));

  const musicQuizTaskGroups = Array.from({ length: 22 }, (_, index) => ({
    id: `task-${index + 1}`,
    title: `Трек ${index + 1}`,
    scenes: [
      { id: "prompt", title: "Угадать мелодию" },
      { id: "answer", title: "Показать ответ" }
    ]
  }));

  const birthdayGuessGroups = Array.from({ length: 5 }, (_, index) => ({
    id: `profile-${index + 1}`,
    title: `Портрет ${index + 1}`,
    scenes: [
      { id: "description", title: "Описание" }
    ]
  }));

  window.QUIZ_STRUCTURE = {
    systemScreens: [
      { id: "welcome", title: "Заставка" },
      { id: "scoreboard", title: "Табло" },
      { id: "timer", title: "Таймер" },
      { id: "pause", title: "Пауза" }
    ],

    games: [
      {
        id: "game-1",
        title: "Игра 1 — Исчезнувшая деталь",
        dataSource: "data/image-quiz.json",
        groups: [
          {
            id: "intro",
            title: "Вступление",
            scenes: [
              { id: "title", title: "Заставка конкурса" },
              { id: "rules", title: "Свод правил" }
            ]
          },
          ...imageQuizTaskGroups,
          {
            id: "results",
            title: "Завершение",
            scenes: [
              { id: "results", title: "Итоги конкурса" }
            ]
          }
        ]
      },

      {
        id: "game-2",
        title: "Игра 2 — Табу",
        dataSource: "data/taboo.json",
        groups: [
          {
            id: "intro",
            title: "Вступление",
            scenes: [
              { id: "title", title: "Заставка конкурса" },
              { id: "rules", title: "Свод правил" }
            ]
          },
          ...tabooTaskGroups,
          {
            id: "results",
            title: "Завершение",
            scenes: [
              { id: "results", title: "Итоги конкурса" }
            ]
          }
        ]
      },

      {
        id: "game-3",
        title: "Игра 3 — Угадай мелодию",
        dataSource: "data/music-quiz.json",
        groups: [
          {
            id: "intro",
            title: "Вступление",
            scenes: [
              { id: "title", title: "Заставка конкурса" },
              { id: "rules", title: "Свод правил" }
            ]
          },
          ...musicQuizTaskGroups,
          {
            id: "results",
            title: "Завершение",
            scenes: [
              { id: "results", title: "Итоги конкурса" }
            ]
          }
        ]
      },

      {
        id: "game-4",
        title: "Игра 4 — Угадай именинника",
        dataSource: "data/birthday-guess.json",
        groups: [
          {
            id: "intro",
            title: "Вступление",
            scenes: [
              { id: "title", title: "Заставка конкурса" },
              { id: "rules", title: "Свод правил" }
            ]
          },
          ...birthdayGuessGroups,
          {
            id: "results",
            title: "Завершение",
            scenes: [
              { id: "results", title: "Ответы команд" }
            ]
          }
        ]
      }
    ]
  };
})();
