// Интеграционные тесты API (критерии приёмки ТЗ, раздел 12).
//
// Работают на ОТДЕЛЬНОЙ временной базе (os.tmpdir) и случайном порту —
// продовую базу не трогают. Все тестовые пользователи имеют префикс `test_`,
// а файл временной БД удаляется в хуке after().
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `bible-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = dbPath;
process.env.PORT = '0';
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_LOGIN = 'admin';
process.env.ADMIN_PASSWORD = 'admin123';

const { server } = await import('../src/index.js');
await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
const base = `http://127.0.0.1:${server.address().port}`;
const { config } = await import('../src/config.js');

// Мини-клиент с ручным хранением cookie.
function makeClient() {
  let cookie = '';
  return async (method, pathname, body) => {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + pathname, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (set.length) cookie = set.map((c) => c.split(';')[0]).join('; ');
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    return { status: res.status, data };
  };
}

after(() => {
  server.close();
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) fs.rmSync(f, { force: true });
});

// --- Регистрация / вход ---

test('регистрация и получение профиля', async () => {
  const c = makeClient();
  const reg = await c('POST', '/api/auth/register', { login: 'test_petr', password: '123' });
  assert.equal(reg.status, 200);
  assert.equal(reg.data.user.login, 'test_petr');
  const me = await c('GET', '/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user.login, 'test_petr');
});

test('короткий пароль отклоняется', async () => {
  const c = makeClient();
  const reg = await c('POST', '/api/auth/register', { login: 'test_short', password: '12' });
  assert.equal(reg.status, 400);
});

test('повторный логин с верным/неверным паролем, регистр не важен', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_maria', password: 'secret' });
  const bad = await c('POST', '/api/auth/login', { login: 'test_maria', password: 'wrong' });
  assert.equal(bad.status, 401);
  const ok = await c('POST', '/api/auth/login', { login: 'TEST_MARIA', password: 'secret' });
  assert.equal(ok.status, 200);
});

test('блокировка после 5 неудачных попыток', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_lockme', password: 'pass' });
  await c('POST', '/api/auth/logout');
  for (let i = 0; i < config.auth.maxFailedAttempts; i++) {
    const r = await c('POST', '/api/auth/login', { login: 'test_lockme', password: 'nope' });
    assert.equal(r.status, 401);
  }
  const locked = await c('POST', '/api/auth/login', { login: 'test_lockme', password: 'pass' });
  assert.equal(locked.status, 429);
});

// --- Планы ---

test('выбор плана и предупреждение при смене', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_planuser', password: '123' });
  const p1 = await c('POST', '/api/auth/plan', { planId: 'lite' });
  assert.equal(p1.status, 200);
  assert.equal(p1.data.user.planId, 'lite');
  const changeNoConfirm = await c('POST', '/api/auth/plan', { planId: 'hard' });
  assert.equal(changeNoConfirm.status, 409);
  const changeConfirm = await c('POST', '/api/auth/plan', { planId: 'hard', confirm: true });
  assert.equal(changeConfirm.status, 200);
  assert.equal(changeConfirm.data.user.planId, 'hard');
});

test('список планов содержит 30/50/68 записей', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_planner', password: '123' });
  const { data } = await c('GET', '/api/plans');
  const counts = Object.fromEntries(data.plans.map((p) => [p.id, p.days]));
  assert.deepEqual(counts, { lite: 30, standard: 50, hard: 68 });
});

// --- Чтение и зачёт ---

test('зачёт чтения: кламп секунд, порог и зелёный статус', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_reader', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const date = '2026-10-19'; // первый день: Мк 1:1-20, порог 30 c (минимум)

  const info = await c('GET', `/api/reading/lite/${date}`);
  assert.equal(info.status, 200);
  assert.equal(info.data.verses.length, 20);
  assert.equal(info.data.thresholdSeconds, 30);

  // Огромное число секунд клампится разумным максимумом.
  const credited = await c('POST', '/api/reading/progress', { planId: 'lite', date, seconds: 9999, reachedEnd: true });
  assert.equal(credited.data.progress.seconds, config.reading.maxSecondsPerRequest);
  assert.equal(credited.data.status, 'green');
  assert.ok(credited.data.progress.readAt);
});

test('недостаточное время не зачитывается', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_slow', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const date = '2026-10-21'; // Мк 1:21-45, порог 50 c
  const r = await c('POST', '/api/reading/progress', { planId: 'lite', date, seconds: 5, reachedEnd: true });
  assert.equal(r.data.progress.readAt, null);
  assert.equal(r.data.status, 'neutral');
});

test('достижение конца без времени не зачитывается', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_noread', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const date = '2026-10-23';
  const r = await c('POST', '/api/reading/progress', { planId: 'lite', date, seconds: 60, reachedEnd: false });
  assert.equal(r.data.progress.readAt, null);
});

// --- Заметки ---

test('личная заметка не видна другому, открытая видна и лайкается один раз', async () => {
  const author = makeClient();
  const other = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_author', password: '123' });
  await other('POST', '/api/auth/register', { login: 'test_other', password: '123' });

  await author('POST', '/api/notes', { book: 'Мк', chapter: 1, verse: 15, text: 'личное', visibility: 'personal' });
  await author('POST', '/api/notes', { book: 'Мк', chapter: 1, verse: 15, text: 'открытое', visibility: 'open' });

  const seen = await other('GET', '/api/notes?book=Мк&chapter=1&verse=15');
  assert.equal(seen.data.own.length, 0);
  assert.equal(seen.data.open.length, 1);
  assert.equal(seen.data.open[0].text, 'открытое');

  const noteId = seen.data.open[0].id;
  const like1 = await other('POST', `/api/notes/${noteId}/like`);
  assert.equal(like1.data.liked, true);
  assert.equal(like1.data.likes, 1);
  const like2 = await other('POST', `/api/notes/${noteId}/like`);
  assert.equal(like2.data.liked, false);
  assert.equal(like2.data.likes, 0);
});

