#!/usr/bin/env bash
# city-city dispatcher (gascity, ADR 0005, maw 2026-10-08). Deterministic, no LLM. Based on evermore-city's.
# For every rig in RIGS: ready beads of type task/feature/bug/chore, no assignee, not a workflow bead, no
# human/idee/review/warrant/needs-triage labels -> `gc sling gc.run-operator <bead> --on implement` (label big ->
# build-basic). Every workflow ends as a pull request to that city's repo (rig formula_vars push/open_pr); maw merges.
# Beads created by agents or orders need the label `approved`, except `upstream` beads from the upstream-watch order.
# Idempotent: live/unknown implement/build-basic workflows count as running; a state file limits re-dispatches
# (6 h cooldown, max 3 per bead). MAX_RUNNING caps workflows across all rigs. DRY_RUN=1 only prints.
set -euo pipefail
GC="${GC:-/opt/homebrew/opt/gascity/bin/gc}"
BD_BIN="${BD_BIN:-/opt/homebrew/bin/bd}"
SCRIPT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$SCRIPT_ROOT/scripts/lib/live-workflow-roots.sh"
CITY_GH=(python3 "$SCRIPT_ROOT/packs/publish-gate/assets/scripts/city-github.py" gh)
# Dry-run still reads real PR snapshots, with the existing login and no App token mint.
if [ "${DRY_RUN:-0}" = 1 ]; then
  CITY_GH=(env -u CITY_GH_TOKEN_CMD DRY_RUN=0 "${CITY_GH[@]}")
fi
DEAD_AFTER_HOURS="${DEAD_AFTER_HOURS:-6}"
CITY_DIR="${CITY_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
RIGS="${RIGS:-city=$HOME/git/maw-city-src evermore-city=$HOME/git/cities/evermore-city-src zue-city=$HOME/git/zue-city-src lumen-city=$HOME/git/cities/lumen-city-src city-dashboard=$HOME/git/cities/city-dashboard catladder=$HOME/git/cities/catladder}"
MAX_RUNNING="${MAX_RUNNING:-2}"
# Machine-wide worker budget (maw 2026-10-19, ~/git/cities/bin/worker-share, set via the city dashboard): the
# smaller of MAX_RUNNING and the city's share applies; unset = MAX_RUNNING. Running work is never stopped.
SHARE="$("$HOME/git/cities/bin/worker-share" maw-city 2>/dev/null || true)"
if [ -n "$SHARE" ] && [ "$SHARE" -lt "$MAX_RUNNING" ]; then echo "worker share: $SHARE (machine budget)"; MAX_RUNNING=$SHARE; fi
# Machine overload (city-watch -> ~/git/cities/bin/load-governor): only P0 beads start, so overload makes the
# cities slow instead of wasteful. Stop-gap until city-0vkz7.
OVERLOAD=0; REASON=""; GOVERNOR="${GOVERNOR:-$HOME/.local/state/cities/governor.env}"; [ -f "$GOVERNOR" ] && . "$GOVERNOR"
[ "$OVERLOAD" = 1 ] && echo "machine overload ($REASON): starting only P0 beads"
STATE="${STATE:-$HOME/.local/state/maw-city/dispatched.tsv}"
if [ "${DRY_RUN:-0}" != 1 ]; then mkdir -p "$(dirname "$STATE")"; touch "$STATE"; fi
AGENT_RE='/|wisp-|polecat|witness|refinery|deacon|dog|reviewer|order:'

