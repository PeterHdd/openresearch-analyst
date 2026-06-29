from __future__ import annotations

import requests

from backend.app.config import Settings, get_settings
from backend.app.schemas.research import Source


class TavilyService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def search(self, query: str, max_results: int = 5) -> list[Source]:
        if not self.settings.tavily_api_key:
            raise RuntimeError("TAVILY_API_KEY is required for web research.")

        response = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": self.settings.tavily_api_key,
                "query": query,
                "search_depth": "advanced",
                "include_answer": False,
                "include_raw_content": False,
                "max_results": max_results,
            },
            timeout=self.settings.tavily_timeout_seconds,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        return [
            Source(
                title=item.get("title") or "",
                url=item.get("url") or "",
                content=item.get("content") or item.get("snippet") or "",
                published_date=item.get("published_date"),
                query_used=query,
            )
            for item in results
        ]