test('нельзя лайкать свою заметку', async () => {
  const author = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_ego', password: '123' });
  await author('POST', '/api/notes', { book: 'Мк', chapter: 2, verse: 1, text: 'моя', visibility: 'open' });
  const mine = await author('GET', '/api/notes?book=Мк&chapter=2&verse=1');
  const id = mine.data.own[0].id;
  const r = await author('POST', `/api/notes/${id}/like`);
  assert.equal(r.status, 400);
});

// --- Лидерборд ---

test('доска лидеров: баллы и сортировка', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_lead', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  await c('POST', '/api/reading/progress', { planId: 'lite', date: '2026-10-19', seconds: 60, reachedEnd: true });
  const { data } = await c('GET', '/api/leaderboard');
  const me = data.leaderboard.find((u) => u.login === 'test_lead');
  assert.equal(me.points, 1);
  assert.equal(me.green, 1);
  // сортировка по убыванию баллов
  for (let i = 1; i < data.leaderboard.length; i++) {
    assert.ok(data.leaderboard[i - 1].points >= data.leaderboard[i].points);
  }
});

test('лайк на заметку добавляет автору 0,1 балла', async () => {
  const author = makeClient();
  const fan = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_liked_author', password: '123' });
  await author('POST', '/api/auth/plan', { planId: 'lite' });
  // автор читает день вовремя → 1 балл
  await author('POST', '/api/reading/progress', { planId: 'lite', date: '2026-10-19', seconds: 60, reachedEnd: true });
  // открытая заметка автора
  await author('POST', '/api/notes', { book: 'Мк', chapter: 1, verse: 8, text: 'мысль', visibility: 'open' });

  await fan('POST', '/api/auth/register', { login: 'test_fan', password: '123' });
  const seen = await fan('GET', '/api/notes?book=Мк&chapter=1&verse=8');
  const noteId = seen.data.open[0].id;
  await fan('POST', `/api/notes/${noteId}/like`);

  const { data } = await fan('GET', '/api/leaderboard');
  const me = data.leaderboard.find((u) => u.login === 'test_liked_author');
  assert.equal(me.likes, 1);
  assert.equal(me.likePoints, 0.1);
  assert.equal(me.readingPoints, 1);
  assert.equal(me.points, 1.1);
});

test('снятие лайка убирает балл', async () => {
  const author = makeClient();
  const fan = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_unliked_author', password: '123' });
  await author('POST', '/api/notes', { book: 'Мк', chapter: 1, verse: 9, text: 'x', visibility: 'open' });
  await fan('POST', '/api/auth/register', { login: 'test_fan2', password: '123' });
  const seen = await fan('GET', '/api/notes?book=Мк&chapter=1&verse=9');
  const noteId = seen.data.open[0].id;
  await fan('POST', `/api/notes/${noteId}/like`);
  await fan('POST', `/api/notes/${noteId}/like`); // повторный клик снимает лайк
  const { data } = await fan('GET', '/api/leaderboard');
  const me = data.leaderboard.find((u) => u.login === 'test_unliked_author');
  assert.equal(me.likes, 0);
  assert.equal(me.points, 0);
});

// --- Администратор ---

test('обычный пользователь не имеет доступа к админским маршрутам', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_simple', password: '123' });
  const r = await c('GET', '/api/admin/users');
  assert.equal(r.status, 403);
});

test('администратор видит пользователей и может сбросить пароль', async () => {
  const admin = makeClient();
  const victim = makeClient();
  await victim('POST', '/api/auth/register', { login: 'test_victim', password: 'oldpass' });
  await admin('POST', '/api/auth/login', { login: 'admin', password: 'admin123' });

  const users = await admin('GET', '/api/admin/users');
  assert.equal(users.status, 200);
  const v = users.data.users.find((u) => u.login === 'test_victim');
  assert.ok(v);

  const reset = await admin('POST', `/api/admin/users/${v.id}/reset-password`, { password: 'newpass' });
  assert.equal(reset.status, 200);

  const oldLogin = await victim('POST', '/api/auth/login', { login: 'test_victim', password: 'oldpass' });
  assert.equal(oldLogin.status, 401);
  const newLogin = await victim('POST', '/api/auth/login', { login: 'test_victim', password: 'newpass' });
  assert.equal(newLogin.status, 200);
});

test('администратор может удалить чужую открытую заметку, но не личную', async () => {
  const author = makeClient();
  const admin = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_writer', password: '123' });
  await author('POST', '/api/notes', { book: 'Лк', chapter: 2, verse: 11, text: 'открытая', visibility: 'open' });
  await author('POST', '/api/notes', { book: 'Лк', chapter: 2, verse: 12, text: 'личная', visibility: 'personal' });
  await admin('POST', '/api/auth/login', { login: 'admin', password: 'admin123' });

  const open = await author('GET', '/api/notes?book=Лк&chapter=2&verse=11');
  const openId = open.data.own[0].id;
  const delOpen = await admin('DELETE', `/api/admin/notes/${openId}`);
  assert.equal(delOpen.status, 200);

  const personal = await author('GET', '/api/notes?book=Лк&chapter=2&verse=12');
  const personalId = personal.data.own[0].id;
  const delPersonal = await admin('DELETE', `/api/admin/notes/${personalId}`);
  assert.equal(delPersonal.status, 400); // только открытые
});
