from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    nebius_endpoint_url: str = "http://<serverless-endpoint-ip>/v1/chat/completions"
    nebius_endpoint_token: str = ""
    nebius_model: str = "Qwen/Qwen2.5-7B-Instruct"
    tavily_api_key: str = ""
    reports_dir: Path = Path("reports")
    llm_timeout_seconds: int = 120
    tavily_timeout_seconds: int = 30
    max_gap_iterations: int = 1
    max_results_per_query: int = 3
    max_follow_up_queries: int = 2

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
