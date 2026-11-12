import { Download, Plus, Settings, Signal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { StatusCounts } from "../hooks/useMonitor";
import { useTheme } from "../lib/theme";
import type { Status } from "../types";
import { GhostButton, IconButton, MONO, PrimaryButton, SummaryBadge } from "./ui-bits";

interface HeaderProps {
  stats: StatusCounts;
  simulation: boolean;
  onAdd: () => void;
  onSettings: () => void;
  onExport: () => void;
}

const BADGES: { key: Status; tone: "good" | "warn" | "bad" | "pending"; label: string }[] = [
  { key: "good", tone: "good", label: "Online" },
  { key: "unstable", tone: "warn", label: "Unstable" },
  { key: "offline", tone: "bad", label: "Offline" },
  { key: "pending", tone: "pending", label: "Pending" },
];

/** 0 = everything visible, 1 = compact badges, 2 = badges hidden. */
type Density = 0 | 1 | 2;

export function Header({ stats, simulation, onAdd, onSettings, onExport }: HeaderProps) {
  const T = useTheme();
  const headerRef = useRef<HTMLElement>(null);
  const [density, setDensity] = useState<Density>(0);

  useEffect(() => {
    const element = headerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setDensity(width < 720 ? 2 : width < 900 ? 1 : 0);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const visibleBadges = BADGES.filter((badge) => badge.key !== "pending" || stats.pending > 0);

  return (
    <header
      ref={headerRef}
      className="shrink-0 border-b flex items-center justify-between px-6 gap-4"
      style={{ height: 56, backgroundColor: T.headerBg, borderColor: T.borderSubtle }}
    >
      <div className="flex items-center gap-4 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <Signal size={17} style={{ color: T.accent }} strokeWidth={2.5} />
          <span className="font-semibold text-sm" style={{ color: T.text, letterSpacing: "0.04em" }}>
            NetPulse
          </span>
        </div>

        <div
          className="flex items-center gap-1.5 shrink-0"
          title={
            simulation
              ? "Running in a browser: pings are simulated. Launch the desktop app for real ICMP."
              : "Real ICMP pings from the desktop backend"
          }
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${simulation ? "" : "animate-pulse"}`}
            style={{ backgroundColor: simulation ? T.warn : T.good }}
          />
          {density === 0 && (
            <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFaint, fontFamily: MONO }}>
              {simulation ? "Simulation" : "Live"}
            </span>
          )}
        </div>

        {density < 2 && <div className="w-px h-4 shrink-0" style={{ backgroundColor: T.border }} />}

        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {density < 2 &&
            visibleBadges.map((badge) => (
              <SummaryBadge
                key={badge.key}
                count={stats[badge.key]}
                tone={badge.tone}
                label={badge.label}
                compact={density === 1}
              />
            ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <GhostButton onClick={onExport} className="flex items-center gap-1.5">
          <Download size={13} />
          Export
        </GhostButton>
        <IconButton label="Settings" onClick={onSettings}>
          <Settings size={15} />
        </IconButton>
        <PrimaryButton onClick={onAdd} className="ml-1">
          <Plus size={13} />
          Add Device
        </PrimaryButton>
      </div>
    </header>
  );
}
