#!/usr/bin/env python3
"""Offline spike CLI and routing checks; no live bead store or GitHub access."""
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'packs/publish-gate'
HELPERS = PACK / 'assets/scripts'
PROMPTS = PACK / 'assets/workflows/spike'
REAL_GIT = shutil.which('git')


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# Reuse the dispatcher's established fake CLI protocol, never its real stores.
dispatch = load('dispatch_fixtures', ROOT / 'scripts/test-merged-pr-beads.py')
loop = load('spike_loop', HELPERS / 'spike-loop.py')

STUB = r'''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys
base = pathlib.Path(__file__).parent
args = sys.argv[1:]
kind = pathlib.Path(sys.argv[0]).name
with (base / 'calls.jsonl').open('a') as stream:
    stream.write(json.dumps([kind, args]) + '\n')
state = base / 'beads.json'
rows = json.loads(state.read_text())
if kind == 'bd':
    if args[0] == 'show':
        print(json.dumps([rows[args[1]]]))
    elif args[0] == 'update':
        assert len(args) >= 4 and len(args) % 2 == 0, args
        for option, assignment in zip(args[2::2], args[3::2]):
            assert option == '--set-metadata', args
            key, value = assignment.split('=', 1)
            rows[args[1]].setdefault('metadata', {})[key] = value
    elif args[0] == 'close':
        assert len(args) == 4 and args[2] == '--reason', args
        rows[args[1]]['status'] = 'closed'
    elif args[:2] == ['label', 'add']:
        assert len(args) == 4, args
        rows[args[2]].setdefault('labels', []).append(args[3])
    elif args[:2] == ['comments', 'add']:
        assert len(args) == 4, args
        rows[args[2]].setdefault('comments', []).append(args[3])
    elif args[0] == 'create':
        assert not any('approved' in a for a in args), args
        print('followup-fixture')
    else:
        raise AssertionError(args)
    state.write_text(json.dumps(rows))
elif kind == 'gh':
    if args[:2] == ['pr', 'list']:
        print('[]')
    elif args[:2] == ['pr', 'create']:
        body = pathlib.Path(args[args.index('--body-file') + 1]).read_text()
        (base / 'pr-body.md').write_text(body)
        print('https://example.invalid/pull/1')
    else:
        raise AssertionError(args)  # merge, auto-merge, and API writes forbidden
elif kind == 'git':
    # Only a disposable local bare remote is allowed, including identity-helper calls.
    assert args and args[0] not in ('-c', '-C', 'config'), args
    if args[0] in ('fetch', 'push', 'ls-remote'):
        assert args[1] in ('origin', '--heads'), args
        origin = subprocess.check_output([os.environ['SPIKE_REAL_GIT'], 'remote', 'get-url', 'origin'], text=True).strip()
        assert origin == str(base / 'remote.git'), origin
    sys.exit(subprocess.call([os.environ['SPIKE_REAL_GIT'], *args]))
else:
    raise AssertionError(kind)
'''


class PromptChecks(unittest.TestCase):
    def test_portable_prompts_and_unapproved_followups(self):
        for name in ('research', 'evidence-review', 'repair', 'publish'):
            with self.subTest(prompt=name):
                path = PROMPTS / (name + '.md')
                self.assertTrue(path.is_file(), str(path))
                self.assertNotRegex(path.read_text(), r'(?i)zue\.spike|/Users/|merge[ -]train|board-sync|needs-po-feedback')
        research = (PROMPTS / 'research.md').read_text()
        self.assertIn('WITHOUT the label `approved`', research)
        self.assertIn('Never auto-approve or sling follow-ups', research)
        command = re.search(r'`(bd create [^`]+)`', research).group(1)
        # The prompt owns follow-up creation; exercise its literal command in the CLI fixture below.
        self.assertNotIn('approved', shlex.split(command))

    def test_decisions_are_bounded(self):
        for review, used, limit, expected in (
                ('pass', 0, 1, 'publish'), ('insufficient', 0, 1, 'repair'),
                ('insufficient', 1, 1, 'publish'), ('insufficient', 0, 0, 'publish'),
                ('not-answerable', 0, 1, 'publish')):
            self.assertEqual(loop.decide(review, used, limit), expected)
        self.assertEqual(loop.decide('insufficient', 1, 1, 'a', 'b', 'after-repair'), 're-review')
        self.assertEqual(loop.decide('insufficient', 1, 1, 'a', 'a', 'after-repair'), 'publish')


