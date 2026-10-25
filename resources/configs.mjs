/** Example tasks are opt-in and never mixed into an existing dataset. */
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
export const demo = {
  data: { store: ['ccm.store', { name: 'todo_demo' }], key: 'my_momentum' },
  competition: true,
  points: true,
  ignore: { tasks: [
    { title: 'Das nächste Kapitel gehört dir', notes: 'Kapitel 3 lesen und die wichtigsten Gedanken festhalten.',
      points: 20, progress: 65, startAt: new Date(now - 7 * day).toISOString(), dueAt: new Date(now + 7 * day).toISOString() },
    { title: 'Ein bisschen Übung, ein großer Schritt', notes: 'Die ersten fünf Übungsaufgaben lösen.',
      points: 10, progress: 30, startAt: new Date(now - 2 * day).toISOString(), dueAt: new Date(now + 5 * day).toISOString() },
    { title: 'Platz für einen klaren Kopf', notes: 'Schreibtisch aufräumen und die nächste Lernsession vorbereiten.',
      points: 5, progress: 0 },
  ] },
};

export const simple = { competition: false, points: false };
export const competitor = { competition: true, points: false };
export const collector = { competition: false, points: true };
