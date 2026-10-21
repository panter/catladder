#!/usr/bin/env python3
"""Machine-level cleanup for abandoned workflows of closed work beads.

Related upstream: gastownhall/gascity#3122 (reaper preserves live descendants
and skips history-backed roots outside the city store). Remove this workaround
when an adopted release cleans closed-work-anchor workflows in every rig.
No deployment or mail is performed by this script. DRY_RUN=1 is read-only.
"""

import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib

GC = '/opt/homebrew/opt/gascity/bin/gc'
BD = '/opt/homebrew/bin/bd'
ENV = {'HOME': str(Path.home()),
       'PATH': '/opt/homebrew/bin:/usr/bin:/bin:' + str(Path.home() / '.local/bin')}
ID = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]*')
OPEN = {'open', 'hooked', 'in_progress'}
REASON = 'closed work anchor; stale workflow cleanup (gascity#3122)'


def run(args, cwd):
    result = subprocess.run(args, cwd=cwd, env=ENV, text=True,
                            capture_output=True, timeout=120)
    if result.returncode:
        # Do not echo arbitrary CLI output into machine logs.
        raise RuntimeError(f'{Path(args[0]).name} {args[1]} exited {result.returncode}')
    return result.stdout


def valid_id(value):
    return isinstance(value, str) and ID.fullmatch(value) is not None


def metadata(bead):
    value = bead.get('metadata') or {}
    value = json.loads(value) if isinstance(value, str) else value
    if not isinstance(value, dict):
        raise ValueError('invalid bead metadata')
    return value


def show(rig, bead_id):
    if not valid_id(bead_id):
        raise ValueError('invalid bead id')
    data = json.loads(run([BD, 'show', bead_id, '--json'], rig))
    if isinstance(data, list):
        if len(data) != 1:
            raise ValueError('ambiguous bead lookup')
        data = data[0]
    if not isinstance(data, dict) or data.get('id') != bead_id:
        raise ValueError('bead lookup mismatch')
    return data


def rows(rig, predicate):
    # Both storage tiers matter. A missing table/schema aborts this rig safely.
    query = ' UNION ALL '.join(
        f'SELECT id,status,updated_at,metadata FROM {table} WHERE {predicate}'
        for table in ('issues', 'wisps'))
    data = json.loads(run([BD, 'sql', '--json', query], rig))
    return data if isinstance(data, list) else data['rows']


def stale(bead, cutoff):
    stamp = dt.datetime.fromisoformat(bead['updated_at'].replace('Z', '+00:00'))
    if stamp.tzinfo is None:
        raise ValueError('timestamp lacks timezone')
    return stamp < cutoff


def plan(rig, root_id, cutoff, store_refs):
    root = show(rig, root_id)
    meta = metadata(root)
    if (root.get('status') not in OPEN or meta.get('gc.kind') != 'workflow'
            or meta.get('gc.drain_member_id') or meta.get('gc.root_bead_id')
            or meta.get('gc.root_store_ref') not in store_refs
            or not stale(root, cutoff)):
        return None
    convoy_id = meta.get('gc.input_convoy_id')
    if not valid_id(convoy_id) or convoy_id == root_id:
        return None
    convoy = show(rig, convoy_id)
    if (convoy.get('issue_type') != 'convoy'
            or metadata(convoy).get('gc.synthetic_kind') == 'drain-unit-convoy'):
        return None
    match = re.fullmatch(r'input convoy for ([A-Za-z0-9][A-Za-z0-9._-]*)',
                         convoy.get('title', ''))
    if not match:
        return None
    work_id = match[1]
    work = show(rig, work_id)
    wm = metadata(work)
    if (work.get('status') != 'closed' or wm.get('gc.kind')
            or wm.get('gc.root_bead_id') or wm.get('gc.step_id')
            or wm.get('gc.formula_contract')
            or work.get('issue_type') not in {'task', 'bug', 'feature', 'chore', 'story'}):
        return None
    # Require the exact singleton ownership edge as well as the generated title.
    edges = convoy.get('dependencies', [])
    if len(edges) != 1 or edges[0].get('id') != work_id or edges[0].get('dependency_type') != 'tracks':
        return None
    children = rows(rig, f"json_unquote(json_extract(metadata, '$.\"gc.root_bead_id\"')) = '{root_id}'")
    seen = {root_id, convoy_id, work_id}
    close = []
    for child in children:
        child_id = child.get('id')
        if not valid_id(child_id) or child_id in seen:
            raise ValueError('invalid or duplicate child id')
        seen.add(child_id)
        cm = metadata(child)
        # Nested workflows need their own subtree traversal; preserve the lot.
        if (not stale(child, cutoff) or cm.get('gc.kind') == 'workflow'
                or cm.get('gc.root_store_ref') not in store_refs):
            return None
        if child.get('status') != 'closed':
            if child.get('status') not in OPEN:
                return None
            close.append(child_id)
    # Close the root LAST: partial failures remain discoverable on the next run.
    if convoy.get('status') != 'closed':
        if convoy.get('status') not in OPEN:
            return None
        close.append(convoy_id)
    close.append(root_id)
    return {'work': work_id, 'close': close}


