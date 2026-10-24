#!/usr/bin/env python3
"""Route human questions without claiming work or advancing workflow beads."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess


def run(*args, json_output=False):
    # Let gc select each store; never inherit the order's/session's beads routing.
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(('BEADS_', 'GC_'))}
    result = subprocess.run(args, check=True, text=True, capture_output=True,
                            env=env, timeout=60)
    return json.loads(result.stdout) if json_output else result.stdout


def real_question(bead):
    meta = bead.get('metadata') or {}
    labels = bead.get('labels') or []
    return (bead.get('status') in ('open', 'in_progress', 'blocked', 'deferred')
            and bead.get('issue_type') in ('task', 'feature', 'bug', 'chore', 'decision')
            and 'question' in labels and 'human' in labels
            and not any(k in meta for k in
                        ('gc.root_bead_id', 'gc.formula_name', 'gc.kind', 'gc.synthetic_kind'))
            and 'gc-workflow' not in labels
            and not bead.get('title', '').startswith(('mol-', 'sling-', 'input convoy for ')))


def question(comments, authors):
    human = [c for c in comments if c.get('author') in authors]
    if not human:
        return None
    latest = sorted(human, key=lambda c: (c.get('created_at', ''), str(c.get('id', ''))))[-1]
    text = latest.get('text', latest.get('body', ''))
    token = hashlib.sha256(json.dumps([latest.get('id'), latest.get('created_at'), text],
                                     ensure_ascii=False).encode()).hexdigest()
    return token, text


def stores(args):
    cities = (run(args.gc, 'cities', 'list', '--json', json_output=True)['cities']
              if args.all_cities else [{'path': args.city}])
    seen = set()
    for city in cities:
        path = city['path']
        rigs = run(args.gc, 'rig', 'list', '--city', path, '--json', json_output=True)['rigs']
        for rig in rigs:
            if args.rig and rig['name'] != args.rig:
                continue
            key = str(Path(rig['path']).resolve())
            if key in seen or rig.get('beads') != 'initialized':
                continue
            seen.add(key)
            yield path, '' if rig.get('hq') else rig['name'], key


def route(args):
    failed = 0
    for city, rig, rig_path in stores(args):
        try:
            route_store(args, city, rig, rig_path)
        except (subprocess.SubprocessError, ValueError, KeyError) as exc:
            # One unreachable store must not stop routing for the other cities.
            print(f"ALERT question-router {rig_path}: {type(exc).__name__}")
            failed = 1
    return failed


def route_store(args, city, rig, rig_path):
    bd = [args.gc, 'bd', '--city', city] + (['--rig', rig] if rig else [])
    beads = run(*bd, 'list', '--label', 'question', '--label', 'human',
                '--limit', '0', '--json', json_output=True)
    for bead in beads:
        if not real_question(bead):
            continue
        comments = run(*bd, 'comments', bead['id'], '--json', json_output=True)
        q = question(comments, args.human_author)
        if not q:
            print(f"skip {bead['id']}: no recognized human question comment")
            continue
        token, text = q
        if (bead.get('metadata') or {}).get('question.notified') == token:
            continue
        # Configuration rigs in the city-city are owned there, including upstream drafts.
        target_city = (args.city_city if 'upstream-issue' in bead.get('labels', [])
                       or Path(city).resolve() == Path(args.city_city).resolve() else city)
        recipient = args.city_city_recipient if target_city == args.city_city else args.mayor
        print(f"question {bead['id']} ({rig_path}) -> {target_city}:{recipient} [{token}]")
        if args.dry_run:
            continue
        body = (f"Human question on {bead['id']}: {bead.get('title', '')}\n"
                f"Source city: {city}\nSource rig: {rig}\nQuestion token: {token}\n\n{text}\n\n"
                "Read this bead's comments, plan/review artifacts and relevant code, then post an answer "
                "as a comment on the SOURCE bead. Do not implement, approve, close or dispatch it. "
                "Re-read its human comments before answering; if the question changed, answer the new one. "
                "Only after posting the answer, remove label question and add label answered on that bead. "
                "Leave unanswered questions labelled question. maw removes answered when acting.\n"
                f"Commands use: gc bd --city {city}" + (f" --rig {rig}" if rig else ""))
        run(args.gc, 'mail', 'send', recipient, '--city', target_city,
            '--subject', f"Question: {bead['id']}", '--message', body,
            '--notify', '--dedup', f"question:{rig_path}:{bead['id']}:{token}")
        run(*bd, 'update', bead['id'], '--set-metadata', f'question.notified={token}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gc', default='gc')
    parser.add_argument('--city', default=str(Path.home() / 'git/maw-city'))
    parser.add_argument('--rig')
    parser.add_argument('--all-cities', action='store_true')
    parser.add_argument('--city-city', default=str(Path.home() / 'git/maw-city'))
    parser.add_argument('--mayor', default='mayor')
    parser.add_argument('--city-city-recipient', default='mayor')
    parser.add_argument('--human-author', action='append', default=['human', 'maw', 'Marco Wettstein'])
    parser.add_argument('--dry-run', action='store_true', default=os.environ.get('DRY_RUN') == '1')
    args = parser.parse_args()
    if args.dry_run:
        return route(args)
    # Serialize the all-city order and city-watch callers on this machine.
    state = Path.home() / '.local/state/maw-city'
    state.mkdir(parents=True, exist_ok=True)
    with (state / 'question-router.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        return route(args)


if __name__ == '__main__':
    raise SystemExit(main())
