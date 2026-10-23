// Сводка прогресса пользователя по плану: статусы и баллы.
import { getPlan } from './plans.js';
import { computeStatus, statusPoints } from './status.js';
import { db } from './db.js';

export function progressMap(userId, planId) {
  const rows = db
    .prepare('SELECT plan_date, seconds, reached_end, read_at FROM reading_progress WHERE user_id = ? AND plan_id = ?')
    .all(userId, planId);
  const map = new Map();
  for (const r of rows) {
    map.set(r.plan_date, {
      seconds: r.seconds,
      reachedEnd: !!r.reached_end,
      readAt: r.read_at,
    });
  }
  return map;
}

// Список записей плана со статусами и баллами для пользователя.
export function userDays(user, planId = user.plan_id, nowTs = Date.now()) {
  const plan = getPlan(planId);
  if (!plan) return [];
  const pm = progressMap(user.id, planId);
  return plan.days.map((d) => {
    const p = pm.get(d.date) || {};
    const status = computeStatus({
      date: d.date,
      readAt: p.readAt ?? null,
      participationDate: user.plan_started_at,
      now: nowTs,
    });
    return {
      date: d.date,
      status,
      points: statusPoints(status),
      seconds: p.seconds || 0,
      readAt: p.readAt ?? null,
    };
  });
}

// Один балл за каждый лайк, полученный на заметки или ответы пользователя.
export const LIKE_POINTS = 1;

// Сколько лайков всего получили заметки и ответы пользователя.
export function likesReceived(userId) {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM likes l JOIN notes n ON n.id = l.note_id WHERE n.user_id = ?) +
         (SELECT COUNT(*) FROM answer_likes al JOIN question_answers a ON a.id = al.answer_id WHERE a.user_id = ?) AS c`
    )
    .get(userId, userId);
  return row?.c || 0;
}

export function userSummary(user, planId = user.plan_id, nowTs = Date.now()) {
  const days = userDays(user, planId, nowTs);
  let readingPoints = 0;
  let green = 0;
  let blue = 0;
  let missed = 0;
  for (const d of days) {
    readingPoints += d.points;
    if (d.status === 'green') green++;
    else if (d.status === 'blue') blue++;
    else if (d.status === 'missed') missed++;
  }
  const likes = likesReceived(user.id);
  const likePoints = likes * LIKE_POINTS;
  // Учитываются все существующие заметки автора независимо от видимости и плана.
  const notePoints = db.prepare('SELECT COUNT(*) c FROM notes WHERE user_id = ?').get(user.id).c;
  return {
    points: readingPoints + likePoints + notePoints,
    readingPoints,
    likes,
    likePoints,
    notePoints,
    green,
    blue,
    missed,
    total: days.length,
  };
}
