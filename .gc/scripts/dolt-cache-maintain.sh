#!/usr/bin/env bash
# Order dolt-cache-maintain (2026-10-13). Dolt pushes beads to git remotes through a local cache repo
# (<rig>/.beads/dolt/<db>/.dolt/git-remote-cache/<hash>/repo.git). Every push let git start a detached
# `git maintenance run --auto`; with evermore-beads-push every 2 min and a 2.3 GB cache those repacks took
# longer than the push interval and piled up (19 concurrent repacks, load ~130 on 2026-10-13).
# This order (1) keeps automatic maintenance off in every cache (maintenance.auto=false, gc.auto=0) and
# (2) repacks the caches itself, one at a time, at most once per day each, never during machine overload.
# Deterministic, no LLM, idempotent. DRY_RUN=1 only prints.
set -uo pipefail
STATE="${STATE_DIR:-$HOME/.local/state/cities/dolt-cache-maintain}"; mkdir -p "$STATE"
GOVERNOR="${GOVERNOR:-$HOME/.local/state/cities/governor.env}"
OVERLOAD=0; [ -f "$GOVERNOR" ] && . "$GOVERNOR"
LOCK="$STATE/lock"
# One run at a time (mkdir is atomic; a stale lock older than 6 h is removed).
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +360 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; mkdir "$LOCK" 2>/dev/null || exit 0
  else echo "dolt-cache-maintain: another run holds the lock"; exit 0; fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# Every rig and city directory of every registered city.
dirs="$(python3 - <<'PY'
import tomllib, os, subprocess, json
d = tomllib.load(open(os.path.expanduser("~/.gc/cities.toml"), "rb"))
seen = set()
for c in d.get("cities", []):
    seen.add(c["path"])
    try:
        out = subprocess.run(["/opt/homebrew/opt/gascity/bin/gc", "rig", "list", "--city", c["path"], "--json"],
                             capture_output=True, text=True, timeout=60).stdout
        for r in json.loads(out or "{}").get("rigs", []):
            if r.get("path"): seen.add(r["path"])
    except Exception:
        pass
print("\n".join(sorted(seen)))
PY
)"
caches="$(for d in $dirs; do ls -d "$d"/.beads/dolt/*/.dolt/git-remote-cache/*/repo.git 2>/dev/null; done | sort -u)"
[ -n "$caches" ] || { echo "dolt-cache-maintain: no caches found"; exit 0; }

for r in $caches; do
  if [ "$(git -C "$r" config --get maintenance.auto)" != false ] || [ "$(git -C "$r" config --get gc.auto)" != 0 ]; then
    echo "dolt-cache-maintain: disable auto maintenance in $r"
    [ "${DRY_RUN:-0}" = 1 ] || { git -C "$r" config maintenance.auto false; git -C "$r" config gc.auto 0; }
  fi
done

if [ "$OVERLOAD" = 1 ]; then echo "dolt-cache-maintain: machine overload - no repack this run"; exit 0; fi
for r in $caches; do
  key="$(printf '%s' "$r" | shasum | cut -c1-16)"; mark="$STATE/$key.last"
  [ -f "$mark" ] && [ -z "$(find "$mark" -mmin +1380 2>/dev/null)" ] && continue   # repacked within ~23 h
  if [ "${DRY_RUN:-0}" = 1 ]; then echo "dolt-cache-maintain: would repack $r ($(du -sh "$r" | cut -f1))"; continue; fi
  before="$(du -sk "$r" | cut -f1)"
  if nice -n 15 git -C "$r" -c gc.auto=0 -c maintenance.auto=false repack -d -l -q; then
    touch "$mark"; echo "INFO dolt-cache-maintain: repacked $r (${before} KB -> $(du -sk "$r" | cut -f1) KB)"
  else
    echo "WARN dolt-cache-maintain: repack failed in $r"
  fi
  # One repack per run keeps each run short; the next run continues with the next cache.
  break
done
exit 0
