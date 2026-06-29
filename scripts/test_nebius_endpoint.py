from __future__ import annotations

from backend.app.services.llm_service import LLMService


def main() -> None:
    response = LLMService().generate(
        system_prompt="You are a terse health-check assistant.",
        user_prompt="Reply with exactly: nebius-serverless-endpoint-ok",
    )
    print(response)


if __name__ == "__main__":
    main()
