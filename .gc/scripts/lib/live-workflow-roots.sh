#!/usr/bin/env bash
# Workaround for gastownhall/gascity #5607/#6791/#2903/#7197.
# Remove when the pinned GC release repairs dead workflow roots, or #5607
# is adopted with equivalent repair. Read-only: callers fetch complete JSON.
# API: lwr_root_state <beads.json> <sessions.json> <now_epoch> <threshold_h>
# Output: root state silent_hours work_bead (unknown work bead is "-").
# Invalid global input returns nonzero with no rows; unknown always means keep.
lwr_root_state() {
  python3 - "$@" <<'PY'
import datetime
import json
import math
import os
import re
import sys


def meta(bead):
    value = bead.get("metadata") or {}
    if not isinstance(value, dict):
        raise ValueError("invalid metadata")
    return value


def timestamp(value):
    date = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if date.tzinfo is None:
        raise ValueError("timestamp without timezone")
    return date.timestamp()


def identities(value):
    if not isinstance(value, str) or not value:
        return set()
    short = value.rsplit("/", 1)[-1]
    # Pool slots may be printed as role-1 or role[1]. Overmatching is safe.
    return {value, short, re.sub(r"(?:-\d+|\[\d+\])$", "", short)}


try:
    if len(sys.argv) != 5:
        raise ValueError("expected four arguments")
    with open(sys.argv[1]) as stream:
        beads = json.load(stream)
    if not isinstance(beads, list) or not all(isinstance(b, dict) for b in beads):
        raise ValueError("expected bead array")
    now, threshold = float(sys.argv[3]), float(sys.argv[4])
    if not math.isfinite(now) or not math.isfinite(threshold) or threshold <= 0:
        raise ValueError("invalid clock/threshold")
    by_id = {b["id"]: b for b in beads}
    if len(by_id) != len(beads) or not all(isinstance(i, str) and i for i in by_id):
        raise ValueError("invalid/duplicate bead ids")
    for bead in beads:
        meta(bead)
except Exception as error:
    print(f"live-workflow-roots: invalid bead input: {error}", file=sys.stderr)
    sys.exit(1)

sessions_valid = False
live = set()
try:
    with open(sys.argv[2]) as stream:
        sessions = json.load(stream)
    if isinstance(sessions, dict):
        sessions = sessions["sessions"]
    if not isinstance(sessions, list) or not sessions:
        raise ValueError("empty/missing session snapshot")
    for session in sessions:
        if not isinstance(session, dict) or not isinstance(session.get("closed"), bool):
            raise ValueError("invalid session record")
        names = set()
        for key in ("id", "name", "session_name", "alias", "agent_name", "template"):
            names |= identities(session.get(key))
        if not names:
            raise ValueError("session without identity")
        if not session["closed"]:
            live |= names
    sessions_valid = True
except Exception as error:
    print(f"live-workflow-roots: unknown session snapshot: {error}", file=sys.stderr)

# ADR 0009: legacy convoy fallback; remove once all convoys carry tracks edges.
LEGACY_CONVOY_TITLE = re.compile(r"input convoy for ([A-Za-z0-9][A-Za-z0-9_.-]*)")

formulas = set(os.environ.get("LWR_FORMULAS", "implement build-basic spike").replace(",", " ").split())
for root in beads:
    rm = meta(root)
    rid = root["id"]
    parent = rm.get("gc.root_bead_id")
    if root.get("status") == "closed" or parent not in (None, "", rid):
        continue
    if not (rm.get("gc.kind") == "workflow" or rm.get("gc.formula_contract") == "graph.v2"):
        continue
    if rm.get("gc.drain_member_id") or rm.get("gc.formula_name") not in formulas:
        continue
    steps = [b for b in beads if b["id"] != rid and meta(b).get("gc.root_bead_id") == rid]
    state, hours, work = "unknown", "-", "-"
    try:
        convoy = by_id.get(rm.get("gc.var.convoy_id") or rm.get("gc.input_convoy_id"), {})
        dependencies = convoy.get("dependencies") or []
        if not isinstance(dependencies, list):
            raise ValueError("invalid convoy dependencies")
        candidates = set()
        for dependency in dependencies:
            if not isinstance(dependency, dict):
                raise ValueError("invalid convoy dependency")
            if dependency.get("dependency_type", dependency.get("type")) == "tracks":
                target = dependency.get("id") or dependency.get("depends_on_id")
                if not isinstance(target, str) or not target:
                    raise ValueError("invalid tracks target")
                candidates.add(target)
        if not candidates:
            for step in [root] + steps:
                labels = step.get("labels") or []
                if not isinstance(labels, list) or not all(isinstance(label, str) for label in labels):
                    raise ValueError("invalid step labels")
                candidates.update(label[4:] for label in labels if label.startswith("for:"))
        if not candidates:
            match = LEGACY_CONVOY_TITLE.fullmatch(convoy.get("title", ""))
            if match:
                candidates.add(match[1])
        if len(candidates) != 1:
            raise ValueError("unresolvable/ambiguous work bead")
        work = candidates.pop()
        source = by_id.get(work)
        if (source is None or source.get("issue_type") not in ("task", "bug", "feature", "chore")
                or meta(source).get("gc.kind") or meta(source).get("gc.root_bead_id")
                or meta(source).get("gc.formula_name")):
            work = "-"
            raise ValueError("source is missing or is not real work")
        if root.get("status") not in ("open", "in_progress", "blocked", "deferred"):
            raise ValueError("unknown root status")
        # Root metadata writes must not refresh the liveness clock.
        newest = max([timestamp(root.get("created_at"))] +
                     [timestamp(step.get("updated_at")) for step in steps])
        hours = f"{max(0, (now - newest) / 3600):.3f}"
        if not sessions_valid:
            raise ValueError("session state unavailable")
        active = False
        for step in steps:
            sm = meta(step)
            holders = identities(step.get("assignee"))
            for key in ("gc.session_id", "gc.session_name"):
                holders |= identities(sm.get(key))
            if step.get("status") != "closed" and holders & live:
                active = True
            # Orphaned running claims are outside this repair's scope.
            if step.get("status") == "in_progress":
                active = True
            if step.get("status") not in ("open", "in_progress", "closed", "blocked", "deferred"):
                raise ValueError("unknown step status")
            if step.get("status") == "open" and not step.get("assignee") and not (sm.get("cc.parked_routed_to") and not sm.get("gc.routed_to")):
                dependencies = step.get("dependencies")
                if dependencies is None and step.get("dependency_count", 0):
                    raise ValueError("dependency details unavailable")
                if dependencies is not None and not isinstance(dependencies, list):
                    raise ValueError("invalid dependencies")
                blocked = False
                for dependency in dependencies or []:
                    if not isinstance(dependency, dict):
                        raise ValueError("invalid dependency")
                    if dependency.get("dependency_type", dependency.get("type", "blocks")) != "blocks":
                        continue
                    target = by_id.get(dependency.get("id") or dependency.get("depends_on_id"))
                    if target is None:
                        raise ValueError("missing dependency bead")
                    blocked |= target.get("status") != "closed"
                if not blocked:
                    active = True
        state = "live" if active or now - newest <= threshold * 3600 else "dead"
    except Exception as error:
        print(f"live-workflow-roots: {rid}: keeping root: {error}", file=sys.stderr)
    print(rid, state, hours, work)
PY
}