TMP="$(mktemp -d)"
if [ ! -f "$STATE" ]; then STATE="$TMP/dispatched.tsv"; touch "$STATE"; fi
trap 'rm -rf "$TMP"' EXIT
# Suspended rigs get no new work (orders run at city level and would otherwise sling into them).
suspended="$("$GC" rig list --city "$CITY_DIR" 2>/dev/null | sed -nE 's/^ +([A-Za-z0-9_.-]+) \(suspended\):$/\1/p')"
# A failed session snapshot becomes unknown for every root, preserving capacity.
"$GC" session list --json --city "$CITY_DIR" > "$TMP/sessions.json" 2>/dev/null || printf 'null' > "$TMP/sessions.json"
now="$(date -u +%s)"
n_running=0
for r in $RIGS; do
  dir="${r#*=}"
  [ -d "$dir/.beads" ] || { echo "skip rig ${r%%=*}: no beads in $dir"; continue; }
  "$GC" session list --json --city "$CITY_DIR" --rig "$dir" > "$TMP/rig-sessions.json" 2>/dev/null || printf 'null' > "$TMP/rig-sessions.json"
  jq -s 'if all(.[]; type == "object" and (.sessions | type == "array"))
    then {sessions: [.[].sessions[]]} else null end' "$TMP/sessions.json" "$TMP/rig-sessions.json" > "$TMP/${r%%=*}.sessions.json" 2>/dev/null || printf 'null' > "$TMP/${r%%=*}.sessions.json"
  # --brief (beads 1.3): no free-text fields; nothing here reads them (Dolt CPU, 2026-10-19).
  all="$(cd "$dir" && env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin" "$BD_BIN" list --all --json --brief --limit 0 2>/dev/null || echo 'null')"
  printf '%s' "$all" > "$TMP/${r%%=*}.json"
  if ! lwr_root_state "$TMP/${r%%=*}.json" "$TMP/${r%%=*}.sessions.json" "$now" "$DEAD_AFTER_HOURS" > "$TMP/${r%%=*}.roots"; then
    echo "skip dispatch: incomplete liveness snapshot for ${r%%=*}" >&2
    exit 0
  fi
  while read -r root state hours work; do
    if [ "$state" = dead ]; then echo "ignore dead root $root ($work), silent=${hours}h"; fi
  done < "$TMP/${r%%=*}.roots"
  c=$(awk '$2 != "dead" {n++} END {print n+0}' "$TMP/${r%%=*}.roots")
  n_running=$((n_running + c))
done
echo "running: $n_running/$MAX_RUNNING"

