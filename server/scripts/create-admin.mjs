// Создание пользователя-администратора из командной строки.
// Использование: node scripts/create-admin.mjs <логин> <пароль>
import { db, now } from '../src/db.js';
import { hashPassword, normalizeLogin } from '../src/auth.js';

const [, , login, password] = process.argv;
if (!login || !password) {
  console.error('Использование: node scripts/create-admin.mjs <логин> <пароль>');
  process.exit(1);
}

const loginKey = normalizeLogin(login);
const existing = db.prepare('SELECT id FROM users WHERE login_key = ?').get(loginKey);
if (existing) {
  db.prepare('UPDATE users SET role = ?, password_hash = ? WHERE id = ?').run(
    'admin',
    hashPassword(password),
    existing.id
  );
  console.log(`Пользователь "${login.trim()}" обновлён: роль admin, пароль задан.`);
} else {
  db.prepare(
    'INSERT INTO users (login, login_key, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(login.trim(), loginKey, hashPassword(password), 'admin', now());
  console.log(`Администратор "${login.trim()}" создан.`);
}
