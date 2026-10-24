#!/usr/bin/env bash
# Workaround for gastownhall/gascity #5607/#6791/#2903/#7197.
# Remove when the adopted GC release repairs dead roots and requeues their work.
# Read-only git evidence; never purge beads, reset branches, or remove worktrees.
set -euo pipefail
SCRIPT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SCRIPT_ROOT
exec python3 - "$@" <<'PY'
import copy
import fcntl
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

HOME = os.environ['HOME']
ROOT = Path(os.environ['SCRIPT_ROOT'])
GC = os.environ.get('GC', '/opt/homebrew/opt/gascity/bin/gc')
BD = os.environ.get('BD_BIN', '/opt/homebrew/bin/bd')
CITY = os.environ.get('CITY_DIR', str(ROOT))
DRY = os.environ.get('DRY_RUN', '0') == '1'
# Strip inherited BEADS_*, GC_* and Dolt variables: each rig discovers its own DB.
BD_ENV = {'HOME': HOME, 'PATH': '/opt/homebrew/bin:/usr/bin:/bin:' + HOME + '/.local/bin'}
DEFAULT_RIGS = ' '.join(f'{name}={HOME}/git/{path}' for name, path in [
    ('city', 'maw-city-src'), ('evermore-city', 'cities/evermore-city-src'),
    ('zue-city', 'zue-city-src'), ('lumen-city', 'cities/lumen-city-src'),
    ('city-dashboard', 'cities/city-dashboard')])


def run(args, cwd=None, env=None):
    result = subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True)
    if result.returncode:
        raise ValueError(f'{args[0]} {args[1]} failed (exit {result.returncode})')
    return result.stdout


def bd(rig, *args):
    return run([BD, *args], cwd=rig, env=BD_ENV)


def snapshot(rig, tmp):
    beads = json.loads(bd(rig, 'list', '--all', '--json', '--limit', '0'))
    sessions = []
    for scope in ([], ['--rig', str(rig)]):
        data = json.loads(run([GC, 'session', 'list', '--json', '--city', CITY, *scope], cwd=rig))
        if not isinstance(data, dict) or not isinstance(data.get('sessions'), list):
            raise ValueError('invalid session snapshot')
        sessions.extend(data['sessions'])
    (tmp / 'beads.json').write_text(json.dumps(beads))
    (tmp / 'sessions.json').write_text(json.dumps({'sessions': sessions}))
    rows = run(['bash', '-c', 'source "$1"; lwr_root_state "$2" "$3" "$4" "$5"',
                'lwr', str(ROOT / 'scripts/lib/live-workflow-roots.sh'),
                str(tmp / 'beads.json'), str(tmp / 'sessions.json'), str(time.time()), str(HOURS)], cwd=rig)
    return {b['id']: b for b in beads}, [line.split() for line in rows.splitlines()]


def drain_children(beads, root, work, tmp, rig):
    children = run(['bash', '-c', 'source "$1"; lwr_drain_children "$2" "$3"',
                    'lwr', str(ROOT / 'scripts/lib/live-workflow-roots.sh'),
                    str(tmp / 'beads.json'), root], cwd=rig).splitlines()
    if not children:
        return []
    # Reuse conservative liveness rules for linked do-work roots, which the
    # capacity classifier normally excludes. Do not trust parent silence alone.
    projected = copy.deepcopy(beads)
    for child in children:
        bead = projected[child]
        metadata = bead['metadata']
        metadata.pop('gc.drain_member_id', None)
        metadata['gc.formula_name'] = 'implement'
        bead['labels'] = ['for:' + work]
        for step in projected.values():
            if (step.get('metadata') or {}).get('gc.root_bead_id') == child:
                step['labels'] = []
    (tmp / 'children.json').write_text(json.dumps(list(projected.values())))
    rows = run(['bash', '-c', 'source "$1"; lwr_root_state "$2" "$3" "$4" "$5"',
                'lwr', str(ROOT / 'scripts/lib/live-workflow-roots.sh'),
                str(tmp / 'children.json'), str(tmp / 'sessions.json'),
                str(time.time()), str(HOURS)], cwd=rig)
    states = {row[0]: row[1] for row in (line.split() for line in rows.splitlines())}
    if any(states.get(child) != 'dead' for child in children):
        raise ValueError('linked drain child is live or unknown')
    return children


