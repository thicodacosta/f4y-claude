import type { Clock } from './types';

export const stoppedClock = (elapsedMs = 0): Clock => ({ elapsedMs, runningSince: null });

export function elapsed(clock: Clock, now: number): number {
  return clock.elapsedMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince));
}

export function startClock(clock: Clock, now: number): Clock {
  return clock.runningSince === null ? { elapsedMs: clock.elapsedMs, runningSince: now } : clock;
}

export function stopClock(clock: Clock, now: number): Clock {
  return clock.runningSince === null ? clock : stoppedClock(elapsed(clock, now));
}

/** mm:ss ou h:mm:ss */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Segundos restantes até endsAt, arredondado para cima. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
