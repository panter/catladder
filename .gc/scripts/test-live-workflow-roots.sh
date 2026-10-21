#!/usr/bin/env bash
# Fixture checks for the #5607/#6791/#2903/#7197 workaround.
# Remove alongside live-workflow-roots.sh once the pinned GC repairs dead runs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/lib/live-workflow-roots.sh"
fixture_dir="$(mktemp -d)"
trap 'rm -rf "$fixture_dir"' EXIT
python3 - "$fixture_dir" <<'PY'
import json
import pathlib
import sys
p = pathlib.Path(sys.argv[1])
old = "2026-10-01T00:00:00Z"
recent = "2026-10-02T11:00:00Z"
base = [
    dict(id="work-1", issue_type="task", status="open"),
    dict(id="convoy-1", issue_type="convoy", title="input convoy for work-1"),
    dict(id="root-1", status="open", created_at=old, updated_at=recent,
         metadata={"gc.kind": "workflow", "gc.formula_name": "implement", "gc.input_convoy_id": "convoy-1"}),
    dict(id="step-1", status="closed", updated_at=old,
         metadata={"gc.root_bead_id": "root-1"}, labels=["for:work-1"]),
]
def save(name, data):
    (p / (name + ".json")).write_text(json.dumps(data))
def case(name, change):
    data = json.loads(json.dumps(base))
    change(data)
    save(name, data)
save("dead", base)
save("sessions", {"sessions": [{"id": "unused", "closed": True}]})
save("live", {"sessions": [{"id": "session-1", "name": "city/worker-2", "closed": False}]})
case("recent", lambda b: b[3].update(updated_at=recent))
case("holder", lambda b: b[3].update(status="open", assignee="worker-1"))
case("running", lambda b: b[3].update(status="in_progress", assignee="missing"))
case("claimable", lambda b: b[3].update(status="open", metadata={"gc.root_bead_id": "root-1", "gc.routed_to": "city/pool"}))
case("unresolved", lambda b: (b[3].update(labels=[]), b[1].update(title="other")))
case("fallback", lambda b: b[3].update(labels=[]))
case("badtime", lambda b: b[3].update(updated_at="invalid"))
case("closed", lambda b: b[2].update(status="closed"))
case("root-label", lambda b: (b[2].update(labels=["for:work-1"]), b[3].update(labels=[]), b[1].update(title="other")))
case("var-convoy", lambda b: (b[2].update(metadata={"gc.kind":"workflow", "gc.formula_name":"build-basic", "gc.var.convoy_id":"convoy-1"}), b[3].update(labels=[])))
case("wrong-formula", lambda b: b[2]["metadata"].update({"gc.formula_name":"review"}))
case("parked", lambda b: b[3].update(status="open", metadata={"gc.root_bead_id":"root-1", "cc.parked_routed_to":"pool"}))
case("no-route", lambda b: b[3].update(status="open"))
case("duplicate", lambda b: b.append(b[0].copy()))
case("no-zone", lambda b: b[3].update(updated_at="2026-10-01T00:00:00"))
case("workflow-source", lambda b: b[0].update(metadata={"gc.kind": "workflow"}))
case("blocked", lambda b: b[3].update(status="open", metadata={"gc.root_bead_id": "root-1", "gc.routed_to": "pool"}, dependencies=[{"id": "work-1", "dependency_type": "blocks"}]))
case("raw-blocked", lambda b: b[3].update(status="open", metadata={"gc.root_bead_id": "root-1", "gc.routed_to": "pool"}, dependencies=[{"depends_on_id": "work-1", "type": "blocks"}, {"depends_on_id": "missing", "type": "tracks"}]))
case("raw-claimable", lambda b: (b[0].update(status="closed"), b[3].update(status="open", metadata={"gc.root_bead_id": "root-1", "gc.routed_to": "pool"}, dependencies=[{"depends_on_id": "work-1", "type": "blocks"}])))
case("raw-missing", lambda b: b[3].update(status="open", metadata={"gc.root_bead_id": "root-1", "gc.routed_to": "pool"}, dependencies=[{"depends_on_id": "missing", "type": "blocks"}]))
case("children", lambda b: b.extend([
    dict(id="control", metadata={"gc.root_bead_id":"root-1"}),
    dict(id="child-1", status="open", metadata={"gc.kind":"workflow", "gc.formula_name":"do-work", "gc.drain_control_id":"control"}),
    dict(id="child-2", status="open", metadata={"gc.kind":"workflow", "gc.formula_name":"do-work", "gc.drain_member_id":"root-1"}),
    dict(id="foreign", status="open", metadata={"gc.kind":"workflow", "gc.formula_name":"do-work", "gc.drain_control_id":"elsewhere", "gc.drain_member_id":"work-1"}),
]))
(p / "invalid.json").write_text("not json")
save("empty", {"sessions": []})
PY
# 2026-10-02T12:00:00Z, six-hour threshold.
check() {
  local actual
  actual="$(lwr_root_state "$fixture_dir/$1.json" "$fixture_dir/${3:-sessions}.json" 1790942400 6)"
  if [ "$actual" != "$2" ]; then
    echo "FAIL $1: expected '$2', got '$actual'" >&2
    exit 1
  fi
}
check dead 'root-1 dead 36.000 work-1'
check recent 'root-1 live 1.000 work-1'
check holder 'root-1 live 36.000 work-1' live
check running 'root-1 live 36.000 work-1'
check claimable 'root-1 live 36.000 work-1'
check blocked 'root-1 dead 36.000 work-1'
check raw-blocked 'root-1 dead 36.000 work-1'
check raw-claimable 'root-1 live 36.000 work-1'
check raw-missing 'root-1 unknown 36.000 work-1'
check dead 'root-1 unknown 36.000 work-1' invalid
check dead 'root-1 unknown 36.000 work-1' empty
check unresolved 'root-1 unknown - -'
check fallback 'root-1 dead 36.000 work-1'
check badtime 'root-1 unknown - work-1'
check closed ''
check workflow-source 'root-1 unknown - -'
check root-label 'root-1 dead 36.000 work-1'
check var-convoy 'root-1 dead 36.000 work-1'
check wrong-formula ''
check parked 'root-1 dead 36.000 work-1'
check no-route 'root-1 live 36.000 work-1'
check no-zone 'root-1 unknown - work-1'
[ "$(lwr_drain_children "$fixture_dir/children.json" root-1)" = $'child-1\nchild-2' ]
if lwr_root_state "$fixture_dir/duplicate.json" "$fixture_dir/sessions.json" 1790942400 6; then
  echo 'FAIL: duplicate ids accepted' >&2; exit 1
