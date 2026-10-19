// Публичные вопросы к стихам и ответы участников.
import express from 'express';
import { config } from '../config.js';
import { db, now } from '../db.js';
import { getBook, getVerse } from '../bible.js';
import { requireAuth } from '../auth.js';

export const questionsRouter = express.Router();

function validateVerse({ book, chapter, verse }) {
  const b = getBook(book);
  if (!b) return 'Неизвестная книга';
  const ch = b.chapters[Number(chapter) - 1];
  if (!ch) return 'Неизвестная глава';
  if (!ch.some((item) => item.v === Number(verse))) return 'Неизвестный стих';
  return null;
}

function validateText(value) {
  const text = String(value || '').trim();
  if (!text) return { error: 'Текст не может быть пустым' };
  if (text.length > config.notes.maxLength) {
    return { error: `Не более ${config.notes.maxLength} символов` };
  }
  return { text };
}

questionsRouter.get('/questions', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT q.*, u.login AS author_login,
            (SELECT COUNT(*) FROM question_answers a WHERE a.question_id = q.id) AS answer_count
     FROM questions q JOIN users u ON u.id = q.user_id
     ORDER BY q.created_at DESC LIMIT 200`
  ).all();

  res.json({
    questions: rows.map((q) => ({
      id: q.id,
      book: q.book,
      chapter: q.chapter,
      verse: q.verse,
      verseText: getVerse(q.book, q.chapter, q.verse)?.text || '',
      text: q.text,
      authorId: q.user_id,
      authorLogin: q.author_login,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      answerCount: q.answer_count,
      isMine: q.user_id === req.user.id,
    })),
  });
});

questionsRouter.post('/questions', requireAuth, (req, res) => {
  const book = String(req.body?.book || '');
  const chapter = Number(req.body?.chapter);
  const verse = Number(req.body?.verse);
  const validated = validateText(req.body?.text);
  const verseError = validateVerse({ book, chapter, verse });
  if (verseError) return res.status(400).json({ error: verseError });
  if (validated.error) return res.status(400).json({ error: validated.error });

  const ts = now();
  const result = db.prepare(
    'INSERT INTO questions (user_id, book, chapter, verse, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, book, chapter, verse, validated.text, ts, ts);
  res.status(201).json({ id: result.lastInsertRowid });
});

questionsRouter.get('/questions/:id/answers', requireAuth, (req, res) => {
  const questionId = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
  if (!exists) return res.status(404).json({ error: 'Вопрос не найден' });

  const rows = db.prepare(
    `SELECT a.*, u.login AS author_login,
            (SELECT COUNT(*) FROM answer_likes al WHERE al.answer_id = a.id) AS likes,
            EXISTS(SELECT 1 FROM answer_likes mine WHERE mine.answer_id = a.id AND mine.user_id = ?) AS liked_by_me
     FROM question_answers a JOIN users u ON u.id = a.user_id
     WHERE a.question_id = ? ORDER BY a.created_at ASC`
  ).all(req.user.id, questionId);
  res.json({
    answers: rows.map((a) => ({
      id: a.id,
      questionId: a.question_id,
      text: a.text,
      authorId: a.user_id,
      authorLogin: a.author_login,
      likes: a.likes,
      likedByMe: Boolean(a.liked_by_me),
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      isMine: a.user_id === req.user.id,
    })),
  });
});

questionsRouter.post('/question-answers/:id/like', requireAuth, (req, res) => {
  const answerId = Number(req.params.id);
  const answer = db.prepare('SELECT * FROM question_answers WHERE id = ?').get(answerId);
  if (!answer) return res.status(404).json({ error: 'Ответ не найден' });
  if (answer.user_id === req.user.id) return res.status(400).json({ error: 'Нельзя лайкать свой ответ' });

  const existing = db.prepare('SELECT 1 FROM answer_likes WHERE answer_id = ? AND user_id = ?').get(answerId, req.user.id);
  if (existing) {
    db.prepare('DELETE FROM answer_likes WHERE answer_id = ? AND user_id = ?').run(answerId, req.user.id);
  } else {
    db.prepare('INSERT INTO answer_likes (answer_id, user_id, created_at) VALUES (?, ?, ?)').run(answerId, req.user.id, now());
  }
  const likes = db.prepare('SELECT COUNT(*) AS c FROM answer_likes WHERE answer_id = ?').get(answerId).c;
  res.json({ liked: !existing, likes });
});

questionsRouter.post('/questions/:id/answers', requireAuth, (req, res) => {
  const questionId = Number(req.params.id);
  const exists = db.prepare('SELECT id FROM questions WHERE id = ?').get(questionId);
  if (!exists) return res.status(404).json({ error: 'Вопрос не найден' });
  const validated = validateText(req.body?.text);
  if (validated.error) return res.status(400).json({ error: validated.error });

  const ts = now();
  const result = db.prepare(
    'INSERT INTO question_answers (question_id, user_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(questionId, req.user.id, validated.text, ts, ts);
  res.status(201).json({ id: result.lastInsertRowid });
});

questionsRouter.patch('/questions/:id', requireAuth, (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(req.params.id));
  if (!question) return res.status(404).json({ error: 'Вопрос не найден' });
  if (question.user_id !== req.user.id) return res.status(403).json({ error: 'Можно редактировать только свои вопросы' });
  const validated = validateText(req.body?.text);
  if (validated.error) return res.status(400).json({ error: validated.error });
  db.prepare('UPDATE questions SET text = ?, updated_at = ? WHERE id = ?').run(validated.text, now(), question.id);
  res.json({ ok: true });
});

questionsRouter.delete('/questions/:id', requireAuth, (req, res) => {
  const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(Number(req.params.id));
  if (!question) return res.status(404).json({ error: 'Вопрос не найден' });
  if (question.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  db.prepare('DELETE FROM questions WHERE id = ?').run(question.id);
  res.json({ ok: true });
});

questionsRouter.patch('/question-answers/:id', requireAuth, (req, res) => {
  const answer = db.prepare('SELECT * FROM question_answers WHERE id = ?').get(Number(req.params.id));
  if (!answer) return res.status(404).json({ error: 'Ответ не найден' });
  if (answer.user_id !== req.user.id) return res.status(403).json({ error: 'Можно редактировать только свои ответы' });
  const validated = validateText(req.body?.text);
  if (validated.error) return res.status(400).json({ error: validated.error });
  db.prepare('UPDATE question_answers SET text = ?, updated_at = ? WHERE id = ?').run(validated.text, now(), answer.id);
  res.json({ ok: true });
});

questionsRouter.delete('/question-answers/:id', requireAuth, (req, res) => {
  const answer = db.prepare('SELECT * FROM question_answers WHERE id = ?').get(Number(req.params.id));
  if (!answer) return res.status(404).json({ error: 'Ответ не найден' });
  if (answer.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  db.prepare('DELETE FROM question_answers WHERE id = ?').run(answer.id);
  res.json({ ok: true });
});