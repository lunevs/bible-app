// Маршруты аутентификации и выбора плана.
import express from 'express';
import { config } from '../config.js';
import { db, now } from '../db.js';
import { getPlan } from '../plans.js';
import { todayLocal } from '../status.js';
import {
  normalizeLogin,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  publicUser,
  checkLock,
  registerFailedAttempt,
  resetAttempts,
  requireAuth,
} from '../auth.js';

export const authRouter = express.Router();

authRouter.post('/register', (req, res) => {
  const login = String(req.body?.login || '').trim();
  const password = String(req.body?.password || '');
  const loginKey = normalizeLogin(login);

  if (!login) return res.status(400).json({ error: 'Укажите логин' });
  if (password.length < config.auth.minPasswordLength) {
    return res.status(400).json({ error: `Пароль не короче ${config.auth.minPasswordLength} символов` });
  }

  const exists = db.prepare('SELECT id FROM users WHERE login_key = ?').get(loginKey);
  if (exists) return res.status(409).json({ error: 'Такой логин уже занят' });

  const ts = now();
  const info = db
    .prepare(
      'INSERT INTO users (login, login_key, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(login, loginKey, hashPassword(password), 'user', ts);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  createSession(res, user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post('/login', (req, res) => {
  const login = String(req.body?.login || '').trim();
  const password = String(req.body?.password || '');
  const loginKey = normalizeLogin(login);

  const lock = checkLock(loginKey);
  if (lock.locked) {
    const minutes = Math.ceil((lock.until - now()) / 60000);
    return res.status(429).json({ error: `Слишком много попыток. Повторите через ${minutes} мин.` });
  }

  const user = db.prepare('SELECT * FROM users WHERE login_key = ?').get(loginKey);
  if (!user || !verifyPassword(password, user.password_hash)) {
    registerFailedAttempt(loginKey);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  resetAttempts(loginKey);
  createSession(res, user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Выбор или смена плана. plan_started_at = сегодня (день выбора) при смене.
authRouter.post('/plan', requireAuth, (req, res) => {
  const planId = String(req.body?.planId || '');
  const plan = getPlan(planId);
  if (!plan) return res.status(400).json({ error: 'Неизвестный план' });

  const changing = req.user.plan_id && req.user.plan_id !== planId;
  if (changing && req.body?.confirm !== true) {
    return res.status(409).json({
      error: 'plan-change-confirmation-required',
      message:
        'При смене плана началом участия в новом плане станет сегодняшний день, а отметки по новому плану начнут считаться заново.',
    });
  }

  const startedAt = todayLocal();
  db.prepare('UPDATE users SET plan_id = ?, plan_started_at = ? WHERE id = ?').run(
    planId,
    startedAt,
    req.user.id
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});
