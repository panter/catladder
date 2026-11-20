import { createComponentContext } from "@catladder/pipeline";
import type { Config } from "@catladder/pipeline";
import { describe, expect, it } from "vitest";
import { resolveLogTarget } from "../logQuery";

const config = {
  appName: "shop",
  store: { gcloudProjects: { p: { projectNumber: "123456789" } } },
  customerName: "acme",
  components: {
    web: {
      dir: ".",
      build: { type: "custom", buildCommand: "true" },
      deploy: {
        type: "google-cloudrun",
        projectId: "p",
        region: "europe-west6",
        service: {},
        jobs: { migrate: { image: "x", command: "true" } },
      },
    },
  },
} as unknown as Config;

const ctx = (env: string) =>
  createComponentContext({ config, componentName: "web", env });

describe("resolveLogTarget", () => {
  it("resolves service and job names like the deploy", async () => {
    const context = await ctx("dev");
    expect(resolveLogTarget(context)).toMatchObject({ kind: "service" });
    expect(resolveLogTarget(context, { job: "migrate" })).toEqual({
      kind: "job",
      name: "acme-shop-dev-web-migrate",
    });
  });

  it("rejects unknown jobs", async () => {
    const context = await ctx("dev");
    expect(() => resolveLogTarget(context, { job: "nope" })).toThrow(
      /no job 'nope'/,
    );
  });

  it("needs the review slug on review envs and substitutes it", async () => {
    const context = await ctx("review");
    expect(() => resolveLogTarget(context, { job: "migrate" })).toThrow(
      /--review-slug/,
    );
    expect(
      resolveLogTarget(context, { job: "migrate", reviewSlug: "pr112" }),
    ).toEqual({ kind: "job", name: "acme-shop-review-pr112-web-migrate" });
  });
});
