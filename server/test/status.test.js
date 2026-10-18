// Юнит-тесты вычисления статусов, границы суток и баллов (разделы 7–8 ТЗ).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStatus,
  endOfLocalDay,
  statusPoints,
  todayLocal,
} from '../src/status.js';

const TZ = 'Europe/Belgrade';

test('граница суток: летнее время (CEST, UTC+2)', () => {
  // До 25.10.2026 Белград в UTC+2: конец суток 23:59:59.999 = 21:59:59.999Z.
  assert.equal(endOfLocalDay('2026-10-20', TZ), Date.UTC(2026, 9, 20, 21, 59, 59, 999));
});

test('граница суток: зимнее время (CET, UTC+1)', () => {
  // После 25.10.2026 Белград в UTC+1: конец суток = 22:59:59.999Z.
  assert.equal(endOfLocalDay('2026-11-10', TZ), Date.UTC(2026, 10, 10, 22, 59, 59, 999));
});

test('todayLocal даёт дату в формате YYYY-MM-DD', () => {
  assert.match(todayLocal(TZ), /^\d{4}-\d{2}-\d{2}$/);
});

test('прочитано вовремя → зелёная (в т.ч. ровно в границу)', () => {
  const date = '2026-10-20';
  const eod = endOfLocalDay(date, TZ);
  assert.equal(computeStatus({ date, readAt: eod, participationDate: null, now: eod + 1000 }), 'green');
  assert.equal(computeStatus({ date, readAt: eod - 1, participationDate: null, now: eod + 1000 }), 'green');
});

test('прочитано позже → синяя', () => {
  const date = '2026-10-20';
  const eod = endOfLocalDay(date, TZ);
  assert.equal(computeStatus({ date, readAt: eod + 1, participationDate: null, now: eod + 100000 }), 'blue');
});

test('не прочитано, но дата раньше начала участия → пусто', () => {
  const date = '2026-10-20';
  const eod = endOfLocalDay(date, TZ);
  // участие начинается 21-го, запись 20-го, день уже прошёл.
  assert.equal(
    computeStatus({ date, readAt: null, participationDate: '2026-10-21', now: eod + 100000 }),
    'empty'
  );
});

test('не прочитано и день истёк → красный крестик (missed)', () => {
  const date = '2026-10-20';
  const eod = endOfLocalDay(date, TZ);
  assert.equal(computeStatus({ date, readAt: null, participationDate: '2026-10-01', now: eod + 1 }), 'missed');
});

test('сегодня и будущее → нейтрально', () => {
  const date = '2026-10-20';
  const eod = endOfLocalDay(date, TZ);
  assert.equal(computeStatus({ date, readAt: null, participationDate: null, now: eod - 1 }), 'neutral');
  assert.equal(computeStatus({ date, readAt: null, participationDate: '2026-10-01', now: eod - 1 }), 'neutral');
});

test('красный крестик после позднего чтения становится синим, но не зелёным', () => {
  const date = '2026-10-20';
  const eod = endOfLocalDay(date, TZ);
  const before = computeStatus({ date, readAt: null, participationDate: null, now: eod + 1 });
  const after = computeStatus({ date, readAt: eod + 5000, participationDate: null, now: eod + 10000 });
  assert.equal(before, 'missed');
  assert.equal(after, 'blue');
  assert.notEqual(after, 'green');
});

test('баллы: зелёная 1, синяя 0,5, остальные 0', () => {
  assert.equal(statusPoints('green'), 1);
  assert.equal(statusPoints('blue'), 0.5);
  assert.equal(statusPoints('missed'), 0);
  assert.equal(statusPoints('neutral'), 0);
  assert.equal(statusPoints('empty'), 0);
});
