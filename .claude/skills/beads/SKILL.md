---
name: beads
description: Choose remote city-beads access in ordinary clones or local bd in routed city worker sessions.
---

# Bead access

In a normal checkout, use the committed `city-beads` skill and its MCP tools or
`node .claude/skills/city-beads/scripts/city-bd.mjs status`. Guide the person through
first browser login when requested. Do not run `bd prime`, initialize a store,
or synchronize an old store. A person approves work in the dashboard.

A routed Gas City worker on colab follows its startup claim protocol and uses
its existing local `bd` store. This skill does not change runtime or closure contracts.
