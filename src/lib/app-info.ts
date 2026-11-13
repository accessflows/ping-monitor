import { isTauriRuntime } from "./ping";

/** Build-time version from package.json; the packaged app reports the bundled version instead. */
export const BUILD_VERSION: string = __APP_VERSION__;

/** Version of the running app: the Tauri bundle version when available, otherwise the build version. */
export async function getAppVersion(): Promise<string> {
  if (!isTauriRuntime()) return BUILD_VERSION;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return BUILD_VERSION;
  }
}
