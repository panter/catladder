#!/usr/bin/env python3
"""End-to-end test of beads sync mode (lcity-f7a): city workspace + teammate clone against a local git remote.
The city store is proxied-server with tracked .beads config, like zue; the teammate uses server mode.

City side: scripts/beads-backup.py with a `sync` target. Teammate side: templates/project-beads/bin/beads-setup
and beads-sync. Both workspaces are real bd server-mode stores (bd-managed dolt sql-server on free ports) in a
temp dir; nothing touches a real store or GitHub. Covers: first push, teammate setup from the remote, beads in
both directions, a conflict at the city (city wins, comment) and at the teammate (shared value wins, comment),
city-machine detection and --if-needed.
"""
import json, os, shutil, socket, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUP = ROOT / "scripts/beads-backup.py"
TPL = ROOT / "templates/project-beads/bin"
BASE_ENV = {"HOME": os.environ["HOME"], "PATH": "/opt/homebrew/bin:/usr/bin:/bin", "BD_DOLT_AUTO_PUSH": "false"}
fails = []


def sh(*a, cwd=None, env=None, check=True):
    r = subprocess.run(a, cwd=cwd, env=dict(BASE_ENV, **(env or {})), capture_output=True, text=True)
    if check and r.returncode:
        raise SystemExit(f"FAIL beads-sync setup: {' '.join(map(str, a))}\n{r.stdout}{r.stderr}\nearlier: {fails}")
    return r


def expect(cond, msg):
    if not cond:
        fails.append(msg)


def port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def beads(ws):
    return {b["title"]: b for b in json.loads(sh("bd", "list", "--all", "--json", cwd=ws).stdout or "[]")}


def bead(ws, bid):
    data = json.loads(sh("bd", "show", bid, "--json", cwd=ws).stdout)
    return data[0] if isinstance(data, list) else data


