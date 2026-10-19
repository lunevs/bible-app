import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api.js';

// Клиентский учёт активного времени чтения (раздел 6 ТЗ):
// секунды набегают, только когда вкладка видима И была недавняя активность
// (прокрутка, касание, движение). Плюс отслеживание «дошёл до конца».
export function useReadingTracker({ planId, date, enabled, initialSeconds = 0, thresholdSeconds, onStatus }) {
  const [seconds, setSeconds] = useState(initialSeconds); // всего накоплено (включая прошлые сеансы)
  // Продолжаем таймер с накопленного сервером активного времени при повторном открытии.
  const initialRemaining = enabled ? Math.max(0, thresholdSeconds - initialSeconds) : 0;
  const [remainingSeconds, setRemainingSeconds] = useState(initialRemaining);
  const remainingRef = useRef(initialRemaining);
  const creditedRef = useRef(!enabled);
  const [status, setStatus] = useState(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const secondsRef = useRef(initialSeconds);
  const unsentRef = useRef(0);
  const lastActivityRef = useRef(Date.now());
  const reachedEndRef = useRef(false);
  const visibleRef = useRef(document.visibilityState === 'visible');
  const enabledRef = useRef(enabled);
  const socketBusyRef = useRef(false);

  const IDLE_MS = 30000;
  const SEND_MS = 12000;

  enabledRef.current = enabled;

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const send = useCallback(async ({ beacon = false } = {}) => {
    if (!enabledRef.current || socketBusyRef.current) return;
    const delta = Math.floor(unsentRef.current);
    if (delta <= 0 && !reachedEndRef.current) return;
    socketBusyRef.current = true;
    unsentRef.current -= delta;
    try {
      const res = await api.post('/reading/progress', {
        planId,
        date,
        seconds: delta,
        reachedEnd: reachedEndRef.current,
      });
      if (res.status === 'green' || res.status === 'blue') creditedRef.current = true;
      setStatus(res.status);
      onStatus?.(res.status);
    } catch {
      // Если не отправилось — вернём секунды в очередь.
      unsentRef.current += delta;
    } finally {
      socketBusyRef.current = false;
    }
  }, [planId, date, onStatus]);

  // Накопление активного времени.
  useEffect(() => {
    const tick = setInterval(() => {
      if (!visibleRef.current) return;
      if (Date.now() - lastActivityRef.current >= IDLE_MS) return;
      if (enabledRef.current && !creditedRef.current && remainingRef.current > 0) {
        secondsRef.current += 1;
        unsentRef.current += 1;
        setSeconds(secondsRef.current);
        remainingRef.current -= 1;
        setRemainingSeconds(remainingRef.current);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Слушатели активности и видимости.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      visibleRef.current = document.visibilityState === 'visible';
      if (!visibleRef.current) send();
    };
    const onHide = () => send();
    ['scroll', 'touchstart', 'touchmove', 'mousemove', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, markActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      ['scroll', 'touchstart', 'touchmove', 'mousemove', 'keydown'].forEach((ev) =>
        window.removeEventListener(ev, markActivity)
      );
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', onHide);
      send();
    };
  }, [enabled, markActivity, send]);

  // Периодическая отправка.
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => send(), SEND_MS);
    return () => clearInterval(t);
  }, [enabled, send]);

  const markReachedEnd = useCallback(() => {
    if (reachedEndRef.current) return;
    reachedEndRef.current = true;
    setReachedEnd(true);
    send();
  }, [send]);

  return { seconds, remainingSeconds, status, reachedEnd, markReachedEnd, refs: { secondsRef } };
}
