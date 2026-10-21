#!/usr/bin/env bash
# Order unpublished-watch: closed beads whose code never reached main (gascity-packs#387), all cities. Runs
# ~/git/cities/bin/unpublished-watch (machine-level), appends ALERT/INFO lines to the shared city-watch logs so the
# same supervision sees them, and salvages unreferenced commits as refs/salvage/<bead>. DRY_RUN=1 passes through.
set -uo pipefail
TOOL="${TOOL:-$HOME/git/cities/bin/unpublished-watch}"
STATE="${STATE_DIR:-$HOME/.local/state/cities/burn-watch}"; mkdir -p "$STATE"
[ -x "$TOOL" ] || { echo "unpublished-watch: $TOOL missing"; exit 1; }
out="$(INTERVAL_MIN=0 "$TOOL" 2>&1)"
ts="$(date '+%F %H:%M')"
if [ "${DRY_RUN:-0}" != "1" ]; then
  printf '%s\n' "$out" | grep -E '^ALERT' | sed "s/^/$ts /" >> "$STATE/alerts.log"
  printf '%s\n' "$out" | grep -E '^INFO' | sed "s/^/$ts /" >> "$STATE/nudges.log"
fi
printf '%s\n' "$out"
exit 0
