export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface ResearchRequest {
  company: string;
  ticker: string;
  goal: string;
}

export interface ResearchArtifacts {
  report_path: string;
  sources_path: string;
  trace_path: string;
}

export interface ProgressEvent {
  step: string;
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ResearchRun {
  run_id: string;
  status: RunStatus;
  request: ResearchRequest;
  artifacts: ResearchArtifacts | null;
  error: string | null;
  progress_step: string;
  progress_message: string;
  progress_events: ProgressEvent[];
}
