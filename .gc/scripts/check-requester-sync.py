#!/usr/bin/env python3
"""Isolated test for requester-sync.py (ADR 0007): throwaway bd workspace, fake people register. No real stores."""
import json, os, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts/requester-sync.py"
ENV = {"HOME": os.environ["HOME"], "PATH": "/opt/homebrew/bin:/usr/bin:/bin"}
fails = []


def sh(*a, cwd=None, env=None):
    r = subprocess.run(a, cwd=cwd, env=dict(ENV, **(env or {})), capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"FAIL requester-sync setup: {' '.join(map(str, a))}\n{r.stdout}{r.stderr}")
    return r.stdout


def expect(cond, msg):
    if not cond:
        fails.append(msg)


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    rig = tmp / "rig"
    rig.mkdir()
    sh("git", "init", "-q", "-b", "main", cwd=rig)
    sh("git", "config", "user.email", "alice@example.ch", cwd=rig)
    sh("git", "config", "user.name", "Alice", cwd=rig)
    sh("bd", "init", "--prefix", "rq", "--skip-agents", "--skip-hooks", "--non-interactive", cwd=rig)

    def create(title, actor, *extra):
        return sh("bd", "--actor", actor, "create", "--silent", title, *extra, cwd=rig).strip().splitlines()[-1]

    h = create("human work", "Alice")
    w = create("workflow step", "zc-wisp-abc", "--labels", f"gc-workflow,for:{h}")
    t = create("decomposed task", "zue/core.control-dispatcher", "--metadata",
               json.dumps({"gc.exclusive_drain_reservation": w}))
    k = create("child", "zc-wisp-def", "--parent", h)
    f = create("follow-up", "zc-wisp-ghi", "--deps", f"discovered-from:{k}")
    o = create("orphan follow-up", "zc-wisp-jkl")
    keep = create("already set", "zc-wisp-mno", "--metadata", json.dumps({"requested_by": "bob@example.ch"}))
    people = tmp / "people.toml"
    people.write_text('[[people]]\nemail = "alice@example.ch"\nname = "Alice"\ngithub = "alice-gh"\n'
                      'claude_account = "x"\nrights = []\n')
    env = {"RIGS": str(rig), "PEOPLE_FILE": str(people)}

    def meta(bid):
        d = json.loads(sh("bd", "show", bid, "--json", cwd=rig))
        d = d[0] if isinstance(d, list) else d
        return (d.get("metadata") or {}).get("requested_by"), d.get("labels") or []

    r = subprocess.run([sys.executable, "-I", str(SCRIPT)], env=dict(ENV, DRY_RUN="1", **env), capture_output=True, text=True)
    expect(r.returncode == 0 and "would set requested_by on 5 beads" in r.stdout, f"dry run: {r.stdout}{r.stderr}")
    expect(meta(h)[0] is None, "dry run wrote")
    r = subprocess.run([sys.executable, "-I", str(SCRIPT)], env=dict(ENV, MAX_WRITES="2", **env), capture_output=True, text=True)
    expect(r.returncode == 0 and "budget used up" in r.stdout, f"write budget: {r.stdout}{r.stderr}")
    r = subprocess.run([sys.executable, "-I", str(SCRIPT)], env=dict(ENV, **env), capture_output=True, text=True)
    expect(r.returncode == 0, f"apply: {r.stdout}{r.stderr}")
    for name, bid in (("human", h), ("workflow step (for:)", w), ("decomposed task (drain metadata)", t),
                      ("child (parent-child)", k), ("follow-up (discovered-from)", f)):
        expect(meta(bid)[0] == "alice@example.ch", f"{name} has requested_by={meta(bid)[0]!r}")
    expect("requester:alice-gh" in meta(h)[1], "work bead lacks requester label")
    expect(not any(l.startswith("requester:") for l in meta(w)[1]), "workflow bead got a requester label")
    expect(meta(o)[0] is None, "orphan agent bead got a requester")
    expect(meta(keep)[0] == "bob@example.ch", "existing requested_by was overwritten")
    r = subprocess.run([sys.executable, "-I", str(SCRIPT)], env=dict(ENV, **env), capture_output=True, text=True)
    expect("set requested_by on 0 beads" in r.stdout, f"not idempotent: {r.stdout}")

    # requester-pr.py: credit block + review request through a fake gh that logs its calls.
    log, view = tmp / "gh.log", tmp / "view.json"
    gh = tmp / "gh"
    gh.write_text(f"#!/bin/sh\necho \"$@\" >> {log}\n[ \"$2\" = view ] && cat {view}\nexit 0\n")
    gh.chmod(0o755)
    pr_env = dict(ENV, GH_BIN=str(gh), PEOPLE_FILE=str(people))
    prargs = [sys.executable, "-I", str(ROOT / "scripts/requester-pr.py"), "--repo", "panter/fixture", "--pr", "7", "--rig", str(rig)]
    view.write_text(json.dumps({"body": "Summary.", "author": {"login": "city-bot"}, "reviewRequests": []}))
    r = subprocess.run(prargs + ["--bead", t], env=pr_env, capture_output=True, text=True)
    calls = log.read_text() if log.exists() else ""
    expect(r.returncode == 0 and "Co-authored-by: Alice <alice@example.ch>" in calls and "<!-- requester -->" in calls,
           f"requester-pr body: {r.stdout}{r.stderr}{calls}")
    expect("--add-reviewer alice-gh" in calls, f"requester-pr review request: {calls}")
    # The requester helper must preserve credit and request human review under App auth too.
    gh.write_text(f"#!/bin/sh\n[ \"$GH_TOKEN\" = requester-fixture-token ] || exit 99\necho \"$@\" >> {log}\n[ \"$2\" = view ] && cat {view}\nexit 0\n")
    bot_env = dict(pr_env, CITY_GH_TOKEN_CMD="printf requester-fixture-token")
    r = subprocess.run(prargs + ["--bead", t], env=bot_env, capture_output=True, text=True)
    expect(r.returncode == 0, f"requester-pr App auth failed: {r.stdout}{r.stderr}")
    expect("requester-fixture-token" not in log.read_text(), "requester token leaked to args")
    # Dry-run cannot mint or contact GitHub.
    log.unlink()
    r = subprocess.run(prargs + ["--bead", t], env=dict(bot_env, DRY_RUN="1", CITY_GH_TOKEN_CMD="exit 99"),
                       capture_output=True, text=True)
    expect(r.returncode == 0 and not log.exists(), f"requester-pr dry-run had effects: {r.stdout}{r.stderr}")
    pr_env = bot_env
    view.write_text(json.dumps({"body": "Summary.\n<!-- requester -->", "author": {"login": "alice-gh"}, "reviewRequests": []}))
    subprocess.run(prargs + ["--bead", t], env=pr_env, capture_output=True, text=True)
    calls = log.read_text() if log.exists() else ""
    expect("edit" not in calls, f"requester-pr not idempotent / reviewed own PR: {calls}")
    # No registered requester: no credit block, review from the POs (people.toml right po_feedback), maw 2026-10-21.
    r = subprocess.run(prargs + ["--bead", o], env=pr_env, capture_output=True, text=True)
    expect(r.returncode == 0 and "review from POs (none)" in r.stdout and "edit" not in (log.read_text() if log.exists() else ""),
           f"requester-pr without requester and without POs: {r.stdout}{r.stderr}")
    people.write_text(people.read_text() + '[[people]]\nemail = "po@example.ch"\nname = "Po"\ngithub = "po-gh"\n'
                      'claude_account = "x"\nrights = ["po_feedback"]\n')
    view.write_text(json.dumps({"body": "Summary.", "author": {"login": "app/colab-city"}, "reviewRequests": [],
                                "reviews": []}))
    r = subprocess.run(prargs + ["--bead", o], env=pr_env, capture_output=True, text=True)
    calls = log.read_text() if log.exists() else ""
    expect(r.returncode == 0 and "--add-reviewer po-gh" in calls and "--body" not in calls,
           f"requester-pr PO fallback: {r.stdout}{r.stderr}{calls}")
    # Already reviewed by the requester: GitHub drops the request after a review; never request it again.
    log.unlink()
    view.write_text(json.dumps({"body": "Summary.\n<!-- requester -->", "author": {"login": "app/colab-city"},
                                "reviewRequests": [], "reviews": [{"author": {"login": "alice-gh"}}]}))
    subprocess.run(prargs + ["--bead", t], env=pr_env, capture_output=True, text=True)
    calls = log.read_text() if log.exists() else ""
    expect("--add-reviewer" not in calls, f"requester-pr re-requested a finished review: {calls}")

if fails:
    print("FAIL requester-sync:\n  " + "\n  ".join(fails))
    sys.exit(1)
print("OK requester-sync (human owner, for:, drain metadata, parent, discovered-from, orphan, no overwrite, budget, idempotent; requester-pr credit + review request, PO fallback, no re-request after review)")
