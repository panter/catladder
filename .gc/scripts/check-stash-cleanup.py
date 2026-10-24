#!/usr/bin/env python3
"""Exercise shared stash preservation using throwaway repositories only."""
import os
from pathlib import Path
import subprocess
import tempfile

SCRIPT = Path(__file__).with_name("stash-cleanup.py").resolve()


def run(cwd, *args, env=None):
    return subprocess.run(args, cwd=cwd, env=env, text=True, check=True,
                          capture_output=True).stdout.strip()


with tempfile.TemporaryDirectory(prefix="city-stash-check-") as tmp:
    repo = Path(tmp) / "repo"
    run(tmp, "git", "init", "-q", str(repo))
    run(repo, "git", "config", "user.email", "test@example.invalid")
    run(repo, "git", "config", "user.name", "Stash check")
    (repo / "tracked").write_text("base\n")
    run(repo, "git", "add", "tracked")
    run(repo, "git", "commit", "-qm", "base")
    other = Path(tmp) / "other"
    run(repo, "git", "worktree", "add", "-qb", "other", str(other))
    for index in range(2):
        (repo / "tracked").write_text("stash %d\n" % index)
        (repo / "untracked").write_text("untracked %d\n" % index)
        run(repo, "git", "stash", "push", "-qu", "-m", "test")
    commits = run(repo, "git", "reflog", "show", "--format=%H", "refs/stash").splitlines()
    assert len(commits) == 2
    assert run(repo, "git", "stash", "list", "--format=%H") == run(other, "git", "stash", "list", "--format=%H")
    before = run(repo, "git", "show-ref")
    run(other, "python3", str(SCRIPT))
    dry_env = dict(os.environ, DRY_RUN="1")
    run(other, "python3", str(SCRIPT), "--apply", env=dry_env)
    assert run(repo, "git", "show-ref") == before, "dry-run changed refs"
    # A mismatched backup must fail without clearing any stash.
    ref = "refs/maw/stash-backups/" + commits[0]
    head = run(repo, "git", "rev-parse", "HEAD")
    run(repo, "git", "update-ref", ref, head)
    apply_env = dict(os.environ, DRY_RUN="0")
    failed = subprocess.run(["python3", str(SCRIPT), "--apply"], cwd=other,
                            env=apply_env, capture_output=True)
    assert failed.returncode != 0
    assert run(repo, "git", "stash", "list", "--format=%H").splitlines() == commits
    run(repo, "git", "update-ref", "-d", ref)
    run(other, "python3", str(SCRIPT), "--apply", env=apply_env)
    assert not run(repo, "git", "stash", "list")
    assert not run(other, "git", "stash", "list")
    for index, commit in enumerate(commits):
        backup = "refs/maw/stash-backups/" + commit
        assert run(repo, "git", "rev-parse", backup) == commit
        assert run(repo, "git", "show", backup + ":tracked") == "stash %d" % (1 - index)
        assert run(repo, "git", "show", backup + "^3:untracked") == "untracked %d" % (1 - index)
    before = run(repo, "git", "show-ref")
    run(repo, "python3", str(SCRIPT), "--apply", env=apply_env)
    assert run(repo, "git", "show-ref") == before, "repeat changed refs"
    run(repo, "git", "stash", "apply", "--index", "refs/maw/stash-backups/" + commits[0])
    assert (repo / "tracked").read_text() == "stash 1\n"
    assert (repo / "untracked").read_text() == "untracked 1\n"
print("PASS: shared refs, dry-run, collision refusal, full stash recovery, idempotency")