def prepare(beads, rows, root, work, rig):
    matches = [row for row in rows if row[0] == root and row[1] == 'dead' and row[3] == work]
    if len(matches) != 1 or any(row[3] == work and row[0] != root and row[1] != 'dead' for row in rows):
        raise ValueError('root changed or work has another live/unknown run')
    source = beads[work]
    if source.get('status') not in ('open', 'in_progress'):
        raise ValueError('work is not open/in_progress; preserve completed or held work')
    metadata = source.get('metadata') or {}
    count = metadata.get('cc.dead_runs', '0')
    if isinstance(count, bool) or not str(count).isdigit():
        raise ValueError('invalid dead-run counter')
    count = int(count) + 1
    # Do not clear an unrelated owner. Only holders explicitly linked to this run qualify.
    driver = source.get('assignee') or ''
    holders = set()
    for b in beads.values():
        m = b.get('metadata') or {}
        if b['id'] == root or m.get('gc.root_bead_id') == root:
            holders.update(v for v in (b.get('assignee'), m.get('gc.session_id'), m.get('gc.session_name')) if v)
    if driver and driver not in holders:
        raise ValueError('work assigned to an unrelated holder')
    labels = source.get('labels') or []
    if not isinstance(labels, list) or not all(isinstance(v, str) for v in labels):
        raise ValueError('invalid work labels')
    # Verify the write target is readable and unchanged before any destructive call.
    shown = json.loads(bd(rig, 'show', work, '--json'))
    if isinstance(shown, list) and len(shown) == 1:
        shown = shown[0]
    if not isinstance(shown, dict) or any(shown.get(k) != source.get(k) for k in
            ('id', 'status', 'assignee', 'metadata', 'labels', 'updated_at')):
        raise ValueError('work changed since snapshot')
    evidence = 'No recorded worktree.'
    work_dir = metadata.get('work_dir')
    if work_dir:
        path = Path(work_dir).resolve(strict=True)
        allowed = (Path(rig) / 'worktrees').resolve()
        if not path.is_relative_to(allowed) or path == allowed:
            raise ValueError('worktree outside rig/worktrees; manual review required')
        top = run(['git', 'rev-parse', '--show-toplevel'], cwd=path).strip()
        if Path(top).resolve() != path:
            raise ValueError('not a worktree root')
        evidence = run(['git', 'log', '--oneline', '-n', '30', 'main..HEAD'], cwd=path).strip() or 'No commits ahead of main.'
    hours = matches[0][2]
    note = (f'Dead workflow {root}: silent {hours}h (threshold {HOURS:g}h); '
            f'previous driver={driver or "unassigned"}; cc.dead_runs={count}. '
            'Closed via gc workflow delete --force; preserved worktree and branch.\n'
            f'Worktree commits (main..HEAD, at most 30):\n{evidence}\n'
            'Workaround: gastownhall/gascity #5607/#6791/#2903/#7197.')
    if count >= 2:
        note += '\nEscalated to human: repeated dead workflow; automatic dispatch must stop.'
    args = ['update', work, '--if-status', source['status'], '--if-assignee', driver,
            '--status', 'open', '--assignee', '', '--set-metadata', f'cc.dead_runs={count}']
    if 'running' in labels:
        args += ['--remove-label', 'running']
    if count >= 2:
        args += ['--add-label', 'human']
    return args, note, hours, count


try:
    HOURS = float(os.environ.get('DEAD_AFTER_HOURS', '6'))
    MAX = int(os.environ.get('MAX_CLEAN_PER_RUN', '3'))
    if not math.isfinite(HOURS) or HOURS <= 0 or MAX < 0:
        raise ValueError('invalid threshold or limit')
    # Serialize real invocations across rigs without touching source/worktree files.
    if not DRY:
        lock = open(Path(tempfile.gettempdir()) / f'clean-dead-workflows-{os.getuid()}.lock', 'a')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('skip: another cleaner is running')
            sys.exit(0)
    rigs = os.environ.get('RIGS', DEFAULT_RIGS)
    if os.environ.get('RIG_DIR'):
        rigs = 'fixture=' + os.environ['RIG_DIR']
    cleaned = 0
    with tempfile.TemporaryDirectory(prefix='clean-dead-workflows-') as directory:
        tmp = Path(directory)
        for entry in rigs.split():
            name, rig = entry.split('=', 1)
            if not (Path(rig) / '.beads').is_dir():
                print(f'skip rig {name}: no beads')
                continue
            try:
                beads, rows = snapshot(rig, tmp)
            except Exception as error:
                print(f'skip rig {name}: {error}', file=sys.stderr)
                continue
            for root, state, hours, work in rows:
                if state != 'dead':
                    print(f'skip root {root}: {state}, silent={hours}h')
                    continue
                if cleaned >= MAX:
                    break
                try:
                    fresh, refreshed = snapshot(rig, tmp)
                    args, note, hours, count = prepare(fresh, refreshed, root, work, rig)
                    children = drain_children(fresh, root, work, tmp, rig)
                    note += "\nLinked drain children closed: " + (", ".join(children) or "none")
                except Exception as error:
                    print(f'skip root {root}: {error}', file=sys.stderr)
                    continue
                print(f'{"DRY_RUN: " if DRY else ""}delete-root {root} ({work}) silent={hours}h children={len(children)}'
                      + (' flag-human' if count >= 2 else ''), flush=True)
                if not DRY:
                    try:
                        for target in [root, *children]:
                            run([GC, 'workflow', 'delete', target, '--force', '--city', CITY, '--rig', rig], cwd=rig)
                    except Exception as error:
                        raise ValueError(f'{root}: deletion failed; human reconciliation required: {error}') from error
                    try:
                        bd(rig, *args)
                        bd(rig, 'comments', 'add', work, note)
                    except Exception as error:
                        raise ValueError(f'{root}: human reconciliation required after deletion: {error}') from error
                cleaned += 1
except Exception as error:
    print(f'clean-dead-workflows: {error}', file=sys.stderr)
    sys.exit(1)
PY
