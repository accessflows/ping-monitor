export type ThemeMode = "dark" | "light";

export type Status = "good" | "unstable" | "offline" | "pending";

export type Tone = "good" | "warn" | "bad" | "pending";

/** A single ping sample as kept in memory for the UI. */
export interface PingRecord {
  id: number;
  ts: number;
  ok: boolean;
  ms: number | null;
}

/** Consecutive failed pings collapsed into one outage window. */
export interface FailureGroup {
  start: number;
  end: number;
  count: number;
}

export interface Device {
  id: string;
  name: string;
  host: string;
  createdAt: number;
  /** Only used by the in-browser simulation fallback (no Tauri backend). */
  simReliability: number;
}

export interface MonitoredDevice extends Device {
  records: PingRecord[];
  lastError?: string | null;
}

export interface AppSettings {
  goodMin: number;
  unstableMin: number;
  pingInterval: number;
  timeoutMs: number;
  retentionDays: number;
  notifications: boolean;
  theme: ThemeMode;
}

export interface PingRow {
  deviceId: string;
  ts: number;
  ok: boolean;
  latencyMs: number | null;
}

export interface StoredPing extends PingRow {
  id: number;
}

export interface PingOutcome {
  ok: boolean;
  latencyMs: number | null;
  address: string | null;
  error: string | null;
  simulated?: boolean;
}

export type ModalType = null | "add" | "settings" | "detail" | "export";
