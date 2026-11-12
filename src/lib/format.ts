const pad = (n: number) => String(n).padStart(2, "0");

export const fmtTime = (ts: number): string =>
  new Date(ts).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const fmtDateTime = (ts: number): string =>
  new Date(ts).toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export const fmtDur = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

/** `datetime-local` input value in local time (YYYY-MM-DDTHH:mm). */
export const fmtDateInput = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Compact timestamp for file names. */
export const fmtFileStamp = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};
