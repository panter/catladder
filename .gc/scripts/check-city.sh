#!/usr/bin/env bash
# Pflicht-Checks für Änderungen an der City (Refinery-Gate im Rig «city»), ohne LLM.
# Läuft im Checkout/Worktree des Repos und prüft genau diesen Stand.
set -euo pipefail
GC=/opt/homebrew/opt/gascity/bin/gc
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
step(){ echo "== $*"; }

step "Shell-Syntax"
for f in scripts/*.sh scripts/lib/*.sh; do
  [ -f "$f" ] || continue
  bash -n "$f" || { echo "Syntaxfehler: $f"; fail=1; }; done

step "City GitHub App identity (isolated fake token command and real Git)"
python3 scripts/check-city-github.py || fail=1

step "Rejected PR rework fixtures (isolated Git and fake GitHub/Beads)"
python3 scripts/check-rework.py || fail=1

step "Workflow artifact storage and publication rejection fixtures"
python3 scripts/check-workflow-artifacts.py || fail=1

step "Merged PR source reconciliation fixtures"
python3 scripts/test-merged-pr-beads.py || fail=1

step "Shared dispatcher core fixtures and wrapper syntax"
python3 packs/city-dispatch/tests/check-city-dispatch.py || fail=1
python3 packs/city-dispatch/tests/check-dispatch-graph.py || fail=1
bash -n packs/city-dispatch/assets/scripts/live-roots.sh || fail=1

step "Workflow liveness fixtures"
bash scripts/test-live-workflow-roots.sh || fail=1

step "Dead workflow cleanup fixtures and real-data DRY_RUN"
python3 scripts/test-clean-dead-workflows.py || fail=1
DRY_RUN=1 CITY_DIR="${CITY_DIR:-$HOME/git/maw-city}" bash scripts/clean-dead-workflows.sh || fail=1

step "Order-Dateien referenzieren existierende Scripts"
for o in orders/*.toml; do
  exe="$(sed -n 's/^exec = "\(.*\)"$/\1/p' "$o")"
  [ -z "$exe" ] && continue
  script="$(printf '%s' "$exe" | grep -oE '/[^ ]*scripts/[^ ]+\.(sh|py)' | head -1 || true)"
  [ -z "$script" ] && continue   # plain command (e.g. gc dolt compact --gc-only), no repo script
  case "$script" in
    */packs/*) rel="packs/${script#*/packs/}" ;;
    *) rel="scripts/${script##*/scripts/}" ;;
  esac
  [ -f "$rel" ] || { echo "$o: Script fehlt: $rel"; fail=1; }
  # Orders exec the script directly: without the executable bit it fails with exit 126 (beads-backup, 2026-10-12).
  [ "$(git ls-files -s "$rel" | cut -c1-6)" = 100644 ] && { echo "$o: Script nicht ausführbar (git mode 100644): $rel"; fail=1; }
done

step "City-Config lädt (gc config show)"
if out="$("$GC" config show --city "$ROOT" 2>&1 >/dev/null | grep -v -E 'WARN native|: warning:|^  ')"; [ -n "$out" ]; then
  echo "$out"; fail=1
fi

step "Agent-Prompts rendern (gc prime --strict)"
for a in city/gc.implementation-worker city/gc.run-operator evermore-city/gc.implementation-worker; do
  if ! "$GC" prime --strict "$a" --city "$ROOT" >/dev/null 2>&1; then echo "Prompt rendert nicht: $a"; fail=1; fi
done

step "Orders ohne Wirkung (DRY_RUN)"
# scripts/city-dispatch.sh (DRY_RUN in the loop below) runs the shared dispatcher with dispatch.toml;
# flow-watch reads its MAX_RUNNING default, which must equal dispatch.toml max_running.
wrapper_cap="$(sed -nE 's/^MAX_RUNNING="\$\{MAX_RUNNING:-([0-9]+)\}"$/\1/p' scripts/city-dispatch.sh)"
config_cap="$(python3 -c 'import tomllib; print(tomllib.load(open("dispatch.toml", "rb"))["max_running"])')"
if [ -z "$wrapper_cap" ] || [ "$wrapper_cap" != "$config_cap" ]; then
  echo "MAX_RUNNING in scripts/city-dispatch.sh ($wrapper_cap) != dispatch.toml max_running ($config_cap)"; fail=1
