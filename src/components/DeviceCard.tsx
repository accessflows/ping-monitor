import { Clock, Eye, Trash2 } from "lucide-react";
import { memo } from "react";
import { STATUS_META } from "../lib/constants";
import { fmtTime } from "../lib/format";
import { countFailures, getAvgMs, getStability, getStatus } from "../lib/stats";
import { useTheme } from "../lib/theme";
import type { AppSettings, MonitoredDevice } from "../types";
import { PingBars } from "./PingBars";
import { IconButton, MONO, StatusPill } from "./ui-bits";

interface DeviceCardProps {
  device: MonitoredDevice;
  settings: AppSettings;
  onDetail: () => void;
  onRemove: () => void;
}

export const DeviceCard = memo(function DeviceCard({ device, settings, onDetail, onRemove }: DeviceCardProps) {
  const T = useTheme();
  const pct = getStability(device.records);
  const status = getStatus(pct, settings, device.records.length);
  const color = T[STATUS_META[status].tone];
  const last = device.records[device.records.length - 1];
  const avgMs = getAvgMs(device.records);
  const fails = countFailures(device.records);

  return (
    <div
      className="rounded-xl border flex flex-col gap-3 p-4 group transition-all duration-300"
      style={{
        backgroundColor: T.panel,
        borderColor: T.borderSubtle,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm leading-tight truncate" style={{ color: T.text }}>
            {device.name}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: T.textFaint, fontFamily: MONO }}>
            {device.host}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="flex items-center gap-3">
        <div className="shrink-0 leading-none">
          <span style={{ fontSize: 30, fontFamily: MONO, fontWeight: 700, color, lineHeight: 1 }}>{pct}</span>
          <span style={{ fontSize: 13, fontFamily: MONO, color: T.textFaint }}>%</span>
        </div>
        <div className="flex-1">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.borderSubtle }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px]" style={{ color: T.textFaint, fontFamily: MONO }}>
            <span>STABILITY</span>
            {fails > 0 && <span style={{ color }}>{fails} fails</span>}
          </div>
        </div>
      </div>

      <PingBars records={device.records} />

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: T.borderSubtle }}>
        <div className="flex items-center gap-2 text-[10px] min-w-0" style={{ color: T.textFaint, fontFamily: MONO }}>
          <span>{device.records.length} pings</span>
          {avgMs !== null && (
            <>
              <span>·</span>
              <span>{avgMs}ms avg</span>
            </>
          )}
          {last && (
            <>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <Clock size={8} />
                {fmtTime(last.ts)}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
          <IconButton label="View details" onClick={onDetail} style={{ padding: 6 }}>
            <Eye size={13} />
          </IconButton>
          <IconButton label="Remove device" onClick={onRemove} className="pm-danger" style={{ padding: 6 }}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
    </div>
  );
});
