#!/usr/bin/env python3
"""Real Git fixtures for artifact allocation and the guarded publish boundary."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'packs/publish-gate/assets/scripts/workflow-artifacts.py'
with tempfile.TemporaryDirectory(prefix='workflow-artifacts-') as directory:
    repo = Path(directory).resolve() / 'repo'
    repo.mkdir()
    env = {k: v for k, v in os.environ.items() if not k.startswith(
        ('GIT_', 'CITY_', 'GH_', 'GITHUB_', 'GC_', 'BEADS_', 'DRY_RUN'))}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
               GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.test',
               GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.test')
    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args], env=env, stderr=subprocess.PIPE).decode().strip()
    def run(*args, ok=True, at=None, extra=None):
        result = subprocess.run([sys.executable, str(HELPER), *args, '--repo', str(at or repo)],
                                env=dict(env, **(extra or {})), capture_output=True, text=True)
        assert (result.returncode == 0) == ok, (args, result.stdout, result.stderr)
        return result
    git('init', '-q')
    (repo / 'source.txt').write_text('source\n')
    git('add', 'source.txt')
    git('commit', '-qm', 'base')
    base = git('rev-parse', 'HEAD')
    git('branch', 'fixture-base')
    # Each forbidden addition independently blocks; the publish command must not run.
    sentinel = Path(directory) / 'published'
    command = [sys.executable, '-c', f'from pathlib import Path; Path({str(sentinel)!r}).touch()']
    def publish(ok, extra=None, head='HEAD'):
        result = subprocess.run([sys.executable, str(HELPER), 'publish', '--repo', str(repo),
                                 '--base', base, '--head', head, '--', *command],
                                env=dict(env, **(extra or {})), capture_output=True, text=True)
        assert (result.returncode == 0) == ok, result.stderr
    for name in ('implementation-summary.md', 'gc-plans/task/report.md',
                 'artifacts/dash-o0uw/implementation-summary.md', 'artifacts/dash-v7lo/log.txt',
                 'nested/gc-plans/task/plan.md', 'artifacts/city-ab12.3/report.md', 'odd\nname/implementation-summary.md'):
        git('reset', '--hard', base)
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('scratch\n')
        git('add', '--', name)
        git('commit', '-qm', 'accidental artifact')
        run('check', '--base', base, ok=False)
        publish(False)
        assert not sentinel.exists(), name
    # A rename into scratch is still an addition; an invalid base fails closed.
    git('reset', '--hard', base)
    git('mv', 'source.txt', 'implementation-summary.md')
    git('commit', '-qm', 'rename into scratch')
    run('check', '--base', base, ok=False)
    run('check', '--base', 'missing-base', ok=False)
    # Legitimate product assets and ordinary docs are allowed.
    git('reset', '--hard', base)
    for name in ('artifacts/logo.svg', 'docs/design.md'):
        path = repo / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('product\n')
        git('add', name)
    git('commit', '-qm', 'product files')
    run('check', '--base', base)
    publish(True, extra={'DRY_RUN': '1'})
    assert not sentinel.exists()
    publish(False, head=base)
    assert not sentinel.exists()
    publish(True)
    assert sentinel.exists()
    # Previously tracked scratch can be deleted without blocking cleanup.
    git('reset', '--hard', base)
    (repo / 'implementation-summary.md').write_text('old scratch')
    git('add', 'implementation-summary.md')
    git('commit', '-qm', 'old scratch')
    dirty_base = git('rev-parse', 'HEAD')
    git('rm', 'implementation-summary.md')
    git('commit', '-qm', 'cleanup')
    run('check', '--base', dirty_base)
    # Default storage is Git-private and shared across linked worktrees.
    path = Path(run('path', '--workflow', 'city-test', '--name', 'summary.md').stdout.strip())
    assert path == repo / '.git/workflow-artifacts/city-test/summary.md'
    linked = Path(directory).resolve() / 'linked'
    git('worktree', 'add', '-qb', 'linked', str(linked))
    assert run('path', '--workflow', 'city-test', '--name', 'summary.md', at=linked).stdout.strip() == str(path)
    assert not path.parent.exists(), 'path allocation must be read-only'
    for requested in (repo / 'report.md', linked / 'report.md'):
        run('path', '--workflow', 'city-test', '--name', 'summary.md', '--requested', str(requested),
            at=linked if requested.parent == linked else repo, ok=False)
    run('path', '--workflow', 'city-test', '--name', 'summary.md', '--requested', str(repo / 'report.md'), at=linked, ok=False)
    run('path', '--workflow', 'city-test', '--name', 'summary.md', '--requested', str(linked / 'report.md'), ok=False)
    run('path', '--workflow', 'city-test', '--name', 'summary.md', '--requested', str(repo / '.git/HEAD'), ok=False)
    outside = Path(directory) / 'reports/summary.md'
    run('path', '--workflow', 'city-test', '--name', 'summary.md', '--requested', str(outside))
    (repo / 'alias').symlink_to(repo, target_is_directory=True)
    run('path', '--workflow', 'city-test', '--name', 'summary.md', '--requested', str(repo / 'alias/report.md'), ok=False)
    run('path', '--workflow', '../escape', '--name', 'summary.md', ok=False)
    # Every artifact-producing overlay prompt carries the storage contract;
    # both publishers require the executable wrapper.
    prompts = ROOT / 'packs/publish-gate/assets/workflows'
    for name in ('do-work/implement.md', 'do-work-item/implement-item.md',
                 'implementation-base/implement.md', 'implementation-item-base/implement-item.md',
                 'implement/summarize.md', 'build-basic/requirements.md', 'build-basic/plan.md',
                 'build-basic/decompose.md', 'build-basic/finalize.md'):
        assert '../shared/artifact-storage.md' in (prompts / name).read_text(), name
    for name in ('implement/publish.md', 'build-basic/publish.md'):
        assert '"$WORKFLOW_ARTIFACT_HELPER" publish' in (prompts / name).read_text(), name
print('PASS: artifact allocation, linked worktrees, blocked publication, renames, cleanup and dry-run fixtures')
