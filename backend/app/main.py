from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.config import get_settings
from backend.app.jobs.research_job import run_research
from backend.app.schemas.research import ProgressEvent, ResearchRequest, ResearchRun, RunStatus

app = FastAPI(title="OpenResearch Analyst", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
executor = ThreadPoolExecutor(max_workers=2)
runs: dict[str, ResearchRun] = {}
futures: dict[str, Future] = {}
lock = Lock()
settings = get_settings()
settings.reports_dir.mkdir(parents=True, exist_ok=True)
app.mount("/reports", StaticFiles(directory=settings.reports_dir), name="reports")


def _execute_run(run_id: str) -> None:
    def publish_progress(step: str, message: str, metadata: dict) -> None:
        with lock:
            run = runs[run_id]
            run.progress_step = step
            run.progress_message = message
            run.progress_events.append(
                ProgressEvent(step=step, message=message, metadata=metadata)
            )
            run.progress_events = run.progress_events[-30:]

    with lock:
        runs[run_id].status = RunStatus.running
        runs[run_id].progress_step = "running"
        runs[run_id].progress_message = "Research run started"
        runs[run_id].progress_events.append(
            ProgressEvent(step="running", message="Research run started")
        )
    try:
        artifacts = run_research(runs[run_id].request, progress_callback=publish_progress)
        with lock:
            runs[run_id].status = RunStatus.completed
            runs[run_id].artifacts = artifacts
            runs[run_id].progress_step = "completed"
            runs[run_id].progress_message = "Research run completed"
            runs[run_id].progress_events.append(
                ProgressEvent(step="completed", message="Research run completed")
            )
    except Exception as exc:
        with lock:
            runs[run_id].status = RunStatus.failed
            runs[run_id].error = str(exc)
            runs[run_id].progress_step = "failed"
            runs[run_id].progress_message = str(exc)
            runs[run_id].progress_events.append(
                ProgressEvent(step="failed", message=str(exc))
            )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "OK"}


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": "OpenResearch Analyst API",
        "status": "OK",
        "frontend": "Run the Next.js app from ./frontend and open http://localhost:3000",
        "endpoints": ["/health", "/research", "/research/{run_id}", "/reports/{file}"],
    }


@app.post("/research")
def start_research(request: ResearchRequest) -> ResearchRun:
    run = ResearchRun(request=request)
    with lock:
        runs[run.run_id] = run
        futures[run.run_id] = executor.submit(_execute_run, run.run_id)
    return run


@app.get("/research/{run_id}")
def get_research(run_id: str) -> ResearchRun:
    with lock:
        run = runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Research run not found")
    return run
