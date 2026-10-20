import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

process.env.DB_PATH = ':memory:';
const { db } = await import('../src/db.js');
const { createAdmin, ensureBootstrapAdmin } = await import('../src/bootstrap-admin.js');
const { hashPassword } = await import('../src/auth.js');
after(() => db.close());

test('bootstrap создаёт нового администратора и не меняет его при повторном запуске', () => {
  assert.equal(createAdmin(' Admin ', 'initial-password'), true);
  const before = db.prepare('SELECT * FROM users WHERE login_key = ?').get('admin');
  assert.equal(before.role, 'admin');
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run('existing-session', before.id, 1, 9999999999999);
  assert.equal(createAdmin('ADMIN', 'different-password'), false);
  assert.deepEqual(db.prepare('SELECT * FROM users WHERE id = ?').get(before.id), before);
  assert.ok(db.prepare('SELECT * FROM sessions WHERE token = ?').get('existing-session'));
});

test('bootstrap отказывает при занятом обычным пользователем логине без изменения аккаунта', () => {
  db.prepare('INSERT INTO users (login, login_key, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run('Member', 'member', hashPassword('member-password'), 1);
  const before = db.prepare('SELECT * FROM users WHERE login_key = ?').get('member');
  assert.throws(() => createAdmin(' MEMBER ', 'admin-password'), /повышение прав не поддерживается/);
  assert.deepEqual(db.prepare('SELECT * FROM users WHERE id = ?').get(before.id), before);
});

test('первый администратор после переименования не создаётся заново по старому логину', () => {
  assert.equal(ensureBootstrapAdmin('admin', 'unused-password'), false);
  const user = db.prepare('SELECT * FROM users WHERE login_key = ?').get('admin');
  const before = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  db.prepare('UPDATE users SET login = ?, login_key = ? WHERE id = ?').run('renamed_admin', 'renamed_admin', user.id);
  assert.equal(ensureBootstrapAdmin('admin', 'unused-password'), false);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, before);
  assert.equal(db.prepare('SELECT id FROM users WHERE login_key = ?').get('admin'), undefined);
  assert.equal(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id).password_hash, user.password_hash);
  db.prepare('INSERT INTO users (login, login_key, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run('admin', 'admin', 'ordinary-user-hash', 1);
  assert.equal(ensureBootstrapAdmin('admin', 'unused-password'), false);
  assert.equal(db.prepare('SELECT role FROM users WHERE login_key = ?').get('admin').role, 'user');
});

test('сервер прекращает запуск при коллизии bootstrap, CLI также отказывает в повышении', () => {
  for (const entry of ['../src/index.js', '../scripts/create-admin.mjs']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
      const { db } = await import('./src/db.js');
      db.prepare('INSERT INTO users (login, login_key, password_hash, created_at) VALUES (?, ?, ?, ?)')
        .run('member', 'member', 'unchanged-hash', 1);
      process.argv = ['node', 'create-admin', 'member', 'new-password'];
      try { await import(${JSON.stringify(new URL(entry, import.meta.url).href)}); }
      catch (error) { console.error(error.message); process.exitCode = 1; }
      const user = db.prepare('SELECT role, password_hash FROM users WHERE login_key = ?').get('member');
      console.log(JSON.stringify(user));
    `], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DB_PATH: ':memory:', ADMIN_LOGIN: 'member', ADMIN_PASSWORD: 'new-password', PORT: '0' },
      encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /повышение прав не поддерживается/);
    assert.match(result.stdout, /"role":"user","password_hash":"unchanged-hash"/);
  }
});
