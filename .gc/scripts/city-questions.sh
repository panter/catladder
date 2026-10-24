#!/usr/bin/env bash
# Machine tool for city-watch: scan each registered city without starting an LLM.
set -euo pipefail
exec python3 -B "$(cd "$(dirname "$0")" && pwd)/question-router.py" --all-cities "$@"
