import { describe, expect, it } from "vitest";
import { getDefaultAuditCommand } from "../packageManagerInstall";

const pnpm = { type: "pnpm", version: "11.20.0", workspaces: [] } as any;
const yarnBerry = {
  type: "yarn",
  version: "4.0.0",
  isClassic: false,
  workspaces: [],
} as any;
const yarnClassic = { ...yarnBerry, version: "1.22.22", isClassic: true };

describe("default audit command", () => {
  it("fails on critical advisories by default", () => {
    expect(getDefaultAuditCommand(pnpm)).toBe(
      "pnpm audit --prod --audit-level critical",
    );
    expect(getDefaultAuditCommand(yarnBerry)).toBe(
      "yarn npm audit --environment production --severity critical --all --recursive",
    );
    expect(getDefaultAuditCommand(yarnClassic)).toBe(
      "yarn audit --level critical --groups dependencies",
    );
  });

  it("takes the configured level, in each package manager's own flag", () => {
    expect(getDefaultAuditCommand(pnpm, "high")).toContain(
      "--audit-level high",
    );
    expect(getDefaultAuditCommand(yarnBerry, "high")).toContain(
      "--severity high",
    );
    expect(getDefaultAuditCommand(yarnClassic, "high")).toContain(
      "--level high",
    );
  });

  it("audits every workspace and the transitive tree on yarn berry", () => {
    // without these, `yarn npm audit` only checks the current workspace's
    // direct dependencies — in a monorepo root, usually nothing at all
    const command = getDefaultAuditCommand(yarnBerry);
    expect(command).toContain("--all");
    expect(command).toContain("--recursive");
  });

  it("throws for a package manager without an audit command", () => {
    expect(() => getDefaultAuditCommand({ type: "npm" } as any)).toThrow(
      /no audit command implemented/,
    );
  });
});
