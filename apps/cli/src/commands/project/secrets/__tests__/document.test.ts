import { describe, expect, it } from "vitest";
import {
  FILL_ME,
  checkSecretsDocument,
  collectSecretsWrites,
} from "../document";
import { parseKeysInput } from "../parseKeysInput";
import type { ScopedSecretKeys } from "../scope";

const scoped: ScopedSecretKeys = [
  { env: "dev", componentName: "web", keys: ["API_KEY", "SMTP_PASSWORD"] },
  { env: "prod", componentName: "web", keys: ["API_KEY", "SMTP_PASSWORD"] },
  { env: "dev", componentName: "worker", keys: ["QUEUE_TOKEN"] },
];

describe("checkSecretsDocument", () => {
  it("accepts a complete document", () => {
    const problems = checkSecretsDocument(
      {
        web: {
          dev: { API_KEY: "a", SMTP_PASSWORD: "b" },
          prod: { API_KEY: "c", SMTP_PASSWORD: "d" },
        },
        worker: { dev: { QUEUE_TOKEN: "e" } },
      },
      scoped,
      { requireComplete: true },
    );
    expect(problems).toEqual([]);
  });

  it("accepts a partial document when completeness is not required", () => {
    const problems = checkSecretsDocument(
      { web: { prod: { API_KEY: "rotated" } } },
      scoped,
      { requireComplete: false },
    );
    expect(problems).toEqual([]);
  });

  it("reports missing keys when completeness is required", () => {
    const problems = checkSecretsDocument(
      { web: { prod: { API_KEY: "rotated" } } },
      scoped,
      { requireComplete: true },
    );
    expect(problems).toEqual([
      '"dev:web": "API_KEY" has not been provided',
      '"dev:web": "SMTP_PASSWORD" has not been provided',
      '"prod:web": "SMTP_PASSWORD" has not been provided',
      '"dev:worker": "QUEUE_TOKEN" has not been provided',
    ]);
  });

  it("rejects undeclared keys, components and envs", () => {
    const problems = checkSecretsDocument(
      {
        web: {
          dev: { TYPO_KEY: "a" },
          stage: { API_KEY: "b" },
        },
        api: { dev: { API_KEY: "c" } },
      },
      scoped,
      { requireComplete: false },
    );
    expect(problems).toEqual([
      '"dev:web": "TYPO_KEY" is not declared in the config (or filtered out by --key)',
      '"stage:web" is not in this scope — remove it or widen the scope',
      '"api" is not a component in this scope — remove it or widen the scope',
    ]);
  });
});

describe("collectSecretsWrites", () => {
  it("collects only provided values and skips placeholders", () => {
    const { writes, skipped } = collectSecretsWrites(
      {
        web: {
          dev: { API_KEY: "a", SMTP_PASSWORD: FILL_ME },
          prod: { API_KEY: null as unknown as string },
        },
        worker: { dev: {} },
      },
      scoped,
    );
    expect(writes).toEqual([
      { env: "dev", componentName: "web", secrets: { API_KEY: "a" } },
    ]);
    expect(skipped).toEqual(["dev:web SMTP_PASSWORD", "prod:web API_KEY"]);
  });

  it("keeps objects and empty strings as values", () => {
    const { writes, skipped } = collectSecretsWrites(
      { web: { dev: { API_KEY: "", SMTP_PASSWORD: { user: "a" } } } },
      scoped,
    );
    expect(writes).toEqual([
      {
        env: "dev",
        componentName: "web",
        secrets: { API_KEY: "", SMTP_PASSWORD: { user: "a" } },
      },
    ]);
    expect(skipped).toEqual([]);
  });
});

describe("parseKeysInput", () => {
  it("splits and trims comma-separated keys", () => {
    expect(parseKeysInput("API_KEY, SMTP_PASSWORD ,")).toEqual([
      "API_KEY",
      "SMTP_PASSWORD",
    ]);
  });

  it("returns undefined for empty input", () => {
    expect(parseKeysInput(undefined)).toBeUndefined();
    expect(parseKeysInput("")).toBeUndefined();
    expect(parseKeysInput(" , ")).toBeUndefined();
  });
});
