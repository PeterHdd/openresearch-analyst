"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  FileText,
  GitBranch,
  Link2,
  Loader2,
  Play,
  RotateCcw,
  ScanSearch,
  Scale,
  Search,
  Sparkles,
  Telescope,
  UsersRound,
} from "lucide-react";
import {
  DEFAULT_API_BASE,
  artifactUrl,
  getRun,
  startResearch,
} from "@/lib/api";
import type { ResearchRun } from "@/lib/types";
import StatusPill from "@/components/StatusPill";
import ReportView from "@/components/ReportView";
import ThemeToggle from "@/components/ThemeToggle";

type UIStatus =
  | "idle"
  | "starting"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "error";

const ACTIVE: UIStatus[] = ["starting", "queued", "running"];

const STEP_META = {
  queued: { icon: Loader2, label: "Queued" },
  running: { icon: Loader2, label: "Started" },
  planner: { icon: Telescope, label: "Planner" },
  tavily_search: { icon: Search, label: "Tavily search" },
  follow_up_search: { icon: Search, label: "Follow-up search" },
  source_dedupe: { icon: Link2, label: "Source cleanup" },
  gap_detector: { icon: ScanSearch, label: "Gap detector" },
  bull_agent: { icon: Scale, label: "Bull case" },
  bear_agent: { icon: AlertCircle, label: "Bear case" },
  investment_committee: { icon: UsersRound, label: "Committee" },
  output_writer: { icon: FileText, label: "Output writer" },
  completed: { icon: FileText, label: "Completed" },
  failed: { icon: AlertCircle, label: "Failed" },
} as const;

