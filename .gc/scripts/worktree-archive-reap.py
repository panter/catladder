#!/usr/bin/env python3
"""Remove per-bead worktrees of closed beads in all registered cities, after archiving their HEAD.

Why: gc's auto_reap_closed_bead_worktrees only removes worktrees whose commits are on a remote branch.
gascity workflows create detached worktrees and the project repos squash-merge, so almost nothing qualified:
by 2026-10-12 zue had 140 worktrees (~140 GB). Workaround until native reaping handles squash merges /
detached item worktrees (gascity #5760, #6718; lifecycle RFC gascity-packs #209).

Gates per worktree <rig>/worktrees/<bead-id> (all must hold, otherwise SKIP with a reason):
  - the directory names a bead of that rig which is closed for at least --min-age-hours
  - no open bead carries `for:<bead-id>` (an outer workflow may still publish from it), the bead has no
    `running` label, no open bead points `work_dir` at this path or mentions `worktrees/<bead-id>` in its
    text (salvage beads)
  - registered, not locked, no untracked or modified files (`git worktree remove` without --force)
  - no process has its cwd inside it (lsof scan; an incomplete scan aborts all removals)
Before removal HEAD is stored as refs/archive/worktrees/<bead-id> (or <bead-id>-<sha12> if taken), so no
commit is lost: `git worktree add <path> refs/archive/worktrees/<bead-id>` restores it.
DRY_RUN=1 (or no --apply) only prints. Idempotent; at most --max removals per run.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib

CLEAN_ENV = {"HOME": os.environ.get("HOME", ""),
             "PATH": "/opt/homebrew/bin:/usr/bin:/bin:" + os.path.expanduser("~/.local/bin")}
BEAD_RE = re.compile(r"[a-z][a-z0-9]*-[a-zA-Z0-9]+(?:\.[0-9]+)*")


def run(args, cwd=None, timeout=60):
    return subprocess.run(args, cwd=cwd, env=CLEAN_ENV, text=True, capture_output=True,
                          timeout=timeout, check=True).stdout


def git(repo, *args, timeout=60):
    return run(["git", "-C", str(repo), *args], timeout=timeout)


def rigs():
    reg = tomllib.load(open(os.path.expanduser("~/.gc/cities.toml"), "rb"))
    seen = set()
    for city in reg.get("cities", []):
        try:
            data = json.loads(run(["/opt/homebrew/opt/gascity/bin/gc", "rig", "list", "--city", city["path"],
                                   "--json"], timeout=120))
        except (subprocess.SubprocessError, ValueError):
            print(f"WARN {city['name']}: rig list failed, skipped")
            continue
        for rig in data.get("rigs", []):
            path = rig.get("path") or ""
            if rig.get("hq") or not path or path in seen or not (Path(path) / "worktrees").is_dir():
                continue
            seen.add(path)
            yield city["name"], Path(path)


def load_beads(rig, beads_json=None):
    if beads_json:
        return json.load(open(beads_json))
    return json.loads(run(["/opt/homebrew/bin/bd", "list", "--all", "--json", "--limit", "0"], cwd=rig, timeout=240))


def worktrees(repo):
    out = []
    for block in git(repo, "worktree", "list", "--porcelain").split("\n\n"):
        rec = dict(line.split(" ", 1) if " " in line else (line, "") for line in block.splitlines() if line)
        if rec.get("worktree"):
            out.append(rec)
    return out


def blockers(beads, now, min_age_h):
    """bead id -> reason it must be kept (or None when closed long enough and unused)."""
    by_id = {b.get("id"): b for b in beads}
    active_for, active_dirs, mentioned = set(), set(), set()
    for b in beads:
        if b.get("status") == "closed":
            continue
        for label in b.get("labels") or []:
            if label.startswith("for:"):
                active_for.add(label[4:])
        wd = (b.get("metadata") or {}).get("work_dir")
        if wd:
            active_dirs.add(str(Path(wd).resolve()))
        # Salvage/follow-up beads name the worktree they still need in their text (evermore 2026-10-12).
        text = (b.get("description") or "") + (b.get("notes") or "") + json.dumps(b.get("metadata") or {})
        mentioned.update(re.findall(r"worktrees/([a-zA-Z0-9.-]+)", text))

    def reason(bead_id, path):
        b = by_id.get(bead_id)
        if not b:
            return "no such bead in this rig"
        if b.get("status") != "closed":
            return f"bead {b.get('status')}"
        closed = b.get("closed_at") or b.get("updated_at") or ""
        try:
            age_h = (now - dt.datetime.fromisoformat(closed.replace("Z", "+00:00"))).total_seconds() / 3600
        except ValueError:
            return "unknown close time"
        if age_h < min_age_h:
            return f"closed only {age_h:.1f} h ago"
        if bead_id in active_for:
            return "an open workflow still belongs to it"
        if "running" in (b.get("labels") or []):
            return "labelled running"
        if str(path.resolve()) in active_dirs:
            return "an open bead uses it as work_dir"
        if bead_id in mentioned:
            return "an open bead mentions this worktree"
        return None
    return reason


def cwd_scan():
    probe = subprocess.run(["lsof", "-a", "-u", str(os.getuid()), "-d", "cwd", "-Fn"],
                           capture_output=True, text=True, timeout=120)
    if probe.returncode not in (0, 1):
        raise RuntimeError("process cwd scan failed")
    return [Path(line[1:]) for line in probe.stdout.splitlines() if line.startswith("n/")]


def archive_ref(repo, bead_id, sha):
    ref = f"refs/archive/worktrees/{bead_id}"
    existing = subprocess.run(["git", "-C", str(repo), "rev-parse", "-q", "--verify", ref],
                              env=CLEAN_ENV, capture_output=True, text=True).stdout.strip()
    if existing and existing != sha:
        ref = f"{ref}-{sha[:12]}"
    git(repo, "update-ref", ref, sha)
    return ref


def process(city, repo, beads, now, args, cwds, budget):
    reason_for = blockers(beads, now, args.min_age_hours)
    root = (repo / "worktrees").resolve()
    removed = 0
    for rec in worktrees(repo):
        path = Path(rec["worktree"])
        if path.parent.resolve() != root:
            continue
        bead_id = path.name
        if not BEAD_RE.fullmatch(bead_id):
            continue
        why = reason_for(bead_id, path)
        if not why and ("locked" in rec or "prunable" in rec):
            why = "locked or prunable"
        if not why:
            try:
                if git(path, "status", "--porcelain", "--untracked-files=normal", timeout=120).strip():
                    why = "uncommitted or untracked changes"
            except subprocess.SubprocessError:
                why = "git status failed"
        if not why and cwds is not None and any(c == path or path in c.parents for c in cwds):
            why = "a process works in it"
        if why:
            if args.verbose:
                print(f"SKIP {city} {bead_id}: {why}")
            continue
        if removed >= budget:
            print(f"LIMIT {city}: --max reached, rest next run")
            break
        sha = rec.get("HEAD", "")
        if not args.apply:
            print(f"WOULD_REMOVE {city} {bead_id} (archive {sha[:12]} as refs/archive/worktrees/{bead_id})")
            removed += 1
            continue
        try:
            ref = archive_ref(repo, bead_id, sha)
            git(repo, "worktree", "remove", str(path), timeout=1800)
            print(f"REMOVED {city} {bead_id} (HEAD {sha[:12]} kept as {ref})")
            removed += 1
        except subprocess.SubprocessError as error:
            print(f"WARN {city} {bead_id}: removal failed ({getattr(error, 'stderr', '') or error})".strip())
    return removed


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--apply", action="store_true", help="really archive and remove (default: dry run)")
    p.add_argument("--max", type=int, default=10, help="removals per run across all rigs")
    p.add_argument("--min-age-hours", type=float, default=24)
    p.add_argument("--repo", type=Path, help="only this rig (tests); default: all registered cities")
    p.add_argument("--beads-json", help="bead list fixture for --repo (tests)")
    p.add_argument("--now", help="ISO time (tests)")
    p.add_argument("--no-cwd-scan", action="store_true", help="tests only")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()
    if os.environ.get("DRY_RUN") == "1":
        args.apply = False
    now = dt.datetime.fromisoformat(args.now) if args.now else dt.datetime.now(dt.timezone.utc)
    cwds = None
    if args.apply and not args.no_cwd_scan:
        try:
            cwds = cwd_scan()
        except (RuntimeError, subprocess.SubprocessError) as error:
            print(f"WARN no removals: {error}")
            return 0
    targets = [("test", args.repo)] if args.repo else list(rigs())
    budget = args.max
    for city, repo in targets:
        if budget <= 0:
            break
        try:
            beads = load_beads(repo, args.beads_json)
        except (subprocess.SubprocessError, ValueError) as error:
            print(f"WARN {city} {repo}: bead list failed ({error}), skipped")
            continue
        budget -= process(city, repo, beads, now, args, cwds, budget)
    return 0


if __name__ == "__main__":
    sys.exit(main())
