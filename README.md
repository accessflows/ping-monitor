# Ping Monitor

Desktop app for watching IP addresses and domains over ICMP. Devices, settings and the full ping
history live in a local database, so nothing is lost when the window is closed or the page is
reloaded.

Built with **Tauri 2 (Rust backend)** + **React 18 / Vite / Tailwind 4**.

## Features

- **Real ICMP ping** – the Rust backend resolves the host and sends an echo request with a
  configurable timeout, reporting round-trip latency (`src-tauri/src/lib.rs`).
- **Add device** – validate IPv4 / IPv6 / domain names, reject duplicates, and probe the device
  straight after it is added.
- **Live dashboard** – stability percentage, status (online / unstable / offline), 60-sample latency
  bars, average latency and last check time per device.
- **Device detail** – failure windows (outages), recent pings and the last probe error.
- **PDF report** – pick a time range and devices; the report is generated in the app (jsPDF) and
  saved through a native dialog.
- **Settings** – status thresholds, ping interval, per-ping timeout, history retention, status change
  alerts and dark/light theme.
- **Version & auto-update** – the running version is shown in the window title (`NetPulse · Ping
  Monitor v0.2.0`), the header and Settings. At startup the app checks GitHub Releases for a newer
  signed build; when one exists an "Update" badge appears in the header and Settings offers a manual
  check.
- **Persistence** – IndexedDB (`ping-monitor` database) stores devices, settings and samples. Old
  samples are pruned automatically to the configured retention window.

## Requirements

- Node.js 20+ and pnpm
- Rust stable with the MSVC toolchain
- WebView2 runtime (preinstalled on Windows 10/11)

## Development

```bash
pnpm install
pnpm tauri:dev        # desktop app with hot reload (real ICMP pings)
pnpm dev              # browser-only UI (pings are simulated, same local database)
```

> The Vite dev server (`localhost:5173`) and the packaged app (`tauri.localhost`) are different
> webview origins, so each keeps its own local database. Data created while running `pnpm tauri:dev`
> is not visible in an installed build.

## Tests

```bash
pnpm typecheck                    # TypeScript
cd src-tauri && cargo test        # Rust: host resolution, ICMP probe, PDF payload
```

## Build

```bash
pnpm typecheck
pnpm build            # frontend bundle -> dist/
pnpm tauri:build      # installers in src-tauri/target/release/bundle
```

## Releasing

Releases are built by [`.github/workflows/release.yml`](.github/workflows/release.yml), started
manually with **Actions → Release → Run workflow**:

| Input | Meaning |
| --- | --- |
| `version` | Version to build, e.g. `0.2.0` or `0.2.0-beta.1` (no `v` prefix) |
| `publish_release` | Create the GitHub Release with installers and `latest.json` |
| `notes` | Optional release notes |

The version is injected at build time (`tauri build --config`), so committed files are not modified.
One binary is produced per OS/CPU pair:

| Artifact | Runner | Target |
| --- | --- | --- |
| `windows-x64` | `windows-latest` | `x86_64-pc-windows-msvc` (NSIS) |
| `windows-arm64` | `windows-11-arm` | `aarch64-pc-windows-msvc` (NSIS) |
| `macos-x64` | `macos-15-intel` | `x86_64-apple-darwin` (app + dmg) |
| `macos-arm64` | `macos-15` | `aarch64-apple-darwin` (app + dmg) |
| `linux-x64` | `ubuntu-22.04` | `x86_64-unknown-linux-gnu` (AppImage + deb) |
| `linux-arm64` | `ubuntu-22.04-arm` | `aarch64-unknown-linux-gnu` (AppImage + deb) |

Installers are **not code-signed**: macOS shows "unidentified developer" (right-click → Open) and
Windows shows a SmartScreen prompt. Add `APPLE_CERTIFICATE`/`APPLE_SIGNING_IDENTITY` and
`WINDOWS_CERTIFICATE` secrets plus the matching signing step if that becomes a requirement.

### Update signing

The updater verifies a minisign signature before installing. `TAURI_SIGNING_PRIVATE_KEY` must exist
as a repository secret; the matching public key lives in `src-tauri/tauri.conf.json`
(`plugins.updater.pubkey`). To rotate the pair:

```bash
pnpm tauri signer generate -w ~/.tauri/ping-monitor.key -p ""
gh secret set TAURI_SIGNING_PRIVATE_KEY --body "$(cat ~/.tauri/ping-monitor.key)"
# paste the contents of ~/.tauri/ping-monitor.key.pub into plugins.updater.pubkey
```

Losing the private key means already-installed apps can no longer auto-update.

## How it works

| Layer | Responsibility |
| --- | --- |
| `src/hooks/useMonitor.ts` | Scheduler loop, state, persistence, alert transitions |
| `src/hooks/useUpdater.ts` | Startup/manual update checks, download progress, relaunch |
| `src/lib/db.ts` | IndexedDB stores (`devices`, `pings`, `settings`) |
| `src/lib/ping.ts` | Calls the Tauri `ping_host` command; simulates in a browser |
| `src/lib/report.ts` | Builds the PDF report and saves it |
| `src-tauri/src/lib.rs` | ICMP probe + native PDF save dialog |

Status is derived from the success ratio of the samples kept in memory (500 per device):

- `≥ goodMin` → **online**
- `≥ unstableMin` → **unstable**
- otherwise → **offline**

## License

MIT (application code). Third-party assets are listed in [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).
