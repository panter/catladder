#!/usr/bin/env python3
"""Apply the ADR 0007 requester/footer and review request. DRY_RUN never calls GitHub.

Model attribution reads fully resolved city config, including pack defaults and
agent patches. Commit coauthor trailers are added by implementation workers.
No registered requester (maw 2026-10-21: "typically the creator, if that is clear, otherwise the PO"):
no footer; the review is requested from every person with the right `po_feedback` in people.toml.
"""
import argparse
import json
import os
import re
import tomllib
from pathlib import Path
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import people as people_mod  # noqa: E402

GH = [sys.executable, str(Path(__file__).resolve().parents[1] /
      "packs/publish-gate/assets/scripts/city-github.py"), "gh"]
BD = os.environ.get("BD_BIN") or "/opt/homebrew/bin/bd"
DRY = os.environ.get("DRY_RUN", "0") == "1"
MARK = "<!-- requester -->"


def run(args, cwd=None):
    env = dict(os.environ, PATH="/opt/homebrew/bin:/usr/bin:/bin")
    return subprocess.run(args, cwd=cwd, env=env, capture_output=True, text=True, timeout=60, check=True).stdout


def forge_handle(person, forge="github"):
    """Keep identity lookup per forge; the register currently requires GitHub."""
    handle = person.get(forge)
    if not handle:
        raise ValueError(f"requester has no {forge} handle")
    return handle


def role_model(config, rig_name, role):
    agents = [a for a in config.get("agent", [])
              if a["name"].split(".")[-1] == role and a.get("dir") == rig_name]
    if len(agents) != 1:
        raise ValueError(f"cannot resolve {rig_name}/{role}")
    agent = agents[0]
    provider_name = agent.get("provider") or config["workspace"]["provider"]
    provider = config["providers"][provider_name]
    model = ((agent.get("options") or {}).get("model")
             or (agent.get("env") or {}).get("ANTHROPIC_MODEL")
             or (provider.get("option_defaults") or {}).get("model")
             or (provider.get("env") or {}).get("ANTHROPIC_MODEL"))
    if not model or "${" in model:
        raise ValueError(f"no explicit configured model for {role}")
    # Use configured model families for the short footer, retaining exact IDs
    # for providers whose model family is not known here.
    if provider_name == "codex" or provider.get("base") == "builtin:codex":
        return "Codex"
    match = re.match(r"claude-(sonnet|haiku|opus)(?:-|$)", model)
    return f"Claude {match[1].title()}" if match else model


def footer(person, config, rig_name, workflow):
    result = (f"{MARK}\nRequested by {person['name']} (@{forge_handle(person)})\n"
              f"Built by colab-city · implementation: {role_model(config, rig_name, 'implementation-worker')}")
    if workflow == "build-basic":
        roles = ("design-implementation-reviewer", "design-test-risk-reviewer",
                 "implementation-reviewer", "review-synthesizer")
        models = list(dict.fromkeys(role_model(config, rig_name, role) for role in roles))
        result += " · review: " + ", ".join(models)
    return result + "\n"


def update_body(body, block):
    # Replace only attribution lines/marker, preserving the rest of the PR.
    lines = [line for line in body.splitlines()
             if line.strip() != MARK
             and not re.match(r"^\s*(Requested by |Built by |Co-authored-by:)", line, re.I)
             and not re.search(r"Generated with.*Claude Code", line, re.I)]
    return "\n".join(lines).rstrip() + "\n\n" + block


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", required=True)
    ap.add_argument("--bead", required=True)
    ap.add_argument("--rig", required=True)
    ap.add_argument("--workflow", choices=("implement", "build-basic"), default="implement")
    ap.add_argument("--city", default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument("--rig-name", default="city")
    a = ap.parse_args()
    data = json.loads(run([BD, "show", a.bead, "--json"], cwd=a.rig) or "{}")
    bead = data[0] if isinstance(data, list) else data
    email = (bead.get("metadata") or {}).get("requested_by")
    person = people_mod.by_email(email) if email else None
    reviewers = [forge_handle(person)] if person else [p["github"] for p in people_mod.load()[0]
                                                   if "po_feedback" in p.get("rights", [])]
    if not person:
        print(f"requester-pr: {a.bead} has no registered requester ({email or 'none'}); review from POs "
              f"{', '.join('@' + r for r in reviewers) or '(none)'}")
    if DRY:
        print(f"requester-pr: would verify/add {'requester credit and ' if person else ''}review for "
              f"{', '.join('@' + r for r in reviewers)}; no GitHub calls")
        return 0
    pr = json.loads(run([*GH, "pr", "view", a.pr, "--repo", a.repo, "--json", "body,author,reviewRequests,reviews"]))
    body = pr.get("body") or ""
    # Merged PRs close their work bead only with an explicit closing keyword (maw-city #115, zue-city #75,
    # 2026-10-22); the city states it for the bead this PR delivers.
    if not re.search(rf"(?im)\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)[: ]+#?{re.escape(a.bead)}(?![0-9A-Za-z.-])", body):
        closes = body.rstrip() + f"\n\nCloses {a.bead}\n"
        print(f"requester-pr: add 'Closes {a.bead}' to {a.repo}#{a.pr}")
        run([*GH, "pr", "edit", a.pr, "--repo", a.repo, "--body", closes])
        body = closes
    if person:
        config = tomllib.loads(run([os.environ.get("GC_BIN", "gc"), "config", "show", "--city", a.city]))
        updated = update_body(body, footer(person, config, a.rig_name, a.workflow))
        if updated != body:
            print(f"requester-pr: update requester block for @{reviewers[0]} on {a.repo}#{a.pr}")
            run([*GH, "pr", "edit", a.pr, "--repo", a.repo, "--body", updated])
    done = {r.get("login") for r in pr.get("reviewRequests") or []}
    done |= {(r.get("author") or {}).get("login") for r in pr.get("reviews") or []}
    author = (pr.get("author") or {}).get("login")
    for login in reviewers:
        if login and login not in done and login != author:
            print(f"requester-pr: request review from @{login}")
            run([*GH, "pr", "edit", a.pr, "--repo", a.repo, "--add-reviewer", login])
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (subprocess.SubprocessError, ValueError, KeyError) as exc:
        print(f"requester-pr: failed ({exc.__class__.__name__}); requester credit/review request incomplete", file=sys.stderr)
        sys.exit(1)
