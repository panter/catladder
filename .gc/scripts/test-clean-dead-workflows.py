#!/usr/bin/env python3
"""Run the real cleaner against isolated CLI and Git fixtures; no live writes."""
import copy
import datetime
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().with_name('clean-dead-workflows.sh')
STUB = '''#!/usr/bin/env python3
import json, os, pathlib, sys
p = pathlib.Path(__file__).parent
state = p / 'state.json'
d = json.loads(state.read_text())
a = sys.argv[1:]
kind = pathlib.Path(sys.argv[0]).name
with (p/'calls.jsonl').open('a') as f:
    f.write(json.dumps([kind, a, sorted(k for k in os.environ if k.startswith(('BEADS_', 'GC_', 'DOLT_')))])+'\\n')
key = kind + ':' + ':'.join(a[:2])
if d.get('fail') == key or (kind == 'gc' and a[:2] == ['workflow','delete'] and d.get('fail_delete') == a[2]): sys.exit(1)
if d.get('bad') == key:
    print('invalid-json'); sys.exit(0)
if kind == 'gc':
    if a[:2] == ['session','list']:
        print(json.dumps({'sessions':[{'id':'old-session','closed':True}]}))
    elif a[:2] == ['workflow','delete']:
        assert '--force' in a and '--delete' not in a
        for b in d['beads']:
            if b['id'] == a[2] or b.get('metadata',{}).get('gc.root_bead_id') == a[2]:
                b['status']='closed'
        state.write_text(json.dumps(d))
    else: sys.exit(2)
else:
    if a[0] == 'list':
        d['reads'] = d.get('reads',0)+1
        if d.get('refresh_live') and d['reads'] > 1:
            d['beads'][1]['status']='in_progress'
        state.write_text(json.dumps(d))
        print(json.dumps(d['beads']))
    elif a[0] == 'show':
        print(json.dumps([b for b in d['beads'] if b['id']==a[1]]))
    elif a[0] == 'update':
        b = next(b for b in d['beads'] if b['id']==a[1])
        def arg(k): return a[a.index(k)+1]
        if b['status'] != arg('--if-status') or b.get('assignee','') != arg('--if-assignee'): sys.exit(13)
        b['status']=arg('--status'); b['assignee']=arg('--assignee')
        k,v=arg('--set-metadata').split('=',1); b['metadata'][k]=v
        if '--remove-label' in a: b['labels'].remove(arg('--remove-label'))
        if '--add-label' in a and arg('--add-label') not in b['labels']: b['labels'].append(arg('--add-label'))
        state.write_text(json.dumps(d))
    elif a[:2] == ['comments','add']:
        d.setdefault('comments',[]).append(a[3]); state.write_text(json.dumps(d))
    else: sys.exit(2)
'''


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.rig = self.root / 'rig'
        (self.rig / '.beads').mkdir(parents=True)
        for cli in ('gc', 'bd'):
            p = self.root / cli
            p.write_text(STUB)
            p.chmod(0o755)
        old = '2020-01-01T00:00:00Z'
        self.data = {'beads': [
            {'id': 'root', 'status': 'open', 'created_at': old,
             'labels': ['for:work'], 'metadata': {'gc.kind': 'workflow', 'gc.formula_name': 'implement'}},
            {'id': 'step', 'status': 'open', 'updated_at': old, 'assignee': 'old-session',
             'metadata': {'gc.root_bead_id': 'root'}},
            {'id': 'work', 'issue_type': 'task', 'status': 'in_progress', 'assignee': 'old-session',
             'metadata': {}, 'labels': ['running', 'approved']} ]}
        self.env = {**os.environ, 'GC': str(self.root/'gc'), 'BD_BIN': str(self.root/'bd'),
                    'RIG_DIR': str(self.rig), 'CITY_DIR': str(self.rig), 'DRY_RUN': '0',
                    'BEADS_DIR': '/wrong-db', 'DOLT_SERVER_PORT': '1',
                    'DEAD_AFTER_HOURS': '6', 'MAX_CLEAN_PER_RUN': '3',
                    'TMPDIR': str(self.root)}

    def execute(self, dry=False):
        (self.root/'state.json').write_text(json.dumps(self.data))
        result = subprocess.run(['bash', str(SCRIPT)], env={**self.env, 'DRY_RUN': '1' if dry else '0'},
                                capture_output=True, text=True)
        self.data = json.loads((self.root/'state.json').read_text())
        return result

    def calls(self):
        return [json.loads(line) for line in (self.root/'calls.jsonl').read_text().splitlines()]

    def writes(self):
        return [c for c in self.calls() if c[1][0] in ('update','comments') or c[1][:2]==['workflow','delete']]

    def test_cleanup_and_rerun(self):
        self.assertEqual(self.execute().returncode, 0)
        work = self.data['beads'][2]
        self.assertEqual(work['status'], 'open')
        self.assertEqual(work['assignee'], '')
        self.assertEqual(work['metadata']['cc.dead_runs'], '1')
        self.assertEqual(work['labels'], ['approved'])
        self.assertIn('root', self.data['comments'][0])
        self.assertIn('#7197', self.data['comments'][0])
        self.assertEqual(len(self.writes()), 3)
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(len(self.writes()), 3)
        self.assertTrue(all(not c[2] for c in self.calls() if c[0]=='bd'))

    def test_second_dead_escalates(self):
        self.data['beads'][2]['metadata']['cc.dead_runs']='1'
        self.assertEqual(self.execute().returncode, 0)
        self.assertIn('human', self.data['beads'][2]['labels'])
        self.assertIn('repeated dead', self.data['comments'][0])

    def test_dry_run(self):
        before = copy.deepcopy(self.data['beads'])
        result = self.execute(dry=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn('DRY_RUN: delete-root root (work)', result.stdout)
        self.assertEqual(before, self.data['beads'])
        self.assertEqual(self.writes(), [])

    def test_failed_or_invalid_reads_do_not_delete(self):
        original = copy.deepcopy(self.data)
        for mode, command in [('fail', 'gc:session:list'), ('bad','gc:session:list'),
                              ('fail','bd:list:--all'), ('bad','bd:list:--all'),
                              ('fail','bd:show:work'), ('bad','bd:show:work')]:
            with self.subTest(mode=mode, command=command):
                self.data = {**copy.deepcopy(original), mode: command}
                self.assertEqual(self.execute().returncode, 0)
                self.assertEqual(self.writes(), [])

    def test_refresh_live(self):
        self.data['refresh_live']=True
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(self.writes(), [])

    def test_other_owner_completed_work_and_bad_counter(self):
        original = copy.deepcopy(self.data)
        for key, value in [('assignee','human-owner'), ('status','closed'), ('metadata',{'cc.dead_runs':'oops'})]:
            self.data = copy.deepcopy(original)
            self.data['beads'][2][key]=value
            self.assertEqual(self.execute().returncode, 0)
            self.assertEqual(self.writes(), [])

    def test_delete_failure_and_post_delete_failure(self):
        self.data['fail']='gc:workflow:delete'
        self.assertEqual(self.execute().returncode, 1)
        self.assertTrue(all(c[0]=='gc' for c in self.writes()))
        self.data['fail']='bd:update:work'
        result = self.execute()
        self.assertEqual(result.returncode, 1)
        self.assertIn('human reconciliation required', result.stderr)
        self.assertNotIn('comments', self.data)

    def test_worktree_and_branch_unchanged(self):
        checkout = self.rig/'worktrees'/'owned'
        checkout.mkdir(parents=True)
        def git(*args):
            return subprocess.check_output(['git', *args], cwd=checkout, text=True).strip()
        git('init','-q','-b','main')
        git('config','user.email','fixture@example.invalid')
        git('config','user.name','Fixture')
        (checkout/'tracked').write_text('base')
        git('add','tracked'); git('commit','-qm','base')
        git('checkout','-qb','work')
        (checkout/'tracked').write_text('committed')
        git('commit','-qam','preserved work')
        (checkout/'untracked').write_text('keep')
        before = (git('rev-parse','HEAD'), git('status','--porcelain'), git('branch','--show-current'))
        self.data['beads'][2]['metadata']['work_dir']=str(checkout)
        self.assertEqual(self.execute().returncode, 0)
        self.assertIn('preserved work', self.data['comments'][0])
        self.assertEqual(before, (git('rev-parse','HEAD'), git('status','--porcelain'), git('branch','--show-current')))
        self.assertEqual((checkout/'untracked').read_text(), 'keep')

    def test_another_live_run_keeps_work(self):
        root = copy.deepcopy(self.data['beads'][0])
        root['id'] = 'live-root'
        root['created_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.data['beads'].append(root)
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(self.writes(), [])

    def test_recent_root_unknown_work_and_outside_worktree(self):
        original = copy.deepcopy(self.data)
        cases = ['recent', 'unresolved', 'outside']
        for case in cases:
            self.data = copy.deepcopy(original)
            if case == 'recent':
                self.data['beads'][1]['updated_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            elif case == 'unresolved':
                self.data['beads'][0]['labels'] = []
            else:
                self.data['beads'][2]['metadata']['work_dir'] = str(self.root)
            self.assertEqual(self.execute().returncode, 0)
            self.assertEqual(self.writes(), [])

    def add_drain_children(self):
        old = '2020-01-01T00:00:00Z'
        self.data['beads'] += [
            {'id': 'control', 'status': 'closed', 'updated_at': old,
             'metadata': {'gc.root_bead_id': 'root'}},
            {'id': 'child', 'status': 'open', 'created_at': old,
             'metadata': {'gc.kind': 'workflow', 'gc.formula_name': 'do-work',
                          'gc.drain_member_id': 'work', 'gc.drain_control_id': 'control'}},
            {'id': 'direct', 'status': 'open', 'created_at': old,
             'metadata': {'gc.kind': 'workflow', 'gc.formula_name': 'do-work',
                          'gc.drain_control_id': 'root'}},
            {'id': 'nested', 'status': 'open', 'created_at': old,
             'metadata': {'gc.kind': 'workflow', 'gc.formula_name': 'do-work',
                          'gc.drain_member_id': 'child'}},
            {'id': 'foreign', 'status': 'open', 'created_at': old,
             'metadata': {'gc.kind': 'workflow', 'gc.formula_name': 'do-work',
                          'gc.drain_member_id': 'work', 'gc.drain_control_id': 'foreign-control'}},
            {'id': 'not-root', 'status': 'open', 'updated_at': old,
             'metadata': {'gc.drain_control_id': 'root'}},
        ]

    def test_linked_children_closed_and_foreign_untouched(self):
        self.add_drain_children()
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('children=3', result.stdout)
        deleted = [c[1][2] for c in self.writes() if c[0] == 'gc']
        self.assertEqual(deleted, ['root', 'child', 'direct', 'nested'])
        beads = {b['id']: b for b in self.data['beads']}
        self.assertEqual(beads['foreign']['status'], 'open')
        self.assertEqual(beads['not-root']['status'], 'open')
        self.assertFalse(any(b['status'] != 'closed' and
                             b.get('metadata', {}).get('gc.kind') == 'workflow' and
                             b.get('metadata', {}).get('gc.drain_control_id') in ('control', 'root')
                             for b in beads.values()))
        writes = len(self.writes())
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(len(self.writes()), writes)

    def test_child_delete_failure_requires_reconciliation(self):
        self.add_drain_children()
        self.data['fail_delete'] = 'child'
        result = self.execute()
        self.assertEqual(result.returncode, 1)
        self.assertIn('human reconciliation required', result.stderr)
        self.assertEqual([c[1][2] for c in self.writes() if c[0] == 'gc'], ['root', 'child'])
        self.assertFalse(any(c[0] == 'bd' for c in self.writes()))

    def test_children_dry_run(self):
        self.add_drain_children()
        before = copy.deepcopy(self.data['beads'])
        result = self.execute(dry=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('children=3', result.stdout)
        self.assertEqual(self.data['beads'], before)
        self.assertEqual(self.writes(), [])

    def test_active_or_unknown_child_prevents_parent_deletion(self):
        self.add_drain_children()
        original = copy.deepcopy(self.data)
        for case in ('recent', 'running', 'claimable', 'unknown'):
            with self.subTest(case=case):
                self.data = copy.deepcopy(original)
                child = next(b for b in self.data['beads'] if b['id'] == 'child')
                if case == 'recent':
                    child['created_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                elif case == 'unknown':
                    child.pop('created_at')
                else:
                    self.data['beads'].append({
                        'id': 'child-step', 'status': 'in_progress' if case == 'running' else 'open',
                        'updated_at': '2020-01-01T00:00:00Z',
                        'metadata': {'gc.root_bead_id': 'child'}})
                self.assertEqual(self.execute().returncode, 0)
                self.assertEqual(self.writes(), [])

    def test_limit_zero(self):
        self.env['MAX_CLEAN_PER_RUN']='0'
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(self.writes(), [])


if __name__ == '__main__':
    unittest.main()
