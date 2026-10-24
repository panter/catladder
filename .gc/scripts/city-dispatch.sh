#!/usr/bin/env bash
# Order entry point for the shared dispatcher (packs/city-dispatch, city-ifm24). All policy lives in dispatch.toml.
# Kept as a shell entry for ~/git/cities/bin/flow-watch, which finds the dispatcher through the order's exec line,
# reads the cap from the line below and runs `DRY_RUN=1 bash <script>`. Remove this wrapper once flow-watch reads
# max_running from dispatch.toml and calls the pack with its config. check-city.sh keeps both caps equal.
set -euo pipefail
MAX_RUNNING="${MAX_RUNNING:-2}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec /opt/homebrew/bin/python3 "$ROOT/packs/city-dispatch/assets/scripts/city-dispatch.py" "$ROOT/dispatch.toml"
