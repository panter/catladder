#!/usr/bin/env bash
# Streams only actionable city problems from .gc/events.jsonl (for the planning session's Monitor):
# order failures, stalled-session resets, drain acks with assigned work, and loops
# (same session woken/stopped >= 3 times within 10 minutes; for pools: the same trigger bead spawning
# >= 3 sessions within 10 minutes, e.g. gascity#6461). Also warns when free disk < 20 GB.
# No LLM, read-only.
set -uo pipefail
CITY="${CITY:-$HOME/git/maw-city}"
# Pool templates whose woke/stopped cycles are normal (one subject aggregates many workers).
POOL_RE="${POOL_RE:-(gastown\\.(polecat|furiosa|nux|rictus|slit)|review\\.reviewer|gc\\.[a-z-]+|zr\\.[a-z-]+|bd\\.dog|core\\.control-dispatcher)(-[0-9]+)?$}"
# Token-burn guard: more than CHURN_MAX session wakes per 30 min across the city is reported.
CHURN_MAX="${CHURN_MAX:-60}"
cd "$CITY" || exit 1
(
  while true; do
    free=$(df -g "$HOME" | awk 'NR==2{print $4}')
    [ "${free:-999}" -lt 20 ] && echo "DISK low: ${free} GB free"
    sleep 600
  done
) &
tail -n 0 -F .gc/events.jsonl | jq --unbuffered -r '
  select(.type=="order.failed" or .type=="session.reset_stalled" or .type=="session.drain_acked_with_assigned_work"
         or .type=="session.woke" or .type=="session.stopped" or .type=="controller.started"
         or (.type=="bead.updated" and (.payload.bead // .payload).issue_type=="session"
             and ((.payload.bead // .payload).metadata.state_reason//"")=="creation_complete"
             and ((.payload.bead // .payload).metadata["gc.trigger_bead_id"]//"")!=""))
  | if .type=="bead.updated" then "\(.ts[11:16]) session.spawn \((.payload.bead // .payload).title) \((.payload.bead // .payload).metadata["gc.trigger_bead_id"]) \((.payload.bead // .payload).id)"
    else "\(.ts[11:16]) \(.type) \(.subject // "") \((.message // "") | tostring | .[0:160])" end' |
awk -v pool="$POOL_RE" -v churnmax="$CHURN_MAX" -v city="$(basename "$CITY")" '
  { srand(); now=srand() }
  $2=="session.woke" { w=w " " now; split(w, wt, " "); keepw=""; nw=0
    for (i in wt) if (wt[i]!="" && now-wt[i] < 1800) { nw++; keepw=keepw " " wt[i] }
    w=keepw; if (nw > churnmax && now-lastchurn > 900) { print "CHURN " city ": " nw " session wakes in 30 min (token burn?)"; fflush(); lastchurn=now } }
  # Pool loop: the same trigger bead keeps spawning sessions (one spawn per session id).
  $2=="session.spawn" { if (seen[$5]++) next; key=$4; n=0; sp[key]=sp[key] " " now
    split(sp[key], t, " "); keep=""
    for (i in t) if (t[i]!="" && now-t[i] < 600) { n++; keep=keep " " t[i] }
    sp[key]=keep
    if (n >= 3) { print "LOOP " $1 " trigger " $4 " spawned " n " sessions in 10 min (" $3 ")"; fflush() }
    next }
  # Pool subjects (e.g. evermore/gastown.polecat) aggregate all workers: normal finish/drain cycles are not loops.
  ($2=="session.woke" || $2=="session.stopped") && $3 ~ pool { next }
  # Known benign: the compactor reports a skip below its threshold as a failed order.
  $2=="order.failed" && $3=="mol-dog-compactor" && /below_threshold/ { next }
  $2=="session.woke" || $2=="session.stopped" {
    key=$2 " " $3; n=0; hist[key]=hist[key] " " now
    split(hist[key], t, " "); keep=""
    for (i in t) if (t[i]!="" && now-t[i] < 600) { n++; keep=keep " " t[i] }
    hist[key]=keep
    if (n >= 3) { print "LOOP " $0 " (" n "x/10min)"; fflush() }
    next
  }
  { print; fflush() }'
