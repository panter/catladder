#!/usr/bin/env bash
# Order beads-backup: push and verify every city beads database in beads-backup.d/ (scripts/beads-backup.py).
# Single remote writer per database; never pulls, resets or force-pushes. DRY_RUN=1 only reads.
set -euo pipefail
exec python3 -I "$(cd "$(dirname "$0")" && pwd)/beads-backup.py" "$@"
