#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <container-image> [company] [ticker] [goal]" >&2
  echo "Example: $0 cr.ai.nebius.cloud/<registry>/openresearch-analyst:latest Nebius NBIS 'Generate an investment research report'" >&2
  exit 1
fi

IMAGE="$1"
COMPANY="${2:-Nebius}"
TICKER="${3:-NBIS}"
GOAL="${4:-Generate an investment research report}"

nebius ai create \
  --type job \
  --name "openresearch-analyst-${TICKER,,}" \
  --image "$IMAGE" \
  --container-command python \
  --args "-m backend.app.jobs.research_job --company ${COMPANY} --ticker ${TICKER} --goal ${GOAL}" \
  --platform cpu-e2 \
  --preset 2vcpu-8gb \
  --timeout 2h
