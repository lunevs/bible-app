import test from 'node:test';
import assert from 'node:assert/strict';
import { rankBadge, personalRankStatus } from '../src/leaderboard.js';

test('12 участников получают все эмодзи в заданном порядке', () => {
  assert.equal(Array.from({ length: 12 }, (_, i) => rankBadge(i, 12).emoji).join(''), '😇🤩😃😊🙂🤔🤨😔😥😭😱😴');
  assert.equal(rankBadge(0, 1).emoji, '😇');
});

test('24 участника распределяются по двое, 16 — по одному или двое', () => {
  for (const total of [24, 16]) {
    const counts = Array(12).fill(0);
    for (let i = 0; i < total; i++) counts[rankBadge(i, total).quantile - 1]++;
    assert.equal(counts.reduce((a, b) => a + b), total);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
    if (total === 24) assert.deepEqual(counts, Array(12).fill(2));
    assert.equal(rankBadge(total - 1, total).emoji, '😴');
  }
});

test('при числе участников меньше 12 группы могут быть пустыми', () => {
  assert.deepEqual(Array.from({ length: 3 }, (_, i) => rankBadge(i, 3).quantile), [1, 5, 9]);
  assert.throws(() => rankBadge(0, 0), RangeError);
});

test('у каждого уровня три своих статуса, исправленные фразы восьмого уровня сохранены', () => {
  for (let i = 0; i < 12; i++) {
    const options = [0, 1, 2].map((choice) => personalRankStatus(i, 12, choice));
    assert.equal(new Set(options.map((s) => s.text)).size, 3);
    assert.ok(options.every((s) => s.emoji === rankBadge(i, 12).emoji));
  }
  assert.equal(personalRankStatus(7, 12, 0).text, 'Глаза боятся, а руки делают');
  assert.equal(personalRankStatus(11, 12, 2).text, 'Спящего льва не будят, а читателя пора');
  assert.throws(() => personalRankStatus(0, 12, 3), RangeError);
});
