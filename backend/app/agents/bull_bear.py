from __future__ import annotations

from backend.app.schemas.research import ResearchRequest, Source
from backend.app.services.llm_service import LLMService


def _source_context(sources: list[Source]) -> str:
    return "\n".join(
        f"[{index}] {source.title} | {source.url} | {source.content[:600]}"
        for index, source in enumerate(sources, start=1)
    )


def create_bull_case(request: ResearchRequest, sources: list[Source], llm: LLMService) -> str:
    system = (
        "You are the bull-case analyst. Use only supplied sources. Cite claims "
        "with bracketed source numbers. State uncertainty where evidence is thin."
    )
    user = (
        f"Build the strongest evidence-backed positive thesis for "
        f"{request.company} ({request.ticker}).\n\nSources:\n{_source_context(sources)}"
    )
    return llm.generate(system, user)


def create_bear_case(request: ResearchRequest, sources: list[Source], llm: LLMService) -> str:
    system = (
        "You are the bear-case analyst. Use only supplied sources. Cite claims "
        "with bracketed source numbers. State uncertainty where evidence is thin."
    )
    user = (
        f"Build the strongest evidence-backed negative thesis for "
        f"{request.company} ({request.ticker}).\n\nSources:\n{_source_context(sources)}"
    )
    return llm.generate(system, user)
