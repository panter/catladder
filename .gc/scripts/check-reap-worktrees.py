#!/usr/bin/env python3
"""Exercise cleanup refusals and removal against isolated real Git repositories."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('reaper', Path(__file__).with_name('reap-worktrees.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def call(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout.strip()


with tempfile.TemporaryDirectory() as tmp:
    home = Path(tmp).resolve()
    repo, remote, root = home / 'repo', home / 'remote.git', home / 'trees'
    root.mkdir()
    call('git', 'init', '--bare', str(remote))
    call('git', 'init', '-b', 'main', str(repo))
    m.git(repo, 'config', 'user.name', 'Test')
    m.git(repo, 'config', 'user.email', 'test@example.invalid')
    (repo / 'file').write_text('base\n')
    (repo / '.gitignore').write_text('node_modules/\nprivate/\n')
    m.git(repo, 'add', '.')
    m.git(repo, 'commit', '-m', 'base')
    m.git(repo, 'remote', 'add', 'origin', str(remote))
    m.git(repo, 'push', '-u', 'origin', 'main')
    tree = root / 'test-123'
    m.git(repo, 'worktree', 'add', '-b', 'work', str(tree))
    m.git(tree, 'push', '-u', 'origin', 'work')
    bead = {'id': 'test-123', 'status': 'closed', 'issue_type': 'task'}
    original_run = m.run

    def fake_run(args, **kwargs):
        if args[0] == 'bd':
            assert not any(k.startswith(('BEADS_', 'GC_')) for k in kwargs['env'])
            return json.dumps([bead])
        return original_run(args, **kwargs)

    def check():
        entries = m.records(repo)
        entry = next(e for e in entries if e['worktree'] == str(tree))
        return m.eligible(repo, root, entry, entries, 'refs/remotes/origin/main', repo)

    def refused():
        try:
            check()
        except (ValueError, subprocess.SubprocessError):
            assert tree.exists()
        else:
            raise AssertionError('unsafe tree accepted')

    with patch.object(m, 'run', fake_run):
        assert check() == tree
        m.git(repo, 'worktree', 'lock', str(tree))
        refused()
        m.git(repo, 'worktree', 'unlock', str(tree))
        (tree / 'file').write_text('stashed change')
        m.git(tree, 'stash', 'push')
        refused()
        m.git(tree, 'stash', 'pop')
        m.git(tree, 'restore', 'file')
        bead['status'] = 'open'
        refused()
        bead['status'] = 'closed'
        bead['metadata'] = {'gc.kind': 'workflow'}
        refused()
        bead.pop('metadata')
        bead['issue_type'] = 'convoy'
        refused()
        bead['issue_type'] = 'task'
        (tree / 'new').write_text('unsaved')
        refused()
        (tree / 'new').unlink()
        (tree / 'private').mkdir()
        (tree / 'private' / 'file').write_text('ignored unsaved')
        refused()
        (tree / 'private' / 'file').unlink()
        (tree / 'private').rmdir()
        (tree / 'node_modules').mkdir()
        (tree / 'node_modules' / 'package').write_text('generated')
        assert check() == tree
        (tree / 'file').write_text('unpublished\n')
        m.git(tree, 'commit', '-am', 'unpublished')
        refused()
        m.git(tree, 'push')
        refused()  # Pushed but not merged into the base.
        m.git(repo, 'merge', '--ff-only', 'work')
        m.git(repo, 'push')
        assert check() == tree
        entries = m.records(repo)
        entry = next(e for e in entries if e['worktree'] == str(tree))
        try:
            m.eligible(repo, root, entry, entries, 'refs/remotes/origin/main', repo, [tree])
        except ValueError:
            pass
        else:
            raise AssertionError('live cwd accepted')
        # Full CLI DRY_RUN=1 overrides --apply and leaves registration and files intact.
        with patch('sys.argv', ['reaper', '--repo', str(repo), '--root', str(root),
                                '--beads-dir', str(repo), '--apply']), patch.dict(os.environ, {'DRY_RUN': '1'}):
            m.main()
        assert tree.exists()
        with patch('sys.argv', ['reaper', '--repo', str(repo), '--root', str(root),
                                '--beads-dir', str(repo), '--apply']), patch.dict(os.environ, {'DRY_RUN': '0'}), patch.object(m, 'offline', return_value=[]):
            m.main()
        assert not tree.exists()
        assert all(e['worktree'] != str(tree) for e in m.records(repo))
        with patch('sys.argv', ['reaper', '--repo', str(repo), '--root', str(root),
                                '--beads-dir', str(repo)]):
            m.main()  # Repeated cleanup has no candidate.
print('OK: cleanup safety gates, dry-run, Git removal and idempotency')
