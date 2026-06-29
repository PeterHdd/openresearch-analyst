import type { ResearchRequest, ResearchRun } from "./types";

export const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

function normalize(base: string): string {
  return (base || DEFAULT_API_BASE).trim().replace(/\/$/, "");
}

export async function startResearch(
  base: string,
  body: ResearchRequest,
): Promise<ResearchRun> {
  const res = await fetch(`${normalize(base)}/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST /research failed (${res.status})`);
  return res.json();
}

export async function getRun(base: string, runId: string): Promise<ResearchRun> {
  const res = await fetch(`${normalize(base)}/research/${runId}`);
  if (!res.ok) throw new Error(`GET /research/${runId} failed (${res.status})`);
  return res.json();
}

export async function checkHealth(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalize(base)}/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The backend returns absolute server paths; reports are served from /reports/<file>. */
export function artifactUrl(base: string, path?: string | null): string {
  if (!path) return "";
  const fileName = String(path).split("/").pop() ?? "";
  return `${normalize(base)}/reports/${encodeURIComponent(fileName)}`;
}
