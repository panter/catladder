#!/usr/bin/env python3
"""Order beads-backup: push every listed city beads database to its Dolt remote and verify it (ADR 0005).

Generalised from evermore-city's evermore-beads-push (macrozone/evermore-city docs/beads-sync.md), which
stays the single writer for the `evermore` database. One target per file in beads-backup.d/<name>.tsv with
one tab-separated row: rig_dir, database, remote name, remote URL, git ref, optional mode (`push`, default, or
`sync`). Several databases can share one GitHub repo under different refs (refs/dolt/data for the rig database,
so a fresh clone finds it; refs/dolt/hq for the city's hq database).

Mode `sync` (lcity-f7a): other machines also push to this ref (teammates' agents run `bin/beads-sync` after
creating beads). Before pushing, new remote commits are merged into the city's main: conflicting cells are
previewed (dolt_preview_merge_conflicts), the remote values the city discards are recorded as a comment on each
affected bead; the merge runs through SQL (dolt_merge, dolt_conflicts_resolve --ours: the city wins) because
`bd vc merge` is unsupported in proxied-server mode; then `bd recompute-blocked`.

Per target, in order (oldest successful backup first, bounded by one deadline per run):
  1. resolve the Dolt SQL port (.beads/dolt-server.port, else `bd dolt show --json`), check the database;
  2. guard: every registered city that has this rig must have `dolt-remotes-patrol` set to manual (no second
     writer) and `mol-dog-compactor` running with --gc-only (no history rewrite, evermore incident ecity-9fv).
     Otherwise BLOCKED: nothing is written. A failing `gc rig list` blocks all targets (fail closed);
  3. ensure the remote: add it when missing; an existing remote with another URL or ref is an error;
  4. sync mode only: merge new remote commits as described above;
  5. push `main` through SQL; on the SQL row timeout (gascity#5383) push a standalone snapshot copy instead;
  6. fetch and verify the remote holds the pre-push commit and is an ancestor of local main.
Never resets or force-pushes, pulls only in sync mode; creates no beads. Status per target in
~/.local/state/maw-city/beads-backup/<name>.json (no URLs, no raw command output: they may hold secrets).
DRY_RUN=1 only reads (port, database, guard, remote state) and prints what it would do.
BEADS_PUSH_SNAPSHOT=1 forces the snapshot push (manual catch-up of a large backlog).
"""
import csv
import fcntl
import io
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
import tomllib
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
TARGETS_DIR = Path(os.environ.get("TARGETS_DIR") or ROOT / "beads-backup.d")
STATE_DIR = Path(os.environ.get("STATE_DIR") or Path.home() / ".local/state/maw-city/beads-backup")
CITIES_FILE = Path(os.environ.get("CITIES_FILE") or Path.home() / ".gc/cities.toml")
# `or`, not a default: gc runs orders with some of these set but empty (BD_BIN="" broke every run, 2026-10-12).
GC = os.environ.get("GC_BIN") or "/opt/homebrew/opt/gascity/bin/gc"
BD = os.environ.get("BD_BIN") or "/opt/homebrew/bin/bd"
DOLT = os.environ.get("DOLT_BIN") or "/opt/homebrew/bin/dolt"
RUN_TIMEOUT = int(os.environ.get("RUN_TIMEOUT") or "1500")
DRY = os.environ.get("DRY_RUN", "0") == "1"
DEFAULT_REF = "refs/dolt/data"
# Never inherit worker routing variables (GC_*, BEADS_*): they could point bd at another store.
ENV = {"HOME": str(Path.home()), "PATH": "/opt/homebrew/bin:/usr/bin:/bin", "BD_DOLT_AUTO_PUSH": "false",
       "DOLT_CLI_PASSWORD": "", "GIT_TERMINAL_PROMPT": "0"}


class Failure(Exception):
    pass


def now():
    return datetime.now(timezone.utc)


def run(args, cwd=None, deadline=None, phase=""):
    timeout = 120 if deadline is None else max(0.1, deadline - time.monotonic())
    env = dict(ENV)
    if "--host" not in args:  # local dolt commands refuse a password without --user
        env.pop("DOLT_CLI_PASSWORD")
    try:
        proc = subprocess.Popen(args, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                start_new_session=True)
    except OSError as exc:  # missing binary or rig dir: a per-target failure, not a crash of the whole run
        raise Failure(f"cannot start {Path(str(args[0])).name or 'command'} during {phase or 'run'} ({exc.errno})")
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.communicate()
        raise Failure(f"deadline exceeded during {phase or args[0]}")
    if proc.returncode:
        if os.environ.get("BEADS_BACKUP_DEBUG") == "1":  # tests only: raw output may contain secrets
            print(f"DEBUG {args[:4]}: {out[-500:]}{err[-1500:]}", file=sys.stderr)
        low = err.lower()
        kind = "sql_timeout" if ("connection was closed" in low or "row read wait bigger" in low) else "command_failed"
        raise Failure(f"{kind} during {phase or Path(args[0]).name} (exit {proc.returncode})")
    return out


