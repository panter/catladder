#!/usr/bin/env python3
"""Installer und Session-Guards isoliert prüfen, ohne laufende City."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

installer = Path(__file__).with_name('install-codex-hooks.sh')
with tempfile.TemporaryDirectory(prefix='city-hooks-') as directory:
    repo = Path(directory)
    subprocess.run(['git', 'init', '-q', str(repo)], check=True)
    folder = repo / '.codex'
    folder.mkdir()
    path = folder / 'hooks.json'
    custom = {'type': 'command', 'command': 'echo custom'}
    path.write_text(json.dumps({'hooks': {'Stop': [{'hooks': [custom]}]}}))
    initial = path.read_bytes()
    preview = subprocess.check_output(['bash', str(installer), str(repo)],
                                      env={**os.environ, 'DRY_RUN': '1'})
    assert path.read_bytes() == initial
    env = {**os.environ, 'DRY_RUN': '0'}
    subprocess.run(['bash', str(installer), str(repo)], env=env, check=True, capture_output=True)
    first = path.read_bytes()
    subprocess.run(['bash', str(installer), str(repo)], env=env, check=True, capture_output=True)
    assert path.read_bytes() == first == preview
    hooks = json.loads(first)['hooks']
    assert hooks['Stop'][0]['hooks'] == [custom]
    fake = repo / 'gc'
    fake.write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOOK_LOG"\n')
    fake.chmod(0o755)
    log = repo / 'calls'
    clean = {k: v for k, v in os.environ.items()
             if k not in ('GC_SESSION_ID', 'GC_AGENT', 'GC_MANAGED_SESSION_HOOK')}
    clean.update(PATH=str(repo) + ':' + os.environ['PATH'], HOOK_LOG=str(log))
    managed = [h['command'] for e in ('SessionStart', 'UserPromptSubmit', 'PreCompact')
               for g in hooks[e] for h in g['hooks']]
    for command in managed:
        subprocess.run(['bash', '-c', command], env=clean, check=True)
    assert not log.exists(), 'Private Codex-Session muss wirkungslos bleiben'
    for command in managed:
        subprocess.run(['bash', '-c', command],
                       env={**clean, 'GC_SESSION_ID': 'test', 'GC_AGENT': 'city/test'}, check=True)
    calls = log.read_text().splitlines()
    assert len(calls) == 4 and all(c.startswith('hook run --timeout 10s -- ') for c in calls)
    assert any('nudge drain --inject --hook-format codex' in c for c in calls)
    assert any('mail check --inject --hook-format codex' in c for c in calls)
    path.write_text('{kaputt')
    assert subprocess.run(['bash', str(installer), str(repo)], env=env, capture_output=True).returncode
    assert path.read_text() == '{kaputt'
print('OK: Codex-Hooks DRY_RUN, Erhaltung, Idempotenz und Session-Guards')
