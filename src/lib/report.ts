import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fontUrl from "../assets/fonts/Roboto-Regular.ttf?url";
import { STATUS_META } from "./constants";
import { fmtDateTime, fmtDur } from "./format";
import { isTauriRuntime } from "./ping";
import { getAvgMs, getFailureGroups, getStability, getStatus } from "./stats";
import type { AppSettings, PingRecord, Status } from "../types";

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#dbe3ec";
const TILE = "#f8fafc";
const GOOD = "#059669";
const WARN = "#b45309";
const BAD = "#b91c1c";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 20;
const MAX_FAILURE_ROWS = 100;

export interface ReportDevice {
  name: string;
  host: string;
  records: PingRecord[];
}

export interface ReportOptions {
  devices: ReportDevice[];
  settings: AppSettings;
  from: number;
  to: number;
  generatedAt: number;
}

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

const lastTableY = (doc: jsPDF, fallback: number): number =>
  (doc as DocWithTable).lastAutoTable?.finalY ?? fallback;

const statusColor = (status: Status): string =>
  status === "good" ? GOOD : status === "unstable" ? WARN : status === "offline" ? BAD : MUTED;

let embeddedFont: string | null = null;

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

/**
 * Embeds the bundled Roboto subset so non-latin device names (e.g. Vietnamese)
 * render correctly. Falls back to the built-in Helvetica if loading fails.
 */
async function embedFont(doc: jsPDF): Promise<string> {
  try {
    if (!embeddedFont) {
      const response = await fetch(fontUrl);
      if (!response.ok) throw new Error(`Font request failed: ${response.status}`);
      embeddedFont = toBase64(new Uint8Array(await response.arrayBuffer()));
    }
    doc.addFileToVFS("Roboto-Regular.ttf", embeddedFont);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    return "Roboto";
  } catch {
    return "helvetica";
  }
}

