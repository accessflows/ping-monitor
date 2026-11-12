import type { PingOutcome } from "../types";

/** True inside the Tauri webview, false in a plain browser tab. */
export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

/**
 * The backend reports camelCase fields (serde rename_all).
 * Latency is `null` when the probe failed or the host did not answer in time.
 */
interface BackendPing {
  ok: boolean;
  latencyMs: number | null;
  address: string | null;
  error: string | null;
}

const simulate = (reliability: number): PingOutcome => {
  const ok = Math.random() < reliability;
  return {
    ok,
    latencyMs: ok ? Math.round(8 + Math.random() * 120) : null,
    address: null,
    error: ok ? null : "Simulated timeout",
    simulated: true,
  };
};

export async function pingHost(host: string, timeoutMs: number, simulationReliability = 0.95): Promise<PingOutcome> {
  if (!isTauriRuntime()) return simulate(simulationReliability);

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<BackendPing>("ping_host", { host, timeoutMs });
    return {
      ok: result.ok,
      latencyMs: result.latencyMs,
      address: result.address,
      error: result.error,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: null,
      address: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
