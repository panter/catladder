import { AGGREGATE_CHECK_JOB_NAME } from "@catladder/pipeline";
import { describe, expect, it } from "vitest";
import {
  desiredMergeGatingRuleset,
  GITHUB_ACTIONS_APP_ID,
  rulesetProvidesMergeGating,
} from "../githubMergeGating";

const asRuleset = (overrides: object = {}) => ({
  id: 1,
  ...desiredMergeGatingRuleset(),
  ...overrides,
});

describe("desiredMergeGatingRuleset", () => {
  it("requires the aggregate check on the default branch", () => {
    const ruleset = desiredMergeGatingRuleset();
    expect(ruleset.enforcement).toBe("active");
    expect(ruleset.conditions.ref_name.include).toEqual(["~DEFAULT_BRANCH"]);
    expect(ruleset.rules).toEqual([
      expect.objectContaining({
        type: "required_status_checks",
        parameters: expect.objectContaining({
          required_status_checks: [
            {
              context: AGGREGATE_CHECK_JOB_NAME,
              integration_id: GITHUB_ACTIONS_APP_ID,
            },
          ],
        }),
      }),
    ]);
  });

  it("lets deploy keys (the release push) bypass the gating — never the workflow token", () => {
    expect(desiredMergeGatingRuleset().bypass_actors).toEqual([
      { actor_id: null, actor_type: "DeployKey", bypass_mode: "always" },
    ]);
  });

  it("satisfies its own predicate", () => {
    expect(rulesetProvidesMergeGating(asRuleset())).toBe(true);
  });
});

describe("rulesetProvidesMergeGating", () => {
  it("rejects a disabled ruleset", () => {
    expect(
      rulesetProvidesMergeGating(asRuleset({ enforcement: "disabled" })),
    ).toBe(false);
  });

  it("rejects a ruleset without the aggregate check", () => {
    expect(rulesetProvidesMergeGating(asRuleset({ rules: [] }))).toBe(false);
    expect(
      rulesetProvidesMergeGating(
        asRuleset({
          rules: [
            {
              type: "required_status_checks",
              parameters: {
                required_status_checks: [{ context: "some other check" }],
              },
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("rejects a ruleset whose deploy-key bypass is missing or weakened", () => {
    expect(rulesetProvidesMergeGating(asRuleset({ bypass_actors: [] }))).toBe(
      false,
    );
    expect(
      rulesetProvidesMergeGating(
        asRuleset({
          bypass_actors: [
            {
              actor_id: null,
              actor_type: "DeployKey",
              bypass_mode: "pull_request",
            },
          ],
        }),
      ),
    ).toBe(false);
    // the broken pre-deploy-key encoding: github refuses the built-in
    // actions app as a bypass actor, so it must not count as gating
    expect(
      rulesetProvidesMergeGating(
        asRuleset({
          bypass_actors: [
            {
              actor_id: GITHUB_ACTIONS_APP_ID,
              actor_type: "Integration",
              bypass_mode: "always",
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("accepts extra rules and bypass actors alongside ours", () => {
    const desired = desiredMergeGatingRuleset();
    expect(
      rulesetProvidesMergeGating(
        asRuleset({
          rules: [{ type: "deletion" }, ...desired.rules],
          bypass_actors: [
            {
              actor_id: 5,
              actor_type: "RepositoryRole",
              bypass_mode: "always",
            },
            ...desired.bypass_actors,
          ],
        }),
      ),
    ).toBe(true);
  });
});