class HelperCLI(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='check-spike-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.launcher, self.work = self.base / 'launcher', self.base / 'findings'
        self.launcher.mkdir()
        self.env = {k: v for k, v in os.environ.items() if not k.startswith(
            ('GC_', 'BEADS_', 'DOLT_', 'CITY_', 'GH_', 'GITHUB_', 'GIT_'))
            and k not in ('DRY_RUN', 'BD_BIN', 'BD_ACTOR')}
        self.env.update(HOME=str(self.base), GIT_CONFIG_NOSYSTEM='1',
                        GIT_CONFIG_GLOBAL=os.devnull, GIT_TERMINAL_PROMPT='0')
        self.git('init', '-q', '-b', 'main', cwd=self.launcher)
        self.git('init', '-q', '--bare', str(self.base / 'remote.git'), cwd=self.launcher)
        self.git('config', 'user.name', 'Spike fixture', cwd=self.launcher)
        self.git('config', 'user.email', 'spike@example.invalid', cwd=self.launcher)
        (self.launcher / 'product.txt').write_text('baseline\n')
        self.commit('baseline', self.launcher)
        self.git('remote', 'add', 'origin', str(self.base / 'remote.git'), cwd=self.launcher)
        self.git('push', '-q', 'origin', 'main', cwd=self.launcher)
        self.git('worktree', 'add', '-qb', 'spike/work', str(self.work), cwd=self.launcher)
        self.doc = self.work / 'docs/spikes/work-answer.md'
        self.doc.parent.mkdir(parents=True)
        self.doc.write_text('# Findings\n## Answer\nFixture answer.\n')
        self.commit('findings')
        self.rows = {
            'root': {'metadata': {'gc.formula_name': 'spike', 'gc.var.convoy_id': 'convoy',
                'city.spike.branch': 'spike/work', 'city.spike.doc': str(self.doc.relative_to(self.work)),
                'city.spike.work_dir': str(self.work), 'city.spike.commit': self.git('rev-parse', 'HEAD'),
                'city.spike.status': 'answered', 'city.spike.review': 'pass'}},
            'convoy': {'title': 'input convoy for work', 'dependencies': [{'id': 'work', 'dependency_type': 'tracks'}]},
            'work': {'title': 'Fixture question', 'issue_type': 'task', 'labels': []}}
        for step, stage in (('publish', 'publish'), ('repair', 'repair'), ('rereview', 're-review')):
            self.rows[step] = {'status': 'in_progress', 'metadata': {
                'gc.root_bead_id': 'root', 'gc.step_id': 'spike.' + stage}}
        for name in ('bd', 'gh', 'git'):
            path = self.base / name
            path.write_text(STUB)
            path.chmod(0o755)
        self.env.update(PATH=str(self.base) + os.pathsep + os.environ['PATH'], SPIKE_REAL_GIT=REAL_GIT)

    def git(self, *args, cwd=None):
        return subprocess.check_output([REAL_GIT, *args], cwd=cwd or self.work,
                                       env=self.env, text=True, stderr=subprocess.PIPE).strip()

    def commit(self, message, cwd=None):
        self.git('add', '.', cwd=cwd)
        self.git('commit', '-qm', message, cwd=cwd)

    def calls(self):
        path = self.base / 'calls.jsonl'
        return [json.loads(row) for row in path.read_text().splitlines()] if path.exists() else []

    def run_helper(self, name, *args, ok=True, dry=False):
        (self.base / 'beads.json').write_text(json.dumps(self.rows))
        result = subprocess.run([sys.executable, str(HELPERS / name), *args], cwd=self.launcher,
                                env={**self.env, 'DRY_RUN': '1' if dry else '0'},
                                capture_output=True, text=True, timeout=30)
        self.rows = json.loads((self.base / 'beads.json').read_text())
        self.assertEqual(result.returncode == 0, ok, result.stdout + result.stderr)
        return result.stdout.strip()

    def publish(self, **kwargs):
        return self.run_helper('spike-publish.py', '--root', 'root', '--step', 'publish',
                               '--rig-dir', str(self.launcher), **kwargs)

    def test_publication_policy_and_draft_only_when_requested(self):
        self.publish()
        calls = self.calls()
        create = next(a for kind, a in calls if kind == 'gh' and a[:2] == ['pr', 'create'])
        self.assertNotIn('--draft', create)
        push = next(i for i, (k, a) in enumerate(calls) if k == 'git' and a[0] == 'push')
        pr = next(i for i, (k, a) in enumerate(calls) if k == 'gh' and a[:2] == ['pr', 'create'])
        self.assertLess(push, pr)
        self.assertEqual(self.rows['publish']['metadata']['gc.outcome'], 'pass')
        self.assertEqual(self.rows['publish']['status'], 'closed')
        self.assertNotIn('status', self.rows['work'])
        # Every gh invocation must be a PR list/create, never merge or auto-merge.
        self.assertTrue(all(a[:2] in (['pr', 'list'], ['pr', 'create']) for k, a in calls if k == 'gh'))
        self.assertFalse(any('--auto' in a for _, a in calls))

    def test_requested_draft_and_not_answerable_require_human(self):
        self.rows['root']['metadata'].update({'city.spike.draft': 'true', 'city.spike.status': 'not-answerable'})
        self.publish()
        create = next(a for k, a in self.calls() if k == 'gh' and a[:2] == ['pr', 'create'])
        self.assertIn('--draft', create)
        self.assertIn('human', self.rows['work']['labels'])

    def test_open_pr_false_pushes_findings_and_posts_answer(self):
        self.rows['root']['metadata']['city.spike.open_pr'] = 'false'
        self.publish()
        self.assertTrue(any(k == 'git' and a[0] == 'push' for k, a in self.calls()))
        self.assertFalse(any(k == 'gh' for k, _ in self.calls()))
        self.assertIn('Fixture answer.', self.rows['work']['comments'][0])

    def test_push_false_never_calls_remote_or_github(self):
        self.rows['root']['metadata']['city.spike.push'] = 'false'
        self.publish()
        self.assertFalse(any(k == 'gh' or k == 'git' and a[0] in ('fetch', 'push', 'ls-remote') for k, a in self.calls()))

    def test_docs_only_guard_preserves_product_changes_and_blocks_push(self):
        (self.work / 'product.txt').write_text('forbidden\n')
        self.commit('product change')
        self.rows['root']['metadata']['city.spike.commit'] = self.git('rev-parse', 'HEAD')
        self.publish(ok=False)
        self.assertFalse(any(k == 'git' and a[0] == 'push' or k == 'gh' for k, a in self.calls()))
        self.assertEqual((self.work / 'product.txt').read_text(), 'forbidden\n')
        self.assertIn('human', self.rows['work']['labels'])
        self.assertEqual(self.rows['publish']['metadata']['gc.outcome'], 'fail')

    def test_dry_run_is_read_only(self):
        before = json.dumps(self.rows, sort_keys=True)
        self.publish(dry=True)
        self.assertEqual(json.dumps(self.rows, sort_keys=True), before)
        self.assertTrue(all(k == 'bd' and a[0] == 'show' or k == 'git' and a[0] not in
                            ('fetch', 'push', 'ls-remote') for k, a in self.calls()))

    def test_repair_and_rereview_cli_share_one_budget(self):
        self.rows['root']['metadata']['city.spike.review'] = 'insufficient'
        def call(action, step):
            return self.run_helper('spike-loop.py', action, '--root', 'root', '--step', step)
        self.assertEqual(call('begin-repair', 'repair'), 'REPAIR')
        before = self.rows['root']['metadata']['city.spike.repair_commit_before']
        self.doc.write_text('Repaired evidence\n')
        self.commit('repair')
        self.assertEqual(call('begin-repair', 'repair'), 'REPAIR')
        self.assertEqual(self.rows['root']['metadata']['city.spike.repair_commit_before'], before)
        self.assertEqual(self.rows['root']['metadata']['city.spike.repair_rounds_used'], '1')
        self.assertEqual(call('begin-rereview', 'rereview'), 'REVIEW')
        self.assertEqual(self.rows['root']['metadata']['city.spike.commit'], self.git('rev-parse', 'HEAD'))
        self.assertFalse(any(k == 'gh' for k, _ in self.calls()))

    def test_no_progress_skips_rereview(self):
        self.rows['root']['metadata']['city.spike.review'] = 'insufficient'
        for action, step, expected in (('begin-repair', 'repair', 'REPAIR'),
                                       ('begin-rereview', 'rereview', 'SKIP')):
            self.assertEqual(self.run_helper('spike-loop.py', action, '--root', 'root', '--step', step), expected)
        self.assertEqual(self.rows['rereview']['metadata']['gc.outcome'], 'pass')
        self.assertEqual(self.rows['root']['metadata']['city.spike.review'], 'insufficient')

    def test_prompt_followup_command_has_no_approval(self):
        text = (PROMPTS / 'research.md').read_text()
        command = re.search(r'`(bd create [^`]+)`', text).group(1)
        (self.base / 'beads.json').write_text(json.dumps(self.rows))
        subprocess.run(shlex.split(command.replace('<spike-bead-id>', 'work')),
                       cwd=self.launcher, env=self.env, check=True, capture_output=True)
        create = next(a for k, a in self.calls() if k == 'bd' and a[0] == 'create')
        self.assertIn('discovered-from:work', create)
        self.assertFalse(any('approved' in a for a in create))


class DispatcherRouting(unittest.TestCase):
    def test_dry_run_routes_every_rig_without_state_or_store_writes(self):
        fixture = dispatch.ReconcileTests('runTest')
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        fixture.data = dict(merged=[], open=[], beads=[
            dispatch.bead('probe-spike', labels=['spike', 'big', 'approved'], created_by='city/agent'),
            dispatch.bead('probe-big', labels=['big', 'approved'], created_by='city/agent'),
            dispatch.bead('probe-plain', labels=['approved'], created_by='city/agent'),
            dispatch.bead('probe-unapproved', labels=['spike'], created_by='city/agent'),
            {**dispatch.bead('probe-root', labels=['spike', 'approved'], created_by='city/agent'),
             'status': 'closed',  # Historical process bead; active roots need complete links.
             'metadata': {'gc.kind': 'workflow', 'gc.formula_name': 'spike'}}])
        fixture.env.update(HOME=str(fixture.root), MAX_RUNNING='100')
        # Isolate worker-share and governor too; the real machine cannot affect fixtures.
        state = Path(fixture.env['STATE'])
        state.write_text('# fixture state\n')
        before_state, before_data = state.read_bytes(), json.dumps(fixture.data, sort_keys=True)
        for rig in ('city', 'evermore-city', 'zue-city', 'lumen-city', 'city-dashboard', 'catladder'):
            with self.subTest(rig=rig):
                # The shared dispatcher reads its rigs and label rules from dispatch.toml
                # (city-ifm24): reuse the checked-in rules for a disposable one-rig config.
                rules = tomllib.loads((ROOT / 'dispatch.toml').read_text())['formulas']['rule']
                config = fixture.root / 'spike-dispatch.toml'
                config.write_text('schema = 1\ncity = "fixture"\nstate = ' + json.dumps(str(state))
                                  + '\nmax_running = 100\n[[rig]]\nname = ' + json.dumps(rig)
                                  + '\ndir = ' + json.dumps(str(fixture.rig)) + '\n'
                                  + ''.join('[[formulas.rule]]\nlabel = ' + json.dumps(r['label'])
                                            + '\nformula = ' + json.dumps(r['formula'])
                                            + ''.join(f'\nvars.{k} = ' + json.dumps(v) for k, v in r.get('vars', {}).items())
                                            + '\n' for r in rules))
                (fixture.root / 'data.json').write_text(json.dumps(fixture.data))
                result = subprocess.run([sys.executable, str(dispatch.SCRIPT), str(config)],
                                        env={**fixture.env, 'DRY_RUN': '1'}, capture_output=True,
                                        text=True, start_new_session=True)
                fixture.data = json.loads((fixture.root / 'data.json').read_text())
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                for bead, formula in (('spike', 'spike'), ('big', 'build-basic'), ('plain', 'implement')):
                    self.assertIn(f'would sling {rig} probe-{bead} (P2) --on {formula}', result.stdout)
                self.assertIn('--on spike --var artifact_root=plans/probe-spike', result.stdout)
                self.assertNotIn('would sling ' + rig + ' probe-unapproved', result.stdout)
                self.assertNotIn('would sling ' + rig + ' probe-root', result.stdout)
                self.assertEqual(state.read_bytes(), before_state)
                self.assertEqual(json.dumps(fixture.data, sort_keys=True), before_data)
        calls = fixture.calls()
        self.assertTrue(all(a[0] in ('show', 'ready', 'list') or a[:2] == ['dep', 'list']
                            for k, a, _ in calls if k == 'bd'))
        self.assertFalse(any(k == 'gc' and a[0] == 'sling' for k, a, _ in calls))


def compile_spike():
    # A checkout deliberately has no machine-local rig binding. Import the exact
    # checked-in pack into a disposable bound rig, without fetching any pack.
    env = {k: v for k, v in os.environ.items() if not k.startswith(('GC_', 'BEADS_', 'DOLT_'))}
    with tempfile.TemporaryDirectory(prefix='.spike-compile-', dir=PACK) as directory:
        city = Path(directory).resolve()
        (city / 'rig').mkdir()
        (city / 'city.toml').write_text(
            '[workspace]\nname="spike-check"\n[[rigs]]\nname="probe"\npath='
            + json.dumps(str(city / 'rig')) + '\n[rigs.imports.publish_gate]\nsource='
            + json.dumps(str(PACK)) + '\n')
        result = subprocess.run(['gc', '--city', str(city), '--rig', 'probe',
                                 'formula', 'show', 'spike', '--json'],
                                env=env, capture_output=True, text=True, timeout=30)
        graph = json.loads(result.stdout)
        if result.returncode or not graph.get('ok'):
            raise RuntimeError(f"spike compilation failed: {graph.get('error')}")
        stages = {row['id'] for row in graph['steps']}
        expected = {'spike.' + name for name in ('research', 'evidence-review', 'repair', 're-review', 'publish')}
        if not expected <= stages:
            raise RuntimeError(f'missing spike stages: {expected - stages}')
        print('OK: checked-in spike formula compiles with all five stages')


if __name__ == '__main__':
    if sys.argv[1:] == ['--compile-only']:
        compile_spike()
    else:
        unittest.main()
