import { describe, expect, it } from "vitest";
import type { Config } from "../../types/config";
import { getEnvironmentVariables } from "../getEnvironmentVariables";

const makeConfig = (publicVars: Record<string, string> = {}) =>
  ({
    appName: "test-app",
    customerName: "pan",
    store: {
      gcloudProjects: {
        "my-gcp-project": { projectNumber: "123456789012" },
      },
    },
    components: {
      api: {
        dir: "app",
        vars: {
          public: publicVars,
        },
        build: {
          type: "node",
          buildCommand: "yarn build",
          startCommand: "node .",
          test: false,
          lint: false,
          audit: false,
        },
        deploy: {
          type: "google-cloudrun",
          projectId: "my-gcp-project",
          region: "europe-west6",
        },
      },
    },
  }) satisfies Config;

describe("GOOGLE_CLOUD_PROJECT injection for google-cloudrun deploys", () => {
  it("injects the deploy's projectId into deployed envs", async () => {
    const { envVars } = await getEnvironmentVariables({
      config: makeConfig(),
      componentName: "api",
      env: "dev",
    });
    expect(String(envVars.GOOGLE_CLOUD_PROJECT)).toBe("my-gcp-project");
  });

  it("injects the deploy's projectId into the local env", async () => {
    const { envVars } = await getEnvironmentVariables({
      config: makeConfig(),
      componentName: "api",
      env: "local",
    });
    expect(String(envVars.GOOGLE_CLOUD_PROJECT)).toBe("my-gcp-project");
  });

  it("lets a user-defined vars.public value win", async () => {
    const config = makeConfig({ GOOGLE_CLOUD_PROJECT: "user-defined" });
    for (const env of ["dev", "local"]) {
      const { envVars } = await getEnvironmentVariables({
        config,
        componentName: "api",
        env,
      });
      expect(String(envVars.GOOGLE_CLOUD_PROJECT)).toBe("user-defined");
    }
  });

  it("does not inject it for components without a deploy", async () => {
    const config = {
      appName: "test-app",
      customerName: "pan",
      components: {
        api: {
          dir: "app",
          build: {
            type: "node",
            buildCommand: "yarn build",
            startCommand: "node .",
            test: false,
            lint: false,
            audit: false,
          },
        },
      },
    } satisfies Config;
    for (const env of ["dev", "local"]) {
      const { envVars } = await getEnvironmentVariables({
        config,
        componentName: "api",
        env,
      });
      expect(envVars).not.toHaveProperty("GOOGLE_CLOUD_PROJECT");
    }
  });
});