# Same arguments as lwr_root_state. Nonzero on invalid bead snapshots.
lwr_live_work_beads() {
  local rows
  rows="$(lwr_root_state "$@")" || return "$?"
  printf '%s\n' "$rows" | awk '$2 != "dead" && $4 != "-" {print $4}' | sort -u
}

# Read-only drain linkage: direct references or controls belonging to the parent.
# A shared work member alone is not evidence of a parent/child relationship.
lwr_drain_children() {
  python3 - "$@" <<'PYTHON'
import json
import sys
try:
    with open(sys.argv[1]) as stream:
        beads = json.load(stream)
    if not isinstance(beads, list) or not all(isinstance(b, dict) for b in beads):
        raise ValueError("expected bead array")
    by_id = {b["id"]: b for b in beads}
    if len(by_id) != len(beads):
        raise ValueError("duplicate ids")
    parent = sys.argv[2]
    if parent not in by_id:
        raise ValueError("missing parent")
    def meta(b):
        m = b.get("metadata") or {}
        if not isinstance(m, dict):
            raise ValueError("invalid metadata")
        return m
    for b in beads:
        meta(b)
    parents, children = {parent}, set()
    while True:
        controls = parents | {b["id"] for b in beads if meta(b).get("gc.root_bead_id") in parents}
        found = {b["id"] for b in beads
                 if b.get("status") != "closed" and meta(b).get("gc.kind") == "workflow"
                 and meta(b).get("gc.formula_name") == "do-work"
                 and (meta(b).get("gc.drain_control_id") in controls
                      or meta(b).get("gc.drain_member_id") in parents)} - parents
        if not found:
            break
        children |= found
        parents |= found
    for child in sorted(children):
        print(child)
except Exception as error:
    print(f"live-workflow-roots: invalid drain snapshot: {error}", file=sys.stderr)
    sys.exit(1)
PYTHON
}