fi
for s in scripts/*-dispatch.sh scripts/*-questions.sh; do
  [ -f "$s" ] || continue
  DRY_RUN=1 STATE="$(mktemp)" bash "$s" >/dev/null || { echo "DRY_RUN fehlgeschlagen: $s"; fail=1; }
done
DRY_RUN=1 STATE_DIR="$(mktemp -d)" bash scripts/dolt-cache-maintain.sh >/dev/null || { echo "DRY_RUN fehlgeschlagen: scripts/dolt-cache-maintain.sh"; fail=1; }
for s in scripts/board-sync.sh scripts/root-unroute.sh; do
  DRY_RUN=1 RIG_DIR="$HOME/git/maw-city-src" bash "$s" >/dev/null || { echo "DRY_RUN fehlgeschlagen: $s"; fail=1; }
done

step "Formulas kompilieren"
for f in implement build-basic spike; do
  if [ "$f" = spike ]; then
    # Rig-only pack: compile in an isolated bound rig, never mutate local bindings.
    python3 scripts/check-spike.py --compile-only || fail=1
  else
    "$GC" formula show "$f" --city "$ROOT" >/dev/null 2>&1 || { echo "Formula kompiliert nicht: $f"; fail=1; }
  fi
done

step "Upstream watch entries (format, uniqueness, migration)"
python3 scripts/upstream-watch-entries.py "$ROOT" >/dev/null || fail=1
python3 scripts/check-upstream-watch.py || fail=1

step "Question routing fixtures"
python3 -B -m unittest discover -s tests -p 'test_question_router.py' || fail=1

step "Codex-Hook-Installer isoliert (DRY_RUN und Session-Guards)"
python3 scripts/check-codex-hooks.py || fail=1

step "Closed-workflow sweeper safety checks (isolated stores)"
python3 scripts/check-closed-workflow-sweeper.py || fail=1

step "Legacy worktree cleanup safety (isolated Git fixtures)"
python3 scripts/check-reap-worktrees.py || fail=1

step "Shared-stash cleanup isolated and real-data DRY_RUN"
python3 scripts/check-stash-cleanup.py || fail=1
DRY_RUN=1 python3 scripts/stash-cleanup.py || fail=1

step "Worktree archive-reap (isolated Git fixture; order wrapper starts in DRY_RUN)"
python3 scripts/check-worktree-archive-reap.py || fail=1
DRY_RUN=1 bash scripts/worktree-reap.sh --max 0 >/dev/null || fail=1

step "Beads backup (isolated Dolt server + git remote; real-data DRY_RUN)"
python3 scripts/check-beads-backup.py || fail=1
DRY_RUN=1 bash scripts/beads-backup.sh >/dev/null || { echo "DRY_RUN fehlgeschlagen: scripts/beads-backup.sh"; fail=1; }
python3 scripts/check-beads-sync.py || fail=1

step "Spike prompts, CLI helpers and dispatcher routing (offline fixtures)"
python3 scripts/check-spike.py || fail=1

step "Spike workflow (isolated Git/bead fixtures and read-only compilation)"
python3 -m unittest discover -s packs/publish-gate/tests || fail=1

step "Publish gate (close after publish)"
DRY_RUN=1 bash scripts/check-workflow-order.sh || fail=1

step "People register and requester-sync (ADR 0007; isolated bd store, real-data DRY_RUN)"
python3 scripts/people.py check || fail=1
python3 scripts/check-requester-sync.py || fail=1
DRY_RUN=1 MAX_WRITES=0 bash scripts/requester-sync.sh >/dev/null || { echo "DRY_RUN fehlgeschlagen: scripts/requester-sync.sh"; fail=1; }

step "Keine Secrets im Repo"
if git grep -nE '(sk-ant-[A-Za-z0-9_-]{20}|CLAUDE_CODE_OAUTH_TOKEN *= *"[^$"]|ghp_[A-Za-z0-9]{20})' -- . ':!scripts/check-city.sh' >/dev/null; then
  echo "Möglicher Secret-Fund:"; git grep -nE '(sk-ant-[A-Za-z0-9_-]{20}|ghp_[A-Za-z0-9]{20})' -- . ':!scripts/check-city.sh' | cut -c1-80; fail=1
fi

[ "$fail" -eq 0 ] && echo "OK: alle City-Checks bestanden" || echo "FEHLER: City-Checks nicht bestanden"
exit "$fail"
