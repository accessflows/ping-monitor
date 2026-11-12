import { memo } from "react";
import { useTheme, withAlpha } from "../lib/theme";
import type { PingRecord } from "../types";

const BAR_COUNT = 60;

export const PingBars = memo(function PingBars({ records }: { records: PingRecord[] }) {
  const T = useTheme();
  const recent = records.slice(-BAR_COUNT);
  const padding = BAR_COUNT - recent.length;

  return (
    <div className="flex items-end gap-px w-full" style={{ height: 28 }}>
      {Array.from({ length: padding }, (_, i) => (
        <div
          key={`empty-${i}`}
          style={{ flex: 1, height: "10%", backgroundColor: withAlpha(T.text, 0.05), borderRadius: 1 }}
        />
      ))}
      {recent.map((record) => (
        <div
          key={record.id}
          title={record.ok ? `${record.ms ?? 0}ms` : "timeout"}
          style={{
            flex: 1,
            height: record.ok ? `${Math.max(18, Math.min(84, 18 + (record.ms ?? 40) / 1.5))}%` : "100%",
            backgroundColor: record.ok ? T.good : T.bad,
            borderRadius: 1,
            transition: "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
});
