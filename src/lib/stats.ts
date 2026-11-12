import type { AppSettings, FailureGroup, PingRecord, Status } from "../types";

export const getStability = (records: PingRecord[]): number =>
  records.length === 0 ? 0 : Math.round((records.filter((r) => r.ok).length / records.length) * 100);

export const getStatus = (pct: number, settings: AppSettings, count: number): Status => {
  if (!count) return "pending";
  if (pct >= settings.goodMin) return "good";
  if (pct >= settings.unstableMin) return "unstable";
  return "offline";
};

/** Groups consecutive failures into outages, newest first. */
export const getFailureGroups = (records: PingRecord[]): FailureGroup[] => {
  const sorted = [...records].sort((a, b) => a.ts - b.ts);
  const groups: FailureGroup[] = [];
  let cur: FailureGroup | null = null;
  for (const r of sorted) {
    if (!r.ok) {
      if (cur) {
        cur.end = r.ts;
        cur.count += 1;
      } else {
        cur = { start: r.ts, end: r.ts, count: 1 };
      }
    } else if (cur) {
      groups.push(cur);
      cur = null;
    }
  }
  if (cur) groups.push(cur);
  return groups.reverse();
};

export const getAvgMs = (records: PingRecord[]): number | null => {
  const ok = records.filter((r) => r.ok && r.ms !== null);
  return ok.length ? Math.round(ok.reduce((s, r) => s + (r.ms ?? 0), 0) / ok.length) : null;
};

export const countFailures = (records: PingRecord[]): number => records.filter((r) => !r.ok).length;
