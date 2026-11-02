<!-- city-beads:begin -->

## City work in a normal checkout

The city implements work handed over through the committed `city-handoff` skill.
Use `city-beads` (MCP tools or `node .claude/skills/city-beads/scripts/city-bd.mjs`)
to read, create and comment on beads. Its first use guides browser login.
If the `city-beads` MCP server is not connected or asks for authentication, use
the bundled CLI (same API and login) instead of asking the person to run `/mcp`.
For city-city work, put `--rig maw-city/<rig>` before the subcommand; rigs are
`city`, `zue-city`, `evermore-city`, `lumen-city`, `city-dashboard`, `catladder`.
Link the triggering bead's ID and city/rig in the description and set dependencies
with `dep add <later> --blocked-by <earlier>` (or `--type discovered-from`) before
approval. Cross-rig blockers need verification in the predecessor's rig before
approval; see the city-handoff skill's beads#5784 limitation.
Urgent notices use `mail "<subject>" "<text>"`; work requests need beads.
Only approve when the person explicitly requests it, using `city-bd approve`
with their exact words; never add the `approved` label as an agent.

Local checkouts are Git checkouts only: never run `bd` or `gc` there to file work.
Do not initialize or read a local `.beads/` store in a normal checkout, and do
not use SSH or legacy `beads-sync` commands to access the city. Any local `bd`
examples elsewhere in this file apply only to routed Gas City workers.
Routed workers follow their existing startup claim, local store and closure
protocols; this section does not replace those protocols.

<!-- city-beads:end -->
