#!/usr/bin/env bash
# Workaround for gastownhall/gascity#6461 and #6932 (copied from zue-city, maw 2026-10-06). Deterministic, no LLM, idempotent.
# Every drain item root (one do-work workflow per task) carries gc.routed_to = the worker pool, so the
# pool counts it as demand and wakes a worker roughly once a minute; the worker finds no step for
# itself and drains again. The steps carry their own routing, so the root does not need it once the
# workflow is expanded (it has step beads). This order moves gc.routed_to to cc.parked_routed_to.
# Outer build-basic roots (routed to the run-operator pool) have the same problem (#6932, zc-sqg).
# Remove this order when #6461 and #6932 are fixed upstream. DRY_RUN=1 only prints.
set -euo pipefail
RIG_DIR="${RIG_DIR:?RIG_DIR required}"
export PATH="/opt/homebrew/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"
bd() { (cd "$RIG_DIR" && env -i HOME="$HOME" PATH="$PATH" /opt/homebrew/bin/bd "$@"); }

all="$(bd list --all --json --limit 5000 2>/dev/null || echo '[]')"
jq -r '
  ([.[] | .metadata["gc.root_bead_id"] // empty] | unique) as $expanded
  | .[] | select(.status != "closed" and (.metadata["gc.kind"]//"") == "workflow"
      and (.metadata["gc.routed_to"]//"") != ""
      # Only our pools (gc.*, ev.*); Gastown/review leftovers from maw-city are cleaned up by scripts/migrate-gastown-leftovers.sh.
      and ((.metadata["gc.routed_to"]//"") | test("(^|/)(gc|cc)\\.")))
  # drain item roots (do-work per task, #6461) and outer roots (build-basic, #6932), once expanded
  | select((.metadata["gc.workflow_expanded"]//"") == "true" or
      ((.metadata["gc.drain_member_id"]//"") != "" and (.id as $id | $expanded | index($id))))
  | "\(.id)\t\(.metadata["gc.routed_to"])"' <<<"$all" |
while IFS=$'\t' read -r id routed; do
  echo "$id: park gc.routed_to=$routed (gascity#6461/#6932)"
  [ "${DRY_RUN:-0}" = "1" ] && continue
  bd update "$id" --set-metadata "cc.parked_routed_to=$routed" --unset-metadata gc.routed_to >/dev/null \
    || echo "failed: $id"
done