def comments(ws, bid):
    return sh("bd", "comments", bid, cwd=ws).stdout


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    remote = tmp / "remote.git"
    sh("git", "init", "-q", "--bare", "-b", "main", str(remote))
    city, mate = tmp / "city", tmp / "mate"
    sh("git", "clone", "-q", str(remote), str(city))
    sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init", cwd=city)
    sh("git", "push", "-q", "origin", "main", cwd=city)
    sh("git", "clone", "-q", f"file://{remote}", str(mate))
    url = f"git+file://{remote}"
    targets, empty, state = tmp / "targets", tmp / "no-targets", tmp / "state"
    targets.mkdir(); empty.mkdir()
    cities = tmp / "cities.toml"; cities.write_text("")
    try:
        # City store and its sync target.
        # Like zue: the city store runs proxied-server and the repo tracks its .beads/metadata.json + config.yaml.
        sh("bd", "init", "--proxied-server", "--prefix", "st", "--skip-agents", "--skip-hooks", "--non-interactive",
           cwd=city)
        sh("git", "add", "-f", ".beads/metadata.json", ".beads/config.yaml", cwd=city)
        sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "city beads config", cwd=city,
           check=False)  # bd init may already have committed them
        expect("metadata.json" in sh("git", "ls-files", ".beads", cwd=city).stdout, "city beads config not tracked")
        sh("git", "push", "-q", "origin", "main", cwd=city)
        sh("git", "pull", "-q", cwd=mate)
        sh("bd", "create", "-q", "city-1", cwd=city)
        (targets / "test-st.tsv").write_text(f"{city}\tst\torigin\t{url}\trefs/dolt/data\tsync\n")
        benv = {"TARGETS_DIR": str(targets), "STATE_DIR": str(state), "CITIES_FILE": str(cities),
                "BEADS_BACKUP_DEBUG": os.environ.get("BEADS_BACKUP_DEBUG", "0")}

        def city_sync():
            return sh(sys.executable, "-I", str(BACKUP), env=benv, check=False)

        r = city_sync()
        expect(r.returncode == 0 and "verified" in r.stdout, f"first city push: {r.stdout}{r.stderr}")
        # Teammate setup from the remote (server mode), then a new bead back to the city.
        menv = {"BEADS_PREFIX": "st", "BEADS_BACKUP_TARGETS": str(empty)}
        sh("git", "config", "user.email", "mate@example.com", cwd=mate)
        r = sh("bash", str(TPL / "beads-setup"), cwd=mate, env=menv, check=False)
        expect(r.returncode == 1 and "expected your @panter.ch address" in r.stdout, f"email check: {r.stdout}{r.stderr}")
        sh("git", "config", "user.email", "mate@panter.ch", cwd=mate)
        r = sh("bash", str(TPL / "beads-setup"), cwd=mate, env=menv, check=False)
        expect(r.returncode == 0 and "OK: 1 beads" in r.stdout, f"teammate setup: {r.stdout}{r.stderr}")
        dirty = sh("git", "status", "--porcelain", cwd=mate).stdout
        expect(".beads/metadata.json" not in dirty and ".beads/config.yaml" not in dirty,
               f"teammate's local beads config would be committed: {dirty}")
        sh("bd", "create", "-q", "mate-1", cwd=mate)
        r = sh(sys.executable, str(TPL / "beads-sync"), cwd=mate, env=menv, check=False)
        expect(r.returncode == 0 and "synced" in r.stdout, f"teammate sync: {r.stdout}{r.stderr}")
        r = city_sync()
        expect(r.returncode == 0 and "mate-1" in beads(city), f"city merge of teammate bead: {r.stdout}{r.stderr}")
        cid = beads(city)["city-1"]["id"]
        # Conflict at the city: same field changed on both sides, the teammate pushed first -> city wins.
        sh("bd", "update", cid, "--priority", "0", "-q", cwd=city)
        sh("bd", "update", cid, "--priority", "4", "-q", cwd=mate)
        sh(sys.executable, str(TPL / "beads-sync"), cwd=mate, env=menv)
        r = city_sync()
        expect(r.returncode == 0 and "verified" in r.stdout, f"city sync with conflict: {r.stdout}{r.stderr}")
        expect(bead(city, cid)["priority"] == 0, "city did not keep its value on conflict")
        expect("beads-backup sync conflict" in comments(city, cid) and "priority='4'" in comments(city, cid),
               f"no conflict comment at the city: {comments(city, cid)}")
        st = json.loads((state / "test-st.json").read_text())
        expect(st.get("conflict_beads") == [cid], f"status lacks conflict bead: {st}")
        # Concurrent edit where the city pushed first: the teammate's bd sync pulls the city's commit and settles the
        # cell last-write-wins on top of it, so for the city the result is a fast-forward. Expected: no stuck sync,
        # both sides converge on the same value (here the later teammate edit).
        sh(sys.executable, str(TPL / "beads-sync"), cwd=mate, env=menv)
        sh("bd", "update", cid, "--title", "city title", "-q", cwd=city)
        city_sync()
        sh("bd", "update", cid, "--title", "mate title", "-q", cwd=mate)
        r = sh(sys.executable, str(TPL / "beads-sync"), cwd=mate, env=menv, check=False)
        expect(r.returncode == 0, f"teammate sync after concurrent edit: {r.stdout}{r.stderr}")
        r = city_sync()
        expect(r.returncode == 0 and "verified" in r.stdout, f"city sync after teammate edit: {r.stdout}{r.stderr}")
        sh(sys.executable, str(TPL / "beads-sync"), cwd=mate, env=menv)
        expect(bead(city, cid)["title"] == bead(mate, cid)["title"],
               f"did not converge: city {bead(city, cid)['title']!r}, teammate {bead(mate, cid)['title']!r}")
        expect("beads-backup sync conflict" in comments(mate, cid), "city's conflict comment did not reach the teammate")
        expect(set(beads(city)) == set(beads(mate)), "bead sets differ after sync")
        # --if-needed with nothing local: no-op; city machine: no-op.
        r = sh(sys.executable, str(TPL / "beads-sync"), "--if-needed", cwd=mate, env=menv, check=False)
        expect(r.returncode == 0 and not r.stdout.strip(), f"--if-needed should be silent: {r.stdout}{r.stderr}")
        (targets / "mate.tsv").write_text(f"{mate}\tst\torigin\t{url}\trefs/dolt/data\tsync\n")
        r = sh(sys.executable, str(TPL / "beads-sync"), cwd=mate, env=dict(menv, BEADS_BACKUP_TARGETS=str(targets)),
               check=False)
        expect(r.returncode == 0 and "city machine" in r.stdout, f"city machine detection: {r.stdout}{r.stderr}")
    finally:
        for ws in (city, mate):
            if (ws / ".beads").exists():
                sh("bd", "dolt", "stop", cwd=ws, check=False)

if fails:
    print("FAIL beads-sync:\n  " + "\n  ".join(fails))
    sys.exit(1)
print("OK beads-sync (city push, teammate setup, both directions, conflicts (city wins with comment; later edit wins on fast-forward), convergence, city-machine no-op)")
