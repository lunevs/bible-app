// Центральный конфиг приложения.
// Все значения, которые ТЗ разрешает выбирать исполнителю (или оставляет
// «открытыми вопросами» с дефолтами), собраны здесь и легко заменяются
// через переменные окружения. См. README.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');

const num = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export const config = {
  port: num(process.env.PORT, 3000),

  // Путь к файлу базы данных SQLite.
  dbPath: process.env.DB_PATH || path.join(serverRoot, 'data', 'app.db'),

  // Секрет для подписи cookie сессии. В продакшене обязательно задать.
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',

  // Помечать ли сессионную cookie флагом Secure (отправлять только по HTTPS).
  // По умолчанию — только в режиме production. Явно задаётся через COOKIE_SECURE.
  // ВАЖНО: при доступе по обычному HTTP (например, по локальной сети
  // http://192.168.x.x) нужно COOKIE_SECURE=false, иначе браузер отбросит cookie
  // и вход будет «теряться». Включайте true только при работе через HTTPS.
  cookieSecure: (() => {
    const v = process.env.COOKIE_SECURE;
    if (v === 'true') return true;
    if (v === 'false') return false;
    return process.env.NODE_ENV === 'production';
  })(),

  // Часовой пояс группы: определяет границу суток для статусов (открытый вопрос 7).
  timezone: process.env.APP_TIMEZONE || 'Europe/Belgrade',

  // Срок жизни сессии на устройстве (в днях).
  sessionDays: num(process.env.SESSION_DAYS, 180),

  // --- Фиксация факта прочтения (раздел 6 ТЗ) ---
  reading: {
    // Нижняя граница порога (секунды). По умолчанию ограничение выключено.
    minSeconds: num(process.env.READING_MIN_SECONDS, 0),
    // Серверный порог засчитывания: секунд на каждый стих отрывка.
    secondsPerVerse: num(process.env.READING_SECONDS_PER_VERSE, 2),
    // Столько секунд без активности сбрасывают «активное» состояние на клиенте.
    idleResetSeconds: num(process.env.READING_IDLE_RESET, 30),
    // Максимум секунд, которые сервер принимает за один запрос progress
    // (защита от «зачесть всё одним запросом»). Клиент шлёт каждые 10–15 с.
    maxSecondsPerRequest: num(process.env.READING_MAX_SECONDS_PER_REQUEST, 60),
  },

  // --- Вход и защита от перебора (раздел 3 ТЗ) ---
  auth: {
    minPasswordLength: num(process.env.MIN_PASSWORD_LENGTH, 3),
    // После стольких неудачных попыток подряд вход временно блокируется.
    maxFailedAttempts: num(process.env.AUTH_MAX_FAILED, 5),
    // Длительность блокировки (минуты).
    lockMinutes: num(process.env.AUTH_LOCK_MINUTES, 15),
    // Окно, в котором считаются неудачные попытки (минуты).
    attemptWindowMinutes: num(process.env.AUTH_ATTEMPT_WINDOW, 60),
  },

  // --- Заметки (раздел 9 ТЗ, открытый вопрос 9) ---
  notes: {
    maxLength: num(process.env.NOTE_MAX_LENGTH, 2000),
  },

  // --- ВРЕМЕННО, только для локального тестирования ---
  // Если задано значение `today` или дата `YYYY-MM-DD`, все даты планов планов
  // сдвигаются так, чтобы первая запись была на эту дату. В обычном режиме пусто.
  testPlanStart: process.env.TEST_PLAN_START || '',

  // --- Первый администратор (открытый вопрос 2) ---
  // Задаётся при развёртывании. Если логин и пароль указаны и пользователя
  // с таким логином нет — он создаётся при первом запуске.
  bootstrapAdmin: {
    login: process.env.ADMIN_LOGIN || '',
    password: process.env.ADMIN_PASSWORD || '',
  },
};

export const paths = {
  serverRoot,
  bibleData: path.join(serverRoot, 'data', 'bible', 'synodal.json'),
  plansFile: path.resolve(serverRoot, '..', 'plans.json'),
};
