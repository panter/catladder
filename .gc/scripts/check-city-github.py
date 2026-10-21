#!/usr/bin/env python3
"""Isolated CLI/real Git checks: no real tokens, GitHub calls, or user config."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / 'packs/publish-gate/assets/scripts/city-github.py'
spec = importlib.util.spec_from_file_location('city_github', HELPER)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

with tempfile.TemporaryDirectory(prefix='city-github-') as name:
    tmp = Path(name)
    env = {k: v for k, v in os.environ.items() if not k.startswith(
        ('CITY_', 'GH_', 'GITHUB_', 'GIT_', 'DRY_RUN', 'BEADS_', 'GC_'))}
    env.update(HOME=str(tmp), GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull)
    def git(*args, input=None, git_env=None):
        return subprocess.run(['git', *args], cwd=tmp, env=git_env or env, input=input,
                              capture_output=True, text=True, check=True).stdout

    git('init', '-q')
    git('remote', 'add', 'origin', 'git@github.com:panter/maw-city.git')
    mint = tmp / 'mint'
    mint.write_text('#!/bin/sh\nprintf x >> "$HOME/minted"\nprintf fixture-only-token\n')
    mint.chmod(0o755)
    fake = tmp / 'gh'
    fake.write_text('''#!/usr/bin/env python3
import os, sys
assert os.environ.get('GH_TOKEN') == os.environ.get('EXPECTED_TOKEN')
assert 'fixture-only-token' not in repr(sys.argv)
if os.environ.get('EXPECTED_TOKEN') == 'fixture-only-token':
    assert 'GH_DEBUG' not in os.environ and 'GIT_TRACE_CURL' not in os.environ
print('fixture command passed')
''')
    fake.chmod(0o755)

    def run(mode, *args, extra=None, ok=True):
        r = subprocess.run([sys.executable, str(HELPER), mode, *args], cwd=tmp,
                           env=dict(env, **(extra or {})), capture_output=True, text=True)
        assert 'fixture-only-token' not in r.stdout + r.stderr, 'token leaked'
        assert (r.returncode == 0) == ok, (r.returncode, r.stdout, r.stderr)
        return r

    # Unset means exactly the inherited gh authentication, including explicit overrides.
    run('gh', 'pr', 'view', '1', extra=dict(GH_BIN=str(fake)))
    run('gh', 'pr', 'view', '1', extra=dict(GH_BIN=str(fake), GH_TOKEN='inherited', EXPECTED_TOKEN='inherited'))
    bot = dict(CITY_GH_TOKEN_CMD=str(mint), GH_BIN=str(fake), EXPECTED_TOKEN='fixture-only-token',
               GH_TOKEN='inherited', GITHUB_TOKEN='inherited', GH_DEBUG='api', GIT_TRACE_CURL='1')
    run('gh', 'pr', 'create', '--repo', 'panter/maw-city', extra=bot)
    run('gh', 'pr', 'comment', '1', extra=bot)
    assert (tmp / 'minted').read_text() == 'xx', 'must mint fresh per invocation'
    for mode in ('gh', 'git'):
        run(mode, 'push' if mode == 'git' else 'pr', extra=dict(bot, DRY_RUN='1'))
    assert (tmp / 'minted').read_text() == 'xx', 'dry-run minted'
    run('gh', 'pr', extra=dict(bot, CITY_GH_TOKEN_CMD='printf fixture-only-token; printf fixture-only-token >&2; exit 3'), ok=False)
    run('gh', 'pr', extra=dict(bot, CITY_GH_TOKEN_CMD='true'), ok=False)
    run('gh', 'pr', extra=dict(bot, CITY_GH_TOKEN_CMD="printf 'two words'"), ok=False)
    run('gh', 'issue', 'view', '--repo=gastownhall/gascity',
        extra=dict(bot, EXPECTED_TOKEN='inherited'))
    # Human mode removes both token override variables and never invokes the mint command.
    human = mod.child_env('human-gh', [], dict(bot, GH_TOKEN='fixture-only-token'))
    assert not any(k in human for k in ('GH_TOKEN', 'GITHUB_TOKEN', 'CITY_GH_TOKEN_CMD'))
    run('human-gh', 'issue', 'comment', '--repo', 'gastownhall/gascity',
        extra={k: v for k, v in bot.items() if k != 'EXPECTED_TOKEN'})
    assert (tmp / 'minted').read_text() == 'xx'

    # Explicit repo arguments, PR URLs, GH_REPO and origin all choose the target.
    for args in (('-Rmacrozone/evermore',), ('--repo=macrozone/evermore',),
                 ('--repo', 'other/project'), ('https://github.com/macrozone/evermore/pull/1',),
                 ('--repo', 'https://gitlab.com/panter/project'), ('--repo', 'unknown'), ('--repo', 'https://[')):
        run('gh', 'pr', 'view', *args, extra=dict(bot, EXPECTED_TOKEN='inherited'))
    run('gh', 'pr', 'view', extra=dict(bot, GH_REPO='macrozone/evermore', EXPECTED_TOKEN='inherited'))
    run('gh', 'pr', 'view', extra=dict(bot, GH_HOST='gitlab.com', EXPECTED_TOKEN='inherited'))
    run('gh', 'pr', 'view', '-Rpanter/project',
        extra=dict(bot, GH_HOST='gitlab.com', EXPECTED_TOKEN='inherited'))
    for remote in ('macrozone', 'missing', 'panter/local-path', 'https://github.com/macrozone/evermore.git',
                   'ssh://git@gitlab.com/panter/project.git'):
        run('git', 'push', remote, extra=dict(bot, GIT_BIN=str(fake), EXPECTED_TOKEN='inherited'))
    assert (tmp / 'minted').read_text() == 'xx', 'non-panter target minted'

    run('publish', sys.executable, '-c',
        "import os, subprocess; assert os.environ['GIT_AUTHOR_NAME'] == 'city[bot]'; "
        "subprocess.run([os.environ['GH_BIN'], 'pr', 'create'], check=True)",
        extra=dict(bot, CITY_GIT_NAME='city[bot]'))
    assert (tmp / 'minted').read_text() == 'xxx'
    run('git', '-C', str(tmp), '-c', 'example.fixture=true', 'push', 'origin',
        extra=dict(bot, GIT_BIN=str(fake)))
    assert (tmp / 'minted').read_text() == 'xxxx'

    git('config', 'user.name', 'Human')
    git('config', 'user.email', 'human@example.test')
    run('git', 'commit', '--allow-empty', '-m', 'default identity')
    assert git('log', '-1', '--format=%an|%ae|%cn|%ce').strip() == 'Human|human@example.test|Human|human@example.test'
    identity = dict(CITY_GIT_NAME='city[bot]', CITY_GIT_EMAIL='123+city[bot]@users.noreply.github.com',
                    CITY_GH_TOKEN_CMD='exit 99')
    run('git', '-C', str(tmp), 'commit', '--amend', '--allow-empty', '-m', 'bot identity', extra=identity)
    assert git('log', '-1', '--format=%an|%cn').strip() == 'city[bot]|city[bot]'
    assert git('log', '-1', '--format=%ae|%ce').strip() == '|'.join([identity['CITY_GIT_EMAIL']] * 2)
    assert git('config', 'user.name').strip() == 'Human', 'identity persisted'
    # Non-panter and unknown origins keep human identity, even on amend.
    for origin in ('https://github.com/macrozone/evermore.git', 'https://gitlab.com/panter/project.git', 'panter/local-path', ''):
        git('remote', 'remove', 'origin')
        if origin:
            git('remote', 'add', 'origin', origin)
        run('git', 'commit', '--allow-empty', '-m', 'human identity', extra=identity)
        run('git', 'commit', '--amend', '--allow-empty', '-m', 'human amend', extra=identity)
        assert git('log', '-1', '--format=%an|%cn').strip() == 'Human|Human'
        run('gh', 'pr', 'view', extra=dict(bot, EXPECTED_TOKEN='inherited'))
        run('publish', str(fake), extra={**bot, **identity, 'EXPECTED_TOKEN': 'inherited',
                                           'CITY_GH_TOKEN_CMD': str(mint)})
        if not origin:
            git('remote', 'add', 'origin', 'https://github.com/panter/maw-city.git')
    assert (tmp / 'minted').read_text() == 'xxxx'
    # A push URL overrides fetch origin; default push routing and -C/-c are honored.
    git('remote', 'set-url', '--push', 'origin', 'https://github.com/macrozone/evermore.git')
    run('git', 'push', 'origin', extra=dict(bot, GIT_BIN=str(fake), EXPECTED_TOKEN='inherited'))
    git('remote', 'add', 'personal', 'https://github.com/macrozone/evermore.git')
    git('config', 'remote.pushDefault', 'personal')
    run('git', 'push', extra=dict(bot, GIT_BIN=str(fake), EXPECTED_TOKEN='inherited'))
    git('config', '--unset', 'remote.pushDefault')
    git('config', '--unset-all', 'remote.origin.pushurl')
    # Every push URL must be panter, and per-command config overrides are resolved.
    git('remote', 'set-url', '--add', '--push', 'origin', 'https://github.com/panter/maw-city.git')
    git('remote', 'set-url', '--add', '--push', 'origin', 'https://github.com/macrozone/evermore.git')
    run('git', 'push', 'origin', extra=dict(bot, GIT_BIN=str(fake), EXPECTED_TOKEN='inherited'))
    git('config', '--unset-all', 'remote.origin.pushurl')
    run('git', '-C', str(tmp), '-c', 'remote.origin.pushurl=https://github.com/macrozone/evermore.git',
        'push', 'origin', extra=dict(bot, GIT_BIN=str(fake), EXPECTED_TOKEN='inherited'))
    assert (tmp / 'minted').read_text() == 'xxxx'
    # Exercise the actual Git credential protocol, including store suppression.
    git('config', 'credential.helper', '!printf unexpected >> "$HOME/persistent-helper"')
    auth = mod.child_env('git', ['push', 'origin'], dict(env, CITY_GH_TOKEN_CMD=str(mint)))
    assert all('fixture-only-token' not in v for k, v in auth.items() if k.startswith('GIT_CONFIG_'))
    filled = git('credential', 'fill', input='protocol=https\nhost=github.com\n\n', git_env=auth)
    assert 'password=fixture-only-token' in filled and 'username=x-access-token' in filled
    git('credential', 'approve', input=filled, git_env=auth)
    assert not (tmp / 'persistent-helper').exists(), 'persistent credential helper was used'
    assert 'fixture-only-token' not in (tmp / '.git/config').read_text()
    for url in ('git@github.com:panter/maw-city.git', 'ssh://git@github.com/panter/maw-city.git'):
        git('remote', 'add', 'probe', url)
        assert git('remote', 'get-url', 'probe', git_env=auth).strip() == 'https://github.com/panter/maw-city.git'
        git('remote', 'remove', 'probe')

# Guard compiled formula entry points and all six rig imports as well as runtime behavior.
import tomllib
config = tomllib.loads((ROOT / 'city.toml').read_text())
assert len(config['rigs']) == 6
assert all(r['imports']['publish_gate']['source'] == './packs/publish-gate' for r in config['rigs'])
for rel in ('do-work/implement', 'do-work-item/implement-item', 'implementation-base/implement',
            'implementation-item-base/implement-item', 'build-basic/implement', 'build-basic/implement-same-session',
            'implement/publish', 'build-basic/publish'):
    prompt = ROOT / f'packs/publish-gate/assets/workflows/{rel}.md'
    assert (prompt.parent / '../../scripts/city-github.py').resolve() == HELPER
    assert 'CITY_GITHUB_HELPER' in prompt.read_text()
print('OK city GitHub identity: fallback, fresh token, dry-run, failure, human upstream, real commits and credential protocol, all rig paths')