fi
[ -z "$(lwr_live_work_beads "$fixture_dir/dead.json" "$fixture_dir/sessions.json" 1790942400 6)" ]
[ "$(lwr_live_work_beads "$fixture_dir/recent.json" "$fixture_dir/sessions.json" 1790942400 6)" = work-1 ]
[ "$(lwr_live_work_beads "$fixture_dir/dead.json" "$fixture_dir/invalid.json" 1790942400 6)" = work-1 ]
if lwr_root_state "$fixture_dir/invalid.json" "$fixture_dir/sessions.json" 1790942400 6; then
  echo 'FAIL: invalid bead JSON accepted' >&2; exit 1
fi
# Run the actual dispatcher in DRY_RUN with isolated readers. A dead root must
# free both global capacity and the per-rig work set; unknown must retain both.
mkdir -p "$fixture_dir/rig/.beads"
git init -q "$fixture_dir/rig"
git -C "$fixture_dir/rig" remote add origin https://github.com/fixture/rig.git
printf '#!/bin/sh\necho "[]"\n' > "$fixture_dir/gh"
chmod +x "$fixture_dir/gh"
python3 - "$fixture_dir" <<'PYTHON'
import json
import pathlib
import sys
p = pathlib.Path(sys.argv[1])
for name in ("dead", "recent"):
    data = json.loads((p / (name + ".json")).read_text())
    data[0].update(priority=0, title="Work", created_by="human")
    if name == "recent":
        from datetime import datetime, timezone
        data[3]["updated_at"] = datetime.now(timezone.utc).isoformat()
    (p / ("dispatch-" + name + ".json")).write_text(json.dumps(data))
(p / "bd").write_text("#!/usr/bin/env python3\nimport json, pathlib, sys\np=pathlib.Path(" + repr(str(p)) + ")\ndata=json.loads((p/'dispatch.json').read_text())\nprint(json.dumps(data if sys.argv[1]=='list' else [data[0]]))\n")
(p / "gc").write_text("#!/bin/bash\nif [ \"$1\" = session ]; then cat " + repr(str(p / "dispatch-sessions.json")) + "; elif [ \"$1\" != rig ]; then exit 99; fi\n")
(p / "bd").chmod(0o755)
(p / "gc").chmod(0o755)
PYTHON
cp "$fixture_dir/dispatch-dead.json" "$fixture_dir/dispatch.json"
cp "$fixture_dir/sessions.json" "$fixture_dir/dispatch-sessions.json"
dispatch() {
  PATH="$fixture_dir:$PATH" DRY_RUN=1 GC="$fixture_dir/gc" BD_BIN="$fixture_dir/bd" \
    RIGS="fixture=$fixture_dir/rig" STATE="$fixture_dir/no-state/state" \
    GOVERNOR="$fixture_dir/no-governor" MAX_RUNNING=1 \
    bash "$ROOT/scripts/city-dispatch.sh"
}
output="$(dispatch)"
[[ "$output" == *'ignore dead root root-1'* && "$output" == *'running: 0/1'* && "$output" == *'would sling fixture work-1'* ]]
[ ! -e "$fixture_dir/no-state" ]
cp "$fixture_dir/dispatch-recent.json" "$fixture_dir/dispatch.json"
output="$(dispatch)"
[[ "$output" == *'running: 1/1'* && "$output" != *'would sling'* ]]
cp "$fixture_dir/dispatch-dead.json" "$fixture_dir/dispatch.json"
cp "$fixture_dir/invalid.json" "$fixture_dir/dispatch-sessions.json"
output="$(dispatch)"
[[ "$output" == *'running: 1/1'* && "$output" != *'would sling'* ]]
echo 'OK: live workflow root and dispatcher fixtures passed'
