import { Activity, AlertTriangle, Stethoscope, X } from "lucide-react";
import { STATUS_META } from "../lib/constants";
import { fmtDateTime, fmtDur } from "../lib/format";
import { getAvgMs, getFailureGroups, getStability, getStatus } from "../lib/stats";
import { useTheme, withAlpha } from "../lib/theme";
import type { AppSettings, MonitoredDevice, PingRecord } from "../types";
import { Overlay } from "./Overlay";
import { MONO, ModalCard, StatusPill } from "./ui-bits";

export function DetailModal({
  device,
  settings,
  onClose,
}: {
  device: MonitoredDevice;
  settings: AppSettings;
  onClose: () => void;
}) {
  const T = useTheme();
  const pct = getStability(device.records);
  const status = getStatus(pct, settings, device.records.length);
  const color = T[STATUS_META[status].tone];
  const groups = getFailureGroups(device.records);
  const ok = device.records.filter((record) => record.ok).length;
  const failed = device.records.length - ok;
  const avgMs = getAvgMs(device.records);

  return (
    <Overlay onClose={onClose}>
      <ModalCard maxWidth={680} maxHeight="85vh">
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: T.borderSubtle }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-base leading-tight truncate" style={{ color: T.text }}>
                {device.name}
              </h2>
              <StatusPill status={status} />
            </div>
            <div className="text-sm mt-1 truncate" style={{ color: T.textFaint, fontFamily: MONO }}>
              {device.host}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="pm-hover p-1.5 rounded-lg shrink-0" style={{ color: T.textMuted }}>
            <X size={16} />
          </button>
        </div>

        <div className="pm-scroll overflow-y-auto flex-1 p-6 flex flex-col gap-5">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "STABILITY", value: `${pct}%`, color },
              { label: "TOTAL", value: String(device.records.length), color: T.textDim },
              { label: "SUCCESS", value: String(ok), color: T.good },
              { label: "FAILED", value: String(failed), color: failed > 0 ? T.bad : T.textMuted },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: T.panelAlt }}>
                <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: stat.color, lineHeight: 1.1 }}>
                  {stat.value}
                </div>
                <div className="text-[9px] mt-1.5 uppercase tracking-widest" style={{ color: T.textFaint, fontFamily: MONO }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px]" style={{ color: T.textMuted, fontFamily: MONO }}>
            {avgMs !== null && <span>Avg latency: {avgMs}ms</span>}
            <span>Added: {fmtDateTime(device.createdAt)}</span>
            <span>Interval: {settings.pingInterval}s</span>
            <span>Timeout: {settings.timeoutMs}ms</span>
          </div>

          {device.lastError && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ backgroundColor: withAlpha(T.bad, 0.08), color: T.bad }}
            >
              <Stethoscope size={13} className="mt-0.5 shrink-0" />
              <span style={{ wordBreak: "break-word" }}>Last error: {device.lastError}</span>
            </div>
          )}

          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle size={14} style={{ color: T.warn }} />
              <h3 className="text-xs font-semibold" style={{ color: T.text }}>
                Failure History
              </h3>
              <span
                className="px-2 py-0.5 rounded text-[10px]"
                style={{ color: T.warn, backgroundColor: withAlpha(T.warn, 0.1), fontFamily: MONO }}
              >
                {groups.length} outage{groups.length === 1 ? "" : "s"}
              </span>
            </div>
            {groups.length === 0 ? (
              <div className="rounded-xl p-5 text-center text-xs" style={{ backgroundColor: T.panelAlt, color: T.good }}>
                No failures recorded
              </div>
            ) : (
              <div className="pm-scroll flex flex-col gap-1.5 overflow-y-auto" style={{ maxHeight: 200 }}>
                {groups.map((group) => (
                  <div key={`${group.start}-${group.end}`} className="flex items-stretch gap-3 p-3 rounded-xl" style={{ backgroundColor: T.panelAlt }}>
                    <div className="w-0.5 rounded-full shrink-0" style={{ backgroundColor: T.bad }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs" style={{ color: T.text, fontFamily: MONO }}>
                        {fmtDateTime(group.start)}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: T.textFaint, fontFamily: MONO }}>
                        → {fmtDateTime(group.end)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold" style={{ color: T.bad, fontFamily: MONO }}>
                        {group.count} ping{group.count === 1 ? "" : "s"} failed
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: T.textFaint, fontFamily: MONO }}>
                        {fmtDur(group.end - group.start + settings.pingInterval * 1000)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <RecentPings records={device.records} />
        </div>
      </ModalCard>
    </Overlay>
  );
}

function RecentPings({ records }: { records: PingRecord[] }) {
  const T = useTheme();
  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <Activity size={14} style={{ color: T.textMuted }} />
        <h3 className="text-xs font-semibold" style={{ color: T.text }}>
          Recent Pings
        </h3>
        <span className="text-[10px]" style={{ color: T.textFaint, fontFamily: MONO }}>
          (last 50)
        </span>
      </div>
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: T.borderSubtle }}>
        <div
          className="grid px-4 py-2 text-[10px] uppercase tracking-wider border-b"
          style={{
            gridTemplateColumns: "1fr 70px 70px",
            backgroundColor: T.panelAlt,
            borderColor: T.borderSubtle,
            color: T.textFaint,
            fontFamily: MONO,
          }}
        >
          <span>Timestamp</span>
          <span className="text-center">Status</span>
          <span className="text-right">Latency</span>
        </div>
        <div className="pm-scroll" style={{ maxHeight: 180, overflowY: "auto" }}>
          {records.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs" style={{ color: T.textMuted }}>
              Waiting for the first ping…
            </div>
          ) : (
            [...records]
              .reverse()
              .slice(0, 50)
              .map((record) => (
                <div
                  key={record.id}
                  className="grid px-4 py-2 text-xs border-t"
                  style={{ gridTemplateColumns: "1fr 70px 70px", borderColor: T.borderSubtle, fontFamily: MONO }}
                >
                  <span style={{ color: T.textMuted }}>{fmtDateTime(record.ts)}</span>
                  <span className="text-center font-semibold" style={{ color: record.ok ? T.good : T.bad }}>
                    {record.ok ? "OK" : "FAIL"}
                  </span>
                  <span className="text-right" style={{ color: record.ms ? T.textDim : T.textFaint }}>
                    {record.ms ? `${record.ms}ms` : "—"}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </section>
  );
}
