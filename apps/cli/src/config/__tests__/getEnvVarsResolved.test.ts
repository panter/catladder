import { beforeEach, describe, expect, it, vi } from "vitest";

const keyFileVars = vi.fn();
vi.mock("../../localAccess/keyFiles", () => ({
  getLocalAccessKeyFileVars: (...args: unknown[]) => keyFileVars(...args),
}));
vi.mock("../../utils/projects", () => ({ getGitRoot: async () => "/repo" }));
vi.mock("@catladder/pipeline", async (orig) => ({
  ...(await orig<object>()),
  readConfig: async () => ({ config: { components: { web: {} } } }),
  getEnvironment: async () => ({
    envVars: { PLAIN: "value" },
    secretEnvVarKeys: [],
  }),
}));

import { getEnvVarsResolved } from "../getProjectConfig";

const io = {
  getVaultManager: async () => ({ readSecrets: async () => ({}) }),
} as any;

beforeEach(() => {
  keyFileVars.mockReset();
  keyFileVars.mockResolvedValue({
    CATLADDER_LOCAL_ACCESS_GCP_DEV_KEY_FILE: "/k",
  });
});

describe("getEnvVarsResolved", () => {
  it("adds the local access key file paths for the local env", async () => {
    expect(await getEnvVarsResolved(io, "local", "web")).toEqual({
      PLAIN: "value",
      CATLADDER_LOCAL_ACCESS_GCP_DEV_KEY_FILE: "/k",
    });
    expect(keyFileVars).toHaveBeenCalledWith(expect.anything(), "web");
  });

  it("leaves other envs untouched", async () => {
    expect(await getEnvVarsResolved(io, "dev", "web")).toEqual({
      PLAIN: "value",
    });
    expect(keyFileVars).not.toHaveBeenCalled();
  });
});
