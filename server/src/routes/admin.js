// Маршруты администратора (раздел 3 ТЗ): список пользователей и их прогресс,
// сброс пароля, удаление чужих открытых заметок.
import express from 'express';
import { config } from '../config.js';
import { db } from '../db.js';
import { publicUser } from '../auth.js';
import { hashPassword, normalizeLogin } from '../auth.js';
import { userSummary, userDays } from '../progress.js';
import { requireAdmin } from '../auth.js';

export const adminRouter = express.Router();

adminRouter.use(requireAdmin);

adminRouter.get('/users', (_req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  res.json({
    users: users.map((u) => {
      const base = publicUser(u);
      const s = u.plan_id ? userSummary(u) : { points: 0, green: 0, blue: 0, missed: 0, total: 0 };
      return { ...base, summary: s, createdAt: u.created_at };
    }),
  });
});

adminRouter.get('/users/:id/progress', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const planId = String(req.query.planId || user.plan_id || '');
  res.json({
    user: publicUser(user),
    planId,
    days: userDays(user, planId),
  });
});

// Сброс пароля: администратор задаёт новый. Посмотреть старый невозможно.
adminRouter.post('/users/:id/reset-password', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  const password = String(req.body?.password || '');
  if (password.length < config.auth.minPasswordLength) {
    return res.status(400).json({ error: `Пароль не короче ${config.auth.minPasswordLength} символов` });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
  // Сбрасываем блокировку входа и активные сессии пользователя.
  db.prepare('DELETE FROM login_attempts WHERE login_key = ?').run(normalizeLogin(user.login));
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  res.json({ ok: true });
});

// Удаление чужой открытой заметки (модерация).
adminRouter.delete('/notes/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(Number(req.params.id));
  if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
  if (note.visibility !== 'open') {
    return res.status(400).json({ error: 'Администратор может удалять только открытые заметки' });
  }
  db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
  res.json({ ok: true });
});
