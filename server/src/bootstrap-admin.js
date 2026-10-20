import { db, now } from './db.js';
import { hashPassword, normalizeLogin } from './auth.js';

// Создаёт только новый аккаунт; существующие роли и пароли не меняет.
export function createAdmin(login, password) {
  const loginKey = normalizeLogin(login);
  if (!loginKey || !password) throw new Error('Укажите логин и пароль администратора');
  const existing = db.prepare('SELECT role FROM users WHERE login_key = ?').get(loginKey);
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error('Логин администратора занят обычным пользователем. Укажите другой ADMIN_LOGIN: повышение прав не поддерживается.');
    }
    return false;
  }
  db.prepare(
    'INSERT INTO users (login, login_key, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(login.trim(), loginKey, hashPassword(password), 'admin', now());
  return true;
}
