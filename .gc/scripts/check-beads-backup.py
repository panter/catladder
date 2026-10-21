#!/usr/bin/env python3
"""Isolated test for beads-backup.py: throwaway dolt sql-server, local bare git remote, fake gc. No real stores."""
import json, os, socket, subprocess, sys, tempfile, time
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "beads-backup.py"
DOLT = "/opt/homebrew/bin/dolt"


def sh(*a, cwd=None, env=None, check=True):
    return subprocess.run(a, cwd=cwd, env=env, check=check, capture_output=True, text=True)


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


fails = []


def expect(cond, msg):
    if not cond:
        fails.append(msg)


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    remote = tmp / "remote.git"
    sh("git", "init", "-q", "--bare", "-b", "main", str(remote))
    seed = tmp / "seed"
    sh("git", "clone", "-q", str(remote), str(seed))
    sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init", cwd=seed)
    sh("git", "push", "-q", "origin", "HEAD:main", cwd=seed)

    data = tmp / "server"
    for db in ("rigdb", "hqdb"):
        (data / db).mkdir(parents=True)
        sh(DOLT, "init", "--name", "t", "--email", "t@t", cwd=data / db)
        sh(DOLT, "sql", "-q", "create table issues(id varchar(20) primary key); insert into issues values ('t-1');"
           " call dolt_commit('-Am', 'seed')", cwd=data / db)
    port = free_port()
    server = subprocess.Popen([DOLT, "sql-server", "--host", "127.0.0.1", "--port", str(port),
                               "--data-dir", str(data)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            with socket.socket() as s:
                if s.connect_ex(("127.0.0.1", port)) == 0:
                    break
            time.sleep(0.1)
        rig = tmp / "rig"
        (rig / ".beads").mkdir(parents=True)
        (rig / ".beads/dolt-server.port").write_text(str(port))
        url = f"git+file://{remote}"
        targets = tmp / "targets"
        targets.mkdir()
        (targets / "a-rig.tsv").write_text(f"{rig}\trigdb\torigin\t{url}\trefs/dolt/data\n")
        (targets / "a-hq.tsv").write_text(f"{rig}\thqdb\tbackup\t{url}\trefs/dolt/hq\n")
        # Fake gc: one city containing the rig; order fields come from env (safe or unsafe city).
        fake = tmp / "gc"
        fake.write_text("#!/bin/sh\n"
                        f"case \"$1 $2\" in 'rig list') echo '{{\"rigs\":[{{\"path\":\"{rig}\"}}]}}';;\n"
                        "'order show') if [ -f \"$(dirname \"$0\")/unsafe\" ]; then echo 'Trigger: cooldown'; echo 'Exec: gc dolt compact';"
                        " else echo 'Trigger: manual'; echo 'Exec: gc dolt compact --gc-only'; fi;;\nesac\n")
        fake.chmod(0o755)
        cities = tmp / "cities.toml"
        cities.write_text(f'[[cities]]\npath = "{tmp}"\nname = "test-city"\n')
        state = tmp / "state"
        env = dict(os.environ, TARGETS_DIR=str(targets), STATE_DIR=str(state), CITIES_FILE=str(cities),
                   GC_BIN=str(fake))

        def refs():
            return sh("git", "--git-dir", str(remote), "for-each-ref", "--format=%(refname)").stdout.split()

        def go(**extra):
            return sh(sys.executable, "-I", str(SCRIPT), env=dict(env, **extra), check=False)

        # 1. Unsafe city: blocked, nothing written.
        (tmp / "unsafe").write_text("")
        r = go()
        expect(r.returncode == 0 and r.stdout.count("BLOCKED") == 2, f"unsafe city must block both: {r.stdout}{r.stderr}")
        expect("refs/dolt/data" not in refs(), "blocked run pushed")
        (tmp / "unsafe").unlink()
        # 2. DRY_RUN: reports, adds no remote, pushes nothing, writes no status.
        before = {p.name: p.read_text() for p in state.glob("*.json")}
        r = go(DRY_RUN="1")
        expect(r.returncode == 0 and r.stdout.count("would add remote and push") == 2, f"dry run: {r.stdout}{r.stderr}")
        expect({p.name: p.read_text() for p in state.glob("*.json")} == before, "dry run changed status")
        expect("refs/dolt/data" not in refs(), "dry run pushed")
        # 2b. gc runs orders with some *_BIN variables set but empty: defaults must still apply.
        r = go(DRY_RUN="1", BD_BIN="", DOLT_BIN="", RUN_TIMEOUT="")
        expect(r.returncode == 0 and r.stdout.count("would add remote and push") == 2, f"empty env vars: {r.stdout}{r.stderr}")
        # 3. Apply: both databases pushed under their own refs, verified.
        r = go()
        expect(r.returncode == 0 and r.stdout.count("verified") == 2, f"apply: {r.stdout}{r.stderr}")
        expect({"refs/dolt/data", "refs/dolt/hq"} <= set(refs()), f"refs missing: {refs()}")
        st = json.loads((state / "a-hq.json").read_text())
        expect(st.get("ok") and st.get("last_success"), f"status not ok: {st}")
        # 4. New local commit is pushed on the next run.
        sh(DOLT, "--host", "127.0.0.1", "--port", str(port), "--user", "root", "--no-tls", "--use-db", "rigdb", "sql",
           "-q", "insert into issues values ('t-2'); call dolt_commit('-Am', 'more')", env=dict(os.environ, DOLT_CLI_PASSWORD=""))
        r = go()
        expect(r.returncode == 0 and r.stdout.count("verified") == 2, f"second run: {r.stdout}{r.stderr}")
        # 4b. Snapshot fallback (gascity#5383 workaround) pushes the same way.
        sh(DOLT, "--host", "127.0.0.1", "--port", str(port), "--user", "root", "--no-tls", "--use-db", "rigdb", "sql",
           "-q", "insert into issues values ('t-3'); call dolt_commit('-Am', 'snap')", env=dict(os.environ, DOLT_CLI_PASSWORD=""))
        r = go(BEADS_PUSH_SNAPSHOT="1")
        expect(r.returncode == 0 and r.stdout.count("verified") == 2, f"snapshot run: {r.stdout}{r.stderr}")
        expect(json.loads((state / "a-rig.json").read_text()).get("push_method") == "snapshot", "snapshot not used")
        expect(not [p for p in state.iterdir() if p.name.startswith("snap-")], "snapshot temp dir left behind")
        clone = tmp / "clone"
        sh(DOLT, "clone", url, str(clone))
        rows = sh(DOLT, "sql", "-r", "csv", "-q", "select count(*) n from issues", cwd=clone).stdout.split()
        expect(rows[-1] == "3", f"restore from remote has {rows[-1]} issues, expected 3")
        # 5. Existing remote with another ref: error, no push.
        (targets / "a-hq.tsv").write_text(f"{rig}\thqdb\tbackup\t{url}\trefs/dolt/other\n")
        r = go()
        expect(r.returncode == 1 and "exists with another URL or ref" in r.stderr, f"mismatch: {r.stdout}{r.stderr}")
        expect("refs/dolt/other" not in refs(), "mismatched remote pushed")
        # 6. Duplicate URL+ref across targets is rejected at load.
        (targets / "a-hq.tsv").write_text(f"{rig}\thqdb\tbackup\t{url}/\trefs/dolt/data\n")
        r = go(DRY_RUN="1")
        expect(r.returncode != 0 and "share one remote" in (r.stdout + r.stderr), f"duplicate target: {r.stdout}{r.stderr}")
    finally:
        server.terminate()
        server.wait(timeout=10)

if fails:
    print("FAIL beads-backup:\n  " + "\n  ".join(fails))
    sys.exit(1)
print("OK beads-backup (block, dry run, push two refs, incremental push, snapshot push, restore, remote mismatch, duplicates)")