function stepMeta(step?: string) {
  return STEP_META[step as keyof typeof STEP_META] ?? { icon: GitBranch, label: step || "Waiting" };
}

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function fmtTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function Page() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [company, setCompany] = useState("Microsoft");
  const [ticker, setTicker] = useState("MSFT");
  const [goal, setGoal] = useState("Generate an investment research report");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [status, setStatus] = useState<UIStatus>("idle");
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [reportMd, setReportMd] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);

  const isActive = ACTIVE.includes(status);
  const hasRun = status !== "idle";

  const stopTimers = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => () => stopTimers(), [stopTimers]);

  const loadReport = useCallback(
    async (path?: string | null) => {
      const url = artifactUrl(apiBase, path);
      if (!url) return;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not load report (${res.status})`);
      setReportMd(await res.text());
    },
    [apiBase],
  );

  const poll = useCallback(
    async (runId: string) => {
      try {
        const data = await getRun(apiBase, runId);
        setRun(data);
        if (data.status === "completed") {
          stopTimers();
          setStatus("completed");
          await loadReport(data.artifacts?.report_path);
        } else if (data.status === "failed") {
          stopTimers();
          setStatus("failed");
          setMessage(data.error || "Run failed.");
        } else {
          setStatus(data.status as UIStatus);
        }
      } catch (err) {
        stopTimers();
        setStatus("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [apiBase, loadReport, stopTimers],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      stopTimers();
      setStatus("starting");
      setMessage(null);
      setReportMd("");
      setRun(null);
      setElapsed(0);

      startRef.current = Date.now();
      timerRef.current = setInterval(
        () => setElapsed(Date.now() - startRef.current),
        1000,
      );

      try {
        const created = await startResearch(apiBase, {
          company: company.trim(),
          ticker: ticker.trim(),
          goal: goal.trim(),
        });
        setRun(created);
        setStatus("queued");
        pollRef.current = setInterval(() => poll(created.run_id), 2500);
        await poll(created.run_id);
      } catch (err) {
        stopTimers();
        setStatus("error");
        setMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [apiBase, company, ticker, goal, poll, stopTimers],
  );

  const handleReset = useCallback(() => {
    stopTimers();
    setStatus("idle");
    setRun(null);
    setReportMd("");
    setMessage(null);
    setElapsed(0);
    setCompany("Microsoft");
    setTicker("MSFT");
    setGoal("Generate an investment research report");
  }, [stopTimers]);

  const artifacts = run?.artifacts;
  const artifactItems = artifacts
    ? ([
        ["Report", artifacts.report_path, FileText],
        ["Sources", artifacts.sources_path, Link2],
        ["Trace", artifacts.trace_path, GitBranch],
      ] as const)
    : [];

  const displayCompany = run?.request.company || company;
  const displayTicker = run?.request.ticker || ticker;
  const progressEvents = run?.progress_events ?? [];
  const currentProgress = stepMeta(run?.progress_step || status);
  const CurrentProgressIcon = currentProgress.icon;

  return (
    <div className="flex min-h-screen flex-col">
      {/* ---- Top bar -------------------------------------------------- */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm">
              <Sparkles className="h-[18px] w-[18px]" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">
              OpenResearch
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1240px] flex-1 gap-7 px-5 py-7 sm:px-8 lg:grid-cols-[372px_minmax(0,1fr)]">
        {/* ---- Control panel ----------------------------------------- */}
        <aside className="lg:sticky lg:top-[72px] lg:self-start">
          <form
            onSubmit={handleSubmit}
            className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-md)]"
          >
            <h1 className="text-[15px] font-semibold tracking-tight">
              New analysis
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
              Agents gather evidence and draft a cited research report.
            </p>

            <div className="mt-5 space-y-3.5">
              <div className="grid grid-cols-[1fr_120px] gap-2.5">
                <Field label="Company">
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    autoComplete="organization"
                    className={inputCls}
                  />
                </Field>
                <Field label="Ticker">
                  <input
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    required
                    className={`${inputCls} font-mono uppercase`}
                  />
                </Field>
              </div>
              <Field label="Goal">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  required
                  rows={3}
                  className={`${inputCls} resize-y leading-relaxed`}
                />
              </Field>

              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)] transition hover:text-[var(--text)]"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                  />
                  Advanced
                </button>
                {showAdvanced && (
                  <div className="mt-3 animate-rise">
                    <Field label="API base URL">
                      <input
                        value={apiBase}
                        onChange={(e) => setApiBase(e.target.value)}
                        placeholder={DEFAULT_API_BASE}
                        className={`${inputCls} font-mono text-[13px]`}
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2">
              <button
                type="submit"
                disabled={isActive}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2.5 text-[14px] font-semibold text-[var(--accent-contrast)] shadow-sm transition hover:bg-[var(--accent-hover)] disabled:opacity-55"
              >
                {isActive ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin-slow" />
                    Working…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Start research
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset"
                className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {isActive && (
              <div className="mt-4 animate-rise">
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--accent-soft)]">
                  <div className="h-full w-2/5 rounded-full bg-[var(--accent)] animate-indeterminate" />
                </div>
                <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                  Elapsed <span className="tnum">{fmtElapsed(elapsed)}</span> ·
                  polling every 2.5s
                </p>
              </div>
            )}
          </form>

          <div className="mt-3.5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold tracking-tight">Live progress</h3>
              <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-1 font-mono text-[11px] text-[var(--text-faint)]">
                {progressEvents.length} events
              </span>
            </div>

            <div className="mt-3.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-sunken)] p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-[32px] w-[32px] flex-none place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <CurrentProgressIcon
                    className={`h-[16px] w-[16px] ${isActive ? "animate-pulse" : ""}`}
                  />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-tight">
                    {currentProgress.label}
                  </div>
                  <div className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">
                    {run?.progress_message || "Start a run to see live agent progress."}
                  </div>
                </div>
              </div>
            </div>

            <ol className="scroll-thin mt-3.5 max-h-[300px] space-y-2 overflow-auto">
              {progressEvents.length > 0 ? (
                progressEvents
                  .slice()
                  .reverse()
                  .map((event, index) => {
                    const meta = stepMeta(event.step);
                    const Icon = meta.icon;
                    return (
                      <li
                        key={`${event.timestamp}-${event.step}-${index}`}
                        className="flex items-start gap-2.5 rounded-[var(--radius-sm)] px-1 py-1.5"
                      >
                        <span className="mt-0.5 grid h-[24px] w-[24px] flex-none place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]">
                          <Icon className="h-[12px] w-[12px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[12px] font-medium">
                              {meta.label}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-faint)]">
                              {fmtTime(event.timestamp)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12px] leading-snug text-[var(--text-faint)]">
                            {event.message}
                          </div>
                        </div>
                      </li>
                    );
                  })
              ) : (
                <li className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-3 text-[12px] leading-relaxed text-[var(--text-faint)]">
                  Progress events will appear here as the backend moves through planning,
                  search, gap detection, debate, and report writing.
                </li>
              )}
            </ol>
          </div>

          <p className="mt-3 px-1 text-[12px] leading-relaxed text-[var(--text-faint)]">
            Educational research only. Not financial advice.
          </p>
        </aside>

        {/* ---- Workspace --------------------------------------------- */}
        <section className="min-w-0">
          {/* document header */}
          {hasRun && (
            <div className="mb-4 animate-rise">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="truncate text-[22px] font-semibold tracking-tight">
                      {displayCompany || "Untitled"}
                    </h2>
                    <span className="rounded-md bg-[var(--surface-sunken)] px-2 py-0.5 font-mono text-[12px] font-semibold text-[var(--text-muted)]">
                      {displayTicker || "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--text-muted)]">
                    <StatusPill status={status} />
                    <span className="tnum">{fmtElapsed(elapsed)}</span>
                    {run?.run_id && (
                      <>
                        <span className="text-[var(--text-faint)]">·</span>
                        <span className="font-mono text-[var(--text-faint)]">
                          {run.run_id}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {artifactItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {artifactItems.map(([label, path, Icon]) => (
                      <a
                        key={label}
                        href={artifactUrl(apiBase, path)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* report surface */}
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]">
            <div className="scroll-thin max-h-[calc(100vh-150px)] min-h-[420px] overflow-auto px-6 py-7 sm:px-10 sm:py-9">
              {message && status !== "completed" ? (
                <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--danger-soft)] px-4 py-3.5 text-[14px]">
                  <AlertCircle
                    className="mt-0.5 h-[18px] w-[18px] flex-none"
                    style={{ color: "var(--danger)" }}
                  />
                  <div>
                    <p className="font-semibold" style={{ color: "var(--danger)" }}>
                      Something went wrong
                    </p>
                    <p className="mt-0.5 text-[var(--text-muted)]">{message}</p>
                  </div>
                </div>
              ) : reportMd ? (
                <div className="animate-rise">
                  <ReportView markdown={reportMd} />
                </div>
              ) : isActive ? (
                <Placeholder
                  spinning
                  title="Researching…"
                  body="Agents are searching sources, detecting gaps, and drafting the report. This usually takes a few minutes."
                />
              ) : (
                <Placeholder
                  title="Nothing here yet"
                  body="Start an analysis from the panel and the cited markdown report will appear here."
                />
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--text)] outline-none transition placeholder:text-[var(--text-faint)] hover:border-[var(--border-strong)] focus:border-[var(--accent)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Placeholder({
  title,
  body,
  spinning,
}: {
  title: string;
  body: string;
  spinning?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3.5 py-20 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] text-[var(--accent)]">
        {spinning ? (
          <Loader2 className="h-5 w-5 animate-spin-slow" />
        ) : (
          <FileText className="h-5 w-5 text-[var(--text-faint)]" />
        )}
      </div>
      <div className="text-[15px] font-semibold text-[var(--text)]">{title}</div>
      <p className="max-w-sm text-[14px] leading-relaxed text-[var(--text-muted)]">
        {body}
      </p>
    </div>
  );
}
