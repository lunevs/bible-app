// Интеграционные тесты API (критерии приёмки ТЗ, раздел 12).
//
// Работают на ОТДЕЛЬНОЙ временной базе (os.tmpdir) и случайном порту —
// продовую базу не трогают. Все тестовые пользователи имеют префикс `test_`,
// а файл временной БД удаляется в хуке after().
import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `bible-test-${Date.now()}-${process.pid}.db`);
// Календарные сценарии должны давать одинаковый результат в любой день запуска.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-19T10:00:00Z') });
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

test('смена своего пароля без старого пароля и с подтверждением', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_change_password', password: 'oldpass' });

  const mismatch = await c('POST', '/api/auth/change-password', {
    password: 'newpass',
    passwordRepeat: 'different',
  });
  assert.equal(mismatch.status, 400);

  const tooShort = await c('POST', '/api/auth/change-password', {
    password: '12',
    passwordRepeat: '12',
  });
  assert.equal(tooShort.status, 400);

  const changed = await c('POST', '/api/auth/change-password', {
    password: 'newpass',
    passwordRepeat: 'newpass',
  });
  assert.equal(changed.status, 200);

  const me = await c('GET', '/api/auth/me');
  assert.equal(me.data.user.login, 'test_change_password');

  const oldLogin = makeClient();
  assert.equal((await oldLogin('POST', '/api/auth/login', { login: 'test_change_password', password: 'oldpass' })).status, 401);
  const newLogin = makeClient();
  assert.equal((await newLogin('POST', '/api/auth/login', { login: 'test_change_password', password: 'newpass' })).status, 200);
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

test('список планов содержит четыре актуальных плана', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_planner', password: '123' });
  const { data } = await c('GET', '/api/plans');
  const counts = Object.fromEntries(data.plans.map((p) => [p.id, p.days]));
  assert.deepEqual(counts, { lite: 30, standard: 50, advanced: 50, hard: 68 });
  assert.equal(data.plans.find((p) => p.id === 'standard').name, 'Стандарт');
  // В общей рождественской записи также есть Лк 2.
  assert.deepEqual(data.plans.find((p) => p.id === 'standard').books, ['Ин', 'Лк']);
  assert.equal(data.plans.find((p) => p.id === 'advanced').name, 'Продвинутый');
  // В рождественский день ко всем планам добавляется чтение Лк 2.
  assert.deepEqual(data.plans.find((p) => p.id === 'advanced').books, ['Мк', 'Ин', 'Лк']);
});

test('прогресс по плану: все дни со статусами и подписями', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_progress', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const { status, data } = await c('GET', '/api/progress/lite');
  assert.equal(status, 200);
  assert.equal(data.planName, 'Лайт');
  assert.equal(data.days.length, 30);
  assert.ok(data.days[0].label);
  assert.ok(data.days.every((d) => 'status' in d && 'date' in d));
});

test('today отдаёт списки readDays и missedDays', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_today', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const { status, data } = await c('GET', '/api/reading/today/lite');
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.readDays));
  assert.ok(Array.isArray(data.missedDays));
});

// --- Чтение и зачёт ---

test('зачёт чтения: суммарное время ограничено порогом, зачёт даёт зелёный статус', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_reader', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const date = '2026-10-19'; // первый день: Мк 1:1-20, порог 40 секунд

  const info = await c('GET', `/api/reading/lite/${date}`);
  assert.equal(info.status, 200);
  assert.equal(info.data.verses.length, 20);
  assert.equal(info.data.thresholdSeconds, 40);

  // Одним запросом нельзя накопить больше порога отрывка.
  const credited = await c('POST', '/api/reading/progress', { planId: 'lite', date, seconds: 9999, reachedEnd: true });
  assert.equal(credited.data.progress.seconds, info.data.thresholdSeconds);
  assert.equal(credited.data.status, 'green');
  assert.ok(credited.data.progress.readAt);
});

test('недостаточное время не зачитывается', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_slow', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const date = '2026-10-21'; // Мк 1:21-45, порог 50 секунд
  const r = await c('POST', '/api/reading/progress', { planId: 'lite', date, seconds: 5, reachedEnd: true });
  assert.equal(r.data.progress.readAt, null);
  assert.equal(r.data.status, 'neutral');
});

