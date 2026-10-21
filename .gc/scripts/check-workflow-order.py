#!/usr/bin/env python3
"""Read-only gascity-packs#387/#400 regression checks; remove with the publish-gate overlay.

Removal requires an adopted upstream release with outer publish closure,
explicit no-op handling, both drain modes and safe teardown ordering.
"""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--stock-pack', type=Path, default=os.environ.get('PUBLISH_GATE_STOCK_PACK'))
parser.add_argument('--overlay', type=Path, default=ROOT / 'packs/publish-gate')
args = parser.parse_args()
GC = os.environ.get('GC_BIN', '/opt/homebrew/opt/gascity/bin/gc')
env = {k: v for k, v in os.environ.items() if not k.startswith(('GC_', 'BEADS_'))}

def run(command):
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    if result.returncode:
        raise AssertionError(result.stderr.strip() or result.stdout.strip())
    return result.stdout

def stock_pack():
    if args.stock_pack:
        return args.stock_pack.resolve()
    # Resolve an already installed pack via read-only runtime compilation.
    # Never cook, install, fetch, sling or edit the running city.
    city = os.environ.get('PUBLISH_GATE_DISCOVERY_CITY', str(Path.home() / 'git/maw-city'))
    recipe = json.loads(run([GC, '--city', city, '--rig', 'city',
                             'formula', 'show', 'do-work', '--json']))
    matches = []
    for item in recipe['search_paths']:
        candidate = Path(item).parent
        manifest = candidate / 'pack.toml'
        if manifest.is_file() and tomllib.loads(manifest.read_text()).get('pack', {}).get('name') == 'gascity':
            matches.append(candidate)
    # The default rig import and the gate's own gascity import resolve to the same pinned path; dedupe.
    matches = sorted(set(m.resolve() for m in matches))
    assert len(matches) == 1, 'set PUBLISH_GATE_STOCK_PACK to one installed gascity pack'
    return matches[0]

def description(step, overlay):
    body = step.get('description', '')
    external = re.search(r'Resolved prompt file: `([^`]+)`', body)
    if external:
        path = Path(external[1]).resolve()
        assert path.is_relative_to(overlay), f'prompt escaped overlay: {path}'
        body = path.read_text()
    return body

def check_graph(recipe, formula, overlay):
    steps = {s['id']: s for s in recipe['steps']}
    dependencies = {key: set() for key in steps}
    assert len(steps) == len(recipe['steps']), f'{formula}: duplicate step ids'
    for dep in recipe['deps']:
        if dep.get('type') == 'blocks':
            assert dep['step_id'] in steps and dep['depends_on_id'] in steps, (
                f'{formula}: dependency references missing step: {dep}')
            dependencies[dep['step_id']].add(dep['depends_on_id'])
    def ancestors(key, trail=()):
        assert key not in trail, f'{formula}: dependency cycle at {key}'
        result = set()
        for parent in dependencies.get(key, set()):
            result.add(parent)
            result.update(ancestors(parent, trail + (key,)))
        return result
    # Validate every component, including disconnected cleanup branches.
    for key in steps:
        ancestors(key)
    publish = formula + '.publish'
    close = formula + '.close-delivered-anchors'
    assert publish in steps and close in steps, f'{formula}: missing publish/close step'
    assert publish in ancestors(close), f'{formula}: close must depend on publish'
    assert close not in ancestors(publish), f'{formula}: publish depends on close'
    assert steps[close]['metadata']['gc.run_target'] == 'gc.run-operator', formula
    assert 'gc.publish_state' in description(steps[close], overlay), formula
    publish_body = description(steps[publish], overlay)
    for field in ('gc.publish_outcome=pushed', 'gc.publish_outcome=pr_opened',
                  'gc.publish_outcome=noop', 'gc.publish_outcome=failed',
                  'gc.publish_repository', 'gc.publish_ref', 'gc.publish_head',
                  'gc.publish_pr_url', 'gc.publish_reason', 'git ls-remote', 'gh pr view'):
        assert field in publish_body, f'{formula}: missing publisher evidence contract: {field}'
    for key, step in steps.items():
        if re.search(r'tear.?down|clean.?up|(?:remove|delete|reap|archive).*worktree|worktree.*(?:remove|delete|reap|archive)', key + ' ' + step.get('title', ''), re.I):
            assert close in ancestors(key), f'{formula}: teardown must depend on close: {key}'
        if key.endswith('.workflow-finalize'):
            assert close in ancestors(key), f'{formula}: workflow finalization bypasses close'

