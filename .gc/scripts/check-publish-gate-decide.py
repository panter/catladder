#!/usr/bin/env python3
"""Read-only #387/#400 delivery fixtures; remove with the adopted upstream gate.

Removal requires closure after outer publish with explicit no-op retention and
safe teardown in both drain modes. All Git writes here are fixture setup only.
"""
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile

HELPER = Path(__file__).resolve().with_name('publish-gate-decide.sh')
with tempfile.TemporaryDirectory() as temp:
    repo = Path(temp) / 'repository'
    repo.mkdir()
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.test',
               GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.test')

    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args], env=env, text=True).strip()

    git('init', '-q', '-b', 'main')
    git('commit', '-qm', 'Implemented source', '--allow-empty')
    commit = git('rev-parse', 'HEAD')
    git('commit', '-qm', 'Published aggregate', '--allow-empty')
    head = git('rev-parse', 'HEAD')
    git('checkout', '-q', '--orphan', 'unrelated')
    git('commit', '-qm', 'Unrelated commit', '--allow-empty')
    unrelated = git('rev-parse', 'HEAD')
    git('checkout', '-q', 'main')
    tree = git('rev-parse', 'HEAD^{tree}')
    orphan = git('commit-tree', tree, '-m', 'Unretained commit')
    member = dict(id='fixture', issue_type='task', status='open', metadata={
        'gc.publish_state': 'pending', 'gc.implemented_commit': commit,
        'gc.implemented_summary': str(repo / 'summary.md'), 'work_dir': str(repo)})
    publish = dict(status='closed', metadata={
        'gc.outcome': 'pass', 'gc.publish_outcome': 'pushed',
        'gc.publish_repository': 'https://example.test/project.git',
        'gc.publish_ref': 'refs/heads/main', 'gc.publish_head': head,
        'gc.publish_pr_url': 'https://example.test/project/pull/12',
        'gc.publish_reason': 'publishing disabled'})

    def decide(outcome, value=None, evidence=None, fallback=None):
        m = member if value is None else value
        p = copy.deepcopy(publish if evidence is None else evidence)
        if evidence is None:
            p['metadata']['gc.publish_outcome'] = outcome
        args = ['bash', str(HELPER), outcome, json.dumps(m), json.dumps(p)]
        if fallback is not None:
            args.append(str(fallback))
        result = subprocess.check_output(args, env=dict(env, DRY_RUN='1'), text=True)
        return json.loads(result)

    before_refs = git('show-ref')
    before_status = git('status', '--porcelain')
    for mode in ('pushed', 'pr_opened'):
        result = decide(mode)
        assert result['action'] == 'close' and result['publish_state'] == 'delivered', result
        assert commit in result['reason'] and head in result['reason'], result
    assert publish['metadata']['gc.publish_pr_url'] in decide('pr_opened')['reason']
    for mode in ('failed', '', 'unknown'):
        assert decide(mode) == {'action': 'keep_open', 'reason': 'publish_not_successful'}
    assert decide('pushed', evidence={})['reason'] == 'publish_not_successful'
    for key in ('gc.publish_head', 'gc.publish_ref', 'gc.publish_repository', 'gc.publish_pr_url'):
        p = copy.deepcopy(publish); p['metadata'].pop(key); p['metadata']['gc.publish_outcome'] = 'pr_opened'
        assert decide('pr_opened', evidence=p)['action'] == 'keep_open', key
    p = copy.deepcopy(publish); p['metadata']['gc.publish_head'] = unrelated
    assert decide('pushed', evidence=p)['action'] == 'keep_open'  # local existence alone is insufficient
    p['metadata']['gc.publish_head'] = 'f' * 40
    assert decide('pushed', evidence=p)['action'] == 'keep_open'
    for key, value in (('status', 'open'),):
        p = copy.deepcopy(publish); p[key] = value
        assert decide('pushed', evidence=p)['action'] == 'keep_open'
    p = copy.deepcopy(publish); p['metadata']['gc.outcome'] = 'fail'
    assert decide('pushed', evidence=p)['action'] == 'keep_open'
    result = decide('noop')
    assert result['publish_state'] == 'noop' and 'publishing disabled' in result['reason']
    p = copy.deepcopy(publish); p['metadata']['gc.publish_outcome'] = 'noop'
    p['metadata']['gc.publish_reason'] = 'nothing to publish'
    assert 'nothing to publish' in decide('noop', evidence=p)['reason']
    p['metadata'].pop('gc.publish_reason')
    assert decide('noop', evidence=p)['action'] == 'keep_open'
    m = copy.deepcopy(member); m['metadata']['gc.implemented_commit'] = orphan
    assert decide('noop', m) == {'action': 'human', 'label': 'human', 'reason': 'commit_unreachable'}
    m['metadata']['gc.implemented_commit'] = 'f' * 40
    assert decide('pushed', m)['reason'] == 'commit_unverifiable'
    m = copy.deepcopy(member); m['metadata']['work_dir'] = str(repo / 'removed-worktree')
    assert decide('pushed', m)['action'] == 'human'
    assert decide('pushed', m, fallback=repo)['action'] == 'close'  # teardown fallback
    assert decide('noop', m, fallback=repo)['publish_state'] == 'noop'
    for state in ('delivered', 'noop'):
        m = copy.deepcopy(member); m['metadata']['gc.publish_state'] = state
        assert decide('pushed', m)['reason'] == 'already_delivered'
    for kind in ('convoy', 'epic', 'molecule'):
        assert decide('pushed', dict(member, issue_type=kind))['reason'] == 'not_real_work'
    for key, value in (('gc.kind', 'workflow'), ('gc.kind', 'scope'), ('gc.kind', ''),
                       ('gc.root_bead_id', 'root'), ('gc.root_bead_id', ''), ('gc.formula_name', 'implement')):
        m = copy.deepcopy(member); m['metadata'][key] = value
        assert decide('pushed', m)['reason'] == 'not_real_work'
    for status in ('closed', 'blocked'):
        assert decide('pushed', dict(member, status=status))['reason'] == 'not_open'
    m = copy.deepcopy(member); m['metadata']['gc.publish_state'] = 'other'
    assert decide('pushed', m)['reason'] == 'not_pending'
    assert git('show-ref') == before_refs and git('status', '--porcelain') == before_status
    assert member['status'] == 'open' and member['metadata']['gc.publish_state'] == 'pending'
print('PASS: publish evidence, commit ancestry, no-op retention, teardown fallback, idempotence and real-work selection')
