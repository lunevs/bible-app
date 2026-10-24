import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveBibleFile } from '../src/bible-files.js';

test('перевод на томе остаётся доступным после сборки без личных файлов', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const volume = path.join(root, 'volume');
  const image = path.join(root, 'image');
  fs.mkdirSync(volume);
  fs.mkdirSync(image);
  fs.writeFileSync(path.join(volume, 'ibs.json'), 'persistent');
  fs.writeFileSync(path.join(image, 'ibs.json'), 'bundled');
  assert.equal(fs.readFileSync(resolveBibleFile('ibs.json', volume, image), 'utf8'), 'persistent');
  fs.rmSync(image, { recursive: true });
  assert.equal(fs.readFileSync(resolveBibleFile('ibs.json', volume, image), 'utf8'), 'persistent');
});

test('локальная сборка использует вложенные переводы, если их нет на томе', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bible-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'rbo.json'), 'bundled');
  assert.equal(fs.readFileSync(resolveBibleFile('rbo.json', path.join(root, 'absent'), root), 'utf8'), 'bundled');
});