def check_prompt_copies(stock, overlay):
    # Intentional edits for gascity-packs#387/#400 are reviewed separately.
    changed = {
        'build-basic/publish.md', 'implement/publish.md',
        'do-work-item/implement-item.md', 'implementation-item-base/implement-item.md',
        'do-work/mark-source-anchor.md', 'shared/close-delivered-anchors.md',
        # city-647g2: slice limit + dependency rule for the decomposer, predecessor base for dependent items.
        'build-basic/decompose.md', 'do-work/prepare-worktree.md',
        # city-ieyka: process-local bot commit identity, also passed to nested work.
        'do-work/implement.md', 'implementation-base/implement.md',
        'build-basic/implement.md', 'build-basic/implement-same-session.md',
    }
    prompts = overlay / 'assets/workflows'
    for path in sorted(prompts.rglob('*.md')):
        relative = path.relative_to(prompts)
        if relative.as_posix() in changed:
            continue
        original = stock / 'assets/workflows' / relative
        body = re.sub(r'\A<!--.*?-->\s*', '', path.read_text(), count=1, flags=re.S)
        assert original.is_file() and body == original.read_text().lstrip(), (
            f'stock prompt drift: {relative}; review the upstream change before updating the copy')
    print('PASS: bundled stock prompts match installed stock apart from workaround headers')


def check_marker_guards(overlay):
    marker = (overlay / 'assets/workflows/do-work/mark-source-anchor.md').read_text()
    for guard in ('`task`, `feature`, `bug` or `chore`', '`gc.root_bead_id`',
                  '--if-assignee', '--if-status', 'gc.implemented_commit',
                  'gc.implemented_summary', 'Read the anchor back', 'Never reopen'):
        assert guard in marker, guard
    print('PASS: marker evidence, lifecycle and ownership guards')


def check_decisions():
    print(run(['python3', str(ROOT / 'scripts/check-publish-gate-decide.py')]).strip())

