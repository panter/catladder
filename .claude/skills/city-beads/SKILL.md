---
name: city-beads
description: Read or file Gas City beads through the dashboard from a normal remote checkout. Use for city work status, bead IDs, searches, dependency queries, and filing or commenting on work when the checkout uses remote city access. Runtime workers with a local bead store follow their routed workflow instead.
---

# Remote city beads

Use the `city-beads` MCP tools when connected, or the bundled dependency-free
client (Node 22+). Both use the same API and personal Google login. The default
rig is configured in `config.json`; `--rig <city>/<rig>` selects another.

```bash
node .claude/skills/city-beads/scripts/city-bd.mjs status
# Codex can use .agents/skills/city-beads/scripts/city-bd.mjs.
```

Do not initialize a local bead store or use SSH to reach the city's store.
Runtime workers follow their claim protocol and use their existing local `bd`.

## First login

Exit code 3 with `SETUP NEEDED` means this machine needs a browser login. Tell
the human that bead access needs a one-time sign-in with their panter.ch Google
account and a click on Allow. Run the bundled client with `login`, then repeat
the original command after it succeeds. It waits up to five minutes; relay the
printed authorization URL if the browser cannot open. Tailscale and an entry in
the city's people.toml are required.

Never print, copy, or inspect the stored token. Tokens can be revoked at
`https://colab-city.angora-dojo.ts.net/beads/tokens`. A 401 requires login again;
403 names the missing permission (or an unregistered account). Run `whoami` to inspect current grants; ask an administrator or register manager to propose a People change. Do not retry through another identity or transport. A connection
failure (exit 4) means the dashboard or tailnet is unavailable. Report it rather
than falling back to local storage.

## Reads

For "what is going on?", run `status` and summarize work in progress, work
waiting for a human, ready items, and recent closures. `status` uses bounded
lists and is an overview rather than a complete inventory. Show IDs and titles;
use `show` for detail. Reads may be 60 seconds old.

```bash
node "$CITY_BD" rigs
node "$CITY_BD" whoami
node "$CITY_BD" list --status open --label human --limit 20
node "$CITY_BD" search "routing" --limit 10
node "$CITY_BD" show <id>
node "$CITY_BD" ready --limit 20
node "$CITY_BD" blocked
node "$CITY_BD" dep tree <id> --direction up
node "$CITY_BD" count --by-status
node "$CITY_BD" sql "SELECT status, COUNT(*) n FROM issues GROUP BY status"
node "$CITY_BD" help
```

Set `CITY_BD` to the bundled script path above. `show` includes comments. SQL
accepts one conservative read-only statement; prefer normal read tools when the
SQL gate refuses a construct. Bead tables include issues, labels, comments,
dependencies and events. `help` lists the current command and flag allow-list.
An HTTP 429 or 503 includes a retry interval; wait before another request.

## Filing work

Create or comment only within the user's requested task. Preview the proposed
content in the conversation when that is needed for the user's decision. The
explicit CLI command or MCP tool call submits it; writes are never retried
automatically. After an uncertain result, inspect the bead before retrying.

```bash
node "$CITY_BD" create "One clear goal" --type feature --priority 2 \
  --description-file description.md --acceptance-file acceptance.md
node "$CITY_BD" comment <id> "Context for the city"
node "$CITY_BD" comment <id> - < reply.md
node "$CITY_BD" label add <id> question
```

Creation requires nonempty acceptance criteria. Writes use
`remote-agent/<email>`; created beads receive server-owned `requested_by`
metadata. `approved` and `triage-checked` are refused as labels.

**Edits as with local bd:** `update`, `close`, `reopen`, `defer`, `undefer`,
`label add|remove` and `dep add|remove` work like local `bd` (MCP tool `bd_write`,
or `city-bd close <id> --reason "..."`, `city-bd update <id> --priority 1 --append-notes "..."`).
File flags (`--description-file` etc.) are read by the client, never by the server. Not
available: `delete`, store commands (dolt, sql writes, init, sync) and setting
`approved`/`triage-checked` directly. Act like a careful person at the keyboard: do not
claim or close beads that city workers are working on unless the person asks.

**Approval:** only when the person explicitly asks for it in this session (e.g.
"ja, freigeben", "let the city do it"), run `approve <id> <their exact words>`
(MCP tool `approve`). The server records the approval under the person's name,
which the city's dispatcher accepts, and keeps the quote as a comment; it needs
the `approve` permission for the target city/rig in people.toml. Never approve on your own initiative, never
for follow-ups you proposed, and never by other means (bd over SSH, labels):
the dispatcher strips those. If available, the `city-handoff` skill describes the city's work
format. Bead edits require the corresponding grant; this API never dispatches workflows.


## City permissions

`whoami` lists effective permissions by city/rig and the grant mode (`legacy`,
`explicit`, or `administrator`). `rigs` lists readable targets with permissions
and whether any writes are allowed. REST, MCP and this CLI enforce the same grants.
Viewer permits reads/SQL; Contributor adds create/comment; Maintainer adds
edit/labels/dependencies/defer and close/reopen; Approver adds approve; Full adds
po_feedback. Individual permissions can be selected instead. A rig grant replaces
its city grant; an explicit grant list denies unlisted scopes. Missing `read`
also prevents cached reads. `update --status` requires both edit and close.
Existing entries without grants preserve previous access and privileged global
rights; new people default to no grants. Administrators retain full access.
Human replies require comment and the existing assignment/admin rule. The city
interprets replies and must check approve/po_feedback against the same scope;
never treat a comment permission as approval authority.
