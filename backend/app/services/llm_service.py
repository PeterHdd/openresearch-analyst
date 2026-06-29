from __future__ import annotations

import json
import re
from typing import Any

import requests

from backend.app.config import Settings, get_settings


class LLMService:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        if not self.settings.nebius_endpoint_url:
            raise RuntimeError("NEBIUS_ENDPOINT_URL is required for LLM generation.")

        payload: dict[str, Any] = {
            "model": self.settings.nebius_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        }
        headers = {"Content-Type": "application/json"}
        if self.settings.nebius_endpoint_token:
            headers["Authorization"] = f"Bearer {self.settings.nebius_endpoint_token}"

        response = requests.post(
            self.settings.nebius_endpoint_url,
            headers=headers,
            data=json.dumps(payload),
            timeout=self.settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        return self._strip_reasoning(data["choices"][0]["message"]["content"])

    @staticmethod
    def _strip_reasoning(content: str) -> str:
        cleaned = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL | re.IGNORECASE)
        cleaned = re.sub(r"^\s*</?think>\s*", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip()