def load_targets():
    targets = []
    for f in sorted(TARGETS_DIR.glob("*.tsv")):
        rows = [l for l in f.read_text().splitlines() if l.strip() and not l.startswith("#")]
        fields = rows[0].split("\t") if len(rows) == 1 else []
        if len(fields) not in (5, 6):
            raise SystemExit(f"{f}: expected one row: rig_dir, database, remote, url, ref[, mode] (tab-separated)")
        rig, db, remote, url, ref = fields[:5]
        mode = fields[5] if len(fields) == 6 else "push"
        if not re.fullmatch(r"[A-Za-z0-9_]+", db) or not re.fullmatch(r"[A-Za-z0-9_-]+", remote) \
                or not ref.startswith("refs/dolt/") or not url.startswith("git+") or mode not in ("push", "sync"):
            raise SystemExit(f"{f}: invalid database, remote, url, ref or mode")
        targets.append({"name": f.stem, "rig": Path(os.path.expanduser(rig)), "db": db, "remote": remote,
                        "url": url, "ref": ref, "mode": mode})
    keys = [(norm(t["url"]), t["ref"]) for t in targets]
    if len(set(keys)) != len(keys):
        raise SystemExit("two targets share one remote URL and ref")
    return targets


def city_rigs():
    """city name -> set of rig paths (hq included). Raises Failure when any city cannot be listed."""
    if not CITIES_FILE.exists():
        return {}
    out = {}
    for city in tomllib.loads(CITIES_FILE.read_text()).get("cities", []):
        try:
            data = json.loads(run([GC, "rig", "list", "--city", city["path"], "--json"], phase="gc rig list"))
        except (Failure, ValueError):
            raise Failure(f"gc rig list failed for {city['name']}; guard cannot be checked")
        out[city["name"]] = (city["path"], {str(Path(r["path"]).resolve()) for r in data.get("rigs", []) if r.get("path")})
    return out


def order_field(city_path, order, field):
    text = run([GC, "order", "show", order, "--city", city_path], phase="gc order show")
    m = re.search(rf"^{field}:\s*(.*)$", text, re.M)
    return m.group(1).strip() if m else ""


def guard(target, cities, cache):
    rig = str(target["rig"].resolve())
    problems = []
    for name, (path, rigs) in cities.items():
        if rig not in rigs:
            continue
        if name not in cache:
            issues = []
            if order_field(path, "dolt-remotes-patrol", "Trigger") != "manual":
                issues.append(f"{name}: dolt-remotes-patrol is not manual (second writer)")
            if "--gc-only" not in order_field(path, "mol-dog-compactor", "Exec"):
                issues.append(f"{name}: mol-dog-compactor may flatten history")
            cache[name] = issues
        problems += cache[name]
    return problems


def port_of(rig):
    pf = rig / ".beads/dolt-server.port"
    if pf.exists():
        port = pf.read_text().strip()
    else:
        port = str(json.loads(run([BD, "dolt", "show", "--json"], cwd=rig, phase="bd dolt show")).get("port", ""))
    if not port.isdigit():
        raise Failure("no Dolt port")
    return port


def norm(url):
    return url.removesuffix("/").removesuffix(".git")


# Bead fields worth reporting when a remote change loses a merge conflict (timestamps and hashes are noise).
CONFLICT_FIELDS = ("title", "description", "design", "acceptance_criteria", "notes", "status", "priority",
                   "issue_type", "assignee", "due_at", "defer_until", "close_reason")


