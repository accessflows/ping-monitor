import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { mapLimit } from "../lib/async";
import { DEFAULT_SETTINGS, HISTORY_LIMIT, PING_CONCURRENCY, PRUNE_BATCH, PRUNE_INTERVAL_MS } from "../lib/constants";
import * as db from "../lib/db";
import { isTauriRuntime, pingHost } from "../lib/ping";
import { getStability, getStatus } from "../lib/stats";
import type { AppSettings, Device, MonitoredDevice, Status } from "../types";

const DAY_MS = 86_400_000;

interface Transition {
  name: string;
  host: string;
  from: Status;
  to: Status;
}

const notifyTransitions = (transitions: Transition[]) => {
  for (const t of transitions) {
    if (t.to === "offline") toast.error(`${t.name} is offline`, { description: t.host });
    else if (t.to === "unstable") toast.warning(`${t.name} is unstable`, { description: t.host });
    else if (t.to === "good") toast.success(`${t.name} recovered`, { description: t.host });
  }
};

export type StatusCounts = Record<Status, number>;

export interface MonitorApi {
  ready: boolean;
  devices: MonitoredDevice[];
  settings: AppSettings;
  stats: StatusCounts;
  simulation: boolean;
  addDevice: (name: string, host: string) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  updateSettings: (next: AppSettings) => Promise<void>;
  clearHistory: () => Promise<void>;
}

export function useMonitor(): MonitorApi {
  const [ready, setReady] = useState(false);
  const [devices, setDevices] = useState<MonitoredDevice[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [simulation] = useState(() => !isTauriRuntime());

  const stateRef = useRef({ devices, settings });
  useEffect(() => {
    stateRef.current = { devices, settings };
  }, [devices, settings]);

  const pruningRef = useRef(false);
  const prune = useCallback(async (current: AppSettings) => {
    if (pruningRef.current) return;
    pruningRef.current = true;
    try {
      const cutoff = Date.now() - current.retentionDays * DAY_MS;
      for (let i = 0; i < 4; i += 1) {
        const deleted = await db.pruneOldPings(cutoff, PRUNE_BATCH);
        if (deleted < PRUNE_BATCH) break;
      }
    } catch {
      // Pruning is best effort; a failed pass is retried on the next cycle.
    } finally {
      pruningRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await db.loadSettings();
        await prune(stored);
        const storedDevices = await db.listDevices();
        const pings = await db.loadRecentPings(
          storedDevices.map((d) => d.id),
          HISTORY_LIMIT
        );
        if (cancelled) return;
        setSettings(stored);
        setDevices(
          storedDevices.map((device) => ({
            ...device,
            records: (pings[device.id] ?? []).map(db.toRecord),
            lastError: null,
          }))
        );
      } catch (error) {
        if (!cancelled) {
          toast.error("Could not load local data", {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prune]);

  const runningRef = useRef(false);
  const runTick = useCallback(async () => {
    if (runningRef.current) return;
    const snapshot = stateRef.current.devices;
    if (snapshot.length === 0) return;

    runningRef.current = true;
    try {
      const current = stateRef.current.settings;
      const outcomes = await mapLimit(snapshot, PING_CONCURRENCY, async (device) => ({
        device,
        outcome: await pingHost(device.host, current.timeoutMs, device.simReliability),
      }));

      const ts = Date.now();
      const ids = await db.appendPings(
        outcomes.map(({ device, outcome }) => ({
          deviceId: device.id,
          ts,
          ok: outcome.ok,
          latencyMs: outcome.latencyMs,
        }))
      );

      const byDevice = new Map(outcomes.map(({ device, outcome }, i) => [device.id, { outcome, id: ids[i] }]));
      const transitions: Transition[] = [];
      const merged = new Map<string, MonitoredDevice>();

      for (const device of snapshot) {
        const hit = byDevice.get(device.id);
        if (!hit) continue;
        const before = getStatus(getStability(device.records), current, device.records.length);
        const records = [...device.records, { id: hit.id, ts, ok: hit.outcome.ok, ms: hit.outcome.latencyMs }].slice(
          -HISTORY_LIMIT
        );
        const after = getStatus(getStability(records), current, records.length);
        if (before !== after && before !== "pending") {
          transitions.push({ name: device.name, host: device.host, from: before, to: after });
        }
        merged.set(device.id, { ...device, records, lastError: hit.outcome.error ?? null });
      }

      setDevices((prev) => prev.map((device) => merged.get(device.id) ?? device));
      if (current.notifications) notifyTransitions(transitions);
    } catch (error) {
      toast.error("Ping cycle failed", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    let timer = 0;

    const loop = async () => {
      await runTick();
      if (stopped) return;
      timer = window.setTimeout(loop, Math.max(stateRef.current.settings.pingInterval, 1) * 1000);
    };

    timer = window.setTimeout(loop, 400);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [ready, runTick]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => void prune(stateRef.current.settings), PRUNE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [ready, prune]);

  const probeDevice = useCallback(async (device: Device) => {
    const { timeoutMs } = stateRef.current.settings;
    const outcome = await pingHost(device.host, timeoutMs, device.simReliability);
    const ts = Date.now();
    const [id] = await db.appendPings([{ deviceId: device.id, ts, ok: outcome.ok, latencyMs: outcome.latencyMs }]);
    setDevices((prev) =>
      prev.map((item) =>
        item.id === device.id
          ? {
              ...item,
              records: [...item.records, { id, ts, ok: outcome.ok, ms: outcome.latencyMs }].slice(-HISTORY_LIMIT),
              lastError: outcome.error ?? null,
            }
          : item
      )
    );
  }, []);

  const addDevice = useCallback(
    async (name: string, host: string) => {
      const device: Device = {
        id: crypto.randomUUID(),
        name: name.trim() || host.trim(),
        host: host.trim(),
        createdAt: Date.now(),
        simReliability: 0.9 + Math.random() * 0.08,
      };
      await db.putDevice(device);
      setDevices((prev) => [...prev, { ...device, records: [], lastError: null }]);
      void probeDevice(device);
    },
    [probeDevice]
  );

  const removeDevice = useCallback(async (id: string) => {
    setDevices((prev) => prev.filter((device) => device.id !== id));
    try {
      await db.deleteDevice(id);
    } catch (error) {
      toast.error("Could not remove device", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const updateSettings = useCallback(
    async (next: AppSettings) => {
      setSettings(next);
      await db.saveSettings(next);
      const cutoff = Date.now() - next.retentionDays * DAY_MS;
      setDevices((prev) => prev.map((device) => ({ ...device, records: device.records.filter((r) => r.ts >= cutoff) })));
      void prune(next);
    },
    [prune]
  );

  const clearHistory = useCallback(async () => {
    await db.clearPings();
    setDevices((prev) => prev.map((device) => ({ ...device, records: [] })));
  }, []);

  const stats = useMemo<StatusCounts>(() => {
    const counts: StatusCounts = { good: 0, unstable: 0, offline: 0, pending: 0 };
    devices.forEach((device) => {
      counts[getStatus(getStability(device.records), settings, device.records.length)] += 1;
    });
    return counts;
  }, [devices, settings]);

  return {
    ready,
    devices,
    settings,
    stats,
    simulation,
    addDevice,
    removeDevice,
    updateSettings,
    clearHistory,
  };
}
