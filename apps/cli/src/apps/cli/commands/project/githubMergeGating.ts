import { AGGREGATE_CHECK_JOB_NAME } from "@catladder/pipeline";

/**
 * github merge gating — shared between `project setup` (writes it) and
 * `project doctor` (verifies it).
 *
 * The gating lives in a repository RULESET, not classic branch
 * protection: only rulesets can carry bypass actors, and the release
 * job needs one. It pushes the release commit and tag straight to the
 * default branch — under classic protection the required `catladder ✅`
 * check rejects that push (GH006), because the fresh release commit
 * cannot have a passing check yet.
 *
 * The bypass actor is a DEPLOY KEY: github deliberately refuses the
 * built-in GitHub Actions app on bypass lists (any collaborator could
 * push anywhere by authoring a workflow), so the workflow token can
 * never bypass. Instead `project setup` provisions a write deploy key
 * (public half on the repo, private half as an actions secret) and the
 * release job pushes over ssh with it. Deploy keys are repo-scoped,
 * only admins can add them, and they never expire — gitlab's
 * counterpart is the maintainer-role `GL_TOKEN`, which has to be
 * renewed yearly.
 */

/** the app id of GitHub Actions — the integration reporting the check */
export const GITHUB_ACTIONS_APP_ID = 15368;

export const MERGE_GATING_RULESET_NAME = "catladder merge gating";

/** title of the deploy key `project setup` registers on the repo */
export const RELEASE_DEPLOY_KEY_TITLE = "catladder release";

/**
 * actions secret holding the deploy key's private half; the generated
 * release jobs pass it to catci, which pushes over ssh when it is set
 */
export const RELEASE_DEPLOY_KEY_SECRET = "CATLADDER_RELEASE_KEY";

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
    // deploy keys carry no id — the bypass covers every deploy key of
    // the repository (adding one requires admin anyway)
    { actor_id: null, actor_type: "DeployKey", bypass_mode: "always" },
  ],
});

/**
 * whether a ruleset provides working merge gating: active, requires
 * the aggregate check, and lets the release deploy key bypass it.
 * Extra rules or bypass actors someone added are fine.
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
      actor.actor_type === "DeployKey" && actor.bypass_mode === "always",
  );
