#!/usr/bin/env bash
# Read-only decision helper for gascity-packs#387/#400; DRY_RUN=1 is identical.
# Remove when the adopted upstream pack closes after outer publish, handles
# explicit no-ops and sequences teardown after closure in both drain modes.
# Usage: publish-gate-decide.sh OUTCOME MEMBER_JSON [PUBLISH_JSON] [REPOSITORY]
# REPOSITORY is an explicit existing local repository fallback if work_dir is gone.
# The caller verifies root/convoy membership and remote evidence; this helper
# proves object existence and ancestry/retention, and never mutates beads or Git.
set -euo pipefail
python3 - "$@" <<'PY'
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def decide(outcome, member, publish, repository):
    metadata = member.get('metadata') or {}
    if not isinstance(metadata, dict):
        raise ValueError('member metadata must be an object')
    if (member.get('issue_type') not in ('task', 'feature', 'bug', 'chore')
            or any(key in metadata for key in ('gc.kind', 'gc.root_bead_id', 'gc.formula_name'))):
        return {'action': 'skip', 'reason': 'not_real_work'}
    state = metadata.get('gc.publish_state')
    if state in ('delivered', 'noop'):
        return {'action': 'skip', 'reason': 'already_delivered'}
    if state != 'pending':
        return {'action': 'skip', 'reason': 'not_pending'}
    if member.get('status') not in ('open', 'in_progress'):
        return {'action': 'skip', 'reason': 'not_open'}
    failure = {'action': 'keep_open', 'reason': 'publish_not_successful'}
    pm = publish.get('metadata') or {}
    if not isinstance(pm, dict):
        raise ValueError('publish metadata must be an object')
    if (outcome not in ('pushed', 'pr_opened', 'noop')
            or publish.get('status') != 'closed' or pm.get('gc.outcome') != 'pass'
            or pm.get('gc.publish_outcome') != outcome):
        return failure
    commit = metadata.get('gc.implemented_commit', '')
    summary = metadata.get('gc.implemented_summary', '')
    sha = r'(?:[0-9a-f]{40}|[0-9a-f]{64})'
    if not isinstance(commit, str) or not re.fullmatch(sha, commit):
        return {'action': 'human', 'label': 'human', 'reason': 'commit_unverifiable'}
    if not isinstance(summary, str) or not Path(summary).is_absolute():
        return failure
    head = pm.get('gc.publish_head', '')
    ref = pm.get('gc.publish_ref', '')
    url = pm.get('gc.publish_pr_url', '')
    if outcome in ('pushed', 'pr_opened'):
        if (not isinstance(head, str) or not re.fullmatch(sha, head)
                or not isinstance(ref, str) or not ref.startswith('refs/')
                or not isinstance(pm.get('gc.publish_repository'), str)
                or not pm.get('gc.publish_repository')):
            return failure
        if outcome == 'pr_opened' and (not isinstance(url, str) or not re.fullmatch(r'https?://\S+', url)):
            return failure
    elif pm.get('gc.publish_reason') not in ('publishing disabled', 'nothing to publish'):
        return failure
    repo = repository or metadata.get('work_dir', '')
    if not isinstance(repo, str) or not Path(repo).is_absolute() or not Path(repo).is_dir():
        return {'action': 'human', 'label': 'human', 'reason': 'commit_unverifiable'}

    def git(*args):
        # Git reads are the only external operations; no checkout/fetch/ref writes.
        return subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True,
                              env=dict({k: v for k, v in os.environ.items() if not k.startswith("GIT_")},
                                       GIT_OPTIONAL_LOCKS="0"))

    if git('cat-file', '-e', commit + '^{commit}').returncode:
        return {'action': 'human', 'label': 'human', 'reason': 'commit_unverifiable'}
    if outcome in ('pushed', 'pr_opened'):
        if (git('cat-file', '-e', head + '^{commit}').returncode
                or git('merge-base', '--is-ancestor', commit, head).returncode):
            return failure
        evidence = f'{ref} at {head}' if outcome == 'pushed' else f'{url} at {head}'
        return {'action': 'close', 'publish_state': 'delivered',
                'reason': f'Implemented commit {commit} published via {evidence}'}
    retained = git('for-each-ref', '--contains=' + commit, '--format=%(refname)',
                   'refs/heads', 'refs/remotes')
    if retained.returncode or not retained.stdout.strip():
        return {'action': 'human', 'label': 'human', 'reason': 'commit_unreachable'}
    return {'action': 'close', 'publish_state': 'noop',
            'reason': f'{pm["gc.publish_reason"]}; commit {commit} retained in repository {repo} '
                      f'at {retained.stdout.splitlines()[0]}; worktree {metadata.get("work_dir", "unavailable")}'}


try:
    if not 3 <= len(sys.argv) <= 5:
        raise ValueError('usage: publish-gate-decide.sh OUTCOME MEMBER_JSON [PUBLISH_JSON] [REPOSITORY]')
    member = json.loads(sys.argv[2])
    publish = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    if not isinstance(member, dict) or not isinstance(publish, dict):
        raise ValueError('member and publish must be objects')
    print(json.dumps(decide(sys.argv[1], member, publish, sys.argv[4] if len(sys.argv) > 4 else ''), sort_keys=True))
except (ValueError, TypeError, OSError) as error:
    print(f'publish-gate-decide: {error}', file=sys.stderr)
    raise SystemExit(1)
PY