test('активное время восстанавливает обратный таймер после повторного открытия', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_resume_timer', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  const date = '2026-10-19';

  const firstSession = await c('POST', '/api/reading/progress', {
    planId: 'lite', date, seconds: 24, reachedEnd: false,
  });
  assert.equal(firstSession.data.progress.seconds, 24);
  assert.equal(firstSession.data.progress.readAt, null);

  // GET, как при повторном входе на экран, отдаёт уже накопленные секунды.
  const reopened = await c('GET', `/api/reading/lite/${date}`);
  assert.equal(reopened.data.progress.seconds, 24);
  assert.equal(reopened.data.thresholdSeconds - reopened.data.progress.seconds, 16);

  const completed = await c('POST', '/api/reading/progress', {
    planId: 'lite', date, seconds: 16, reachedEnd: true,
  });
  assert.equal(completed.data.progress.seconds, 40);
  assert.ok(completed.data.progress.readAt);
  assert.ok(['green', 'blue'].includes(completed.data.status));

  // После достижения порога дополнительные секунды не накапливаются.
  const afterThreshold = await c('POST', '/api/reading/progress', {
    planId: 'lite', date, seconds: 30, reachedEnd: true,
  });
  assert.equal(afterThreshold.data.progress.seconds, 40);
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
test('смена логина сохраняет аккаунт, сессии и прогресс; чужой логин занять нельзя', async () => {
  const guest = makeClient();
  assert.equal((await guest('PATCH', '/api/auth/login', { login: 'renamed' })).status, 401);
  const c = makeClient();
  const secondSession = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_rename_old', password: '123' });
  await secondSession('POST', '/api/auth/login', { login: 'test_rename_old', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  await c('POST', '/api/reading/progress', { planId: 'lite', date: '2026-10-19', seconds: 24, reachedEnd: false });
  const before = (await c('GET', '/api/auth/me')).data.user;
  const progress = (await c('GET', '/api/reading/lite/2026-10-19')).data.progress;
  for (const login of ['', '   ', 42, null]) {
    assert.equal((await c('PATCH', '/api/auth/login', { login })).status, 400);
  }
  const other = makeClient();
  await other('POST', '/api/auth/register', { login: 'test_rename_taken', password: '123' });
  assert.equal((await c('PATCH', '/api/auth/login', { login: ' TEST_RENAME_TAKEN ' })).status, 409);
  const renamed = await c('PATCH', '/api/auth/login', { login: ' Test_Rename_New ' });
  assert.equal(renamed.status, 200);
  assert.deepEqual(renamed.data.user, { ...before, login: 'Test_Rename_New' });
  assert.deepEqual((await secondSession('GET', '/api/auth/me')).data.user, renamed.data.user);
  assert.deepEqual((await c('GET', '/api/reading/lite/2026-10-19')).data.progress, progress);
  assert.equal((await c('PATCH', '/api/auth/login', { login: 'test_rename_new' })).status, 200);
  assert.equal((await makeClient()('POST', '/api/auth/login', { login: 'test_rename_old', password: '123' })).status, 401);
  assert.equal((await makeClient()('POST', '/api/auth/login', { login: 'TEST_RENAME_NEW', password: '123' })).status, 200);
});

test('переключение перевода не меняет план, активное время, readAt и заметки', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_translation', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  await c('POST', '/api/reading/progress', { planId: 'lite', date: '2026-10-19', seconds: 60, reachedEnd: true });
  const created = await c('POST', '/api/notes', { book: 'Мк', chapter: 1, verse: 15, text: 'Моя заметка', visibility: 'personal' });
  const before = await c('GET', '/api/reading/lite/2026-10-19');
  const userBefore = (await c('GET', '/api/auth/me')).data.user;
  const { translations } = (await c('GET', '/api/translations')).data;
  assert.ok(translations.some((t) => t.id === 'synodal'));
  for (const { id } of translations) {
    const r = await c('GET', `/api/reading/lite/2026-10-19?translation=${id}`);
    assert.equal(r.status, 200);
    assert.equal(r.data.translation, id);
    assert.deepEqual(r.data.progress, before.data.progress);
    assert.equal(r.data.thresholdSeconds, before.data.thresholdSeconds);
    assert.equal(r.data.status, before.data.status);
    assert.deepEqual((await c('GET', '/api/auth/me')).data.user, userBefore);
    assert.ok(r.data.verses.every((v) => v.text.length > 0));
    if (id !== 'synodal') assert.notEqual(r.data.verses[0].text, before.data.verses[0].text);
    const notes = await c('GET', `/api/notes?book=Мк&chapter=1&verse=15&translation=${id}`);
    assert.ok(notes.data.own.some((n) => n.id === created.data.id && n.text === 'Моя заметка'));
  }
  assert.equal((await c('GET', '/api/reading/lite/2026-10-19?translation=unknown')).status, 400);
});

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

test('лента заметок сообщает, поставил ли пользователь лайк и своя ли заметка', async () => {
  const author = makeClient();
  const reader = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_feed_author', password: '123' });
  await reader('POST', '/api/auth/register', { login: 'test_feed_reader', password: '123' });
  const created = await author('POST', '/api/notes', { book: 'Мк', chapter: 1, verse: 16, text: 'Открытая мысль', visibility: 'open' });

  const before = await reader('GET', '/api/notes/open');
  const note = before.data.notes.find((item) => item.id === created.data.id);
  assert.ok(note);
  assert.equal(note.likedByMe, false);
  assert.equal(note.isMine, false);
  const { getVerse } = await import('../src/bible.js');
  assert.equal(note.verseText, getVerse('Мк', 1, 16).text);

  const id = note.id;
  await reader('POST', `/api/notes/${id}/like`);
  const after = await reader('GET', '/api/notes/open');
  const likedNote = after.data.notes.find((item) => item.id === id);
  assert.equal(likedNote.likedByMe, true);
  assert.equal(likedNote.likes, 1);

  const own = await author('GET', '/api/notes/open');
  const ownNote = own.data.notes.find((item) => item.id === id);
  assert.equal(ownNote.isMine, true);
  assert.equal(ownNote.likedByMe, false);
});

test('вопросы публичны, ответы загружаются отдельно и авторы управляют своими публикациями', async () => {
  const author = makeClient();
  const participant = makeClient();
  const admin = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_question_author', password: '123' });
  await participant('POST', '/api/auth/register', { login: 'test_question_participant', password: '123' });
  await admin('POST', '/api/auth/login', { login: 'admin', password: 'admin123' });

  const invalid = await author('POST', '/api/questions', { book: 'Мк', chapter: 999, verse: 1, text: 'Вопрос?' });
  assert.equal(invalid.status, 400);
  const created = await author('POST', '/api/questions', { book: 'Мк', chapter: 1, verse: 15, text: 'Что значит этот стих?' });
  assert.equal(created.status, 201);

  const feed = await participant('GET', '/api/questions');
  const question = feed.data.questions.find((item) => item.id === created.data.id);
  assert.ok(question);
  assert.equal(question.isMine, false);
  assert.equal(question.answerCount, 0);
  assert.ok(question.verseText.length > 0);
  assert.deepEqual((await participant('GET', `/api/questions/${question.id}/answers`)).data.answers, []);

  const answer = await participant('POST', `/api/questions/${question.id}/answers`, { text: 'Думаю, здесь говорится о вере.' });
  assert.equal(answer.status, 201);
  const initialAnswer = (await participant('GET', `/api/questions/${question.id}/answers`)).data.answers[0];
  assert.equal(initialAnswer.isMine, true);
  assert.equal(initialAnswer.likes, 0);
  assert.equal(initialAnswer.likedByMe, false);
  assert.equal((await participant('POST', `/api/question-answers/${answer.data.id}/like`)).status, 400);

  const answerFan = makeClient();
  await answerFan('POST', '/api/auth/register', { login: 'test_answer_fan', password: '123' });
  const answerLike = await answerFan('POST', `/api/question-answers/${answer.data.id}/like`);
  assert.deepEqual(answerLike.data, { liked: true, likes: 1 });
  const afterAnswerLike = (await participant('GET', `/api/questions/${question.id}/answers`)).data.answers[0];
  assert.equal(afterAnswerLike.likes, 1);
  assert.equal(afterAnswerLike.likedByMe, false);
  const answerAuthorSummary = (await author('GET', '/api/leaderboard')).data.leaderboard.find((item) => item.login === 'test_question_participant');
  assert.equal(answerAuthorSummary.likes, 1);
  assert.equal(answerAuthorSummary.likePoints, 1);
  assert.equal(answerAuthorSummary.points, 1);
  const removedAnswerLike = await answerFan('POST', `/api/question-answers/${answer.data.id}/like`);
  assert.deepEqual(removedAnswerLike.data, { liked: false, likes: 0 });
  const summaryAfterUnlike = (await author('GET', '/api/leaderboard')).data.leaderboard.find((item) => item.login === 'test_question_participant');
  assert.equal(summaryAfterUnlike.points, 0);

  assert.equal((await author('PATCH', `/api/questions/${question.id}`, { text: 'Уточнённый вопрос' })).status, 200);
  assert.equal((await participant('PATCH', `/api/questions/${question.id}`, { text: 'Чужая правка' })).status, 403);
  assert.equal((await author('PATCH', `/api/question-answers/${answer.data.id}`, { text: 'Правка автора ответа' })).status, 403);

  const ownAnswer = await author('POST', `/api/questions/${question.id}/answers`, { text: 'Ответ автора вопроса' });
  assert.equal((await author('PATCH', `/api/question-answers/${ownAnswer.data.id}`, { text: 'Исправленный ответ автора' })).status, 200);
  assert.equal((await author('DELETE', `/api/question-answers/${ownAnswer.data.id}`)).status, 200);

  const removed = await admin('DELETE', `/api/questions/${question.id}`);
  assert.equal(removed.status, 200);
  assert.equal((await author('GET', `/api/questions/${question.id}/answers`)).status, 404);
});

test('участник не может удалять чужой вопрос или чужой ответ', async () => {
  const author = makeClient();
  const other = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_question_owner', password: '123' });
  await other('POST', '/api/auth/register', { login: 'test_question_other', password: '123' });
  const question = await author('POST', '/api/questions', { book: 'Ин', chapter: 1, verse: 1, text: 'Почему так начинается Евангелие?' });
  const answer = await other('POST', `/api/questions/${question.data.id}/answers`, { text: 'Это вступление.' });
  assert.equal((await other('DELETE', `/api/questions/${question.data.id}`)).status, 403);
  assert.equal((await author('DELETE', `/api/question-answers/${answer.data.id}`)).status, 403);
  assert.equal((await (async () => {
    const admin = makeClient();
    await admin('POST', '/api/auth/login', { login: 'admin', password: 'admin123' });
    return admin('DELETE', `/api/question-answers/${answer.data.id}`);
  })()).status, 200);
});

// --- Лидерборд ---

test('доска лидеров доступна только с активной сессией', async () => {
  const c = makeClient();
  const anonymous = await c('GET', '/api/leaderboard');
  assert.equal(anonymous.status, 401);
  assert.deepEqual(anonymous.data, { error: 'Требуется вход' });

  await c('POST', '/api/auth/register', { login: 'test_leaderboard_auth', password: '123' });
  const authenticated = await c('GET', '/api/leaderboard');
  assert.equal(authenticated.status, 200);
  assert.ok(Array.isArray(authenticated.data.leaderboard));

  await c('POST', '/api/auth/logout');
  const loggedOut = await c('GET', '/api/leaderboard');
  assert.equal(loggedOut.status, 401);
  assert.deepEqual(loggedOut.data, { error: 'Требуется вход' });
});

test('доска лидеров: баллы и сортировка', async () => {
  const c = makeClient();
  await c('POST', '/api/auth/register', { login: 'test_lead', password: '123' });
  await c('POST', '/api/auth/plan', { planId: 'lite' });
  await c('POST', '/api/reading/progress', { planId: 'lite', date: '2026-10-19', seconds: 60, reachedEnd: true });
  const { data } = await c('GET', '/api/leaderboard');
  const me = data.leaderboard.find((u) => u.login === 'test_lead');
  assert.equal(me.points, 5);
  assert.equal(me.green, 1);
  // сортировка по убыванию баллов
  for (let i = 1; i < data.leaderboard.length; i++) {
    assert.ok(data.leaderboard[i - 1].points >= data.leaderboard[i].points);
  }
});

test('лайк добавляет 1 балл к 5 баллам за своевременное чтение', async () => {
  const author = makeClient();
  const fan = makeClient();
  await author('POST', '/api/auth/register', { login: 'test_liked_author', password: '123' });
  await author('POST', '/api/auth/plan', { planId: 'lite' });
  // автор читает день вовремя → 5 баллов
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
  assert.equal(me.likePoints, 1);
  assert.equal(me.readingPoints, 5);
  assert.equal(me.points, 6);
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
