import type { AppSettings, Status, Tone } from "../types";

/** How many samples per device are kept in memory for the dashboard. */
export const HISTORY_LIMIT = 500;

export const DEFAULT_SETTINGS: AppSettings = {
  goodMin: 80,
  unstableMin: 50,
  pingInterval: 3,
  timeoutMs: 2000,
  retentionDays: 7,
  notifications: true,
  theme: "dark",
};

export const PING_INTERVALS = [1, 3, 5, 10, 30, 60];

export const TIMEOUT_OPTIONS = [1000, 2000, 3000, 5000];

export const RETENTION_OPTIONS = [1, 3, 7, 14, 30];

export const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  good: { label: "ONLINE", tone: "good" },
  unstable: { label: "UNSTABLE", tone: "warn" },
  offline: { label: "OFFLINE", tone: "bad" },
  pending: { label: "PENDING", tone: "pending" },
};

/** Max number of concurrent in-flight pings per scheduler tick. */
export const PING_CONCURRENCY = 4;

/** Bounded batches so pruning never blocks the UI for long. */
export const PRUNE_BATCH = 5000;

export const PRUNE_INTERVAL_MS = 10 * 60 * 1000;
