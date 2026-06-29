from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class ResearchRequest(BaseModel):
    company: str
    ticker: str
    goal: str = "Generate an investment research report"


class Source(BaseModel):
    title: str = ""
    url: str = ""
    content: str = ""
    published_date: Optional[str] = None
    query_used: str = ""


class TraceEvent(BaseModel):
    step: str
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    input: Optional[Any] = None
    output: Optional[Any] = None
    query: Optional[str] = None
    sources_found: Optional[int] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ResearchArtifacts(BaseModel):
    report_path: Path
    sources_path: Path
    trace_path: Path


class ProgressEvent(BaseModel):
    step: str
    message: str
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class ResearchRun(BaseModel):
    run_id: str = Field(default_factory=lambda: uuid4().hex)
    status: RunStatus = RunStatus.queued
    request: ResearchRequest
    artifacts: Optional[ResearchArtifacts] = None
    error: Optional[str] = None
    progress_step: str = "queued"
    progress_message: str = "Queued"
    progress_events: list[ProgressEvent] = Field(default_factory=list)
