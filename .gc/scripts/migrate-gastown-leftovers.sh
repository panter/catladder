#!/usr/bin/env bash
# One-time migration of rig evermore from maw-city (Gastown) to evermore-city (maw 2026-10-08, mc-q2a; also used for the rig city of maw-city).
# Run once by maw after maw-city stopped serving the rig; NOT an order. Deterministic, no LLM, idempotent.
#   1. closes open Gastown workflow roots (mol-polecat-work, mol-review-leg) and their open step beads;
#   2. closes open Gastown convoys ("input convoy for …", "sling-…") created before the cutover;
#   3. resets work beads still assigned to Gastown agents (polecats, refinery, reviewer) to open/unassigned;
#   4. lists work beads with an unmerged remote polecat/* branch (manual decision: merge, re-run or drop).
# Review beads (label `review`) are kept unless CLOSE_REVIEWS=1 (code review is optional in evermore-city).
# Env: RIG_DIR, CUTOVER (required UTC timestamp; only convoys created before it are Gastown), DRY_RUN=1 (print only, default).
set -euo pipefail
RIG_DIR="${RIG_DIR:?RIG_DIR required}"
CUTOVER="${CUTOVER:?CUTOVER required: UTC timestamp of the switch, e.g. 2026-10-08T15:45:00Z (convoys created later belong to gascity workflows)}"
DRY_RUN="${DRY_RUN:-1}"
CLOSE_REVIEWS="${CLOSE_REVIEWS:-0}"
bd() { (cd "$RIG_DIR" && env -i HOME="$HOME" PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin" /opt/homebrew/bin/bd "$@"); }
act() { if [ "$DRY_RUN" = "1" ]; then echo "DRY_RUN: bd $*"; else bd "$@" >/dev/null 2>&1 || echo "failed: bd $*"; fi; }
REASON="${REASON:-Migration to gascity (mc-q2a): Gastown workflow ended.}"

all="$(bd list --all --json --limit 10000 2>/dev/null)"
roots=$(jq -r '.[] | select(.status!="closed" and (.metadata["gc.kind"]//"")=="workflow")
  | select((.metadata["gc.formula_name"]//"") | test("^(mol-polecat-work|mol-review-leg)$")) | .id' <<<"$all")
echo "Gastown workflow roots: $(grep -c . <<<"$roots" || true)"
for r in $roots; do
  for s in $(jq -r --arg r "$r" '.[] | select(.status!="closed" and (.metadata["gc.root_bead_id"]//"")==$r) | .id' <<<"$all"); do
    act close "$s" --force --reason "$REASON"   # steps block each other; --force is fine for dead workflows
  done
  act close "$r" --reason "$REASON"
done

# Orphan steps: open step beads whose Gastown root is already closed (left by an earlier run without --force).
orphans=$(jq -r '([.[] | select((.metadata["gc.formula_name"]//"") | test("^(mol-polecat-work|mol-review-leg)$")) | .id]) as $g
  | .[] | select(.status!="closed" and ((.metadata["gc.root_bead_id"]//"") as $r | $g | index($r))) | .id' <<<"$all")
echo "Orphan Gastown steps: $(grep -c . <<<"$orphans" || true)"
for s in $orphans; do act close "$s" --force --reason "$REASON"; done

convoys=$(jq -r --arg c "$CUTOVER" '.[] | select(.status!="closed" and (.title|test("^(input convoy for |sling-)")))
  | select((.created_at//"") < $c) | .id' <<<"$all")
echo "Gastown convoys: $(grep -c . <<<"$convoys" || true)"
for c in $convoys; do act close "$c" --reason "$REASON"; done

echo "Work beads assigned to Gastown agents:"
jq -r '.[] | select(.status!="closed" and ((.assignee//"") | test("gastown|polecat|refinery|witness|review\\.")))
  | select(((.metadata//{}) | has("gc.root_bead_id")) | not) | "\(.id)\t\(.assignee)\t\(.title[0:60])"' <<<"$all" |
while IFS=$'\t' read -r id who title; do
  echo "  $id ($who) $title"
  act update "$id" --status open --assignee "" --force   # the Gastown holder no longer exists
done

if [ "$CLOSE_REVIEWS" = "1" ]; then
  for id in $(jq -r '.[] | select(.status!="closed" and ((.labels//[]) | index("review"))) | .id' <<<"$all"); do
    act close "$id" --reason "Migration to evermore-city: code review is optional now (maw 2026-10-08)."
  done
fi

echo "Unmerged remote polecat branches (decide per bead: merge, re-run, or delete the branch):"
git -C "$RIG_DIR" fetch -q origin --prune
git -C "$RIG_DIR" for-each-ref --format='%(refname:short)' 'refs/remotes/origin/polecat/*' |
while read -r br; do
  ahead=$(git -C "$RIG_DIR" rev-list --count "origin/main..$br" 2>/dev/null || echo "?")
  # Commits already on main by patch id (rebased merges) do not count.
  unique=$(git -C "$RIG_DIR" cherry origin/main "$br" 2>/dev/null | grep -c '^+' || true)
  [ "$unique" -gt 0 ] && echo "  $br: $unique unmerged commit(s) ($ahead ahead)"
done
echo "done (DRY_RUN=$DRY_RUN)"
