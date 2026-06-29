# Nebius Serverless AI Usage

This project uses both Nebius Serverless AI product surfaces:

1. **Serverless AI Endpoint** for every LLM/agent call.
2. **Serverless AI Job** for the long-running async research workflow.

## Endpoint

`backend/app/services/llm_service.py` sends OpenAI-compatible chat completion
requests to `NEBIUS_ENDPOINT_URL`:

```python
response = requests.post(
    settings.nebius_endpoint_url,
    headers={"Authorization": f"Bearer {settings.nebius_endpoint_token}"},
    data=json.dumps({
        "model": settings.nebius_model,
        "messages": [...],
        "temperature": 0.2,
    }),
)
```

This URL should be a Nebius **AI Services → Endpoints** Serverless AI endpoint,
for example:

```text
http://<endpoint-public-ip>/v1/chat/completions
```

Create that endpoint with an OpenAI-compatible model server. The tested demo
configuration used:

```text
Image:
vllm/vllm-openai:v0.18.0-cu130

Port:
8000

Entrypoint command:
python3 -m vllm.entrypoints.openai.api_server --model Qwen/Qwen3-0.6B --host 0.0.0.0 --port 8000
```

Nebius docs show Serverless AI endpoints are containerized workloads and their
LLM tutorial uses vLLM to expose `/v1/chat/completions`.

If you enable endpoint token authentication, set:

```env
NEBIUS_ENDPOINT_TOKEN=<token from the endpoint auth setting>
```

If endpoint authentication is disabled for a prototype, leave
`NEBIUS_ENDPOINT_TOKEN` empty and the client will omit the `Authorization`
header.

All agents call this service:

- Planner Agent
- Gap Detector Agent
- Bull Agent
- Bear Agent
- Investment Committee Agent

Smoke-test the configured endpoint:

```bash
python scripts/test_nebius_endpoint.py
```

Expected smoke-test output is:

```text
nebius-serverless-endpoint-ok
```

## Job

The long-running research run is packaged as a container and run as a Nebius
Serverless AI Job. The job command is the same CLI used locally:

```bash
python -m backend.app.jobs.research_job \
  --company "Nebius" \
  --ticker "NBIS" \
  --goal "Generate an investment research report"
```

Create a Nebius job from a pushed container image:

```bash
scripts/nebius_create_research_job.sh \
  cr.ai.nebius.cloud/<registry>/openresearch-analyst:latest \
  Nebius \
  NBIS \
  "Generate an investment research report"
```

The job must receive these environment variables or secrets:

- `NEBIUS_ENDPOINT_URL`
- `NEBIUS_ENDPOINT_TOKEN` if endpoint auth is enabled
- `NEBIUS_MODEL`
- `TAVILY_API_KEY`
- `MAX_GAP_ITERATIONS`
- `MAX_RESULTS_PER_QUERY`
- `MAX_FOLLOW_UP_QUERIES`

For demo speed, use:

```env
MAX_GAP_ITERATIONS=1
MAX_RESULTS_PER_QUERY=3
MAX_FOLLOW_UP_QUERIES=2
```

Persist or export `/app/reports` to retain:

- `NBIS_research_report.md`
- `NBIS_sources.json`
- `NBIS_trace.json`

## Requirement Mapping

| Challenge requirement | Implementation |
| --- | --- |
| Use Nebius Serverless AI Endpoints | Deploy an AI Services Endpoint running an OpenAI-compatible LLM server; `LLMService.generate()` calls that endpoint for all agent LLM reasoning. |
| Use Nebius Serverless AI Jobs | Docker image runs `python -m backend.app.jobs.research_job ...` as a Nebius job container command. |
| Long-running async run | The FastAPI endpoint starts background local runs; Nebius Jobs are the cloud execution path for long-running runs. |
| Reproducible outputs | The job writes markdown, sources JSON, and trace JSON under `reports/`. |

Nebius docs describe Serverless AI as a service for containerized AI workloads
deployed either as interactive endpoints or non-interactive jobs. Nebius docs
also show Serverless AI endpoints can expose an OpenAI-compatible
`/v1/chat/completions` API through vLLM. This repo follows that split: batch
orchestration runs in the Job; model inference runs through the Endpoint.
