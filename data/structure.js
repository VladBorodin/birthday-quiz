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

  const musicQuizTaskGroups = Array.from({ length: 19 }, (_, index) => ({
    id: `task-${index + 1}`,
    title: `Трек ${index + 1}`,
    scenes: [
      { id: "prompt", title: "Угадать мелодию" },
      { id: "answer", title: "Показать ответ" }
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

          { id: "task-1", title: "Задание 1", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-2", title: "Задание 2", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-3", title: "Задание 3", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-4", title: "Задание 4", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-5", title: "Задание 5", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-6", title: "Задание 6", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-7", title: "Задание 7", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},
          { id: "task-8", title: "Задание 8", scenes: [
            { id: "prompt", title: "???" },
            { id: "answer", title: "Ответ" }
          ]},

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
        groups: [
          {
            id: "intro",
            title: "Вступление",
            scenes: [
              { id: "title", title: "Заставка конкурса" }
            ]
          }
        ]
      }
    ]
  };
})();
