---
name: city-handoff
description: Hand work to a Gas City as beads instead of coding it yourself. Use whenever a human or an interactive session wants the city to build, fix, research or change something in this rig – "let the city do X", "create a bead/feature/spike for the city", "plan feature X", "hand this to zue/evermore", or when the Mayor is asked to plan work. Covers requirements in beads, spikes for open questions, slicing with dependencies, approval, what not to do (sling, write into plans/, /tmp references) and how to follow up.
---

# Handing work to the city

The city builds; sessions (and the Mayor) describe work as **beads**. A dispatcher order picks up ready, approved
beads and starts the right workflow – you never start workflows yourself.

## Rules

1. **Beads, not code.** Do not implement the change yourself. Create beads through `city-beads` in a normal checkout; routed city workers use
   their existing local `bd`. Then stop.
2. **Requirements live in the bead.** Title = one goal. Description: context a stranger needs, the why, constraints.
   `--acceptance` with checkable acceptance criteria. Put research, options and decisions in `--design` / `--notes`.
   Longer material (a plan draft, sources) goes into the repo as a small docs PR (e.g. `docs/product/…`) and is
   linked from the bead. **Never reference `/tmp`, scratchpads or other session-local paths** – they disappear.
3. **Do not write `requirements.md` / `implementation-plan.md` into the city's `plans/` directory** and do not pass
   `requirements_path`/`plan_path` yourself. The workflow derives and reviews requirements from the bead.
4. **Open questions become spikes**: one bead per question (type task, label `spike`), with the question and what a
   good answer contains in the acceptance criteria. In all city-city rigs, the spike workflow writes
   `docs/spikes/<id>-<slug>.md` as a docs-only PR to the rig's repository, or records a short answer in the bead.
   Follow-up beads never receive `approved` automatically; an unanswered question ends in a `human` bead.
5. **Slice big work.** One bead per reviewable PR. A feature touching several areas (schema, ingest, UI, evals) is
   2–3 beads linked by blocking dependencies, not one bead:
   `bd dep add <later> --blocked-by <earlier>` (also feature `--blocked-by` its spikes). Small bugs found on the way
   get their own bug bead (`--deps discovered-from:<feature>`).
6. **Approval.** Every work bead needs approval from a human in the dashboard, including
   human-created and `upstream` beads. The only exemption is a declared standing order whose provenance metadata,
   label and title all match. Approve when the bead is ready to build; open blockers are fine – the dispatcher
   waits until they are closed. Fresh agent-created beads carrying `approved` lose it and get `needs-triage` +
   `triage-checked`; human reapproval clears `needs-triage`. Agents never approve their own follow-ups. Remote agent tokens cannot set `approved` or `triage-checked`;
   a request in the conversation is recorded as context, not represented as dashboard approval.
7. **Never sling.** Do not run `gc sling`, do not start formulas, do not claim beads. The dispatcher applies budgets,
   overload rules, attempt limits and the right formula. (Exception: the human explicitly asks for a manual start.)
8. **Follow up** in the city dashboard (https://colab-city.angora-dojo.ts.net, page «Needs you» for beads waiting for a human) or
   with `bd show <id>` / `bd comments <id>`. Answer a question on a bead with a comment and remove the label `human`.

## From a normal checkout (ADR 0011)

The city implements by default, also when a human works in an ordinary clone with Claude Code or Codex.
Interpret "build/fix/add X" as a request to write a bead (rules above), unless the human says to build it here.

- **Local PR → the city finishes it.** When the human built it here: open the PR, then create a bead with label
  `handoff-pr` and `--metadata 'city.handoff={"kind":"pr","repository":"<owner/repo>","number":<N>}'`
  (acceptance criteria = what the PR must achieve). The dispatcher runs `pr-handoff`: review against the bead,
  finish on the same branch, `Closes <bead>`, review request; never merge. The bead stays open until the merge.
- **Prototype → the city implements.** Push it as a draft PR or branch; bead with label `handoff-prototype` and
  `city.handoff={"kind":"prototype","repository":"<owner/repo>","number":<N>}` or `"ref":"<branch>"`. The
  description says what the prototype shows and what the real implementation must do; the city opens its own PR.
- **Access:** use the committed `city-beads` skill (MCP or its bundled CLI). For "what is going on?", run
  `node .claude/skills/city-beads/scripts/city-bd.mjs status`. First use guides the person through Google login.
  Do not initialize a local store, run `bd prime`, or use SSH as the normal path. On colab, routed workers keep
  using their claim protocol and local `bd`; the remote skill does not replace runtime instructions.
- **Approval:** file the bead, then direct the person to the dashboard to approve it. Agent tokens cannot approve.
- **Dependencies and PR metadata:** the remote API currently cannot alter dependencies or set arbitrary metadata.
  Put the exact blocking IDs and `city.handoff` JSON in the description and ask a city operator to apply them with
  local `bd` before approval. Do not dispatch an incomplete PR handoff. Never substitute SSH or a stale store.

## Per city

- **zue** (rig `zue`, panter/zue-zuerich-tourismus): every approved bead runs `build-basic` (requirements → plan →
  decomposition into ≤4 work items → implementation → review lanes → PR); label `spike` runs the spike formula.
  PRs get a review app (`catladder:review-app`) and wait for PO feedback (`needs-po-feedback`) before the merge
  train merges them; conflicts are repaired automatically. Teammates on other machines use `city-beads`; `beads-sync` is a legacy offline fallback only.
- **evermore** (rig `evermore`, macrozone/evermore): fast iteration – default formula `quick` (one slice, push to
  `main`, no PR); labels `big`, `core` or `area:infra` run `build-basic`; light labels (`small`, `docs`, `tests`,
  `config`, `effort:light`) force the quick path. Never open PRs in the game repo. Beads with open children are not
  dispatched (the children carry the work; label `own-work` overrides).
- **City config repos and city-city rigs** (maw-city rigs `city`, `evermore-city`, `zue-city`, `lumen-city`,
  `city-dashboard`, `catladder`): label `spike` runs the research/evidence-review/publish workflow and takes
  precedence over `big`; label `big` runs `build-basic`, otherwise `implement`. Findings go to
  `docs/spikes/<id>-<slug>.md` as a docs-only PR (or a short bead answer). PRs go to the rig's own repo and
  maw merges, with no merge train. Follow-ups need human approval; unresolved questions end in a `human`
  bead. Every work bead needs `approved` from a human, regardless of creator or `upstream` label; only a declared
  standing order with matching provenance metadata, label and title is exempt.
  **Requests to the city-city** (a feature for catladder or the dashboard, a fix in a city's config, an order or
  formula change) go the same way: create the beads in that rig's checkout (`~/git/maw-city-src`,
  `~/git/zue-city-src`, `~/git/cities/evermore-city-src`, `~/git/cities/lumen-city-src`,
  `~/git/cities/city-dashboard`, `~/git/cities/catladder`) and tell the human. Do not message an interactive
  city-city Claude session to do it for you; it may not be running, and the request then lives only in its
  transcript. Something urgent that needs the city-city's attention (not a work item): `gc mail send mayor
  --city ~/git/maw-city -s "<subject>" -m "<text>"`.

## Checklist before you finish

- [ ] Each bead: one goal, context, acceptance criteria, no session-local paths.
- [ ] Open questions → spikes; dependencies as `--blocked-by`.
- [ ] Human directed to dashboard approval (or a comment why it waits).
- [ ] Nothing slung, nothing written into `plans/`, no code changed.
