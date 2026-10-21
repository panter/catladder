#!/usr/bin/env python3
"""People register (ADR 0007): load and validate people.toml; small CLI for orders and publish steps.

  people.py check                 validate people.toml (check-city)
  people.py lookup <email>        JSON of one person (matched on any of their emails), exit 1 if unknown
  people.py coauthor <email>      "Co-authored-by: Name <email>" line, exit 1 if unknown
  people.py logins <right>        comma-separated GitHub logins with that right (e.g. po_feedback)
"""
import json
import os
from pathlib import Path
import re
import sys
import tomllib

FILE = Path(os.environ.get("PEOPLE_FILE") or Path(__file__).resolve().parent.parent / "people.toml")
RIGHTS = {"approve", "po_feedback"}


def load(path=FILE):
    people = tomllib.loads(Path(path).read_text()).get("people", [])
    errors, seen = [], set()
    for i, p in enumerate(people):
        # `emails`: every address the person creates beads with (several machines/accounts); the first is primary.
        emails = [str(e).lower() for e in (p.get("emails") or [p.get("email", "")])]
        if not emails:
            errors.append(f"entry {i}: email required")
        for email in emails:
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[a-z]+", email):
                errors.append(f"entry {i}: invalid email {email!r}")
            if email in seen:
                errors.append(f"entry {i}: duplicate email {email}")
            seen.add(email)
        if not p.get("name") or not re.fullmatch(r"[A-Za-z0-9-]+", str(p.get("github", ""))):
            errors.append(f"entry {i}: name and github login required")
        if not set(p.get("rights", [])) <= RIGHTS:
            errors.append(f"entry {i}: unknown rights {set(p.get('rights', [])) - RIGHTS}")
        p["emails"] = emails
        p["email"] = emails[0] if emails else ""
    return people, errors


def by_email(email, people=None):
    people = people if people is not None else load()[0]
    return next((p for p in people if str(email).lower() in p["emails"]), None)


def main(argv):
    people, errors = load()
    if argv[:1] == ["check"]:
        print("\n".join(errors) or f"OK people.toml ({len(people)} people)")
        return 1 if errors else 0
    if len(argv) == 2 and argv[0] in ("lookup", "coauthor"):
        p = by_email(argv[1], people)
        if not p:
            return 1
        print(json.dumps(p) if argv[0] == "lookup" else f"Co-authored-by: {p['name']} <{p['email']}>")
        return 0
    if len(argv) == 2 and argv[0] == "logins":
        print(",".join(p["github"] for p in people if argv[1] in p.get("rights", [])))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
