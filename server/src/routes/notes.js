// Заметки к стихам и лайки (раздел 9 ТЗ).
import express from 'express';
import { config } from '../config.js';
import { db, now } from '../db.js';
import { getBook, getVerse } from '../bible.js';
import { requireAuth } from '../auth.js';

export const notesRouter = express.Router();

function validateTarget({ book, chapter, verse }) {
  const b = getBook(book);
  if (!b) return 'Неизвестная книга';
  const ch = b.chapters[Number(chapter) - 1];
  if (!ch) return 'Неизвестная глава';
  if (!ch.some((v) => v.v === Number(verse))) return 'Неизвестный стих';
  return null;
}

function noteView(n, viewerId, likeCounts, likedByMe) {
  return {
    id: n.id,
    book: n.book,
    chapter: n.chapter,
    verse: n.verse,
    text: n.text,
    visibility: n.visibility,
    authorId: n.user_id,
    authorLogin: n.author_login,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
    likes: likeCounts.get(n.id) || 0,
    likedByMe: likedByMe.has(n.id),
    isMine: n.user_id === viewerId,
  };
}

// Заметки к конкретному стиху: свои (включая личные) + открытые чужие.
notesRouter.get('/notes', requireAuth, (req, res) => {
  const book = String(req.query.book || '');
  const chapter = Number(req.query.chapter);
  const verse = Number(req.query.verse);
  const verseEnd = req.query.verseEnd == null ? verse : Number(req.query.verseEnd);
  const err = validateTarget({ book, chapter, verse });
  if (err) return res.status(400).json({ error: err });
  if (!Number.isInteger(verseEnd) || verseEnd < verse || validateTarget({ book, chapter, verse: verseEnd })) {
    return res.status(400).json({ error: 'Некорректный диапазон стихов' });
  }

  const rows = db
    .prepare(
      `SELECT n.*, u.login AS author_login
       FROM notes n JOIN users u ON u.id = n.user_id
       WHERE n.book = ? AND n.chapter = ? AND n.verse BETWEEN ? AND ?
         AND (n.user_id = ? OR n.visibility = 'open')
       ORDER BY n.created_at ASC`
    )
    .all(book, chapter, verse, verseEnd, req.user.id);

  const ids = rows.map((r) => r.id);
  const likeCounts = new Map();
  const likedByMe = new Set();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    for (const r of db
      .prepare(`SELECT note_id, COUNT(*) c FROM likes WHERE note_id IN (${placeholders}) GROUP BY note_id`)
      .all(...ids)) {
      likeCounts.set(r.note_id, r.c);
    }
    for (const r of db
      .prepare(`SELECT note_id FROM likes WHERE user_id = ? AND note_id IN (${placeholders})`)
      .all(req.user.id, ...ids)) {
      likedByMe.add(r.note_id);
    }
  }

  const notes = rows.map((n) => noteView(n, req.user.id, likeCounts, likedByMe));
  res.json({
    notes,
    own: notes.filter((n) => n.isMine),
    open: notes.filter((n) => !n.isMine),
  });
});

notesRouter.post('/notes', requireAuth, (req, res) => {
  const book = String(req.body?.book || '');
  const chapter = Number(req.body?.chapter);
  const verse = Number(req.body?.verse);
  const text = String(req.body?.text || '').trim();
  const visibility = req.body?.visibility === 'open' ? 'open' : 'personal';

  const err = validateTarget({ book, chapter, verse });
  if (err) return res.status(400).json({ error: err });
  if (!text) return res.status(400).json({ error: 'Заметка не может быть пустой' });
  if (text.length > config.notes.maxLength) {
    return res.status(400).json({ error: `Не более ${config.notes.maxLength} символов` });
  }

  const ts = now();
  const info = db
    .prepare(
      `INSERT INTO notes (user_id, book, chapter, verse, text, visibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, book, chapter, verse, text, visibility, ts, ts);
  res.json({ id: info.lastInsertRowid });
});

// Редактировать текст и видимость может только автор.
notesRouter.patch('/notes/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
  if (note.user_id !== req.user.id) return res.status(403).json({ error: 'Можно менять только свои заметки' });

  const text = req.body?.text != null ? String(req.body.text).trim() : note.text;
  const visibility =
    req.body?.visibility != null
      ? req.body.visibility === 'open'
        ? 'open'
        : 'personal'
      : note.visibility;

  if (!text) return res.status(400).json({ error: 'Заметка не может быть пустой' });
  if (text.length > config.notes.maxLength) {
    return res.status(400).json({ error: `Не более ${config.notes.maxLength} символов` });
  }

  db.prepare('UPDATE notes SET text = ?, visibility = ?, updated_at = ? WHERE id = ?').run(
    text,
    visibility,
    now(),
    id
  );
  res.json({ ok: true });
});

// Удалять может автор; чужие ОТКРЫТЫЕ заметки — администратор (раздел 3).
notesRouter.delete('/notes/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!note) return res.status(404).json({ error: 'Заметка не найдена' });

  const isAuthor = note.user_id === req.user.id;
  const isAdmin = req.user.role === 'admin' && note.visibility === 'open';
  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }

  db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Лайк/снятие лайка. Свою заметку лайкать нельзя (открытый вопрос 9).
notesRouter.post('/notes/:id/like', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
  if (!note) return res.status(404).json({ error: 'Заметка не найдена' });
  if (note.user_id === req.user.id) return res.status(400).json({ error: 'Нельзя лайкать свою заметку' });
  if (note.visibility !== 'open') return res.status(403).json({ error: 'Личные заметки недоступны' });

  const existing = db.prepare('SELECT 1 FROM likes WHERE note_id = ? AND user_id = ?').get(id, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM likes WHERE note_id = ? AND user_id = ?').run(id, req.user.id);
  } else {
    db.prepare('INSERT INTO likes (note_id, user_id, created_at) VALUES (?, ?, ?)').run(id, req.user.id, now());
  }
  const count = db.prepare('SELECT COUNT(*) c FROM likes WHERE note_id = ?').get(id).c;
  res.json({ liked: !existing, likes: count });
});

// Все открытые заметки (лента группы) — опционально, для просмотра.
notesRouter.get('/notes/open', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT n.*, u.login AS author_login,
              (SELECT COUNT(*) FROM likes l WHERE l.note_id = n.id) AS likes,
              EXISTS(SELECT 1 FROM likes mine WHERE mine.note_id = n.id AND mine.user_id = ?) AS liked_by_me
       FROM notes n JOIN users u ON u.id = n.user_id
       WHERE n.visibility = 'open'
       ORDER BY n.updated_at DESC LIMIT 200`
    )
    .all(req.user.id);
  res.json({
    notes: rows.map(({ liked_by_me, ...n }) => ({
      ...n,
      verseText: getVerse(n.book, n.chapter, n.verse, req.translation)?.text || '',
      likedByMe: Boolean(liked_by_me),
      isMine: n.user_id === req.user.id,
    })),
  });
});
