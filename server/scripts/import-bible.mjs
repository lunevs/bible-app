// Импорт текста Синодального перевода (1876) из открытого источника
// getbible.net (общественное достояние) в компактный файл приложения.
//
// Источник: https://api.getbible.net/v2/synodal.json
// Берём только четыре Евангелия: Мф (40), Мк (41), Лк (42), Ин (43).
//
// Использование:
//   node scripts/import-bible.mjs [путь-к-скачанному-json | url]
// По умолчанию скачивает с getbible.net.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'data', 'bible', 'synodal.json');

const SOURCE_URL = 'https://api.getbible.net/v2/synodal.json';
const BOOKS = { 40: 'Мф', 41: 'Мк', 42: 'Лк', 43: 'Ин' };
const BOOK_NAMES = {
  Мф: 'Евангелие от Матфея',
  Мк: 'Евангелие от Марка',
  Лк: 'Евангелие от Луки',
  Ин: 'Евангелие от Иоанна',
};

async function loadSource(arg) {
  if (!arg) {
    console.log(`Скачиваю источник: ${SOURCE_URL} ...`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }
  if (/^https?:\/\//.test(arg)) {
    const res = await fetch(arg);
    return await res.json();
  }
  return JSON.parse(fs.readFileSync(arg, 'utf8'));
}

const src = await loadSource(process.argv[2]);

const out = {
  translation: 'Синодальный перевод (1876)',
  source: SOURCE_URL,
  license: 'Общественное достояние',
  books: {},
};

let totalVerses = 0;
for (const book of src.books) {
  const code = BOOKS[book.nr];
  if (!code) continue;
  const chapters = book.chapters.map((ch) =>
    ch.verses.map((v) => ({ v: v.verse, t: v.text.replace(/\s+$/, '') }))
  );
  out.books[code] = { name: BOOK_NAMES[code], chapters };
  totalVerses += chapters.reduce((a, c) => a + c.length, 0);
  console.log(`${code} ${BOOK_NAMES[code]}: ${chapters.length} глав`);
}

if (!Object.keys(out.books).length) throw new Error('В источнике не найдено ни одного Евангелия');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`Записано: ${OUT} (${totalVerses} стихов)`);
