import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { ThemeMode } from "../types";

export interface ThemeTokens {
  mode: ThemeMode;
  bg: string;
  headerBg: string;
  panel: string;
  panelAlt: string;
  panelHover: string;
  border: string;
  borderSubtle: string;
  text: string;
  textDim: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentText: string;
  good: string;
  warn: string;
  bad: string;
  pending: string;
  overlay: string;
  shadow: string;
}

const DARK: ThemeTokens = {
  mode: "dark",
  bg: "#080c14",
  headerBg: "#0a0e18",
  panel: "#0d1424",
  panelAlt: "#080c14",
  panelHover: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.08)",
  borderSubtle: "rgba(255,255,255,0.05)",
  text: "#ffffff",
  textDim: "#94a3b8",
  textMuted: "#64748b",
  textFaint: "#3d4d63",
  accent: "#00d4aa",
  accentText: "#080c14",
  good: "#00d4aa",
  warn: "#f59e0b",
  bad: "#ef4444",
  pending: "#64748b",
  overlay: "rgba(0,0,0,0.75)",
  shadow: "rgba(0,0,0,0.55)",
};

const LIGHT: ThemeTokens = {
  mode: "light",
  bg: "#eef2f7",
  headerBg: "#ffffff",
  panel: "#ffffff",
  panelAlt: "#f4f7fb",
  panelHover: "rgba(15,23,42,0.04)",
  border: "rgba(15,23,42,0.12)",
  borderSubtle: "rgba(15,23,42,0.07)",
  text: "#0f172a",
  textDim: "#3f4d63",
  textMuted: "#5b6b81",
  textFaint: "#8a99ad",
  accent: "#0d9488",
  accentText: "#ffffff",
  good: "#059669",
  warn: "#c2760b",
  bad: "#dc2626",
  pending: "#64748b",
  overlay: "rgba(15,23,42,0.45)",
  shadow: "rgba(15,23,42,0.16)",
};

export const THEMES: Record<ThemeMode, ThemeTokens> = { dark: DARK, light: LIGHT };

const ThemeContext = createContext<ThemeTokens>(DARK);

export function ThemeProvider({ mode, children }: { mode: ThemeMode; children: ReactNode }) {
  const value = useMemo(() => THEMES[mode] ?? DARK, [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** 8-digit hex with alpha, used for tinted status backgrounds. */
export const withAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
};
