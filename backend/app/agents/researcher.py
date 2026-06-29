from __future__ import annotations

from backend.app.schemas.research import Source
from backend.app.services.tavily_service import TavilyService


def research_questions(
    company: str,
    ticker: str,
    questions: list[str],
    tavily: TavilyService,
    max_results: int,
) -> list[Source]:
    sources: list[Source] = []
    seen_urls: set[str] = set()
    for question in questions:
        query = f"{company} {ticker} {question}"
        for source in tavily.search(query, max_results=max_results):
            normalized_url = source.url.rstrip("/")
            if normalized_url and normalized_url not in seen_urls:
                seen_urls.add(normalized_url)
                sources.append(source)
    return sources
