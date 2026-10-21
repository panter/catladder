#!/usr/bin/env bash
# Makes the beads board readable for humans (copied from zue-city, maw 2026-10-06). Deterministic, no LLM, idempotent.
# Gas City workflows create many internal beads (workflow roots "build-basic", steps like
# "Write implementation plan", convoys). This order
#   1. labels every workflow-internal bead with `gc-workflow` and `for:<work-bead-id>`, so boards can
#      filter them out or group them by the work item they belong to;
#   2. labels work beads with a running workflow `running` (removed when it ends).
# (Mirroring in_progress onto the work bead was removed: boards flag in_progress beads without a live
# session as "stalled". The dispatcher detects running work via its convoy, not via status.)
# DRY_RUN=1 only prints.
set -euo pipefail
RIG_DIR="${RIG_DIR:?RIG_DIR required}"
export PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"
bd() { (cd "$RIG_DIR" && env -i HOME="$HOME" PATH="$PATH" /opt/homebrew/bin/bd "$@"); }
act() { if [ "${DRY_RUN:-0}" = "1" ]; then echo "DRY_RUN: bd $*"; else bd "$@" >/dev/null 2>&1 || echo "failed: bd $*"; fi; }

all="$(bd list --all --json --limit 5000 2>/dev/null || echo '[]')"
# convoy id -> work bead id (from "input convoy for <id>" titles)
# root id -> work bead id (root's gc.var.convoy_id / gc.input_convoy_id points at the input convoy)
map=$(jq -r '
  (map(select(.title|test("^input convoy for "))) | map({key:.id, value:(.title|sub("^input convoy for ";""))}) | from_entries) as $conv
  | .[] | select((.metadata["gc.kind"]//"")=="workflow" or (.metadata["gc.formula_name"]//"")!="")
  | select(.metadata["gc.root_bead_id"] == null)
  | [.id, ($conv[.metadata["gc.var.convoy_id"] // ""] // $conv[.metadata["gc.input_convoy_id"] // ""] // "unknown"), .status] | @tsv' <<<"$all")

# One jq pass over all beads: <bead id> TAB <missing label>. (Was one jq run per workflow root over
# the whole list – quadratic, and it re-added gc-workflow on every run for roots without a work bead
# because "for:unknown" never exists; with ~800 roots the order timed out every time.)
jq -r '
  (map(select(.title|test("^input convoy for "))) | map({key:.id, value:(.title|sub("^input convoy for ";""))}) | from_entries) as $conv
  | (map(select((.metadata["gc.kind"]//"")=="workflow" or (.metadata["gc.formula_name"]//"")!="") | select(.metadata["gc.root_bead_id"] == null)
      | {key:.id, value:($conv[.metadata["gc.var.convoy_id"] // ""] // $conv[.metadata["gc.input_convoy_id"] // ""] // "unknown")}) | from_entries) as $roots
  | .[] | (if $roots[.id] != null then .id else (.metadata["gc.root_bead_id"] // "") end) as $r
  | select($roots[$r] != null) | $roots[$r] as $w | (.labels//[]) as $l
  | (if ($l | index("gc-workflow")) == null then [.id, "gc-workflow"] else empty end),
    (if $w != "unknown" and ($l | index("for:" + $w)) == null then [.id, "for:" + $w] else empty end)
  | @tsv' <<<"$all" |
while IFS=$'\t' read -r id label; do act label add "$id" "$label"; done
# Label `running` on work beads with an open workflow (no status/assignee change: boards would flag
# those as stalled). Removed again once no workflow for the bead is open.
want=$(awk -F'\t' '$2!="unknown" && $3!="closed" {print $2}' <<<"$map" | sort -u)
have=$(jq -r '.[] | select((.labels//[]) | index("running")) | .id' <<<"$all" | sort -u)
for id in $(comm -23 <(echo "$want") <(echo "$have")); do echo "$id: running"; act label add "$id" running; done
for id in $(comm -13 <(echo "$want") <(echo "$have")); do echo "$id: no longer running"; act label remove "$id" running; done

# (zue-city closes work beads on merged PRs here; evermore-city has no PRs: the publish step labels on-main.)
# Convoys and merge-train/dispatcher bookkeeping beads are internal too.
jq -r '.[] | select(.title|test("^(input convoy for |sling-)")) | select(((.labels//[]) | index("gc-workflow")) == null) | .id' <<<"$all" |
  while read -r id; do act label add "$id" gc-workflow; done
