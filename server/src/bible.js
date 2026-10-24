// Доступ к тексту Библии (Синодальный перевод 1876), встроенному в приложение.
// Данные готовит scripts/import-bible.mjs из открытого источника (см. README).
import fs from 'node:fs';
import path from 'node:path';
import { config, paths } from './config.js';
import { resolveBibleFile } from './bible-files.js';

const cache = new Map();
const privateRoot = path.join(paths.serverRoot, 'private-bible');
const persistentRoot = path.join(path.dirname(config.dbPath), 'private-bible');
const privateFile = (filename) => resolveBibleFile(filename, persistentRoot, privateRoot);
const editions = [
  { id: 'synodal', name: 'Синодальный перевод (1876)', file: paths.bibleData },
  { id: 'ibs', name: 'IBS Biblica', file: privateFile('ibs.json') },
  { id: 'biblica', name: 'Новый русский перевод (Biblica)', file: privateFile('biblica.json') },
  { id: 'rbo', name: 'Современный русский перевод (РБО, 2011)', file: privateFile('rbo.json') },
];

export function listTranslations() {
  return editions.filter((e) => fs.existsSync(e.file)).map(({ id, name }) => ({ id, name }));
}

export function loadBible(translation = 'synodal') {
  if (cache.has(translation)) return cache.get(translation);
  const edition = editions.find((e) => e.id === translation);
  if (!edition || !fs.existsSync(edition.file)) {
    throw new Error(
      `Не найден файл текста Библии: ${paths.bibleData}\n` +
        `Сначала выполните: npm run import-bible (см. README).`
    );
  }
  const data = JSON.parse(fs.readFileSync(edition.file, 'utf8'));
  // Совместимость с уже импортированными РБО-файлами: это наша старая
  // служебная заглушка, а не текст Писания.
  if (translation === 'rbo') {
    for (const book of Object.values(data.books)) {
      book.chapters = book.chapters.map((chapter) => chapter.filter((v) =>
        v.t !== 'В предоставленном файле нет отдельного текста этого стиха.'
      ));
    }
  }
  cache.set(translation, data);
  return data;
}

export function getBook(bookCode, translation = 'synodal') {
  return loadBible(translation).books[bookCode] || null;
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
export function getPassageVerses(ranges, translation = 'synodal') {
  const out = [];
  const seen = new Set();
  for (const r of ranges) {
    const book = getBook(r.book, translation);
    if (!book) continue;
    const startCh = r.startChapter;
    const endCh = r.endChapter ?? r.startChapter;
    for (let ch = startCh; ch <= endCh; ch++) {
      const verses = book.chapters[ch - 1];
      if (!verses) continue;
      const from = ch === startCh && r.startVerse != null ? r.startVerse : 1;
      const to = ch === endCh && r.endVerse != null ? r.endVerse : Infinity;
      for (const v of verses) {
        const key = `${r.book}:${ch}:${v.v}:${v.endVerse || v.v}`;
        if ((v.endVerse || v.v) >= from && v.v <= to && !seen.has(key)) {
          seen.add(key);
          out.push({ book: r.book, chapter: ch, verse: v.v, text: v.t,
            ...(v.endVerse ? { verseEnd: v.endVerse } : {}),
            ...(v.label ? { verseLabel: v.label } : {}),
          });
        }
      }
    }
  }
  return out;
}

// Единственный стих (для выделения главного стиха дня).
export function getVerse(bookCode, chapter, verse, translation = 'synodal') {
  const book = getBook(bookCode, translation);
  if (!book) return null;
  const verses = book.chapters[chapter - 1];
  if (!verses) return null;
  const v = verses.find((x) => x.v <= verse && (x.endVerse || x.v) >= verse);
  return v ? { book: bookCode, chapter, verse, text: v.t } : null;
}

export function verseCount(ranges) {
  return getPassageVerses(ranges).length;
}
