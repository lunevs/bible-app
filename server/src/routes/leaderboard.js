// Доска лидеров (раздел 8 ТЗ). Видна всем участникам.
import express from 'express';
import { db } from '../db.js';
import { userSummary } from '../progress.js';
import { requireAuth } from '../auth.js';

export const leaderboardRouter = express.Router();

leaderboardRouter.get('/leaderboard', requireAuth, (_req, res) => {
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

  res.json({ leaderboard: rows });
});
