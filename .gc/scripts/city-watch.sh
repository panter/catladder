#!/usr/bin/env bash
# Runs ~/git/cities/bin/burn-watch (machine-level tool next to accounts.toml, see ~/git/cities) and records its
# findings: ALERT/WARN lines to alerts.log, repairs (INFO … nudged/reset) to nudges.log, a heartbeat file so an
# outside observer can see that the watch itself runs. DRY_RUN=1 passes through (no nudges/resets).
set -uo pipefail
WATCH="${WATCH:-$HOME/git/cities/bin/burn-watch}"
STATE="${STATE_DIR:-$HOME/.local/state/cities/burn-watch}"; mkdir -p "$STATE"
[ -x "$WATCH" ] || { echo "city-watch: $WATCH missing"; exit 1; }
# Overload governor first (maw 2026-10-12: overload may make cities slow, never wasteful): writes
# ~/.local/state/cities/governor.env; dispatchers start only P0 beads while OVERLOAD=1. Stop-gap until city-0vkz7.
GOV="${GOV:-$HOME/git/cities/bin/load-governor}"
gov_out=""; [ -x "$GOV" ] && gov_out="$("$GOV" 2>&1)"
out="$gov_out
$("$WATCH" 2>&1)"
# Gate scripts the pinned pack expects in every rig's .gc/scripts/checks (gc does not materialize them; a missing
# implementation-review-approved.sh failed zue-r0lwh on 2026-10-12). Copies only missing files; DRY_RUN passes.
SYNC="${SYNC:-$HOME/git/cities/bin/rig-checks-sync}"
[ -x "$SYNC" ] && out="$out
$("$SYNC" 2>&1)"
# bd's local Dolt server and db-proxy log every connection and never rotate (zue ~1.3 GB/day, 2026-10-12); keep
# each proxy.log/server.log under 200 MB (copy-truncate, last 10 MB kept). Logs only. Upstream draft: city-izngi.
ROTATE="${ROTATE:-$HOME/git/cities/bin/dolt-log-rotate}"
[ -x "$ROTATE" ] && out="$out
$("$ROTATE" 2>&1)"
# Codex folder/hook trust for new rigs (a new rig's Codex workers otherwise stop at «Trust this folder», #6713/#6464;
# 2026-10-12 city-dashboard). Appends only missing entries (backup first); DRY_RUN previews.
TRUST="${TRUST:-$HOME/git/cities/bin/codex-trust-rigs}"
if [ -x "$TRUST" ]; then
  if [ "${DRY_RUN:-0}" = "1" ]; then t="$("$TRUST" 2>&1)"; else t="$("$TRUST" --apply 2>&1)"; fi
  printf '%s\n' "$t" | grep -q '^trust ' && out="$out
INFO codex-trust-rigs: $(printf '%s' "$t" | grep '^trust ' | tr '\n' ';')"
fi
# Dev servers left running in city worktrees (maw 2026-10-15: dozens of `next dev`/turbo stacks kept load and
# fseventsd high). Stops a worktree's dev servers once its bead is closed or the worktree is reaped (no idle-time
# rule); never touches ~/.../.claude/worktrees (maw's own sessions). DRY_RUN previews.
REAPDEV="${REAPDEV:-$HOME/git/cities/bin/dev-server-reaper}"
[ -x "$REAPDEV" ] && out="$out
$("$REAPDEV" 2>&1)"
# Half-instantiated workflow roots (gc.instantiating=true, gascity#6179) block every later sling of their bead:
# fenced-root-sweeper closes such a root, its steps and input convoy after 15 min, drops the failed sling attempts
# and mails maw (zcity-88bz, 2026-10-16). dispatch-limit-notify mails maw once when a dispatcher gives up on a
# bead after 3 attempts. Both machine-level, all cities; DRY_RUN previews.
# dashboard-keepalive restarts the city dashboard (127.0.0.1:3700) if it is down, until dash-jd8c makes it a
# supervisor service (2026-10-16).
# account-guard pauses evermore-city while claude-private's weekly usage is >= 50 % and resumes it after the reset
# (maw 2026-10-18).
# Workflow roots whose work bead is already closed stay open forever (city-fb3ko, gascity#3122): close them across
# all cities (DRY_RUN previews).
out="$out
$(python3 "$(dirname "$0")/closed-workflow-sweeper.py" 2>&1 | grep -vE 'inspecting [0-9]+ open workflow roots' || true)"
# worktree-janitor removes <rig>/worktrees/<bead> of closed beads in all cities (archive branch for unpushed commits,
# dirty trees only reported): Gas City's reaper never sees that location (gascity #5760/#6718); disk hit 100 % on
# 2026-10-19 with 242 GB of evermore worktrees.
# prune-workflow-beads deletes closed workflow-internal beads older than 7 days in every rig, once a day (they were
# 83 % of evermore's store; ADR 0008 no_history would avoid them, blocked on gascity#7588).
[ -x "$HOME/git/cities/bin/prune-workflow-beads" ] && [ "${DRY_RUN:-0}" != 1 ] && out="$out
$(INTERVAL_HOURS=24 "$HOME/git/cities/bin/prune-workflow-beads" --apply 2>&1)"
# beads-gcs-mirror refreshes the local Dolt backups and copies them to GCS every 30 min with
# `gcloud storage rsync --impersonate-service-account` (no city process gets Google credentials); it replaces the
# Dolt-over-Git pushes to GitHub (huge packs, failing since 2026-10-18).
# rig-ff fast-forwards every rig checkout to origin/<branch> (at most every 10 min): do-work/prepare-worktree branches
# each item from the rig checkout's HEAD, which lagged up to 161 commits, so nearly every PR conflicted (2026-10-20).
# flow-watch compares expected work (approved, unblocked beads) with running workflows per city every 15 min and
# mails the maw-city mayor when a dispatcher ignores approved work with free slots, or would sling but nothing starts,
# for 30 min (maw 2026-10-21: zue idled for hours with 23 approved beads, zue-city #55). No LLM until it alarms.
for tool in rig-ff fenced-root-sweeper decomposition-sweeper dispatch-limit-notify dashboard-keepalive account-guard worktree-janitor beads-gcs-mirror flow-watch; do
  [ -x "$HOME/git/cities/bin/$tool" ] && out="$out
$("$HOME/git/cities/bin/$tool" 2>&1)"
done
ts="$(date '+%F %H:%M')"
printf '%s\n' "$out" | grep -E '^(ALERT|WARN)' | sed "s/^/$ts /" >> "$STATE/alerts.log"
printf '%s\n' "$out" | grep -E '^INFO .*(nudged|reset|dev-server-reaper: stopped|fenced-root-sweeper: closed|decomposition-sweeper: closed|dispatch-limit-notify: mailed|dashboard-keepalive: started|account-guard: |closed-workflow-sweeper: |worktree-janitor: removed|rig-ff: |beads-gcs-mirror: |prune-workflow-beads: )' | sed "s/^/$ts /" >> "$STATE/nudges.log"
[ "${DRY_RUN:-0}" = "1" ] || date +%s > "$STATE/heartbeat"
printf '%s\n' "$out"
exit 0
