import { describe, expect, it } from "vitest";
import type { Config } from "../../types";
import { getEnvConfig } from "../getEnvConfig";
import {
  getInheritedConfigChain,
  getSecretsEnv,
  normalizeEnvInherit,
} from "../getEnvInherit";
import { getDeclaredEnvType } from "../getEnvType";

describe("normalizeEnvInherit", () => {
  it("expands the string shorthand to both axes", () => {
    expect(normalizeEnvInherit("dev")).toEqual({
      config: "dev",
      secrets: "dev",
    });
  });
  it("keeps the object form and treats secrets: false as own secrets", () => {
    expect(normalizeEnvInherit({ config: "dev", secrets: false })).toEqual({
      config: "dev",
      secrets: undefined,
    });
    expect(normalizeEnvInherit({ config: "dev" })).toEqual({
      config: "dev",
      secrets: undefined,
    });
  });
});

describe("getInheritedConfigChain / getSecretsEnv", () => {
  const environments: Config["environments"] = {
    next: { on: { branch: "next" }, inherit: "dev" },
    beta: { type: "dev", inherit: { config: "next", secrets: "next" } },
  };

  it("builds the chain oldest ancestor first and follows secrets transitively", () => {
    expect(getInheritedConfigChain(environments, "next")).toEqual(["dev"]);
    expect(getInheritedConfigChain(environments, "beta")).toEqual([
      "dev",
      "next",
    ]);
    expect(getSecretsEnv(environments, "next")).toBe("dev");
    expect(getSecretsEnv(environments, "beta")).toBe("dev");
    expect(getSecretsEnv(environments, "dev")).toBe("dev");
  });

  it("rejects cycles, unknown targets and local", () => {
    expect(() =>
      getInheritedConfigChain({ a: { type: "dev", inherit: "a" } }, "a"),
    ).toThrow("cyclic");
    expect(() =>
      getSecretsEnv({ a: { type: "dev", inherit: "nope" } }, "a"),
    ).toThrow('unknown environment "nope"');
    expect(() =>
      getSecretsEnv({ a: { type: "dev", inherit: "local" } }, "a"),
    ).toThrow("local");
  });

  it("implies the env type from the inherited env", () => {
    expect(getDeclaredEnvType(environments, "next")).toBe("dev");
    expect(getDeclaredEnvType({ a: { inherit: "prod" } }, "a")).toBe("prod");
  });
});

describe("getEnvConfig with inheritance", () => {
  const config: Config = {
    appName: "my-app",
    customerName: "pan",
    environments: {
      next: { on: { branch: "next" }, inherit: "dev" },
    },
    components: {
      app: {
        dir: "app",
        build: { type: "node" },
        deploy: false,
        vars: { public: { BASE: "base", LEVEL: "component" } },
        env: {
          dev: {
            host: "dev.example.com",
            vars: {
              public: {
                LEVEL: "dev",
                DEV_ONLY: "yes",
                COUNT: (base: unknown) => `${base ?? "none"}-dev`,
              },
            },
          },
          next: {
            vars: { public: { LEVEL: "next" } },
          },
        },
      },
    },
  };

  it("merges the inherited env's overrides below the env's own", () => {
    const envConfig = getEnvConfig(config, "app", "next");
    expect(envConfig.vars?.public).toMatchObject({
      BASE: "base",
      LEVEL: "next", // own override wins over dev's
      DEV_ONLY: "yes", // inherited from dev
      COUNT: "none-dev", // dev's override function resolved against the base
    });
  });

  it("never inherits the host", () => {
    const envConfig = getEnvConfig(config, "app", "next");
    expect(envConfig.host).toBeUndefined();
    expect(getEnvConfig(config, "app", "dev").host).toBe("dev.example.com");
  });

  it("leaves envs without inheritance untouched", () => {
    const envConfig = getEnvConfig(config, "app", "dev");
    expect(envConfig.vars?.public).toMatchObject({
      LEVEL: "dev",
      DEV_ONLY: "yes",
    });
  });
});
