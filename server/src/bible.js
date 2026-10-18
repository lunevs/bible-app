// Доступ к тексту Библии (Синодальный перевод 1876), встроенному в приложение.
// Данные готовит scripts/import-bible.mjs из открытого источника (см. README).
import fs from 'node:fs';
import { paths } from './config.js';

let data = null;

export function loadBible() {
  if (data) return data;
  if (!fs.existsSync(paths.bibleData)) {
    throw new Error(
      `Не найден файл текста Библии: ${paths.bibleData}\n` +
        `Сначала выполните: npm run import-bible (см. README).`
    );
  }
  data = JSON.parse(fs.readFileSync(paths.bibleData, 'utf8'));
  return data;
}

export function getBook(bookCode) {
  return loadBible().books[bookCode] || null;
}

// Число стихов в главе книги (chapter — 1-based).
export function chapterVerseCount(bookCode, chapter) {
  const book = getBook(bookCode);
  if (!book) return 0;
  const ch = book.chapters[chapter - 1];
  return ch ? ch.length : 0;
}

// Возвращает массив стихов отрывка: [{book, chapter, verse, text}].
// startVerse/endVerse === null означают «от начала/до конца главы».
export function getPassageVerses(ranges) {
  const out = [];
  for (const r of ranges) {
    const book = getBook(r.book);
    if (!book) continue;
    const startCh = r.startChapter;
    const endCh = r.endChapter ?? r.startChapter;
    for (let ch = startCh; ch <= endCh; ch++) {
      const verses = book.chapters[ch - 1];
      if (!verses) continue;
      const from = ch === startCh && r.startVerse != null ? r.startVerse : 1;
      const to = ch === endCh && r.endVerse != null ? r.endVerse : verses.length;
      for (const v of verses) {
        if (v.v >= from && v.v <= to) {
          out.push({ book: r.book, chapter: ch, verse: v.v, text: v.t });
        }
      }
    }
  }
  return out;
}

// Единственный стих (для выделения главного стиха дня).
export function getVerse(bookCode, chapter, verse) {
  const book = getBook(bookCode);
  if (!book) return null;
  const verses = book.chapters[chapter - 1];
  if (!verses) return null;
  const v = verses.find((x) => x.v === verse);
  return v ? { book: bookCode, chapter, verse, text: v.t } : null;
}

export function verseCount(ranges) {
  return getPassageVerses(ranges).length;
}
