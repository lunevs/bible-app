import test, { after, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_PATH = ':memory:';
process.env.PORT = '0';
process.env.ADMIN_LOGIN = '';
process.env.ADMIN_PASSWORD = '';
process.env.TEST_PLAN_START = '';
delete process.env.PLANS_FILE;
mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-25T10:00:00Z') });
const { db } = await import('../src/db.js');
const { hashPassword } = await import('../src/auth.js');
db.prepare('INSERT INTO users (login, login_key, password_hash, role, created_at, plan_id, plan_started_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run('existing', 'existing', hashPassword('123'), 'user', Date.now(), 'lite', '2026-10-19');
db.prepare('INSERT INTO reading_progress (user_id, plan_id, plan_date, seconds, reached_end, read_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
  .run(1, 'lite', '2026-10-19', 40, 1, Date.UTC(2026, 9, 19, 10), Date.now());
db.exec(`INSERT INTO notes VALUES (1, 1, 'Мф', 1, 1, 'Старая публичная заметка', 'open', 1, 1);
  INSERT INTO notes VALUES (2, 1, 'Мф', 1, 1, 'Старая личная заметка', 'personal', 1, 1);
  INSERT INTO questions VALUES (1, 1, 'Мф', 1, 1, 'Старый вопрос', 1, 1);
  INSERT INTO question_answers VALUES (1, 1, 1, 'Старый ответ', 1, 1);
  INSERT INTO likes VALUES (1, 1, 1);
  INSERT INTO answer_likes VALUES (1, 1, 1);`);
const archivedTables = ['notes', 'questions', 'question_answers', 'likes', 'answer_likes'];
const originalContent = Object.fromEntries(archivedTables.map((table) => [table,
  db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => ({ ...row })),
]));
const { server } = await import('../src/index.js');
await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
after(() => { server.closeAllConnections(); server.close(); db.close(); });
const base = `http://127.0.0.1:${server.address().port}`;
let cookie = '';
async function request(path, body) {
  const res = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.headers.get('set-cookie')) cookie = res.headers.get('set-cookie').split(';')[0];
  return { status: res.status, data: await res.json() };
}

test('существующий участник после перехода получает новый план, чистый прогресс и ноль баллов за старое чтение', async () => {
  const login = await request('/api/auth/login', { login: 'existing', password: '123' });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.planId, 'matthew14');
  const plans = await request('/api/plans');
  assert.deepEqual(plans.data.plans.map((p) => p.id), ['matthew14']);
  assert.equal((await request('/api/auth/plan', { planId: 'lite', confirm: true })).status, 400);
  assert.equal((await request('/api/progress/lite')).status, 404);
  const progress = await request('/api/progress/matthew14');
  assert.equal(progress.status, 200);
  assert.equal(progress.data.days.length, 14);
  assert.ok(progress.data.days.every((d) => d.status === 'neutral' && !d.readAt));
  const leaderboard = await request('/api/leaderboard');
  assert.equal(leaderboard.data.leaderboard[0].readingPoints, 0);
  assert.equal(leaderboard.data.leaderboard[0].points, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM reading_progress WHERE plan_id = ?').get('lite').n, 1);
  const reading = await request('/api/reading/matthew14/2026-10-26');
  assert.equal(reading.status, 200);
  assert.equal(reading.data.verses.length, 48);
  assert.equal(reading.data.thresholdSeconds, 96);
});

test('старые публикации и лайки полностью сохранены в архиве, но отсутствуют в активном API', async () => {
  for (const table of archivedTables) {
    assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0);
    const archive = db.prepare('SELECT row_data FROM archived_stage_content WHERE source_table = ? ORDER BY source_rowid').all(table);
    assert.deepEqual(archive.map((row) => JSON.parse(row.row_data)), originalContent[table]);
  }
  const feed = await request('/api/notes/feed?personal=1&public=1');
  assert.equal(feed.status, 200);
  assert.equal(feed.data.notes.length, 0);
  const questions = await request('/api/questions');
  assert.equal(questions.status, 200);
  assert.equal(questions.data.questions.length, 0);
  const verseNotes = await request('/api/notes?book=Мф&chapter=1&verse=1');
  assert.equal(verseNotes.data.own.length, 0);
  assert.equal(verseNotes.data.open.length, 0);
  assert.equal((await request('/api/questions/1/answers')).status, 404);
  assert.equal((await request('/api/notes/1/like', {})).status, 404);
});

test('новые заметки снова дают баллы и не архивируются повторно после перезапуска', async () => {
  const note = await request('/api/notes', { book: 'Мф', chapter: 1, verse: 1, text: 'Новый этап', visibility: 'personal' });
  assert.equal(note.status, 200);
  assert.ok(note.data.id > 2);
  const { archiveStageContent } = await import('../src/plan-transition.js');
  assert.equal(archiveStageContent(db, 'matthew14-2026-10-26'), 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM notes').get().n, 1);
  const leaderboard = await request('/api/leaderboard');
  assert.equal(leaderboard.data.leaderboard[0].points, 1);
  assert.equal(leaderboard.data.leaderboard[0].notePoints, 1);
});
