// Маршруты чтения: отрисовка отрывка и приём событий reading-progress.
import express from 'express';
import { config } from '../config.js';
import { db, now } from '../db.js';
import { getPlan, getDay, listPlans } from '../plans.js';
import { getPassageVerses, getVerse, verseCount } from '../bible.js';
import { computeStatus, todayLocal } from '../status.js';
import { userDays } from '../progress.js';
import { requireAuth } from '../auth.js';

export const readingRouter = express.Router();

// Порог активного времени для засчитывания чтения (раздел 6 ТЗ).
export function thresholdFor(ranges) {
  const n = verseCount(ranges);
  return Math.max(config.reading.minSeconds, config.reading.secondsPerVerse * n);
}

// Карта «у меня есть заметка к стиху» для отрывка: { 'book:chapter:verse': {count, personal} }.
function myNoteMap(userId, verses) {
  if (!verses.length) return {};
  const chapters = [...new Set(verses.map((v) => `${v.book}\u0000${v.chapter}`))];
  const conds = chapters.map(() => '(book = ? AND chapter = ?)').join(' OR ');
  const params = [userId];
  for (const c of chapters) {
    const [book, chapter] = c.split('\u0000');
    params.push(book, Number(chapter));
  }
  const rows = db
    .prepare(
      `SELECT book, chapter, verse, visibility FROM notes
       WHERE user_id = ? AND (${conds})`
    )
    .all(...params);

  const wanted = new Set(verses.map((v) => `${v.book}:${v.chapter}:${v.verse}`));
  const map = {};
  for (const r of rows) {
    const key = `${r.book}:${r.chapter}:${r.verse}`;
    if (!wanted.has(key)) continue;
    if (!map[key]) map[key] = { count: 0, personal: false };
    map[key].count += 1;
    if (r.visibility === 'personal') map[key].personal = true;
  }
  return map;
}

// Список планов (доступен всем, но для выбора достаточно авторизации).
readingRouter.get('/plans', requireAuth, (_req, res) => {
  res.json({
    plans: listPlans().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      days: p.days.length,
      books: [...new Set(p.days.flatMap((d) => d.passage.ranges.map((r) => r.book)))],
    })),
  });
});

// Сводка «сегодня + ближайшие» для главного экрана.
readingRouter.get('/reading/today/:planId', requireAuth, (req, res) => {
  const plan = getPlan(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'План не найден' });

  const days = userDays(req.user, plan.id).map((d, i) => ({
    ...d,
    label: plan.days[i].passage.label,
  }));
  const today = todayLocal();
  const todayEntry = days.find((d) => d.date === today) || null;
  const afterToday = days.filter((d) => d.date > today);
  const upcoming = afterToday.slice(0, 7);
  const past = days.filter((d) => d.date < today);
  const isRead = (d) => d.status === 'green' || d.status === 'blue';
  // Первый непрочитанный отрывок ПОСЛЕ сегодняшнего (или ближайший, если всё прочитано).
  const nextUnread = afterToday.find((d) => !isRead(d)) || afterToday[0] || null;

  res.json({ planId: plan.id, planName: plan.name, today: todayEntry, upcoming, past, nextUnread });
});

// Данные записи плана на дату: подпись, диапазоны, стихи, главный стих, порог, статус.
readingRouter.get('/reading/:planId/:date', requireAuth, (req, res) => {
  const { planId, date } = req.params;
  const plan = getPlan(planId);
  const day = getDay(planId, date);
  if (!plan || !day) return res.status(404).json({ error: 'Запись не найдена' });

  const prog = db
    .prepare('SELECT seconds, reached_end, read_at FROM reading_progress WHERE user_id = ? AND plan_id = ? AND plan_date = ?')
    .get(req.user.id, planId, date);

  const status = computeStatus({
    date,
    readAt: prog?.read_at ?? null,
    participationDate: req.user.plan_started_at,
  });

  const verses = getPassageVerses(day.passage.ranges);

  res.json({
    planId,
    planName: plan.name,
    date,
    label: day.passage.label,
    ranges: day.passage.ranges,
    thoughts: day.thought || null,
    mainVerse: day.mainVerse,
    special: day.special || null,
    verses,
    myNotes: myNoteMap(req.user.id, verses),
    mainVerseText: day.mainVerse
      ? getVerse(day.mainVerse.book, day.mainVerse.chapter, day.mainVerse.verse)
      : null,
    thresholdSeconds: thresholdFor(day.passage.ranges),
    progress: {
      seconds: prog?.seconds || 0,
      reachedEnd: !!prog?.reached_end,
      readAt: prog?.read_at ?? null,
    },
    status,
  });
});

// Приём событий прогресса чтения. Сервер сам решает, засчитывать ли запись.
readingRouter.post('/reading/progress', requireAuth, (req, res) => {
  const planId = String(req.body?.planId || '');
  const date = String(req.body?.date || '');
  const day = getDay(planId, date);
  if (!day) return res.status(404).json({ error: 'Запись не найдена' });

  // Доверяем клиенту ограниченно: секунды за один запрос клампятся максимумом.
  let delta = Math.floor(Number(req.body?.seconds) || 0);
  if (delta < 0) delta = 0;
  if (delta > config.reading.maxSecondsPerRequest) delta = config.reading.maxSecondsPerRequest;
  const reachedEnd = req.body?.reachedEnd === true ? 1 : 0;

  const ts = now();
  const existing = db
    .prepare('SELECT seconds, reached_end, read_at FROM reading_progress WHERE user_id = ? AND plan_id = ? AND plan_date = ?')
    .get(req.user.id, planId, date);

  const seconds = (existing?.seconds || 0) + delta;
  const reached = Math.max(existing?.reached_end || 0, reachedEnd);
  const threshold = thresholdFor(day.passage.ranges);

  let readAt = existing?.read_at ?? null;
  if (readAt == null && reached === 1 && seconds >= threshold) readAt = ts;

  if (existing) {
    db.prepare(
      `UPDATE reading_progress
       SET seconds = ?, reached_end = ?, read_at = ?, updated_at = ?
       WHERE user_id = ? AND plan_id = ? AND plan_date = ?`
    ).run(seconds, reached, readAt, ts, req.user.id, planId, date);
  } else {
    db.prepare(
      `INSERT INTO reading_progress (user_id, plan_id, plan_date, seconds, reached_end, read_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(req.user.id, planId, date, seconds, reached, readAt, ts);
  }

  const status = computeStatus({
    date,
    readAt,
    participationDate: req.user.plan_started_at,
  });

  res.json({
    progress: { seconds, reachedEnd: !!reached, readAt },
    thresholdSeconds: threshold,
    status,
  });
});