try:
    stock = stock_pack()
    overlay = args.overlay.resolve()
    assert (stock / 'pack.toml').is_file(), 'installed stock pack missing'
    assert (overlay / 'pack.toml').is_file(), 'overlay pack missing'
    check_prompt_copies(stock, overlay)
    check_marker_guards(overlay)
    with tempfile.TemporaryDirectory(prefix='.workflow-order-', dir=ROOT) as name:
        city = Path(name).resolve()
        (city / 'rig').mkdir()
        (city / 'city.toml').write_text(
            '[workspace]\nname="workflow-order-check"\n[[rigs]]\nname="probe"\npath='
            + json.dumps(str(city / 'rig')) + '\n[rigs.imports.gascity]\nsource='
            + json.dumps(str(stock)) + '\n[rigs.imports.publish_gate]\nsource='
            + json.dumps(str(overlay)) + '\n')
        def compile_formula(formula, variables=()):
            command = [GC, '--city', str(city), '--rig', 'probe', 'formula', 'show', formula, '--json']
            for value in variables:
                command += ['--var', value]
            return json.loads(run(command))
        for formula in ('implementation-base', 'do-work'):
            recipe = compile_formula(formula)
            step = next(s for s in recipe['steps'] if s['id'] == formula + '.close-source-anchor')
            body = description(step, overlay)
            assert step['title'] == 'Verify and mark source anchor', formula
            assert 'mark-source-anchor.md' in step['description'], formula
            assert 'gc.publish_state=pending' in body, formula
            assert 'close-source-anchor.md' not in step['description'], formula
            assert 'never closes a source anchor' in body, formula
            assert 'Do not set source `gc.outcome=pass` or close the source bead' in body, formula
            assert any(d['step_id'] == step['id'] and
                       d['depends_on_id'] == formula + '.implement'
                       for d in recipe['deps']), formula
        for formula in ('implementation-item-base', 'do-work-item'):
            recipe = compile_formula(formula)
            step = next(s for s in recipe['steps'] if s['id'] == formula + '.implement-item')
            body = description(step, overlay)
            assert 'mark-source-anchor.md' in body, formula
            assert 'close only the source anchor on success' not in body, formula
            assert 'Do not close the source anchor' in body, formula
        recipe = compile_formula('same-session-implement')
        assert 'do-work-item' in json.dumps(recipe), 'shared drain must use marked item workflow'
        for formula in ('implement', 'build-basic'):
            for push, pr in (('true', 'false'), ('false', 'true'), ('false', 'false')):
                for drain in ('separate', 'same-session'):
                    recipe = compile_formula(formula, (f'push={push}', f'open_pr={pr}', f'drain_policy={drain}'))
                    check_graph(recipe, formula, overlay)
                    # Reject a restored pre-publish edge in every variant.
                    regression = copy.deepcopy(recipe)
                    close = formula + '.close-delivered-anchors'
                    regression['deps'] = [d for d in regression['deps']
                                          if d.get('step_id') != close]
                    regression['deps'].append({
                        'type': 'blocks', 'step_id': close,
                        'depends_on_id': formula + ('.summarize' if formula == 'implement' else '.finalize')})
                    try:
                        check_graph(regression, formula, overlay)
                    except AssertionError as error:
                        assert 'close must depend on publish' in str(error), str(error)
                    else:
                        raise AssertionError('pre-publish closure was accepted')
                    # Prove the teardown assertion is active even when stock has
                    # no cleanup step: reject a bypass, accept a dependency on close.
                    probe = copy.deepcopy(recipe)
                    cleanup = formula + '.teardown-probe'
                    probe['steps'].append({'id': cleanup, 'title': 'Teardown probe'})
                    try:
                        check_graph(probe, formula, overlay)
                    except AssertionError as error:
                        assert 'teardown must depend on close' in str(error), str(error)
                    else:
                        raise AssertionError('teardown bypass was accepted')
                    probe['deps'].append({'type': 'blocks', 'step_id': cleanup,
                                          'depends_on_id': formula + '.close-delivered-anchors'})
                    check_graph(probe, formula, overlay)
            print(f'PASS: {formula} publish/PR/no-op graphs in both drain modes')
    # Exercise the checked-in rig imports as well as the minimal pack fixture.
    # Repository checkouts have no machine-local rig path binding; bind only
    # the disposable fixture, preserving the pinned lockfile and import order.
    config = tomllib.loads((ROOT / 'city.toml').read_text())
    rig = next(r for r in config['rigs'] if r['name'] == 'city')
    with tempfile.TemporaryDirectory(prefix='.city-overlay-', dir=ROOT) as name:
        city = Path(name).resolve()
        (city / 'rig').mkdir()
        (city / 'packs.lock').write_bytes((ROOT / 'packs.lock').read_bytes())
        text = '[workspace]\n[[rigs]]\nname="city"\npath=' + json.dumps(str(city / 'rig')) + '\n'
        for key, imported in rig['imports'].items():
            text += '[rigs.imports.' + key + ']\n'
            for field, value in imported.items():
                if field == 'source' and value.startswith('./'):
                    value = str(ROOT / value)
                text += field + '=' + json.dumps(value) + '\n'
        (city / 'city.toml').write_text(text)
        for formula in ('implement', 'build-basic', 'do-work', 'do-work-item',
                        'implementation-base', 'implementation-item-base'):
            recipe = json.loads(run([GC, '--city', str(city), '--rig', 'city',
                                     'formula', 'show', formula, '--json']))
            assert recipe.get('ok', True), recipe.get('error')
            assert str(overlay / 'formulas') in recipe['search_paths'], formula
            suffix = ('close-delivered-anchors' if formula in ('implement', 'build-basic')
                      else 'close-source-anchor' if formula in ('do-work', 'implementation-base')
                      else 'implement-item')
            step = next(s for s in recipe['steps'] if s['id'] == formula + '.' + suffix)
            body = description(step, overlay)
            assert 'gc.publish_state' in body or 'mark-source-anchor.md' in body, formula
            print(f'PASS: city rig imports select {formula} overlay over pinned stock')
    check_decisions()
    print('PASS: mark-only item contracts and post-publish closure ordering')
except (AssertionError, OSError, ValueError, KeyError, StopIteration) as error:
    raise SystemExit(f'FAIL: publish gate: {error}')
