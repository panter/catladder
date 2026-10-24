#!/usr/bin/env python3
"""Preserve all shared stash commits before removing refs/stash.

Workaround for gastownhall/gascity#4492 (stash gate remains in v1.5.0).
Retire when the upstream reaper no longer treats repo-wide stashes as local.
"""
import argparse
import os
import subprocess


def git(*args, input=None):
    return subprocess.run(["git", *args], input=input, text=True,
                          check=True, capture_output=True).stdout.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="after approval, archive commits and remove the shared ref")
    args = parser.parse_args()
    git("rev-parse", "--git-common-dir")
    if not git("for-each-ref", "--format=%(objectname)", "refs/stash"):
        print("No shared stash ref; nothing to do.")
        return
    tip = git("rev-parse", "--verify", "refs/stash")
    commits = list(dict.fromkeys([tip] + git("reflog", "show", "--format=%H",
                                           "refs/stash").splitlines()))
    transaction = ["start"]
    for commit in commits:
        git("cat-file", "-e", commit + "^{commit}")
        ref = "refs/maw/stash-backups/" + commit
        existing = git("for-each-ref", "--format=%(objectname)", ref)
        if existing and existing != commit:
            raise RuntimeError("Backup ref collision: " + ref)
        transaction.append(("verify " + ref + " " + commit) if existing else
                           ("create " + ref + " " + commit))
        print("Preserve " + commit + " as " + ref)
    transaction += ["delete refs/stash " + tip, "prepare", "commit"]
    if not args.apply or os.environ.get("DRY_RUN") == "1":
        print("DRY_RUN: preserve %d commits; remove refs/stash only." % len(commits))
        return
    # One ref transaction: no stash ref can be removed unless every backup
    # succeeds and the observed tip is unchanged. Quiesce stash writers first.
    git("update-ref", "--stdin", input="\n".join(transaction) + "\n")
    print("Archived %d stash commits; removed shared refs/stash." % len(commits))


if __name__ == "__main__":
    main()
