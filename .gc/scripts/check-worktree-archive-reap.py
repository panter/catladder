#!/usr/bin/env python3
"""Isolated test for worktree-archive-reap.py: throwaway git repo, fixture bead list, no real stores."""
import json, subprocess, sys, tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "worktree-archive-reap.py"


def sh(*a, cwd=None):
    return subprocess.run(a, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


with tempfile.TemporaryDirectory() as tmp:
    repo = Path(tmp) / "rig"
    repo.mkdir()
    sh("git", "init", "-q", "-b", "main", cwd=repo)
    sh("git", "config", "user.email", "t@t", cwd=repo); sh("git", "config", "user.name", "t", cwd=repo)
    (repo / ".gitignore").write_text("node_modules/\n")
    sh("git", "add", ".", cwd=repo); sh("git", "commit", "-qm", "init", cwd=repo)
    beads = []
    def wt(bead, status="closed", closed="2026-10-01T00:00:00Z", labels=(), work=None):
        path = repo / "worktrees" / bead
        sh("git", "worktree", "add", "-q", "--detach", str(path), "HEAD", cwd=repo)
        (path / "f.txt").write_text(bead)
        sh("git", "add", "f.txt", cwd=path); sh("git", "commit", "-qm", bead, cwd=path)
        beads.append({"id": bead, "status": status, "closed_at": closed, "labels": list(labels)})
        return path
    old = wt("t-old")
    (old / "node_modules").mkdir(); (old / "node_modules" / "x.js").write_text("x")   # ignored: still removable
    head_old = sh("git", "rev-parse", "HEAD", cwd=old)
    dirty = wt("t-dirty"); (dirty / "new.txt").write_text("untracked")
    wt("t-recent", closed="2026-10-11T23:00:00Z")
    wt("t-open", status="open")
    wt("t-pub")
    beads.append({"id": "t-step", "status": "open", "labels": ["gc-workflow", "for:t-pub"]})
    wt("t-run", labels=["running"])
    used = wt("t-used")
    beads.append({"id": "t-anchor", "status": "open", "labels": [], "metadata": {"work_dir": str(used)}})
    wt("t-salv")
    beads.append({"id": "t-salvage", "status": "open", "labels": [],
                  "description": "Recover code from /x/rig/worktrees/t-salv before cleanup"})
    fixture = Path(tmp) / "beads.json"; fixture.write_text(json.dumps(beads))
    base = [sys.executable, str(SCRIPT), "--repo", str(repo), "--beads-json", str(fixture),
            "--now", "2026-10-12T08:00:00+00:00", "--no-cwd-scan", "-v"]
    dry = sh(*base)
    assert "WOULD_REMOVE test t-old" in dry, dry
    for keep, why in [("t-dirty", "untracked"), ("t-recent", "closed only"), ("t-open", "bead open"),
                      ("t-pub", "open workflow"), ("t-run", "running"), ("t-used", "work_dir"), ("t-salv", "mentions")]:
        assert f"SKIP test {keep}: " in dry and why in dry.split(f"SKIP test {keep}: ")[1].splitlines()[0], (keep, dry)
    assert (old).is_dir(), "dry run must not remove"
    out = sh(*base, "--apply")
    assert "REMOVED test t-old" in out and not old.exists(), out
    assert sh("git", "rev-parse", "refs/archive/worktrees/t-old", cwd=repo) == head_old
    assert dirty.is_dir() and (repo / "worktrees/t-pub").is_dir()
    again = sh(*base, "--apply")
    assert "REMOVED" not in again, again       # idempotent
    assert "REMOVED" not in sh(*base, "--apply", "--max", "0")
print("OK: worktree-archive-reap gates, archive ref, ignored files, idempotency")