def sweep_rig(city_name, rig, cutoff, store_refs, dry):
    roots = rows(rig, "status IN ('open','hooked','in_progress') AND "
                 "json_unquote(json_extract(metadata, '$.\"gc.kind\"')) = 'workflow'")
    if dry:
        print(f'DRY_RUN closed-workflow-sweeper: {city_name}/{Path(rig).name}: '
              f'inspecting {len(roots)} open workflow roots')
    for row in roots:
        root_id = row.get('id')
        candidate = plan(rig, root_id, cutoff, store_refs)
        if candidate is None:
            continue
        if not dry:
            # Re-read ownership, closed work status and all timestamps before writes.
            if plan(rig, root_id, cutoff, store_refs) != candidate:
                continue
            for bead_id in candidate['close']:
                run([BD, 'close', bead_id, '--force', '--reason', REASON], rig)
        verb = 'would close' if dry else 'closed'
        print(f'INFO closed-workflow-sweeper: {city_name}/{Path(rig).name}: '
              f'{verb} workflow {root_id} for closed work {candidate["work"]}: '
              + ', '.join(candidate['close']))


def main():
    hours = float(os.environ.get('STALE_HOURS', '6'))
    if not math.isfinite(hours) or hours <= 0:
        raise ValueError('STALE_HOURS must be positive and finite')
    cutoff = dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=hours)
    dry = os.environ.get('DRY_RUN', '0') == '1'
    registry = Path.home() / '.gc/cities.toml'
    failures = 0
    with registry.open('rb') as stream:
        cities = tomllib.load(stream)['cities']
    for city in cities:
        try:
            status = run([GC, 'status', '--city', city['path']], city['path'])
            # Unknown suspension state must never permit cleanup.
            if not re.search(r'Suspended:\s+no\b', status):
                continue
            rigs = json.loads(run([GC, 'rig', 'list', '--city', city['path'], '--json'],
                                  city['path']))['rigs']
            seen = set()
            for rig in rigs:
                path = rig.get('path')
                if (not path or path in seen or rig.get('suspended', True)
                        or rig.get('beads') != 'initialized' or not Path(path).is_dir()):
                    continue
                seen.add(path)
                refs = {None, '', 'rig:' + rig['name']}
                if rig.get('hq'):
                    refs.add('city:' + city['name'])
                try:
                    sweep_rig(city['name'], path, cutoff, refs, dry)
                except Exception as error:
                    failures += 1
                    print(f'WARN closed-workflow-sweeper: {city["name"]}/{rig["name"]}: {error}',
                          file=sys.stderr)
        except Exception as error:
            failures += 1
            print(f'WARN closed-workflow-sweeper: {city["name"]}: {error}', file=sys.stderr)
    return int(failures > 0)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(f'WARN closed-workflow-sweeper: {error}', file=sys.stderr)
        sys.exit(1)
