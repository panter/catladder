#!/usr/bin/env bash
# Read-only graph/decision check for gascity-packs#387 and #400.
# Remove with the overlay when an adopted upstream release closes after outer
# publish, handles explicit no-ops and sequences teardown after closure.
# DRY_RUN=1 is supported: this check never creates beads or changes live state.
set -euo pipefail
CHECK_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$CHECK_ROOT"
exec python3 scripts/check-workflow-order.py "$@"
