#!/usr/bin/env python3
"""Isolated safety/closure proofs; never connect to live bead stores."""

import contextlib
import copy
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'sweeper', Path(__file__).with_name('closed-workflow-sweeper.py'))
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


class SweeperTests(unittest.TestCase):
    def setUp(self):
        self.cutoff = dt.datetime(2026, 10, 17, tzinfo=dt.timezone.utc)
        self.old = '2026-10-14T00:00:00Z'
        self.db = {
            'p-root': {'id': 'p-root', 'status': 'open', 'updated_at': self.old,
                       'metadata': {'gc.kind': 'workflow', 'gc.input_convoy_id': 'p-convoy'}},
            'p-convoy': {'id': 'p-convoy', 'status': 'open', 'issue_type': 'convoy',
                         'title': 'input convoy for p-work', 'metadata': {},
                         'dependencies': [{'id': 'p-work', 'dependency_type': 'tracks'}]},
            'p-work': {'id': 'p-work', 'status': 'closed', 'issue_type': 'task', 'metadata': {}},
            'p-step': {'id': 'p-step', 'status': 'open', 'updated_at': self.old,
                       'metadata': {'gc.root_bead_id': 'p-root'}},
            'p-other': {'id': 'p-other', 'status': 'open', 'updated_at': self.old,
                        'metadata': {'gc.root_bead_id': 'p-live-root'}},
        }
        self.commands = []

    def show(self, rig, bead_id):
        return copy.deepcopy(self.db[bead_id])

    def rows(self, rig, predicate):
        if "'workflow'" in predicate:
            return [b for b in self.db.values() if b['metadata'].get('gc.kind') == 'workflow'
                    and b['status'] != 'closed']
        return [b for b in self.db.values() if b['metadata'].get('gc.root_bead_id') == 'p-root']

    def plan(self):
        with patch.object(s, 'show', self.show), patch.object(s, 'rows', self.rows):
            return s.plan('/rig', 'p-root', self.cutoff, {None, '', 'rig:p'})

    def sweep(self, dry):
        def run(args, rig):
            self.commands.append(args)
            self.db[args[2]]['status'] = 'closed'
            return ''
        with patch.object(s, 'show', self.show), patch.object(s, 'rows', self.rows), \
                patch.object(s, 'run', run), contextlib.redirect_stdout(io.StringIO()):
            s.sweep_rig('city', '/rig', self.cutoff, {None, '', 'rig:p'}, dry)

    def test_closes_only_owned_topology_root_last_and_is_idempotent(self):
        self.sweep(False)
        self.assertEqual([c[2] for c in self.commands], ['p-step', 'p-convoy', 'p-root'])
        for command in self.commands:
            self.assertEqual(command, [s.BD, 'close', command[2], '--force', '--reason', s.REASON])
        self.assertEqual(self.db['p-other']['status'], 'open')
        self.sweep(False)
        self.assertEqual(len(self.commands), 3)

    def test_dry_run_never_writes(self):
        before = copy.deepcopy(self.db)
        self.sweep(True)
        self.assertEqual(self.commands, [])
        self.assertEqual(self.db, before)

    def test_open_work_and_topology_anchors_preserved(self):
        for field, value in [('status', 'open'), ('status', 'in_progress'),
                             ('issue_type', 'convoy'), ('issue_type', 'epic'),
                             ('metadata', {'gc.kind': 'scope'}),
                             ('metadata', {'gc.root_bead_id': 'p-outer'}),
                             ('metadata', {'gc.step_id': 'implement'})]:
            with self.subTest(field=field, value=value):
                before = copy.deepcopy(self.db['p-work'])
                self.db['p-work'][field] = value
                self.assertIsNone(self.plan())
                self.db['p-work'] = before

    def test_nested_drain_and_cross_store_roots_preserved(self):
        for key, value in [('gc.drain_member_id', 'p-work'), ('gc.root_bead_id', 'p-outer'),
                           ('gc.root_store_ref', 'rig:elsewhere')]:
            with self.subTest(key=key):
                self.db['p-root']['metadata'][key] = value
                self.assertIsNone(self.plan())
                del self.db['p-root']['metadata'][key]

    def test_all_children_including_closed_children_must_be_old(self):
        for status in ['open', 'closed']:
            self.db['p-step'].update(status=status, updated_at='2026-10-17T01:00:00Z')
            self.assertIsNone(self.plan())

    def test_recent_root_preserved(self):
        self.db['p-root']['updated_at'] = '2026-10-17T01:00:00Z'
        self.assertIsNone(self.plan())

    def test_held_children_and_roots_preserved(self):
        for bead in ['p-root', 'p-step']:
            for status in ['blocked', 'deferred', 'pinned', 'review', 'testing']:
                with self.subTest(bead=bead, status=status):
                    self.db[bead]['status'] = status
                    self.assertIsNone(self.plan())
            self.db[bead]['status'] = 'open'

    def test_nested_or_foreign_children_preserve_entire_root(self):
        for meta in [{'gc.kind': 'workflow'}, {'gc.root_store_ref': 'rig:foreign'}]:
            self.db['p-step']['metadata'].update(meta)
            self.assertIsNone(self.plan())
            self.db['p-step']['metadata'] = {'gc.root_bead_id': 'p-root'}

    def test_title_and_singleton_ownership_both_required(self):
        self.db['p-convoy']['dependencies'].append({'id': 'p-other', 'dependency_type': 'tracks'})
        self.assertIsNone(self.plan())
        self.db['p-convoy']['dependencies'].pop()
        self.db['p-convoy']['title'] = 'custom convoy'
        self.assertIsNone(self.plan())

    def test_closed_convoy_is_supported(self):
        self.db['p-convoy']['status'] = 'closed'
        self.assertEqual(self.plan()['close'], ['p-step', 'p-root'])

    def test_invalid_child_ids_fail_closed(self):
        self.db['p-step']['id'] = "p-step' OR 1=1"
        with self.assertRaises(ValueError):
            self.plan()

    def test_partial_failure_keeps_root_discoverable(self):
        def fail(args, rig):
            raise RuntimeError('close failed')
        with patch.object(s, 'show', self.show), patch.object(s, 'rows', self.rows), \
                patch.object(s, 'run', fail):
            with self.assertRaises(RuntimeError):
                s.sweep_rig('city', '/rig', self.cutoff, {None, ''}, False)
        self.assertEqual(self.db['p-root']['status'], 'open')

    def test_reopened_work_at_recheck_prevents_writes(self):
        real_plan = s.plan
        calls = 0

        def race(*args):
            nonlocal calls
            calls += 1
            if calls == 2:
                self.db['p-work']['status'] = 'open'
            return real_plan(*args)

        with patch.object(s, 'show', self.show), patch.object(s, 'rows', self.rows), \
                patch.object(s, 'plan', race), patch.object(s, 'run') as command:
            s.sweep_rig('city', '/rig', self.cutoff, {None, ''}, False)
        command.assert_not_called()

    def test_both_storage_tiers_and_isolated_environment(self):
        with patch.object(s, 'run', return_value='[]') as command:
            s.rows('/rig', "status = 'open'")
        query = command.call_args.args[0][-1]
        self.assertIn('FROM issues', query)
        self.assertIn('FROM wisps', query)
        self.assertNotIn('BEADS_DIR', s.ENV)
        self.assertNotIn('GC_CITY', s.ENV)

    def test_machine_discovery_all_cities_hq_rigs_and_suspension(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            (home / '.gc').mkdir()
            (home / '.gc/cities.toml').write_text(''.join(
                f'[[cities]]\nname = "{name}"\npath = "{temp}"\n'
                for name in ['a', 'b', 'paused', 'unknown']))
            statuses = iter(['Suspended: no', 'Suspended: no', 'Suspended: yes', 'unknown'])

            def run(args, cwd):
                if args[1] == 'status':
                    return next(statuses)
                return json.dumps({'rigs': [
                    {'name': 'hq', 'path': temp, 'hq': True, 'suspended': False, 'beads': 'initialized'},
                    {'name': 'project', 'path': temp + '/.gc', 'suspended': False, 'beads': 'initialized'},
                    {'name': 'paused', 'path': temp + '/skip', 'suspended': True, 'beads': 'initialized'},
                ]})

            with patch.object(s.Path, 'home', return_value=home), \
                    patch.object(s, 'run', run), patch.object(s, 'sweep_rig') as sweep, \
                    patch.dict(s.os.environ, {'DRY_RUN': '1', 'STALE_HOURS': '6'}):
                self.assertEqual(s.main(), 0)
            self.assertEqual([c.args[0] for c in sweep.call_args_list], ['a', 'a', 'b', 'b'])
            self.assertTrue(all(c.args[-1] for c in sweep.call_args_list))
            self.assertIn('city:a', sweep.call_args_list[0].args[3])


if __name__ == '__main__':
    unittest.main()
