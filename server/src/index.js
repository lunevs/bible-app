// Точка входа сервера.
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config, paths } from './config.js';
import './db.js';
import { loadBible } from './bible.js';
import './plans.js';
import { attachUser } from './auth.js';
import { createAdmin } from './bootstrap-admin.js';
import { authRouter } from './routes/auth.js';
import { readingRouter } from './routes/reading.js';
import { notesRouter } from './routes/notes.js';
import { questionsRouter } from './routes/questions.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { adminRouter } from './routes/admin.js';

// Создание первого администратора из настроек развёртывания (открытый вопрос 2).
function bootstrapAdmin() {
  const { login, password } = config.bootstrapAdmin;
  if (!login || !password) return;
  if (createAdmin(login, password)) {
    console.log(`Создан администратор "${login.trim()}"`);
  }
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser(config.sessionSecret));
app.use(attachUser);

app.use('/api/auth', authRouter);
app.use('/api', readingRouter);
app.use('/api', notesRouter);
app.use('/api', questionsRouter);
app.use('/api', leaderboardRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Отдача собранного клиента (SPA).
const clientDist = path.resolve(paths.serverRoot, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

bootstrapAdmin();

try {
  loadBible();
  console.log('Текст Библии загружен.');
} catch (e) {
  console.warn('ВНИМАНИЕ: ' + e.message);
}

const server = app.listen(config.port, () => {
  console.log(`Сервер запущен: http://localhost:${config.port}`);
});

export { app, server };
