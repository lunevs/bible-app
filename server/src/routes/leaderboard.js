// Доска лидеров (раздел 8 ТЗ). Видна всем участникам.
import express from 'express';
import { createHash } from 'node:crypto';
import { db } from '../db.js';
import { userSummary } from '../progress.js';
import { requireAuth } from '../auth.js';
import { todayLocal, endOfLocalDay } from '../status.js';

export const leaderboardRouter = express.Router();

leaderboardRouter.get('/leaderboard', requireAuth, (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  const rows = users.map((u) => {
    const s = userSummary(u);
    return {
      id: u.id,
      login: u.login,
      role: u.role,
      planId: u.plan_id,
      points: s.points,
      readingPoints: s.readingPoints,
      likes: s.likes,
      likePoints: s.likePoints,
      notePoints: s.notePoints,
      green: s.green,
      blue: s.blue,
      total: s.total,
    };
  });

  // Сортировка: баллы убыв., затем число зелёных убыв., затем имя по возрастанию.
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.green - a.green ||
      a.login.localeCompare(b.login, 'ru')
  );

  const date = todayLocal();
  // Псевдослучайный выбор на день, одинаковый на всех устройствах аккаунта.
  const choice = createHash('sha256').update(`${req.user.id}:${date}`).digest().readUInt32BE(0) % 3;
  res.json({
    leaderboard: rows,
    dailyStatus: { date, choice },
    statusRefreshInMs: Math.max(1000, endOfLocalDay(date) + 1 - Date.now()),
  });
});