for r in $RIGS; do
  rig="${r%%=*}"; dir="${r#*=}"
  if printf '%s\n' "$suspended" | grep -qx "$rig"; then echo "skip rig $rig: suspended"; continue; fi
  [ -f "$TMP/$rig.json" ] || continue
  all="$(cat "$TMP/$rig.json")"
  bd() { (cd "$dir" && env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin" "$BD_BIN" "$@"); }
  # Reconcile manual PR merges before ready: this also releases blocked dependents.
  # GitHub failures leave the rig untouched and undispatched rather than re-running delivered work.
  origin="$(git -C "$dir" remote get-url origin 2>/dev/null || true)"; gh_repo="$(sed -E 's#^.*github\.com[:/]##; s#\.git$##' <<<"$origin")"
  if [[ ! "$gh_repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "skip rig $rig: no GitHub origin"; continue
  fi
  if ! perl -e 'alarm 60; exec @ARGV' "${CITY_GH[@]}" pr list --repo "$gh_repo" --state open --limit 100 \
      --json number,title,headRefName > "$TMP/$rig.open-prs.json" 2>/dev/null ||
     ! perl -e 'alarm 60; exec @ARGV' "${CITY_GH[@]}" pr list --repo "$gh_repo" --state merged --limit 100 \
      --json number,title,headRefName,mergedAt > "$TMP/$rig.merged-prs.json" 2>/dev/null; then
    echo "skip rig $rig: incomplete GitHub PR snapshot"; continue
  fi
  if ! python3 "$SCRIPT_ROOT/scripts/merged-pr-beads.py" "$TMP/$rig.json" \
      "$TMP/$rig.merged-prs.json" "$TMP/$rig.open-prs.json" > "$TMP/$rig.delivered"; then
    echo "skip rig $rig: invalid merge reconciliation snapshot"; continue
  fi
  pr_titles="$(jq -r '.[] | "\(.title) \(.headRefName)"' "$TMP/$rig.open-prs.json")"
  running="$(awk '$2 != "dead" && $4 != "-" {print $4}' "$TMP/$rig.roots" | sort -u)"
  while read -r id number; do
    # Do not close a source anchor while its implementation is still live or uncertain.
    printf '%s\n' "$running" | grep -qx "$id" && continue
    if [ "${DRY_RUN:-0}" = 1 ]; then
      echo "DRY_RUN: would close $rig $id: Delivered in $gh_repo#$number"
      continue
    fi
    # Refresh the exact source bead so a stale snapshot cannot close a newly converted workflow object.
    if ! bd show "$id" --json > "$TMP/$rig.source.json" ||
       ! python3 "$SCRIPT_ROOT/scripts/merged-pr-beads.py" "$TMP/$rig.source.json" \
         "$TMP/$rig.merged-prs.json" "$TMP/$rig.open-prs.json" > "$TMP/$rig.refreshed"; then
      echo "skip close $id: source refresh failed"; continue
    fi
    grep -qx "$id $number" "$TMP/$rig.refreshed" || continue
    # A bead that cannot be closed (e.g. open children) must not stop dispatch for every rig.
    bd close "$id" --reason "Delivered in $gh_repo#$number" >/dev/null || echo "WARN close failed: $id (Delivered in $gh_repo#$number)"
  done < "$TMP/$rig.delivered"
  ready="$(bd ready --json --limit 1000 2>/dev/null | jq -r --arg re "$AGENT_RE" '.[]
    | select(.issue_type=="task" or .issue_type=="feature" or .issue_type=="bug" or .issue_type=="chore")
    | select((.assignee // "") == "")
    | select((.labels // []) as $l | ["human","idee","review","warrant","needs-triage"] | all(. as $x | $l | index($x) | not))
    | ((.created_by // "") | test($re)) as $by_agent
    # index() returns null when absent; compare each to null (`(a or b) != null` was always true, so every
    # agent-created bead was dispatched without `approved`, 2026-10-13).
    | select(($by_agent | not) or ((.labels // []) | (index("approved") != null or index("upstream") != null)))
    | select(((.metadata // {}) | has("gc.root_bead_id") or has("gc.formula_name") or has("gc.kind")) | not)
    | select(((.metadata // {})["gc.routed_to"] // "") == "")
    | select(.title | test("^(mol-|sling-|input convoy for |Mensch:|Digest:)") | not)
    | "\(.priority) \(.created_at // "-") \(.id)"' | awk -v ov="$OVERLOAD" 'ov != 1 || $1 == 0')"
  while read -r prio created id; do
    [ -n "$id" ] || continue
    printf '%s\n' "$running" | grep -qx "$id" && continue
    # In DRY_RUN the store remains open; never preview a sling for a delivered bead.
    if awk -v id="$id" '$1==id {found=1} END {exit !found}' "$TMP/$rig.delivered"; then continue; fi
    if grep -qE "(^|[^0-9A-Za-z.])${id//./\\.}([^0-9A-Za-z.]|$)" <<<"$pr_titles"; then echo "SKIP $id: open PR"; continue; fi
    last=$(awk -F'\t' -v id="$id" '$1==id {t=$2} END {print t}' "$STATE")
    if [ -n "$last" ] && [ $(( $(date -u +%s) - $(date -j -u -f "%Y-%m-%dT%H:%M:%SZ" "$last" +%s 2>/dev/null || echo 0) )) -lt 21600 ]; then
      echo "SKIP $id: dispatched at $last, cooldown 6 h"; continue; fi
    attempts=$(awk -F'\t' -v id="$id" '$1==id' "$STATE" | wc -l | tr -d ' ')
    if [ "$attempts" -ge 3 ]; then echo "SKIP $id: dispatched $attempts times already - needs a human"; continue; fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$prio" "$created" "$rig" "$dir" "$id" >> "$TMP/candidates.tsv"
  done <<<"$ready"
done

# Pick across rigs by priority, then age (2026-10-15: rigs were filled in list order, so P2 upstream beads of the
# first rig took every free slot and dash-s0a (P1, last rig) waited two days).
touch "$TMP/candidates.tsv"
while IFS=$'\t' read -r prio created rig dir id; do
  if [ "$n_running" -ge "$MAX_RUNNING" ]; then echo "cap reached ($n_running/$MAX_RUNNING)"; break; fi
  labels=$(jq -r --arg id "$id" '.[] | select(.id==$id) | (.labels // []) | join(",")' "$TMP/$rig.json")
  formula=implement; args=()
  if [[ ",$labels," == *,big,* ]]; then formula=build-basic; args+=(--var "artifact_root=plans/$id"); fi
  if [ "${DRY_RUN:-0}" = "1" ]; then echo "DRY_RUN: would sling $rig $id (P$prio) --on $formula ${args[*]:-}"; n_running=$((n_running+1)); continue; fi
  if out="$(cd "$dir" && "$GC" sling --city "$CITY_DIR" gc.run-operator "$id" --on "$formula" ${args[@]+"${args[@]}"} 2>&1)"; then
    printf '%s\t%s\t%s\t%s\n' "$id" "$(date -u +%FT%TZ)" "$formula" "$rig" >> "$STATE"; n_running=$((n_running+1)); echo "slung $rig $id --on $formula"
  else
    # A failed sling counts as an attempt (6 h cooldown, max 3) and says why: zue-dispatch re-slung a bead every
    # 5 min for hours behind a half-instantiated workflow (gascity#6179, zcity-gsxj, 2026-10-15).
    printf '%s\t%s\t%s\t%s\tfailed\n' "$id" "$(date -u +%FT%TZ)" "$formula" "$rig" >> "$STATE"
    echo "FAILED to sling $rig $id: $(printf '%s' "$out" | grep -v '^[[:space:]]*$' | tail -1 | cut -c1-200)"
  fi
done < <(sort -t$'\t' -k1,1n -k2,2 "$TMP/candidates.tsv")
