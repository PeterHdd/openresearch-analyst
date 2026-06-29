import type { RunStatus } from "@/lib/types";

type UIStatus = RunStatus | "idle" | "starting" | "error";

const STYLES: Record<
  string,
  { label: string; fg: string; bg: string; pulse?: boolean }
> = {
  idle: { label: "Idle", fg: "var(--text-muted)", bg: "var(--surface-sunken)" },
  starting: {
    label: "Starting",
    fg: "var(--accent)",
    bg: "var(--accent-soft)",
    pulse: true,
  },
  queued: {
    label: "Queued",
    fg: "var(--accent)",
    bg: "var(--accent-soft)",
    pulse: true,
  },
  running: {
    label: "Running",
    fg: "var(--accent)",
    bg: "var(--accent-soft)",
    pulse: true,
  },
  completed: { label: "Completed", fg: "var(--ok)", bg: "var(--ok-soft)" },
  failed: { label: "Failed", fg: "var(--danger)", bg: "var(--danger-soft)" },
  error: { label: "Error", fg: "var(--danger)", bg: "var(--danger-soft)" },
};

export default function StatusPill({ status }: { status: UIStatus }) {
  const s = STYLES[status] ?? STYLES.idle;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: s.fg, background: s.bg }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${s.pulse ? "animate-pulse-dot" : ""}`}
        style={{ background: s.fg }}
      />
      {s.label}
    </span>
  );
}
