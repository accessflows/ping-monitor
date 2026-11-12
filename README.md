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

## How it works

| Layer | Responsibility |
| --- | --- |
| `src/hooks/useMonitor.ts` | Scheduler loop, state, persistence, alert transitions |
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
