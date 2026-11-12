import { AlertTriangle, Clock, Wifi, WifiOff, X } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { STATUS_META } from "../lib/constants";
import { useTheme, withAlpha } from "../lib/theme";
import type { Status } from "../types";

export const MONO = "'JetBrains Mono', ui-monospace, monospace";

export const STATUS_ICONS: Record<Status, typeof Wifi> = {
  good: Wifi,
  unstable: AlertTriangle,
  offline: WifiOff,
  pending: Clock,
};

/* ── Modal shell ─────────────────────────────────────────────────────────── */

export function ModalCard({
  children,
  maxWidth = 460,
  maxHeight,
  className = "",
}: {
  children: ReactNode;
  maxWidth?: number;
  maxHeight?: string;
  className?: string;
}) {
  const T = useTheme();
  return (
    <div
      className={`w-full flex flex-col ${className}`}
      style={{
        maxWidth,
        maxHeight,
        backgroundColor: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        boxShadow: `0 24px 64px ${T.shadow}`,
      }}
    >
      {children}
    </div>
  );
}

export function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const T = useTheme();
  return (
    <div className="flex items-center justify-between px-6 pt-5">
      <h2 className="text-sm font-semibold" style={{ color: T.text }}>
        {title}
      </h2>
      <button type="button" onClick={onClose} aria-label="Close" className="pm-hover p-1.5 rounded-lg" style={{ color: T.textMuted }}>
        <X size={16} />
      </button>
    </div>
  );
}

export function ModalFooter({ children }: { children: ReactNode }) {
  const T = useTheme();
  return (
    <div className="flex gap-2 justify-end px-6 py-4 border-t" style={{ borderColor: T.borderSubtle }}>
      {children}
    </div>
  );
}

/* ── Inputs ──────────────────────────────────────────────────────────────── */

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  const T = useTheme();
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: T.textDim }}>
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] leading-snug" style={{ color: T.textMuted }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean; invalid?: boolean };

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { mono = false, invalid = false, style, ...props },
  ref
) {
  const T = useTheme();
  return (
    <input
      ref={ref}
      {...props}
      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
      style={{
        backgroundColor: T.panelAlt,
        border: `1px solid ${invalid ? T.bad : T.border}`,
        color: T.text,
        fontFamily: mono ? MONO : undefined,
        colorScheme: T.mode,
        ...style,
      }}
    />
  );
});

/* ── Buttons ─────────────────────────────────────────────────────────────── */

export function PrimaryButton({
  children,
  className = "",
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const T = useTheme();
  return (
    <button
      {...props}
      className={`pm-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      style={{ backgroundColor: T.accent, color: T.accentText, ...style }}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", style, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const T = useTheme();
  return (
    <button
      {...props}
      className={`pm-hover px-4 py-2 rounded-xl text-xs font-medium ${className}`}
      style={{ color: T.textMuted, ...style }}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className = "",
  style,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const T = useTheme();
  return (
    <button
      {...props}
      type="button"
      title={label}
      aria-label={label}
      className={`pm-hover p-2 rounded-xl ${className}`}
      style={{ color: T.textMuted, ...style }}
    >
      {children}
    </button>
  );
}

export function Chip({
  active,
  mono = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean; mono?: boolean }) {
  const T = useTheme();
  return (
    <button
      {...props}
      type="button"
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? T.accent : T.panelHover,
        border: `1px solid ${active ? T.accent : T.border}`,
        color: active ? T.accentText : T.textMuted,
        fontFamily: mono ? MONO : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  const T = useTheme();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative shrink-0 rounded-full transition-colors"
      style={{ width: 36, height: 20, backgroundColor: checked ? T.accent : T.border }}
    >
      <span
        className="absolute top-0.5 rounded-full bg-white transition-all"
        style={{ width: 16, height: 16, left: checked ? 18 : 2 }}
      />
    </button>
  );
}

/* ── Indicators ──────────────────────────────────────────────────────────── */

export function StatusPill({ status, tone }: { status: Status; tone?: "good" | "warn" | "bad" | "pending" }) {
  const T = useTheme();
  const meta = STATUS_META[status];
  const color = T[tone ?? meta.tone];
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className="flex items-center gap-1 px-2 py-0.5 rounded-full shrink-0"
      style={{
        backgroundColor: withAlpha(color, 0.12),
        color,
        fontSize: 9,
        fontFamily: MONO,
        fontWeight: 600,
        letterSpacing: "0.06em",
      }}
    >
      <Icon size={8} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

export function SummaryBadge({
  count,
  tone,
  label,
  compact = false,
}: {
  count: number;
  tone: "good" | "warn" | "bad" | "pending";
  label: string;
  compact?: boolean;
}) {
  const T = useTheme();
  const color = T[tone];
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg shrink-0" style={{ backgroundColor: withAlpha(color, 0.1) }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-semibold text-xs" style={{ color, fontFamily: MONO }}>
        {count}
      </span>
      {!compact && <span style={{ color: withAlpha(color, 0.65), fontSize: 10 }}>{label}</span>}
    </div>
  );
}
