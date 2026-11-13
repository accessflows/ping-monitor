import { useCallback, useEffect, useRef, useState } from "react";
import { getAppVersion } from "../lib/app-info";
import { isTauriRuntime } from "../lib/ping";

export type UpdaterStatus = "unsupported" | "idle" | "checking" | "available" | "downloading" | "up-to-date" | "error";

export interface UpdateInfo {
  version: string;
  notes: string | null;
  date: string | null;
}

export interface UpdaterApi {
  status: UpdaterStatus;
  currentVersion: string;
  update: UpdateInfo | null;
  progress: number | null;
  error: string | null;
  check: (options?: { silent?: boolean }) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

const CHECK_DELAY_MS = 4000;

type PendingUpdate = {
  version: string;
  body?: string | null;
  date?: string | null;
  downloadAndInstall: (cb?: (event: unknown) => void) => Promise<void>;
};

const toInfo = (update: PendingUpdate): UpdateInfo => ({
  version: update.version,
  notes: update.body ?? null,
  date: update.date ?? null,
});

/**
 * Checks GitHub Releases for a newer signed build and installs it in place.
 * Everything is a no-op in a plain browser tab, where no updater exists.
 */
export function useUpdater(): UpdaterApi {
  const supported = isTauriRuntime();
  const [status, setStatus] = useState<UpdaterStatus>(supported ? "idle" : "unsupported");
  const [currentVersion, setCurrentVersion] = useState("");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<PendingUpdate | null>(null);
  const dismissed = useRef(false);

  useEffect(() => {
    void getAppVersion().then(setCurrentVersion);
  }, []);

  const check = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!supported) return;
      setStatus("checking");
      setError(null);
      try {
        const { check: checkForUpdate } = await import("@tauri-apps/plugin-updater");
        const result = await checkForUpdate();
        if (result) {
          pending.current = result as unknown as PendingUpdate;
          setUpdate(toInfo(pending.current));
          setStatus("available");
          dismissed.current = false;
        } else {
          pending.current = null;
          setUpdate(null);
          setStatus("up-to-date");
          if (!options?.silent) setError(null);
        }
      } catch (cause) {
        pending.current = null;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [supported]
  );

  const install = useCallback(async () => {
    const target = pending.current;
    if (!target) return;

    setStatus("downloading");
    setProgress(0);
    setError(null);
    try {
      let downloaded = 0;
      let total = 0;
      await target.downloadAndInstall((event: unknown) => {
        const payload = event as { event?: string; data?: { contentLength?: number; chunkLength?: number } };
        if (payload.event === "Started") {
          total = payload.data?.contentLength ?? 0;
        } else if (payload.event === "Progress") {
          downloaded += payload.data?.chunkLength ?? 0;
          setProgress(total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : null);
        } else if (payload.event === "Finished") {
          setProgress(100);
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (cause) {
      setStatus("error");
      setProgress(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    setStatus((prev) => (prev === "available" ? "idle" : prev));
  }, []);

  useEffect(() => {
    if (!supported) return;
    const timer = window.setTimeout(() => void check({ silent: true }), CHECK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [supported, check]);

  return { status, currentVersion, update, progress, error, check, install, dismiss };
}
