#!/usr/bin/env bash
# Order worktree-reap: archive HEAD and remove worktrees of long-closed beads in all registered cities
# (scripts/worktree-archive-reap.py has the gates). DRY_RUN=1 only prints.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
args=(--max "${REAP_MAX:-10}")
[ "${DRY_RUN:-0}" = "1" ] || args+=(--apply)
exec python3 -I "$ROOT/scripts/worktree-archive-reap.py" "${args[@]}" "$@"