def merge_remote(target, deadline, status, rows, q, sql_cmd):
    """Sync mode: merge commits other machines pushed; the city wins conflicts, the losing values become comments."""
    remote, rig = target["remote"], target["rig"]
    tracking = f"{remote}/main"
    status["phase"] = "fetch"
    try:
        run(sql_cmd + [f"call dolt_fetch({q(remote)})"], deadline=deadline, phase="fetch")
        fetch_error = None
    except Failure as exc:
        fetch_error = exc
    if rows(f"select count(*) as n from dolt_remote_branches where name = {q('remotes/' + tracking)}",
            "remote branches")[0]["n"] == "0":
        return  # nothing pushed to this ref yet: the first push creates it
    if fetch_error:
        raise fetch_error
    r = rows(f"select hashof('{tracking}') as remote, dolt_merge_base('main', '{tracking}') as base", "compare")[0]
    if r["base"] == r["remote"]:
        return  # no remote commits we lack
    status["phase"] = "merge"
    tables = rows(f"select * from dolt_preview_merge_conflicts_summary('main', '{tracking}')", "preview conflicts")
    lost = []
    if any(t["table"] == "issues" for t in tables):
        for c in rows(f"select * from dolt_preview_merge_conflicts('main', '{tracking}', 'issues')", "preview rows"):
            changed = [f"{f}={c.get('their_' + f)!r} (kept {c.get('our_' + f)!r})" for f in CONFLICT_FIELDS
                       if c.get("their_" + f) != c.get("our_" + f) and c.get("their_" + f) != c.get("base_" + f)]
            if changed:
                lost.append((c.get("our_id") or c.get("their_id"), changed))
    # Through SQL, not `bd vc merge` (unsupported in proxied-server mode, which zue uses). Fails on a dirty
    # working set (an agent writing right now): retried next tick.
    if not tables:
        run(sql_cmd + [f"call dolt_merge('{tracking}')"], deadline=deadline, phase="merge")
    else:
        run(sql_cmd + [f"set @@autocommit = 0; call dolt_merge('{tracking}'); call dolt_conflicts_resolve('--ours', '.'); "
                       f"call dolt_commit('-Am', 'beads-backup: merge {tracking}, conflicts resolved for the city'); "
                       "commit;"], deadline=deadline, phase="merge with conflicts")
    run([BD, "recompute-blocked"], cwd=rig, deadline=deadline, phase="recompute-blocked")
    for bead, changed in lost:
        try:
            run([BD, "comments", "add", bead, "beads-backup sync conflict: another machine changed this bead at the "
                 "same time; the city kept its values. Discarded remote values: " + "; ".join(changed)],
                cwd=rig, deadline=deadline, phase="conflict comment")
        except Failure:
            print(f"WARN {target['name']}: could not comment on {bead}", file=sys.stderr)
    status.update(merged_remote=r["remote"], conflict_tables=[t["table"] for t in tables],
                  conflict_beads=[b for b, _ in lost])


def backup(target, deadline, status):
    rig, db, remote, ref = target["rig"], target["db"], target["remote"], target["ref"]
    port = port_of(rig)
    base = [DOLT, "--host", "127.0.0.1", "--port", port, "--user", "root", "--no-tls"]
    sql_cmd = base + ["--use-db", db, "sql", "-r", "csv", "-q"]

    def rows(sql, phase):
        return list(csv.DictReader(io.StringIO(run(sql_cmd + [sql], deadline=deadline, phase=phase))))

    def q(s):
        return "'" + s.replace("'", "''") + "'"

    status["phase"] = "preflight"
    dbs = run(base + ["sql", "-r", "csv", "-q", "show databases"], deadline=deadline, phase="show databases")
    if db not in dbs.split():
        raise Failure("database not found on the rig's Dolt server")
    existing = rows(f"select url, params from dolt_remotes where name = {q(remote)}", "read remotes")
    if existing:
        params = json.loads(existing[0]["params"] or "{}") if existing[0]["params"] not in ("", "NULL") else {}
        if norm(existing[0]["url"]) != norm(target["url"]) or params.get("git_ref", DEFAULT_REF) != ref:
            raise Failure(f"remote '{remote}' exists with another URL or ref; fix by hand")
    if DRY:
        steps = ([] if existing else ["add remote"]) + (["merge remote commits"] if target["mode"] == "sync" else [])
        return "would " + " and ".join(steps + ["push"])
    if not existing:
        status["phase"] = "add-remote"
        args = [q(remote), q(target["url"])] + ([q("--ref"), q(ref)] if ref != DEFAULT_REF else [])
        run(sql_cmd + [f"call dolt_remote('add', {', '.join(args)})"], deadline=deadline, phase="add remote")
    if target["mode"] == "sync":
        merge_remote(target, deadline, status, rows, q, sql_cmd)

    def ensure_no_push():
        # A killed client can leave server work running. Never overlap it.
        # Only this database: evermore-beads-push pushes `evermore` on the same server every 2 min.
        procs = rows("show processlist", "processlist")
        if any("dolt_push(" in (r.get("Info") or "").lower() and r.get("db") in (db, None, "", "NULL") for r in procs):
            raise Failure("server still has an active Dolt push; retry next tick")

    ensure_no_push()
    before = rows("select hashof('main') as h", "local hash")[0]["h"]
    if len(before) != 32 or not before.isalnum():
        raise Failure("invalid main hash")
    status.update(phase="push", local_hash=before, push_method="sql")

    def snapshot_push():
        # Workaround for gascity#5383 (listener row timeout ~120 s, not settable per session): push a
        # consistent standalone copy instead. Remove when long SQL pushes work.
        ensure_no_push()
        status.update(phase="snapshot", push_method="snapshot")
        with tempfile.TemporaryDirectory(prefix="snap-", dir=STATE_DIR) as tmp:
            url = "file://" + str(Path(tmp) / "backup")
            run(sql_cmd + [f"call dolt_backup('sync-url', {q(url)})"], deadline=deadline, phase="snapshot backup")
            run([DOLT, "backup", "restore", url, "standalone"], cwd=tmp, deadline=deadline, phase="snapshot restore")
            copy = Path(tmp) / "standalone"
            run([DOLT, "remote", "add", remote, target["url"]] + (["--ref", ref] if ref != DEFAULT_REF else []),
                cwd=copy, deadline=deadline, phase="snapshot remote")
            run([DOLT, "push", remote, "main"], cwd=copy, deadline=deadline, phase="snapshot push")

    if os.environ.get("BEADS_PUSH_SNAPSHOT") == "1":  # manual catch-up for large backlogs
        snapshot_push()
    else:
        try:
            run(sql_cmd + [f"call dolt_push({q(remote)}, 'main')"], deadline=deadline, phase="push")
        except Failure as exc:
            if not str(exc).startswith("sql_timeout"):
                raise
            snapshot_push()
    status["phase"] = "verify"
    run(sql_cmd + [f"call dolt_fetch({q(remote)})"], deadline=deadline, phase="fetch")
    r = rows(f"select hashof('main') as local_hash, hashof('{remote}/main') as remote_hash, "
             f"dolt_merge_base('{before}', '{remote}/main') as pushed_base, "
             f"dolt_merge_base('main', '{remote}/main') as local_base", "verify")[0]
    status.update(remote_hash=r["remote_hash"])
    if r["pushed_base"] != before or r["local_base"] != r["remote_hash"]:
        raise Failure("remote did not retain pushed history, or main diverged")
    return f"verified {r['remote_hash']}"


