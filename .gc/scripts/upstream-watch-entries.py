#!/usr/bin/env python3
"""Validate and emit watch entries, including an optional legacy shared TSV."""
import re
import sys
from pathlib import Path


def load_entries(root):
    entries = {}
    paths = sorted((root / "upstream-watch.d").glob("*.tsv"))
    legacy = root / "upstream-watch.tsv"
    if legacy.exists():
        paths.append(legacy)
    for path in paths:
        rows = []
        for number, line in enumerate(path.read_text().splitlines(), 1):
            if not line.strip() or line.startswith("#"):
                continue
            fields = line.split("\t")
            location = f"{path}:{number}"
            if len(fields) not in (4, 5):
                raise ValueError(f"{location}: expected 4 or 5 tab-separated fields")
            repo, issue, kind, reason = fields[:4]
            if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
                raise ValueError(f"{location}: invalid repository")
            if kind == "tag":
                if not re.fullmatch(r"v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?", issue):
                    raise ValueError(f"{location}: expected version tag")
            elif not re.fullmatch(r"[1-9][0-9]*", issue):
                raise ValueError(f"{location}: expected positive issue/PR number")
            if kind not in ("issue", "pr", "tag") or not reason.strip():
                raise ValueError(f"{location}: expected issue/pr/tag and nonempty reason")
            if len(fields) == 5 and not fields[4].strip():
                raise ValueError(f"{location}: source bead must not be empty")
            key = (repo.casefold(), issue)
            if key in entries:
                raise ValueError(f"{location}: duplicate {repo}#{issue}")
            entries[key] = fields
            rows.append(fields)
        if path != legacy and len(rows) != 1:
            raise ValueError(f"{path}: expected exactly one entry per file")
    return list(entries.values())


if __name__ == "__main__":
    try:
        for row in load_entries(Path(sys.argv[1])):
            print("\t".join(row))
    except (OSError, ValueError) as error:
        sys.exit(str(error))
