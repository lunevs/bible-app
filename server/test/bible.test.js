// Тесты подсчёта стихов и порога засчитывания чтения (раздел 6 ТЗ).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlan } from '../src/plans.js';
import { verseCount, getPassageVerses, getVerse, listTranslations } from '../src/bible.js';
import { thresholdFor } from '../src/routes/reading.js';
import { config } from '../src/config.js';

test('планы загружаются: lite 30, standard 50, advanced 50, hard 68 записей', () => {
  assert.equal(getPlan('lite').days.length, 30);
  assert.equal(getPlan('standard').days.length, 50);
  assert.equal(getPlan('advanced').days.length, 50);
  assert.equal(getPlan('hard').days.length, 68);
  assert.equal(getPlan('standard').books[0], 'Ин');
  assert.deepEqual(getPlan('advanced').books, ['Мк', 'Ин']);
});

test('отрывок Мк 1:1-20 содержит 20 стихов', () => {
  const day = getPlan('lite').days[0];
  assert.equal(verseCount(day.passage.ranges), 20);
  assert.equal(getPassageVerses(day.passage.ranges).length, 20);
});

test('порог чтения = 2 секунды на стих; для 20 стихов это 40 секунд', () => {
  const day = getPlan('lite').days[0];
  assert.equal(
    thresholdFor(day.passage.ranges),
    Math.max(config.reading.minSeconds, 2 * 20)
  );
  assert.equal(thresholdFor(day.passage.ranges), 40);
});

test('составной рождественский отрывок (Лк 2:1-20 + Ин 1:14) = 21 стих', () => {
  const lite = getPlan('lite');
  const xmas = lite.days[lite.days.length - 1];
  assert.equal(xmas.special, 'christmas');
  assert.equal(verseCount(xmas.passage.ranges), 21);
});

test('главный стих дня возвращает текст', () => {
  const day = getPlan('lite').days[0];
  const v = getVerse(day.mainVerse.book, day.mainVerse.chapter, day.mainVerse.verse);
  assert.ok(v && v.text.length > 0);
});

test('для короткого отрывка порог тоже равен двум секундам на стих', () => {
  // Искусственный диапазон из 3 стихов: 3×2 = 6 секунд.
  const ranges = [{ book: 'Ин', startChapter: 1, startVerse: 1, endChapter: 1, endVerse: 3 }];
  assert.equal(thresholdFor(ranges), 6);
});

test('в РБО пропущенные стихи не заменяются заглушкой и конец главы не обрезается', {
  skip: !listTranslations().some((t) => t.id === 'rbo'),
}, () => {
  const ranges = [{ book: 'Мк', startChapter: 7, startVerse: 15, endChapter: 7, endVerse: 17 }];
  assert.deepEqual(getPassageVerses(ranges, 'rbo').map((v) => v.verse), [15, 17]);
  assert.equal(getVerse('Мк', 7, 16, 'rbo'), null);
  assert.equal(thresholdFor(ranges), 6); // Порог по плану не меняется от перевода.
  const chapter = getPassageVerses([{ book: 'Мк', startChapter: 7 }], 'rbo');
  assert.equal(chapter.at(-1).verse, 37);
  assert.ok(chapter.every((v) => !v.text.includes('В предоставленном файле')));
});
