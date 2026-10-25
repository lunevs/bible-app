import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { listPlans, planMeta } from '../src/plans.js';
import { getPassageVerses, getVerse } from '../src/bible.js';
import { applyPlanTransition, archiveStageContent } from '../src/plan-transition.js';

test('текущий план — весь Матфей за 14 дней с 26 октября по 8 ноября', () => {
  const plans = listPlans();
  assert.equal(plans.length, 1);
  const [plan] = plans;
  assert.equal(plan.id, 'matthew14');
  assert.equal(plan.days.length, 14);
  assert.equal(planMeta().startDate, '2026-10-26');
  assert.equal(planMeta().endDate, '2026-11-08');
  const verses = [];
  for (const [i, day] of plan.days.entries()) {
    assert.equal(day.date, new Date(Date.UTC(2026, 9, 26 + i)).toISOString().slice(0, 10));
    assert.equal(day.dayNumber, i + 1);
    const passage = getPassageVerses(day.passage.ranges);
    assert.ok(passage.length > 0);
    assert.ok(getVerse(day.mainVerse.book, day.mainVerse.chapter, day.mainVerse.verse));
    assert.ok(passage.some((v) => v.chapter === day.mainVerse.chapter && v.verse === day.mainVerse.verse));
    verses.push(...passage.map((v) => `${v.book}:${v.chapter}:${v.verse}`));
  }
  const full = getPassageVerses([{ book: 'Мф', startChapter: 1, endChapter: 28 }]);
  assert.equal(new Set(verses).size, verses.length);
  assert.equal(verses.length, full.length);
});

test('переход сохраняет архив и переключает всех один раз, не трогая прогресс и заметки', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, plan_id TEXT, plan_started_at TEXT);
    CREATE TABLE reading_progress (user_id INTEGER, plan_id TEXT, read_at INTEGER);
    CREATE TABLE notes (id INTEGER, text TEXT);
    INSERT INTO users VALUES (1, 'lite', '2026-10-19'), (2, NULL, NULL), (3, 'hard', '2026-10-20');
    INSERT INTO reading_progress VALUES (1, 'lite', 123);
    INSERT INTO notes VALUES (1, 'Сохранённая заметка');`);
  const oldProgress = db.prepare('SELECT * FROM reading_progress').all();
  const oldNotes = db.prepare('SELECT * FROM notes').all();
  const transition = { transitionId: planMeta().transitionId, planId: 'matthew14', startedAt: '2026-10-26' };
  assert.equal(applyPlanTransition(db, transition), 3);
  assert.ok(db.prepare('SELECT * FROM users').all().every((u) => u.plan_id === 'matthew14' && u.plan_started_at === '2026-10-26'));
  assert.deepEqual(db.prepare('SELECT * FROM reading_progress').all(), oldProgress);
  assert.deepEqual(db.prepare('SELECT * FROM notes').all(), oldNotes);
  const archive = db.prepare('SELECT * FROM archived_plan_memberships ORDER BY user_id').all();
  assert.deepEqual(archive.map((u) => [u.user_id, u.plan_id, u.plan_started_at]), [[1, 'lite', '2026-10-19'], [3, 'hard', '2026-10-20']]);
  db.prepare('UPDATE users SET plan_started_at = ? WHERE id = 1').run('2026-10-27');
  assert.equal(applyPlanTransition(db, transition), 0);
  assert.equal(db.prepare('SELECT plan_started_at FROM users WHERE id = 1').get().plan_started_at, '2026-10-27');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM archived_plan_memberships').get().n, 2);
});

test('ошибка переключения откатывает архив и отметку миграции вместе с пользователями', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, plan_id TEXT, plan_started_at TEXT);
    INSERT INTO users VALUES (1, 'lite', '2026-10-19');
    CREATE TRIGGER prevent_update BEFORE UPDATE ON users BEGIN SELECT RAISE(ABORT, 'test failure'); END;`);
  const transition = { transitionId: 'rollback-test', planId: 'matthew14', startedAt: '2026-10-26' };
  assert.throws(() => applyPlanTransition(db, transition), /test failure/);
  assert.equal(db.prepare('SELECT plan_id FROM users').get().plan_id, 'lite');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM archived_plan_memberships').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM plan_transitions').get().n, 0);
  db.exec('DROP TRIGGER prevent_update');
  assert.equal(applyPlanTransition(db, transition), 1);
});

test('при ошибке архивирования активные записи восстанавливаются, повторный запуск безопасен', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const tables = ['notes', 'questions', 'question_answers', 'likes', 'answer_likes'];
  for (const table of tables) db.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, text TEXT);
    INSERT INTO ${table} VALUES (1, 'Исходная запись');`);
  db.exec(`CREATE TRIGGER prevent_clear BEFORE DELETE ON notes BEGIN SELECT RAISE(ABORT, 'test failure'); END;`);
  assert.throws(() => archiveStageContent(db, 'test-stage'), /test failure/);
  for (const table of tables) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM archived_stage_content').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM content_archive_runs').get().n, 0);
  db.exec('DROP TRIGGER prevent_clear');
  assert.equal(archiveStageContent(db, 'test-stage'), 5);
  assert.equal(archiveStageContent(db, 'test-stage'), 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM archived_stage_content').get().n, 5);
});
