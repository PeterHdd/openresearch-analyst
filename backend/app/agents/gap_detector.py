from __future__ import annotations

import json

from backend.app.schemas.research import ResearchRequest, Source
from backend.app.services.llm_service import LLMService


def detect_gaps(
    request: ResearchRequest,
    sources: list[Source],
    llm: LLMService,
    max_queries: int = 5,
) -> list[str]:
    source_notes = "\n".join(
        f"- {source.title}: {source.content[:300]} ({source.url})"
        for source in sources[:30]
    )
    system = (
        "You are a research gap detector. Return only JSON with a "
        "'follow_up_queries' array. Ask only for missing, decision-relevant facts. "
        "Do not exceed the requested number of queries."
    )
    user = (
        f"Company: {request.company} ({request.ticker})\nGoal: {request.goal}\n"
        f"Current sources:\n{source_notes}\n\n"
        "Find gaps such as earnings transcript, competitor comparison, margins, "
        "valuation concerns, customer concentration, and recent material catalysts. "
        f"Return at most {max_queries} Tavily search queries."
    )
    try:
        raw = llm.generate(system, user)
        parsed = json.loads(raw)
        queries = parsed.get("follow_up_queries", [])
        return [str(query).strip() for query in queries if str(query).strip()][:max_queries]
    except Exception:
        return [
            f"{request.company} {request.ticker} latest earnings transcript",
            f"{request.company} {request.ticker} competitors margins valuation",
            f"{request.company} {request.ticker} customer concentration risks",
        ][:max_queries]
