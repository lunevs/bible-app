import test from 'node:test';
import assert from 'node:assert/strict';
import { rankBadge, personalRankStatus, leaderboardGroups, participantStatus } from '../src/leaderboard.js';

test('одинаковые баллы получают одинаковый уровень независимо от порядка и размера группы', () => {
  const rows = [
    { id: 1, points: 5 },
    { id: 2, points: 10 },
    { id: 3, points: 5 },
    { id: 4, points: 1 },
    { id: 5, points: 10 },
  ];
  const groups = leaderboardGroups(rows);
  assert.deepEqual(groups.ranked.map((r) => r.id), [2, 5, 1, 3, 4]);
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(rows.map((r) => participantStatus(groups, r.id, 0).emoji), ['🤩', '😇', '🤩', '😃', '😇']);
  assert.deepEqual(participantStatus(groups, 1, 0), participantStatus(groups, 3, 0));
});

test('если все баллы равны, все участники получают ангелка', () => {
  const rows = Array.from({ length: 24 }, (_, id) => ({ id, points: 10 }));
  const groups = leaderboardGroups(rows);
  for (const row of rows) assert.equal(participantStatus(groups, row.id, 0).emoji, '😇');
});

test('при числе групп больше 12 распределение зависит от групп, а не числа участников', () => {
  const rows = Array.from({ length: 24 }, (_, id) => ({ id, points: 24 - id }));
  const groups = leaderboardGroups([...rows, ...Array.from({ length: 30 }, (_, i) => ({ id: 24 + i, points: 24 }))]);
  for (const row of rows) {
    assert.equal(participantStatus(groups, row.id, 0).emoji, rankBadge(row.id, 24).emoji);
  }
});

test('нулевые баллы вынесены в алфавитный список и не влияют на уровни рейтинга', () => {
  const rows = [
    { id: 1, login: 'Лидер', points: 10 },
    { id: 2, login: 'Второй', points: 1 },
    { id: 3, login: 'Яков', points: 0 },
    { id: 4, login: 'анна', points: 0 },
    { id: 5, login: 'Борис', points: 0 },
  ];
  const groups = leaderboardGroups(rows);
  assert.deepEqual(groups.ranked.map((r) => r.id), [1, 2]);
  assert.deepEqual(groups.waiting.map((r) => r.id), [4, 5, 3]);
  assert.equal(participantStatus(groups, 2, 0).quantile, 2);
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5]);
});

test('при нулевых баллах статус постоянный, в том числе когда все участники с нулём', () => {
  const groups = leaderboardGroups([{ id: 1, login: 'Анна', points: 0 }]);
  const expected = { emoji: '🤔', text: 'Зачем откладывать на завтра, если можно начать сегодня?' };
  for (const choice of [undefined, 0, 1, 2]) assert.deepEqual(participantStatus(groups, 1, choice), expected);
  assert.equal(participantStatus(groups, 2, 0), null);
  assert.equal(participantStatus(leaderboardGroups([]), 1, 0), null);
});

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

test('при числе участников меньше 12 используются только лучшие эмодзи подряд', () => {
  const emojis = Array.from('😇🤩😃😊🙂🤔🤨😔😥😭😱😴');
  for (let total = 1; total < 12; total++) {
    assert.deepEqual(Array.from({ length: total }, (_, i) => rankBadge(i, total).emoji), emojis.slice(0, total));
    assert.equal(personalRankStatus(total - 1, total, 0).quantile, total);
  }
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
