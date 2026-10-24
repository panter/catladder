#!/usr/bin/env python3
"""Order requester-sync (ADR 0007): every open bead in every city names who asked for it.

Metadata `requested_by = <email>` on open beads of every rig in every registered city:
  - a bead a person created (created_by is not a city agent) gets its own `owner`;
  - any other bead inherits it, first match wins: the work bead named by its `for:<id>` label (workflow,
    decomposition and convoy beads, labelled by board-sync), its parent (`parent-child`), the bead it was
    discovered from (`discovered-from`), the workflow bead its gc metadata points at (a decomposed task's
    drain step, a drain convoy's control/parent convoy, a step's root), the bead a convoy names in its title
    ("input convoy for <id>", as board-sync reads it), or a convoy that tracks it.
Follow-ups an agent creates without `--deps discovered-from:<id>` have no link and stay without a requester;
the project AGENTS.md asks agents to link them.
Beads whose chain ends at an agent or nowhere stay without it. Never overwrites an existing value.
Work beads (not `gc-workflow`) of a person in people.toml also get the label `requester:<github>`.
Deterministic, no LLM, idempotent; at most MAX_WRITES updates per run (the first run backfills).
DRY_RUN=1 only prints. RIGS="<dir> <dir>" limits the run to these rig dirs (tests).
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib

sys.path.insert(0, str(Path(__file__).resolve().parent))
import people as people_mod  # noqa: E402

GC = os.environ.get("GC_BIN") or "/opt/homebrew/opt/gascity/bin/gc"
BD = os.environ.get("BD_BIN") or "/opt/homebrew/bin/bd"
CITIES_FILE = Path(os.environ.get("CITIES_FILE") or Path.home() / ".gc/cities.toml")
MAX_WRITES = int(os.environ.get("MAX_WRITES") or "300")
DRY = os.environ.get("DRY_RUN", "0") == "1"
ENV = {"HOME": str(Path.home()), "PATH": "/opt/homebrew/bin:/usr/bin:/bin"}
# City agents and tooling as bd records them: zc-wisp-x, gastown__polecat-mc-wisp-x, zue/core.control-dispatcher,
# order:zue-dispatch, controller, mayor, gastown.mayor (2026-10-13 inventory of all cities).
AGENT = re.compile(r"wisp|/|^order:|^gastown|__|^controller$|mayor|^null$|^$")
INHERIT_EDGES = ("parent-child", "discovered-from")  # this bead depends_on the source
# Gas City links decomposed tasks and drain convoys to their workflow through metadata, not dependencies:
# a task names its drain step (gc.exclusive_drain_reservation), a drain-unit convoy its drain step and parent
# convoy, a workflow step its root. Those workflow beads carry for:<work bead> (board-sync).
CONVOY_TITLE = re.compile(r"\b([a-z][a-z0-9]*-[a-z0-9]+(?:\.[0-9]+)*)\b")  # first bead id in a convoy title
INHERIT_METADATA = ("gc.root_bead_id", "gc.exclusive_drain_reservation", "gc.drain_control_id", "gc.parent_convoy_id")


def run(args, cwd=None, timeout=300):
    return subprocess.run(args, cwd=cwd, env=ENV, capture_output=True, text=True, timeout=timeout, check=True).stdout


def rigs():
    if os.environ.get("RIGS"):
        return [Path(p) for p in os.environ["RIGS"].split()]
    out, seen = [], set()
    for city in tomllib.loads(CITIES_FILE.read_text()).get("cities", []):
        try:
            data = json.loads(run([GC, "rig", "list", "--city", city["path"], "--json"], timeout=120))
        except (subprocess.SubprocessError, ValueError):
            print(f"WARN {city['name']}: rig list failed, skipped")
            continue
        for rig in data.get("rigs", []):
            p = rig.get("path")
            if p and p not in seen:
                seen.add(p)
                out.append(Path(p))
    return out


def human(bead):
    return bool(bead.get("owner")) and not AGENT.search(str(bead.get("created_by") or ""))


def plan(open_beads, fetch):
    """bead id -> requester email for open beads that lack one. fetch(ids) returns beads by id (any status)."""
    known = {b["id"]: b for b in open_beads}
    req = {i: (b.get("metadata") or {}).get("requested_by") for i, b in known.items()}

    def sources(b):
        for label in b.get("labels") or []:
            if label.startswith("for:"):
                yield label[4:]
        for d in b.get("dependencies") or []:
            if d.get("issue_id") == b["id"] and d.get("type") in INHERIT_EDGES:
                yield d.get("depends_on_id")
        if b.get("issue_type") == "convoy":  # "input convoy for zue-1yxff", "implementation convoy for zue-64ava"
            m = CONVOY_TITLE.search(b.get("title") or "")
            if m:
                yield m.group(1)
        for key in INHERIT_METADATA:
            if (b.get("metadata") or {}).get(key):
                yield b["metadata"][key]
        for d in tracked_by.get(b["id"], []):
            yield d

    tracked_by = {}
    for b in open_beads:
        for d in b.get("dependencies") or []:
            if d.get("type") == "tracks" and d.get("issue_id") == b["id"]:
                tracked_by.setdefault(d.get("depends_on_id"), []).append(b["id"])
    missing = {s for b in open_beads for s in sources(b) if s and s not in known}
    for _ in range(3):  # fetched sources can point further (drain step -> root -> work bead)
        new = fetch(sorted(missing))
        for b in new:
            known[b["id"]] = b
            req[b["id"]] = (b.get("metadata") or {}).get("requested_by") or (b.get("owner") if human(b) else None)
        missing = {s for b in new for s in sources(b) if s and s not in known}
        if not missing:
            break
    for i, b in known.items():  # resolve fetched (often closed) beads through their own sources too
        if not req.get(i):
            req[i] = next((req.get(s) for s in sources(b) if req.get(s)), None)
    for i, b in known.items():
        if not req.get(i) and human(b):
            req[i] = b["owner"]
    changed = True
    while changed:  # fixpoint over chains (convoy -> task -> follow-up)
        changed = False
        for b in open_beads:
            if req.get(b["id"]):
                continue
            for s in sources(b):
                if req.get(s):
                    req[b["id"]] = req[s]
                    changed = True
                    break
    return {b["id"]: req[b["id"]] for b in open_beads
            if req.get(b["id"]) and not (b.get("metadata") or {}).get("requested_by")}


def main():
    people, errors = people_mod.load()
    if errors:
        print("people.toml invalid: " + "; ".join(errors), file=sys.stderr)
        return 1
    budget, total = MAX_WRITES, 0
    for rig in rigs():
        try:
            open_beads = json.loads(run([BD, "list", "--json", "--limit", "0"], cwd=rig) or "[]")
        except (subprocess.SubprocessError, ValueError, OSError):
            print(f"WARN {rig}: bd list failed, skipped")
            continue

        def fetch(ids):
            out = []
            for i in range(0, len(ids), 50):
                try:
                    data = json.loads(run([BD, "show", *ids[i:i + 50], "--json"], cwd=rig) or "[]")
                except (subprocess.SubprocessError, ValueError):
                    continue
                out += data if isinstance(data, list) else [data]
            return out

        todo = plan(open_beads, fetch)
        by_id = {b["id"]: b for b in open_beads}
        print(f"{rig}: {len(todo)} of {len(open_beads)} open beads get requested_by")
        for bid, email in sorted(todo.items()):
            if budget <= 0:
                print("write budget used up; rest next run")
                return 0
            args = [BD, "update", bid, "--set-metadata", f"requested_by={email}"]
            person = people_mod.by_email(email, people)
            if person and "gc-workflow" not in (by_id[bid].get("labels") or []):
                args += ["--add-label", f"requester:{person['github']}"]
            if DRY:
                if total < 5:
                    print("DRY_RUN: " + " ".join(args[1:]))
            else:
                try:
                    run(args, cwd=rig, timeout=60)
                except subprocess.SubprocessError:
                    print(f"failed: {bid}")
                    continue
            budget -= 1
            total += 1
    print(f"{'DRY_RUN: would set' if DRY else 'set'} requested_by on {total} beads")
    return 0


if __name__ == "__main__":
    sys.exit(main())
