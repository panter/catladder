#!/usr/bin/env python3
"""Select real source beads delivered by merged PRs from read-only snapshots."""
import json
import re
import sys


def matches(bead_id, pr):
    # Branches commonly append a description (dash-d7f4-wp1-foundation).
    # Dotted child IDs and longer alphanumeric IDs must not match their parent.
    pattern = rf"(?<![A-Za-z0-9.]){re.escape(bead_id)}(?![A-Za-z0-9.])"
    return any(re.search(pattern, pr[key]) for key in ("title", "headRefName"))


def candidates(beads, merged, opened):
    for records in (beads, merged, opened):
        if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
            raise ValueError("expected arrays of objects")
    for pr in merged + opened:
        if (type(pr.get("number")) is not int or pr["number"] <= 0
                or not all(isinstance(pr.get(k), str) for k in ("title", "headRefName"))):
            raise ValueError("invalid PR snapshot")
    if any(not pr.get("mergedAt") for pr in merged):
        raise ValueError("merged PR without merge evidence")
    selected = []
    for bead in beads:
        bead_id = bead.get("id", "")
        metadata = bead.get("metadata") or {}
        labels = bead.get("labels") or []
        if (not isinstance(metadata, dict) or not isinstance(labels, list)
                or not isinstance(bead_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", bead_id)):
            raise ValueError("invalid bead snapshot")
        if bead.get("status") not in ("open", "in_progress", "blocked", "deferred"):
            continue
        if bead.get("issue_type") not in ("task", "bug", "feature", "chore"):
            continue
        if any(k in metadata for k in ("gc.root_bead_id", "gc.formula_name", "gc.kind",
                                       "gc.step_id", "gc.formula_contract", "gc.synthetic", "gc.synthetic_kind")):
            continue
        if any(label in labels for label in ("human", "idee", "review", "warrant", "needs-triage")):
            continue
        if re.match(r"^(mol-|sling-|input convoy for |drain unit |Mensch:|Digest:|Code-Review:)", bead.get("title", "")):
            continue
        # An older merged PR is not delivery evidence for a new open PR.
        if any(matches(bead_id, pr) for pr in opened):
            continue
        delivered = [pr for pr in merged if matches(bead_id, pr)]
        if delivered:
            pr = max(delivered, key=lambda pr: (pr["mergedAt"], pr["number"]))
            selected.append((bead_id, pr["number"]))
    return selected


if __name__ == "__main__":
    try:
        snapshots = [json.loads(open(path).read()) for path in sys.argv[1:]]
        if len(snapshots) != 3:
            raise ValueError("expected beads, merged PRs and open PRs")
        rows = candidates(*snapshots)
    except (ValueError, OSError, TypeError) as error:
        print(f"merged-pr-beads: {error}", file=sys.stderr)
        sys.exit(1)
    for bead_id, number in rows:
        print(bead_id, number)
