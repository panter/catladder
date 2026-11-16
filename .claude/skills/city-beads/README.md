# city-beads distribution payload

This directory is the dashboard-side payload for adoption by panter/maw-city
`packs/city-handoff`. It is not installed into other repositories by this PR.
The city-handoff config repository must import it in its own reviewed PR, then
use its normal per-repository sync PRs. Do not patch live city configuration.

Copy SKILL.md, agents/openai.yaml, scripts/city-bd.mjs and config.json into the
pack's skill template. Fill in the target repository's `<city>/<rig>` in
config.json. Keep `.agents/skills/city-beads` linked to
`../../.claude/skills/city-beads` when the skill is stored under `.claude`.

Merge these entries into the repositories' existing MCP configuration (preserve
other entries):

```json
{"mcpServers":{"city-beads":{"type":"http","url":"https://colab-city.angora-dojo.ts.net/mcp?rig=<city>/<rig>"}}}
```

```toml
[mcp_servers.city-beads]
url = "https://colab-city.angora-dojo.ts.net/mcp?rig=<city>/<rig>"
```

The former is `.mcp.json` for Claude Code, the latter `.codex/config.toml`.
No credentials belong in either file. Each user signs in through their client
or `node <skill-path>/scripts/city-bd.mjs login` after trusting the checkout.
