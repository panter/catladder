import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentContext } from "@catladder/pipeline";
import { getSecretVarName } from "@catladder/pipeline";

const calls: string[] = [];
let responses: (cmd: string) => string | undefined;
vi.mock("child-process-promise", () => ({
  exec: async (cmd: string) => {
    calls.push(cmd);
    return { stdout: responses(cmd) ?? "" };
  },
}));
vi.mock("../serviceAccounts", () => ({ accountExists: async () => true }));
vi.mock("fs/promises", async (orig) => ({
  ...(await orig<object>()),
  readFile: async () =>
    JSON.stringify({ private_key_id: "new", private_key: "k" }),
}));

import { syncLocalAccessServiceAccount } from "../localAccess";

const context = {
  env: "dev",
  name: "web",
  fullConfig: { customerName: "acme", appName: "shop" },
} as ComponentContext;

const sa = /serviceAccount:local-diag-[^ ]+@p\.iam\.gserviceaccount\.com/;

const setup = (opts: { stored?: string; keys: string[]; bindings: any[] }) => {
  calls.length = 0;
  responses = (cmd) => {
    if (cmd.includes("get-iam-policy"))
      return JSON.stringify({
        bindings: opts.bindings.map((b) => ({
          ...b,
          members: b.members.map((m: string) =>
            m === "SA" ? (calls.join("").match(sa)?.[0] ?? m) : m,
          ),
        })),
      });
    if (cmd.includes("keys list"))
      return JSON.stringify(opts.keys.map((k) => ({ name: `a/keys/${k}` })));
    return undefined;
  };
  const vault = {
    readAllSecrets: vi.fn(async () =>
      opts.stored
        ? {
            [getSecretVarName(
              "local",
              "web",
              "LOCAL_ACCESS_GCP_DEV_CREDENTIALS",
            )]: opts.stored,
          }
        : {},
    ),
    writeSecrets: vi.fn(),
  };
  const manager = {
    vault,
    writeSecrets: vi.fn(),
    cacheSecrets: vi.fn(),
    readSecrets: vi.fn(),
  };
  const io = { log: vi.fn(), getVaultManager: async () => manager } as any;
  return { io, manager, vault };
};

beforeEach(() => {
  calls.length = 0;
});

describe("syncLocalAccessServiceAccount", () => {
  it("adds missing roles, never touches other members, and reads the vault uncached", async () => {
    const { io, manager, vault } = setup({
      keys: ["new"],
      stored: JSON.stringify({ private_key_id: "new" }),
      bindings: [{ role: "roles/run.admin", members: ["user:x@y.z"] }],
    });
    await syncLocalAccessServiceAccount(io, context, "p", [
      "roles/logging.viewer",
    ]);
    expect(
      calls.filter((c) => c.includes("add-iam-policy-binding")),
    ).toHaveLength(1);
    expect(calls.some((c) => c.includes("remove-iam-policy-binding"))).toBe(
      false,
    );
    expect(vault.readAllSecrets).toHaveBeenCalled();
    expect(manager.readSecrets).not.toHaveBeenCalled();
  });

  it("reuses a valid stored key (no create, no delete, no vault write)", async () => {
    const { io, manager } = setup({
      keys: ["k1"],
      stored: JSON.stringify({ private_key_id: "k1" }),
      bindings: [],
    });
    await syncLocalAccessServiceAccount(io, context, "p", [
      "roles/logging.viewer",
    ]);
    expect(calls.some((c) => c.includes("keys create"))).toBe(false);
    expect(calls.some((c) => c.includes("keys delete"))).toBe(false);
    expect(manager.writeSecrets).not.toHaveBeenCalled();
  });

  it("rotates: stores the new key, then deletes only the old ones", async () => {
    const { io, manager } = setup({
      keys: ["old1", "old2", "new"],
      bindings: [],
    });
    await syncLocalAccessServiceAccount(io, context, "p", [
      "roles/logging.viewer",
    ]);
    const create = calls.findIndex((c) => c.includes("keys create"));
    const deletes = calls.filter((c) => c.includes("keys delete"));
    expect(create).toBeGreaterThan(-1);
    expect(deletes).toHaveLength(2);
    expect(deletes.some((c) => c.includes(" new "))).toBe(false);
    expect(manager.writeSecrets).toHaveBeenCalledTimes(1);
    expect(manager.writeSecrets.mock.calls[0][0]).toBe("local");
  });
});
