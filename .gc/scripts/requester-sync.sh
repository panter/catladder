#!/usr/bin/env bash
# Order requester-sync (ADR 0007): set and inherit requested_by on open beads of every rig in every city.
# DRY_RUN=1 only prints. See scripts/requester-sync.py.
set -euo pipefail
exec /opt/homebrew/bin/python3 -I "$(cd "$(dirname "$0")" && pwd)/requester-sync.py" "$@"
