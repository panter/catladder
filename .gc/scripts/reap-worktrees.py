#!/usr/bin/env python3
"""Offline legacy worktree cleanup; workaround for gascity #5760/#6718.

Remove when native reaping covers configured legacy roots with equivalent gates.
Only git worktree remove is used; no force, branch deletion, or filesystem fallback.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def run(args, cwd=None, env=None):
    return subprocess.run(args, cwd=cwd, env=env, text=True,
                          capture_output=True, timeout=30, check=True).stdout.strip()


def git(repo, *args):
    return run(['git', '-C', str(repo), *args])


def records(repo):
    result = []
    for block in git(repo, 'worktree', 'list', '--porcelain').split('\n\n'):
        result.append(dict(line.split(' ', 1) if ' ' in line else (line, '')
                           for line in block.splitlines()))
    return result


def real_work(bead, bead_id):
    meta = bead.get('metadata') or {}
    return (bead.get('id') == bead_id and bead.get('status') == 'closed'
            and bead.get('issue_type') in ('task', 'bug', 'feature', 'chore')
            and not any(key in meta for key in
                        ('gc.kind', 'gc.root_bead_id', 'gc.step_id', 'gc.scope_role'))
            and not set(bead.get('labels') or []) & {'gc-workflow', 'workflow', 'molecule'}
            and not bead.get('title', '').startswith(('mol-', 'sling-', 'input convoy')))


def offline():
    probe = subprocess.run(['pgrep', '-f', 'gc supervisor'], capture_output=True)
    if probe.returncode != 1:
        raise ValueError('supervisor running or supervisor probe unavailable')
    probe = subprocess.run(['lsof', '-a', '-u', str(os.getuid()), '-d', 'cwd', '-Fn'],
                           capture_output=True, text=True, timeout=30)
    if probe.returncode != 0 or probe.stderr.strip():
        raise ValueError('incomplete process cwd scan')
    return [Path(line[1:]).resolve() for line in probe.stdout.splitlines()
            if line.startswith('n/')]


def eligible(repo, root, entry, all_entries, base, beads_dir, live=None):
    path = Path(entry['worktree'])
    resolved = path.resolve(strict=True)
    if path != resolved or not resolved.is_relative_to(root) or resolved == root:
        raise ValueError('outside root or symlinked path')
    if resolved == repo or resolved == Path.cwd().resolve():
        raise ValueError('repository or current worktree')
    if any(Path(e['worktree']) != path and Path(e['worktree']).is_relative_to(path)
           for e in all_entries):
        raise ValueError('contains another registered worktree')
    bead_id = path.name
    if not re.fullmatch(r'[a-z][a-z0-9]*-[a-zA-Z0-9]+(?:\.[0-9]+)*', bead_id):
        raise ValueError('path does not name a work bead')
    # Do not let the invoking worker route reads to its own runtime database.
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(('BEADS_', 'GC_'))}
    bead = json.loads(run(['bd', '-C', str(beads_dir), '--readonly', 'show', bead_id,
                           '--json'], env=env))
    if isinstance(bead, list):
        if len(bead) != 1:
            raise ValueError('ambiguous bead response')
        bead = bead[0]
    if not real_work(bead, bead_id):
        raise ValueError('not a closed real-work bead')
    branch = entry.get('branch', '')
    if not branch.startswith('refs/heads/') or 'locked' in entry or 'prunable' in entry:
        raise ValueError('detached, locked, or prunable worktree')
    if git(path, 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('dirty or untracked work')
    ignored = git(path, 'ls-files', '--others', '--ignored', '--exclude-standard').splitlines()
    if any('node_modules' not in Path(p).parts for p in ignored):
        raise ValueError('ignored files outside node_modules need manual review')
    if git(path, 'stash', 'list'):
        raise ValueError('repository has stashes')
    head = git(path, 'rev-parse', 'HEAD')
    if head != entry['HEAD']:
        raise ValueError('HEAD changed during scan')
    upstream = git(path, 'rev-parse', '--symbolic-full-name', '@{upstream}')
    for ref in (upstream, base):
        if not ref.startswith('refs/remotes/'):
            raise ValueError('upstream/base must be remote-tracking branches')
        remote, name = ref[len('refs/remotes/'):].split('/', 1)
        oid = git(path, 'rev-parse', ref)
        actual = git(path, 'ls-remote', '--exit-code', remote, 'refs/heads/' + name).split()
        if len(actual) != 2 or actual[0] != oid:
            raise ValueError('remote ref missing or local tracking ref stale')
        git(path, 'merge-base', '--is-ancestor', head, ref)
    if live is not None and any(p == path or p.is_relative_to(path) for p in live):
        raise ValueError('live process inside worktree')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', type=Path, required=True)
    parser.add_argument('--root', type=Path, required=True, help='explicit legacy cleanup boundary')
    parser.add_argument('--beads-dir', type=Path, required=True, help='rig bead database directory')
    parser.add_argument('--base', default='refs/remotes/origin/main')
    parser.add_argument('--apply', action='store_true', help='remove eligible trees; stop supervisor/workers first')
    args = parser.parse_args()
    repo = args.repo.resolve(strict=True)
    root = args.root.resolve(strict=True)
    beads_dir = args.beads_dir.resolve(strict=True)
    if root == repo or root in repo.parents:
        parser.error('cleanup root must not contain repository checkout')
    apply = args.apply and os.environ.get('DRY_RUN') != '1'
    entries = records(repo)
    for entry in entries:
        path = Path(entry['worktree'])
        if not path.is_relative_to(root) or path == root:
            continue
        try:
            eligible(repo, root, entry, entries, args.base, beads_dir)
            if apply:
                # Re-read every gate immediately before non-forced Git removal.
                eligible(repo, root, entry, records(repo), args.base, beads_dir, offline())
                git(repo, 'worktree', 'remove', str(path))
            print(('REMOVED' if apply else 'WOULD_REMOVE') + ' ' + str(path))
        except (ValueError, OSError, KeyError, TypeError, subprocess.SubprocessError) as exc:
            reason = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
            print('SKIP ' + str(path) + ': ' + reason)
    return 0


if __name__ == '__main__':
    sys.exit(main())
