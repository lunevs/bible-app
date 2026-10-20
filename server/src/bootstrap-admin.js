import { db, now } from './db.js';
import { hashPassword, normalizeLogin } from './auth.js';

// После первоначального запуска логин администратора может измениться.
export function ensureBootstrapAdmin(login, password) {
  const binding = db.prepare('SELECT user_id FROM bootstrap_admin WHERE id = 1').get();
  if (binding) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(binding.user_id);
    if (user?.role !== 'admin') throw new Error('Первый администратор недоступен. Проверьте базу данных.');
    return false;
  }
  const created = createAdmin(login, password);
  const user = db.prepare('SELECT id FROM users WHERE login_key = ?').get(normalizeLogin(login));
  db.prepare('INSERT INTO bootstrap_admin (id, user_id) VALUES (1, ?)').run(user.id);
  return created;
}

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
