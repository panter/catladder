import { AGGREGATE_CHECK_JOB_NAME } from "@catladder/pipeline";

/**
 * github merge gating — shared between `project setup` (writes it) and
 * `project doctor` (verifies it).
 *
 * The gating lives in a repository RULESET, not classic branch
 * protection: only rulesets can carry bypass actors, and the release
 * job needs one. It pushes the release commit and tag straight to the
 * default branch with the workflow token — under classic protection
 * the required `catladder ✅` check rejects that push (GH006), because
 * the fresh release commit cannot have a passing check yet. The bypass
 * covers the GitHub Actions app, i.e. pushes made by workflows, while
 * PRs and humans stay gated. (Gitlab's counterpart is the
 * maintainer-role project access token, which may push to protected
 * branches by default — the same trade-off, made by the platform.)
 */

/** the app id of GitHub Actions — the actor workflow tokens act as */
export const GITHUB_ACTIONS_APP_ID = 15368;

export const MERGE_GATING_RULESET_NAME = "catladder merge gating";

export type GithubRuleset = {
  id: number;
  name: string;
  enforcement: string;
  rules?: Array<{
    type: string;
    parameters?: {
      required_status_checks?: Array<{ context: string }>;
    };
  }>;
  bypass_actors?: Array<{
    actor_id?: number | null;
    actor_type: string;
    bypass_mode: string;
  }>;
};

/** the ruleset `project setup` creates (and restores on drift) */
export const desiredMergeGatingRuleset = () => ({
  name: MERGE_GATING_RULESET_NAME,
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: false,
        do_not_enforce_on_create: false,
        required_status_checks: [
          {
            context: AGGREGATE_CHECK_JOB_NAME,
            integration_id: GITHUB_ACTIONS_APP_ID,
          },
        ],
      },
    },
  ],
  bypass_actors: [
    {
      actor_id: GITHUB_ACTIONS_APP_ID,
      actor_type: "Integration",
      bypass_mode: "always",
    },
  ],
});

/**
 * whether a ruleset provides working merge gating: active, requires
 * the aggregate check, and lets the release job (GitHub Actions app)
 * bypass it. Extra rules or bypass actors someone added are fine.
 */
export const rulesetProvidesMergeGating = (ruleset: GithubRuleset): boolean =>
  ruleset.enforcement === "active" &&
  (ruleset.rules ?? []).some(
    (rule) =>
      rule.type === "required_status_checks" &&
      (rule.parameters?.required_status_checks ?? []).some(
        (check) => check.context === AGGREGATE_CHECK_JOB_NAME,
      ),
  ) &&
  (ruleset.bypass_actors ?? []).some(
    (actor) =>
      actor.actor_type === "Integration" &&
      actor.actor_id === GITHUB_ACTIONS_APP_ID &&
      actor.bypass_mode === "always",
  );
