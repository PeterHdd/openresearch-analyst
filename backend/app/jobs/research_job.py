from __future__ import annotations

import argparse
from pathlib import Path
from typing import Callable

from backend.app.agents.bull_bear import create_bear_case, create_bull_case
from backend.app.agents.committee import synthesize_report
from backend.app.agents.gap_detector import detect_gaps
from backend.app.agents.planner import create_research_plan
from backend.app.config import Settings, get_settings
from backend.app.schemas.research import ResearchArtifacts, ResearchRequest, Source, TraceEvent
from backend.app.services.llm_service import LLMService
from backend.app.services.report_writer import ReportWriter
from backend.app.services.tavily_service import TavilyService

ProgressCallback = Callable[[str, str, dict], None]


def _dedupe_sources(sources: list[Source]) -> list[Source]:
    deduped: list[Source] = []
    seen: set[str] = set()
    for source in sources:
        key = source.url.rstrip("/") or f"{source.title}:{source.content[:80]}"
        if key not in seen:
            seen.add(key)
            deduped.append(source)
    return deduped


def run_research(
    request: ResearchRequest,
    settings: Settings | None = None,
    progress_callback: ProgressCallback | None = None,
) -> ResearchArtifacts:
    settings = settings or get_settings()
    llm = LLMService(settings)
    tavily = TavilyService(settings)
    writer = ReportWriter(settings)
    trace: list[TraceEvent] = []

    def progress(step: str, message: str, metadata: dict | None = None) -> None:
        if progress_callback:
            progress_callback(step, message, metadata or {})

    progress("planner", "Creating research plan")
    questions = create_research_plan(request, llm)
    trace.append(
        TraceEvent(step="planner", input=request.model_dump(), output={"questions": questions})
    )
    progress(
        "planner",
        f"Created {len(questions)} research questions",
        {"question_count": len(questions)},
    )

    sources: list[Source] = []
    for index, question in enumerate(questions, start=1):
        query = f"{request.company} {request.ticker} {question}"
        progress(
            "tavily_search",
            f"Searching Tavily {index}/{len(questions)}",
            {"query": query},
        )
        found = tavily.search(query, max_results=settings.max_results_per_query)
        sources.extend(found)
        trace.append(
            TraceEvent(
                step="tavily_search",
                query=query,
                sources_found=len(found),
                output=[source.model_dump() for source in found],
            )
        )
        progress(
            "tavily_search",
            f"Found {len(found)} sources",
            {"query": query, "sources_found": len(found)},
        )
    sources = _dedupe_sources(sources)
    progress("source_dedupe", f"Deduplicated to {len(sources)} sources", {"source_count": len(sources)})

    for iteration in range(settings.max_gap_iterations):
        progress(
            "gap_detector",
            f"Checking research gaps, pass {iteration + 1}/{settings.max_gap_iterations}",
            {"iteration": iteration + 1, "source_count": len(sources)},
        )
        follow_ups = detect_gaps(
            request,
            sources,
            llm,
            max_queries=settings.max_follow_up_queries,
        )
        trace.append(
            TraceEvent(
                step="gap_detector",
                input={"iteration": iteration + 1, "source_count": len(sources)},
                output={"follow_up_queries": follow_ups},
            )
        )
        if not follow_ups:
            progress("gap_detector", "No material follow-up gaps found", {"iteration": iteration + 1})
            break
        progress(
            "gap_detector",
            f"Generated {len(follow_ups)} follow-up searches",
            {"iteration": iteration + 1, "follow_up_count": len(follow_ups)},
        )
        for query_index, query in enumerate(follow_ups, start=1):
            progress(
                "follow_up_search",
                f"Running follow-up search {query_index}/{len(follow_ups)}",
                {"query": query},
            )
            found = tavily.search(query, max_results=settings.max_results_per_query)
            sources.extend(found)
            trace.append(
                TraceEvent(
                    step="tavily_search",
                    query=query,
                    sources_found=len(found),
                    output=[source.model_dump() for source in found],
                )
            )
            progress(
                "follow_up_search",
                f"Found {len(found)} follow-up sources",
                {"query": query, "sources_found": len(found)},
            )
        sources = _dedupe_sources(sources)
        progress("source_dedupe", f"Deduplicated to {len(sources)} sources", {"source_count": len(sources)})

    progress("bull_agent", "Drafting bull case", {"source_count": len(sources)})
    bull_case = create_bull_case(request, sources, llm)
    trace.append(TraceEvent(step="bull_agent", input={"source_count": len(sources)}, output=bull_case))
    progress("bull_agent", "Bull case complete")

    progress("bear_agent", "Drafting bear case", {"source_count": len(sources)})
    bear_case = create_bear_case(request, sources, llm)
    trace.append(TraceEvent(step="bear_agent", input={"source_count": len(sources)}, output=bear_case))
    progress("bear_agent", "Bear case complete")

    progress("investment_committee", "Synthesizing final report", {"source_count": len(sources)})
    report = synthesize_report(request, sources, bull_case, bear_case, llm)
    trace.append(
        TraceEvent(
            step="investment_committee",
            input={"bull_case": bull_case, "bear_case": bear_case},
            output=report,
        )
    )
    progress("investment_committee", "Final report drafted")

    progress("output_writer", "Writing report, sources, and trace files")
    artifacts = writer.write(request.ticker, report, sources, trace)
    trace.append(TraceEvent(step="output_writer", output=artifacts.model_dump()))
    writer.write(request.ticker, report, sources, trace)
    progress(
        "output_writer",
        "Artifacts written",
        {
            "report_path": str(artifacts.report_path),
            "sources_path": str(artifacts.sources_path),
            "trace_path": str(artifacts.trace_path),
        },
    )
    return artifacts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run an OpenResearch Analyst job.")
    parser.add_argument("--company", required=True)
    parser.add_argument("--ticker", required=True)
    parser.add_argument("--goal", default="Generate an investment research report")
    parser.add_argument("--reports-dir", type=Path, default=None)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = get_settings()
    if args.reports_dir:
        settings.reports_dir = args.reports_dir
    artifacts = run_research(
        ResearchRequest(company=args.company, ticker=args.ticker, goal=args.goal),
        settings=settings,
    )
    print(f"Report: {artifacts.report_path}")
    print(f"Sources: {artifacts.sources_path}")
    print(f"Trace: {artifacts.trace_path}")


if __name__ == "__main__":
    main()
