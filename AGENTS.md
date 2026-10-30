

<!-- city-beads:begin -->
## Beads from a normal checkout

Use the committed `city-beads` skill, its MCP tools or the bundled CLI:

```bash
node .claude/skills/city-beads/scripts/city-bd.mjs status
```

First use guides the person through browser login with their panter.ch Google account.
Do not run `bd prime`, initialize a local store, or use `bin/beads-sync` in a normal checkout.
A person approves in the dashboard; agent tokens cannot approve. Routed city workers on colab
continue using their existing local `bd` and claim protocol. Old stores on other machines are stale.

Any remaining local `bd` examples in this file apply only to routed city workers on colab.
Normal checkouts use `city-beads`; agent tokens never approve work.
<!-- city-beads:end -->
