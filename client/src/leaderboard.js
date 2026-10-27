const quantileEmoji = [128519, 129321, 128515, 128522, 128578, 129300, 129320, 128532, 128549, 128557, 128561, 128564]
  .map((code) => String.fromCodePoint(code));

export function leaderboardGroups(rows) {
  const ranked = rows.filter((row) => row.points > 0).sort((a, b) => b.points - a.points);
  const scoreRanks = new Map([...new Set(ranked.map((row) => row.points))]
    .map((points, index) => [points, index]));
  return {
    ranked,
    scoreRanks,
    waiting: rows.filter((row) => row.points === 0)
      .sort((a, b) => a.login.localeCompare(b.login, 'ru', { sensitivity: 'base' })),
  };
}

export function participantStatus(groups, userId, choice) {
  if (groups.waiting.some((row) => row.id === userId)) {
    return { emoji: '🤔', text: 'Зачем откладывать на завтра, если можно начать сегодня?' };
  }
  const row = groups.ranked.find((row) => row.id === userId);
  return row && choice != null
    ? personalRankStatus(groups.scoreRanks.get(row.points), groups.scoreRanks.size, choice) : null;
}

const statusPhrases = [
  ['Постоянство - признак мастерства', 'Ежедневный шаг приводит дальше, чем редкий прыжок', 'Кто сеет каждый день, тот жнёт каждый сезон'],
  ['Терпение и труд всё перетрут', 'Кто рано встаёт, тому Бог подаёт', 'Искра разгорелась - держим огонь'],
  ['Хорошее начало - половина дела', 'Дело мастера боится', 'Движение - жизнь'],
  ['Капля камень точит', 'Без труда не вынешь и рыбку из пруда', 'Шаг за шагом - и путь пройден'],
  ['Тише едешь - дальше будешь', 'Медленно, но верно', 'Лучше поздно, чем никогда'],
  ['Знать и делать - разные вещи', 'Пора сверить курс', 'Хорошо бы собраться с мыслями'],
  ['Обещанного три года ждут', 'Гладко было на бумаге', 'Кто-то обещал начать с понедельника'],
  ['Глаза боятся, а руки делают', 'Упал - поднимись и иди дальше', 'Была бы охота, заладится работа'],
  ['Скоро сказка сказывается, да не скоро дело делается', 'Книга скучает по тебе', 'Ещё не вечер, но уже пора'],
  ['Под лежачий камень вода не течёт', 'Не поздно начать - поздно не начинать', 'Один абзац лучше, чем ничего'],
  ['Пока гром не грянет, мужик не перекрестится', 'Пожар! Спасайте план чтения', 'Горит срок, а не страница'],
  ['Всё проспишь', 'Не спи - замёрзнешь', 'Спящего льва не будят, а читателя пора'],
];

export function personalRankStatus(index, total, choice) {
  if (!Number.isInteger(choice) || choice < 0 || choice > 2) throw new RangeError('Некорректный вариант статуса');
  const badge = rankBadge(index, total);
  return { ...badge, text: statusPhrases[badge.quantile - 1][choice] };
}

// Индекс группы баллов начинается с нуля, от наибольших баллов к наименьшим.
// При числе групп меньше 12 используем лучшие уровни подряд.
export function rankBadge(index, total) {
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
    throw new RangeError('Некорректная позиция в рейтинге');
  }
  const group = total < quantileEmoji.length ? index : Math.floor(index * quantileEmoji.length / total);
  return { emoji: quantileEmoji[group], quantile: group + 1 };
}
