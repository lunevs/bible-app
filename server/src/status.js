// Вычисление статусов записей (раздел 7 ТЗ) и работа с границей суток
// в часовом поясе группы. Статус НЕ хранится, а выводится из фактов чтения.
import { config } from './config.js';

// Смещение часового пояса (в минутах) для конкретного момента.
function tzOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asUTC = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +map.hour % 24,
    +map.minute,
    +map.second
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Момент (ms epoch) конца локальных суток для даты YYYY-MM-DD.
export function endOfLocalDay(dateStr, timeZone = config.timezone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  const offset = tzOffsetMinutes(timeZone, new Date(guess));
  return guess - offset * 60000;
}

// Текущая локальная дата группы в виде YYYY-MM-DD.
export function todayLocal(timeZone = config.timezone, at = Date.now()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(new Date(at));
}

// Статус одной записи плана для пользователя.
// Возвращает: 'green' | 'blue' | 'empty' | 'missed' | 'neutral'
export function computeStatus({ date, readAt, participationDate, now = Date.now() }) {
  if (readAt != null) {
    return readAt <= endOfLocalDay(date) ? 'green' : 'blue';
  }
  // не прочитано
  if (participationDate && date < participationDate) return 'empty';
  if (endOfLocalDay(date) < now) return 'missed';
  return 'neutral';
}

// Баллы за статус (раздел 8): зелёная 1, синяя 0.5, остальное 0.
export function statusPoints(status) {
  if (status === 'green') return 1;
  if (status === 'blue') return 0.5;
  return 0;
}

export const STATUS_LABELS = {
  green: 'прочитано вовремя',
  blue: 'прочитано позже',
  empty: 'до начала участия',
  missed: 'пропущено',
  neutral: 'сегодня или позже',
};
