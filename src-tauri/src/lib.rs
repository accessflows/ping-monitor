use std::net::{IpAddr, ToSocketAddrs};
use std::time::{Duration, Instant};

use base64::Engine;
use serde::Serialize;
use tauri::Manager;

/// Result of a single ICMP echo probe. Serialized camelCase for the webview.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingOutcome {
    pub ok: bool,
    pub latency_ms: Option<u64>,
    pub address: Option<String>,
    pub error: Option<String>,
}

fn failure(error: impl Into<String>, address: Option<String>) -> PingOutcome {
    PingOutcome {
        ok: false,
        latency_ms: None,
        address,
        error: Some(error.into()),
    }
}

fn resolve(host: &str) -> Result<IpAddr, String> {
    let candidate = host.trim().trim_start_matches('[').trim_end_matches(']');
    if candidate.is_empty() {
        return Err("Host is empty".to_string());
    }

    if let Ok(ip) = candidate.parse::<IpAddr>() {
        return Ok(ip);
    }

    match (candidate, 0u16).to_socket_addrs() {
        Ok(mut addresses) => addresses
            .next()
            .map(|address| address.ip())
            .ok_or_else(|| "Host did not resolve to any address".to_string()),
        Err(error) => Err(format!("DNS lookup failed: {error}")),
    }
}

fn probe(host: &str, timeout_ms: u64) -> PingOutcome {
    let address = match resolve(host) {
        Ok(ip) => ip,
        Err(error) => return failure(error, None),
    };

    let timeout = Duration::from_millis(timeout_ms.clamp(100, 30_000));
    let started = Instant::now();

    match ping::ping(address, Some(timeout), None, None, None, None) {
        Ok(()) => PingOutcome {
            ok: true,
            latency_ms: Some(started.elapsed().as_millis() as u64),
            address: Some(address.to_string()),
            error: None,
        },
        Err(error) => failure(error.to_string(), Some(address.to_string())),
    }
}

#[tauri::command]
async fn ping_host(host: String, timeout_ms: u64) -> PingOutcome {
    match tauri::async_runtime::spawn_blocking(move || probe(&host, timeout_ms)).await {
        Ok(outcome) => outcome,
        Err(error) => failure(format!("Ping task failed: {error}"), None),
    }
}

/// Opens a native save dialog and writes the generated PDF to the chosen path.
fn decode_pdf_payload(data_base64: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|error| format!("Invalid PDF payload: {error}"))
}

#[tauri::command]
async fn save_pdf(default_name: String, data_base64: String) -> Result<Option<String>, String> {
    let bytes = decode_pdf_payload(&data_base64)?;

    let file = rfd::AsyncFileDialog::new()
        .set_file_name(&default_name)
        .add_filter("PDF document", &["pdf"])
        .save_file()
        .await;

    let Some(file) = file else {
        return Ok(None);
    };

    std::fs::write(file.path(), bytes).map_err(|error| format!("Could not write the file: {error}"))?;
    Ok(Some(file.path().display().to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // The window title carries the running version so users can tell builds apart.
            let version = app.package_info().version.to_string();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title(&format!("NetPulse · Ping Monitor v{version}"));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![ping_host, save_pdf])
        .run(tauri::generate_context!())
        .expect("error while running Ping Monitor");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_ip_literals_and_brackets() {
        assert_eq!(resolve("8.8.8.8").unwrap().to_string(), "8.8.8.8");
        assert_eq!(resolve("[::1]").unwrap().to_string(), "::1");
        assert!(resolve("   ").is_err());
    }

    #[test]
    fn pings_loopback_successfully() {
        let outcome = probe("127.0.0.1", 1000);
        assert!(outcome.ok, "loopback ping failed: {:?}", outcome.error);
        assert!(outcome.latency_ms.is_some());
    }

    #[test]
    fn reports_unresolvable_host() {
        let outcome = probe("ping-monitor.invalid", 500);
        assert!(!outcome.ok);
        assert!(outcome.error.is_some());
    }

    #[test]
    fn decodes_pdf_payload() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(b"%PDF-1.4 sample");
        assert_eq!(decode_pdf_payload(&encoded).unwrap(), b"%PDF-1.4 sample");
        assert!(decode_pdf_payload("not base64 !!!").is_err());
    }
}
