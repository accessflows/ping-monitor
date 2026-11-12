import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { STATUS_META } from "../lib/constants";
import * as db from "../lib/db";
import { fmtDateInput, fmtFileStamp } from "../lib/format";
import { buildReportPdf, savePdf } from "../lib/report";
import { getStability, getStatus } from "../lib/stats";
import { useTheme, withAlpha } from "../lib/theme";
import type { AppSettings, MonitoredDevice } from "../types";
import { Overlay } from "./Overlay";
import { Chip, GhostButton, ModalCard, ModalFooter, ModalHeader, MONO, PrimaryButton, TextInput } from "./ui-bits";

const DAY_MS = 86_400_000;
const LIMIT_PER_DEVICE = 20_000;

const QUICK_RANGES = [
  { label: "1h", ms: 3_600_000 },
  { label: "24h", ms: DAY_MS },
  { label: "7d", ms: 7 * DAY_MS },
  { label: "30d", ms: 30 * DAY_MS },
];

interface ExportModalProps {
  devices: MonitoredDevice[];
  settings: AppSettings;
  onClose: () => void;
}

export function ExportModal({ devices, settings, onClose }: ExportModalProps) {
  const T = useTheme();
  const [from, setFrom] = useState(() => fmtDateInput(Date.now() - DAY_MS));
  const [to, setTo] = useState(() => fmtDateInput(Date.now()));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(devices.map((device) => device.id)));
  const [busy, setBusy] = useState(false);

  const allSelected = devices.length > 0 && selected.size === devices.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const applyQuickRange = (ms: number) => {
    const now = Date.now();
    setTo(fmtDateInput(now));
    setFrom(fmtDateInput(now - ms));
  };

  const generate = async () => {
    if (busy) return;

    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime();
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) {
      toast.error("Invalid time range");
      return;
    }
    if (fromTs >= toTs) {
      toast.error("Invalid time range", { description: "The start must be before the end." });
      return;
    }

    const chosen = devices.filter((device) => selected.has(device.id));
    if (chosen.length === 0) {
      toast.error("Select at least one device");
      return;
    }

    setBusy(true);
    try {
      const stored = await db.loadPingsInRange(
        chosen.map((device) => device.id),
        fromTs,
        toTs,
        LIMIT_PER_DEVICE
      );
      const report = chosen
        .map((device) => ({
          name: device.name,
          host: device.host,
          records: (stored[device.id] ?? []).map(db.toRecord),
        }))
        .filter((device) => device.records.length > 0);

      if (report.length === 0) {
        toast.warning("No ping data in the selected range", {
          description: "Try a wider time range or another device.",
        });
        setBusy(false);
        return;
      }

      const bytes = await buildReportPdf({
        devices: report,
        settings,
        from: fromTs,
        to: toTs,
        generatedAt: Date.now(),
      });
      const result = await savePdf(bytes, `ping-report-${fmtFileStamp(Date.now())}.pdf`);

      if (result === "cancelled") {
        setBusy(false);
        return;
      }
      toast.success(result === "saved" ? "Report saved" : "Report downloaded");
      onClose();
    } catch (cause) {
      toast.error("Could not export the report", { description: cause instanceof Error ? cause.message : String(cause) });
      setBusy(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard maxWidth={480}>
        <ModalHeader title="Export PDF Report" onClose={onClose} />

        <div className="px-6 py-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: T.textDim }}>
                Time range
              </span>
              <div className="flex gap-1.5">
                {QUICK_RANGES.map((range) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => applyQuickRange(range.ms)}
                    className="pm-hover px-2 py-1 rounded-md text-[10px]"
                    style={{ color: T.textMuted, fontFamily: MONO }}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px]" style={{ color: T.textMuted }}>
                  From
                </span>
                <TextInput type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} mono />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px]" style={{ color: T.textMuted }}>
                  To
                </span>
                <TextInput type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} mono />
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: T.textDim }}>
                Devices ({selected.size}/{devices.length})
              </span>
              <Chip
                active={false}
                onClick={() => setSelected(allSelected ? new Set() : new Set(devices.map((device) => device.id)))}
                style={{ padding: "2px 8px" }}
              >
                {allSelected ? "Deselect all" : "Select all"}
              </Chip>
            </div>
            <div
              className="pm-scroll flex flex-col rounded-xl overflow-y-auto border"
              style={{ borderColor: T.borderSubtle, maxHeight: 180 }}
            >
              {devices.length === 0 && (
                <div className="px-4 py-5 text-center text-xs" style={{ color: T.textMuted }}>
                  No devices to report on yet.
                </div>
              )}
              {devices.map((device) => {
                const pct = getStability(device.records);
                const tone = STATUS_META[getStatus(pct, settings, device.records.length)].tone;
                return (
                  <label
                    key={device.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b"
                    style={{ backgroundColor: T.panelAlt, borderColor: T.borderSubtle }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(device.id)}
                      onChange={() => toggle(device.id)}
                      style={{ accentColor: T.accent }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate" style={{ color: T.text }}>
                        {device.name}
                      </div>
                      <div className="text-[10px] truncate" style={{ color: T.textFaint, fontFamily: MONO }}>
                        {device.host}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T[tone] }} />
                      <span style={{ color: T.textMuted, fontFamily: MONO, fontSize: 10 }}>{pct}%</span>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] mt-2" style={{ color: T.textMuted }}>
              Reports include stability, latency and outage windows read from the local database.
            </p>
          </div>

          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px]"
            style={{ backgroundColor: withAlpha(T.warn, 0.08), color: T.warn }}
          >
            <FileDown size={13} className="mt-0.5 shrink-0" />
            <span>Up to {LIMIT_PER_DEVICE.toLocaleString("en-US")} samples per device are included, newest first.</span>
          </div>
        </div>

        <ModalFooter>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void generate()} disabled={busy || selected.size === 0}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {busy ? "Generating…" : "Generate PDF"}
          </PrimaryButton>
        </ModalFooter>
      </ModalCard>
    </Overlay>
  );
}
