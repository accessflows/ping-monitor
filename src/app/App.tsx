import { Signal } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Toaster } from "sonner";
import { AddDeviceModal } from "../components/AddDeviceModal";
import { DetailModal } from "../components/DetailModal";
import { DeviceCard } from "../components/DeviceCard";
import { Header } from "../components/Header";
import { SettingsModal } from "../components/SettingsModal";
import { PrimaryButton } from "../components/ui-bits";
import { useMonitor, type MonitorApi } from "../hooks/useMonitor";
import { ThemeProvider, useTheme, withAlpha } from "../lib/theme";
import type { ModalType } from "../types";

// PDF generation (jsPDF) is heavy, so it is only fetched when exporting.
const ExportModal = lazy(() => import("../components/ExportModal").then((module) => ({ default: module.ExportModal })));

export default function App() {
  const monitor = useMonitor();
  const theme = monitor.settings.theme;

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <ThemeProvider mode={theme}>
      <Toaster theme={theme} position="top-right" closeButton richColors />
      <Dashboard monitor={monitor} />
    </ThemeProvider>
  );
}

function Dashboard({ monitor }: { monitor: MonitorApi }) {
  const T = useTheme();
  const [modal, setModal] = useState<ModalType>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const detailDevice = useMemo(
    () => monitor.devices.find((device) => device.id === detailId) ?? null,
    [monitor.devices, detailId]
  );
  const existingHosts = useMemo(() => monitor.devices.map((device) => device.host), [monitor.devices]);

  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    setModal("detail");
  }, []);

  const closeDetail = useCallback(() => {
    setModal(null);
    setDetailId(null);
  }, []);

  const cssVars = {
    backgroundColor: T.bg,
    color: T.text,
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    "--pm-hover-bg": T.panelHover,
    "--pm-danger-bg": withAlpha(T.bad, 0.12),
    "--pm-danger-fg": T.bad,
    "--pm-scroll-thumb": withAlpha(T.textDim, 0.35),
    "--pm-range-track": withAlpha(T.textDim, 0.25),
  } as CSSProperties;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={cssVars}>
      <Header
        stats={monitor.stats}
        simulation={monitor.simulation}
        onAdd={() => setModal("add")}
        onSettings={() => setModal("settings")}
        onExport={() => setModal("export")}
      />

      <main className="pm-scroll flex-1 overflow-y-auto p-6">
        {!monitor.ready ? (
          <SkeletonGrid />
        ) : monitor.devices.length === 0 ? (
          <EmptyState onAdd={() => setModal("add")} />
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {monitor.devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                settings={monitor.settings}
                onDetail={() => openDetail(device.id)}
                onRemove={() => void monitor.removeDevice(device.id)}
              />
            ))}
          </div>
        )}
      </main>

      {modal === "add" && (
        <AddDeviceModal existingHosts={existingHosts} onAdd={monitor.addDevice} onClose={() => setModal(null)} />
      )}
      {modal === "settings" && (
        <SettingsModal
          settings={monitor.settings}
          onSave={monitor.updateSettings}
          onClearHistory={monitor.clearHistory}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "detail" && detailDevice && (
        <DetailModal device={detailDevice} settings={monitor.settings} onClose={closeDetail} />
      )}
      {modal === "export" && (
        <Suspense fallback={null}>
          <ExportModal devices={monitor.devices} settings={monitor.settings} onClose={() => setModal(null)} />
        </Suspense>
      )}
    </div>
  );
}

function SkeletonGrid() {
  const T = useTheme();
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border"
          style={{ height: 172, backgroundColor: T.panel, borderColor: T.borderSubtle, opacity: 0.7 }}
        />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const T = useTheme();
  return (
    <div className="h-full flex items-center justify-center flex-col gap-3">
      <Signal size={48} strokeWidth={1} style={{ color: T.border }} />
      <p className="text-sm" style={{ color: T.textMuted }}>
        No devices monitored yet
      </p>
      <PrimaryButton onClick={onAdd} className="mt-1 px-5 py-2.5">
        Add your first device
      </PrimaryButton>
    </div>
  );
}