def main():
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    targets = load_targets()
    with (STATE_DIR / "lock").open("a") as lock:  # never unlinked: two owners could lock otherwise
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("beads-backup already running; skipped")
            return 0
        deadline = time.monotonic() + RUN_TIMEOUT
        statuses = {}
        for t in targets:
            p = STATE_DIR / f"{t['name']}.json"
            try:
                statuses[t["name"]] = json.loads(p.read_text()) if p.exists() else {}
            except (ValueError, OSError):
                statuses[t["name"]] = {}
        targets.sort(key=lambda t: statuses[t["name"]].get("last_success") or "")
        try:
            cities, guard_error = city_rigs(), None
        except Failure as exc:
            cities, guard_error = {}, str(exc)
        cache, failed = {}, 0
        for t in targets:
            prev = statuses[t["name"]]
            status = {"checked_at": now().isoformat(), "last_success": prev.get("last_success"),
                      "consecutive_failures": prev.get("consecutive_failures", 0), "database": t["db"],
                      "ref": t["ref"]}
            if time.monotonic() > deadline - 60:
                print(f"{t['name']}: no time left in this run; next tick")
                continue
            # A city unregistered from the supervisor (paused, e.g. evermore-city by maw 2026-10-20) has no running
            # Dolt server for its hq: skip instead of failing every 10 min (82 failures, 2026-10-21). Its data stays
            # in the GCS mirror (~/git/cities/bin/beads-gcs-mirror). Rigs of registered cities are never skipped.
            rig_path = str(t["rig"].resolve())
            if not guard_error and cities and not any(rig_path in rigs or rig_path == str(Path(path).resolve())
                                                      for path, rigs in cities.values()):
                print(f"SKIP {t['name']}: no registered city has this rig (paused)")
                continue
            try:
                problems = [guard_error] if guard_error else guard(t, cities, cache)
                if problems:
                    status.update(ok=False, blocked=True, error="; ".join(problems))
                    print(f"BLOCKED {t['name']}: {status['error']}")
                else:
                    msg = backup(t, deadline, status)
                    print(f"{'DRY_RUN ' if DRY else ''}{t['name']}: {msg}")
                    if not DRY:
                        status.update(ok=True, blocked=False, consecutive_failures=0,
                                      last_success=now().isoformat(), phase="complete")
                        status.pop("error", None)
            except Failure as exc:
                failed += 1
                status.update(ok=False, blocked=False, error=str(exc),
                              consecutive_failures=status["consecutive_failures"] + (0 if DRY else 1))
                print(f"ALERT {t['name']}: {exc}", file=sys.stderr)
            if not DRY:
                tmp = STATE_DIR / f"{t['name']}.json.tmp"
                tmp.write_text(json.dumps(status, indent=2) + "\n")
                tmp.replace(STATE_DIR / f"{t['name']}.json")
        return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
