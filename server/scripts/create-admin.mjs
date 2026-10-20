// Создание пользователя-администратора из командной строки.
// Использование: node scripts/create-admin.mjs <логин> <пароль>
import { createAdmin } from '../src/bootstrap-admin.js';

const [, , login, password] = process.argv;
if (!login || !password) {
  console.error('Использование: node scripts/create-admin.mjs <логин> <пароль>');
  process.exit(1);
}

try {
  const created = createAdmin(login, password);
  console.log(created
    ? `Администратор "${login.trim()}" создан.`
    : 'Администратор уже существует. Пароль и сессии не изменены.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
