#!/usr/bin/env bash
# Lokaler Workaround für gascity#5872/#6464/#6713: expliziter Repo-Root-Install.
# Entfernen, sobald GC Hooks am tatsächlich geladenen Ort dedupliziert installiert
# und Codex-Trust-Dialoge zuverlässig behandelt; siehe README (city-z8a).
set -euo pipefail
[ "$#" -eq 1 ] || { echo "Aufruf: DRY_RUN=1 $0 /pfad/zum/repo" >&2; exit 2; }
python3 - "$1" <<'PY'
import json
import os
import pathlib
import subprocess
import sys
import tempfile

repo = pathlib.Path(sys.argv[1]).resolve()
root = pathlib.Path(subprocess.check_output(
    ['git', '-C', str(repo), 'rev-parse', '--show-toplevel'], text=True).strip()).resolve()
if root != repo:
    sys.exit('Bitte den Repo-Root angeben, keinen Unterordner.')
path = root / '.codex' / 'hooks.json'
data = json.loads(path.read_text()) if path.exists() else {}
hooks = data.setdefault('hooks', {})
marker = '# maw-city:city-z8a'
# Keine automatische Ablösung fremder/alter GC-Hooks: Doppelzustellung vermeiden.
for groups in hooks.values():
    for group in groups:
        for hook in group.get('hooks', []):
            command = hook.get('command', '')
            if 'gc ' in command and marker not in command:
                sys.exit('Bestehende GC-Hooks zuerst prüfen; keine zweite Installation.')
commands = {
    'SessionStart': [('startup', 'prime --hook --hook-format codex')],
    'UserPromptSubmit': [('', 'nudge drain --inject --hook-format codex'),
                         ('', 'mail check --inject --hook-format codex')],
    'PreCompact': [('', 'handoff --auto "context cycle"')],
}
for event, entries in commands.items():
    groups = hooks.setdefault(event, [])
    for group in groups:
        group['hooks'] = [h for h in group.get('hooks', [])
                          if marker not in h.get('command', '')]
    groups[:] = [g for g in groups if g.get('hooks')]
    for matcher, args in entries:
        # GC_MANAGED_SESSION_HOOK allein ist kein Identitätsnachweis.
        command = ('if [ -n "${GC_SESSION_ID:-}" ] && [ -n "${GC_AGENT:-}" ]; then '
                   'GC_MANAGED_SESSION_HOOK=1 GC_HOOK_EVENT_NAME=' + event +
                   ' gc hook run --timeout 10s -- ' + args + '; fi ' + marker)
        groups.append({'matcher': matcher, 'hooks': [{'type': 'command', 'command': command}]})
rendered = json.dumps(data, indent=2, ensure_ascii=False) + '\n'
if os.environ.get('DRY_RUN') == '1':
    print(rendered, end='')
else:
    path.parent.mkdir(exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.hooks-')
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(rendered)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(f'Installiert: {path}. Hook-Trust in Codex prüfen und bestätigen.')
PY
