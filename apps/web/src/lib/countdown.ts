const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const URGENT_MS = 2 * MINUTE; // the anti-sniping window

// "2d 4h", "3h 12min", "12:05" (mm:ss) — more precise as the end gets closer
export function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  if (ms >= DAY) return `${Math.floor(ms / DAY)}d ${Math.floor((ms % DAY) / HOUR)}h`;
  if (ms >= HOUR) return `${Math.floor(ms / HOUR)}h ${Math.floor((ms % HOUR) / MINUTE)}min`;
  const m = Math.floor(ms / MINUTE);
  const s = Math.floor((ms % MINUTE) / SECOND);
  return `${m}:${String(s).padStart(2, "0")}`;
}
