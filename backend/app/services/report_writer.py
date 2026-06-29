from __future__ import annotations

import json
from pathlib import Path

from backend.app.config import Settings, get_settings
from backend.app.schemas.research import ResearchArtifacts, Source, TraceEvent


class ReportWriter:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def write(
        self,
        ticker: str,
        report_markdown: str,
        sources: list[Source],
        trace: list[TraceEvent],
    ) -> ResearchArtifacts:
        self.settings.reports_dir.mkdir(parents=True, exist_ok=True)
        safe_ticker = ticker.upper().replace("/", "_").replace(" ", "_")
        report_path = self.settings.reports_dir / f"{safe_ticker}_research_report.md"
        sources_path = self.settings.reports_dir / f"{safe_ticker}_sources.json"
        trace_path = self.settings.reports_dir / f"{safe_ticker}_trace.json"

        report_path.write_text(report_markdown, encoding="utf-8")
        sources_path.write_text(
            json.dumps([source.model_dump() for source in sources], indent=2),
            encoding="utf-8",
        )
        trace_path.write_text(
            json.dumps([event.model_dump() for event in trace], indent=2, default=str),
            encoding="utf-8",
        )
        return ResearchArtifacts(
            report_path=report_path,
            sources_path=sources_path,
            trace_path=trace_path,
        )
