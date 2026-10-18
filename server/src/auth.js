// Аутентификация: хэширование паролей, сессии на cookie, защита от перебора.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db, now } from './db.js';

const SESSION_COOKIE = 'sid';

export const normalizeLogin = (login) => String(login || '').trim().toLowerCase();

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// --- Сессии ---

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: maxAgeMs,
    path: '/',
  };
}

export function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const created = now();
  const expires = created + config.sessionDays * 86400000;
  db.prepare(
    'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, created, expires);
  res.cookie(SESSION_COOKIE, token, cookieOptions(config.sessionDays * 86400000));
  return token;
}

export function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function userFromSession(token) {
  if (!token) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
  if (!s) return null;
  if (s.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id) || null;
}

// Публичное представление пользователя (без хэша пароля).
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    login: u.login,
    role: u.role,
    planId: u.plan_id,
    planStartedAt: u.plan_started_at,
  };
}

// Защита от перебора: блокировка по логину после серии неудач.
export function checkLock(loginKey) {
  const row = db.prepare('SELECT * FROM login_attempts WHERE login_key = ?').get(loginKey);
  if (!row) return { locked: false };
  if (row.locked_until && row.locked_until > now()) {
    return { locked: true, until: row.locked_until };
  }
  return { locked: false };
}

export function registerFailedAttempt(loginKey) {
  const ts = now();
  const windowMs = config.auth.attemptWindowMinutes * 60000;
  const row = db.prepare('SELECT * FROM login_attempts WHERE login_key = ?').get(loginKey);

  if (!row || (row.first_fail_at && ts - row.first_fail_at > windowMs)) {
    db.prepare(
      `INSERT INTO login_attempts (login_key, fail_count, first_fail_at, locked_until)
       VALUES (?, 1, ?, NULL)
       ON CONFLICT(login_key) DO UPDATE SET fail_count = 1, first_fail_at = ?, locked_until = NULL`
    ).run(loginKey, ts, ts);
    return { failCount: 1, lockedUntil: null };
  }

  const failCount = row.fail_count + 1;
  const lockedUntil =
    failCount >= config.auth.maxFailedAttempts ? ts + config.auth.lockMinutes * 60000 : null;
  db.prepare(
    'UPDATE login_attempts SET fail_count = ?, locked_until = ? WHERE login_key = ?'
  ).run(failCount, lockedUntil, loginKey);
  return { failCount, lockedUntil };
}

export function resetAttempts(loginKey) {
  db.prepare('DELETE FROM login_attempts WHERE login_key = ?').run(loginKey);
}

// --- Middleware ---

export function attachUser(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  req.user = userFromSession(token);
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Требуется вход' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Требуется вход' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Недостаточно прав' });
  next();
}
