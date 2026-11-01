

<!-- city-beads:begin -->
## City work in a normal checkout

The city implements work handed over through the committed `city-handoff` skill.
Use `city-beads` (MCP tools or `node .claude/skills/city-beads/scripts/city-bd.mjs`)
to read, create and comment on beads. Its first use guides browser login.
Only approve when the person explicitly requests it, using `city-bd approve`
with their exact words; never add the `approved` label as an agent.

Do not initialize or read a local `.beads/` store in a normal checkout, and do
not use SSH or legacy `beads-sync` commands to access the city. Any local `bd`
examples elsewhere in this file apply only to routed Gas City workers.
Routed workers follow their existing startup claim, local store and closure
protocols; this section does not replace those protocols.
<!-- city-beads:end -->
