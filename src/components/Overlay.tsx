import { useEffect, type ReactNode } from "react";
import { useTheme } from "../lib/theme";

export function Overlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const T = useTheme();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: T.overlay, backdropFilter: "blur(6px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
