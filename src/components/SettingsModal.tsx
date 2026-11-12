import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DEFAULT_SETTINGS, PING_INTERVALS, RETENTION_OPTIONS, TIMEOUT_OPTIONS } from "../lib/constants";
import { useTheme } from "../lib/theme";
import type { AppSettings, ThemeMode } from "../types";
import { Overlay } from "./Overlay";
import { Chip, GhostButton, ModalCard, ModalFooter, ModalHeader, MONO, PrimaryButton, Switch } from "./ui-bits";

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (next: AppSettings) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClearHistory, onClose }: SettingsModalProps) {
  const T = useTheme();
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const patch = (part: Partial<AppSettings>) => setDraft((prev) => ({ ...prev, ...part }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        ...draft,
        goodMin: Math.min(100, Math.max(draft.goodMin, draft.unstableMin + 1)),
      });
      onClose();
    } catch (cause) {
      toast.error("Could not save settings", { description: cause instanceof Error ? cause.message : String(cause) });
      setSaving(false);
    }
  };

  const clearHistory = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try {
      await onClearHistory();
      toast.success("Ping history cleared");
      onClose();
    } catch (cause) {
      toast.error("Could not clear history", { description: cause instanceof Error ? cause.message : String(cause) });
      setClearing(false);
      setConfirmClear(false);
    }
  };

  return (
    <Overlay onClose={onClose}>
      <ModalCard maxWidth={520} maxHeight="88vh">
        <ModalHeader title="Settings" onClose={onClose} />

        <div className="pm-scroll overflow-y-auto px-6 py-5 flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <SectionTitle>Status thresholds</SectionTitle>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium" style={{ color: T.text }}>
                  Good (online) threshold
                </span>
                <span style={{ color: T.good, fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>≥ {draft.goodMin}%</span>
              </div>
              <input
                type="range"
                className="pm-range w-full"
                min={draft.unstableMin + 1}
                max={100}
                value={draft.goodMin}
                onChange={(event) => patch({ goodMin: Number(event.target.value) })}
                style={{ ["--pm-range-thumb" as string]: T.good }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium" style={{ color: T.text }}>
                  Unstable floor
                </span>
                <span style={{ color: T.warn, fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>
                  {draft.unstableMin}–{draft.goodMin - 1}%
                </span>
              </div>
              <input
                type="range"
                className="pm-range w-full"
                min={0}
                max={Math.max(draft.goodMin - 1, 1)}
                value={draft.unstableMin}
                onChange={(event) => patch({ unstableMin: Number(event.target.value) })}
                style={{ ["--pm-range-thumb" as string]: T.warn }}
              />
            </div>

            <div className="rounded-xl p-3.5 flex flex-col gap-2" style={{ backgroundColor: T.panelAlt }}>
              <LegendRow color={T.good} label="Online" range={`≥ ${draft.goodMin}%`} />
              <LegendRow color={T.warn} label="Unstable" range={`${draft.unstableMin}% – ${draft.goodMin - 1}%`} />
              <LegendRow color={T.bad} label="Offline" range={`< ${draft.unstableMin}%`} />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Ping</SectionTitle>
            <div>
              <span className="text-xs font-medium block mb-2" style={{ color: T.textDim }}>
                Interval between checks
              </span>
              <div className="flex gap-2 flex-wrap">
                {PING_INTERVALS.map((value) => (
                  <Chip key={value} mono active={draft.pingInterval === value} onClick={() => patch({ pingInterval: value })}>
                    {value}s
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium block mb-2" style={{ color: T.textDim }}>
                Timeout per ping
              </span>
              <div className="flex gap-2 flex-wrap">
                {TIMEOUT_OPTIONS.map((value) => (
                  <Chip key={value} mono active={draft.timeoutMs === value} onClick={() => patch({ timeoutMs: value })}>
                    {value}ms
                  </Chip>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Data &amp; alerts</SectionTitle>
            <div>
              <span className="text-xs font-medium block mb-2" style={{ color: T.textDim }}>
                Keep history for
              </span>
              <div className="flex gap-2 flex-wrap">
                {RETENTION_OPTIONS.map((value) => (
                  <Chip key={value} mono active={draft.retentionDays === value} onClick={() => patch({ retentionDays: value })}>
                    {value}d
                  </Chip>
                ))}
              </div>
              <p className="text-[11px] mt-2" style={{ color: T.textMuted }}>
                Older samples are removed automatically to keep the local database small.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-medium" style={{ color: T.text }}>
                  Status change alerts
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  Show a notification when a device goes offline, becomes unstable or recovers.
                </div>
              </div>
              <Switch checked={draft.notifications} onChange={(value) => patch({ notifications: value })} label="Status change alerts" />
            </div>

            <button
              type="button"
              onClick={() => void clearHistory()}
              disabled={clearing}
              className="pm-danger self-start flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50"
              style={{ borderColor: T.border, color: confirmClear ? T.bad : T.textMuted }}
            >
              {clearing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {confirmClear ? "Click again to delete all ping history" : "Clear ping history"}
            </button>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>Appearance</SectionTitle>
            <div className="flex gap-2">
              {(["dark", "light"] as ThemeMode[]).map((mode) => (
                <Chip key={mode} active={draft.theme === mode} onClick={() => patch({ theme: mode })}>
                  {mode === "dark" ? "Dark" : "Light"}
                </Chip>
              ))}
            </div>
          </section>
        </div>

        <ModalFooter>
          <GhostButton
            onClick={() => setDraft((prev) => ({ ...DEFAULT_SETTINGS, theme: prev.theme }))}
            className="flex items-center gap-1.5 mr-auto"
          >
            <RotateCcw size={13} />
            Restore defaults
          </GhostButton>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void save()} disabled={saving}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save Settings
          </PrimaryButton>
        </ModalFooter>
      </ModalCard>
    </Overlay>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  const T = useTheme();
  return (
    <h3 className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: T.textFaint, fontFamily: MONO }}>
      {children}
    </h3>
  );
}

function LegendRow({ color, label, range }: { color: string; label: string; range: string }) {
  const T = useTheme();
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="font-medium" style={{ color: T.text, width: 64 }}>
        {label}
      </span>
      <span style={{ color: T.textMuted, fontFamily: MONO }}>{range}</span>
    </div>
  );
}
