// Загрузка планов чтения из plans.json (лежит в корне проекта).
//
// Поддерживает ВРЕМЕННЫЙ сдвиг дат для тестирования через переменную окружения
// TEST_PLAN_START: если она задана (`today` или `YYYY-MM-DD`), все даты планов
// пересчитываются так, чтобы первая запись была на указанную дату. Это нужно
// только для локальной проверки; в обычном режиме сдвиг выключен.
import fs from 'node:fs';
import { config, paths } from './config.js';
import { todayLocal } from './status.js';

let raw = null;

function addDays(dateStr, n) {
  if (!n) return dateStr;
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function dayDiff(from, to) {
  const p = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((p(to) - p(from)) / 86400000);
}

export function loadPlans() {
  if (raw) return raw;
  const data = JSON.parse(fs.readFileSync(paths.plansFile, 'utf8'));

  const target = config.testPlanStart;
  if (target) {
    const start = target === 'today' ? todayLocal() : target;
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      const shift = dayDiff(data.meta.startDate, start);
      if (shift) {
        data.meta.originalStartDate = data.meta.startDate;
        data.meta.startDate = addDays(data.meta.startDate, shift);
        data.meta.endDate = addDays(data.meta.endDate, shift);
        for (const plan of data.plans) {
          for (const day of plan.days) day.date = addDays(day.date, shift);
        }
      }
    }
  }

  raw = data;
  return raw;
}

export function listPlans() {
  return loadPlans().plans;
}

export function getPlan(planId) {
  return listPlans().find((p) => p.id === planId) || null;
}

export function getDay(planId, date) {
  const plan = getPlan(planId);
  if (!plan) return null;
  return plan.days.find((d) => d.date === date) || null;
}

export function isValidPlanDate(planId, date) {
  return Boolean(getDay(planId, date));
}

export function planMeta() {
  return loadPlans().meta;
}
