from __future__ import annotations

import json

from backend.app.schemas.research import ResearchRequest
from backend.app.services.llm_service import LLMService


DEFAULT_QUESTIONS = [
    "What does the company do?",
    "What are the main revenue drivers?",
    "What are the recent news catalysts?",
    "Who are the competitors?",
    "What is the bull case?",
    "What is the bear case?",
    "What risks should investors watch?",
    "What metrics matter going forward?",
]


def create_research_plan(request: ResearchRequest, llm: LLMService) -> list[str]:
    system = (
        "You are a careful investment research planning agent. Return only JSON "
        "with a 'questions' array. Do not make financial recommendations."
    )
    user = (
        f"Create an evidence-first research plan for {request.company} "
        f"({request.ticker}). Goal: {request.goal}. Include core business, "
        "financial drivers, catalysts, competitors, bull case, bear case, risks, "
        "and metrics."
    )
    try:
        raw = llm.generate(system, user)
        parsed = json.loads(raw)
        questions = [str(q).strip() for q in parsed.get("questions", []) if str(q).strip()]
        return questions or DEFAULT_QUESTIONS
    except Exception:
        return DEFAULT_QUESTIONS
