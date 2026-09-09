import { describe, expect, it } from "vitest";
import type { Config } from "../../../types";
import { GithubBackend } from "../GithubBackend";

const baseConfig = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: true },
  components: {
    api: {
      dir: "api",
      build: { type: "node" },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "some-cluster-name",
          region: "europe-west6",
          projectId: "some-project-id",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
      },
    },
  },
} as unknown as Config;

const withReleases = (releases: object) =>
  ({ ...baseConfig, releases }) as unknown as Config;

const releaseJobOf = async (config: Config) => {
  const workflows = await new GithubBackend().createWorkflows(config);
  const job = workflows["catladder-create-release.yml"].jobs["create-release"];
  return { workflows, job };
};

describe("github release workflows", () => {
  it("the tagged release workflow runs once per tag at a time, never cancelled", async () => {
    const workflows = await new GithubBackend().createWorkflows(baseConfig);
    const release = workflows["catladder-release.yml"];
    // a deploy-key push (with [skip ci]) and a token push both leave the
    // explicit dispatch as the only run; the group is the belt and braces
    expect(release.on).toEqual({
      push: { tags: ["v*"] },
      workflow_dispatch: {},
    });
    expect(release.concurrency).toEqual({
      group: "catladder-release-${{ github.ref_name }}",
      "cancel-in-progress": false,
    });
  });

  it.each([
    ["semantic-release", {}, "semanticRelease"],
    ["changesets", { method: "changesets" }, "changesetsRelease"],
  ])(
    "the %s release job receives the release deploy key and runs %s",
    async (_method, releases, script) => {
      const { job } = await releaseJobOf(withReleases(releases));
      // the ruleset bypass actor: without it the push fails on GH013
      expect(job.env?.CATLADDER_RELEASE_KEY).toBe(
        "${{ secrets.CATLADDER_RELEASE_KEY }}",
      );
      expect(job.env?.GITHUB_TOKEN).toBe("${{ github.token }}");
      expect(job.permissions).toMatchObject({
        contents: "write",
        actions: "write",
      });
      const steps = job.steps.map((step) => step.run).filter(Boolean);
      expect(steps.at(-1)).toBe(script);
    },
  );
});