export async function buildReportPdf({ devices, settings, from, to, generatedAt }: ReportOptions): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const font = await embedFont(doc);

  const totals = devices.reduce(
    (acc, device) => {
      acc.pings += device.records.length;
      acc.ok += device.records.filter((r) => r.ok).length;
      const avg = getAvgMs(device.records);
      if (avg !== null) {
        acc.latencySum += avg;
        acc.latencyCount += 1;
      }
      return acc;
    },
    { pings: 0, ok: 0, latencySum: 0, latencyCount: 0 }
  );
  const failed = totals.pings - totals.ok;
  const successRate = totals.pings === 0 ? 0 : Math.round((totals.ok / totals.pings) * 100);
  const avgLatency = totals.latencyCount === 0 ? null : Math.round(totals.latencySum / totals.latencyCount);

  const text = (value: string, x: number, y: number, options?: { size?: number; color?: string; align?: "left" | "right" | "center" }) => {
    doc.setFont(font, "normal");
    doc.setFontSize(options?.size ?? 9);
    doc.setTextColor(options?.color ?? INK);
    doc.text(value, x, y, options?.align ? { align: options.align } : undefined);
  };

  const drawTiles = (y: number, tiles: { label: string; value: string; color?: string }[]): number => {
    const gap = 2;
    const width = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach((tile, i) => {
      const x = MARGIN + i * (width + gap);
      doc.setFillColor(TILE);
      doc.setDrawColor(LINE);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, y, width, 16, 1.5, 1.5, "FD");
      text(tile.value, x + width / 2, y + 7.5, { size: 12, color: tile.color ?? INK, align: "center" });
      text(tile.label.toUpperCase(), x + width / 2, y + 12.5, { size: 6.5, color: MUTED, align: "center" });
    });
    return y + 16;
  };

  /* ── Header ── */
  text("Network Monitor Report", MARGIN, MARGIN + 6, { size: 18 });
  text(`Period: ${fmtDateTime(from)} → ${fmtDateTime(to)}`, MARGIN, MARGIN + 13, { size: 8.5, color: MUTED });
  text(
    `Generated: ${fmtDateTime(generatedAt)}   ·   ${devices.length} device${devices.length === 1 ? "" : "s"}   ·   interval ${settings.pingInterval}s`,
    MARGIN,
    MARGIN + 18,
    { size: 8.5, color: MUTED }
  );
  doc.setDrawColor(INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, MARGIN + 22, MARGIN + CONTENT_W, MARGIN + 22);

  let cursor = drawTiles(MARGIN + 27, [
    { label: "Devices", value: String(devices.length) },
    { label: "Total pings", value: String(totals.pings) },
    { label: "Success", value: String(totals.ok), color: GOOD },
    { label: "Failed", value: String(failed), color: failed > 0 ? BAD : INK },
    { label: "Success rate", value: `${successRate}%`, color: successRate >= settings.goodMin ? GOOD : WARN },
    { label: "Avg latency", value: avgLatency === null ? "—" : `${avgLatency}ms` },
  ]);

  /* ── Device sections ── */
  for (const device of devices) {
    const pct = getStability(device.records);
    const status = getStatus(pct, settings, device.records.length);
    const color = statusColor(status);
    const groups = getFailureGroups(device.records);
    const shown = groups.slice(0, MAX_FAILURE_ROWS);
    const avg = getAvgMs(device.records);
    const ok = device.records.filter((r) => r.ok).length;

    const sectionTop = cursor + 10;
    if (sectionTop + 52 > BOTTOM) {
      doc.addPage();
      cursor = MARGIN;
    } else {
      cursor = sectionTop;
    }

    text(device.name, MARGIN, cursor + 4, { size: 12 });
    text(device.host, MARGIN, cursor + 9.5, { size: 8, color: MUTED });
    text(`${STATUS_META[status].label} · ${pct}%`, MARGIN + CONTENT_W, cursor + 4, { size: 8.5, color, align: "right" });
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, cursor + 12, MARGIN + CONTENT_W, cursor + 12);

    cursor = drawTiles(cursor + 15, [
      { label: "Stability", value: `${pct}%`, color },
      { label: "Total pings", value: String(device.records.length) },
      { label: "Success", value: String(ok), color: GOOD },
      { label: "Failed", value: String(device.records.length - ok), color: device.records.length - ok > 0 ? BAD : INK },
      { label: "Avg latency", value: avg === null ? "—" : `${avg}ms` },
      { label: "Outages", value: String(groups.length) },
    ]);

    if (shown.length === 0) {
      text("No failures in the selected range.", MARGIN, cursor + 7, { size: 8.5, color: GOOD });
      cursor += 10;
      continue;
    }

    autoTable(doc, {
      startY: cursor + 4,
      head: [["First failed", "Last failed", "Duration", "Pings"]],
      body: shown.map((g) => [
        fmtDateTime(g.start),
        fmtDateTime(g.end),
        fmtDur(g.end - g.start + settings.pingInterval * 1000),
        String(g.count),
      ]),
      theme: "grid",
      styles: { font, fontStyle: "normal", fontSize: 7.5, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
      headStyles: { font, fontStyle: "normal", fillColor: TILE, textColor: MUTED, fontSize: 7, lineColor: LINE, lineWidth: 0.1 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: MARGIN, right: MARGIN, bottom: 20 },
    });

    cursor = lastTableY(doc, cursor) + 2;
    if (groups.length > shown.length) {
      text(`Showing the ${shown.length} most recent outages of ${groups.length}.`, MARGIN, cursor + 3, {
        size: 7,
        color: MUTED,
      });
      cursor += 6;
    }
  }

  /* ── Footers ── */
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    text("NetPulse · Ping Monitor", MARGIN, PAGE_H - 8, { size: 7.5, color: MUTED });
    text(`Page ${page} / ${pages}`, MARGIN + CONTENT_W, PAGE_H - 8, { size: 7.5, color: MUTED, align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

export type SaveResult = "saved" | "cancelled" | "downloaded";

/** Native save dialog inside Tauri, regular anchor download in a browser. */
export async function savePdf(bytes: Uint8Array, fileName: string): Promise<SaveResult> {
  if (isTauriRuntime()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const path = await invoke<string | null>("save_pdf", {
      defaultName: fileName,
      dataBase64: toBase64(bytes),
    });
    return path ? "saved" : "cancelled";
  }

  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
