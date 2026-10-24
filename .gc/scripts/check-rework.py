#!/usr/bin/env python3
"""Fixtures for city-4ikn1 / gascity-packs#209, without live writes."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rework', ROOT / 'packs/publish-gate/assets/scripts/rework.py')
rework = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rework)


class SnapshotTests(unittest.TestCase):
    def setUp(self):
        self.pr = dict(number=45, url='https://github.com/example/project/pull/45',
                       title='Fix source-123', headRefName='work/source-123', body='',
                       headRefOid='a' * 40, baseRefName='main', state='CLOSED',
                       mergedAt=None, closedAt='2026-10-21T10:00:00Z')
        self.prs = [self.pr]
        self.calls = []

    def fake(self, *args):
        self.calls.append(args)
        if args[:2] == ('bd', 'show'):
            return json.dumps([dict(id=args[2], issue_type='bug', metadata=(
                {'gc.rework_source_id': 'source-123'} if args[2] == 'item-1' else {}))])
        if args[:2] == ('bd', 'comments'):
            return json.dumps([{'id': 12, 'text': 'Closing review: test missing edge case'}])
        if args[:3] == ('gh', 'pr', 'list'):
            return json.dumps(self.prs)
        if args[:3] == ('gh', 'pr', 'view'):
            return json.dumps({'comments': [{'body': 'Fix race'}],
                               'reviews': [{'body': 'Changes required'}], 'body': 'original'})
        if args[:2] == ('gh', 'api'):
            return json.dumps([[{'body': 'Inline: handle empty input', 'html_url': 'https://example/comment/1'}]])
        raise AssertionError(args)

    def snapshot(self, bead='source-123'):
        with patch.object(rework, 'run', self.fake):
            return rework.snapshot(bead, 'example/project')

    def test_new_decomposition_item_reads_original_source_and_all_feedback(self):
        result = self.snapshot('item-1')
        self.assertEqual(result['source'], 'source-123')
        for text in ('test missing edge case', 'Fix race', 'Changes required', 'handle empty input'):
            self.assertIn(text, result['findings'])
        self.assertIn(('bd', 'comments', 'source-123', '--json'), self.calls)

    def test_exact_id_not_prefix_or_child(self):
        for suffix in ('4', '.1'):
            self.prs = [dict(self.pr, title=f'source-123{suffix}', headRefName='unrelated')]
            self.assertEqual(self.snapshot()['rejected'], [])

    def test_body_reference_and_multiple_rejections(self):
        self.prs = [dict(self.pr, title='Fix', headRefName='unrelated', body='Source: source-123'),
                    dict(self.pr, number=53, closedAt='2026-10-21T11:00:00Z')]
        self.assertEqual(len(self.snapshot()['rejected']), 2)
        self.assertEqual(sum(call[:3] == ('gh', 'pr', 'view') for call in self.calls), 2)

    def test_merge_supersedes_old_rejection(self):
        self.prs.append(dict(self.pr, state='MERGED', mergedAt='2026-10-21T12:00:00Z', number=54))
        self.assertEqual(self.snapshot()['rejected'], [])

    def test_open_replacement_blocks(self):
        self.prs.append(dict(self.pr, state='OPEN', number=54))
        with self.assertRaisesRegex(ValueError, 'open PR'):
            self.snapshot()

    def test_lookup_failure_is_not_no_rejection(self):
        with patch.object(rework, 'run', side_effect=subprocess.CalledProcessError(1, ['gh'])):
            with self.assertRaises(subprocess.CalledProcessError):
                rework.snapshot('source-123', 'example/project')

    def test_truncation_blocks(self):
        self.prs = [self.pr] * 1000
        with self.assertRaisesRegex(ValueError, 'truncated'):
            self.snapshot()


class GitTests(unittest.TestCase):
    def git(self, directory, *args):
        env = dict(os.environ, GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.test',
                   GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.test')
        return subprocess.run(['git', '-C', str(directory), *args], env=env, check=True,
                              capture_output=True, text=True).stdout.strip()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.remote = self.base / 'remote.git'
        self.repo = self.base / 'rig'
        self.remote.mkdir()
        self.git(self.remote, 'init', '--bare', '--initial-branch=main')
        self.repo.mkdir()
        self.git(self.repo, 'init', '--initial-branch=main')
        (self.repo / 'file').write_text('original')
        self.git(self.repo, 'add', 'file')
        self.git(self.repo, 'commit', '-m', 'base')
        self.git(self.repo, 'remote', 'add', 'origin', str(self.remote))
        self.git(self.repo, 'push', '-u', 'origin', 'main')
        self.worktree = self.repo / 'worktrees/source-123'
        self.git(self.repo, 'worktree', 'add', '-b', 'rejected', str(self.worktree))
        (self.worktree / 'file').write_text('rejected change')
        self.git(self.worktree, 'commit', '-am', 'rejected')
        self.rejected = self.git(self.worktree, 'rev-parse', 'HEAD')
        # Advance remote while launcher HEAD remains stale.
        self.writer = self.base / 'writer'
        self.git(self.base, 'clone', str(self.remote), str(self.writer))
        (self.writer / 'file').write_text('current remote base')
        self.git(self.writer, 'commit', '-am', 'new base')
        self.git(self.writer, 'push')
        self.current = self.git(self.writer, 'rev-parse', 'HEAD')
        self.evidence = {'rejected': [{'number': 45, 'baseRefName': 'main'}]}

    def prepare(self, dry_run=False):
        return rework.prepare(self.repo, self.worktree, self.evidence, dry_run)

    def test_restart_preserves_dirty_old_work_and_uses_current_remote_then_resumes(self):
        (self.worktree / 'untracked').write_text('keep me')
        (self.worktree / 'file').write_text('dirty rejected change')
        self.git(self.worktree, 'add', 'file')
        result = self.prepare()
        archive = Path(result['archive'])
        self.assertEqual(result['base'], self.current)
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), self.current)
        self.assertEqual((self.worktree / 'file').read_text(), 'current remote base')
        self.assertEqual(self.git(archive, 'rev-parse', 'HEAD'), self.rejected)
        self.assertEqual((archive / 'untracked').read_text(), 'keep me')
        self.assertEqual((archive / 'file').read_text(), 'dirty rejected change')
        self.assertIn('M  file', self.git(archive, 'status', '--porcelain'))
        (self.worktree / 'new').write_text('active rework')
        self.git(self.worktree, 'add', 'new')
        self.git(self.worktree, 'commit', '-m', 'new implementation')
        head = self.git(self.worktree, 'rev-parse', 'HEAD')
        self.assertEqual(self.prepare()['action'], 'resume')
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), head)

    def test_dry_run_does_not_fetch_or_move(self):
        before = self.git(self.repo, 'rev-parse', 'origin/main')
        self.assertEqual(self.prepare(True)['action'], 'restart')
        self.assertEqual(self.git(self.repo, 'rev-parse', 'origin/main'), before)
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), self.rejected)

    def test_new_item_without_existing_worktree_starts_at_remote(self):
        self.worktree = self.repo / 'worktrees/item-2'
        self.assertEqual(self.prepare()['base'], self.current)

    def test_foreign_path_and_archive_collision_fail_without_changes(self):
        foreign = self.repo / 'worktrees/foreign'
        foreign.mkdir()
        with self.assertRaisesRegex(ValueError, 'not a registered worktree'):
            rework.prepare(self.repo, foreign, self.evidence)
        self.worktree.with_name('source-123-rejected-pr45').mkdir()
        with self.assertRaisesRegex(ValueError, 'archive path'):
            self.prepare()
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), self.rejected)

    def test_missing_remote_base_preserves_old_worktree(self):
        self.evidence['rejected'][0]['baseRefName'] = 'missing'
        with self.assertRaises(subprocess.CalledProcessError):
            self.prepare()
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), self.rejected)

    def test_nondefault_target_branch(self):
        self.git(self.writer, 'push', 'origin', 'HEAD:refs/heads/release')
        self.evidence['rejected'][0]['baseRefName'] = 'release'
        self.assertEqual(self.prepare()['base'], self.current)

    def test_branch_collision_is_preserved(self):
        self.git(self.repo, 'branch', 'rework/source-123-pr45')
        with self.assertRaisesRegex(ValueError, 'already exists elsewhere'):
            self.prepare()
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), self.rejected)

    def test_no_rejection_leaves_existing_worktree(self):
        self.evidence['rejected'] = []
        self.assertEqual(self.prepare()['action'], 'normal')
        self.assertEqual(self.git(self.worktree, 'rev-parse', 'HEAD'), self.rejected)


if __name__ == '__main__':
    unittest.main()
