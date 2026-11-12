import { DEFAULT_SETTINGS } from "./constants";
import type { AppSettings, Device, PingRecord, PingRow, StoredPing } from "../types";

const DB_NAME = "ping-monitor";
const DB_VERSION = 1;

const STORE_DEVICES = "devices";
const STORE_PINGS = "pings";
const STORE_SETTINGS = "settings";
const SETTINGS_KEY = "app";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DEVICES)) {
        db.createObjectStore(STORE_DEVICES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_PINGS)) {
        const pings = db.createObjectStore(STORE_PINGS, { keyPath: "id", autoIncrement: true });
        pings.createIndex("deviceId", "deviceId");
        pings.createIndex("deviceTs", ["deviceId", "ts"]);
        pings.createIndex("ts", "ts");
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local database"));
    request.onblocked = () => reject(new Error("The local database is blocked by another window"));
  });

  return dbPromise;
}

const wrap = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local database request failed"));
  });

const completed = (tx: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Local database transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Local database transaction aborted"));
  });

async function store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

/* ── Devices ─────────────────────────────────────────────────────────────── */

export async function listDevices(): Promise<Device[]> {
  const devices = await wrap((await store(STORE_DEVICES, "readonly")).getAll() as IDBRequest<Device[]>);
  return devices.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putDevice(device: Device): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_DEVICES, "readwrite");
  tx.objectStore(STORE_DEVICES).put(device);
  await completed(tx);
}

export async function deleteDevice(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([STORE_DEVICES, STORE_PINGS], "readwrite");
  tx.objectStore(STORE_DEVICES).delete(id);
  const index = tx.objectStore(STORE_PINGS).index("deviceId");
  const cursorRequest = index.openKeyCursor(IDBKeyRange.only(id));
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    tx.objectStore(STORE_PINGS).delete(cursor.primaryKey);
    cursor.continue();
  };
  await completed(tx);
}

/* ── Pings ───────────────────────────────────────────────────────────────── */

export const toRecord = (ping: StoredPing): PingRecord => ({
  id: ping.id,
  ts: ping.ts,
  ok: ping.ok,
  ms: ping.latencyMs,
});

/** Appends a batch of samples and returns their auto-increment ids. */
export async function appendPings(rows: PingRow[]): Promise<number[]> {
  if (rows.length === 0) return [];
  const db = await openDb();
  const tx = db.transaction(STORE_PINGS, "readwrite");
  const objectStore = tx.objectStore(STORE_PINGS);
  const keys: number[] = new Array(rows.length);

  rows.forEach((row, i) => {
    const request = objectStore.add({ ...row });
    request.onsuccess = () => {
      keys[i] = request.result as number;
    };
  });

  await completed(tx);
  return keys;
}

function readNewest(index: IDBIndex, deviceId: string, limit: number, from = 0, to = Number.MAX_SAFE_INTEGER): Promise<StoredPing[]> {
  return new Promise<StoredPing[]>((resolve, reject) => {
    const out: StoredPing[] = [];
    const range = IDBKeyRange.bound([deviceId, from], [deviceId, to]);
    const request = index.openCursor(range, "prev");

    request.onerror = () => reject(request.error ?? new Error("Local database cursor failed"));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || out.length >= limit) {
        out.reverse();
        resolve(out);
        return;
      }
      out.push(cursor.value as StoredPing);
      cursor.continue();
    };
  });
}

/** Returns the newest `limit` samples for each device, oldest first. */
export async function loadRecentPings(deviceIds: string[], limit: number): Promise<Record<string, StoredPing[]>> {
  const result: Record<string, StoredPing[]> = {};
  if (deviceIds.length === 0) return result;
  const index = (await store(STORE_PINGS, "readonly")).index("deviceTs");
  await Promise.all(
    deviceIds.map(async (id) => {
      result[id] = await readNewest(index, id, limit);
    })
  );
  return result;
}

/** Samples inside `[from, to]`, capped per device so exports stay bounded. */
export async function loadPingsInRange(
  deviceIds: string[],
  from: number,
  to: number,
  limitPerDevice: number
): Promise<Record<string, StoredPing[]>> {
  const result: Record<string, StoredPing[]> = {};
  if (deviceIds.length === 0) return result;
  const index = (await store(STORE_PINGS, "readonly")).index("deviceTs");
  await Promise.all(
    deviceIds.map(async (id) => {
      result[id] = await readNewest(index, id, limitPerDevice, from, to);
    })
  );
  return result;
}

/** Deletes at most `batch` samples older than `beforeTs`; returns how many were removed. */
export async function pruneOldPings(beforeTs: number, batch: number): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(STORE_PINGS, "readwrite");
  const objectStore = tx.objectStore(STORE_PINGS);
  const index = objectStore.index("ts");
  let deleted = 0;

  const request = index.openCursor(IDBKeyRange.upperBound(beforeTs, true));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor || deleted >= batch) return;
    cursor.delete();
    deleted += 1;
    cursor.continue();
  };

  await completed(tx);
  return deleted;
}

export async function clearPings(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_PINGS, "readwrite");
  tx.objectStore(STORE_PINGS).clear();
  await completed(tx);
}

/* ── Settings ────────────────────────────────────────────────────────────── */

export async function loadSettings(): Promise<AppSettings> {
  const row = await wrap(
    (await store(STORE_SETTINGS, "readonly")).get(SETTINGS_KEY) as IDBRequest<{ key: string; value: AppSettings } | undefined>
  );
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_SETTINGS, "readwrite");
  tx.objectStore(STORE_SETTINGS).put({ key: SETTINGS_KEY, value: settings });
  await completed(tx);
}
