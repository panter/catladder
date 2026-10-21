#!/usr/bin/env python3
"""Credit the requester on a city pull request (ADR 0007, option b). Deterministic, idempotent, no LLM.

  requester-pr.py --repo <owner/name> --pr <number> --bead <work-bead-id> --rig <rig dir>

Reads `requested_by` of the work bead (bd, in the rig), looks the person up in people.toml and:
  - appends to the PR description, once (marker <!-- requester -->): "Requested by @<github>" and the trailer
    "Co-authored-by: <name> <email>". With the repo setting "squash commit message = pull request description"
    (squash_merge_commit_message=PR_BODY) the trailer ends up in the squash commit on main, whoever merges;
  - requests a review from the requester through GitHub's review request, unless they authored the PR (GitHub
    refuses that) or already reviewed it.
No requester, or not in people.toml (maw 2026-10-21: "typically the creator, if that is clear, otherwise the PO"):
the review is requested from every person with the right `po_feedback` in people.toml; no credit block.
The city stays the commit author.
DRY_RUN=1 only prints. Publish steps and the merge train call it before merging.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import people as people_mod  # noqa: E402

GH = [sys.executable, str(Path(__file__).resolve().parents[1] /
      "packs/publish-gate/assets/scripts/city-github.py"), "gh"]
BD = os.environ.get("BD_BIN") or "/opt/homebrew/bin/bd"
DRY = os.environ.get("DRY_RUN", "0") == "1"
MARK = "<!-- requester -->"


def run(args, cwd=None):
    env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/bin:/bin")
    return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=60, check=True).stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", required=True)
    ap.add_argument("--bead", required=True)
    ap.add_argument("--rig", required=True)
    a = ap.parse_args()
    data = json.loads(run([BD, "show", a.bead, "--json"], cwd=a.rig) or "{}")
    bead = data[0] if isinstance(data, list) else data
    email = (bead.get("metadata") or {}).get("requested_by")
    person = people_mod.by_email(email) if email else None
    reviewers = [person["github"]] if person else [p["github"] for p in people_mod.load()[0]
                                                   if "po_feedback" in p.get("rights", [])]
    if not person:
        print(f"requester-pr: {a.bead} has no registered requester ({email or 'none'}); review from POs "
              f"{', '.join('@' + r for r in reviewers) or '(none)'}")
    if DRY:
        print(f"requester-pr: would verify/add {'requester credit and ' if person else ''}review for "
              f"{', '.join('@' + r for r in reviewers)}; no GitHub calls")
        return 0
    pr = json.loads(run([*GH, "pr", "view", a.pr, "--repo", a.repo, "--json", "body,author,reviewRequests,reviews"]))
    body = pr.get("body") or ""
    if person and MARK not in body:
        block = (f"\n\n{MARK}\nRequested by @{person['github']}\n\n"
                 f"Co-authored-by: {person['name']} <{person['email']}>\n")
        print(f"requester-pr: add requester block for @{person['github']} to {a.repo}#{a.pr}")
        if not DRY:
            run([*GH, "pr", "edit", a.pr, "--repo", a.repo, "--body", body.rstrip() + block])
    done = {r.get("login") for r in pr.get("reviewRequests") or []}
    done |= {(r.get("author") or {}).get("login") for r in pr.get("reviews") or []}
    author = (pr.get("author") or {}).get("login")
    for login in reviewers:
        if login and login not in done and login != author:
            print(f"requester-pr: request review from @{login}")
            run([*GH, "pr", "edit", a.pr, "--repo", a.repo, "--add-reviewer", login])
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.SubprocessError as exc:
        print(f"requester-pr: failed ({exc.__class__.__name__}); requester credit/review request incomplete", file=sys.stderr)
        sys.exit(1)
