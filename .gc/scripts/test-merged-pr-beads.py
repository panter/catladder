#!/usr/bin/env python3
"""Exercise merge reconciliation through the dispatcher with isolated CLI fixtures."""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().with_name('city-dispatch.sh')
STUB = '''#!/usr/bin/env python3
import json, os, pathlib, sys
p = pathlib.Path(__file__).parent
state = p / 'data.json'
d = json.loads(state.read_text())
a = sys.argv[1:]
kind = pathlib.Path(sys.argv[0]).name
with (p/'calls.jsonl').open('a') as f:
    f.write(json.dumps([kind, a, sorted(k for k in os.environ if k.startswith(('BEADS_', 'GC_', 'DOLT_')))])+'\\n')
if kind == 'gc':
    if a[:2] == ['session','list']: print(json.dumps({'sessions':[{'id':'old','closed':True}]}))
    elif a[:2] == ['rig','list']: pass
    elif a[0] != 'sling': sys.exit(2)
elif kind == 'gh':
    if d.get('expect_bot'): assert os.environ.get('GH_TOKEN') == 'dispatch-fixture-token'
    category = a[a.index('--state')+1]
    if d.get('fail') == category: sys.exit(1)
    if d.get('bad') == category: print('{}')
    else: print(json.dumps(d[category]))
else:
    if a[0] == 'list': print(json.dumps(d['beads']))
    elif a[0] == 'ready':
        closed = {b['id'] for b in d['beads'] if b['status']=='closed'}
        print(json.dumps([b for b in d['beads'] if b['status']=='open' and
                         all(i in closed for i in b.get('blocked_by',[]))]))
    elif a[0] == 'show':
        if d.get('fail') == 'show': sys.exit(1)
        b = next(b for b in d['beads'] if b['id']==a[1])
        if d.get('refresh_workflow'): b['metadata']={'gc.kind':'workflow'}
        print(json.dumps([b]))
    elif a[0] == 'close':
        assert len(a)==4 and a[2]=='--reason', a
        if d.get('fail') == 'close': sys.exit(1)
        b = next(b for b in d['beads'] if b['id']==a[1])
        b['status']='closed'; b['close_reason']=a[3]
        state.write_text(json.dumps(d))
    else: sys.exit(2)
'''


def bead(bead_id='dash-d7f4', **changes):
    return dict(id=bead_id, issue_type='task', status='open', title='Foundation',
                priority=2, created_at='2026-10-01T00:00:00Z', metadata={}, **changes)


def pr(number=2, title='WP1 foundation', branch='dash-d7f4-wp1-foundation'):
    return dict(number=number, title=title, headRefName=branch, mergedAt='2026-10-15T14:46:53Z')


class ReconcileTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.rig = self.root/'rig'
        (self.rig/'.beads').mkdir(parents=True)
        subprocess.run(['git','init','-q',str(self.rig)], check=True)
        subprocess.run(['git','-C',str(self.rig),'remote','add','origin',
                        'https://github.com/fixture/dashboard.git'], check=True)
        for name in ('gc','bd','gh'):
            path = self.root/name
            path.write_text(STUB); path.chmod(0o755)
        self.data = dict(beads=[bead()], merged=[pr()], open=[])
        fixture_env = {k:v for k,v in os.environ.items() if not k.startswith(('GC_', 'BEADS_', 'DOLT_', 'CITY_', 'GH_', 'GITHUB_'))}
        self.env = {**fixture_env, 'PATH':str(self.root)+':'+os.environ['PATH'],
                    'GC':str(self.root/'gc'), 'BD_BIN':str(self.root/'bd'),
                    'RIGS':f'dashboard={self.rig}', 'CITY_DIR':str(self.rig),
                    'STATE':str(self.root/'dispatched.tsv'), 'MAX_RUNNING':'2',
                    'GOVERNOR':str(self.root/'absent'), 'BEADS_DIR':'/wrong-store',
                    'DOLT_SERVER_PORT':'1'}

    def execute(self, dry=False):
        (self.root/'data.json').write_text(json.dumps(self.data))
        result = subprocess.run(['bash',str(SCRIPT)], env={**self.env,'DRY_RUN':'1' if dry else '0'},
                                capture_output=True, text=True, start_new_session=True)
        self.data = json.loads((self.root/'data.json').read_text())
        return result

    def test_app_identity_for_order_snapshots(self):
        subprocess.run(['git', '-C', str(self.rig), 'remote', 'set-url', 'origin',
                        'https://github.com/panter/dashboard.git'], check=True)
        self.data['expect_bot'] = True
        self.env['CITY_GH_TOKEN_CMD'] = 'printf dispatch-fixture-token'
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len([c for c in self.calls() if c[0] == 'gh']), 2)
        self.assertEqual(len(self.closes()), 1)
        self.assertNotIn('dispatch-fixture-token', (self.root/'calls.jsonl').read_text())

    def test_app_mint_failure_keeps_rig_undispatched(self):
        subprocess.run(['git', '-C', str(self.rig), 'remote', 'set-url', 'origin',
                        'https://github.com/panter/dashboard.git'], check=True)
        self.env['CITY_GH_TOKEN_CMD'] = 'exit 3'
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('incomplete GitHub PR snapshot', result.stdout)
        self.assertFalse(self.closes())
        self.assertFalse(self.slings())
        self.assertFalse([c for c in self.calls() if c[0] == 'gh'])

    def test_dry_run_does_not_mint(self):
        self.env['CITY_GH_TOKEN_CMD'] = 'exit 3'
        result = self.execute(dry=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('would close', result.stdout)
        self.assertFalse(self.closes())

    def calls(self):
        return [json.loads(line) for line in (self.root/'calls.jsonl').read_text().splitlines()]

    def closes(self):
        return [c for c in self.calls() if c[0]=='bd' and c[1][0]=='close']

    def slings(self):
        return [c for c in self.calls() if c[0]=='gc' and c[1][0]=='sling']

    def test_close_before_ready_and_idempotency(self):
        self.data['beads'].append(bead('dash-next', blocked_by=['dash-d7f4']))
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.data['beads'][0]['close_reason'], 'Delivered in fixture/dashboard#2')
        self.assertEqual(len(self.closes()), 1)
        self.assertEqual(len(self.slings()), 1)
        self.assertIn('dash-next', self.slings()[0][1])
        self.assertTrue(all(not c[2] for c in self.calls() if c[0]=='bd'))
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(len(self.closes()), 1)

    def test_dry_run_preserves_store_and_state(self):
        before = copy.deepcopy(self.data)
        result = self.execute(dry=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('would close dashboard dash-d7f4', result.stdout)
        self.assertNotIn('would sling', result.stdout)
        self.assertEqual(before, self.data)
        self.assertEqual(self.closes(), [])
        self.assertEqual(self.slings(), [])
        self.assertFalse((self.root/'dispatched.tsv').exists())

    def test_only_real_work(self):
        self.data['beads'] += [bead('dash-d7f4.1'), bead('dash-d7f4x')]
        for index, metadata in enumerate([{'gc.kind':'workflow'}, {'gc.root_bead_id':'root'},
                                           {'gc.formula_name':'implement'}, {'gc.step_id':'implement'},
                                           {'gc.formula_contract':'graph.v2'}, {'gc.synthetic':'true'},
                                           {'gc.synthetic_kind':'drain-unit-convoy'}]):
            b = bead(f'dash-meta{index}'); b['metadata']=metadata
            self.data['beads'].append(b)
            self.data['merged'].append(pr(index+10, title=b['id'], branch='branch'))
        for kind in ('convoy','epic','decision'):
            b = bead(f'dash-{kind}'); b['issue_type']=kind
            self.data['beads'].append(b)
            self.data['merged'].append(pr(30+len(self.data['beads']), title=b['id'], branch='branch'))
        self.env['MAX_RUNNING']='0'
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual([c[1][1] for c in self.closes()], ['dash-d7f4'])

    def test_human_review_and_closed_work_untouched(self):
        self.env['MAX_RUNNING']='0'
        for index, label in enumerate(('human', 'review', 'warrant', 'needs-triage', 'idee')):
            b=bead(f'dash-exclude{index}', labels=[label])
            self.data['beads'].append(b)
            self.data['merged'].append(pr(index+20,title=b['id'],branch='branch'))
        b=bead('dash-closed'); b['status']='closed'
        self.data['beads'].append(b)
        self.data['merged'].append(pr(99,title=b['id'],branch='branch'))
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual([c[1][1] for c in self.closes()], ['dash-d7f4'])

    def test_blocked_and_assigned_work_can_be_delivered(self):
        self.data['beads'][0].update(status='blocked', assignee='old-session')
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(len(self.closes()), 1)

    def test_open_pr_overrides_older_merge_and_is_not_redispatched(self):
        self.data['open']=[pr(3)]
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('SKIP dash-d7f4: open PR', result.stdout)
        self.assertEqual(self.closes(), [])
        self.assertEqual(self.slings(), [])

    def test_child_and_longer_ids_do_not_close_parent(self):
        self.env['MAX_RUNNING']='0'
        self.data['merged']=[pr(branch='dash-d7f4.1-feature'), pr(3, branch='dash-d7f4x-feature')]
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(self.closes(), [])

    def test_title_matching_and_latest_merge(self):
        self.data['merged']=[pr(branch='unrelated',title='Deliver dash-d7f4'),
                             pr(3, branch='unrelated', title='Follow-up (dash-d7f4)')]
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(self.data['beads'][0]['close_reason'], 'Delivered in fixture/dashboard#3')

    def test_failures_do_not_close_or_dispatch(self):
        original = copy.deepcopy(self.data)
        for mode, value in [('fail','open'), ('fail','merged'), ('bad','open'), ('bad','merged'),
                            ('fail','show'), ('refresh_workflow',True)]:
            with self.subTest(mode=mode, value=value):
                self.data={**copy.deepcopy(original), mode:value}
                result = self.execute()
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(self.closes(), [])
                self.assertEqual(self.slings(), [])

    def test_close_failure_warns_and_does_not_redispatch(self):
        # A failed close must not stop dispatch for every rig, and the delivered bead is never slung again.
        self.data['fail']='close'
        result = self.execute()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('WARN close failed', result.stdout)
        self.assertEqual(self.slings(), [])

    def test_live_workflow_defers_source_close(self):
        self.data['beads'].append(dict(id='root', status='open', created_at='2999-01-01T00:00:00Z',
                                      labels=['for:dash-d7f4'], metadata={
                                          'gc.kind':'workflow','gc.formula_name':'implement'}))
        self.assertEqual(self.execute().returncode, 0)
        self.assertEqual(self.closes(), [])
        self.assertEqual(self.slings(), [])


if __name__ == '__main__':
    unittest.main()
