import { describe, expect, it } from "vitest";
import { getEnvironmentContext } from "../../../../context/getEnvironmentContext";
import type { Config } from "../../../../types/config";
import type { DeployConfigCloudRun } from "../../..";
import type { BuildConfig } from "../../../../build/types";
import type { EnvironmentContext } from "../../../../types/environmentContext";
import {
  CLOUD_RUN_DNS_SEGMENT_LIMIT,
  REVIEW_SLUG_LENGTH_BUDGET,
  getServiceNameForEnvContext,
  resolveCloudRunComponentPart,
} from "../getServiceName";

const PROJECT_NUMBER = "123456789012";

const resolve = (
  componentName: string,
  overrides: Partial<Parameters<typeof resolveCloudRunComponentPart>[0]> = {},
) =>
  resolveCloudRunComponentPart({
    customerName: "pan",
    appName: "test-app",
    env: "review",
    isReviewEnv: true,
    componentName,
    projectNumber: PROJECT_NUMBER,
    otherComponentNames: [],
    ...overrides,
  });

describe("resolveCloudRunComponentPart", () => {
  it("keeps the component name when the url already fits", () => {
    expect(resolve("www")).toEqual({
      value: "www",
      dropped: 0,
      // pan-test-app-review-mr123456-www-123456789012
      dnsSegmentLength: 45,
    });
  });

  it("shortens the component name so the url stays within the dns limit", () => {
    const { value, dropped, dnsSegmentLength } = resolve(
      "recipe-processing-service",
    );
    expect(value).toBe("recipe-processing-ser");
    expect(dropped).toBe(4);
    expect(dnsSegmentLength).toBe(CLOUD_RUN_DNS_SEGMENT_LIMIT);
  });

  it("reserves room for the review slug, so the same name may fit a fixed env", () => {
    // exactly at the limit for review, with room to spare without a slug
    expect(resolve("recipe-processing-service").dropped).toBe(4);
    expect(
      resolve("recipe-processing-service", {
        env: "prod",
        isReviewEnv: false,
      }).dropped,
    ).toBe(0);
  });

  it("does not leave a trailing dash in the hostname", () => {
    // 22 characters: cut at 21 would end on the dash
    const { value } = resolve("recipe-processing-svc-a");
    expect(value).toBe("recipe-processing-svc");
  });

  it("rejects a shortened name that collides with another component", () => {
    expect(() =>
      resolve("recipe-processing-service", {
        otherComponentNames: ["recipe-processing-service-worker", "www"],
      }),
    ).toThrow(/collide in env "review"/);
  });

  it("accepts siblings that stay distinguishable after shortening", () => {
    expect(
      resolve("recipe-processing-service", {
        otherComponentNames: ["recipe-importing-service", "www"],
      }).value,
    ).toBe("recipe-processing-ser");
  });

  it("reports the fixed parts when nothing sensible is left for the component", () => {
    expect(() =>
      resolve("recipe-processing-service", {
        appName: "a-very-long-application-name-indeed",
      }),
    ).toThrow(/Shorten appName \("a-very-long-application-name-indeed"\)/);
  });

  it("budgets a six digit review number", () => {
    expect(REVIEW_SLUG_LENGTH_BUDGET).toBe("mr123456".length);
  });
});

const createConfig = (componentName: string): Config =>
  ({
    appName: "test-app",
    customerName: "pan",
    store: {
      gcloudProjects: {
        "google-project-id": { projectNumber: PROJECT_NUMBER },
      },
    },
    components: {
      [componentName]: {
        dir: componentName,
        build: { type: "node" },
        deploy: {
          type: "google-cloudrun",
          projectId: "google-project-id",
          region: "europe-west6",
        },
      },
    },
  }) as unknown as Config;

const envContextFor = (componentName: string, env: string) =>
  getEnvironmentContext({
    config: createConfig(componentName),
    componentName,
    env,
    pipelineType: "gitlab",
  }) as EnvironmentContext<BuildConfig, DeployConfigCloudRun>;

describe("getServiceNameForEnvContext", () => {
  it("is the environment's full name whenever it fits", () => {
    // pins that shortening reuses the composition fullName is built from:
    // a name that fits must generate exactly what it did before
    for (const env of ["dev", "prod", "review"]) {
      const context = envContextFor("www", env);
      expect(getServiceNameForEnvContext(context).toString()).toBe(
        context.fullName.toLowerCase().toString(),
      );
    }
  });

  it("keeps the env and review slug intact and only shortens the component", () => {
    const context = envContextFor("recipe-processing-service", "review");
    const serviceName = getServiceNameForEnvContext(context).toString();
    expect(serviceName).toContain("pan-test-app-review-");
    expect(serviceName).toContain("CI_MERGE_REQUEST_IID");
    expect(serviceName).toContain("-recipe-processing-ser");
    expect(serviceName).not.toContain("-recipe-processing-service");
  });

  it("leaves fixed envs of the same component untouched", () => {
    const context = envContextFor("recipe-processing-service", "prod");
    expect(getServiceNameForEnvContext(context).toString()).toBe(
      "pan-test-app-prod-recipe-processing-service",
    );
  });
});
